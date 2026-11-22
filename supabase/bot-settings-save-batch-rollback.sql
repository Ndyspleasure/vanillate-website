-- Rollback: hanya menghapus fungsi batch. Data bot_settings tidak disentuh.
-- Frontend lama (satu UPDATE per kunci) tidak membutuhkan fungsi ini.
drop function if exists public.bot_settings_save_batch(jsonb);
