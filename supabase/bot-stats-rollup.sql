-- ════════════════════════════════════════════════════════════════════════════
--  Ringkasan statistik bot: `bot_stats` lebih tua dari N hari (bawaan 7) diringkas
--  menjadi SATU baris per jam per bot_slug. Baris yang dipertahankan adalah
--  sampel TERAKHIR di jam itu, jadi bentuk kolom dan arti angkanya tidak berubah
--  (guild_count, active_players, commands_run, dst.). Resolusi 5 menit untuk data
--  lama HILANG PERMANEN, itu sengaja: grafik Statistik sudah meringkas ke maks.
--  400 titik, dan membaca 22 ribu baris tiap membuka halaman memboroskan egress.
--
--  Latar: analisis sumber daya 2026-11-09 (CLAUDE.md, tujuan utama hemat sumber
--  daya database). Bot menyisipkan satu baris tiap 5 menit sejak 2026-08-15
--  (22,5 ribu baris, 11 MB, 94% berumur > 7 hari).
--
--  Aditif & idempoten (aman dijalankan ulang):
--    1. public.rollup_bot_stats(p_keep_days) — hapus baris lama selain sampel
--       terakhir tiap jam, kembalikan jumlah terhapus. Hanya service_role/postgres.
--    2. pg_cron: job `rollup-bot-stats-hourly` tiap hari 19.23 UTC (02.23 WIB).
--       Bila pg_cron tidak tersedia (Postgres lokal untuk tes) jadwal dilewati
--       dengan NOTICE; fungsi tetap terpasang.
--  Rollback: supabase/bot-stats-rollup-rollback.sql (baris yang terhapus tidak
--  bisa dikembalikan).
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Fungsi peringkas
create or replace function public.rollup_bot_stats(p_keep_days integer default 7)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if p_keep_days is null or p_keep_days < 1 then
    raise exception 'rollup_bot_stats: p_keep_days minimal 1 (diberi %)', p_keep_days;
  end if;

  with urut as (
    select id,
           row_number() over (
             partition by bot_slug, date_trunc('hour', captured_at)
             order by captured_at desc, id desc
           ) as rn
      from public.bot_stats
     where captured_at < now() - make_interval(days => p_keep_days)
  )
  delete from public.bot_stats s
   using urut u
   where s.id = u.id
     and u.rn > 1;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.rollup_bot_stats(integer) from public;
revoke all on function public.rollup_bot_stats(integer) from anon, authenticated;
grant execute on function public.rollup_bot_stats(integer) to service_role;

-- 2. Jadwal harian (pg_cron)
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    execute $sql$select cron.schedule('rollup-bot-stats-hourly', '23 19 * * *',
                                      'select public.rollup_bot_stats(7)')$sql$;
  else
    raise notice 'pg_cron tidak tersedia — jadwal rollup-bot-stats-hourly tidak dipasang';
  end if;
end;
$$;
