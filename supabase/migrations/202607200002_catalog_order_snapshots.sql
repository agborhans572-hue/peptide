begin;

alter table public.order_items
  add column if not exists variant_id text,
  add column if not exists sku text,
  add column if not exists product_snapshot jsonb;

create index if not exists order_items_product_snapshot_idx
  on public.order_items (product_id, variant_id);

create or replace function public.create_pending_order(
  p_currency text,
  p_subtotal_cents integer,
  p_shipping_cents integer,
  p_total_cents integer,
  p_items jsonb
) returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_item jsonb;
  v_item_total integer := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 25 then
    raise exception 'Invalid order items';
  end if;
  select coalesce(sum((value->>'totalCents')::integer), 0)
    into v_item_total from jsonb_array_elements(p_items);
  if v_item_total <> p_subtotal_cents or p_total_cents <> p_subtotal_cents + p_shipping_cents then
    raise exception 'Invalid order totals';
  end if;

  insert into public.orders(currency, subtotal_cents, shipping_cents, total_cents)
  values (lower(p_currency), p_subtotal_cents, p_shipping_cents, p_total_cents)
  returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    insert into public.order_items(
      order_id, product_id, variant_id, sku, product_name, product_option, quantity,
      unit_amount_cents, discount_basis_points, subtotal_cents, total_cents, product_snapshot
    ) values (
      v_order.id,
      v_item->>'productId',
      v_item->>'variantId',
      v_item->>'sku',
      v_item->>'productName',
      v_item->>'option',
      (v_item->>'quantity')::integer,
      (v_item->>'unitAmountCents')::integer,
      (v_item->>'discountBasisPoints')::integer,
      (v_item->>'subtotalCents')::integer,
      (v_item->>'totalCents')::integer,
      v_item->'productSnapshot'
    );
  end loop;
  return v_order;
end;
$$;

revoke all on function public.create_pending_order(text, integer, integer, integer, jsonb) from public, anon, authenticated;
grant execute on function public.create_pending_order(text, integer, integer, integer, jsonb) to service_role;

commit;
