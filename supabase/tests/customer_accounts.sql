begin;
select plan(36);

select ok(to_regclass('public.customer_profiles') is not null, 'customer profiles table exists');
select ok(to_regclass('public.customer_addresses') is not null, 'customer addresses table exists');
select ok(to_regclass('public.account_deletion_requests') is not null, 'deletion request table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.customer_profiles'::regclass), 'profiles have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.customer_addresses'::regclass), 'addresses have RLS');

insert into auth.users(
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'alpha@example.test', crypt('StrongPassword!1', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
   '{"first_name":"Alpha","last_name":"Researcher","phone":"5555550101"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'beta@example.test', crypt('StrongPassword!2', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
   '{"first_name":"Beta","last_name":"Researcher","phone":"5555550102"}', now(), now());

select is(
  (select count(*)::integer from public.customer_profiles where user_id in (
    '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002'
  )), 2, 'auth trigger creates one profile per user'
);
update auth.users
set email = 'alpha-updated@example.test'
where id = '10000000-0000-0000-0000-000000000001';
select is(
  (select email from public.customer_profiles where user_id = '10000000-0000-0000-0000-000000000001'),
  'alpha-updated@example.test', 'auth email changes synchronize to the customer profile'
);
select is(
  (select count(*)::integer from public.customer_profiles where user_id = '10000000-0000-0000-0000-000000000001'),
  1, 'auth updates never create a duplicate customer profile'
);

insert into public.orders(
  id, user_id, currency, subtotal_cents, shipping_cents, total_cents,
  customer_email, payment_status, fulfillment_status
) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'usd', 1000, 0, 1000, 'alpha-updated@example.test', 'paid', 'ready'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002',
   'usd', 1000, 0, 1000, 'beta@example.test', 'paid', 'ready');

insert into public.order_items(
  order_id, product_id, product_name, product_option, quantity,
  unit_amount_cents, subtotal_cents, total_cents
) values
  ('20000000-0000-0000-0000-000000000001', 'product-alpha', 'Alpha Product', '10mg', 1, 1000, 1000, 1000),
  ('20000000-0000-0000-0000-000000000002', 'product-beta', 'Beta Product', '10mg', 1, 1000, 1000, 1000);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*)::integer from public.customer_profiles), 1, 'customer reads only own active profile');
select is((select count(*)::integer from public.orders), 1, 'customer reads only own orders');
select is(
  (select count(*)::integer from public.orders where id = '20000000-0000-0000-0000-000000000002'),
  0, 'changing order identifier cannot expose another customer order'
);
select is((select count(*)::integer from public.order_items), 1, 'customer reads only own order items');
select is(
  (select count(*)::integer from public.order_items where order_id = '20000000-0000-0000-0000-000000000002'),
  0, 'foreign order items remain inaccessible'
);

select lives_ok(
  $$select public.update_my_profile('Updated', 'Researcher', '5555550199', 'Lab', '12-3456789', 'https://example.test')$$,
  'customer can update permitted profile fields'
);
select lives_ok(
  $$select public.upsert_my_address('Alpha', 'Researcher', 'Lab', '123 Research Way', null, 'Austin', 'TX', '78701')$$,
  'customer can save a validated address'
);
select is((select count(*)::integer from public.customer_addresses), 1, 'customer reads only own address');
select throws_ok(
  $$select public.upsert_my_address('Alpha', 'Researcher', null, '123 Research Way', null, 'Austin', 'Texas', 'invalid')$$,
  '22023', null, 'invalid addresses are rejected server-side'
);
select throws_ok(
  $$update public.customer_profiles set status = 'active' where user_id = '10000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'customer cannot write account status directly'
);

reset role;
select public.set_customer_account_status(
  '10000000-0000-0000-0000-000000000001', 'suspended', 'test suspension', 'pgtap'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*)::integer from public.customer_profiles), 0, 'suspended profile is inaccessible');
select is((select count(*)::integer from public.orders), 0, 'suspended customer orders are inaccessible');
select throws_ok(
  $$select public.claim_my_paid_orders()$$,
  '42501', null, 'suspended customer cannot claim orders'
);

reset role;
update auth.users
set email_confirmed_at = null
where id = '10000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select throws_ok(
  $$select public.claim_my_paid_orders()$$,
  '42501', null, 'unverified customer cannot claim orders'
);
select is((select count(*)::integer from public.orders), 0, 'unverified customer cannot read protected orders');

reset role;
select public.set_customer_account_status(
  '10000000-0000-0000-0000-000000000001', 'active', 'restore after suspension test', 'pgtap'
);
insert into public.orders(
  id, user_id, currency, subtotal_cents, shipping_cents, total_cents,
  customer_email, payment_status, fulfillment_status
) values (
  '20000000-0000-0000-0000-000000000003', null, 'usd', 1500, 0, 1500,
  'alpha-updated@example.test', 'paid', 'ready'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(public.claim_my_paid_orders(), 1, 'verified active customer claims matching paid orders');
select is(
  (select user_id::text from public.orders where id = '20000000-0000-0000-0000-000000000003'),
  '10000000-0000-0000-0000-000000000001', 'claimed order is linked to the authenticated customer'
);

reset role;
select ok(
  has_function_privilege('service_role', 'public.queue_account_deletion(uuid,text)', 'EXECUTE'),
  'service role can queue account deletion'
);
select ok(
  not has_function_privilege('authenticated', 'public.queue_account_deletion(uuid,text)', 'EXECUTE'),
  'customers cannot bypass deletion endpoint'
);

select public.queue_account_deletion(
  '10000000-0000-0000-0000-000000000002',
  repeat('b', 64)
);
select is(
  (select status from public.customer_profiles where user_id = '10000000-0000-0000-0000-000000000002'),
  'deletion_requested', 'deletion request disables the customer account immediately'
);
select is(
  (select count(*)::integer from public.account_deletion_requests where user_id = '10000000-0000-0000-0000-000000000002'),
  1, 'only one open deletion request is created'
);
select is(
  (public.queue_account_deletion(
    '10000000-0000-0000-0000-000000000002',
    repeat('b', 64)
  )).id::text,
  (select id::text from public.account_deletion_requests
   where user_id = '10000000-0000-0000-0000-000000000002'),
  'repeated deletion requests are idempotent'
);

update public.account_deletion_requests
set eligible_at = now() - interval '1 minute', legal_hold = true
where user_id = '10000000-0000-0000-0000-000000000002';
select is(
  public.prepare_account_deletion((
    select id from public.account_deletion_requests
    where user_id = '10000000-0000-0000-0000-000000000002'
  )),
  null::uuid, 'legal hold prevents deletion processing'
);
update public.account_deletion_requests
set legal_hold = false
where user_id = '10000000-0000-0000-0000-000000000002';
select is(
  public.prepare_account_deletion((
    select id from public.account_deletion_requests
    where user_id = '10000000-0000-0000-0000-000000000002'
  )),
  null::uuid, 'active order defers deletion processing'
);
select is(
  (select status from public.account_deletion_requests
   where user_id = '10000000-0000-0000-0000-000000000002'),
  'deferred', 'active order records the deletion as deferred'
);
update public.orders
set fulfillment_status = 'fulfilled'
where id = '20000000-0000-0000-0000-000000000002';
update public.account_deletion_requests
set eligible_at = now() - interval '1 minute'
where user_id = '10000000-0000-0000-0000-000000000002';
select is(
  public.prepare_account_deletion((
    select id from public.account_deletion_requests
    where user_id = '10000000-0000-0000-0000-000000000002'
  ))::text,
  '10000000-0000-0000-0000-000000000002', 'eligible deletion advances to authentication removal'
);
select is(
  (select user_id::text from public.orders where id = '20000000-0000-0000-0000-000000000002'),
  null::text, 'retained financial order is detached from the deleted customer'
);
select like(
  (select customer_email from public.orders where id = '20000000-0000-0000-0000-000000000002'),
  'deleted+%@invalid.example', 'retained financial order email is anonymized'
);

select * from finish();
rollback;
