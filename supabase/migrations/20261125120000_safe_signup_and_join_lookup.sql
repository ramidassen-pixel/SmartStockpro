-- Safe sign-up and a working "Join business" search
--
-- 1) provision_profile_on_confirm (runs when a sign-up email is confirmed) used to
--    trust the role and business_id sent with the sign-up. Anyone could sign up
--    through the API with role=primary_admin and another shop's business_id and
--    become its owner after confirming their email. Now:
--      * Owner of an EXISTING business with members: never. They get a new,
--        empty business of their own instead.
--      * A business row with no members can only be claimed by the email it
--        was registered with (older app versions created that row before
--        confirmation).
--      * Any other role becomes sales_employee + pending, so the real owner
--        must still approve them. If that business doesn't exist, no profile
--        is made and the email confirmation still goes through.
-- 2) find_business_by_name: the Join tab searched platform_businesses with the
--    public key, but only members may read that table, so every search came
--    back empty. This returns just the id and name of an active business whose
--    name matches exactly (ignoring case). Knowing the id only lets someone ask
--    to join; the owner still has to approve them.
-- 3) Businesses can no longer be created by someone who is not signed in. The
--    trigger above creates them at confirmation; the app's fallback runs signed in.
-- Applied to the live project on 2026-11-25.

create or replace function public.provision_profile_on_confirm()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  m         jsonb;
  v_biz     text;
  v_role    text;
  v_name    text;
  v_bizname text;
  v_phone   text;
  v_owner_email text;
  v_has_members boolean;
begin
  -- Only act at the moment of confirmation
  if tg_op = 'UPDATE' then
    if old.email_confirmed_at is not null or new.email_confirmed_at is null then
      return new;
    end if;
  else
    if new.email_confirmed_at is null then
      return new;
    end if;
  end if;

  m         := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role    := case when coalesce(nullif(m->>'role',''), 'primary_admin') = 'primary_admin'
                    then 'primary_admin' else 'sales_employee' end;
  v_biz     := nullif(m->>'business_id','');
  v_name    := coalesce(nullif(m->>'name',''), split_part(new.email, '@', 1));
  v_bizname := coalesce(nullif(m->>'business_name',''), v_name || '''s Business');
  v_phone   := coalesce(m->>'phone', '');

  if v_role = 'primary_admin' then
    if v_biz is not null then
      select b.owner_email,
             exists (select 1 from platform_users u where u.business_id = b.id)
        into v_owner_email, v_has_members
        from platform_businesses b where b.id = v_biz;
      if found and (v_has_members or lower(coalesce(v_owner_email,'')) <> lower(new.email)) then
        v_biz := null;  -- not theirs to own: give them a fresh business
      end if;
    end if;
    if v_biz is null then
      v_biz := 'BIZ-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 11));
    end if;

    insert into public.platform_businesses
      (id, name, owner_name, owner_email, owner_phone, currency, country, status, plan, registered_at, last_active_at, user_count)
    values
      (v_biz, v_bizname, v_name, new.email, v_phone, '$', 'Liberia', 'active', 'free', now(), now(), 1)
    on conflict (id) do nothing;

    insert into public.biz_settings (business_id, data, updated_at)
    values (v_biz, jsonb_build_object(
      'bizName', v_bizname, 'currency', '$', 'bizPhone', v_phone, 'bizEmail', new.email,
      'expenseCategories', jsonb_build_array('General','Rent','Utilities','Transport','Salaries','Supplies')
    ), now())
    on conflict (business_id) do nothing;

    insert into public.biz_invoice_counters (business_id, next_number, prefix, pad_length, updated_at)
    values (v_biz, 1, 'INV-', 6, now())
    on conflict (business_id) do nothing;

    insert into public.biz_categories (business_id, categories, updated_at)
    values (v_biz, '["General","Materials","Tools","Services"]'::jsonb, now())
    on conflict (business_id) do nothing;
  else
    -- Joining: the business must exist; never fail the confirmation itself
    if v_biz is null or not exists (select 1 from platform_businesses where id = v_biz) then
      return new;
    end if;
  end if;

  insert into public.platform_users
    (id, business_id, name, email, phone, role, status, registered_at, last_login_at, app_version)
  values
    (new.id::text, v_biz, v_name, new.email, v_phone, v_role,
     case when v_role = 'primary_admin' then 'active' else 'pending' end,
     now(), now(), 'V5')
  on conflict (id) do nothing;

  return new;
end;
$function$;

revoke execute on function public.provision_profile_on_confirm() from public, anon, authenticated;

-- ── 2. Join tab lookup ──────────────────────────────────────────────────────
create or replace function public.find_business_by_name(p_name text)
returns table (id text, name text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select b.id, b.name
    from platform_businesses b
   where lower(btrim(b.name)) = lower(btrim(p_name))
     and length(btrim(p_name)) > 0
     and b.status = 'active'
   order by b.registered_at
   limit 1;
$$;

revoke execute on function public.find_business_by_name(text) from public;
grant  execute on function public.find_business_by_name(text) to anon, authenticated;

-- ── 3. Only signed-in users may create a business row ──────────────────────
alter policy app_can_insert_businesses on public.platform_businesses to authenticated;
