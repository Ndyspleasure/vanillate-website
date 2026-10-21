-- ════════════════════════════════════════════════════════════════════════════
--  Tes retensi log bot (supabase/bot-logs-retention.sql).
--  Dijalankan oleh scripts/test-guild-dashboard-sql.sh (suite ketiga) di atas
--  Postgres lokal + supabase-stub.sql + bot-logs-retention-prereq.sql.
--  Cakupan: hapus > 30 hari, yang lebih baru tetap, argumen tidak sah ditolak,
--  hak panggil (anon/authenticated ditolak, service_role boleh), idempoten.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
set client_min_messages = notice;

do $$
declare
  n integer;
begin
  delete from public.bot_logs;
  insert into public.bot_logs (event, message, created_at) values
    ('tes', 'lama 45 hari', now() - interval '45 days'),
    ('tes', 'lama 31 hari', now() - interval '31 days'),
    ('tes', 'baru 29 hari', now() - interval '29 days'),
    ('tes', 'baru sekarang', now());

  n := public.prune_bot_logs(30);
  if n <> 2 then raise exception 'GAGAL: harus menghapus 2 baris, terhapus %', n; end if;
  if (select count(*) from public.bot_logs) <> 2 then raise exception 'GAGAL: 2 baris baru harus tetap'; end if;
  if exists (select 1 from public.bot_logs where created_at < now() - interval '30 days') then
    raise exception 'GAGAL: masih ada baris > 30 hari';
  end if;
  raise notice 'ok - baris > 30 hari terhapus, yang baru tetap';

  if public.prune_bot_logs(30) <> 0 then raise exception 'GAGAL: panggilan kedua harus 0'; end if;
  raise notice 'ok - idempoten';

  begin
    perform public.prune_bot_logs(0);
    raise exception 'GAGAL: p_days 0 harus ditolak';
  exception when raise_exception then
    if sqlerrm like 'GAGAL%' then raise; end if;
  end;
  raise notice 'ok - p_days < 1 ditolak';

  if has_function_privilege('anon', 'public.prune_bot_logs(integer)', 'execute') then
    raise exception 'GAGAL: anon tidak boleh memanggil prune_bot_logs';
  end if;
  if has_function_privilege('authenticated', 'public.prune_bot_logs(integer)', 'execute') then
    raise exception 'GAGAL: authenticated tidak boleh memanggil prune_bot_logs';
  end if;
  if not has_function_privilege('service_role', 'public.prune_bot_logs(integer)', 'execute') then
    raise exception 'GAGAL: service_role harus boleh memanggil prune_bot_logs';
  end if;
  raise notice 'ok - hak panggil: hanya service_role';
end;
$$;

select 'LULUS - retensi log bot';
