-- ════════════════════════════════════════════════════════════════════════════
-- PEMBERSIHAN PROYEK CMS (lvfwopnvvqncopvathop): sisa dashboard + Share Server
-- lama dan tabel bot_games. DESTRUKTIF. Jangan terapkan sebelum:
--   1. backup CMS dibuat (CMS › Kontrol Server › Backup, atau pg_dump),
--   2. owner mengonfirmasi.
-- Alasan:
--   PLAN-001: dashboard (guild_*) dan Share Server (share_*) sudah pindah ke
--   proyek Database Bot sejak 2026-11-03; sisa di sini tidak dipakai lagi.
--   MINOR-012: bot_games tidak dipakai sejak V3 (Game Monitor memakai snapshot
--   `games`).
-- TIDAK disentuh: bot_guilds (tetap dipakai CMS), bot_panel_snapshots, bot_commands.
-- Edge Function `dashboard-discord` dan `topgg-webhook` di proyek CMS dihapus
-- lewat dashboard Supabase (SQL tidak bisa), SETELAH migrasi ini.
-- Pengaman: skrip berhenti kecuali sesi ini menyetel
--     select set_config('vanillate.confirm_cleanup', 'yes', false);
-- Rollback: tidak ada data yang bisa dipulihkan selain dari backup. Skema lama
-- tersedia di riwayat git (supabase/guild-dashboard-schema.sql, share-server.sql).
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  r record;
begin
  if coalesce(current_setting('vanillate.confirm_cleanup', true), '') <> 'yes' then
    raise exception 'Pembersihan dibatalkan: setel vanillate.confirm_cleanup = yes setelah backup dan konfirmasi owner';
  end if;

  -- Jadwal pg_cron retensi Share Server (bila ada).
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'share-server-prune';
  end if;

  -- Fungsi guild_* dan share_* di skema public (semua tanda tangan).
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and (p.proname like 'guild\_%' or p.proname like 'share\_%')
  loop
    execute format('drop function if exists %s cascade', r.sig);
  end loop;
end $$;

drop table if exists public.guild_config_audit        cascade;
drop table if exists public.guild_feature_config      cascade;
drop table if exists public.guild_channel_config      cascade;
drop table if exists public.guild_config              cascade;
drop table if exists public.guild_feature_registry    cascade;
drop table if exists public.guild_discord_snapshot    cascade;
drop table if exists public.guild_dashboard_access    cascade;
drop table if exists public.guild_dashboard_tokens    cascade;
drop table if exists public.guild_dashboard_bot_state cascade;
drop table if exists public.share_requests            cascade;
drop table if exists public.share_guild_state         cascade;
drop table if exists public.share_topgg_votes         cascade;

drop table if exists public.bot_games cascade;
