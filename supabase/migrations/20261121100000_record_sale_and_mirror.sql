-- SmartStock Pro — Rebuild step 2: New Sale goes through the server.
-- 1) public.record_sale: one transaction that checks + reduces stock, guarantees a unique invoice
--    number and writes the sale, payment and stock movement in the format the current app reads.
-- 2) Mirroring: every write to the current biz_* tables (from any screen) is copied into `core`,
--    so the new tables always match. A mirroring problem is logged and never blocks the app.

create table if not exists core.sync_errors (
  id bigserial primary key, at timestamptz not null default now(),
  table_name text, row_id text, error text
);
alter table core.sync_errors enable row level security;
revoke all on core.sync_errors from public, anon, authenticated;

-- Deleted invoices no longer reserve their number
drop index if exists core.sales_invoice_no_uq;
create unique index if not exists sales_invoice_no_uq on core.sales (business_id, invoice_no) where not deleted;

create or replace function core.next_invoice_no(p_business_id text) returns text
language plpgsql security definer set search_path = '' as $$
declare v text; n int;
begin
  insert into core.invoice_counters (business_id) values (p_business_id) on conflict do nothing;
  loop
    update core.invoice_counters set next_number = next_number + 1, updated_at = now()
      where business_id = p_business_id
      returning prefix || lpad((next_number - 1)::text, pad, '0'), next_number - 1 into v, n;
    exit when not exists (select 1 from core.sales s where s.business_id = p_business_id and s.invoice_no = v and not s.deleted)
          and not exists (select 1 from public.biz_sales b where b.business_id = p_business_id and not b.deleted
                          and (b.data->>'invoiceNo' = v or b.id = v));
  end loop;
  return v;
end $$;
revoke all on function core.next_invoice_no(text) from public, anon, authenticated;

-- ── Per-row mirror functions (same mapping as core.import_business) ─────────
create or replace function core._mirror_product(b public.biz_products) returns void
language sql security definer set search_path = '' as $$
  insert into core.products (id, business_id, name, sku, barcode, category, unit, description, price, cost, qty, low_level, status, created_at, updated_at, deleted)
  values (b.id, b.business_id, coalesce(nullif(b.data->>'name',''), 'Unnamed product'), b.data->>'sku', b.data->>'barcode', b.data->>'category', b.data->>'unit',
          coalesce(b.data->>'description', b.data->>'desc'), coalesce((b.data->>'price')::numeric, 0), coalesce((b.data->>'cost')::numeric, 0),
          coalesce((b.data->>'qty')::numeric, 0), coalesce((b.data->>'lowLevel')::numeric, 5), coalesce(b.data->>'status', 'active'),
          coalesce(core._ts(b.data->>'createdAt'), b.updated_at), b.updated_at, b.deleted)
  on conflict (id) do update set name = excluded.name, sku = excluded.sku, barcode = excluded.barcode, category = excluded.category,
    unit = excluded.unit, description = excluded.description, price = excluded.price, cost = excluded.cost, qty = excluded.qty,
    low_level = excluded.low_level, status = excluded.status, updated_at = excluded.updated_at, deleted = excluded.deleted;
$$;

create or replace function core._mirror_customer(b public.biz_customers) returns void
language sql security definer set search_path = '' as $$
  insert into core.customers (id, business_id, name, phone, email, address, status, created_at, updated_at, deleted)
  values (b.id, b.business_id, coalesce(nullif(b.data->>'name',''), 'Unnamed customer'), b.data->>'phone', b.data->>'email', b.data->>'address',
          b.data->>'status', coalesce(core._ts(b.data->>'createdAt'), b.updated_at), b.updated_at, b.deleted)
  on conflict (id) do update set name = excluded.name, phone = excluded.phone, email = excluded.email, address = excluded.address,
    status = excluded.status, updated_at = excluded.updated_at, deleted = excluded.deleted;
$$;

create or replace function core._mirror_sale(b public.biz_sales) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into core.sales (id, business_id, invoice_no, sale_date, customer_id, customer_name, customer_phone, subtotal,
    discount_type, discount_value, discount_amount, total, amount_paid, balance, status, payment_method, notes,
    created_by, created_by_name, created_at, updated_at, deleted)
  values (b.id, b.business_id, coalesce(nullif(b.data->>'invoiceNo',''), b.id), coalesce((b.data->>'date')::date, current_date),
    case when exists (select 1 from core.customers c where c.id = b.data->>'customerId') then b.data->>'customerId' end,
    coalesce(nullif(b.data->>'customer',''), 'Walk-in Customer'), b.data->>'customerPhone',
    coalesce((b.data->>'subtotal')::numeric, (b.data->>'total')::numeric, 0),
    coalesce(b.data->>'discountType', 'percent'),
    coalesce((b.data->>'discountValue')::numeric, (b.data->>'discount')::numeric, 0),
    coalesce((b.data->>'discountAmount')::numeric, round(coalesce((b.data->>'subtotal')::numeric,0) * coalesce((b.data->>'discount')::numeric, 0) / 100, 2)),
    coalesce((b.data->>'total')::numeric, 0), coalesce((b.data->>'amountPaid')::numeric, 0), coalesce((b.data->>'balance')::numeric, 0),
    coalesce(b.data->>'status', 'Paid'), b.data->>'payment', b.data->>'notes', b.data->>'createdBy', b.data->>'createdByName',
    coalesce(core._ts(b.data->>'createdAt'), b.updated_at), b.updated_at, b.deleted)
  on conflict (id) do update set invoice_no = excluded.invoice_no, sale_date = excluded.sale_date, customer_id = excluded.customer_id,
    customer_name = excluded.customer_name, customer_phone = excluded.customer_phone, subtotal = excluded.subtotal,
    discount_type = excluded.discount_type, discount_value = excluded.discount_value, discount_amount = excluded.discount_amount,
    total = excluded.total, amount_paid = excluded.amount_paid, balance = excluded.balance, status = excluded.status,
    payment_method = excluded.payment_method, notes = excluded.notes, updated_at = excluded.updated_at, deleted = excluded.deleted;

  delete from core.sale_items where sale_id = b.id;
  insert into core.sale_items (sale_id, business_id, line_no, product_id, product_name, qty, unit_price, unit_cost)
  select b.id, b.business_id, it.ord::int,
         case when exists (select 1 from core.products p where p.id = it.e->>'id') then it.e->>'id' end,
         coalesce(nullif(it.e->>'name',''), 'Item'), (it.e->>'qty')::numeric, coalesce((it.e->>'price')::numeric, 0), coalesce((it.e->>'cost')::numeric, 0)
  from jsonb_array_elements(case when jsonb_typeof(b.data->'items') = 'array' then b.data->'items' else '[]'::jsonb end) with ordinality it(e, ord)
  where coalesce((it.e->>'qty')::numeric, 0) > 0;
end $$;

create or replace function core._mirror_payment(b public.biz_payments) returns void
language sql security definer set search_path = '' as $$
  insert into core.payments (id, business_id, sale_id, legacy_sale_id, customer_id, amount, method, note, paid_at, deleted)
  select b.id, b.business_id,
         case when exists (select 1 from core.sales s where s.id = b.data->>'saleId') then b.data->>'saleId' end,
         b.data->>'saleId', b.data->>'customerId', (b.data->>'amount')::numeric, b.data->>'method', b.data->>'note',
         coalesce(core._ts(b.data->>'paidAt'), b.updated_at), b.deleted
  where coalesce((b.data->>'amount')::numeric, 0) > 0
  on conflict (id) do update set sale_id = excluded.sale_id, amount = excluded.amount, method = excluded.method,
    note = excluded.note, deleted = excluded.deleted;
$$;

create or replace function core._mirror_movement(b public.biz_stock_movements) returns void
language sql security definer set search_path = '' as $$
  insert into core.stock_movements (id, business_id, product_id, product_name, type, qty, qty_before, qty_after, ref_type, ref_id, note, created_by, created_at)
  select b.id, b.business_id,
         case when exists (select 1 from core.products p where p.id = b.data->>'productId') then b.data->>'productId' end,
         b.data->>'productName', coalesce(b.data->>'type', 'adjustment'), coalesce((b.data->>'qty')::numeric, 0),
         (b.data->>'qtyBefore')::numeric, (b.data->>'qtyAfter')::numeric, b.data->>'refType', b.data->>'refId', b.data->>'note', b.data->>'createdBy',
         coalesce(core._ts(b.data->>'createdAt'), b.updated_at)
  where not b.deleted
  on conflict (id) do nothing;
$$;

-- One trigger function for all five tables; never lets a mirroring error block the app's write
create or replace function core._on_biz_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare e text;
begin
  begin
    case tg_table_name
      when 'biz_products'        then perform core._mirror_product(new);
      when 'biz_customers'       then perform core._mirror_customer(new);
      when 'biz_sales'           then perform core._mirror_sale(new);
      when 'biz_payments'        then perform core._mirror_payment(new);
      when 'biz_stock_movements' then perform core._mirror_movement(new);
    end case;
  exception when others then
    get stacked diagnostics e = message_text;
    insert into core.sync_errors (table_name, row_id, error) values (tg_table_name, new.id, e);
  end;
  return new;
end $$;

drop trigger if exists trg_core_mirror on public.biz_products;
drop trigger if exists trg_core_mirror on public.biz_customers;
drop trigger if exists trg_core_mirror on public.biz_sales;
drop trigger if exists trg_core_mirror on public.biz_payments;
drop trigger if exists trg_core_mirror on public.biz_stock_movements;
create trigger trg_core_mirror after insert or update on public.biz_products        for each row execute function core._on_biz_change();
create trigger trg_core_mirror after insert or update on public.biz_customers       for each row execute function core._on_biz_change();
create trigger trg_core_mirror after insert or update on public.biz_sales           for each row execute function core._on_biz_change();
create trigger trg_core_mirror after insert or update on public.biz_payments        for each row execute function core._on_biz_change();
create trigger trg_core_mirror after insert or update on public.biz_stock_movements for each row execute function core._on_biz_change();

-- ── New Sale through the server ─────────────────────────────────────────────
-- p_sale: { id, invoice_no?, date, customer_id?, customer_name, customer_phone?, items:[{id?, name, qty, price, cost}],
--           discount_type, discount_value, payment_method, amount_paid (null = full unless Credit), notes, created_by_name }
-- Returns { sale, payment, products:[{id,data}], movements:[...] } in the app's own record format.
create or replace function public.record_sale(p_sale jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_biz   text := public.my_business_id();
  v_uid   text := auth.uid()::text;
  v_id    text := nullif(p_sale->>'id', '');
  v_no    text := nullif(trim(coalesce(p_sale->>'invoice_no', '')), '');
  v_items jsonb := coalesce(p_sale->'items', '[]'::jsonb);
  v_date  text := coalesce(nullif(p_sale->>'date', ''), to_char(current_date, 'YYYY-MM-DD'));
  v_now   text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_type  text := case when p_sale->>'discount_type' = 'amount' then 'amount' else 'percent' end;
  v_dval  numeric := greatest(coalesce((p_sale->>'discount_value')::numeric, 0), 0);
  v_method text := coalesce(nullif(p_sale->>'payment_method', ''), 'Cash');
  v_sub numeric := 0; v_disc numeric; v_total numeric; v_paid numeric; v_bal numeric; v_status text;
  it jsonb; i int := 0; v_q numeric; v_before numeric; v_after numeric;
  v_prod record; v_lines jsonb := '[]'::jsonb; v_prods jsonb := '[]'::jsonb; v_mvs jsonb := '[]'::jsonb;
  v_sale jsonb; v_pay jsonb := null; v_existing jsonb; v_pid text; v_pj jsonb; v_pname text;
begin
  if v_uid is null or v_biz is null then raise exception 'Please sign in again.' using errcode = '42501'; end if;
  if not exists (select 1 from public.platform_users u where u.id = v_uid and u.status = 'active') then
    raise exception 'Your account is not active yet, so it can''t record sales.' using errcode = '42501';
  end if;
  if v_id is null then raise exception 'Missing sale id'; end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then raise exception 'Add at least one product.'; end if;

  -- Same sale sent twice (e.g. the network dropped after saving): return what was saved, change nothing
  select data into v_existing from public.biz_sales where id = v_id and business_id = v_biz;
  if found then
    return jsonb_build_object('sale', v_existing || jsonb_build_object('id', v_id), 'payment', null, 'products', '[]'::jsonb, 'movements', '[]'::jsonb, 'repeat', true);
  end if;

  -- One sale at a time per business: invoice numbers and stock checks can't race
  perform pg_advisory_xact_lock(hashtext('record_sale:' || v_biz));

  -- Invoice number: the one typed (must be unused) or the next free one
  if v_no is not null then
    if exists (select 1 from public.biz_sales s where s.business_id = v_biz and not s.deleted
               and (s.data->>'invoiceNo' = v_no or s.id = v_no)) then
      raise exception 'Invoice No. % is already used. Change it and save again.', v_no using errcode = 'P0002';
    end if;
  else
    v_no := core.next_invoice_no(v_biz);
  end if;

  -- Stock: lock each product, refuse if there isn't enough, reduce it
  for it in select * from jsonb_array_elements(v_items) loop
    i := i + 1;
    v_q := coalesce((it->>'qty')::numeric, 0);
    if v_q <= 0 then raise exception 'Quantity must be more than 0 for %', coalesce(it->>'name', 'an item'); end if;
    v_sub := v_sub + round(v_q * coalesce((it->>'price')::numeric, 0), 2);
    v_pid := nullif(it->>'id', '');
    if v_pid is not null then
      select id, data into v_prod from public.biz_products where id = v_pid and business_id = v_biz and not deleted for update;
      if found then
        v_before := coalesce((v_prod.data->>'qty')::numeric, 0);
        if v_before < v_q then
          raise exception 'Not enough stock for %: only % left (you tried to sell %).', v_prod.data->>'name', v_before, v_q using errcode = 'P0001';
        end if;
        v_after := v_before - v_q;
        v_pname := v_prod.data->>'name';
        update public.biz_products set data = data || jsonb_build_object('qty', v_after, 'updatedAt', v_date), updated_at = now()
          where id = v_pid returning jsonb_build_object('id', id, 'data', data) into v_pj;
        v_prods := v_prods || jsonb_build_array(v_pj);
        v_mvs := v_mvs || jsonb_build_array(jsonb_build_object(
          'id', 'MV-' || v_id || '-' || i, 'productId', v_pid, 'productName', v_pname, 'type', 'sale',
          'qty', -v_q, 'qtyBefore', v_before, 'qtyAfter', v_after, 'refType', 'sale', 'refId', v_id,
          'customer', coalesce(nullif(p_sale->>'customer_name',''), 'Walk-in Customer'),
          'date', v_date, 'note', 'Invoice ' || v_no, 'createdBy', coalesce(p_sale->>'created_by_name', ''), 'createdAt', v_now));
      end if;
    end if;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('id', v_pid, 'name', it->>'name',
      'price', coalesce((it->>'price')::numeric, 0), 'cost', coalesce((it->>'cost')::numeric, 0), 'qty', v_q));
  end loop;

  -- Money is worked out here, not trusted from the device
  v_disc := case when v_type = 'amount' then least(v_dval, v_sub) else round(v_sub * least(v_dval, 100) / 100, 2) end;
  v_total := v_sub - v_disc;
  v_paid := case when p_sale->>'amount_paid' is null or p_sale->>'amount_paid' = ''
                 then (case when v_method = 'Credit' then 0 else v_total end)
                 else least(greatest((p_sale->>'amount_paid')::numeric, 0), v_total) end;
  v_bal := round(v_total - v_paid, 2);
  v_status := case when v_bal <= 0.005 then 'Paid' when v_paid > 0 then 'Partial' else 'Credit' end;
  if v_status = 'Paid' then v_paid := v_total; v_bal := 0; end if;

  v_sale := jsonb_build_object(
    'id', v_id, 'invoiceNo', v_no, 'customer', coalesce(nullif(p_sale->>'customer_name',''), 'Walk-in Customer'),
    'customerId', nullif(p_sale->>'customer_id', ''), 'customerPhone', coalesce(p_sale->>'customer_phone', ''),
    'items', v_lines, 'subtotal', v_sub,
    'discount', case when v_sub > 0 then round(v_disc / v_sub * 100, 2) else 0 end,
    'discountType', v_type, 'discountValue', v_dval, 'discountAmount', v_disc,
    'total', v_total, 'amountPaid', v_paid, 'balance', v_bal, 'payment', v_method, 'status', v_status,
    'date', v_date, 'notes', coalesce(p_sale->>'notes', ''), 'createdBy', v_uid,
    'createdByName', coalesce(p_sale->>'created_by_name', 'Unknown'), 'createdAt', v_date, 'serverChecked', true);
  insert into public.biz_sales (id, business_id, data, deleted) values (v_id, v_biz, v_sale, false);

  if v_paid > 0 then
    v_pay := jsonb_build_object('id', 'PAY-' || v_id, 'saleId', v_id, 'customerId', nullif(p_sale->>'customer_id', ''),
      'amount', v_paid, 'method', v_method, 'note', 'Initial payment', 'invoiceRef', v_id, 'paidAt', v_now);
    insert into public.biz_payments (id, business_id, data, deleted) values ('PAY-' || v_id, v_biz, v_pay, false);
  end if;

  insert into public.biz_stock_movements (id, business_id, data, deleted)
    select m->>'id', v_biz, m, false from jsonb_array_elements(v_mvs) m;

  return jsonb_build_object('sale', v_sale, 'payment', v_pay, 'products', v_prods, 'movements', v_mvs);
end $$;

revoke all on function public.record_sale(jsonb) from public, anon;
grant execute on function public.record_sale(jsonb) to authenticated;
