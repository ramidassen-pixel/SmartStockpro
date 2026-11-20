-- Lock down SECURITY DEFINER functions that were callable by anyone through
-- /rest/v1/rpc/<name> (Supabase advisor: anon_/authenticated_security_definer_
-- function_executable), and pin search_path on touch_updated_at
-- (advisor: function_search_path_mutable).
--
-- What the app actually uses (checked 2026-11-20):
--   * The web app calls NO database functions over /rpc. Sign-up profiles are
--     created by the auth.users trigger (provision_profile_on_confirm) plus a
--     client-side fallback that writes tables directly; account deletion and
--     restore are plain table updates; invoice numbers are generated client-side.
--   * my_business_id() / my_admin_business_id() are used inside RLS policies,
--     so signed-in users must keep EXECUTE on them.
--   * purge_expired_deletions() is run by pg_cron (as postgres).
--   * purge_business() is run by pg_cron jobs scheduled by
--     request_account_deletion(); it is already postgres-only.

-- 1) Nobody but the database itself: trigger / cron / unused legacy RPCs -----
--    (Trigger functions only need EXECUTE when the trigger is created, and
--    pg_cron runs as postgres, so revoking from API roles breaks nothing.)
revoke execute on function public.provision_profile_on_confirm()                 from public, anon, authenticated;
revoke execute on function public.purge_expired_deletions()                      from public, anon, authenticated;
-- Unused by the app, and they trusted a caller-supplied user id:
revoke execute on function public.register_business(text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.request_join_business(text, text, text, text, text)    from public, anon, authenticated;
-- Unused by the app (deletion is a 30-day table flag + nightly purge).
-- They already require the caller to be the business owner, but they can
-- schedule a 48-hour hard purge via pg_cron, so keep them off the API.
revoke execute on function public.request_account_deletion(text, text, integer) from public, anon, authenticated;
revoke execute on function public.cancel_account_deletion(text)                 from public, anon, authenticated;

-- 2) Invoice counters: run as the caller so RLS on biz_invoice_counters /
--    biz_skipped_invoices does the enforcing (policies already restrict to
--    business_id = my_business_id()). The explicit ownership check stays.
--    Signed-in users only.
alter function public.next_invoice_number(text)        security invoker;
alter function public.set_invoice_counter(text, integer) security invoker;
alter function public.skip_invoice_number(text, text)  security invoker;
revoke execute on function public.next_invoice_number(text)          from public, anon;
revoke execute on function public.set_invoice_counter(text, integer) from public, anon;
revoke execute on function public.skip_invoice_number(text, text)    from public, anon;
grant  execute on function public.next_invoice_number(text)          to authenticated;
grant  execute on function public.set_invoice_counter(text, integer) to authenticated;
grant  execute on function public.skip_invoice_number(text, text)    to authenticated;

-- 3) RLS helpers: signed-in users only. These must stay SECURITY DEFINER
--    (they read platform_users from inside RLS without recursion). They only
--    ever return the caller's own business id, or NULL.
revoke execute on function public.my_business_id()       from public, anon;
revoke execute on function public.my_admin_business_id() from public, anon;
grant  execute on function public.my_business_id()       to authenticated;
grant  execute on function public.my_admin_business_id() to authenticated;

-- Policies that call those helpers but were defined "TO public" would now
-- error for anonymous requests; scope them to signed-in users (anonymous
-- users never matched them anyway, since auth.uid() is NULL for them).
alter policy own_biz_select   on public.biz_invoice_counters   to authenticated;
alter policy own_biz_insert   on public.biz_invoice_counters   to authenticated;
alter policy own_biz_update   on public.biz_invoice_counters   to authenticated;
alter policy own_reads_select on public.biz_notification_reads to authenticated;
alter policy own_reads_insert on public.biz_notification_reads to authenticated;
alter policy own_reads_delete on public.biz_notification_reads to authenticated;
alter policy own_biz_select   on public.biz_notifications      to authenticated;
alter policy own_biz_insert   on public.biz_notifications      to authenticated;
alter policy own_biz_update   on public.biz_notifications      to authenticated;
alter policy own_biz_delete   on public.biz_notifications      to authenticated;
alter policy own_biz_select   on public.biz_skipped_invoices   to authenticated;
alter policy own_biz_insert   on public.biz_skipped_invoices   to authenticated;
alter policy own_biz_backups_select on storage.objects to authenticated;
alter policy own_biz_backups_insert on storage.objects to authenticated;
alter policy own_biz_backups_delete on storage.objects to authenticated;

-- 4) touch_updated_at: fixed search_path (only uses now()).
alter function public.touch_updated_at() set search_path = '';
