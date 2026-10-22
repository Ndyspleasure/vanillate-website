-- ════════════════════════════════════════════════════════════════════════════
--  Rollback 📣 Share Server (supabase/share-server.sql).
--  Hanya untuk keadaan darurat & atas persetujuan pemilik: MENGHAPUS kotak
--  masuk vote, status, dan riwayat permintaan dashboard. Data utama Share
--  Server tetap aman di SQLite bot. Jalankan manual di SQL Editor.
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'share-server-prune';
  end if;
end $$;

drop function if exists public.share_prune();
drop function if exists public.share_request_submit(text, text, text, jsonb);
drop function if exists public.share_dashboard_get(text, text);
drop table if exists public.share_requests;
drop table if exists public.share_guild_state;
drop table if exists public.share_topgg_votes;
