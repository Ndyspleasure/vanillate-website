-- ════════════════════════════════════════════════════════════════════════════
--  PENGUMUMAN DISCORD: ephemeral atau publik — sakelar di /admin/kontrol
--  (bot: src/services/announcement.js)
--
--  Sejak PR bot #246 pengumuman Discord tidak lagi di lobby, tetapi menyusul di
--  bawah konten setiap slash command. Sakelar ini menentukan apakah pengumuman
--  itu ephemeral (hanya terlihat pemanggil command) atau publik di channel.
--  Sifat pesan utama ditentukan command masing-masing, jadi kombinasi apa pun
--  sah (utama publik + pengumuman ephemeral, atau sebaliknya).
--
--  Murni ADITIF dan idempoten. Bawaan NYALA (ephemeral, value 'true').
--  Pemulihan: delete from bot_settings where key = 'discord_announcement_ephemeral';
-- ════════════════════════════════════════════════════════════════════════════

insert into public.bot_settings (key, label, value, kind, category, help, min_value, max_value, sort) values
  ('discord_announcement_ephemeral', 'Pengumuman hanya terlihat pemanggil', 'true', 'boolean', 'pengumuman',
   'Pengumuman tampil di bawah konten setiap slash command. Nyala: ephemeral, hanya pemain yang memakai command yang melihatnya. Mati: publik, semua orang di channel melihatnya, jadi channel bisa ramai bila banyak yang memakai command.', null, null, 25)
on conflict (key) do nothing;
