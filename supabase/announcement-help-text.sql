-- ════════════════════════════════════════════════════════════════════════════
--  PENGUMUMAN DISCORD: koreksi teks bantuan (PR bot #246)
--
--  Pengumuman tidak lagi tampil di lobby, tetapi di bawah konten setiap slash
--  command. Hanya kolom `help` dua baris ini yang berubah; nilai setelan tidak.
--  Idempoten: hanya menimpa bila teks masih persis teks lama.
--  Pemulihan: announcement-help-text-rollback.sql
-- ════════════════════════════════════════════════════════════════════════════

update public.bot_settings
   set help = 'Menampilkan pengumuman di bawah konten slash command.'
 where key = 'discord_announcement_enabled'
   and help = 'Menampilkan pengumuman di Lobby/embed bot.';

update public.bot_settings
   set help = 'Judul kartu pengumuman. Kosong = “📢 Pengumuman”.'
 where key = 'discord_announcement_title'
   and help = 'Judul embed pengumuman di lobby. Kosong = “📢 Pengumuman”.';
