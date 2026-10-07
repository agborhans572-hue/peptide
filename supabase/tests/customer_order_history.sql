begin;
insert into auth.users(id, email, email_confirmed_at)
values ('1287e013-0b7c-4ba2-97ac-a48a43ec0123', 'history-test@example.invalid', now());
insert into public.manual_order_requests(submission_id, request_hash, payload)
select gen_random_uuid(), 'history-test', jsonb_build_object(
  'customer', jsonb_build_object('email', 'history-test@example.invalid'),
  'cart', jsonb_build_object('currency', 'usd', 'totalCents', 2498, 'items', jsonb_build_array(
    jsonb_build_object('variantId', 'sample', 'productName', 'Sample', 'option', '10mL', 'quantity', 1, 'totalCents', 1399)
  ))) from generate_series(1, 2);

select set_config('request.jwt.claim.sub', '1287e013-0b7c-4ba2-97ac-a48a43ec0123', true);
do $$ declare n integer; cursor_row record; begin
  select count(*) into n from public.list_my_account_orders();
  if n <> 2 then raise exception 'Verified customer history failed'; end if;
  select * into cursor_row from public.list_my_account_orders(1);
  select count(*) into n from public.list_my_account_orders(20, cursor_row.created_at, cursor_row.id);
  if n <> 1 then raise exception 'Pagination failed'; end if;
  select count(*) into n from public.list_my_account_orders(p_order_number => cursor_row.order_number);
  if n <> 1 then raise exception 'Order detail lookup failed'; end if;
  if cursor_row.total_cents <> 2498 or cursor_row.payment_status <> 'awaiting_payment'
    or cursor_row.fulfillment_status <> 'pending' or cursor_row.order_items->0->>'product_name' <> 'Sample'
    then raise exception 'Order contents failed'; end if;
  if has_table_privilege('authenticated', 'public.manual_order_requests', 'SELECT')
    or has_function_privilege('anon', 'public.list_my_account_orders(integer,timestamptz,uuid,text)', 'EXECUTE')
    then raise exception 'Public access restriction failed'; end if;
end $$;
update auth.users set email_confirmed_at = null where id = '1287e013-0b7c-4ba2-97ac-a48a43ec0123';
do $$ begin
  if exists(select 1 from public.list_my_account_orders()) then raise exception 'Unverified access allowed'; end if;
end $$;
update auth.users set email_confirmed_at = now() where id = '1287e013-0b7c-4ba2-97ac-a48a43ec0123';
update public.customer_profiles set status = 'suspended' where user_id = '1287e013-0b7c-4ba2-97ac-a48a43ec0123';
do $$ begin
  if exists(select 1 from public.list_my_account_orders()) then raise exception 'Suspended access allowed'; end if;
end $$;
select set_config('request.jwt.claim.sub', '1287e013-0b7c-4ba2-97ac-a48a43ec0999', true);
do $$ begin
  if exists(select 1 from public.list_my_account_orders()) then raise exception 'Other customer access allowed'; end if;
end $$;
rollback;
select 'PASS: contents, detail, pagination, verified ownership and private access' as result;
