begin;

alter table public.orders
  drop constraint if exists orders_payment_status_check;

alter table public.orders
  drop constraint if exists fulfilled_orders_must_be_paid,
  drop constraint if exists fulfilled_orders_must_have_payment;

alter table public.orders
  add constraint orders_payment_status_check
    check (payment_status in ('pending', 'paid', 'failed', 'expired', 'refunded', 'partially_refunded')),
  add column if not exists woo_order_id bigint,
  add column if not exists checkout_attempt_id uuid,
  add column if not exists reservation_expires_at timestamptz,
  add column if not exists stripe_checkout_url text,
  add column if not exists catalog_version text,
  add column if not exists sync_status text not null default 'legacy'
    check (sync_status in ('legacy', 'reserved', 'pending', 'synced', 'retry', 'failed')),
  add column if not exists sync_version integer not null default 0 check (sync_version >= 0),
  add column if not exists last_synced_at timestamptz;

alter table public.orders
  add constraint fulfilled_orders_must_have_payment
    check (
      fulfillment_status <> 'fulfilled'
      or payment_status in ('paid', 'partially_refunded', 'refunded')
    );

alter table public.account_deletion_requests
  add column if not exists lease_owner text,
  add column if not exists lease_expires_at timestamptz;

create index if not exists account_deletion_lease_idx
  on public.account_deletion_requests (eligible_at, lease_expires_at)
  where status in ('pending', 'processing', 'deferred') and legal_hold = false;

create unique index if not exists orders_woo_order_id_idx
  on public.orders (woo_order_id) where woo_order_id is not null;
create unique index if not exists orders_checkout_attempt_id_idx
  on public.orders (checkout_attempt_id) where checkout_attempt_id is not null;
create index if not exists orders_expiring_reservations_idx
  on public.orders (reservation_expires_at)
  where payment_status = 'pending' and reservation_expires_at is not null;
create index if not exists orders_sync_retry_idx
  on public.orders (updated_at)
  where sync_status in ('reserved', 'pending', 'retry');

create table if not exists public.stripe_event_inbox (
  stripe_event_id text primary key,
  event_type text not null,
  livemode boolean not null,
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'retry', 'completed', 'dead')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz,
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists stripe_event_inbox_claim_idx
  on public.stripe_event_inbox (available_at, received_at)
  where status in ('pending', 'retry');

create table if not exists public.commerce_jobs (
  id bigint generated always as identity primary key,
  job_type text not null
    check (job_type in ('cancel_reservation', 'reconcile_order')),
  dedupe_key text not null unique,
  aggregate_id text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'retry', 'completed', 'dead')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists commerce_jobs_claim_idx
  on public.commerce_jobs (available_at, id)
  where status in ('pending', 'retry');

alter table public.stripe_event_inbox enable row level security;
alter table public.commerce_jobs enable row level security;
revoke all on public.stripe_event_inbox, public.commerce_jobs from public, anon, authenticated;
grant all on public.stripe_event_inbox, public.commerce_jobs to service_role;
grant usage, select on sequence public.commerce_jobs_id_seq to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-media',
  'product-media',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml', 'application/pdf']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.claim_account_deletions(
  p_worker_id text,
  p_limit integer default 100,
  p_lease_seconds integer default 300
) returns setof public.account_deletion_requests
language sql
security definer
set search_path = public, pg_temp
as $$
  with candidates as (
    select id
    from public.account_deletion_requests
    where legal_hold = false
      and (lease_expires_at is null or lease_expires_at <= now())
      and (
        (status in ('pending', 'deferred') and eligible_at <= now())
        or status = 'processing'
      )
    order by eligible_at, id
    for update skip locked
    limit least(greatest(p_limit, 1), 100)
  )
  update public.account_deletion_requests d
  set lease_owner = left(p_worker_id, 120),
      lease_expires_at = now() + make_interval(secs => least(greatest(p_lease_seconds, 60), 900)),
      updated_at = now()
  from candidates c
  where d.id = c.id
  returning d.*;
$$;

create or replace function public.prepare_leased_account_deletion(
  p_request_id uuid,
  p_worker_id text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.account_deletion_requests;
  v_active_orders integer;
  v_anonymous_email text;
begin
  select * into v_request
  from public.account_deletion_requests
  where id = p_request_id
    and lease_owner = left(p_worker_id, 120)
    and lease_expires_at > now()
  for update;

  if v_request.id is null or v_request.legal_hold
    or v_request.status not in ('pending', 'processing', 'deferred')
    or (v_request.status <> 'processing' and v_request.eligible_at > now()) then
    return null;
  end if;
  if v_request.user_id is null then return null; end if;

  if v_request.status <> 'processing' then
    select count(*) into v_active_orders
    from public.orders
    where user_id = v_request.user_id
      and (payment_status = 'pending' or fulfillment_status in ('ready', 'processing'));
    if v_active_orders > 0 then
      update public.account_deletion_requests
      set status = 'deferred', eligible_at = now() + interval '7 days',
          defer_reason = 'Active order requires completion or cancellation',
          lease_owner = null, lease_expires_at = null
      where id = p_request_id;
      return null;
    end if;
  end if;

  v_anonymous_email := 'deleted+' || left(v_request.email_hash, 24) || '@invalid.example';
  update public.orders
  set user_id = null, customer_email = v_anonymous_email, customer_name = null,
      customer_phone = null, shipping_address = null, updated_at = now()
  where user_id = v_request.user_id;
  update public.account_deletion_requests
  set status = 'processing', defer_reason = null
  where id = p_request_id;
  return v_request.user_id;
end;
$$;

create or replace function public.complete_account_deletion(p_request_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.account_deletion_requests
  set status = 'completed', completed_at = now(), user_id = null, defer_reason = null,
      lease_owner = null, lease_expires_at = null
  where id = p_request_id and status = 'processing';
$$;

create or replace function public.defer_account_deletion(p_request_id uuid, p_reason text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.account_deletion_requests
  set status = 'deferred', eligible_at = now() + interval '1 day',
      defer_reason = left(p_reason, 500), lease_owner = null, lease_expires_at = null
  where id = p_request_id and status = 'processing';
$$;

create or replace function public.create_reserved_order(
  p_checkout_attempt_id uuid,
  p_woo_order_id bigint,
  p_reservation_expires_at timestamptz,
  p_catalog_version text,
  p_currency text,
  p_subtotal_cents integer,
  p_shipping_cents integer,
  p_total_cents integer,
  p_items jsonb,
  p_user_id uuid
) returns public.orders
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_order public.orders;
  v_item jsonb;
  v_item_total integer := 0;
  v_inserted boolean := false;
begin
  if p_checkout_attempt_id is null or p_woo_order_id < 1 then
    raise exception 'Invalid checkout reservation';
  end if;
  if p_reservation_expires_at <= now() then
    raise exception 'Reservation is already expired';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 25 then
    raise exception 'Invalid order items';
  end if;
  select coalesce(sum((value->>'totalCents')::integer), 0)
    into v_item_total from jsonb_array_elements(p_items);
  if v_item_total <> p_subtotal_cents or p_total_cents <> p_subtotal_cents + p_shipping_cents then
    raise exception 'Invalid order totals';
  end if;
  if p_user_id is not null and not exists (
    select 1 from auth.users u
    join public.customer_profiles p on p.user_id = u.id
    where u.id = p_user_id and u.email_confirmed_at is not null and p.status = 'active'
  ) then
    raise exception 'Invalid customer account';
  end if;

  insert into public.orders(
    user_id, woo_order_id, checkout_attempt_id, reservation_expires_at,
    catalog_version, sync_status, currency, subtotal_cents, shipping_cents, total_cents
  ) values (
    p_user_id, p_woo_order_id, p_checkout_attempt_id, p_reservation_expires_at,
    left(p_catalog_version, 120), 'reserved', lower(p_currency),
    p_subtotal_cents, p_shipping_cents, p_total_cents
  )
  on conflict (checkout_attempt_id) do nothing
  returning * into v_order;
  v_inserted := found;

  if not v_inserted then
    select * into v_order
    from public.orders where checkout_attempt_id = p_checkout_attempt_id;
    if v_order.id is null
      or v_order.woo_order_id <> p_woo_order_id
      or v_order.total_cents <> p_total_cents
      or v_order.catalog_version <> left(p_catalog_version, 120) then
      raise exception 'Checkout attempt conflicts with an existing order';
    end if;
    return v_order;
  end if;

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

create or replace function public.attach_reserved_checkout(
  p_order_id uuid,
  p_session_id text,
  p_checkout_url text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.orders
  set stripe_checkout_session_id = p_session_id,
      stripe_checkout_url = p_checkout_url,
      sync_status = 'pending',
      sync_version = sync_version + 1,
      updated_at = now()
  where id = p_order_id
    and payment_status = 'pending'
    and reservation_expires_at > now()
    and (stripe_checkout_session_id is null or stripe_checkout_session_id = p_session_id);
  if not found then raise exception 'Active reserved order not found'; end if;
end;
$$;

create or replace function public.enqueue_stripe_event(
  p_event_id text,
  p_event_type text,
  p_livemode boolean,
  p_payload jsonb
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.stripe_event_inbox(stripe_event_id, event_type, livemode, payload)
  values (left(p_event_id, 255), left(p_event_type, 120), p_livemode, p_payload)
  on conflict (stripe_event_id) do nothing;
  return found;
end;
$$;

create or replace function public.claim_stripe_events(
  p_worker_id text,
  p_limit integer default 100,
  p_lease_seconds integer default 120
) returns setof public.stripe_event_inbox
language sql
security definer
set search_path = public, pg_temp
as $$
  with candidates as (
    select stripe_event_id
    from public.stripe_event_inbox
    where available_at <= now()
      and (
        status in ('pending', 'retry')
        or (status = 'processing' and lease_expires_at <= now())
      )
    order by available_at, received_at
    for update skip locked
    limit least(greatest(p_limit, 1), 100)
  )
  update public.stripe_event_inbox i
  set status = 'processing',
      attempts = attempts + 1,
      lease_owner = left(p_worker_id, 120),
      lease_expires_at = now() + make_interval(secs => least(greatest(p_lease_seconds, 30), 600)),
      updated_at = now()
  from candidates c
  where i.stripe_event_id = c.stripe_event_id
  returning i.*;
$$;

create or replace function public.claim_stripe_event(
  p_event_id text,
  p_worker_id text,
  p_lease_seconds integer default 120
) returns setof public.stripe_event_inbox
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.stripe_event_inbox
  set status = 'processing', attempts = attempts + 1,
      lease_owner = left(p_worker_id, 120),
      lease_expires_at = now() + make_interval(secs => least(greatest(p_lease_seconds, 30), 600)),
      updated_at = now()
  where stripe_event_id = p_event_id
    and available_at <= now()
    and (
      status in ('pending', 'retry')
      or (status = 'processing' and lease_expires_at <= now())
    )
  returning *;
$$;

create or replace function public.complete_stripe_event(p_event_id text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.stripe_event_inbox
  set status = 'completed', processed_at = now(), lease_owner = null,
      lease_expires_at = null, last_error = null, updated_at = now()
  where stripe_event_id = p_event_id and status <> 'completed';
$$;

create or replace function public.retry_stripe_event(p_event_id text, p_error text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.stripe_event_inbox
  set status = case when attempts >= 12 then 'dead' else 'retry' end,
      available_at = now() + make_interval(secs => least(900, greatest(5, (attempts * attempts) * 5))),
      lease_owner = null, lease_expires_at = null,
      last_error = left(p_error, 1000), updated_at = now()
  where stripe_event_id = p_event_id and status <> 'completed';
$$;

create or replace function public.enqueue_commerce_job(
  p_job_type text,
  p_dedupe_key text,
  p_aggregate_id text,
  p_payload jsonb default '{}'::jsonb,
  p_available_at timestamptz default now()
) returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  insert into public.commerce_jobs(job_type, dedupe_key, aggregate_id, payload, available_at)
  values (p_job_type, left(p_dedupe_key, 240), left(p_aggregate_id, 240), coalesce(p_payload, '{}'::jsonb), p_available_at)
  on conflict (dedupe_key) do update
    set available_at = least(public.commerce_jobs.available_at, excluded.available_at),
        updated_at = now()
    where public.commerce_jobs.status not in ('completed', 'dead')
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.commerce_jobs where dedupe_key = left(p_dedupe_key, 240);
  end if;
  return v_id;
end;
$$;

create or replace function public.claim_commerce_jobs(
  p_worker_id text,
  p_limit integer default 100,
  p_lease_seconds integer default 120
) returns setof public.commerce_jobs
language sql
security definer
set search_path = public, pg_temp
as $$
  with candidates as (
    select id
    from public.commerce_jobs
    where available_at <= now()
      and (
        status in ('pending', 'retry')
        or (status = 'processing' and lease_expires_at <= now())
      )
    order by available_at, id
    for update skip locked
    limit least(greatest(p_limit, 1), 100)
  )
  update public.commerce_jobs j
  set status = 'processing', attempts = attempts + 1,
      lease_owner = left(p_worker_id, 120),
      lease_expires_at = now() + make_interval(secs => least(greatest(p_lease_seconds, 30), 600)),
      updated_at = now()
  from candidates c
  where j.id = c.id
  returning j.*;
$$;

create or replace function public.complete_commerce_job(p_job_id bigint)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.commerce_jobs
  set status = 'completed', completed_at = now(), lease_owner = null,
      lease_expires_at = null, last_error = null, updated_at = now()
  where id = p_job_id and status <> 'completed';
$$;

create or replace function public.retry_commerce_job(p_job_id bigint, p_error text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.commerce_jobs
  set status = case when attempts >= 12 then 'dead' else 'retry' end,
      available_at = now() + make_interval(secs => least(1800, greatest(10, (attempts * attempts) * 10))),
      lease_owner = null, lease_expires_at = null,
      last_error = left(p_error, 1000), updated_at = now()
  where id = p_job_id and status <> 'completed';
$$;

create or replace function public.enqueue_expired_checkout_jobs(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  with expired as (
    select id, woo_order_id
    from public.orders
    where payment_status = 'pending'
      and woo_order_id is not null
      and reservation_expires_at <= now()
    order by reservation_expires_at
    limit least(greatest(p_limit, 1), 100)
  ), inserted as (
    insert into public.commerce_jobs(job_type, dedupe_key, aggregate_id, payload)
    select 'cancel_reservation', 'expire-order-' || id::text, id::text,
      jsonb_build_object('orderId', id, 'wooOrderId', woo_order_id, 'reason', 'reservation_expired')
    from expired
    on conflict (dedupe_key) do nothing
    returning 1
  )
  select count(*) into v_count from inserted;
  return v_count;
end;
$$;

create or replace function public.enqueue_reconciliation_jobs(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
  v_bucket bigint := floor(extract(epoch from now()) / 900);
begin
  with candidates as (
    select id, woo_order_id
    from public.orders
    where woo_order_id is not null
      and created_at >= now() - interval '7 days'
      and (
        sync_status in ('reserved', 'pending', 'retry', 'failed')
        or last_synced_at is null
        or last_synced_at < now() - interval '15 minutes'
      )
    order by coalesce(last_synced_at, created_at), id
    limit least(greatest(p_limit, 1), 100)
  ), inserted as (
    insert into public.commerce_jobs(job_type, dedupe_key, aggregate_id, payload)
    select 'reconcile_order', 'reconcile-order-' || id::text || '-' || v_bucket::text, id::text,
      jsonb_build_object('orderId', id, 'wooOrderId', woo_order_id)
    from candidates
    on conflict (dedupe_key) do nothing
    returning 1
  )
  select count(*) into v_count from inserted;
  return v_count;
end;
$$;

create or replace function public.mark_order_expired(p_order_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.orders
  set payment_status = 'expired', fulfillment_status = 'cancelled',
      sync_status = 'synced', last_synced_at = now(),
      sync_version = sync_version + 1, updated_at = now()
  where id = p_order_id and payment_status = 'pending';
$$;

create or replace function public.record_checkout_expired(
  p_event_id text,
  p_event_type text,
  p_livemode boolean,
  p_order_id uuid,
  p_session_id text
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_new_event boolean;
begin
  v_new_event := public.record_stripe_event(p_event_id, p_event_type, p_livemode);
  if not v_new_event then return false; end if;
  update public.orders
  set payment_status = 'expired', fulfillment_status = 'cancelled',
      sync_status = 'synced', last_synced_at = now(),
      sync_version = sync_version + 1, updated_at = now()
  where id = p_order_id
    and stripe_checkout_session_id = p_session_id
    and payment_status = 'pending';
  return found;
end;
$$;

-- Woo can emit its paid/refunded webhook before the initiating Stripe handler
-- finishes. These state-setting versions safely enrich an already-projected
-- terminal state instead of treating delivery order as a verification failure.
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
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_new_event boolean;
  v_verified_user_id uuid;
begin
  v_new_event := public.record_stripe_event(p_event_id, p_event_type, p_livemode);
  if not v_new_event then return false; end if;
  select u.id into v_verified_user_id
  from auth.users u
  join public.customer_profiles p on p.user_id = u.id and p.status = 'active'
  where lower(u.email) = lower(p_customer_email)
    and u.email_confirmed_at is not null and u.deleted_at is null
  limit 1;
  update public.orders
  set user_id = coalesce(user_id, v_verified_user_id), payment_status = 'paid',
      fulfillment_status = case when payment_status = 'pending' then 'ready' else fulfillment_status end,
      stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_payment_intent_id),
      customer_email = lower(p_customer_email), customer_name = p_customer_name,
      customer_phone = p_customer_phone, shipping_address = p_shipping_address,
      paid_at = coalesce(paid_at, now()), updated_at = now()
  where id = p_order_id
    and stripe_checkout_session_id = p_session_id
    and payment_status in ('pending', 'paid')
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
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_new_event boolean;
begin
  v_new_event := public.record_stripe_event(p_event_id, p_event_type, p_livemode);
  if not v_new_event then return false; end if;
  update public.orders
  set refunded_cents = greatest(refunded_cents, least(p_amount_refunded, total_cents)),
      payment_status = case
        when greatest(refunded_cents, p_amount_refunded) >= total_cents then 'refunded'
        else 'partially_refunded'
      end,
      fulfillment_status = case when fulfillment_status in ('blocked', 'ready') then 'cancelled' else fulfillment_status end,
      updated_at = now()
  where stripe_payment_intent_id = p_payment_intent_id
    and payment_status in ('paid', 'partially_refunded', 'refunded');
  if not found then raise exception 'Refunded order not found'; end if;
  return true;
end;
$$;

create or replace function public.apply_woo_order_projection(
  p_woo_order_id bigint,
  p_woo_status text,
  p_total_cents integer
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.orders
  set payment_status = case
        when total_cents <> p_total_cents then payment_status
        when p_woo_status in ('processing', 'on-hold', 'completed') and payment_status = 'pending' then 'paid'
        when p_woo_status = 'refunded' then 'refunded'
        when p_woo_status = 'failed' and payment_status = 'pending' then 'failed'
        when p_woo_status = 'cancelled' and payment_status = 'pending' then 'expired'
        else payment_status
      end,
      fulfillment_status = case
        when total_cents <> p_total_cents then fulfillment_status
        when p_woo_status in ('processing', 'on-hold') and payment_status in ('pending', 'paid') then 'ready'
        when p_woo_status = 'completed' then 'fulfilled'
        when p_woo_status in ('cancelled', 'failed', 'refunded') and fulfillment_status in ('blocked', 'ready') then 'cancelled'
        else fulfillment_status
      end,
      sync_status = case when total_cents = p_total_cents then 'synced' else 'failed' end,
      last_synced_at = now(), sync_version = sync_version + 1, updated_at = now()
  where woo_order_id = p_woo_order_id;
  return found;
end;
$$;

create or replace function public.cleanup_scalability_state()
returns table(rate_limit_rows bigint, inbox_payloads bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.rate_limits where window_started_at < now() - interval '1 day';
  get diagnostics rate_limit_rows = row_count;
  update public.stripe_event_inbox
  set payload = '{}'::jsonb, updated_at = now()
  where status = 'completed' and processed_at < now() - interval '30 days' and payload <> '{}'::jsonb;
  get diagnostics inbox_payloads = row_count;
  delete from public.commerce_jobs
  where (status = 'completed' and completed_at < now() - interval '30 days')
     or (status = 'dead' and updated_at < now() - interval '90 days');
  delete from public.stripe_event_inbox
  where status = 'completed' and processed_at < now() - interval '90 days';
  return next;
end;
$$;

create or replace function public.list_my_orders(
  p_limit integer default 20,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
) returns table(
  id uuid,
  order_number text,
  payment_status text,
  fulfillment_status text,
  currency text,
  total_cents integer,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select o.id, o.order_number, o.payment_status, o.fulfillment_status,
    o.currency, o.total_cents, o.created_at
  from public.orders o
  where o.user_id = (select auth.uid())
    and (
      p_before_created_at is null
      or (o.created_at, o.id) < (p_before_created_at, p_before_id)
    )
  order by o.created_at desc, o.id desc
  limit least(greatest(p_limit, 1), 50);
$$;

revoke all on function public.create_reserved_order(uuid, bigint, timestamptz, text, text, integer, integer, integer, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.claim_account_deletions(text, integer, integer) from public, anon, authenticated;
revoke all on function public.prepare_leased_account_deletion(uuid, text) from public, anon, authenticated;
revoke all on function public.attach_reserved_checkout(uuid, text, text) from public, anon, authenticated;
revoke all on function public.enqueue_stripe_event(text, text, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.claim_stripe_events(text, integer, integer) from public, anon, authenticated;
revoke all on function public.claim_stripe_event(text, text, integer) from public, anon, authenticated;
revoke all on function public.complete_stripe_event(text) from public, anon, authenticated;
revoke all on function public.retry_stripe_event(text, text) from public, anon, authenticated;
revoke all on function public.enqueue_commerce_job(text, text, text, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.claim_commerce_jobs(text, integer, integer) from public, anon, authenticated;
revoke all on function public.complete_commerce_job(bigint) from public, anon, authenticated;
revoke all on function public.retry_commerce_job(bigint, text) from public, anon, authenticated;
revoke all on function public.enqueue_expired_checkout_jobs(integer) from public, anon, authenticated;
revoke all on function public.enqueue_reconciliation_jobs(integer) from public, anon, authenticated;
revoke all on function public.mark_order_expired(uuid) from public, anon, authenticated;
revoke all on function public.record_checkout_expired(text, text, boolean, uuid, text) from public, anon, authenticated;
revoke all on function public.apply_woo_order_projection(bigint, text, integer) from public, anon, authenticated;
revoke all on function public.cleanup_scalability_state() from public, anon, authenticated;
revoke all on function public.list_my_orders(integer, timestamptz, uuid) from public, anon;

grant execute on function public.create_reserved_order(uuid, bigint, timestamptz, text, text, integer, integer, integer, jsonb, uuid) to service_role;
grant execute on function public.claim_account_deletions(text, integer, integer) to service_role;
grant execute on function public.prepare_leased_account_deletion(uuid, text) to service_role;
grant execute on function public.attach_reserved_checkout(uuid, text, text) to service_role;
grant execute on function public.enqueue_stripe_event(text, text, boolean, jsonb) to service_role;
grant execute on function public.claim_stripe_events(text, integer, integer) to service_role;
grant execute on function public.claim_stripe_event(text, text, integer) to service_role;
grant execute on function public.complete_stripe_event(text) to service_role;
grant execute on function public.retry_stripe_event(text, text) to service_role;
grant execute on function public.enqueue_commerce_job(text, text, text, jsonb, timestamptz) to service_role;
grant execute on function public.claim_commerce_jobs(text, integer, integer) to service_role;
grant execute on function public.complete_commerce_job(bigint) to service_role;
grant execute on function public.retry_commerce_job(bigint, text) to service_role;
grant execute on function public.enqueue_expired_checkout_jobs(integer) to service_role;
grant execute on function public.enqueue_reconciliation_jobs(integer) to service_role;
grant execute on function public.mark_order_expired(uuid) to service_role;
grant execute on function public.record_checkout_expired(text, text, boolean, uuid, text) to service_role;
grant execute on function public.apply_woo_order_projection(bigint, text, integer) to service_role;
grant execute on function public.cleanup_scalability_state() to service_role;
grant execute on function public.list_my_orders(integer, timestamptz, uuid) to authenticated;

commit;
