create sequence public.manual_order_number_seq;
create table public.manual_order_rate_limits (
  client_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1,
  primary key(client_hash, window_started_at)
);
alter table public.manual_order_rate_limits enable row level security;
revoke all on public.manual_order_rate_limits from anon, authenticated;
grant all on public.manual_order_rate_limits to service_role;
create function public.consume_manual_order_rate_limit(p_client_hash text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / 900) * 900);
  v_count integer;
begin
  delete from public.manual_order_rate_limits where window_started_at < now() - interval '1 day';
  insert into public.manual_order_rate_limits(client_hash,window_started_at) values(p_client_hash,v_window)
    on conflict(client_hash,window_started_at) do update set request_count=public.manual_order_rate_limits.request_count+1
    returning request_count into v_count;
  return v_count <= 12;
end $$;
revoke all on function public.consume_manual_order_rate_limit(text) from public,anon,authenticated;
grant execute on function public.consume_manual_order_rate_limit(text) to service_role;
create table public.manual_order_requests (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique,
  request_hash text not null,
  order_number text not null unique default ('PHP-' || lpad(nextval('public.manual_order_number_seq')::text, 8, '0')),
  created_at timestamptz not null default now(),
  payment_status text not null default 'awaiting_payment' check (payment_status = 'awaiting_payment'),
  payload jsonb not null
);
create table public.manual_order_emails (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.manual_order_requests(id),
  audience text not null check (audience in ('store', 'customer')),
  status text not null default 'pending' check (status in ('pending','processing','sent','dead')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  claim_token uuid,
  sent_at timestamptz,
  unique(order_id, audience)
);
create index manual_email_due on public.manual_order_emails(status, next_attempt_at);
alter table public.manual_order_requests enable row level security;
alter table public.manual_order_emails enable row level security;
revoke all on public.manual_order_requests, public.manual_order_emails, public.manual_order_number_seq from anon, authenticated;
grant all on public.manual_order_requests, public.manual_order_emails, public.manual_order_number_seq to service_role;

create function public.submit_manual_order(p_submission_id uuid, p_hash text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.manual_order_requests;
begin
  insert into public.manual_order_requests(submission_id,request_hash,payload)
  values(p_submission_id,p_hash,p_payload) on conflict(submission_id) do nothing;
  select * into o from public.manual_order_requests where submission_id=p_submission_id;
  if o.request_hash <> p_hash then raise exception 'submission_conflict'; end if;
  insert into public.manual_order_emails(order_id,audience) values(o.id,'store'),(o.id,'customer')
  on conflict(order_id,audience) do nothing;
  return jsonb_build_object('id',o.id,'order_number',o.order_number,'created_at',o.created_at);
end $$;

create function public.claim_order_emails(p_order_id uuid default null)
returns setof public.manual_order_emails language sql security definer set search_path = public as $$
  update public.manual_order_emails set status='processing', attempts=attempts+1,
    claim_token=gen_random_uuid(), next_attempt_at=now()+interval '5 minutes'
  where id in (select id from public.manual_order_emails
    where status in ('pending','processing') and next_attempt_at<=now()
      and (p_order_id is null or order_id=p_order_id)
    order by next_attempt_at limit 2 for update skip locked)
  returning *;
$$;

create function public.finish_order_email(p_id uuid,p_claim uuid,p_sent boolean)
returns void language sql security definer set search_path = public as $$
  update public.manual_order_emails set status=case when p_sent then 'sent' when attempts>=8 then 'dead' else 'pending' end,
    sent_at=case when p_sent then now() else null end,
    next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,attempts)::integer)), claim_token=null
  where id=p_id and claim_token=p_claim and status='processing';
$$;
revoke all on function public.submit_manual_order(uuid,text,jsonb), public.claim_order_emails(uuid), public.finish_order_email(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.submit_manual_order(uuid,text,jsonb), public.claim_order_emails(uuid), public.finish_order_email(uuid,uuid,boolean) to service_role;
