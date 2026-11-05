-- ════════════════════════════════════════════════════════════════════════════
--  Rollback supabase/partnership-lobby-hubs.sql.
--  Hanya untuk keadaan darurat: menghapus dua sakelar kartu Partnership di
--  /game dan /sosial. Bot membaca kolom yang hilang sebagai mati, jadi
--  kartunya langsung berhenti tampil. Jalankan manual di SQL Editor.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.partnership_lobby
  drop column if exists show_in_game_hub,
  drop column if exists show_in_sosial_hub;
