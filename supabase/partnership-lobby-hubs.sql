-- ════════════════════════════════════════════════════════════════════════════
--  Kartu Partnership di atas /game dan /sosial (bot Vanillate.ID).
--
--  Dua sakelar per lokasi pada konfigurasi Dashboard Partnership
--  (partnership_lobby, satu baris id = 1). Sakelar utama `enabled` tetap
--  berlaku: bila mati, kartu hilang di semua lokasi.
--
--    show_in_game_hub   → kartu ephemeral di atas Game Hub (/game)
--    show_in_sosial_hub → kartu ephemeral di atas Dashboard Sosial (/sosial)
--
--  Bawaan MATI. Pemilik menyalakannya dari /admin/partnership/lobby setelah
--  bot terdeploy (kolom yang belum ada dibaca bot sebagai mati).
--
--  Aditif & idempoten (`add column if not exists`); data lama tidak berubah.
--  Terapkan lewat Supabase MCP `apply_migration`. Rollback:
--  supabase/partnership-lobby-hubs-rollback.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.partnership_lobby
  add column if not exists show_in_game_hub   boolean not null default false,
  add column if not exists show_in_sosial_hub boolean not null default false;

comment on column public.partnership_lobby.show_in_game_hub is
  'Tampilkan kartu Partnership (ephemeral) di atas Game Hub /game. Butuh enabled = true.';
comment on column public.partnership_lobby.show_in_sosial_hub is
  'Tampilkan kartu Partnership (ephemeral) di atas Dashboard Sosial /sosial. Butuh enabled = true.';
