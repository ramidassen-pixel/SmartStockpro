-- Faster security rules and missing indexes (who can see or change what is unchanged)
-- 1) Eight security rules called auth.uid() once for EVERY row they checked. Wrapping it as
--    (select auth.uid()) makes Postgres work it out once per query instead. The conditions are
--    otherwise identical. (Supabase advisor: auth_rls_initplan)
-- 2) Ten foreign keys had no index. Adding them speeds up filtering by business and deleting a
--    business. (Supabase advisor: unindexed_foreign_keys)
-- Already applied to the live project on 2026-11-24.

alter policy self_select_user on public.platform_users
  using (id = (select auth.uid())::text);

alter policy self_update_user on public.platform_users
  using      (id = (select auth.uid())::text)
  with check (id = (select auth.uid())::text);

alter policy app_can_insert_users on public.platform_users
  with check (
    id = (select auth.uid())::text
    and (
      not exists (select 1 from public.platform_users existing
                  where existing.business_id = platform_users.business_id)
      or (role = 'sales_employee' and status = 'pending')
    )
  );

alter policy self_select_business on public.platform_businesses
  using (id in (select pu.business_id from public.platform_users pu
                where pu.id = (select auth.uid())::text));

alter policy own_reads_select on public.biz_notification_reads
  using (business_id = public.my_business_id()
         and user_id = (select auth.uid())::text);

alter policy own_reads_insert on public.biz_notification_reads
  with check (business_id = public.my_business_id()
              and user_id = (select auth.uid())::text);

alter policy own_reads_delete on public.biz_notification_reads
  using (business_id = public.my_business_id()
         and user_id = (select auth.uid())::text);

alter policy members_read_plan on public.business_plans
  using (
    business_id in (select pu.business_id from public.platform_users pu
                    where pu.id = (select auth.uid())::text
                      and pu.status = 'active')
    or public.is_platform_admin()
  );

create index if not exists biz_allocations_business_id_idx        on public.biz_allocations        (business_id);
create index if not exists biz_grns_business_id_idx               on public.biz_grns               (business_id);
create index if not exists biz_monthly_statements_business_id_idx on public.biz_monthly_statements (business_id);
create index if not exists biz_payroll_business_id_idx            on public.biz_payroll            (business_id);
create index if not exists biz_purchase_orders_business_id_idx    on public.biz_purchase_orders    (business_id);
create index if not exists biz_stock_movements_business_id_idx    on public.biz_stock_movements    (business_id);
create index if not exists biz_supplier_bills_business_id_idx     on public.biz_supplier_bills     (business_id);
create index if not exists core_payments_business_id_idx          on core.payments                 (business_id);
create index if not exists core_sales_customer_id_idx             on core.sales                    (customer_id);
create index if not exists core_stock_movements_business_id_idx   on core.stock_movements          (business_id);
