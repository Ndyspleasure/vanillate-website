-- Rollback supabase/bot-commands-viewer-read.sql: viewer kembali tidak bisa
-- mengantre perintah apa pun. Tidak mengubah data. Perintah `read.*` yang sudah
-- ada di bot_commands dibiarkan (hanya riwayat).
drop policy if exists "viewer tambah bot_commands baca-saja" on public.bot_commands;
