-- ════════════════════════════════════════════════════════════════════════════
--  Tes ringkasan statistik bot (supabase/bot-stats-rollup.sql).
--  Dijalankan oleh scripts/test-guild-dashboard-sql.sh di atas Postgres lokal +
--  supabase-stub.sql + bot-stats-rollup-prereq.sql.
--  Cakupan: satu baris per jam tersisa (sampel terakhir), data <= 7 hari utuh,
--  per bot_slug terpisah, argumen tidak sah ditolak, hak panggil, idempoten.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
set client_min_messages = notice;

do $$
declare
  n integer;
  t0 timestamptz := date_trunc('hour', now() - interval '20 days');
begin
  delete from public.bot_stats;
  -- 12 sampel (tiap 5 menit) dalam satu jam, 20 hari lalu: sisakan yang terakhir.
  insert into public.bot_stats (bot_slug, captured_at, guild_count)
    select 'vanillateID', t0 + (i * interval '5 minutes'), 100 + i from generate_series(0, 11) i;
  -- jam berikutnya, dua sampel, plus bot_slug lain di jam pertama.
  insert into public.bot_stats (bot_slug, captured_at, guild_count) values
    ('vanillateID', t0 + interval '1 hour 5 minutes', 200),
    ('vanillateID', t0 + interval '1 hour 50 minutes', 201),
    ('lain',        t0 + interval '10 minutes', 5);
  -- data baru (<= 7 hari) harus utuh walau banyak per jam.
  insert into public.bot_stats (bot_slug, captured_at, guild_count)
    select 'vanillateID', now() - interval '1 hour' + (i * interval '5 minutes'), 300 + i from generate_series(0, 5) i;

  n := public.rollup_bot_stats(7);
  -- terhapus: 11 (jam pertama) + 1 (jam kedua) = 12
  if n <> 12 then raise exception 'GAGAL: harus menghapus 12 baris, terhapus %', n; end if;
  raise notice 'ok - jumlah terhapus 12';

  if (select guild_count from public.bot_stats where bot_slug = 'vanillateID' and captured_at = t0 + interval '55 minutes') <> 111 then
    raise exception 'GAGAL: sampel terakhir jam pertama (111) harus tersisa';
  end if;
  if (select guild_count from public.bot_stats where bot_slug = 'vanillateID' and captured_at = t0 + interval '1 hour 50 minutes') <> 201 then
    raise exception 'GAGAL: sampel terakhir jam kedua (201) harus tersisa';
  end if;
  if (select count(*) from public.bot_stats where bot_slug = 'lain') <> 1 then
    raise exception 'GAGAL: bot_slug lain harus punya baris sendiri';
  end if;
  raise notice 'ok - sampel terakhir tiap jam dan tiap bot_slug tersisa';

  if (select count(*) from public.bot_stats where captured_at > now() - interval '2 hours') <> 6 then
    raise exception 'GAGAL: 6 baris baru harus utuh';
  end if;
  raise notice 'ok - data <= 7 hari utuh';

  if public.rollup_bot_stats(7) <> 0 then raise exception 'GAGAL: panggilan kedua harus 0'; end if;
  raise notice 'ok - idempoten';

  begin
    perform public.rollup_bot_stats(0);
    raise exception 'GAGAL: p_keep_days 0 harus ditolak';
  exception when raise_exception then
    if sqlerrm like 'GAGAL%' then raise; end if;
  end;
  raise notice 'ok - p_keep_days < 1 ditolak';

  if has_function_privilege('anon', 'public.rollup_bot_stats(integer)', 'execute') then
    raise exception 'GAGAL: anon tidak boleh memanggil rollup_bot_stats';
  end if;
  if has_function_privilege('authenticated', 'public.rollup_bot_stats(integer)', 'execute') then
    raise exception 'GAGAL: authenticated tidak boleh memanggil rollup_bot_stats';
  end if;
  if not has_function_privilege('service_role', 'public.rollup_bot_stats(integer)', 'execute') then
    raise exception 'GAGAL: service_role harus boleh memanggil rollup_bot_stats';
  end if;
  raise notice 'ok - hak panggil: hanya service_role';
end;
$$;

select 'LULUS - ringkasan statistik bot';
