-- Security fix: stop signed-in users from promoting themselves.
--
-- The "self_update_user" policy lets every signed-in user PATCH their own
-- platform_users row, and nothing checked WHICH columns changed. A pending
-- sales employee could send {"role":"primary_admin","status":"active"} straight
-- to /rest/v1/platform_users and become owner of the business, or change
-- business_id to join another business.
--
-- This trigger only applies to requests coming through the public API as the
-- "authenticated" role. Server-side code (service role, security-definer
-- functions, cron) is not affected.

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
    -- The one self-service status change: restoring an account that was
    -- scheduled for deletion (Auth._restoreAccount in assets/js/auth.js).
    if not (old.deletion_requested_at is not null
            and new.deletion_requested_at is null
            and new.status = 'active'
            and old.status not in ('pending', 'rejected')) then
      raise exception 'Only the business owner can change account status';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_platform_user_update on public.platform_users;
create trigger guard_platform_user_update
  before update on public.platform_users
  for each row execute function public.guard_platform_user_update();
