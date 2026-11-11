-- Rollback announcement-help-text.sql (mengembalikan teks bantuan lama).
update public.bot_settings
   set help = 'Menampilkan pengumuman di Lobby/embed bot.'
 where key = 'discord_announcement_enabled'
   and help = 'Menampilkan pengumuman di bawah konten slash command.';

update public.bot_settings
   set help = 'Judul embed pengumuman di lobby. Kosong = “📢 Pengumuman”.'
 where key = 'discord_announcement_title'
   and help = 'Judul kartu pengumuman. Kosong = “📢 Pengumuman”.';
