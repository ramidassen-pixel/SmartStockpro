-- SmartStock AI — answer key for ai-eval/questions.json
-- Works out the correct answer to every test question straight from the ai.* views.
-- Run it in the Supabase SQL editor (or via `node ai-eval/run.mjs --key`), and save the single JSON
-- value it returns as ai-eval/expected.json. Run it on the SAME DAY as the test run ("today",
-- "this month" and "last week" move with the date).
--
-- Business: the one with the most sales. To test another, replace the `biz` line with
--   biz as (select 'BIZ-XXXX'::text as id),

with biz as (select business_id as id from ai.sales group by 1 order by count(*) desc limit 1),
d as (
  select current_date as t,
         date_trunc('month', current_date)::date as m0,
         (date_trunc('month', current_date) - interval '1 month')::date as lm0,
         (date_trunc('month', current_date) - interval '1 day')::date as lm1,
         (date_trunc('month', current_date) - interval '2 month')::date as m2,
         (date_trunc('week', current_date) - interval '7 day')::date as lw0,
         (date_trunc('week', current_date) - interval '1 day')::date as lw1
),
s   as (select * from ai.sales           where business_id = (select id from biz)),
e   as (select * from ai.expenses        where business_id = (select id from biz)),
p   as (select * from ai.products        where business_id = (select id from biz) and status <> 'inactive'),
c   as (select * from ai.customers       where business_id = (select id from biz)),
pay as (select * from ai.payments        where business_id = (select id from biz)),
it  as (select * from ai.sale_items      where business_id = (select id from biz)),
sup as (select * from ai.suppliers       where business_id = (select id from biz)),
bl  as (select * from ai.supplier_bills  where business_id = (select id from biz)),
q   as (select * from ai.quotations      where business_id = (select id from biz)),
emp as (select * from ai.employees       where business_id = (select id from biz) and status <> 'inactive'),
mv  as (select * from ai.stock_movements where business_id = (select id from biz)),
ms  as (select * from s, d where s.sale_date >= d.m0),                      -- sales this month
ls  as (select * from s, d where s.sale_date between d.lm0 and d.lm1),      -- sales last month
me  as (select * from e, d where e.expense_date >= d.m0),                   -- expenses this month
best_day   as (select sale_date, sum(total) v from ms group by 1 order by 2 desc limit 1),
top_exp    as (select category, sum(amount) v from me group by 1 order by 2 desc limit 1),
top_prod   as (select name, qty, price from p order by stock_value_cost desc, name limit 1),
top_item   as (select product_name, sum(qty) u from it, d where it.sale_date >= d.m0 group by 1 order by 2 desc limit 1),
top_margin as (select name from p where price > 0 and cost > 0 order by margin_pct desc, name limit 1),
top_debtor as (select name, amount_owed from c where amount_owed > 0 order by amount_owed desc limit 1),
top_staff  as (select created_by_name n, sum(total) v from ms where created_by_name is not null group by 1 order by 2 desc limit 1),
last_inv   as (select invoice_no, customer_name, total from s where has_invoice_no order by sale_date desc, created_at desc limit 1),
best_month as (select date_trunc('month', sale_date)::date m, sum(total) v from s, d
               where s.sale_date >= (d.m0 - interval '11 month') group by 1 order by 2 desc limit 1),
first_sale as (select min(sale_date) dt from s)
select jsonb_pretty(jsonb_build_object(
  'generated_on', (select t from d),
  'business_id',  (select id from biz),
  'vars', jsonb_build_object(
    'month_name',  (select to_char(m2, 'FMMonth YYYY') from d),
    'top_product', (select name from top_prod),
    'invoice_no',  (select invoice_no from last_inv)),
  'answers', jsonb_build_object(
    'q01', jsonb_build_object('numbers', jsonb_build_array((select round(coalesce(sum(total), 0), 2) from s, d where sale_date = d.t))),
    'q02', jsonb_build_object('numbers', jsonb_build_array((select round(coalesce(sum(total), 0), 2) from ms), (select count(*) from ms))),
    'q03', jsonb_build_object('numbers', jsonb_build_array((select round(coalesce(sum(total), 0), 2) from ls))),
    'q04', jsonb_build_object('numbers', jsonb_build_array((select round(coalesce(sum(total), 0), 2) from s))),
    'q05', jsonb_build_object('numbers', jsonb_build_array(
             (select round(coalesce((select sum(amount_paid) from ms), 0)
                         + coalesce((select sum(amount) from pay, d where paid_date >= d.m0 and note is distinct from 'Initial payment'), 0), 2)))),
    'q06', jsonb_build_object('numbers', jsonb_build_array((select round(coalesce(sum(balance), 0), 2) from s))),
    'q07', jsonb_build_object('names_all', (select jsonb_agg(name) from (select name from c order by total_spent desc limit 5) x)),
    'q08', (select jsonb_build_object('names_all', jsonb_build_array(name), 'numbers', jsonb_build_array(round(amount_owed, 2))) from top_debtor),
    'q09', jsonb_build_object('numbers', jsonb_build_array((select count(*) from c))),
    'q10', jsonb_build_object('numbers', jsonb_build_array((select round(coalesce(sum(total), 0), 2) from ms where payment_group = 'Mobile money'))),
    'q11', jsonb_build_object('numbers', jsonb_build_array(
             (select round(coalesce(sum(total), 0), 2) from ls where payment_group = 'Cash'),
             (select round(coalesce(sum(total), 0), 2) from ls where payment_group = 'Mobile money'))),
    'q12', (select jsonb_build_object('numbers', jsonb_build_array(round(v, 2)),
             'names_any', jsonb_build_array(to_char(sale_date, 'YYYY-MM-DD'), to_char(sale_date, 'FMMonth FMDD'), to_char(sale_date, 'FMDD FMMonth'),
                                            to_char(sale_date, 'Mon FMDD'), to_char(sale_date, 'FMDD Mon'), to_char(sale_date, 'FMDDth'))) from best_day),
    'q13', jsonb_build_object('numbers', jsonb_build_array(
             (select round(coalesce(sum(total), 0), 2) from s, d where sale_date >= d.m2 and sale_date < d.lm0))),
    'q14', jsonb_build_object('numbers', jsonb_build_array((select round(coalesce(avg(total), 0), 2) from ms))),
    'q15', jsonb_build_object('numbers', jsonb_build_array(
             (select count(*) from s, d where sale_date between d.lw0 and d.lw1),
             (select round(coalesce(sum(total), 0), 2) from s, d where sale_date between d.lw0 and d.lw1))),
    'q16', jsonb_build_object('numbers', jsonb_build_array(
             (select round(coalesce(sum(total), 0), 2) from ms),
             (select round(coalesce(sum(total), 0), 2) from s, d where sale_date between d.lm0 and least(d.lm1, d.lm0 + (d.t - d.m0))))),
    'q17', jsonb_build_object('numbers', jsonb_build_array((select round(coalesce(sum(amount), 0), 2) from me))),
    'q18', (select jsonb_build_object('names_all', jsonb_build_array(category), 'numbers', jsonb_build_array(round(v, 2))) from top_exp),
    'q19', jsonb_build_object('numbers', jsonb_build_array((select round(coalesce(sum(amount), 0), 2) from e, d where expense_date between d.lm0 and d.lm1))),
    -- With no item lines, the honest figure is sales minus expenses, with a warning that cost of goods is unknown
    'q20', jsonb_build_object('numbers', jsonb_build_array(
             (select round(coalesce((select sum(total) from ms), 0) - coalesce((select sum(line_cost) from it, d where it.sale_date >= d.m0), 0)
                         - coalesce((select sum(amount) from me), 0), 2)))),
    'q21', jsonb_build_object('numbers', jsonb_build_array((select round(coalesce(sum(stock_value_cost), 0), 2) from p))),
    'q22', jsonb_build_object('numbers', jsonb_build_array((select round(coalesce(sum(stock_value_price), 0), 2) from p))),
    'q23', jsonb_build_object('numbers', jsonb_build_array((select count(*) from p where stock_state = 'out'))),
    'q24', jsonb_build_object('names_all', (select jsonb_agg(name order by qty) from p where stock_state = 'low')),
    'q25', jsonb_build_object('names_all', (select jsonb_build_array(name) from top_prod)),
    'q26', jsonb_build_object('numbers', (select jsonb_build_array(qty) from top_prod)),
    'q27', jsonb_build_object('numbers', (select jsonb_build_array(price) from top_prod)),
    'q28', (select jsonb_build_object('names_all', jsonb_build_array(product_name)) from top_item),
    'q29', jsonb_build_object('names_all', (select jsonb_build_array(name) from top_margin)),
    'q30', jsonb_build_object('numbers', jsonb_build_array((select round(coalesce(sum(balance), 0), 2) from sup))),
    'q31', (select jsonb_build_object('numbers', jsonb_build_array(count(*), round(sum(balance), 2))) from bl where overdue having count(*) > 0),
    'q32', jsonb_build_object('numbers', jsonb_build_array((select count(*) from emp), (select round(coalesce(sum(monthly_salary), 0), 2) from emp))),
    'q33', jsonb_build_object('numbers', jsonb_build_array((select count(*) from q), (select round(coalesce(sum(total), 0), 2) from q))),
    'q34', jsonb_build_object('names_all', (select jsonb_agg(invoice_no) from (select invoice_no from s where has_invoice_no order by sale_date desc, created_at desc limit 3) x)),
    'q35', (select jsonb_build_object('names_all', jsonb_build_array(customer_name), 'numbers', jsonb_build_array(round(total, 2))) from last_inv),
    'q36', (select jsonb_build_object('numbers', jsonb_build_array(round(sum(amount), 2))) from pay, d
            where paid_date >= d.m0 and note is distinct from 'Initial payment' having count(*) > 0),
    'q37', (select jsonb_build_object('names_all', jsonb_build_array(n)) from top_staff),
    'q38', jsonb_build_object('numbers', jsonb_build_array((select count(*) from mv where type = 'return'))),
    'q39', (select jsonb_build_object('names_any', jsonb_build_array(to_char(dt, 'YYYY-MM-DD'), to_char(dt, 'FMMonth FMDD, YYYY'), to_char(dt, 'FMDD FMMonth YYYY'),
                                                                   to_char(dt, 'FMMonth FMDD'), to_char(dt, 'Mon FMDD, YYYY'))) from first_sale where dt is not null),
    'q40', jsonb_build_object('numbers', jsonb_build_array((select round(coalesce(sum(total), 0), 2) from s, d where sale_date = d.t))),
    'q41', null,
    'q42', null,
    'q43', jsonb_build_object('names_any', (select jsonb_agg(name) from (select name from c where purchases >= 5 and days_since_last_purchase > 60
                                                                         order by purchases desc limit 10) x)),
    'q44', jsonb_build_object('numbers', jsonb_build_array((select round(coalesce(sum(discount_amount), 0), 2) from ms))),
    'q45', (select jsonb_build_object('numbers', jsonb_build_array(round(v, 2)),
             'names_any', jsonb_build_array(to_char(m, 'FMMonth YYYY'), to_char(m, 'Mon YYYY'), to_char(m, 'YYYY-MM'), to_char(m, 'FMMonth'))) from best_month)
  )
)) as expected;
