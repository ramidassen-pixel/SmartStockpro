-- SmartStock Pro — nightly database backups (works on the Supabase Free plan)
-- Every night at 02:00 UTC (02:00 in Liberia) a copy of every table in `public` is stored
-- in the private `backup` schema, and copies older than 30 days are removed.
-- The `backup` schema is not exposed through the API: the app and the internet cannot read it.

create schema if not exists backup;
revoke all on schema backup from public, anon, authenticated;

create table if not exists backup.snapshots (
  id         bigserial primary key,
  taken_at   timestamptz not null default now(),
  table_name text        not null,
  row_count  integer     not null,
  data       jsonb       not null
);
create index if not exists snapshots_taken_at_idx on backup.snapshots (taken_at);
create index if not exists snapshots_table_idx on backup.snapshots (table_name, taken_at);
revoke all on all tables in schema backup from public, anon, authenticated;
revoke all on all sequences in schema backup from public, anon, authenticated;

-- Take one snapshot of every table in public; returns what was saved.
create or replace function backup.take_snapshot(keep_days integer default 30)
returns table (table_name text, row_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  t     record;
  stamp timestamptz := now();
begin
  for t in
    select c.relname
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  loop
    execute format(
      'insert into backup.snapshots (taken_at, table_name, row_count, data)
       select $1, %L, count(*), coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x',
      t.relname, t.relname)
    using stamp;
  end loop;

  delete from backup.snapshots s where s.taken_at < now() - make_interval(days => keep_days);

  return query
    select s.table_name, s.row_count from backup.snapshots s where s.taken_at = stamp order by s.table_name;
end;
$$;
revoke all on function backup.take_snapshot(integer) from public, anon, authenticated;

-- List the backups that exist (one row per night).
create or replace view backup.available as
  select taken_at, count(*) as tables, sum(row_count) as total_rows,
         pg_catalog.pg_size_pretty(sum(pg_catalog.pg_column_size(data))::bigint) as size
  from backup.snapshots
  group by taken_at
  order by taken_at desc;
revoke all on backup.available from public, anon, authenticated;

-- Put records of one table back as they were at a backup time.
-- Rows in the backup are inserted, or overwritten if they still exist (matched by primary key).
-- Rows created after the backup are NOT deleted. Example:
--   select backup.restore_table('biz_sales', (select max(taken_at) from backup.snapshots));
create or replace function backup.restore_table(p_table text, p_taken_at timestamptz)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  snap     jsonb;
  pk_cols  text;
  all_cols text;
  set_cols text;
  n        integer;
begin
  select s.data into snap from backup.snapshots s
  where s.table_name = p_table and s.taken_at = p_taken_at;
  if snap is null then
    raise exception 'No backup of % at %', p_table, p_taken_at;
  end if;

  select string_agg(format('%I', a.attname), ', ' order by a.attnum) into pk_cols
  from pg_catalog.pg_index i
  join pg_catalog.pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
  where i.indrelid = format('public.%I', p_table)::regclass and i.indisprimary;
  if pk_cols is null then
    raise exception 'Table % has no primary key; restore it manually', p_table;
  end if;

  select string_agg(format('%I', a.attname), ', ' order by a.attnum),
         string_agg(format('%I = excluded.%I', a.attname, a.attname), ', ' order by a.attnum)
           filter (where not (a.attname = any (string_to_array(replace(pk_cols, '"', ''), ', '))))
    into all_cols, set_cols
  from pg_catalog.pg_attribute a
  where a.attrelid = format('public.%I', p_table)::regclass and a.attnum > 0 and not a.attisdropped
    and a.attgenerated = '';

  execute format(
    'insert into public.%I as t (%s) select %s from jsonb_populate_recordset(null::public.%I, $1) on conflict (%s) do %s',
    p_table, all_cols, all_cols, p_table, pk_cols,
    case when set_cols is null then 'nothing' else 'update set ' || set_cols end)
  using snap;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function backup.restore_table(text, timestamptz) from public, anon, authenticated;

-- Schedule: every night at 02:00 UTC, keep 30 days (re-running this replaces the job)
select cron.schedule('smartstock-nightly-backup', '0 2 * * *', $$select backup.take_snapshot(30)$$);
