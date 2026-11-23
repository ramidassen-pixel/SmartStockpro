-- Platform Admin page: data and actions for the platform owner only.
-- Access is by signed-in account (public.platform_admins), never by a PIN.

-- One call that returns everything the Admin page shows
create or replace function public.admin_overview()
returns json language plpgsql stable security definer set search_path = public as $$
declare out json;
begin
  if not public.is_platform_admin() then
    raise exception 'Only the platform owner can open the Admin page';
  end if;

  with sales as (
    select business_id,
           count(*) filter (where not deleted)                                         as sales_count,
           max((data->>'date')) filter (where not deleted)                             as last_sale,
           count(*) filter (where not deleted and (data->>'date') >= to_char(current_date - 30, 'YYYY-MM-DD')) as sales_30d
      from biz_sales group by business_id
  ), prods as (
    select business_id, count(*) filter (where not deleted) as products from biz_products group by business_id
  ), staff as (
    select business_id,
           count(*)                                    as users,
           count(*) filter (where status = 'pending')  as pending_users
      from platform_users group by business_id
  )
  select json_build_object(
    'shops', coalesce((select json_agg(json_build_object(
        'id', b.id, 'name', b.name, 'owner_name', b.owner_name, 'owner_email', b.owner_email,
        'owner_phone', b.owner_phone, 'currency', b.currency, 'status', b.status,
        'registered_at', b.registered_at, 'last_active_at', b.last_active_at,
        'trial_ends', (b.registered_at + interval '14 days')::date,
        'plan', bp.plan, 'paid_until', bp.paid_until,
        'users', coalesce(st.users, 0), 'pending_users', coalesce(st.pending_users, 0),
        'sales', coalesce(s.sales_count, 0), 'sales_30d', coalesce(s.sales_30d, 0), 'last_sale', s.last_sale,
        'products', coalesce(p.products, 0),
        'deletion_scheduled_for', b.deletion_scheduled_for
      ) order by b.last_active_at desc nulls last)
      from platform_businesses b
      left join business_plans bp on bp.business_id = b.id
      left join sales s  on s.business_id = b.id
      left join prods p  on p.business_id = b.id
      left join staff st on st.business_id = b.id), '[]'::json),
    'users', coalesce((select json_agg(json_build_object(
        'id', u.id, 'business_id', u.business_id, 'name', u.name, 'email', u.email, 'phone', u.phone,
        'role', u.role, 'status', u.status, 'registered_at', u.registered_at, 'last_login_at', u.last_login_at
      ) order by u.last_login_at desc nulls last) from platform_users u), '[]'::json),
    'activity', coalesce((select json_agg(a) from (
        select event, business_id, user_id, event_date, created_at
          from platform_activity order by created_at desc limit 60) a), '[]'::json),
    'payments', json_build_object(
        'pending',          (select count(*) from plan_payments where status = 'pending'),
        'approved_total',   (select coalesce(sum(amount), 0) from plan_payments where status = 'approved'),
        'approved_month',   (select coalesce(sum(amount), 0) from plan_payments
                              where status = 'approved' and reviewed_at >= date_trunc('month', now()))
    )
  ) into out;
  return out;
end $$;

-- Give a shop a plan by hand (free months, a deal, a correction), or remove it
create or replace function public.admin_set_plan(p_business_id text, p_plan text, p_paid_until date)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only the platform owner can change plans';
  end if;
  if not exists (select 1 from platform_businesses where id = p_business_id) then
    raise exception 'Shop not found';
  end if;
  if p_plan = 'none' then
    delete from business_plans where business_id = p_business_id;
    update platform_businesses set plan = 'free' where id = p_business_id;
    return json_build_object('plan', null);
  end if;
  if p_plan not in ('shop', 'business', 'owner') then raise exception 'Unknown plan'; end if;
  if p_plan <> 'owner' and p_paid_until is null then raise exception 'Choose the date the plan ends'; end if;

  insert into business_plans (business_id, plan, paid_until, updated_at, updated_by)
  values (p_business_id, p_plan, case when p_plan = 'owner' then null else p_paid_until end, now(), auth.uid())
  on conflict (business_id) do update
     set plan = excluded.plan, paid_until = excluded.paid_until, updated_at = now(), updated_by = auth.uid();
  update platform_businesses set plan = p_plan where id = p_business_id;
  return json_build_object('plan', p_plan, 'paid_until', case when p_plan = 'owner' then null else p_paid_until end);
end $$;

revoke all on function public.admin_overview() from public, anon;
revoke all on function public.admin_set_plan(text, text, date) from public, anon;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_set_plan(text, text, date) to authenticated;
