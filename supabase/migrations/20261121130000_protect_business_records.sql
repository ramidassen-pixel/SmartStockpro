-- Security fix: protect business records, and fix self-service account status.
--
-- 1) Before this, "self_update_business" let ANY member of a business update
--    the business row, even a sales employee still waiting for approval. That
--    included the subscription plan and a suspension set by the platform.
--    Now only the business owner (primary_admin) can update it, and nobody can
--    change the plan, the suspension, the user count or the deletion schedule
--    through the public API.
-- 2) New businesses created through the public API always start on the free
--    plan with status 'active', whatever the request sends.
-- 3) The platform_users guard from 20261121120000 blocked staff from
--    deactivating or deleting their own account (modules/settings/settings.js).
--    Those two self-service changes are allowed again, and restoring is only
--    possible from 'pending_deletion', so a pending or rejected user cannot
--    use delete-then-restore to activate themselves.
--
-- Server-side code (service role, security-definer functions, cron) is not
-- affected by the triggers.

-- ── 1. Only the owner may update the business row ──────────────────────────
drop policy if exists self_update_business on public.platform_businesses;
create policy owner_update_business on public.platform_businesses
  for update to authenticated
  using (id = my_admin_business_id())
  with check (id = my_admin_business_id());

-- ── 1b/2. Column guards on the business row ────────────────────────────────
create or replace function public.guard_platform_business_write()
returns trigger
language plpgsql
-- Runs as the caller (not security definer) so current_user is the API role.
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.plan := 'free';
    new.status := 'active';
    new.user_count := 1;
    new.deletion_requested_at := null;
    new.deletion_scheduled_for := null;
    new.deletion_cron_job_name := null;
    return new;
  end if;

  if new.id is distinct from old.id
     or new.plan is distinct from old.plan
     or new.user_count is distinct from old.user_count
     or new.registered_at is distinct from old.registered_at
     or new.deletion_scheduled_for is distinct from old.deletion_scheduled_for
     or new.deletion_cron_job_name is distinct from old.deletion_cron_job_name then
    raise exception 'This business field can only be changed by SmartStock Pro support';
  end if;

  if new.status is distinct from old.status then
    -- The owner may schedule deletion, or cancel it by signing back in.
    if not (
         (old.status = 'active' and new.status = 'pending_deletion' and new.deletion_requested_at is not null)
      or (old.status = 'pending_deletion' and new.status = 'active' and new.deletion_requested_at is null)
    ) then
      raise exception 'This business status can only be changed by SmartStock Pro support';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_platform_business_write on public.platform_businesses;
create trigger guard_platform_business_write
  before insert or update on public.platform_businesses
  for each row execute function public.guard_platform_business_write();

-- ── 3. Self-service account status for users ───────────────────────────────
create or replace function public.guard_platform_user_update()
returns trigger
language plpgsql
-- Runs as the caller (not security definer) so current_user is the API role.
set search_path = public
as $$
declare
  v_is_owner boolean;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  -- Nobody moves a user to another business through the API.
  if new.business_id is distinct from old.business_id then
    raise exception 'business_id cannot be changed';
  end if;

  v_is_owner := exists (
    select 1 from platform_users
    where id = (auth.uid())::text
      and business_id = old.business_id
      and role = 'primary_admin'
  );

  if v_is_owner then
    return new;  -- the owner manages roles, permissions and approvals
  end if;

  -- Everyone else may only edit their own harmless fields.
  if new.role is distinct from old.role
     or new.permissions is distinct from old.permissions then
    raise exception 'Only the business owner can change roles or permissions';
  end if;

  if new.status is distinct from old.status then
    -- Self-service changes: deactivate, schedule deletion, or restore after
    -- scheduling deletion (Settings and Auth._restoreAccount).
    if not (
         (old.status = 'active' and new.status = 'disabled')
      or (old.status = 'active' and new.status = 'pending_deletion' and new.deletion_requested_at is not null)
      or (old.status = 'pending_deletion' and new.status = 'active' and new.deletion_requested_at is null)
    ) then
      raise exception 'Only the business owner can change account status';
    end if;
  end if;

  return new;
end;
$$;
