-- One rule per action on platform_users (who can see or change what is unchanged)
-- platform_users had two rules for reading (self_select_user + admin_select_own_team) and two for
-- updating (self_update_user + admin_update_own_team), so Postgres ran both on every query.
-- Each pair is now one rule with the two conditions joined by OR — exactly how Postgres already
-- combined them. You can still see/update your own row, and the business owner can see/update
-- their team. The guard_platform_user_update trigger still blocks changing business_id, and only
-- the owner can change role, permissions or status. (Supabase advisor: multiple_permissive_policies)
-- Already applied to the live project on 2026-11-24.

drop policy self_select_user      on public.platform_users;
drop policy admin_select_own_team on public.platform_users;
create policy select_self_or_own_team on public.platform_users
  for select to authenticated
  using (
    id = (select auth.uid())::text
    or business_id = (select public.my_admin_business_id())
  );

drop policy self_update_user      on public.platform_users;
drop policy admin_update_own_team on public.platform_users;
create policy update_self_or_own_team on public.platform_users
  for update to authenticated
  using (
    id = (select auth.uid())::text
    or business_id = (select public.my_admin_business_id())
  )
  with check (
    id = (select auth.uid())::text
    or business_id = (select public.my_admin_business_id())
  );
