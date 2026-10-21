-- ════════════════════════════════════════════════════════════════════════════
--  Retensi log bot: `bot_logs` lebih tua dari 30 hari DIHAPUS PERMANEN.
--
--  Bot tidak lagi menulis file log di mesinnya (sambung-kata-bot, LOG_FILE_ENABLED
--  bawaan mati); semua log dipantau di CMS (/admin/logs, Live Log) dari tabel ini.
--  Migrasi ini menggantikan langkah manual "Rawat volume log" di
--  docs/ADMIN-CMS.md dengan jadwal harian di database.
--
--  Aditif & idempoten (aman dijalankan ulang):
--    1. public.prune_bot_logs(p_days) — hapus baris > p_days hari, kembalikan
--       jumlah terhapus. Hanya service_role / postgres yang boleh memanggil.
--    2. pg_cron: job `prune-bot-logs-30d` tiap hari 19.17 UTC (02.17 WIB).
--       cron.schedule dengan nama yang sama memperbarui job, bukan menduplikasi.
--       Bila pg_cron tidak tersedia (mis. Postgres lokal untuk tes), jadwal
--       dilewati dengan NOTICE — fungsi tetap terpasang.
--  Rollback: supabase/bot-logs-retention-rollback.sql
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Fungsi pembersih
create or replace function public.prune_bot_logs(p_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if p_days is null or p_days < 1 then
    raise exception 'prune_bot_logs: p_days minimal 1 (diberi %)', p_days;
  end if;
  delete from public.bot_logs
   where created_at < now() - make_interval(days => p_days);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.prune_bot_logs(integer) from public;
revoke all on function public.prune_bot_logs(integer) from anon, authenticated;
grant execute on function public.prune_bot_logs(integer) to service_role;

-- 2. Jadwal harian (pg_cron)
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    execute $sql$select cron.schedule('prune-bot-logs-30d', '17 19 * * *',
                                      'select public.prune_bot_logs(30)')$sql$;
  else
    raise notice 'pg_cron tidak tersedia — jadwal prune-bot-logs-30d tidak dipasang';
  end if;
end;
$$;
