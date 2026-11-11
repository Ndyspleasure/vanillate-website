-- Rollback announcement-buttons.sql (hanya baris yang ditambahkan berkas itu).
delete from public.bot_settings where key in (
  'discord_announcement_button1_label', 'discord_announcement_button1_url',
  'discord_announcement_button2_label', 'discord_announcement_button2_url');
