-- ════════════════════════════════════════════════════════════════════════════
--  Tes sakelar kartu Partnership di /game dan /sosial
--  (supabase/partnership-lobby-hubs.sql). Dijalankan oleh
--  scripts/test-guild-dashboard-sql.sh (suite ketujuh) setelah suite Panel
--  Developer (memakai helper tests_dev.ok).
--  Cakupan: bawaan mati, baris lama tidak berubah, idempoten (dua kali),
--  nilai bisa dinyalakan per lokasi, kolom tidak boleh null, rollback bersih.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
reset role;

-- Salinan minimal tabel dasar (supabase/schema.sql bagian 11c) dengan satu baris
-- yang SUDAH ada sebelum migrasi, seperti di produksi.
create table public.partnership_lobby (
  id               smallint primary key default 1 check (id = 1),
  enabled          boolean not null default true,
  dashboard_title  text not null default '🤝 Partnership',
  cta_position     text not null default 'last' check (cta_position in ('first', 'last')),
  updated_at       timestamptz not null default now()
);
insert into public.partnership_lobby (id, dashboard_title) values (1, 'Judul lama');

\ir ../partnership-lobby-hubs.sql
\ir ../partnership-lobby-hubs.sql

select tests_dev.ok(
  (select show_in_game_hub = false and show_in_sosial_hub = false from public.partnership_lobby where id = 1),
  'baris lama: kedua sakelar bawaan MATI');
select tests_dev.ok(
  (select dashboard_title = 'Judul lama' and enabled from public.partnership_lobby where id = 1),
  'data lama tidak berubah oleh migrasi (dijalankan dua kali)');

update public.partnership_lobby set show_in_game_hub = true where id = 1;
select tests_dev.ok(
  (select show_in_game_hub and not show_in_sosial_hub from public.partnership_lobby where id = 1),
  'sakelar per lokasi berdiri sendiri');

select tests_dev.throws($$update public.partnership_lobby set show_in_sosial_hub = null where id = 1$$,
  '23502', 'sakelar tidak boleh null');

\ir ../partnership-lobby-hubs-rollback.sql
select tests_dev.ok(
  (select count(*) = 0 from information_schema.columns
    where table_schema = 'public' and table_name = 'partnership_lobby'
      and column_name in ('show_in_game_hub', 'show_in_sosial_hub')),
  'rollback menghapus kedua kolom');
select tests_dev.ok(
  (select dashboard_title = 'Judul lama' from public.partnership_lobby where id = 1),
  'rollback tidak menyentuh data lain');

drop table public.partnership_lobby;
