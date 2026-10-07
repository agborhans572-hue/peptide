begin;

create index if not exists manual_orders_customer_email_created_idx
  on public.manual_order_requests (lower(payload->'customer'->>'email'), created_at desc, id desc);

-- Verified customers can read their own requests without public table access.
create or replace function public.list_my_account_orders(
  p_limit integer default 20,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_order_number text default null
) returns table (
  id uuid, order_number text, payment_status text, fulfillment_status text,
  currency text, total_cents integer, created_at timestamptz,
  order_items jsonb, shipping_address jsonb
)
language sql stable security definer
set search_path = public, auth, pg_temp
as $$
  with customer as (
    select u.id, lower(u.email) as email
    from auth.users u join public.customer_profiles p on p.user_id = u.id
    where u.id = (select auth.uid()) and u.email_confirmed_at is not null
      and u.deleted_at is null and p.status = 'active'
  ), history as (
    select o.id, o.order_number, o.payment_status, 'pending'::text as fulfillment_status,
      coalesce(o.payload->'cart'->>'currency', 'usd') as currency,
      (o.payload->'cart'->>'totalCents')::integer as total_cents, o.created_at,
      (select jsonb_agg(jsonb_build_object(
        'id', item->>'variantId', 'sku', item->>'sku',
        'product_name', item->>'productName', 'product_option', item->>'option',
        'quantity', (item->>'quantity')::integer, 'total_cents', (item->>'totalCents')::integer
      )) from jsonb_array_elements(o.payload->'cart'->'items') item) as order_items,
      o.payload->'customer' as shipping_address
    from public.manual_order_requests o join customer c
      on lower(o.payload->'customer'->>'email') = c.email
    union all
    select o.id, o.order_number, o.payment_status, o.fulfillment_status,
      o.currency, o.total_cents, o.created_at,
      (select jsonb_agg(jsonb_build_object(
        'id', i.id, 'sku', i.sku, 'product_name', i.product_name,
        'product_option', i.product_option, 'quantity', i.quantity, 'total_cents', i.total_cents
      )) from public.order_items i where i.order_id = o.id), o.shipping_address
    from public.orders o join customer c on o.user_id = c.id
  )
  select h.* from history h
  where (p_order_number is null or h.order_number = p_order_number)
    and (p_before_created_at is null or (h.created_at, h.id) < (p_before_created_at, p_before_id))
  order by h.created_at desc, h.id desc
  limit least(greatest(p_limit, 1), 50);
$$;

revoke all on function public.list_my_account_orders(integer, timestamptz, uuid, text) from public, anon;
grant execute on function public.list_my_account_orders(integer, timestamptz, uuid, text) to authenticated;

commit;
