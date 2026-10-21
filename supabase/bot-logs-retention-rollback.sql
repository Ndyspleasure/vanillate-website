-- ════════════════════════════════════════════════════════════════════════════
--  ROLLBACK — Retensi log bot (supabase/bot-logs-retention.sql).
--  Mencabut jadwal harian & fungsi pembersih. Log yang SUDAH terhapus tidak
--  bisa dikembalikan. Ekstensi pg_cron dibiarkan (bisa dipakai job lain).
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $sql$select cron.unschedule(jobid) from cron.job where jobname = 'prune-bot-logs-30d'$sql$;
  end if;
end;
$$;

drop function if exists public.prune_bot_logs(integer);
