-- ════════════════════════════════════════════════════════════════════════════
--  PANEL DEVELOPER (V3) — setting baru di /admin/kontrol.
--
--  Jalankan SETELAH supabase/developer-panel-schema.sql DAN setelah website v3
--  live. Halaman Kontrol versi lama menyimpan SEMUA field saat Simpan, sehingga
--  baris baru bernilai NULL di bawah ini akan tertimpa nilai kosong/false —
--  halaman v3 hanya menulis field yang benar-benar diubah. Urutan terhadap bot
--  bebas: bot v3 mengadopsi nilai lokalnya ke baris NULL pada polling
--  berikutnya, kapan pun baris ini muncul; bot lama mengabaikannya.
--
--  Aman dijalankan berulang (idempoten). Murni ADITIF — `on conflict do nothing`
--  tidak pernah menimpa nilai yang sudah ada.
--  Pemulihan: bagian 5 di supabase/developer-panel-rollback.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- Setting baru di /admin/kontrol (pengganti toggle di /developer)
-- ───────────────────────────────────────────────────────────────────────────
-- value NULL = belum pernah disinkronkan: bot mengisinya dengan nilai lokal
-- yang sedang berlaku saat pertama kali menarik setting, jadi pemasangan
-- migrasi ini tidak pernah mengubah perilaku bot. Sesudah itu panel otoritatif.
insert into public.bot_setting_categories (key, label, description, icon, sort) values
  ('tutorial', 'Tutorial Pemain Baru', 'Gerbang wajib tutorial bagi pemain baru dan pemain yang tertinggal versi.', 'book', 60),
  ('campaign', 'DM Campaign',          'Pengingat DM otomatis untuk pemain yang lama tidak bermain.',               'mail', 70)
on conflict (key) do nothing;

insert into public.bot_settings (key, label, value, kind, category, help, min_value, max_value, sort) values
  ('discord_announcement_title', 'Judul pengumuman Discord', null, 'text', 'pengumuman',
   'Judul embed pengumuman di lobby. Kosong = “📢 Pengumuman”.', null, null, 15),
  ('changelog_lobby_enabled', 'Tampilkan changelog di lobby', null, 'boolean', 'pengumuman',
   'Hanya tampil/sembunyi. Isi changelog tetap otomatis dari CHANGELOG.json bot.', null, null, 40),
  ('tutorial_enabled', 'Gerbang wajib tutorial', null, 'boolean', 'tutorial',
   'Pemain baru wajib menyelesaikan tutorial sebelum bermain.', null, null, 10),
  ('tutorial_gate_new', 'Gerbang materi baru', null, 'boolean', 'tutorial',
   'Pemain yang tertinggal versi tutorial diminta mengerjakan materi barunya.', null, null, 20),
  ('dm_campaign_per_day', 'Jumlah DM per hari', null, 'number', 'campaign',
   'Berapa pemain tidak aktif yang diingatkan lewat DM setiap hari.', 1, 50, 10)
on conflict (key) do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- 🧭 Onboarding konfigurasi sosial (bot: src/social/onboarding, sejak v3.5)
-- ───────────────────────────────────────────────────────────────────────────
-- Bawaan bot MATI; baris NULL diisi bot dengan nilai lokalnya (false), jadi
-- memasang bagian ini tidak menyalakan apa pun. Owner menyalakannya di sini.
insert into public.bot_setting_categories (key, label, description, icon, sort) values
  ('onboarding', 'Onboarding Server', 'Pengingat owner & admin server untuk mengatur fitur sosial (Counting & Streak Harian).', 'toggle', 80)
on conflict (key) do nothing;

insert into public.bot_settings (key, label, value, kind, category, help, min_value, max_value, sort) values
  ('onboarding_channel_enabled', 'Channel #konfigurasi-vanillate', null, 'boolean', 'onboarding',
   'Server yang baru mengundang bot (sejak setting ini pertama dinyalakan) dibuatkan channel panduan berisi status setup & mention owner/admin. Dipulihkan maks. 2× bila dihapus sebelum setup selesai.', null, null, 10),
  ('onboarding_nudge_enabled', 'Sapaan owner & admin', null, 'boolean', 'onboarding',
   'Pesan "Hei, ada waktu?" (hanya terlihat oleh owner/admin) setelah mereka memakai command, selama fitur sosial servernya belum diputuskan. Maks. sekali per 24 jam, berhenti setelah 3×.', null, null, 20),
  ('onboarding_channel_existing', 'Channel juga untuk server lama', null, 'boolean', 'onboarding',
   'Server lama (bergabung sebelum channel dinyalakan) yang setupnya belum selesai ikut dibuatkan channel #konfigurasi-vanillate, dicicil ±18 server per jam. Hanya berlaku bila setting channel juga menyala.', null, null, 30)
on conflict (key) do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- 🔑 Intent Server Members (bot: src/utils/intents.js)
-- ───────────────────────────────────────────────────────────────────────────
-- Bawaan MATI: bot berjalan penuh tanpa intent privileged ini. Baris NULL diisi
-- bot dengan nilai lokalnya (false), jadi memasang bagian ini tidak mengubah
-- apa pun. Berlaku pada restart berikutnya (intent hanya dikirim saat login).
insert into public.bot_settings (key, label, value, kind, category, help, min_value, max_value, sort) values
  ('guild_members_intent', 'Intent Server Members', null, 'boolean', 'fitur',
   'Bawaan MATI — bot berjalan penuh tanpa intent ini. Nyalakan HANYA setelah mengaktifkan "Server Members Intent" di Discord Developer Portal, lalu Restart bot (berlaku saat bot login). Bila Discord menolak, bot otomatis restart tanpa intent dan setting ini kembali OFF. Tanpa intent, Verification hanya memakai Verified Role (member yang keluar tidak terdeteksi).', null, null, 90)
on conflict (key) do nothing;
