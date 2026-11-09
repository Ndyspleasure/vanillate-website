-- ════════════════════════════════════════════════════════════════════════════
--  ROLLBACK — Ringkasan statistik bot (supabase/bot-stats-rollup.sql).
--  Mencabut jadwal harian & fungsi peringkas. Baris bot_stats yang SUDAH
--  diringkas (dihapus) tidak bisa dikembalikan. Ekstensi pg_cron dibiarkan.
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $sql$select cron.unschedule(jobid) from cron.job where jobname = 'rollup-bot-stats-hourly'$sql$;
  end if;
end;
$$;

drop function if exists public.rollup_bot_stats(integer);
