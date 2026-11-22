-- Pemulihan Vani (Social AI): hanya menghapus dua baris setelan, tidak ada data lain.
delete from public.bot_settings where key in ('social_ai_enabled', 'social_ai_baseline');
