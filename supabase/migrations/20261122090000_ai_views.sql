-- SmartStock Pro — AI agent, Phase 1: clean, typed, read-only views of every business table.
--
-- The app stores each record as JSON in public.biz_* (column `data`). These views turn that JSON
-- into normal columns so the AI agent (and reports) can add up, group and filter in the database
-- instead of downloading whole tables.
--
-- Safety:
--  * Every view is `security_invoker`: it runs with the CALLER's rights, so the existing row-level
--    security on biz_* (business_id = my_business_id()) still limits each user to their own business.
--  * Views are read-only by nature. Nothing here writes data.
--  * Schema `ai` is NOT added to the API's exposed schemas. In Phase 2 the agent reaches it only
--    through a small read-only RPC function.
--  * Deleted records (deleted = true) are left out everywhere.
-- Undo with:  drop schema ai cascade;

create schema if not exists ai;
revoke all on schema ai from public, anon;
grant usage on schema ai to authenticated, service_role;

-- ── Safe converters (bad or empty values become NULL instead of breaking a query) ──
create or replace function ai.num(v jsonb) returns numeric
language sql immutable set search_path = '' as $$
  select case jsonb_typeof(v)
    when 'number' then (v #>> '{}')::numeric
    when 'string' then case when btrim(v #>> '{}') ~ '^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$'
                            then btrim(v #>> '{}')::numeric end
  end
$$;

create or replace function ai.dt(t text) returns date
language plpgsql immutable set search_path = '' as $$
begin
  if t is null or t !~ '^\d{4}-\d{2}-\d{2}' then return null; end if;
  return left(t, 10)::date;
exception when others then return null;
end $$;

create or replace function ai.ts(t text) returns timestamptz
language plpgsql stable set search_path = '' as $$
begin
  return nullif(t, '')::timestamptz;
exception when others then return null;
end $$;

-- Payment methods are typed freely ("Mobile money", "Orange money", "MoMo"...). Group them.
create or replace function ai.pay_group(p text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p is null or btrim(p) = ''                       then 'Cash'
    when lower(p) like '%cash%'                           then 'Cash'
    when lower(p) ~ '(mobile|orange|mtn|lonestar|momo)'   then 'Mobile money'
    when lower(p) ~ '(bank|transfer|cheque|check)'        then 'Bank'
    when lower(p) like '%online%' or lower(p) like '%card%' then 'Online'
    when lower(p) like '%credit%'                         then 'Credit'
    else btrim(p) end
$$;

revoke all on all functions in schema ai from public, anon;
grant execute on all functions in schema ai to authenticated, service_role;

-- ── Business profile ────────────────────────────────────────────────────────
create or replace view ai.business with (security_invoker = true) as
select s.business_id,
       nullif(s.data->>'bizName', '')                 as business_name,
       coalesce(nullif(s.data->>'currency', ''), '$') as currency,
       s.data->>'bizAddress'                          as address,
       s.data->>'bizPhone'                            as phone,
       coalesce(ai.num(s.data->'lowStock'), 5)        as default_low_stock,
       ai.num(s.data->'tax')                          as tax_pct,
       ai.num(s.data->'lrdRate')                      as lrd_rate,
       coalesce((s.data->>'cogsEnabled')::boolean, true) as cogs_enabled
from public.biz_settings s;

-- ── Sales ───────────────────────────────────────────────────────────────────
create or replace view ai.sales with (security_invoker = true) as
select b.id,
       b.business_id,
       coalesce(nullif(b.data->>'invoiceNo', ''), b.id)              as invoice_no,
       (nullif(b.data->>'invoiceNo', '') is not null)                as has_invoice_no,
       coalesce(ai.dt(b.data->>'date'), ai.ts(b.data->>'createdAt')::date, b.updated_at::date) as sale_date,
       nullif(b.data->>'customerId', '')                             as customer_id,
       coalesce(nullif(btrim(b.data->>'customer'), ''), 'Walk-in Customer') as customer_name,
       nullif(b.data->>'customerPhone', '')                          as customer_phone,
       coalesce(ai.num(b.data->'subtotal'), ai.num(b.data->'total'), 0) as subtotal,
       coalesce(ai.num(b.data->'discountAmount'),
                round(coalesce(ai.num(b.data->'subtotal'), 0) * coalesce(ai.num(b.data->'discount'), 0) / 100, 2), 0) as discount_amount,
       coalesce(ai.num(b.data->'total'), 0)                          as total,
       coalesce(ai.num(b.data->'amountPaid'), 0)                     as amount_paid,
       coalesce(ai.num(b.data->'balance'), 0)                        as balance,
       coalesce(nullif(b.data->>'status', ''), 'Paid')               as status,
       coalesce(nullif(b.data->>'payment', ''), 'Cash')              as payment_method,
       ai.pay_group(b.data->>'payment')                              as payment_group,
       nullif(b.data->>'notes', '')                                  as notes,
       nullif(b.data->>'createdByName', '')                          as created_by_name,
       case when jsonb_typeof(b.data->'items') = 'array' then jsonb_array_length(b.data->'items') else 0 end as item_lines,
       coalesce(ai.ts(b.data->>'createdAt'), b.updated_at)           as created_at
from public.biz_sales b
where not b.deleted;

create or replace view ai.sale_items with (security_invoker = true) as
select b.id                                                 as sale_id,
       b.business_id,
       coalesce(ai.dt(b.data->>'date'), b.updated_at::date) as sale_date,
       it.ord::int                                          as line_no,
       nullif(it.e->>'id', '')                              as product_id,
       coalesce(nullif(it.e->>'name', ''), 'Item')          as product_name,
       coalesce(ai.num(it.e->'qty'), 1)                     as qty,
       coalesce(ai.num(it.e->'price'), 0)                   as unit_price,
       coalesce(ai.num(it.e->'cost'), 0)                    as unit_cost,
       round(coalesce(ai.num(it.e->'qty'), 1) * coalesce(ai.num(it.e->'price'), 0), 2) as line_total,
       round(coalesce(ai.num(it.e->'qty'), 1) * coalesce(ai.num(it.e->'cost'), 0), 2)  as line_cost,
       round(coalesce(ai.num(it.e->'qty'), 1) * (coalesce(ai.num(it.e->'price'), 0) - coalesce(ai.num(it.e->'cost'), 0)), 2) as line_profit
from public.biz_sales b,
     jsonb_array_elements(case when jsonb_typeof(b.data->'items') = 'array' then b.data->'items' else '[]'::jsonb end)
       with ordinality it(e, ord)
where not b.deleted and jsonb_typeof(it.e) = 'object';

-- Customer payments (initial payments and later debt repayments)
create or replace view ai.payments with (security_invoker = true) as
select b.id,
       b.business_id,
       nullif(b.data->>'saleId', '')                        as sale_id,
       nullif(b.data->>'invoiceRef', '')                    as invoice_ref,
       coalesce(nullif(b.data->>'customerId', ''), s.customer_id) as customer_id,
       s.customer_name,
       coalesce(ai.num(b.data->'amount'), 0)                as amount,
       coalesce(nullif(b.data->>'method', ''), 'Cash')      as method,
       ai.pay_group(b.data->>'method')                      as method_group,
       nullif(b.data->>'note', '')                          as note,
       coalesce(ai.ts(b.data->>'paidAt'), b.updated_at)::date as paid_date
from public.biz_payments b
left join ai.sales s on s.id = b.data->>'saleId'
where not b.deleted;

-- ── Customers (with figures worked out from their sales) ───────────────────
create or replace view ai.customers with (security_invoker = true) as
with c as (
  select b.id, b.business_id,
         coalesce(nullif(btrim(b.data->>'name'), ''), 'Unnamed customer') as name,
         nullif(b.data->>'phone', '') as phone, nullif(b.data->>'email', '') as email,
         nullif(b.data->>'address', '') as address, coalesce(nullif(b.data->>'status', ''), 'Active') as status,
         coalesce(ai.ts(b.data->>'createdAt'), b.updated_at)::date as created_on
  from public.biz_customers b where not b.deleted
),
-- a sale belongs to a customer by id, or (older sales without an id) by exact name
m as (
  select s.*, coalesce(
           (select c.id from c where c.id = s.customer_id and c.business_id = s.business_id),
           (select c.id from c where lower(c.name) = lower(s.customer_name) and c.business_id = s.business_id order by c.created_on limit 1)
         ) as matched_id
  from ai.sales s where s.customer_name <> 'Walk-in Customer' or s.customer_id is not null
),
st as (
  select matched_id, count(*) as purchases, sum(total) as spent, sum(amount_paid) as paid,
         sum(balance) as owed, min(sale_date) as first_purchase, max(sale_date) as last_purchase
  from m where matched_id is not null group by matched_id
)
select c.id, c.business_id, c.name, c.phone, c.email, c.address, c.status, c.created_on,
       coalesce(st.purchases, 0) as purchases,
       coalesce(st.spent, 0)     as total_spent,
       coalesce(st.paid, 0)      as total_paid,
       coalesce(st.owed, 0)      as amount_owed,
       st.first_purchase, st.last_purchase,
       (current_date - st.last_purchase) as days_since_last_purchase
from c left join st on st.matched_id = c.id;

-- ── Products and stock ─────────────────────────────────────────────────────
create or replace view ai.products with (security_invoker = true) as
select b.id,
       b.business_id,
       coalesce(nullif(btrim(b.data->>'name'), ''), 'Unnamed product') as name,
       nullif(b.data->>'sku', '')        as sku,
       nullif(b.data->>'barcode', '')    as barcode,
       nullif(b.data->>'category', '')   as category,
       nullif(b.data->>'unit', '')       as unit,
       coalesce(ai.num(b.data->'qty'), 0)   as qty,
       coalesce(ai.num(b.data->'cost'), 0)  as cost,
       coalesce(ai.num(b.data->'price'), 0) as price,
       coalesce(ai.num(b.data->'lowLevel'), bz.default_low_stock, 5) as low_level,
       coalesce(nullif(b.data->>'status', ''), 'active') as status,
       round(coalesce(ai.num(b.data->'qty'), 0) * coalesce(ai.num(b.data->'cost'), 0), 2)  as stock_value_cost,
       round(coalesce(ai.num(b.data->'qty'), 0) * coalesce(ai.num(b.data->'price'), 0), 2) as stock_value_price,
       case when coalesce(ai.num(b.data->'price'), 0) > 0
            then round((coalesce(ai.num(b.data->'price'), 0) - coalesce(ai.num(b.data->'cost'), 0)) / ai.num(b.data->'price') * 100, 1)
       end as margin_pct,
       case when coalesce(ai.num(b.data->'qty'), 0) <= 0 then 'out'
            when coalesce(ai.num(b.data->'qty'), 0) <= coalesce(ai.num(b.data->'lowLevel'), bz.default_low_stock, 5) then 'low'
            else 'ok' end as stock_state,
       nullif(b.data->>'defaultSupplierId', '') as default_supplier_id
from public.biz_products b
left join ai.business bz on bz.business_id = b.business_id
where not b.deleted;

create or replace view ai.stock_movements with (security_invoker = true) as
select b.id, b.business_id,
       coalesce(ai.dt(b.data->>'date'), ai.ts(b.data->>'createdAt')::date, b.updated_at::date) as move_date,
       nullif(b.data->>'productId', '')   as product_id,
       nullif(b.data->>'productName', '') as product_name,
       coalesce(nullif(b.data->>'type', ''), 'adjustment') as type,
       coalesce(ai.num(b.data->'qty'), 0) as qty,
       ai.num(b.data->'qtyBefore')        as qty_before,
       ai.num(b.data->'qtyAfter')         as qty_after,
       nullif(b.data->>'refType', '')     as ref_type,
       nullif(b.data->>'note', '')        as note
from public.biz_stock_movements b
where not b.deleted;

-- ── Expenses ───────────────────────────────────────────────────────────────
create or replace view ai.expenses with (security_invoker = true) as
select b.id, b.business_id,
       coalesce(ai.dt(b.data->>'date'), ai.ts(b.data->>'createdAt')::date, b.updated_at::date) as expense_date,
       coalesce(ai.num(b.data->'amount'), 0)              as amount,
       coalesce(nullif(b.data->>'category', ''), 'Other') as category,
       nullif(b.data->>'description', '')                 as description,
       nullif(b.data->>'notes', '')                       as notes,
       nullif(b.data->>'paymentMethod', '')               as payment_method,
       coalesce((b.data->>'recurring')::boolean, false)   as recurring,
       nullif(b.data->>'createdByName', '')               as created_by_name
from public.biz_expenses b
where not b.deleted;

-- Costs spread over a period (rent paid for a year, etc.)
create or replace view ai.allocations with (security_invoker = true) as
select b.id, b.business_id,
       nullif(b.data->>'name', '')         as name,
       nullif(b.data->>'category', '')     as category,
       coalesce(ai.num(b.data->'amount'), 0) as amount,
       ai.num(b.data->'daily')             as daily_amount,
       ai.num(b.data->'days')              as days,
       ai.dt(b.data->>'startDate')         as start_date,
       ai.dt(b.data->>'endDate')           as end_date
from public.biz_allocations b
where not b.deleted;

-- ── Suppliers and purchasing ───────────────────────────────────────────────
create or replace view ai.suppliers with (security_invoker = true) as
select b.id, b.business_id,
       coalesce(nullif(btrim(b.data->>'name'), ''), 'Unnamed supplier') as name,
       nullif(b.data->>'contact', '') as contact, nullif(b.data->>'phone', '') as phone,
       nullif(b.data->>'whatsapp', '') as whatsapp, nullif(b.data->>'email', '') as email,
       coalesce(ai.num(b.data->'balance'), 0) as balance,
       coalesce(nullif(b.data->>'status', ''), 'Active') as status
from public.biz_suppliers b
where not b.deleted;

create or replace view ai.supplier_bills with (security_invoker = true) as
select b.id, b.business_id,
       nullif(b.data->>'ref', '')        as ref,
       nullif(b.data->>'supplier', '')   as supplier_name,
       nullif(b.data->>'supplierId', '') as supplier_id,
       ai.dt(b.data->>'date')            as bill_date,
       ai.dt(b.data->>'dueDate')         as due_date,
       coalesce(ai.num(b.data->'total'), 0)   as total,
       coalesce(ai.num(b.data->'balance'), 0) as balance,
       coalesce(nullif(b.data->>'status', ''), 'Unpaid') as status,
       (coalesce(ai.num(b.data->'balance'), 0) > 0 and ai.dt(b.data->>'dueDate') < current_date) as overdue
from public.biz_supplier_bills b
where not b.deleted;

create or replace view ai.purchase_orders with (security_invoker = true) as
select b.id, b.business_id,
       nullif(b.data->>'supplier', '')   as supplier_name,
       nullif(b.data->>'supplierId', '') as supplier_id,
       ai.dt(b.data->>'date')            as order_date,
       ai.dt(b.data->>'expectedDate')    as expected_date,
       coalesce(ai.num(b.data->'total'), 0) as total,
       coalesce(nullif(b.data->>'status', ''), 'Sent') as status,
       case when jsonb_typeof(b.data->'items') = 'array' then jsonb_array_length(b.data->'items') else 0 end as item_lines,
       nullif(b.data->>'notes', '') as notes
from public.biz_purchase_orders b
where not b.deleted;

create or replace view ai.grns with (security_invoker = true) as
select b.id, b.business_id,
       nullif(b.data->>'supplier', '')    as supplier_name,
       nullif(b.data->>'supplierId', '')  as supplier_id,
       nullif(b.data->>'poRef', '')       as po_ref,
       nullif(b.data->>'deliveryRef', '') as delivery_ref,
       ai.dt(b.data->>'date')             as received_date,
       coalesce(ai.num(b.data->'total'), 0) as total,
       coalesce(nullif(b.data->>'status', ''), 'Confirmed') as status
from public.biz_grns b
where not b.deleted;

create or replace view ai.grn_items with (security_invoker = true) as
select b.id as grn_id, b.business_id, ai.dt(b.data->>'date') as received_date,
       nullif(it.e->>'id', '') as product_id,
       coalesce(nullif(it.e->>'name', ''), 'Item') as product_name,
       ai.num(it.e->'orderedQty')  as ordered_qty,
       ai.num(it.e->'receivedQty') as received_qty,
       ai.num(it.e->'costPrice')   as cost_price,
       nullif(it.e->>'condition', '') as condition
from public.biz_grns b,
     jsonb_array_elements(case when jsonb_typeof(b.data->'items') = 'array' then b.data->'items' else '[]'::jsonb end) it(e)
where not b.deleted and jsonb_typeof(it.e) = 'object';

-- ── Quotations ─────────────────────────────────────────────────────────────
create or replace view ai.quotations with (security_invoker = true) as
select b.id, b.business_id,
       nullif(b.data->>'clientName', '')  as client_name,
       nullif(b.data->>'clientPhone', '') as client_phone,
       nullif(b.data->>'customerId', '')  as customer_id,
       ai.dt(b.data->>'date')             as quote_date,
       ai.dt(b.data->>'expiryDate')       as expiry_date,
       coalesce(ai.num(b.data->'subtotal'), 0)  as subtotal,
       coalesce(ai.num(b.data->'taxAmount'), 0) as tax_amount,
       coalesce(ai.num(b.data->'total'), 0)     as total,
       coalesce(nullif(b.data->>'status', ''), 'Draft') as status,
       (ai.dt(b.data->>'expiryDate') < current_date) as expired,
       case when jsonb_typeof(b.data->'items') = 'array' then jsonb_array_length(b.data->'items') else 0 end as item_lines
from public.biz_quotations b
where not b.deleted;

create or replace view ai.quotation_items with (security_invoker = true) as
select b.id as quotation_id, b.business_id,
       coalesce(nullif(it.e->>'name', ''), 'Item') as product_name,
       coalesce(ai.num(it.e->'qty'), 1)   as qty,
       coalesce(ai.num(it.e->'price'), 0) as unit_price,
       ai.num(it.e->'discount') as discount,
       ai.num(it.e->'tax')      as tax
from public.biz_quotations b,
     jsonb_array_elements(case when jsonb_typeof(b.data->'items') = 'array' then b.data->'items' else '[]'::jsonb end) it(e)
where not b.deleted and jsonb_typeof(it.e) = 'object';

-- ── Staff (bank details left out on purpose) ───────────────────────────────
create or replace view ai.employees with (security_invoker = true) as
select b.id, b.business_id,
       coalesce(nullif(btrim(b.data->>'name'), ''), 'Unnamed') as name,
       nullif(b.data->>'role', '')  as role,
       nullif(b.data->>'phone', '') as phone,
       coalesce(ai.num(b.data->'salary'), 0) as monthly_salary,
       ai.dt(b.data->>'startDate')  as start_date,
       coalesce(nullif(b.data->>'status', ''), 'active') as status
from public.biz_employees b
where not b.deleted;

create or replace view ai.payroll with (security_invoker = true) as
select b.id, b.business_id,
       nullif(b.data->>'employeeId', '') as employee_id,
       e.name                            as employee_name,
       nullif(b.data->>'month', '')      as pay_month,
       coalesce(ai.dt(b.data->>'date'), ai.ts(b.data->>'paidAt')::date) as paid_date,
       ai.num(b.data->'baseSalary')      as base_salary,
       ai.num(b.data->'bonus')           as bonus,
       ai.num(b.data->'deduction')       as deduction,
       ai.num(b.data->'loanDeduction')   as loan_deduction,
       coalesce(ai.num(b.data->'netPay'), ai.num(b.data->'amount'), 0) as net_pay,
       nullif(b.data->>'method', '')     as method
from public.biz_payroll b
left join ai.employees e on e.id = b.data->>'employeeId'
where not b.deleted;

-- ── Ready-made summaries ───────────────────────────────────────────────────
-- One row per business per day that had sales or expenses
create or replace view ai.daily_summary with (security_invoker = true) as
with s as (
  select business_id, sale_date as day, count(*) as invoices, sum(total) as sales,
         sum(amount_paid) as collected_at_sale, sum(balance) as credit_given, sum(discount_amount) as discounts,
         sum(total) filter (where payment_group = 'Cash') as cash_sales,
         sum(total) filter (where payment_group = 'Mobile money') as mobile_money_sales
  from ai.sales group by 1, 2
), e as (
  select business_id, expense_date as day, sum(amount) as expenses from ai.expenses group by 1, 2
)
select coalesce(s.business_id, e.business_id) as business_id,
       coalesce(s.day, e.day)                 as day,
       extract(isodow from coalesce(s.day, e.day))::int as weekday,   -- 1 = Monday … 7 = Sunday
       coalesce(s.invoices, 0)           as invoices,
       coalesce(s.sales, 0)              as sales,
       coalesce(s.collected_at_sale, 0)  as collected_at_sale,
       coalesce(s.credit_given, 0)       as credit_given,
       coalesce(s.discounts, 0)          as discounts,
       coalesce(s.cash_sales, 0)         as cash_sales,
       coalesce(s.mobile_money_sales, 0) as mobile_money_sales,
       coalesce(e.expenses, 0)           as expenses,
       coalesce(s.sales, 0) - coalesce(e.expenses, 0) as sales_minus_expenses
from s full join e on e.business_id = s.business_id and e.day = s.day;

-- Monthly profit and loss. Cost of goods is only known for sales that have item lines,
-- so `cogs_coverage_pct` says how much of the sales value the COGS figure covers.
create or replace view ai.monthly_pnl with (security_invoker = true) as
with months as (
  select business_id, to_char(sale_date, 'YYYY-MM') as month from ai.sales
  union select business_id, to_char(expense_date, 'YYYY-MM') from ai.expenses
  union select business_id, pay_month from ai.payroll where pay_month is not null
), s as (
  select business_id, to_char(sale_date, 'YYYY-MM') as month, count(*) as invoices, sum(total) as sales,
         sum(discount_amount) as discounts, sum(amount_paid) as collected_at_sale,
         sum(total) filter (where item_lines > 0) as sales_with_items
  from ai.sales group by 1, 2
), c as (
  select business_id, to_char(sale_date, 'YYYY-MM') as month, sum(line_cost) as cogs from ai.sale_items group by 1, 2
), e as (
  select business_id, to_char(expense_date, 'YYYY-MM') as month, sum(amount) as expenses from ai.expenses group by 1, 2
), p as (
  select business_id, pay_month as month, sum(net_pay) as payroll from ai.payroll group by 1, 2
)
select m.business_id, m.month,
       coalesce(s.invoices, 0)  as invoices,
       coalesce(s.sales, 0)     as sales,
       coalesce(s.discounts, 0) as discounts,
       coalesce(s.collected_at_sale, 0) as collected_at_sale,
       coalesce(c.cogs, 0)      as cogs_known,
       case when coalesce(s.sales, 0) > 0 then round(coalesce(s.sales_with_items, 0) / s.sales * 100, 1) else 0 end as cogs_coverage_pct,
       coalesce(e.expenses, 0)  as expenses,
       coalesce(p.payroll, 0)   as payroll,
       coalesce(s.sales, 0) - coalesce(c.cogs, 0)                                        as gross_profit_known_cogs,
       coalesce(s.sales, 0) - coalesce(c.cogs, 0) - coalesce(e.expenses, 0) - coalesce(p.payroll, 0) as net_profit_known_cogs
from months m
left join s on s.business_id = m.business_id and s.month = m.month
left join c on c.business_id = m.business_id and c.month = m.month
left join e on e.business_id = m.business_id and e.month = m.month
left join p on p.business_id = m.business_id and p.month = m.month;

-- What the data can and cannot answer. The agent reads this so it can warn instead of guessing.
create or replace view ai.data_quality with (security_invoker = true) as
select b.business_id,
       (select count(*) from ai.sales s where s.business_id = b.business_id)                          as sales,
       (select count(*) from ai.sales s where s.business_id = b.business_id and s.item_lines = 0)     as sales_without_items,
       (select count(*) from ai.sales s where s.business_id = b.business_id and not s.has_invoice_no) as sales_without_invoice_no,
       (select count(*) from ai.sales s where s.business_id = b.business_id and s.customer_name = 'Walk-in Customer') as walk_in_sales,
       (select min(sale_date) from ai.sales s where s.business_id = b.business_id)                    as first_sale_date,
       (select max(sale_date) from ai.sales s where s.business_id = b.business_id)                    as last_sale_date,
       (select count(*) from ai.products p where p.business_id = b.business_id)                       as products,
       (select count(*) from ai.products p where p.business_id = b.business_id and p.cost = 0)        as products_without_cost,
       (select count(*) from ai.customers c where c.business_id = b.business_id)                      as customers,
       (select count(*) from ai.customers c where c.business_id = b.business_id and c.phone is null)  as customers_without_phone
from ai.business b;

revoke all on all tables in schema ai from public, anon;
grant select on all tables in schema ai to authenticated, service_role;
