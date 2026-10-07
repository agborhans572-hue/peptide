begin;
alter table public.account_deletion_requests
  add column if not exists lease_owner text,
  add column if not exists lease_expires_at timestamptz;
create index if not exists account_deletion_lease_idx
  on public.account_deletion_requests (eligible_at, lease_expires_at)
  where status in ('pending', 'processing', 'deferred') and legal_hold = false;
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

revoke all on function public.claim_account_deletions(text, integer, integer) from public, anon, authenticated;
revoke all on function public.prepare_leased_account_deletion(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_account_deletions(text, integer, integer) to service_role;
grant execute on function public.prepare_leased_account_deletion(uuid, text) to service_role;
commit;
