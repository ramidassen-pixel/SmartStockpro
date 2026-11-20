-- SmartStock Pro — Rebuild step 1: proper tables for sales, stock and invoice numbers.
-- Lives in its own schema `core`, which is NOT exposed through the API: the current app keeps
-- using the biz_* tables untouched. core is filled from a copy of the current data and checked
-- against it before any part of the app switches over.

create schema if not exists core;
revoke all on schema core from public, anon, authenticated;

-- ── Tables ──────────────────────────────────────────────────────────────────
create table if not exists core.products (
  id           text primary key,
  business_id  text not null references public.platform_businesses(id) on delete cascade,
  name         text not null,
  sku          text,
  barcode      text,
  category     text,
  unit         text,
  description  text,
  price        numeric(14,2) not null default 0 check (price >= 0),
  cost         numeric(14,2) not null default 0 check (cost >= 0),
  qty          numeric(14,3) not null default 0,
  low_level    numeric(14,3) not null default 5,
  status       text not null default 'active',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted      boolean not null default false
);
create index if not exists products_biz_idx on core.products (business_id) where not deleted;

create table if not exists core.customers (
  id           text primary key,
  business_id  text not null references public.platform_businesses(id) on delete cascade,
  name         text not null,
  phone        text,
  email        text,
  address      text,
  status       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted      boolean not null default false
);
create index if not exists customers_biz_idx on core.customers (business_id) where not deleted;

create table if not exists core.sales (
  id              text primary key,
  business_id     text not null references public.platform_businesses(id) on delete cascade,
  invoice_no      text not null,
  sale_date       date not null,
  customer_id     text references core.customers(id),
  customer_name   text not null default 'Walk-in Customer',
  customer_phone  text,
  subtotal        numeric(14,2) not null check (subtotal >= 0),
  discount_type   text not null default 'percent' check (discount_type in ('percent','amount')),
  discount_value  numeric(14,2) not null default 0 check (discount_value >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  total           numeric(14,2) not null check (total >= 0),
  amount_paid     numeric(14,2) not null default 0 check (amount_paid >= 0),
  balance         numeric(14,2) not null default 0 check (balance >= 0),
  status          text not null check (status in ('Paid','Partial','Credit')),
  payment_method  text,
  notes           text,
  created_by      text,
  created_by_name text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted         boolean not null default false,
  -- the money must add up
  constraint sales_total_ok   check (abs(total - (subtotal - discount_amount)) < 0.01),
  constraint sales_balance_ok check (abs(balance - (total - amount_paid)) < 0.01)
);
-- an invoice number can only be used once per business
create unique index if not exists sales_invoice_no_uq on core.sales (business_id, invoice_no);
create index if not exists sales_biz_date_idx on core.sales (business_id, sale_date) where not deleted;

create table if not exists core.sale_items (
  id          bigserial primary key,
  sale_id     text not null references core.sales(id) on delete cascade,
  business_id text not null,
  line_no     integer not null,
  product_id  text references core.products(id),   -- null when the product was deleted later
  product_name text not null,
  qty         numeric(14,3) not null check (qty > 0),
  unit_price  numeric(14,2) not null check (unit_price >= 0),
  unit_cost   numeric(14,2) not null default 0 check (unit_cost >= 0),
  unique (sale_id, line_no)
);
create index if not exists sale_items_product_idx on core.sale_items (product_id);

create table if not exists core.payments (
  id             text primary key,
  business_id    text not null references public.platform_businesses(id) on delete cascade,
  sale_id        text references core.sales(id),     -- null when its invoice was deleted
  legacy_sale_id text,                                -- the original invoice id, always kept
  customer_id    text,
  amount         numeric(14,2) not null check (amount > 0),
  method         text,
  note           text,
  paid_at        timestamptz not null default now(),
  deleted        boolean not null default false
);
create index if not exists payments_sale_idx on core.payments (sale_id);

create table if not exists core.stock_movements (
  id          text primary key,
  business_id text not null references public.platform_businesses(id) on delete cascade,
  product_id  text references core.products(id),
  product_name text,
  type        text not null,            -- sale, restock, adjustment, return, ...
  qty         numeric(14,3) not null,   -- negative = out, positive = in
  qty_before  numeric(14,3),
  qty_after   numeric(14,3),
  ref_type    text,
  ref_id      text,
  note        text,
  created_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists stock_mv_product_idx on core.stock_movements (product_id, created_at);

create table if not exists core.invoice_counters (
  business_id text primary key references public.platform_businesses(id) on delete cascade,
  prefix      text not null default '',
  next_number integer not null default 1 check (next_number > 0),
  pad         integer not null default 3 check (pad between 1 and 10),
  updated_at  timestamptz not null default now()
);

-- Locked down: nothing in core is reachable through the API yet
alter table core.products         enable row level security;
alter table core.customers        enable row level security;
alter table core.sales            enable row level security;
alter table core.sale_items       enable row level security;
alter table core.payments         enable row level security;
alter table core.stock_movements  enable row level security;
alter table core.invoice_counters enable row level security;
revoke all on all tables in schema core from public, anon, authenticated;
revoke all on all sequences in schema core from public, anon, authenticated;

-- ── Helpers ─────────────────────────────────────────────────────────────────
create or replace function core._ts(t text) returns timestamptz
language plpgsql immutable set search_path = '' as $$
begin
  return nullif(t, '')::timestamptz;
exception when others then return null;
end $$;

-- Next invoice number for a business, atomically (two devices can never get the same one)
create or replace function core.next_invoice_no(p_business_id text) returns text
language plpgsql security definer set search_path = '' as $$
declare v text; n int;
begin
  insert into core.invoice_counters (business_id) values (p_business_id) on conflict do nothing;
  loop
    update core.invoice_counters set next_number = next_number + 1, updated_at = now()
      where business_id = p_business_id
      returning prefix || lpad((next_number - 1)::text, pad, '0'), next_number - 1 into v, n;
    -- skip numbers already used (e.g. typed by hand or imported)
    exit when not exists (select 1 from core.sales s where s.business_id = p_business_id and s.invoice_no = v);
  end loop;
  return v;
end $$;

-- ── Record a sale in ONE step: invoice number, stock, items, payment ───────
-- p_sale: { id?, invoice_no?, date, customer_id?, customer_name?, customer_phone?,
--           items:[{product_id?, name, qty, price, cost?}], discount_type, discount_value,
--           payment_method, amount_paid (null = full payment unless Credit), notes,
--           created_by, created_by_name, allow_negative_stock? }
create or replace function core.record_sale(p_business_id text, p_sale jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id text := coalesce(nullif(p_sale->>'id', ''), 'INV-' || upper(to_hex((extract(epoch from clock_timestamp())*1000)::bigint)) || upper(substr(md5(random()::text), 1, 3)));
  v_no text := nullif(trim(coalesce(p_sale->>'invoice_no', '')), '');
  v_items jsonb := coalesce(p_sale->'items', '[]'::jsonb);
  v_sub numeric := 0; v_disc numeric := 0; v_total numeric; v_paid numeric; v_bal numeric;
  v_type text := case when p_sale->>'discount_type' = 'amount' then 'amount' else 'percent' end;
  v_dval numeric := greatest(coalesce((p_sale->>'discount_value')::numeric, 0), 0);
  v_method text := coalesce(nullif(p_sale->>'payment_method', ''), 'Cash');
  v_status text; it jsonb; i int := 0; v_prod core.products%rowtype; v_q numeric;
  v_allow_neg boolean := coalesce((p_sale->>'allow_negative_stock')::boolean, false);
begin
  -- the caller may only write to their own business (when called through the API later)
  if auth.uid() is not null and p_business_id is distinct from public.my_business_id() then
    raise exception 'Not allowed for this business' using errcode = '42501';
  end if;
  if jsonb_array_length(v_items) = 0 then raise exception 'A sale needs at least one item'; end if;

  -- totals are worked out here, not trusted from the device
  for it in select * from jsonb_array_elements(v_items) loop
    v_sub := v_sub + round((it->>'qty')::numeric * (it->>'price')::numeric, 2);
  end loop;
  v_disc := case when v_type = 'amount' then least(v_dval, v_sub) else round(v_sub * least(v_dval, 100) / 100, 2) end;
  v_total := v_sub - v_disc;
  v_paid := case when p_sale->>'amount_paid' is null or p_sale->>'amount_paid' = ''
                 then (case when v_method = 'Credit' then 0 else v_total end)
                 else least(greatest((p_sale->>'amount_paid')::numeric, 0), v_total) end;
  v_bal := v_total - v_paid;
  v_status := case when v_bal <= 0.005 then 'Paid' when v_paid > 0 then 'Partial' else 'Credit' end;

  if v_no is null then v_no := core.next_invoice_no(p_business_id); end if;

  insert into core.sales (id, business_id, invoice_no, sale_date, customer_id, customer_name, customer_phone,
    subtotal, discount_type, discount_value, discount_amount, total, amount_paid, balance, status,
    payment_method, notes, created_by, created_by_name)
  values (v_id, p_business_id, v_no, coalesce((p_sale->>'date')::date, current_date),
    nullif(p_sale->>'customer_id', ''), coalesce(nullif(p_sale->>'customer_name', ''), 'Walk-in Customer'),
    nullif(p_sale->>'customer_phone', ''), v_sub, v_type, v_dval, v_disc, v_total, v_paid, v_bal, v_status,
    v_method, p_sale->>'notes', p_sale->>'created_by', p_sale->>'created_by_name');

  for it in select * from jsonb_array_elements(v_items) loop
    i := i + 1;
    v_q := (it->>'qty')::numeric;
    v_prod := null;
    if nullif(it->>'product_id', '') is not null then
      -- lock the product row: a second device selling the same item waits here, then sees the new qty
      select * into v_prod from core.products
        where id = it->>'product_id' and business_id = p_business_id and not deleted for update;
      if not found then raise exception 'Product % not found', it->>'product_id'; end if;
      if v_prod.qty < v_q and not v_allow_neg then
        raise exception 'Not enough stock for %: % left, % requested', v_prod.name, v_prod.qty, v_q
          using errcode = 'P0001';
      end if;
      update core.products set qty = qty - v_q, updated_at = now() where id = v_prod.id;
      insert into core.stock_movements (id, business_id, product_id, product_name, type, qty, qty_before, qty_after, ref_type, ref_id, created_by)
        values ('MV-' || v_id || '-' || i, p_business_id, v_prod.id, v_prod.name, 'sale', -v_q, v_prod.qty, v_prod.qty - v_q, 'sale', v_id, p_sale->>'created_by');
    end if;
    insert into core.sale_items (sale_id, business_id, line_no, product_id, product_name, qty, unit_price, unit_cost)
      values (v_id, p_business_id, i, v_prod.id, coalesce(v_prod.name, it->>'name', 'Item'), v_q,
              (it->>'price')::numeric, coalesce((it->>'cost')::numeric, v_prod.cost, 0));
  end loop;

  if v_paid > 0 then
    insert into core.payments (id, business_id, sale_id, legacy_sale_id, customer_id, amount, method, note)
      values ('PAY-' || v_id, p_business_id, v_id, v_id, nullif(p_sale->>'customer_id', ''), v_paid, v_method, 'Initial payment');
  end if;

  return jsonb_build_object('id', v_id, 'invoice_no', v_no, 'total', v_total, 'status', v_status, 'balance', v_bal);
end $$;

-- ── Copy one business's current data into core (safe to re-run) ─────────────
create or replace function core.import_business(p_business_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  delete from core.payments        where business_id = p_business_id;
  delete from core.stock_movements where business_id = p_business_id;
  delete from core.sale_items      where business_id = p_business_id;
  delete from core.sales           where business_id = p_business_id;
  delete from core.customers       where business_id = p_business_id;
  delete from core.products        where business_id = p_business_id;

  insert into core.products (id, business_id, name, sku, barcode, category, unit, description, price, cost, qty, low_level, status, created_at, updated_at, deleted)
  select b.id, b.business_id, coalesce(nullif(b.data->>'name',''), 'Unnamed product'), b.data->>'sku', b.data->>'barcode', b.data->>'category', b.data->>'unit',
         coalesce(b.data->>'description', b.data->>'desc'),
         coalesce((b.data->>'price')::numeric, 0), coalesce((b.data->>'cost')::numeric, 0), coalesce((b.data->>'qty')::numeric, 0),
         coalesce((b.data->>'lowLevel')::numeric, 5), coalesce(b.data->>'status', 'active'),
         coalesce(core._ts(b.data->>'createdAt'), b.updated_at), b.updated_at, b.deleted
  from public.biz_products b where b.business_id = p_business_id;

  insert into core.customers (id, business_id, name, phone, email, address, status, created_at, updated_at, deleted)
  select b.id, b.business_id, coalesce(nullif(b.data->>'name',''), 'Unnamed customer'), b.data->>'phone', b.data->>'email', b.data->>'address', b.data->>'status',
         coalesce(core._ts(b.data->>'createdAt'), b.updated_at), b.updated_at, b.deleted
  from public.biz_customers b where b.business_id = p_business_id;

  insert into core.sales (id, business_id, invoice_no, sale_date, customer_id, customer_name, customer_phone, subtotal,
    discount_type, discount_value, discount_amount, total, amount_paid, balance, status, payment_method, notes,
    created_by, created_by_name, created_at, updated_at, deleted)
  select b.id, b.business_id, coalesce(nullif(b.data->>'invoiceNo',''), b.id), (b.data->>'date')::date,
         case when exists (select 1 from core.customers c where c.id = b.data->>'customerId') then b.data->>'customerId' end,
         coalesce(nullif(b.data->>'customer',''), 'Walk-in Customer'), b.data->>'customerPhone',
         (b.data->>'subtotal')::numeric,
         coalesce(b.data->>'discountType', 'percent'),
         coalesce((b.data->>'discountValue')::numeric, (b.data->>'discount')::numeric, 0),
         coalesce((b.data->>'discountAmount')::numeric, round((b.data->>'subtotal')::numeric * coalesce((b.data->>'discount')::numeric, 0) / 100, 2)),
         (b.data->>'total')::numeric, (b.data->>'amountPaid')::numeric, (b.data->>'balance')::numeric,
         coalesce(b.data->>'status', 'Paid'), b.data->>'payment', b.data->>'notes', b.data->>'createdBy', b.data->>'createdByName',
         coalesce(core._ts(b.data->>'createdAt'), b.updated_at), b.updated_at, b.deleted
  from public.biz_sales b where b.business_id = p_business_id;

  insert into core.sale_items (sale_id, business_id, line_no, product_id, product_name, qty, unit_price, unit_cost)
  select b.id, b.business_id, it.ord::int,
         case when exists (select 1 from core.products p where p.id = it.e->>'id') then it.e->>'id' end,
         coalesce(nullif(it.e->>'name',''), 'Item'), (it.e->>'qty')::numeric, coalesce((it.e->>'price')::numeric, 0), coalesce((it.e->>'cost')::numeric, 0)
  from public.biz_sales b, jsonb_array_elements(b.data->'items') with ordinality it(e, ord)
  where b.business_id = p_business_id and jsonb_typeof(b.data->'items') = 'array';

  insert into core.payments (id, business_id, sale_id, legacy_sale_id, customer_id, amount, method, note, paid_at, deleted)
  select b.id, b.business_id,
         case when exists (select 1 from core.sales s where s.id = b.data->>'saleId') then b.data->>'saleId' end,
         b.data->>'saleId', b.data->>'customerId', (b.data->>'amount')::numeric, b.data->>'method', b.data->>'note',
         coalesce(core._ts(b.data->>'paidAt'), b.updated_at), b.deleted
  from public.biz_payments b where b.business_id = p_business_id and coalesce((b.data->>'amount')::numeric, 0) > 0;

  insert into core.stock_movements (id, business_id, product_id, product_name, type, qty, qty_before, qty_after, ref_type, ref_id, note, created_by, created_at)
  select b.id, b.business_id,
         case when exists (select 1 from core.products p where p.id = b.data->>'productId') then b.data->>'productId' end,
         b.data->>'productName', coalesce(b.data->>'type', 'adjustment'), (b.data->>'qty')::numeric,
         (b.data->>'qtyBefore')::numeric, (b.data->>'qtyAfter')::numeric, b.data->>'refType', null, b.data->>'note', b.data->>'createdBy',
         coalesce(core._ts(b.data->>'createdAt'), b.updated_at)
  from public.biz_stock_movements b where b.business_id = p_business_id and not b.deleted;

  select jsonb_build_object(
    'products', (select count(*) from core.products where business_id = p_business_id),
    'customers', (select count(*) from core.customers where business_id = p_business_id),
    'sales', (select count(*) from core.sales where business_id = p_business_id),
    'sale_items', (select count(*) from core.sale_items where business_id = p_business_id),
    'payments', (select count(*) from core.payments where business_id = p_business_id),
    'stock_movements', (select count(*) from core.stock_movements where business_id = p_business_id)) into r;
  return r;
end $$;

-- ── Compare core with what the current app shows ────────────────────────────
create or replace function core.compare_with_app(p_business_id text)
returns table (check_name text, current_app numeric, new_tables numeric, matches boolean)
language sql security definer set search_path = '' as $$
  with app_s as (select data d from public.biz_sales where business_id = p_business_id and not deleted),
       new_s as (select * from core.sales where business_id = p_business_id and not deleted),
       app_p as (select id, data d from public.biz_products where business_id = p_business_id and not deleted),
       rows(check_name, current_app, new_tables) as (
    select 'Invoices (count)', (select count(*) from app_s)::numeric, (select count(*) from new_s)::numeric
    union all select 'Sales total, all time', (select coalesce(sum((d->>'total')::numeric),0) from app_s), (select coalesce(sum(total),0) from new_s)
    union all select 'Money collected', (select coalesce(sum((d->>'amountPaid')::numeric),0) from app_s), (select coalesce(sum(amount_paid),0) from new_s)
    union all select 'Customer debt (balances)', (select coalesce(sum((d->>'balance')::numeric),0) from app_s), (select coalesce(sum(balance),0) from new_s)
    union all select 'Discounts given', (select coalesce(sum(coalesce((d->>'discountAmount')::numeric, (d->>'subtotal')::numeric*coalesce((d->>'discount')::numeric,0)/100)),0) from app_s), (select coalesce(sum(discount_amount),0) from new_s)
    union all select 'Sales this month', (select coalesce(sum((d->>'total')::numeric),0) from app_s where left(d->>'date',7) = to_char(current_date,'YYYY-MM')), (select coalesce(sum(total),0) from new_s where date_trunc('month', sale_date) = date_trunc('month', current_date))
    union all select 'Item lines', (select coalesce(sum(jsonb_array_length(d->'items')),0) from app_s), (select count(*) from core.sale_items i join new_s on new_s.id = i.sale_id)
    union all select 'Products (count)', (select count(*) from app_p)::numeric, (select count(*) from core.products where business_id = p_business_id and not deleted)::numeric
    union all select 'Units in stock', (select coalesce(sum((d->>'qty')::numeric),0) from app_p), (select coalesce(sum(qty),0) from core.products where business_id = p_business_id and not deleted)
    union all select 'Stock value at cost', (select coalesce(sum((d->>'qty')::numeric*(d->>'cost')::numeric),0) from app_p), (select coalesce(sum(qty*cost),0) from core.products where business_id = p_business_id and not deleted)
    union all select 'Payments (amount)', (select coalesce(sum((data->>'amount')::numeric),0) from public.biz_payments where business_id = p_business_id and not deleted), (select coalesce(sum(amount),0) from core.payments where business_id = p_business_id and not deleted)
  )
  select check_name, round(current_app, 2), round(new_tables, 2), abs(current_app - new_tables) < 0.01 from rows;
$$;

revoke all on all functions in schema core from public, anon, authenticated;
