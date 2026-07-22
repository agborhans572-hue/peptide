begin;
select plan(9);

select ok((select relrowsecurity from pg_class where oid = 'public.orders'::regclass), 'orders has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.order_items'::regclass), 'order_items has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.stripe_events'::regclass), 'stripe_events has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.rate_limits'::regclass), 'rate_limits has RLS enabled');
select is((select public from storage.buckets where id = 'order-documents'), false, 'order document bucket is private');
select is(public.record_stripe_event('evt_idempotency_test', 'test.event', false), true, 'first webhook event is accepted');
select is(public.record_stripe_event('evt_idempotency_test', 'test.event', false), false, 'duplicate webhook event is ignored');

select id as test_order_id
from public.create_pending_order(
  'usd', 2200, 1099, 3299,
  '[{"productId":"vials-419","variantId":"420","sku":"BPC-157-5MG","productName":"BPC-157","option":"5mg","quantity":1,"unitAmountCents":2200,"discountBasisPoints":0,"subtotalCents":2200,"totalCents":2200,"productSnapshot":{"productId":"vials-419","variantId":"420","sku":"BPC-157-5MG","name":"BPC-157","option":"5mg","unitAmountCents":2200,"currency":"usd"}}]'::jsonb
) \gset

select throws_ok(
  format('select public.mark_order_fulfilled(%L::uuid)', :'test_order_id'),
  'P0001',
  'Only paid orders can be fulfilled',
  'unpaid orders cannot be fulfilled'
);
select is((select count(*)::integer from public.orders where id = :'test_order_id'::uuid), 1, 'pending order was created once');

select * from finish();
rollback;
