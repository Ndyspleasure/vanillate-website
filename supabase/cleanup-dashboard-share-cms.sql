-- ════════════════════════════════════════════════════════════════════════════
-- PEMBERSIHAN PROYEK CMS (lvfwopnvvqncopvathop): sisa dashboard + Share Server
-- lama dan tabel bot_games. DESTRUKTIF. Jangan terapkan tanpa konfirmasi owner.
-- Alasan:
--   PLAN-001: dashboard (guild_*) dan Share Server (share_*) sudah pindah ke
--   proyek Database Bot sejak 2026-11-03; sisa di sini tidak dipakai lagi.
--   MINOR-012: bot_games tidak dipakai sejak V3 (Game Monitor memakai snapshot
--   `games`).
-- TIDAK disentuh: bot_guilds (tetap dipakai CMS), bot_panel_snapshots, bot_commands.
-- Edge Function `dashboard-discord` dan `topgg-webhook` di proyek CMS dihapus
-- lewat dashboard Supabase (SQL tidak bisa), SETELAH migrasi ini.
--
-- Keselamatan:
--   * SEMUANYA satu pernyataan DO (atomik): pengaman gagal = tidak ada yang
--     dihapus, walau dijalankan dengan `psql -f` tanpa ON_ERROR_STOP.
--   * Pengaman: sesi harus menyetel lebih dulu
--         select set_config('vanillate.confirm_cleanup', 'yes', false);
--   * Cadangan DI DALAM database: tiap tabel disalin ke skema
--     `cleanup_backup_20261121` (tertutup untuk anon dan authenticated) SEBELUM
--     dihapus. Backup Kontrol Server di CMS adalah backup Database Bot, BUKAN
--     CMS, jadi jangan diandalkan untuk migrasi ini.
--   * Pulihkan: lihat cleanup-dashboard-share-cms-rollback.sql. Definisi fungsi
--     ada di riwayat git (guild-dashboard-schema.sql, share-server.sql).
--   * Setelah stabil (≥ 7 hari), skema cadangan boleh dihapus:
--         drop schema cleanup_backup_20261121 cascade;
-- ════════════════════════════════════════════════════════════════════════════

do $cleanup$
declare
  r record;
  t text;
  tabel text[] := array[
    'guild_config_audit', 'guild_feature_config', 'guild_channel_config', 'guild_config',
    'guild_feature_registry', 'guild_discord_snapshot', 'guild_dashboard_access',
    'guild_dashboard_tokens', 'guild_dashboard_bot_state',
    'share_requests', 'share_guild_state', 'share_topgg_votes',
    'bot_games'
  ];
begin
  if coalesce(current_setting('vanillate.confirm_cleanup', true), '') <> 'yes' then
    raise exception 'Pembersihan dibatalkan: setel vanillate.confirm_cleanup = yes dengan konfirmasi owner';
  end if;

  -- 1. Cadangan di dalam database (skema tertutup).
  create schema if not exists cleanup_backup_20261121;
  revoke all on schema cleanup_backup_20261121 from public, anon, authenticated;
  foreach t in array tabel loop
    if to_regclass('public.' || t) is not null then
      execute format('create table if not exists cleanup_backup_20261121.%I as table public.%I', t, t);
      execute format('revoke all on cleanup_backup_20261121.%I from public, anon, authenticated', t);
    end if;
  end loop;

  -- 2. Jadwal pg_cron retensi Share Server (bila ada).
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'share-server-prune';
  end if;

  -- 3. Fungsi guild_* dan share_* di skema public (semua tanda tangan).
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and (p.proname like 'guild\_%' or p.proname like 'share\_%')
  loop
    execute format('drop function if exists %s cascade', r.sig);
  end loop;

  -- 4. Tabel (cadangan sudah dibuat di langkah 1).
  foreach t in array tabel loop
    execute format('drop table if exists public.%I cascade', t);
  end loop;
end
$cleanup$;
