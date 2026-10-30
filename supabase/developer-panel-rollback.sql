-- ════════════════════════════════════════════════════════════════════════════
--  ROLLBACK — Panel Developer (V3). Membatalkan supabase/developer-panel-settings.sql
--  (bagian 5) lalu supabase/developer-panel-schema.sql (bagian 4–1).
--
--  Jalankan HANYA bila bot sudah dikembalikan ke versi yang memakai /developer
--  (< v3.0.0). Bot v3 butuh semua objek di bawah; menghapusnya membuat Panel
--  Developer di /admin kosong dan perintah `sys.*` tidak lagi dijaga database.
--
--  Catatan:
--    • Kosongkan bucket bot-backups LEBIH DULU lewat Supabase Dashboard →
--      Storage (Supabase menolak penghapusan langsung dari storage.objects).
--      Isinya salinan database — unduh dulu bila masih dibutuhkan.
--    • Kolom progress/heartbeat_at di bot_commands ikut dibuang; riwayat
--      perintah lainnya tetap utuh.
-- ════════════════════════════════════════════════════════════════════════════

-- 5. Setting & kategori baru (developer-panel-settings.sql)
delete from public.bot_settings
 where key in ('discord_announcement_title', 'changelog_lobby_enabled',
               'tutorial_enabled', 'tutorial_gate_new', 'dm_campaign_per_day',
               'onboarding_channel_enabled', 'onboarding_nudge_enabled', 'onboarding_channel_existing',
               'guild_members_intent');
delete from public.bot_setting_categories where key in ('tutorial', 'campaign', 'onboarding');

-- 4. Bucket backup
drop policy if exists owner_baca_bot_backups on storage.objects;
drop policy if exists owner_hapus_bot_backups on storage.objects;
delete from storage.buckets where id = 'bot-backups';   -- gagal bila bucket belum dikosongkan

-- 3. Penjaga owner
drop trigger if exists bot_commands_owner_guard on public.bot_commands;
drop function if exists public.bot_commands_owner_guard();

-- 2. Kolom tugas panjang
alter table public.bot_commands drop column if exists heartbeat_at;
alter table public.bot_commands drop column if exists progress;

-- 1. Snapshot panel
drop table if exists public.bot_panel_snapshots;
