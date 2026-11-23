-- Plan & Billing: shops pay by Mobile Money, the platform owner confirms.
--
-- Shop owner (primary_admin) sends MTN MoMo / Orange Money to the platform's
-- number, then submits the transaction ID in the app (plan_payments, pending).
-- The platform owner checks their phone and approves or rejects it with
-- review_plan_payment(). Approving extends the shop's plan in business_plans.
--
-- Safety:
--   * business_plans has NO insert/update policy: only review_plan_payment()
--     (platform admin only) changes a plan. platform_businesses.plan stays a
--     display copy, because shop owners can already update that row.
--   * The price is set by the server (trigger), never trusted from the app.
--   * A transaction ID can only be submitted once per network.

-- ── Who can approve payments ────────────────────────────────────────────────
create table if not exists public.platform_admins (
  user_id  uuid primary key,
  added_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;   -- no policies: not readable through the API
revoke all on public.platform_admins from anon, authenticated;

insert into public.platform_admins (user_id)
values ('e7dc1f65-9aa3-4273-9040-27acf731718a')                   -- Rock Stone's primary admin (the platform owner)
on conflict do nothing;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;

-- ── Current plan of each shop ───────────────────────────────────────────────
create table if not exists public.business_plans (
  business_id text primary key references public.platform_businesses(id) on delete cascade,
  plan        text not null check (plan in ('shop', 'business', 'owner')),
  paid_until  date,                       -- null for 'owner' (never expires)
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
alter table public.business_plans enable row level security;
drop policy if exists members_read_plan on public.business_plans;
create policy members_read_plan on public.business_plans for select to authenticated
  using (
    business_id in (select business_id from platform_users where id = auth.uid()::text and status = 'active')
    or public.is_platform_admin()
  );
revoke insert, update, delete on public.business_plans from anon, authenticated;

-- The platform owner's own shop never needs to pay
insert into public.business_plans (business_id, plan, paid_until)
values ('BIZ-ROCKSTONE002', 'owner', null)
on conflict (business_id) do nothing;

-- ── Payments sent by shops ──────────────────────────────────────────────────
create table if not exists public.plan_payments (
  id            uuid primary key default gen_random_uuid(),
  business_id   text not null references public.platform_businesses(id) on delete cascade,
  business_name text,
  plan          text not null check (plan in ('shop', 'business')),
  months        int  not null check (months between 1 and 12),
  amount        numeric(10,2) not null,
  currency      text not null default 'USD',
  network       text not null check (network in ('MTN MoMo', 'Orange Money')),
  payer_name    text check (char_length(payer_name) <= 80),
  payer_phone   text not null check (char_length(payer_phone) between 6 and 20),
  txn_id        text not null check (char_length(txn_id) between 4 and 40),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note          text check (char_length(note) <= 300),
  created_by    uuid,
  created_at    timestamptz not null default now(),
  reviewed_by   uuid,
  reviewed_at   timestamptz
);
create unique index if not exists plan_payments_txn_uq on public.plan_payments (network, upper(txn_id));
create index if not exists plan_payments_biz_idx on public.plan_payments (business_id, created_at desc);

alter table public.plan_payments enable row level security;
drop policy if exists shop_reads_own_payments on public.plan_payments;
create policy shop_reads_own_payments on public.plan_payments for select to authenticated
  using (business_id = public.my_admin_business_id() or public.is_platform_admin());
drop policy if exists shop_submits_payment on public.plan_payments;
create policy shop_submits_payment on public.plan_payments for insert to authenticated
  with check (business_id = public.my_admin_business_id());
revoke update, delete on public.plan_payments from anon, authenticated;

-- Server decides the price and the bookkeeping fields
create or replace function public.plan_payments_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare pending_count int;
begin
  new.amount        := (case new.plan when 'shop' then 9 when 'business' then 19 end) * new.months;
  new.currency      := 'USD';
  new.status        := 'pending';
  new.note          := null;
  new.reviewed_by   := null;
  new.reviewed_at   := null;
  new.created_by    := auth.uid();
  new.created_at    := now();
  new.txn_id        := upper(btrim(new.txn_id));
  new.payer_phone   := btrim(new.payer_phone);
  new.business_name := (select name from platform_businesses where id = new.business_id);
  select count(*) into pending_count from plan_payments where business_id = new.business_id and status = 'pending';
  if pending_count >= 3 then
    raise exception 'You already have 3 payments waiting for confirmation. Please wait for them to be checked.';
  end if;
  return new;
end $$;
drop trigger if exists plan_payments_before_insert on public.plan_payments;
create trigger plan_payments_before_insert before insert on public.plan_payments
  for each row execute function public.plan_payments_before_insert();
revoke all on function public.plan_payments_before_insert() from public, anon, authenticated;

-- ── Platform owner approves or rejects ──────────────────────────────────────
create or replace function public.review_plan_payment(p_id uuid, p_approve boolean, p_note text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  p     plan_payments%rowtype;
  cur   business_plans%rowtype;
  v_start date;
  v_until date;
begin
  if not public.is_platform_admin() then
    raise exception 'Only the platform owner can confirm payments';
  end if;
  select * into p from plan_payments where id = p_id for update;
  if not found then raise exception 'Payment not found'; end if;
  if p.status <> 'pending' then raise exception 'This payment was already %', p.status; end if;

  update plan_payments
     set status = case when p_approve then 'approved' else 'rejected' end,
         note = left(p_note, 300), reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;

  if not p_approve then
    return json_build_object('status', 'rejected');
  end if;

  select * into cur from business_plans where business_id = p.business_id for update;
  -- Time left on a paid plan is kept: the new months start when it ends
  v_start := case when found and cur.paid_until is not null and cur.paid_until >= current_date
                then cur.paid_until else current_date end;
  v_until := (v_start + make_interval(months => p.months))::date;

  insert into business_plans (business_id, plan, paid_until, updated_at, updated_by)
  values (p.business_id, p.plan, v_until, now(), auth.uid())
  on conflict (business_id) do update
     set plan = case when business_plans.plan = 'owner' then 'owner' else excluded.plan end,
         paid_until = case when business_plans.plan = 'owner' then null else excluded.paid_until end,
         updated_at = now(), updated_by = auth.uid();

  update platform_businesses set plan = p.plan where id = p.business_id;   -- display copy
  return json_build_object('status', 'approved', 'plan', p.plan, 'paid_until', v_until);
end $$;

-- ── What the app shows on the Plan & Billing page ───────────────────────────
create or replace function public.my_plan()
returns json language plpgsql stable security definer set search_path = public as $$
declare
  biz  text;
  v_role text;
  reg  timestamptz;
  bp   business_plans%rowtype;
  trial_end date;
  state text;
begin
  select u.business_id, u.role into biz, v_role
    from platform_users u where u.id = auth.uid()::text and u.status = 'active'
   order by (u.role = 'primary_admin') desc limit 1;
  if biz is null then return json_build_object('error', 'no_business'); end if;

  select registered_at into reg from platform_businesses where id = biz;
  trial_end := (coalesce(reg, now()) + interval '14 days')::date;
  select * into bp from business_plans where business_id = biz;

  state := case
    when bp.plan = 'owner' then 'owner'
    when bp.paid_until is not null and bp.paid_until >= current_date then 'active'
    when bp.paid_until is not null then 'expired'
    when trial_end >= current_date then 'trial'
    else 'trial_ended' end;

  return json_build_object(
    'business_id', biz,
    'is_owner_of_shop', v_role = 'primary_admin',
    'is_platform_admin', public.is_platform_admin(),
    'state', state,
    'plan', bp.plan,
    'paid_until', bp.paid_until,
    'trial_ends', trial_end,
    'days_left', case
       when state = 'active' then bp.paid_until - current_date
       when state = 'trial'  then trial_end - current_date
       else 0 end
  );
end $$;

revoke all on function public.review_plan_payment(uuid, boolean, text) from public, anon;
revoke all on function public.my_plan() from public, anon;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.review_plan_payment(uuid, boolean, text) to authenticated;
grant execute on function public.my_plan() to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
grant select, insert on public.plan_payments to authenticated;
grant select on public.business_plans to authenticated;
