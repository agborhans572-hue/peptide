begin;

create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  first_name text not null default '',
  last_name text not null default '',
  phone text not null default '',
  business_name text,
  ein text,
  website_url text,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'deletion_requested')),
  suspended_at timestamptz,
  suspension_reason text,
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  company text,
  address_line_1 text not null,
  address_line_2 text,
  city text not null,
  state text not null check (state ~ '^[A-Z]{2}$'),
  postal_code text not null check (postal_code ~ '^[0-9]{5}(-[0-9]{4})?$'),
  country_code text not null default 'US' check (country_code = 'US'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email_hash text not null check (email_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'deferred', 'cancelled', 'completed')),
  requested_at timestamptz not null default now(),
  eligible_at timestamptz not null default (now() + interval '30 days'),
  legal_hold boolean not null default false,
  defer_reason text,
  cancelled_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists one_open_deletion_request_per_user
  on public.account_deletion_requests (user_id)
  where user_id is not null and status in ('pending', 'processing', 'deferred');

create index if not exists account_deletion_ready_idx
  on public.account_deletion_requests (eligible_at)
  where status in ('pending', 'deferred') and legal_hold = false;

create table if not exists public.customer_account_status_audit (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  previous_status text,
  next_status text not null,
  reason text,
  actor text not null default 'system',
  created_at timestamptz not null default now()
);

alter table public.orders
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists orders_user_created_idx
  on public.orders (user_id, created_at desc)
  where user_id is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists customer_profiles_set_updated_at on public.customer_profiles;
create trigger customer_profiles_set_updated_at
before update on public.customer_profiles
for each row execute function public.set_updated_at();

drop trigger if exists customer_addresses_set_updated_at on public.customer_addresses;
create trigger customer_addresses_set_updated_at
before update on public.customer_addresses
for each row execute function public.set_updated_at();

drop trigger if exists account_deletion_requests_set_updated_at on public.account_deletion_requests;
create trigger account_deletion_requests_set_updated_at
before update on public.account_deletion_requests
for each row execute function public.set_updated_at();

create or replace function public.sync_customer_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.customer_profiles(
    user_id, email, first_name, last_name, phone, business_name, ein, website_url
  ) values (
    new.id,
    lower(coalesce(new.email, '')),
    left(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), 80),
    left(trim(coalesce(new.raw_user_meta_data->>'last_name', '')), 80),
    left(trim(coalesce(new.raw_user_meta_data->>'phone', '')), 30),
    nullif(left(trim(coalesce(new.raw_user_meta_data->>'business_name', '')), 120), ''),
    nullif(left(trim(coalesce(new.raw_user_meta_data->>'ein', '')), 30), ''),
    nullif(left(trim(coalesce(new.raw_user_meta_data->>'website_url', '')), 300), '')
  )
  on conflict (user_id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists sync_customer_profile_after_auth_change on auth.users;
create trigger sync_customer_profile_after_auth_change
after insert or update of email on auth.users
for each row execute function public.sync_customer_profile_from_auth();

insert into public.customer_profiles(user_id, email, first_name, last_name, phone, business_name, ein, website_url)
select
  id,
  lower(coalesce(email, '')),
  left(trim(coalesce(raw_user_meta_data->>'first_name', '')), 80),
  left(trim(coalesce(raw_user_meta_data->>'last_name', '')), 80),
  left(trim(coalesce(raw_user_meta_data->>'phone', '')), 30),
  nullif(left(trim(coalesce(raw_user_meta_data->>'business_name', '')), 120), ''),
  nullif(left(trim(coalesce(raw_user_meta_data->>'ein', '')), 30), ''),
  nullif(left(trim(coalesce(raw_user_meta_data->>'website_url', '')), 300), '')
from auth.users
on conflict (user_id) do update set email = excluded.email;

create or replace function public.is_active_customer(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.customer_profiles p
    join auth.users u on u.id = p.user_id
    where p.user_id = p_user_id
      and p.status = 'active'
      and u.email_confirmed_at is not null
      and u.deleted_at is null
  );
$$;

create or replace function public.get_my_account_status()
returns table(status text, email text, email_verified boolean)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    p.status,
    p.email,
    u.email_confirmed_at is not null
  from public.customer_profiles p
  join auth.users u on u.id = p.user_id
  where p.user_id = (select auth.uid());
$$;

create or replace function public.update_my_profile(
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_business_name text default null,
  p_ein text default null,
  p_website_url text default null
) returns public.customer_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_profile public.customer_profiles;
begin
  if v_user_id is null or not public.is_active_customer(v_user_id) then
    raise exception 'Account unavailable' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_first_name, ''))) not between 1 and 80
    or length(trim(coalesce(p_last_name, ''))) not between 1 and 80
    or length(trim(coalesce(p_phone, ''))) not between 7 and 30
    or length(trim(coalesce(p_business_name, ''))) > 120
    or length(trim(coalesce(p_ein, ''))) > 30
    or length(trim(coalesce(p_website_url, ''))) > 300 then
    raise exception 'Invalid profile data' using errcode = '22023';
  end if;

  update public.customer_profiles
  set
    first_name = trim(p_first_name),
    last_name = trim(p_last_name),
    phone = trim(p_phone),
    business_name = nullif(trim(p_business_name), ''),
    ein = nullif(trim(p_ein), ''),
    website_url = nullif(trim(p_website_url), '')
  where user_id = v_user_id
  returning * into v_profile;
  return v_profile;
end;
$$;

create or replace function public.upsert_my_address(
  p_first_name text,
  p_last_name text,
  p_company text,
  p_address_line_1 text,
  p_address_line_2 text,
  p_city text,
  p_state text,
  p_postal_code text
) returns public.customer_addresses
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_address public.customer_addresses;
  v_state text := upper(trim(coalesce(p_state, '')));
  v_postal text := trim(coalesce(p_postal_code, ''));
begin
  if v_user_id is null or not public.is_active_customer(v_user_id) then
    raise exception 'Account unavailable' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_first_name, ''))) not between 1 and 80
    or length(trim(coalesce(p_last_name, ''))) not between 1 and 80
    or length(trim(coalesce(p_address_line_1, ''))) not between 3 and 180
    or length(trim(coalesce(p_address_line_2, ''))) > 180
    or length(trim(coalesce(p_city, ''))) not between 2 and 100
    or v_state !~ '^[A-Z]{2}$'
    or v_postal !~ '^[0-9]{5}(-[0-9]{4})?$'
    or length(trim(coalesce(p_company, ''))) > 120 then
    raise exception 'Invalid address data' using errcode = '22023';
  end if;

  insert into public.customer_addresses(
    user_id, first_name, last_name, company, address_line_1, address_line_2,
    city, state, postal_code, country_code
  ) values (
    v_user_id, trim(p_first_name), trim(p_last_name), nullif(trim(p_company), ''),
    trim(p_address_line_1), nullif(trim(p_address_line_2), ''), trim(p_city),
    v_state, v_postal, 'US'
  )
  on conflict (user_id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    company = excluded.company,
    address_line_1 = excluded.address_line_1,
    address_line_2 = excluded.address_line_2,
    city = excluded.city,
    state = excluded.state,
    postal_code = excluded.postal_code,
    country_code = 'US'
  returning * into v_address;
  return v_address;
end;
$$;

create or replace function public.claim_my_paid_orders()
returns integer
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
  v_claimed integer;
begin
  select lower(email)
    into v_email
  from auth.users
  where id = v_user_id and email_confirmed_at is not null and deleted_at is null;

  if v_email is null or not public.is_active_customer(v_user_id) then
    raise exception 'Verified active account required' using errcode = '42501';
  end if;

  update public.orders
  set user_id = v_user_id, updated_at = now()
  where user_id is null
    and payment_status in ('paid', 'refunded', 'partially_refunded')
    and lower(customer_email) = v_email;
  get diagnostics v_claimed = row_count;
  return v_claimed;
end;
$$;

create or replace function public.queue_account_deletion(
  p_user_id uuid,
  p_email_hash text
) returns public.account_deletion_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_previous_status text;
  v_request public.account_deletion_requests;
begin
  if p_email_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid email hash';
  end if;
  select status into v_previous_status
  from public.customer_profiles
  where user_id = p_user_id
  for update;
  if v_previous_status is null then raise exception 'Customer not found'; end if;

  select * into v_request
  from public.account_deletion_requests
  where user_id = p_user_id and status in ('pending', 'processing', 'deferred')
  order by requested_at desc limit 1;

  if v_request.id is null then
    insert into public.account_deletion_requests(user_id, email_hash)
    values (p_user_id, p_email_hash)
    returning * into v_request;
  end if;

  update public.customer_profiles
  set
    status = 'deletion_requested',
    deletion_requested_at = coalesce(deletion_requested_at, now()),
    suspended_at = coalesce(suspended_at, now()),
    suspension_reason = 'Customer requested account deletion'
  where user_id = p_user_id;

  if v_previous_status <> 'deletion_requested' then
    insert into public.customer_account_status_audit(
      user_id, previous_status, next_status, reason, actor
    ) values (
      p_user_id, v_previous_status, 'deletion_requested',
      'Customer requested account deletion', 'customer'
    );
  end if;
  return v_request;
end;
$$;

create or replace function public.set_customer_account_status(
  p_user_id uuid,
  p_status text,
  p_reason text,
  p_actor text default 'support'
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_previous_status text;
begin
  if p_status not in ('active', 'suspended') then raise exception 'Invalid status'; end if;
  select status into v_previous_status
  from public.customer_profiles
  where user_id = p_user_id
  for update;
  if v_previous_status is null then raise exception 'Customer not found'; end if;

  update public.customer_profiles
  set
    status = p_status,
    suspended_at = case when p_status = 'suspended' then now() else null end,
    suspension_reason = case when p_status = 'suspended' then left(p_reason, 500) else null end,
    deletion_requested_at = case when p_status = 'active' then null else deletion_requested_at end
  where user_id = p_user_id;

  insert into public.customer_account_status_audit(
    user_id, previous_status, next_status, reason, actor
  ) values (
    p_user_id, v_previous_status, p_status, left(p_reason, 500), left(p_actor, 120)
  );
end;
$$;

create or replace function public.cancel_account_deletion(
  p_user_id uuid,
  p_reason text,
  p_actor text default 'support'
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.account_deletion_requests
  set status = 'cancelled', cancelled_at = now(), defer_reason = left(p_reason, 500)
  where user_id = p_user_id and status in ('pending', 'processing', 'deferred');
  perform public.set_customer_account_status(p_user_id, 'active', p_reason, p_actor);
end;
$$;

create or replace function public.prepare_account_deletion(p_request_id uuid)
returns uuid
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
  for update;

  if v_request.id is null
    or v_request.status not in ('pending', 'deferred')
    or v_request.eligible_at > now()
    or v_request.legal_hold then
    return null;
  end if;

  select count(*) into v_active_orders
  from public.orders
  where user_id = v_request.user_id
    and (
      payment_status = 'pending'
      or fulfillment_status in ('ready', 'processing')
    );

  if v_active_orders > 0 then
    update public.account_deletion_requests
    set
      status = 'deferred',
      eligible_at = now() + interval '7 days',
      defer_reason = 'Active order requires completion or cancellation'
    where id = p_request_id;
    return null;
  end if;

  v_anonymous_email := 'deleted+' || left(v_request.email_hash, 24) || '@invalid.example';
  update public.orders
  set
    user_id = null,
    customer_email = v_anonymous_email,
    customer_name = null,
    customer_phone = null,
    shipping_address = null,
    updated_at = now()
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
  set status = 'completed', completed_at = now(), user_id = null, defer_reason = null
  where id = p_request_id and status = 'processing';
$$;

create or replace function public.defer_account_deletion(
  p_request_id uuid,
  p_reason text
) returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.account_deletion_requests
  set
    status = 'deferred',
    eligible_at = now() + interval '1 day',
    defer_reason = left(p_reason, 500)
  where id = p_request_id and status = 'processing';
$$;

create or replace function public.create_pending_order(
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
begin
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

  insert into public.orders(user_id, currency, subtotal_cents, shipping_cents, total_cents)
  values (p_user_id, lower(p_currency), p_subtotal_cents, p_shipping_cents, p_total_cents)
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

create or replace function public.create_pending_order(
  p_currency text,
  p_subtotal_cents integer,
  p_shipping_cents integer,
  p_total_cents integer,
  p_items jsonb
) returns public.orders
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.create_pending_order(
    p_currency, p_subtotal_cents, p_shipping_cents, p_total_cents, p_items, null
  );
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
    and u.email_confirmed_at is not null
    and u.deleted_at is null
  limit 1;

  update public.orders
  set
    user_id = coalesce(user_id, v_verified_user_id),
    payment_status = 'paid',
    fulfillment_status = 'ready',
    stripe_payment_intent_id = p_payment_intent_id,
    customer_email = lower(p_customer_email),
    customer_name = p_customer_name,
    customer_phone = p_customer_phone,
    shipping_address = p_shipping_address,
    paid_at = now(),
    updated_at = now()
  where id = p_order_id
    and stripe_checkout_session_id = p_session_id
    and payment_status = 'pending'
    and total_cents = p_amount_total
    and currency = lower(p_currency);
  if not found then raise exception 'Paid order verification failed'; end if;
  return true;
end;
$$;

alter table public.customer_profiles enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.account_deletion_requests enable row level security;
alter table public.customer_account_status_audit enable row level security;

revoke all on public.customer_profiles, public.customer_addresses,
  public.account_deletion_requests, public.customer_account_status_audit
  from public, anon, authenticated;
grant all on public.customer_profiles, public.customer_addresses,
  public.account_deletion_requests, public.customer_account_status_audit
  to service_role;
grant usage, select on sequence public.customer_account_status_audit_id_seq to service_role;
grant select on public.customer_profiles, public.customer_addresses,
  public.orders, public.order_items to authenticated;

drop policy if exists "Active customers can read own profile" on public.customer_profiles;
create policy "Active customers can read own profile"
on public.customer_profiles for select to authenticated
using (user_id = (select auth.uid()) and status = 'active');

drop policy if exists "Active customers can read own address" on public.customer_addresses;
create policy "Active customers can read own address"
on public.customer_addresses for select to authenticated
using (
  user_id = (select auth.uid())
  and public.is_active_customer((select auth.uid()))
);

drop policy if exists "Active customers can read own orders" on public.orders;
create policy "Active customers can read own orders"
on public.orders for select to authenticated
using (
  user_id = (select auth.uid())
  and public.is_active_customer((select auth.uid()))
);

drop policy if exists "Active customers can read own order items" on public.order_items;
create policy "Active customers can read own order items"
on public.order_items for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and o.user_id = (select auth.uid())
      and public.is_active_customer((select auth.uid()))
  )
);

revoke all on function public.is_active_customer(uuid) from public, anon;
revoke all on function public.get_my_account_status() from public, anon;
revoke all on function public.update_my_profile(text, text, text, text, text, text) from public, anon;
revoke all on function public.upsert_my_address(text, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.claim_my_paid_orders() from public, anon;

grant execute on function public.is_active_customer(uuid) to authenticated, service_role;
grant execute on function public.get_my_account_status() to authenticated;
grant execute on function public.update_my_profile(text, text, text, text, text, text) to authenticated;
grant execute on function public.upsert_my_address(text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.claim_my_paid_orders() to authenticated;

revoke all on function public.queue_account_deletion(uuid, text) from public, anon, authenticated;
revoke all on function public.set_customer_account_status(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.cancel_account_deletion(uuid, text, text) from public, anon, authenticated;
revoke all on function public.prepare_account_deletion(uuid) from public, anon, authenticated;
revoke all on function public.complete_account_deletion(uuid) from public, anon, authenticated;
revoke all on function public.defer_account_deletion(uuid, text) from public, anon, authenticated;
revoke all on function public.create_pending_order(text, integer, integer, integer, jsonb, uuid) from public, anon, authenticated;

grant execute on function public.queue_account_deletion(uuid, text) to service_role;
grant execute on function public.set_customer_account_status(uuid, text, text, text) to service_role;
grant execute on function public.cancel_account_deletion(uuid, text, text) to service_role;
grant execute on function public.prepare_account_deletion(uuid) to service_role;
grant execute on function public.complete_account_deletion(uuid) to service_role;
grant execute on function public.defer_account_deletion(uuid, text) to service_role;
grant execute on function public.create_pending_order(text, integer, integer, integer, jsonb, uuid) to service_role;
grant execute on function public.create_pending_order(text, integer, integer, integer, jsonb) to service_role;

commit;
