-- ════════════════════════════════════════════════════════════════════════════
--  VANILLATE ACTIVITY — sakelar global di /admin/kontrol
--  (bot: src/activity/status.js + activity/gateway, acuan docs/discord-activity.md
--   di repo bot, PLAN-018)
--
--  `activity_enabled` : sakelar global Vanillate Activity (game di dalam Discord).
--    Bawaan MATI ('false', fail-closed). Bot membaca nilai ini lewat penarik
--    setelan yang sudah ada (tiap 60 detik), lalu menulis berkas status lokal
--    untuk gateway Activity. Selama mati, Activity menolak sesi baru dan menutup
--    koneksi yang sedang berjalan dengan pesan penjelasan.
--
--  Murni ADITIF dan idempoten (`on conflict do nothing`). Tidak ada tabel baru,
--  tidak ada polling baru, tidak ada query tambahan dari Activity.
--  Pemulihan: supabase/activity-rollback.sql
-- ════════════════════════════════════════════════════════════════════════════

insert into public.bot_setting_categories (key, label, description, icon, sort) values
  ('activity', 'Vanillate Activity', 'Game yang dimainkan langsung di dalam Discord (Embedded App). Masih tahap uji tim.', 'toggle', 88)
on conflict (key) do nothing;

insert into public.bot_settings (key, label, value, kind, category, help, min_value, max_value, sort) values
  ('activity_enabled', 'Vanillate Activity', 'false', 'boolean', 'activity',
   'Bawaan MATI. Menyalakan membuka lobby Vanillate Activity bagi siapa pun yang bisa meluncurkan Activity (saat ini hanya tim developer, karena Activity belum didistribusikan). Mematikan menutup semua lobby yang sedang berjalan dengan pesan penjelasan. Berlaku 1 sampai 2 menit tanpa restart. Tidak menambah query database.', null, null, 10)
on conflict (key) do nothing;
