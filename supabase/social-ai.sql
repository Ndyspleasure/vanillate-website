-- ════════════════════════════════════════════════════════════════════════════
--  VANI (SOCIAL AI) — sakelar dan baseline kuota di /admin/kontrol
--  (bot: src/social/aichat, acuan docs/social-ai.md di repo bot)
--
--  `social_ai_enabled`  : sakelar global. Bawaan MATI ('false', fail-closed).
--    Selama mati, fitur Vani di Vanillate Dashboard tampil terkunci dengan
--    penjelasan dan bot tidak membaca pesan, tidak memanggil penyedia AI, dan
--    tidak menulis berkas kuota.
--  `social_ai_baseline` : titik awal kuota harian setelah bot kehilangan berkas
--    `data/social-ai-usage.json`. Format "<neuron>@<YYYY-MM-DD>[#tag]", mis.
--    "1200@2026-11-20#a". Kosong = tidak ada. Hanya diisi owner saat pemulihan.
--
--  Murni ADITIF dan idempoten (`on conflict do nothing`). Tidak ada tabel baru,
--  tidak ada polling baru: bot memakai penarik setelan yang sudah ada.
--  Pemulihan: delete from public.bot_settings
--             where key in ('social_ai_enabled', 'social_ai_baseline');
-- ════════════════════════════════════════════════════════════════════════════

insert into public.bot_setting_categories (key, label, description, icon, sort) values
  ('sosial', 'Sosial Hub', 'Aturan fitur Sosial Hub yang berlaku untuk semua server (Counting & Streak Harian).', 'toggle', 85)
on conflict (key) do nothing;

insert into public.bot_settings (key, label, value, kind, category, help, min_value, max_value, sort) values
  ('social_ai_enabled', 'Vani (teman ngobrol AI)', 'false', 'boolean', 'sosial',
   'Bawaan MATI. Menyalakan membuka opsi Vani di Vanillate Dashboard: admin server memilih satu channel, lalu setiap pesan member di channel itu dijawab. Pesan di channel lain tidak pernah dibaca. Mematikan menghapus semua sesi di memori dan mengunci opsi di dashboard dengan penjelasan. Berlaku 1 sampai 2 menit tanpa restart.', null, null, 20),
  ('social_ai_baseline', 'Baseline kuota Vani', null, 'text', 'sosial',
   'Hanya untuk pemulihan kuota harian bila berkas data bot hilang. Format "neuron@YYYY-MM-DD" (boleh ditambah "#tag" agar nilai yang sama dipakai ulang). Kosongkan bila tidak dipakai.', null, null, 30)
on conflict (key) do nothing;
