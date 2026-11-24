-- Scanned paper receipts
-- 1) A private "receipts" storage bucket: each business can only add and see photos in its own folder
--    (<business_id>/<sale_id>.jpg). Photos are kept as proof of the paper receipt behind a sale.
-- 2) record_sale keeps a small "scan" record on sales that came from a scanned receipt:
--    the photo path, the number and total written on the paper, how many lines the AI was unsure about,
--    and that the staff member confirmed they checked it. Everything else about saving a sale is unchanged.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists own_biz_receipts_select on storage.objects;
create policy own_biz_receipts_select on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = my_business_id());
drop policy if exists own_biz_receipts_insert on storage.objects;
create policy own_biz_receipts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = my_business_id());
-- Only the business owner may remove a receipt photo (staff can't delete the proof)
drop policy if exists owner_receipts_delete on storage.objects;
create policy owner_receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = my_admin_business_id());

-- Only known, size-limited fields are kept from what the device sends
create or replace function public._scan_meta(p jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select case when p is null or jsonb_typeof(p) is distinct from 'object' then '{}'::jsonb else jsonb_build_object('scan', jsonb_strip_nulls(jsonb_build_object(
    'source', 'receipt_photo',
    'photo', case when coalesce(p->>'photo', '') ~ '^[A-Za-z0-9_\-]+/[A-Za-z0-9_\-]+\.(jpg|png|webp)$' then p->>'photo' end,
    'receiptNo', left(nullif(trim(coalesce(p->>'receiptNo', '')), ''), 40),
    'writtenTotal', case when coalesce(p->>'writtenTotal', '') ~ '^\d+(\.\d+)?$' then (p->>'writtenTotal')::numeric end,
    'unsureLines', case when coalesce(p->>'unsureLines', '') ~ '^\d{1,3}$' then (p->>'unsureLines')::int end,
    'confirmed', coalesce((p->>'confirmed')::boolean, false),
    'model', left(nullif(p->>'model', ''), 80)
  ))) end
$$;
revoke all on function public._scan_meta(jsonb) from public, anon;
grant execute on function public._scan_meta(jsonb) to authenticated;

-- record_sale: the one change is that a scanned sale carries its "scan" record.
-- (Edited in place from the live definition so nothing else about the function changes.)
do $mig$
declare d text; n text;
begin
  d := pg_get_functiondef('public.record_sale(jsonb)'::regprocedure);
  if position('_scan_meta' in d) > 0 then return; end if;
  n := replace(d, $x$'createdAt', v_date, 'serverChecked', true);$x$,
                  $x$'createdAt', v_date, 'serverChecked', true) || public._scan_meta(p_sale->'scan');$x$);
  if n = d then raise exception 'record_sale did not have the expected shape; not changed'; end if;
  execute n;
end $mig$;
