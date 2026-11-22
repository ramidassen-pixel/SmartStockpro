-- SmartStock Pro — AI agent, Phase 2: the two functions the agent uses to read the ai.* views.
--
--  public.ai_query(spec jsonb)  — a structured, read-only query: pick a view, filters, a date range,
--                                 grouping and totals. The AI never writes SQL: the query is built
--                                 here from checked names (format %I) and quoted values (format %L).
--  public.ai_snapshot()         — headline figures and data-quality notes, in one call.
--
-- Both run as the caller (security invoker), so row-level security keeps each user to their own
-- business. Anonymous visitors cannot call them.

-- Which column holds the date for each view (used for date_from / date_to and day/week/month grouping)
create or replace function ai.date_column(v text) returns text
language sql immutable set search_path = '' as $$
  select case v
    when 'sales' then 'sale_date'          when 'sale_items' then 'sale_date'
    when 'payments' then 'paid_date'       when 'stock_movements' then 'move_date'
    when 'expenses' then 'expense_date'    when 'allocations' then 'start_date'
    when 'supplier_bills' then 'bill_date' when 'purchase_orders' then 'order_date'
    when 'grns' then 'received_date'       when 'grn_items' then 'received_date'
    when 'quotations' then 'quote_date'    when 'payroll' then 'paid_date'
    when 'daily_summary' then 'day'        when 'customers' then 'last_purchase'
  end
$$;

create or replace function public.ai_query(spec jsonb) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_view   text := spec->>'view';
  v_cols   jsonb;            -- {column: type} of the view
  v_datecol text;
  v_where  text[] := array['true'];
  v_group  text[] := '{}';   -- expressions
  v_gsel   text[] := '{}';   -- "expr as alias"
  v_galias text[] := '{}';
  v_msel   text[] := '{}';
  v_malias text[] := '{}';
  v_sel    text;
  v_order  text := '';
  v_limit  int := least(greatest(coalesce((spec->>'limit')::int, 25), 1), 200);
  v_sql    text;
  v_rows   jsonb;
  v_total  bigint;
  v_totals jsonb;
  f jsonb; g text; m jsonb; o jsonb;
  c text; op text; val text; typ text; expr text; alias text; fn text;
begin
  -- 1) The view must exist in schema ai
  if v_view is null or not exists (select 1 from pg_catalog.pg_views where schemaname = 'ai' and viewname = v_view) then
    raise exception 'Unknown view "%". Use one of: %', coalesce(v_view, ''),
      (select string_agg(viewname, ', ' order by viewname) from pg_catalog.pg_views where schemaname = 'ai');
  end if;
  select jsonb_object_agg(a.attname, pg_catalog.format_type(a.atttypid, a.atttypmod)) into v_cols
  from pg_catalog.pg_attribute a
  where a.attrelid = ('ai.' || quote_ident(v_view))::regclass and a.attnum > 0 and not a.attisdropped;
  v_datecol := ai.date_column(v_view);

  -- 2) Date range on the view's date column
  if spec ? 'date_from' or spec ? 'date_to' then
    if v_view = 'monthly_pnl' then
      if spec->>'date_from' is not null then v_where := v_where || format('month >= %L', left(spec->>'date_from', 7)); end if;
      if spec->>'date_to'   is not null then v_where := v_where || format('month <= %L', left(spec->>'date_to', 7)); end if;
    elsif v_datecol is null then
      raise exception 'View "%" has no date column; remove date_from/date_to', v_view;
    else
      if spec->>'date_from' is not null then v_where := v_where || format('%I >= %L::date', v_datecol, spec->>'date_from'); end if;
      if spec->>'date_to'   is not null then v_where := v_where || format('%I <= %L::date', v_datecol, spec->>'date_to'); end if;
    end if;
  end if;

  -- 3) Filters: [{column, op, value}]
  for f in select * from jsonb_array_elements(coalesce(spec->'filters', '[]')) loop
    c := f->>'column'; op := coalesce(f->>'op', 'eq'); val := f->>'value';
    typ := v_cols->>c;
    if typ is null then raise exception 'Unknown column "%" in view "%". Columns: %', c, v_view, (select string_agg(k, ', ') from jsonb_object_keys(v_cols) k); end if;
    if op = 'contains' then
      v_where := v_where || format('%I::text ilike %L', c, '%' || coalesce(val, '') || '%');
    elsif op = 'is_null' then
      v_where := v_where || format('%I is null', c);
    elsif op = 'not_null' then
      v_where := v_where || format('%I is not null', c);
    elsif op = 'in' then
      if jsonb_typeof(f->'value') <> 'array' then raise exception 'op "in" needs an array value'; end if;
      if typ = 'text' then
        v_where := v_where || format('lower(%I) in (%s)', c, (select string_agg(format('lower(%L)', x), ',') from jsonb_array_elements_text(f->'value') x));
      else
        v_where := v_where || format('%I in (%s)', c, (select string_agg(format('%L::%s', x, typ), ',') from jsonb_array_elements_text(f->'value') x));
      end if;
    elsif op in ('eq', 'neq', 'gt', 'gte', 'lt', 'lte') then
      if val is null then raise exception 'Filter on "%" needs a value', c; end if;
      expr := case op when 'eq' then '=' when 'neq' then '<>' when 'gt' then '>' when 'gte' then '>=' when 'lt' then '<' else '<=' end;
      if typ = 'text' and op in ('eq', 'neq') then
        v_where := v_where || format('lower(%I) %s lower(%L)', c, expr, val);
      else
        v_where := v_where || format('%I %s %L::%s', c, expr, val, typ);
      end if;
    else
      raise exception 'Unknown filter op "%" (use eq, neq, gt, gte, lt, lte, contains, in, is_null, not_null)', op;
    end if;
  end loop;

  -- 4) Grouping: column names, or day / week / month / year / weekday of the date column
  for g in select * from jsonb_array_elements_text(coalesce(spec->'group_by', '[]')) loop
    if g in ('day', 'week', 'month', 'year', 'weekday') and v_cols->>g is null then
      if v_datecol is null then raise exception 'View "%" has no date column to group by %', v_view, g; end if;
      expr := case g
        when 'day'     then format('%I', v_datecol)
        when 'week'    then format('date_trunc(''week'', %I)::date', v_datecol)
        when 'month'   then format('to_char(%I, ''YYYY-MM'')', v_datecol)
        when 'year'    then format('to_char(%I, ''YYYY'')', v_datecol)
        else format('to_char(%I, ''FMDay'')', v_datecol) end;
      alias := case g when 'week' then 'week_starting' else g end;
    elsif v_cols ? g then
      expr := format('%I', g); alias := g;
    else
      raise exception 'Cannot group by "%" in view "%"', g, v_view;
    end if;
    v_group := v_group || expr; v_gsel := v_gsel || format('%s as %I', expr, alias); v_galias := v_galias || alias;
  end loop;

  -- 5) Metrics: [{fn: count|sum|avg|min|max|count_distinct, column}]
  for m in select * from jsonb_array_elements(coalesce(spec->'metrics', '[]')) loop
    fn := coalesce(m->>'fn', 'count'); c := m->>'column';
    if fn = 'count' and c is null then
      expr := 'count(*)'; alias := 'count';
    else
      if c is null or v_cols->>c is null then raise exception 'Metric % needs a valid column of view "%"', fn, v_view; end if;
      expr := case fn
        when 'sum' then format('round(coalesce(sum(%I), 0)::numeric, 2)', c)
        when 'avg' then format('round(avg(%I)::numeric, 2)', c)
        when 'min' then format('min(%I)', c)
        when 'max' then format('max(%I)', c)
        when 'count' then format('count(%I)', c)
        when 'count_distinct' then format('count(distinct %I)', c)
        else null end;
      if expr is null then raise exception 'Unknown metric fn "%"', fn; end if;
      alias := fn || '_' || c;
    end if;
    v_msel := v_msel || format('%s as %I', expr, alias); v_malias := v_malias || alias;
  end loop;

  if array_length(v_group, 1) is not null and array_length(v_msel, 1) is null then
    v_msel := array['count(*) as count']; v_malias := array['count'];
  end if;

  -- 6) What to select
  if array_length(v_group, 1) is not null or array_length(v_msel, 1) is not null then
    v_sel := array_to_string(v_gsel || v_msel, ', ');
  elsif jsonb_typeof(spec->'columns') = 'array' and jsonb_array_length(spec->'columns') > 0 then
    select string_agg(format('%I', x), ', ') into v_sel from jsonb_array_elements_text(spec->'columns') x;
    for c in select * from jsonb_array_elements_text(spec->'columns') loop
      if v_cols->>c is null then raise exception 'Unknown column "%" in view "%"', c, v_view; end if;
    end loop;
  else
    select string_agg(format('%I', k), ', ') into v_sel from jsonb_object_keys(v_cols) k where k <> 'business_id';
  end if;

  -- 7) Order: [{column, dir}] — a column, a group alias or a metric alias
  for o in select * from jsonb_array_elements(coalesce(spec->'order_by', '[]')) loop
    c := o->>'column';
    if not (c = any(v_galias) or c = any(v_malias) or (array_length(v_group, 1) is null and array_length(v_msel, 1) is null and v_cols ? c)) then
      raise exception 'Cannot order by "%"', c;
    end if;
    v_order := v_order || case when v_order = '' then '' else ', ' end
               || format('%I %s nulls last', c, case when lower(o->>'dir') = 'asc' then 'asc' else 'desc' end);
  end loop;
  if v_order = '' then
    if array_length(v_group, 1) is not null then
      v_order := case when v_galias[1] in ('day', 'week_starting', 'month', 'year') then format('%I desc', v_galias[1])
                      else format('%I desc nulls last', v_malias[1]) end;
    elsif array_length(v_msel, 1) is null and v_datecol is not null then
      v_order := format('%I desc nulls last', v_datecol);
    end if;
  end if;

  -- 8) Run it
  v_sql := format('select %s from ai.%I where %s', v_sel, v_view, array_to_string(v_where, ' and '));
  if array_length(v_group, 1) is not null then v_sql := v_sql || ' group by ' || array_to_string(v_group, ', '); end if;
  execute format('select count(*) from (%s) q', v_sql) into v_total;
  if v_order <> '' then v_sql := v_sql || ' order by ' || v_order; end if;
  v_sql := v_sql || format(' limit %s', v_limit);
  execute format('select coalesce(jsonb_agg(to_jsonb(q)), ''[]'') from (%s) q', v_sql) into v_rows;

  -- Grand totals of the metrics across all matching rows (when grouped)
  if array_length(v_group, 1) is not null then
    execute format('select to_jsonb(q) from (select %s from ai.%I where %s) q',
                   array_to_string(v_msel, ', '), v_view, array_to_string(v_where, ' and ')) into v_totals;
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'view', v_view, 'date_column', v_datecol,
    'date_from', spec->>'date_from', 'date_to', spec->>'date_to',
    (case when array_length(v_group, 1) is not null then 'groups' else 'matching_rows' end), v_total,
    'returned', jsonb_array_length(v_rows),
    'more_not_shown', v_total > jsonb_array_length(v_rows),
    'totals', v_totals,
    'rows', v_rows));
end $$;

-- Headline figures + what the data can't answer. Dates are the server's (UTC = Liberia time).
create or replace function public.ai_snapshot() returns jsonb
language sql stable security invoker set search_path = '' as $$
  with d as (
    select current_date t, date_trunc('month', current_date)::date m0,
           (date_trunc('month', current_date) - interval '1 month')::date lm0,
           (date_trunc('month', current_date) - interval '1 day')::date lm1
  ), s as (select * from ai.sales), e as (select * from ai.expenses),
  p as (select * from ai.products where status <> 'inactive')
  select jsonb_build_object(
    'business', (select to_jsonb(b) - 'business_id' from ai.business b limit 1),
    'today', (select t from d),
    'sales', jsonb_build_object(
      'today',      (select jsonb_build_object('invoices', count(*), 'total', round(coalesce(sum(total), 0), 2)) from s, d where sale_date = d.t),
      'this_month', (select jsonb_build_object('invoices', count(*), 'total', round(coalesce(sum(total), 0), 2), 'collected', round(coalesce(sum(amount_paid), 0), 2)) from s, d where sale_date >= d.m0),
      'last_month', (select jsonb_build_object('invoices', count(*), 'total', round(coalesce(sum(total), 0), 2)) from s, d where sale_date between d.lm0 and d.lm1),
      'all_time',   (select jsonb_build_object('invoices', count(*), 'total', round(coalesce(sum(total), 0), 2)) from s)),
    'owed_by_customers', (select round(coalesce(sum(balance), 0), 2) from s),
    'expenses', jsonb_build_object(
      'this_month', (select round(coalesce(sum(amount), 0), 2) from e, d where expense_date >= d.m0),
      'last_month', (select round(coalesce(sum(amount), 0), 2) from e, d where expense_date between d.lm0 and d.lm1)),
    'stock', (select jsonb_build_object('products', count(*), 'units', coalesce(sum(qty), 0),
                     'value_at_cost', round(coalesce(sum(stock_value_cost), 0), 2), 'value_at_price', round(coalesce(sum(stock_value_price), 0), 2),
                     'low', count(*) filter (where stock_state = 'low'), 'out', count(*) filter (where stock_state = 'out')) from p),
    'customers', (select count(*) from ai.customers),
    'owed_to_suppliers', (select round(coalesce(sum(balance), 0), 2) from ai.suppliers),
    'payment_methods_used', (select jsonb_agg(distinct payment_group) from s),
    'data_notes', (select to_jsonb(q) - 'business_id' from ai.data_quality q limit 1)
  )
$$;

revoke all on function public.ai_query(jsonb), public.ai_snapshot() from public, anon;
grant execute on function public.ai_query(jsonb), public.ai_snapshot() to authenticated, service_role;
revoke all on function ai.date_column(text) from public, anon;
grant execute on function ai.date_column(text) to authenticated, service_role;
