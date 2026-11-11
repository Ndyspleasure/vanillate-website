-- Rollback announcement-ephemeral.sql (hanya baris yang ditambahkan berkas itu).
delete from public.bot_settings where key = 'discord_announcement_ephemeral';
