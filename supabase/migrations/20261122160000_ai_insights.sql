-- SmartStock Pro — AI agent, Phase 3: nightly business insights.
--
-- Every night (02:30, after the 02:00 backup) ai.compute_insights() works out, for each business:
-- sales trends, slow/strong days, stock to reorder, products sold below cost, customer debt by age,
-- regular customers who stopped buying, expense spikes, supplier bills due, quotations expiring,
-- and gaps in the records. Results go to public.biz_insights (one row per insight per day, kept 30 days).
--
--  * The Dashboard shows today's insights; the AI agent reads them with its get_insights tool.
--  * Users can only READ their own business's insights (row-level security). Only the server writes them.
--  * public.ai_refresh_insights() lets a signed-in user recompute their own business on demand
--    (at most once every 10 minutes).
-- Undo: select cron.unschedule('smartstock-ai-insights'); drop table public.biz_insights;
--       drop function public.ai_refresh_insights(); drop function ai.refresh_all_insights();
--       drop function ai.compute_insights(text, date); drop function ai.money(numeric, text);

create table if not exists public.biz_insights (
  id          bigserial primary key,
  business_id text not null references public.platform_businesses(id) on delete cascade,
  day         date not null,
  kind        text not null,
  severity    text not null check (severity in ('alert', 'warn', 'good', 'info')),
  title       text not null,
  detail      text,
  data        jsonb not null default '{}'::jsonb,
  sort        int  not null default 100,
  created_at  timestamptz not null default now(),
  unique (business_id, day, kind)
);
create index if not exists biz_insights_biz_day_idx on public.biz_insights (business_id, day desc);

alter table public.biz_insights enable row level security;
drop policy if exists own_biz_select on public.biz_insights;
create policy own_biz_select on public.biz_insights for select to authenticated using (business_id = public.my_business_id());
revoke all on public.biz_insights from public, anon, authenticated;
grant select on public.biz_insights to authenticated;
grant all on public.biz_insights to service_role;

create or replace function ai.money(n numeric, c text) returns text
language sql immutable set search_path = '' as $$
  select (case when coalesce(n, 0) < 0 then '-' else '' end) || coalesce(nullif(c, ''), '$')
         || to_char(abs(round(coalesce(n, 0), 2)), 'FM999,999,999,990.00')
$$;

create or replace function ai.compute_insights(p_biz text, p_day date default current_date) returns int
language plpgsql security definer set search_path = '' as $$
declare
  t date := p_day;
  y date := p_day - 1;
  m0 date := date_trunc('month', p_day)::date;
  c text;
  has_items boolean;
  n int;
begin
  select currency into c from ai.business where business_id = p_biz;
  c := coalesce(c, '$');
  select exists (select 1 from ai.sale_items where business_id = p_biz and sale_date >= t - 30) into has_items;

  delete from public.biz_insights where business_id = p_biz and (day = t or day < t - 30);

  -- Sales, last 7 complete days vs the 7 before
  insert into public.biz_insights (business_id, day, kind, severity, title, detail, data, sort)
  select p_biz, t, 'sales_week_trend',
         case when prev > 0 and wk < prev * 0.75 then 'warn' when prev > 0 and wk > prev * 1.25 then 'good' else 'info' end,
         'Sales last 7 days: ' || ai.money(wk, c),
         case when prev > 0 then (case when wk >= prev then 'Up ' else 'Down ' end) || abs(round((wk - prev) / prev * 100)) || '% on the 7 days before (' || ai.money(prev, c) || ').'
              else 'No sales in the 7 days before to compare with.' end,
         jsonb_build_object('last_7_days', wk, 'previous_7_days', prev, 'from', t - 7, 'to', y), 10
  from (select coalesce(sum(total) filter (where sale_date between t - 7 and y), 0) wk,
               coalesce(sum(total) filter (where sale_date between t - 14 and t - 8), 0) prev
        from ai.sales where business_id = p_biz and sale_date between t - 14 and y) x
  where wk > 0 or prev > 0;

  -- This month so far vs the same days last month
  if t > m0 then
    insert into public.biz_insights (business_id, day, kind, severity, title, detail, data, sort)
    select p_biz, t, 'month_pace',
           case when lm > 0 and mtd < lm * 0.8 then 'warn' when lm > 0 and mtd > lm * 1.2 then 'good' else 'info' end,
           'This month so far: ' || ai.money(mtd, c),
           case when lm > 0 then (case when mtd >= lm then 'Ahead of' else 'Behind' end) || ' last month by ' || abs(round((mtd - lm) / lm * 100))
                                 || '% for the same days (' || ai.money(lm, c) || ' by day ' || (y - m0 + 1) || ').'
                else 'No sales in the same days last month to compare with.' end,
           jsonb_build_object('month_to_date', mtd, 'same_days_last_month', lm, 'days', y - m0 + 1), 11
    from (select coalesce(sum(total) filter (where sale_date between m0 and y), 0) mtd,
                 coalesce(sum(total) filter (where sale_date between (m0 - interval '1 month')::date
                                                and least((m0 - interval '1 month')::date + (y - m0), m0 - 1)), 0) lm
          from ai.sales where business_id = p_biz and sale_date >= (m0 - interval '1 month')::date) x
    where mtd > 0 or lm > 0;
  end if;

  -- Yesterday vs a usual day of the same weekday (the 8 before)
  insert into public.biz_insights (business_id, day, kind, severity, title, detail, data, sort)
  select p_biz, t, 'yesterday_vs_usual',
         case when yv = 0 then 'warn' when yv < usual * 0.5 then 'warn' else 'good' end,
         case when yv = 0 then 'No sales recorded yesterday (' || trim(to_char(y, 'Day')) || ')'
              when yv < usual * 0.5 then 'Yesterday was slow: ' || ai.money(yv, c)
              else 'Strong day yesterday: ' || ai.money(yv, c) end,
         'A usual ' || trim(to_char(y, 'Day')) || ' brings ' || ai.money(usual, c) || ' (average of the last 8).'
           || case when yv = 0 then ' If you did sell, check that the sales were saved and synced.' else '' end,
         jsonb_build_object('yesterday', yv, 'usual_same_weekday', usual, 'date', y), 12
  from (select (select coalesce(sum(total), 0) from ai.sales where business_id = p_biz and sale_date = y) yv,
               (select round(avg(v), 2) from (select (select coalesce(sum(total), 0) from ai.sales s where s.business_id = p_biz and s.sale_date = y - 7 * k) v
                                              from generate_series(1, 8) k) w) usual) x
  where usual > 0 and (yv < usual * 0.5 or yv > usual * 1.5);

  -- Best and weakest weekday over the last 90 days
  insert into public.biz_insights (business_id, day, kind, severity, title, detail, data, sort)
  select p_biz, t, 'best_weekday', 'info',
         'Best day of the week: ' || (array_agg(dname order by av desc))[1],
         'Average ' || ai.money((array_agg(av order by av desc))[1], c) || ' a day.'
           || coalesce(' Weakest open day: ' || (array_agg(dname order by av asc) filter (where av > 0))[1]
                       || ' (' || ai.money((array_agg(av order by av asc) filter (where av > 0))[1], c) || ').', '')
           || ' Based on the last 90 days.',
         jsonb_object_agg(dname, av), 30
  from (select trim(to_char(d, 'Day')) dname, round(avg(coalesce(v, 0)), 2) av
        from (select d::date d, (select sum(total) from ai.sales s where s.business_id = p_biz and s.sale_date = d::date) v
              from generate_series(t - 90, y, interval '1 day') d) q
        group by 1) w
  having count(*) = 7 and max(av) > 0;

  -- Stock: out of stock, low stock
  insert into public.biz_insights (business_id, day, kind, severity, title, detail, data, sort)
  select p_biz, t, 'out_of_stock', 'alert',
         count(*) || ' product' || case when count(*) > 1 then 's' else '' end || ' out of stock',
         string_agg(name, ', ' order by stock_value_price desc) filter (where rn <= 8) || case when count(*) > 8 then ' and more.' else '.' end,
         jsonb_build_object('products', jsonb_agg(name order by name)), 1
  from (select *, row_number() over (order by name) rn from ai.products where business_id = p_biz and status <> 'inactive' and stock_state = 'out') p
  having count(*) > 0;

  insert into public.biz_insights (business_id, day, kind, severity, title, detail, data, sort)
  select p_biz, t, 'low_stock', 'warn',
         count(*) || ' product' || case when count(*) > 1 then 's' else '' end || ' running low',
         string_agg(name || ' (' || trim(to_char(qty, 'FM999,999,990.###')) || ' left)', ', ' order by qty) filter (where rn <= 8)
           || case when count(*) > 8 then ' and more.' else '.' end,
         jsonb_build_object('products', jsonb_agg(jsonb_build_object('name', name, 'qty', qty, 'low_level', low_level) order by qty)), 2
  from (select *, row_number() over (order by qty) rn from ai.products where business_id = p_biz and status <> 'inactive' and stock_state = 'low') p
  having count(*) > 0;

  -- Needs sale item lines: reorder timing and dead stock
  if has_items then
    insert into public.biz_insights (business_id, day, kind, severity, title, detail, data, sort)
    select p_biz, t, 'reorder_soon', 'warn',
           count(*) || ' product' || case when count(*) > 1 then 's' else '' end || ' will run out within 2 weeks',
           string_agg(name || ' (~' || days_left || ' days)', ', ' order by days_left) filter (where rn <= 8) || '.',
           jsonb_build_object('products', jsonb_agg(jsonb_build_object('name', name, 'qty', qty, 'units_per_day', per_day, 'days_left', days_left) order by days_left)), 3
    from (select p.name, p.qty, round(u.units / 30.0, 2) per_day, floor(p.qty / (u.units / 30.0))::int days_left,
                 row_number() over (order by p.qty / (u.units / 30.0)) rn
          from ai.products p
          join (select product_id, sum(qty) units from ai.sale_items where business_id = p_biz and sale_date >= t - 30 and product_id is not null group by 1) u
            on u.product_id = p.id
          where p.business_id = p_biz and p.status <> 'inactive' and p.qty > 0 and u.units > 0 and p.qty / (u.units / 30.0) < 14) r
    having count(*) > 0;

    insert into public.biz_insights (business_id, day, kind, severity, title, detail, data, sort)
    select p_biz, t, 'dead_stock', 'info',
           ai.money(sum(stock_value_cost), c) || ' of stock has not sold in 60 days',
           string_agg(name, ', ' order by stock_value_cost desc) filter (where rn <= 6) || '. Consider a discount or bundling.',
           jsonb_build_object('value_at_cost', sum(stock_value_cost), 'products', jsonb_agg(jsonb_build_object('name', name, 'qty', qty, 'value', stock_value_cost) order by stock_value_cost desc)), 40
    from (select p.*, row_number() over (order by p.stock_value_cost desc) rn from ai.products p
          where p.business_id = p_biz and p.status <> 'inactive' and p.qty > 0
            and not exists (select 1 from ai.sale_items i where i.business_id = p_biz and i.product_id = p.id and i.sale_date >= t - 60)) d
    having count(*) > 0 and sum(stock_value_cost) > 0;
  end if;

  -- Prices: selling at or below cost; products without a cost price
  insert into public.biz_insights (business_id, day, kind, severity, title, detail, data, sort)
  select p_biz, t, 'below_cost', 'alert',
         count(*) || ' product' || case when count(*) > 1 then 's are' else ' is' end || ' priced below cost',
         string_agg(name || ' (price ' || ai.money(price, c) || ', cost ' || ai.money(cost, c) || ')', ', ') || '.',
         jsonb_build_object('products', jsonb_agg(jsonb_build_object('name', name, 'price', price, 'cost', cost))), 4
  from ai.products where business_id = p_biz and status <> 'inactive' and price > 0 and cost > price
  having count(*) > 0;

  insert into public.biz_insights (business_id, day, kind, severity, title, detail, data, sort)
  select p_biz, t, 'missing_cost', 'info',
         count(*) || ' product' || case when count(*) > 1 then 's have' else ' has' end || ' no cost price',
         'Add the cost price so profit can be worked out: ' || string_agg(distinct name, ', ') || '.',
         jsonb_build_object('products', jsonb_agg(distinct name)), 45
  from ai.products where business_id = p_biz and status <> 'inactive' and cost = 0 and qty > 0
  having count(*) > 0;

  -- Customer debt by age
  insert into public.biz_insights (business_id, day, kind, severity, title, detail, data, sort)
  select p_biz, t, 'customer_debt', case when over60 > 0 then 'warn' else 'info' end,
         'Customers owe you ' || ai.money(total, c),
         ai.money(d30, c) || ' from the last 30 days, ' || ai.money(d60, c) || ' from 31–60 days, ' || ai.money(over60, c) || ' older than 60 days.'
           || coalesce(' Biggest: ' || top || '.', ''),
         jsonb_build_object('total', total, 'days_0_30', d30, 'days_31_60', d60, 'over_60_days', over60), 5
  from (select sum(balance) total,
               coalesce(sum(balance) filter (where sale_date >= t - 30), 0) d30,
               coalesce(sum(balance) filter (where sale_date between t - 60 and t - 31), 0) d60,
               coalesce(sum(balance) filter (where sale_date < t - 60), 0) over60,
               (select string_agg(customer_name || ' ' || ai.money(owed, c), ', ' order by owed desc)
                from (select customer_name, sum(balance) owed from ai.sales where business_id = p_biz and balance > 0
                      group by 1 order by 2 desc limit 3) tq) top
        from ai.sales where business_id = p_biz and balance > 0) x
  where total > 0;

  -- Regular customers who stopped buying (5+ purchases, nothing for 30–180 days)
  insert into public.biz_insights (business_id, day, kind, severity, title, detail, data, sort)
  select p_biz, t, 'lapsed_regulars', 'info',
         count(*) || ' regular customer' || case when count(*) > 1 then 's have' else ' has' end || ' not bought for over a month',
         string_agg(name || ' (' || days_since_last_purchase || ' days)', ', ' order by total_spent desc) filter (where rn <= 5)
           || '. A call or WhatsApp could bring them back.',
         jsonb_build_object('customers', jsonb_agg(jsonb_build_object('name', name, 'phone', phone, 'purchases', purchases,
                                                                      'spent', total_spent, 'days_since', days_since_last_purchase) order by total_spent desc)), 20
  from (select *, row_number() over (order by total_spent desc) rn from ai.customers
        where business_id = p_biz and purchases >= 5 and days_since_last_purchase between 31 and 180) q
  having count(*) > 0;

  -- Top customers this month
  insert into public.biz_insights (business_id, day, kind, severity, title, detail, data, sort)
  select p_biz, t, 'top_customers_month', 'info',
         'Top customer this month: ' || (array_agg(customer_name order by v desc))[1],
         string_agg(customer_name || ' ' || ai.money(v, c), ', ' order by v desc) || '.',
         jsonb_build_object('customers', jsonb_agg(jsonb_build_object('name', customer_name, 'spent', v) order by v desc)), 25
  from (select customer_name, sum(total) v from ai.sales
        where business_id = p_biz and sale_date >= m0 and customer_name <> 'Walk-in Customer'
        group by 1 order by 2 desc limit 3) q
  having count(*) > 0;

  -- Expenses: last 30 days vs the usual 30 days (average of the 90 before)
  insert into public.biz_insights (business_id, day, kind, severity, title, detail, data, sort)
  select p_biz, t, 'expense_spike', 'warn',
         'Expenses are up: ' || ai.money(last30, c) || ' in the last 30 days',
         'Usually about ' || ai.money(usual, c) || ' a month.' || coalesce(' Biggest: ' || topcat || '.', ''),
         jsonb_build_object('last_30_days', last30, 'usual_30_days', usual), 6
  from (select coalesce(sum(amount) filter (where expense_date >= t - 30), 0) last30,
               round(coalesce(sum(amount) filter (where expense_date between t - 120 and t - 31), 0) / 3, 2) usual,
               (select category || ' ' || ai.money(sum(amount), c) from ai.expenses
                where business_id = p_biz and expense_date >= t - 30 group by category order by sum(amount) desc limit 1) topcat
        from ai.expenses where business_id = p_biz and expense_date >= t - 120) x
  where usual > 0 and last30 > usual * 1.5 and last30 - usual >= 20;

  -- Supplier bills overdue or due within 7 days
  insert into public.biz_insights (business_id, day, kind, severity, title, detail, data, sort)
  select p_biz, t, 'supplier_bills', case when bool_or(due_date < t) then 'alert' else 'warn' end,
         case when bool_or(due_date < t) then 'Supplier bills overdue: ' || ai.money(sum(balance) filter (where due_date < t), c)
              else 'Supplier bills due this week: ' || ai.money(sum(balance), c) end,
         string_agg(coalesce(supplier_name, 'Supplier') || ' ' || ai.money(balance, c) || ' due ' || to_char(due_date, 'DD Mon'), ', ' order by due_date) || '.',
         jsonb_build_object('bills', jsonb_agg(jsonb_build_object('supplier', supplier_name, 'ref', ref, 'balance', balance, 'due', due_date) order by due_date)), 7
  from ai.supplier_bills where business_id = p_biz and balance > 0 and due_date <= t + 7
  having count(*) > 0;

  -- Quotations about to expire
  insert into public.biz_insights (business_id, day, kind, severity, title, detail, data, sort)
  select p_biz, t, 'quotes_expiring', 'info',
         count(*) || ' quotation' || case when count(*) > 1 then 's expire' else ' expires' end || ' this week',
         string_agg(coalesce(client_name, 'Client') || ' ' || ai.money(total, c) || ' (' || to_char(expiry_date, 'DD Mon') || ')', ', ' order by expiry_date)
           || '. Follow up before they lapse.',
         jsonb_build_object('quotations', jsonb_agg(jsonb_build_object('client', client_name, 'total', total, 'expires', expiry_date) order by expiry_date)), 22
  from ai.quotations where business_id = p_biz and expiry_date between t and t + 7
       and lower(status) not in ('converted', 'accepted', 'rejected', 'declined', 'cancelled')
  having count(*) > 0;

  -- Records: recent sales saved without items (profit and best-sellers can't be worked out)
  insert into public.biz_insights (business_id, day, kind, severity, title, detail, data, sort)
  select p_biz, t, 'sales_without_items', 'warn',
         noitems || ' of ' || allsales || ' sales in the last 30 days have no products listed',
         'Without the products on each sale, the app cannot work out profit, best-sellers or when to reorder. Pick the products when making a sale.',
         jsonb_build_object('without_items', noitems, 'sales', allsales), 8
  from (select count(*) filter (where item_lines = 0) noitems, count(*) allsales
        from ai.sales where business_id = p_biz and sale_date >= t - 30) x
  where noitems > 0;

  select count(*) into n from public.biz_insights where business_id = p_biz and day = t;
  return n;
end $$;

-- Nightly: every business
create or replace function ai.refresh_all_insights() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b record; ok int := 0; failed int := 0;
begin
  for b in select id from public.platform_businesses loop
    begin
      perform ai.compute_insights(b.id);
      ok := ok + 1;
    exception when others then
      failed := failed + 1;
      raise warning 'insights failed for %: %', b.id, sqlerrm;
    end;
  end loop;
  return jsonb_build_object('businesses', ok, 'failed', failed);
end $$;

-- On demand, for the signed-in user's own business (at most every 10 minutes)
create or replace function public.ai_refresh_insights() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_biz text := public.my_business_id(); v_last timestamptz; n int;
begin
  if auth.uid() is null or v_biz is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  select max(created_at) into v_last from public.biz_insights where business_id = v_biz and day = current_date;
  if v_last is not null and v_last > now() - interval '10 minutes' then
    return jsonb_build_object('refreshed', false, 'reason', 'recently refreshed', 'at', v_last);
  end if;
  n := ai.compute_insights(v_biz);
  return jsonb_build_object('refreshed', true, 'insights', n);
end $$;

revoke all on function ai.money(numeric, text), ai.compute_insights(text, date), ai.refresh_all_insights() from public, anon, authenticated;
grant execute on function ai.money(numeric, text) to authenticated, service_role;
revoke all on function public.ai_refresh_insights() from public, anon;
grant execute on function public.ai_refresh_insights() to authenticated;

-- Schedule: 02:30 every night (server time = UTC = Liberia time)
select cron.unschedule('smartstock-ai-insights') where exists (select 1 from cron.job where jobname = 'smartstock-ai-insights');
select cron.schedule('smartstock-ai-insights', '30 2 * * *', 'select ai.refresh_all_insights()');
