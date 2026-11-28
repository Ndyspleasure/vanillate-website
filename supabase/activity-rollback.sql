-- Pemulihan Vanillate Activity: hanya menghapus baris setelan dan kategorinya, tidak ada data lain.
delete from public.bot_settings where key = 'activity_enabled';
delete from public.bot_setting_categories where key = 'activity'
  and not exists (select 1 from public.bot_settings where category = 'activity');
