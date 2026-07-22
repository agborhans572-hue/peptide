begin;

create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default (
    'PHP-' || to_char(timezone('utc', now()), 'YYYYMMDD') || '-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 10))
  ),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
  fulfillment_status text not null default 'blocked' check (fulfillment_status in ('blocked', 'ready', 'processing', 'fulfilled', 'cancelled')),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  shipping_cents integer not null check (shipping_cents >= 0),
  total_cents integer not null check (total_cents >= 0 and total_cents = subtotal_cents + shipping_cents),
  refunded_cents integer not null default 0 check (refunded_cents >= 0 and refunded_cents <= total_cents),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  customer_email text,
  customer_name text,
  customer_phone text,
  shipping_address jsonb,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fulfilled_orders_must_be_paid check (fulfillment_status <> 'fulfilled' or payment_status = 'paid')
);

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id text not null,
  product_name text not null,
  product_option text not null,
  quantity integer not null check (quantity between 1 and 100),
  unit_amount_cents integer not null check (unit_amount_cents >= 0),
  discount_basis_points integer not null default 0 check (discount_basis_points between 0 and 10000),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.stripe_events (
  stripe_event_id text primary key,
  event_type text not null,
  livemode boolean not null,
  processed_at timestamptz not null default now()
);

create table if not exists public.rate_limits (
  scope text not null,
  client_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (scope, client_hash, window_started_at)
);

create index if not exists orders_customer_email_idx on public.orders (lower(customer_email));
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists rate_limits_window_idx on public.rate_limits (window_started_at);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.stripe_events enable row level security;
alter table public.rate_limits enable row level security;

revoke all on public.orders, public.order_items, public.stripe_events, public.rate_limits from anon, authenticated;

create or replace function public.consume_rate_limit(
  p_scope text,
  p_client_hash text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then raise exception 'Invalid rate limit'; end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limits(scope, client_hash, window_started_at, request_count)
  values (left(p_scope, 80), left(p_client_hash, 128), v_window, 1)
  on conflict (scope, client_hash, window_started_at)
  do update set request_count = public.rate_limits.request_count + 1
  returning request_count into v_count;
  return v_count <= p_limit;
end;
$$;

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
      order_id, product_id, product_name, product_option, quantity,
      unit_amount_cents, discount_basis_points, subtotal_cents, total_cents
    ) values (
      v_order.id,
      v_item->>'productId',
      v_item->>'productName',
      v_item->>'option',
      (v_item->>'quantity')::integer,
      (v_item->>'unitAmountCents')::integer,
      (v_item->>'discountBasisPoints')::integer,
      (v_item->>'subtotalCents')::integer,
      (v_item->>'totalCents')::integer
    );
  end loop;
  return v_order;
end;
$$;

create or replace function public.attach_stripe_session(p_order_id uuid, p_session_id text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.orders set stripe_checkout_session_id = p_session_id, updated_at = now()
  where id = p_order_id and payment_status = 'pending' and stripe_checkout_session_id is null;
  if not found then raise exception 'Pending order not found'; end if;
end;
$$;

create or replace function public.fail_pending_order(p_order_id uuid)
returns void language sql security definer set search_path = public, pg_temp as $$
  update public.orders set payment_status = 'failed', fulfillment_status = 'cancelled', updated_at = now()
  where id = p_order_id and payment_status = 'pending';
$$;

create or replace function public.record_stripe_event(p_event_id text, p_event_type text, p_livemode boolean)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.stripe_events(stripe_event_id, event_type, livemode)
  values (p_event_id, p_event_type, p_livemode)
  on conflict do nothing;
  return found;
end;
$$;

create or replace function public.record_paid_checkout(
  p_event_id text,
  p_event_type text,
  p_livemode boolean,
  p_order_id uuid,
  p_session_id text,
  p_payment_intent_id text,
  p_customer_email text,
  p_customer_name text,
  p_customer_phone text,
  p_shipping_address jsonb,
  p_amount_subtotal integer,
  p_amount_total integer,
  p_currency text
) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_new_event boolean;
begin
  v_new_event := public.record_stripe_event(p_event_id, p_event_type, p_livemode);
  if not v_new_event then return false; end if;

  update public.orders
  set payment_status = 'paid', fulfillment_status = 'ready',
      stripe_payment_intent_id = p_payment_intent_id,
      customer_email = lower(p_customer_email), customer_name = p_customer_name,
      customer_phone = p_customer_phone, shipping_address = p_shipping_address,
      paid_at = now(), updated_at = now()
  where id = p_order_id
    and stripe_checkout_session_id = p_session_id
    and payment_status = 'pending'
    and total_cents = p_amount_total
    and currency = lower(p_currency);
  if not found then raise exception 'Paid order verification failed'; end if;
  return true;
end;
$$;

create or replace function public.record_refund(
  p_event_id text,
  p_event_type text,
  p_livemode boolean,
  p_payment_intent_id text,
  p_amount_refunded integer
) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_new_event boolean;
begin
  v_new_event := public.record_stripe_event(p_event_id, p_event_type, p_livemode);
  if not v_new_event then return false; end if;
  update public.orders
  set refunded_cents = least(p_amount_refunded, total_cents),
      payment_status = case when p_amount_refunded >= total_cents then 'refunded' else 'partially_refunded' end,
      fulfillment_status = case when fulfillment_status in ('blocked', 'ready') then 'cancelled' else fulfillment_status end,
      updated_at = now()
  where stripe_payment_intent_id = p_payment_intent_id and payment_status in ('paid', 'partially_refunded');
  if not found then raise exception 'Refunded order not found'; end if;
  return true;
end;
$$;

create or replace function public.record_payment_failure(
  p_event_id text,
  p_event_type text,
  p_livemode boolean,
  p_payment_intent_id text,
  p_order_id uuid
) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_new_event boolean;
begin
  v_new_event := public.record_stripe_event(p_event_id, p_event_type, p_livemode);
  if not v_new_event then return false; end if;
  update public.orders
  set payment_status = 'failed', fulfillment_status = 'cancelled',
      stripe_payment_intent_id = coalesce(p_payment_intent_id, stripe_payment_intent_id), updated_at = now()
  where id = p_order_id and payment_status = 'pending';
  return true;
end;
$$;

create or replace function public.mark_order_fulfilled(p_order_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.orders
  set fulfillment_status = 'fulfilled', fulfilled_at = now(), updated_at = now()
  where id = p_order_id and payment_status = 'paid' and fulfillment_status in ('ready', 'processing');
  if not found then raise exception 'Only paid orders can be fulfilled'; end if;
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.create_pending_order(text, integer, integer, integer, jsonb) from public, anon, authenticated;
revoke all on function public.attach_stripe_session(uuid, text) from public, anon, authenticated;
revoke all on function public.fail_pending_order(uuid) from public, anon, authenticated;
revoke all on function public.record_stripe_event(text, text, boolean) from public, anon, authenticated;
revoke all on function public.record_paid_checkout(text, text, boolean, uuid, text, text, text, text, text, jsonb, integer, integer, text) from public, anon, authenticated;
revoke all on function public.record_refund(text, text, boolean, text, integer) from public, anon, authenticated;
revoke all on function public.record_payment_failure(text, text, boolean, text, uuid) from public, anon, authenticated;
revoke all on function public.mark_order_fulfilled(uuid) from public, anon, authenticated;

grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;
grant execute on function public.create_pending_order(text, integer, integer, integer, jsonb) to service_role;
grant execute on function public.attach_stripe_session(uuid, text) to service_role;
grant execute on function public.fail_pending_order(uuid) to service_role;
grant execute on function public.record_stripe_event(text, text, boolean) to service_role;
grant execute on function public.record_paid_checkout(text, text, boolean, uuid, text, text, text, text, text, jsonb, integer, integer, text) to service_role;
grant execute on function public.record_refund(text, text, boolean, text, integer) to service_role;
grant execute on function public.record_payment_failure(text, text, boolean, text, uuid) to service_role;
grant execute on function public.mark_order_fulfilled(uuid) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('order-documents', 'order-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can read order documents" on storage.objects;
create policy "Admins can read order documents" on storage.objects for select to authenticated
using (bucket_id = 'order-documents' and auth.jwt()->'app_metadata'->>'role' = 'admin');

drop policy if exists "Admins can upload order documents" on storage.objects;
create policy "Admins can upload order documents" on storage.objects for insert to authenticated
with check (bucket_id = 'order-documents' and auth.jwt()->'app_metadata'->>'role' = 'admin');

drop policy if exists "Admins can update order documents" on storage.objects;
create policy "Admins can update order documents" on storage.objects for update to authenticated
using (bucket_id = 'order-documents' and auth.jwt()->'app_metadata'->>'role' = 'admin')
with check (bucket_id = 'order-documents' and auth.jwt()->'app_metadata'->>'role' = 'admin');

drop policy if exists "Admins can delete order documents" on storage.objects;
create policy "Admins can delete order documents" on storage.objects for delete to authenticated
using (bucket_id = 'order-documents' and auth.jwt()->'app_metadata'->>'role' = 'admin');

commit;
