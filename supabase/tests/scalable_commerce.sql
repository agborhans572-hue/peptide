begin;
select plan(46);

select ok(to_regclass('public.stripe_event_inbox') is not null, 'Stripe inbox exists');
select ok(to_regclass('public.commerce_jobs') is not null, 'commerce jobs table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.stripe_event_inbox'::regclass), 'Stripe inbox has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.commerce_jobs'::regclass), 'commerce jobs have RLS');
select has_column('public', 'orders', 'woo_order_id', 'orders reference the authoritative Woo order');
select has_column('public', 'orders', 'checkout_attempt_id', 'orders persist checkout idempotency keys');
select has_column('public', 'orders', 'reservation_expires_at', 'orders persist reservation expiry');

select lives_ok(
  $$select public.create_reserved_order(
    '30000000-0000-0000-0000-000000000001', 900001, now() + interval '30 minutes',
    'catalog-test-version', 'usd', 2200, 1099, 3299,
    '[{"productId":"vials-419","variantId":"420","sku":"BPC-157-5MG","productName":"BPC-157","option":"5mg","quantity":1,"unitAmountCents":2200,"discountBasisPoints":0,"subtotalCents":2200,"totalCents":2200,"productSnapshot":{"catalogVersion":"catalog-test-version"}}]'::jsonb,
    null
  )$$,
  'a reserved projection can be created'
);
select is((select count(*)::integer from public.orders where checkout_attempt_id = '30000000-0000-0000-0000-000000000001'), 1, 'one projected order is created');
select is((select count(*)::integer from public.order_items where order_id = (select id from public.orders where checkout_attempt_id = '30000000-0000-0000-0000-000000000001')), 1, 'reserved order line is created once');
select lives_ok(
  $$select public.create_reserved_order(
    '30000000-0000-0000-0000-000000000001', 900001, now() + interval '30 minutes',
    'catalog-test-version', 'usd', 2200, 1099, 3299,
    '[{"productId":"vials-419","variantId":"420","sku":"BPC-157-5MG","productName":"BPC-157","option":"5mg","quantity":1,"unitAmountCents":2200,"discountBasisPoints":0,"subtotalCents":2200,"totalCents":2200,"productSnapshot":{"catalogVersion":"catalog-test-version"}}]'::jsonb,
    null
  )$$,
  'replaying the same checkout attempt is idempotent'
);
select is((select count(*)::integer from public.order_items where order_id = (select id from public.orders where checkout_attempt_id = '30000000-0000-0000-0000-000000000001')), 1, 'checkout replay does not duplicate order lines');
select throws_ok(
  $$select public.create_reserved_order(
    '30000000-0000-0000-0000-000000000001', 900001, now() + interval '30 minutes',
    'catalog-test-version', 'usd', 2100, 1099, 3199,
    '[{"productId":"vials-419","variantId":"420","sku":"BPC-157-5MG","productName":"BPC-157","option":"5mg","quantity":1,"unitAmountCents":2200,"discountBasisPoints":0,"subtotalCents":2200,"totalCents":2100,"productSnapshot":{}}]'::jsonb,
    null
  )$$,
  null, null, 'a reused checkout attempt cannot change totals'
);

select ok(public.enqueue_stripe_event('evt_scalability_1', 'checkout.session.completed', false, '{"id":"evt_scalability_1"}'::jsonb), 'first Stripe event insert wins');
select isnt(public.enqueue_stripe_event('evt_scalability_1', 'checkout.session.completed', false, '{}'::jsonb), true, 'duplicate Stripe event is ignored');
select is((select count(*)::integer from public.claim_stripe_events('worker-a', 100, 120)), 1, 'worker claims the available Stripe event');
select is((select count(*)::integer from public.claim_stripe_events('worker-b', 100, 120)), 0, 'active leases prevent overlapping Stripe claims');
select is((select attempts from public.stripe_event_inbox where stripe_event_id = 'evt_scalability_1'), 1, 'Stripe attempt count increments when claimed');
select lives_ok($$select public.retry_stripe_event('evt_scalability_1', 'temporary outage')$$, 'Stripe events can be requeued');
select is((select status from public.stripe_event_inbox where stripe_event_id = 'evt_scalability_1'), 'retry', 'retry state is persisted');
select ok(public.enqueue_stripe_event('evt_scalability_2', 'checkout.session.completed', false, '{"id":"evt_scalability_2"}'::jsonb), 'second Stripe event is queued');
select is((select count(*)::integer from public.claim_stripe_event('evt_scalability_2', 'webhook-a', 120)), 1, 'one webhook delivery claims its specific event');
select is((select count(*)::integer from public.claim_stripe_event('evt_scalability_2', 'webhook-b', 120)), 0, 'duplicate webhook delivery cannot overlap processing');

select is(
  public.enqueue_commerce_job('cancel_reservation', 'dedupe-test-1', 'aggregate-1', '{"wooOrderId":900001}'::jsonb),
  public.enqueue_commerce_job('cancel_reservation', 'dedupe-test-1', 'aggregate-1', '{"wooOrderId":900001}'::jsonb),
  'commerce job enqueue is idempotent'
);
select is((select count(*)::integer from public.claim_commerce_jobs('worker-a', 100, 120)), 1, 'worker claims one commerce job');
select is((select count(*)::integer from public.claim_commerce_jobs('worker-b', 100, 120)), 0, 'active commerce job lease cannot be double claimed');
select is((select attempts from public.commerce_jobs where dedupe_key = 'dedupe-test-1'), 1, 'commerce attempt count increments');
select lives_ok($$select public.complete_commerce_job((select id from public.commerce_jobs where dedupe_key = 'dedupe-test-1'))$$, 'commerce job can be completed');
select is((select status from public.commerce_jobs where dedupe_key = 'dedupe-test-1'), 'completed', 'completed work remains state-set');

select lives_ok(
  $$select public.enqueue_commerce_job('reconcile_order', 'lease-test-1', 'aggregate-2', '{"wooOrderId":900001}'::jsonb)$$,
  'a second commerce job can be enqueued'
);
select is((select count(*)::integer from public.claim_commerce_jobs('worker-a', 100, 30)), 1, 'second job receives a lease');
update public.commerce_jobs set lease_expires_at = now() - interval '1 second' where dedupe_key = 'lease-test-1';
select is((select count(*)::integer from public.claim_commerce_jobs('worker-b', 100, 30)), 1, 'an expired lease is recoverable');
select is((select attempts from public.commerce_jobs where dedupe_key = 'lease-test-1'), 2, 'reclaimed work records another attempt');

select ok(public.apply_woo_order_projection(900001, 'processing', 3299), 'Woo paid state projects locally');
select is((select payment_status from public.orders where woo_order_id = 900001), 'paid', 'Woo payment makes the projection paid');
select lives_ok($$select public.apply_woo_order_projection(900001, 'cancelled', 3299)$$, 'late Woo delivery is accepted idempotently');
select is((select payment_status from public.orders where woo_order_id = 900001), 'paid', 'late cancellation cannot regress a paid order');
select lives_ok(
  $$update public.orders
    set fulfillment_status = 'fulfilled', payment_status = 'refunded'
    where woo_order_id = 900001$$,
  'a fulfilled order may transition to refunded without violating its invariant'
);
select is((select payment_status from public.orders where woo_order_id = 900001), 'refunded', 'the refunded terminal state is preserved');
select is((select public from storage.buckets where id = 'product-media'), true, 'product-media bucket is public');
select isnt(has_table_privilege('authenticated', 'public.stripe_event_inbox', 'select'), true, 'customers cannot read the Stripe inbox');
select isnt(has_table_privilege('anon', 'public.commerce_jobs', 'select'), true, 'anonymous users cannot read commerce jobs');

insert into auth.users(
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000', '40000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'lease-delete@example.test', crypt('StrongPassword!9', gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()
);
insert into public.account_deletion_requests(id, user_id, email_hash, eligible_at)
values (
  '40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001',
  encode(digest('lease-delete@example.test', 'sha256'), 'hex'), now() - interval '1 minute'
);
select is((select count(*)::integer from public.claim_account_deletions('delete-worker-a', 100, 600)), 1, 'deletion worker claims an eligible request');
select is((select count(*)::integer from public.claim_account_deletions('delete-worker-b', 100, 600)), 0, 'deletion leases prevent overlapping claims');
select is(
  public.prepare_leased_account_deletion('40000000-0000-0000-0000-000000000002', 'delete-worker-a'),
  '40000000-0000-0000-0000-000000000001'::uuid,
  'the lease owner can prepare the deletion'
);
update public.account_deletion_requests set lease_expires_at = now() - interval '1 second'
where id = '40000000-0000-0000-0000-000000000002';
select is((select count(*)::integer from public.claim_account_deletions('delete-worker-b', 100, 600)), 1, 'expired processing leases are recoverable');

select * from finish();
rollback;
