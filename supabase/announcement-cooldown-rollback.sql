-- Rollback announcement-cooldown.sql (hanya baris yang ditambahkan berkas itu).
delete from public.bot_settings where key = 'discord_announcement_cooldown_minutes';
