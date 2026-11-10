-- Rollback vote-restore.sql (hanya baris yang ditambahkan berkas itu).
delete from public.bot_settings where key = 'social_vote_restore_enabled';
delete from public.bot_setting_categories
  where key = 'sosial'
    and not exists (select 1 from public.bot_settings where category = 'sosial');
