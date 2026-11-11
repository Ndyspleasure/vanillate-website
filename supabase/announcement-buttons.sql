-- ════════════════════════════════════════════════════════════════════════════
--  PENGUMUMAN DISCORD: tombol link — setelan di /admin/kontrol
--  (bot: src/services/announcement.js, PR bot #246)
--
--  Sampai 2 tombol link di bawah pengumuman. Tombol hanya tampil bila label
--  terisi DAN URL diawali https://. Kosong = tanpa tombol.
--
--  Murni ADITIF dan idempoten. Bawaan kosong (tidak mengubah tampilan apa pun).
--  Pemulihan: announcement-buttons-rollback.sql
-- ════════════════════════════════════════════════════════════════════════════

insert into public.bot_settings (key, label, value, kind, category, help, min_value, max_value, sort) values
  ('discord_announcement_button1_label', 'Tombol pengumuman 1: label', '', 'text', 'pengumuman',
   'Teks tombol link pertama, maksimal 80 karakter (boleh memakai emoji). Kosong = tombol tidak tampil.', null, null, 26),
  ('discord_announcement_button1_url', 'Tombol pengumuman 1: tautan', '', 'url', 'pengumuman',
   'Tautan tombol pertama. Harus diawali https://.', null, null, 27),
  ('discord_announcement_button2_label', 'Tombol pengumuman 2: label', '', 'text', 'pengumuman',
   'Teks tombol link kedua, maksimal 80 karakter (boleh memakai emoji). Kosong = tombol tidak tampil.', null, null, 28),
  ('discord_announcement_button2_url', 'Tombol pengumuman 2: tautan', '', 'url', 'pengumuman',
   'Tautan tombol kedua. Harus diawali https://.', null, null, 29)
on conflict (key) do nothing;
