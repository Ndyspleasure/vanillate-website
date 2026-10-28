-- ════════════════════════════════════════════════════════════════════════════
--  Tes retensi salinan Pemantau Kata-Kata (supabase/social-kata-retention.sql).
--  Dijalankan oleh scripts/test-guild-dashboard-sql.sh (suite keenam) di atas
--  Postgres lokal + skema Panel Developer (tabel bot_commands).
--  Cakupan: salinan social.kata > 60 menit dikosongkan, yang baru & tipe lain
--  tetap, ringkasan tetap, argumen tidak sah ditolak, hak panggil, idempoten.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
set client_min_messages = notice;

do $$
declare
  n integer;
  r jsonb;
begin
  delete from public.bot_commands where type in ('social.kata', 'social.detail');
  insert into public.bot_commands (type, status, result, created_at, processed_at) values
    ('social.kata', 'done', '{"page":1,"count":2,"entries":[{"id":1,"content":"isi lama"},{"id":2,"content":"isi lama 2"}]}', now() - interval '3 hours', now() - interval '3 hours'),
    ('social.kata', 'done', '{"page":1,"count":1,"entries":[{"id":3,"content":"isi baru"}]}', now() - interval '5 minutes', now() - interval '5 minutes'),
    ('social.kata', 'done', '{"page":1,"count":0,"entries":[]}', now() - interval '3 hours', now() - interval '3 hours'),
    ('social.kata', 'error', null, now() - interval '3 hours', now() - interval '3 hours'),
    ('social.detail', 'done', '{"entries":[{"id":9}]}', now() - interval '3 hours', now() - interval '3 hours');

  n := public.prune_social_kata_results(60);
  if n <> 1 then raise exception 'GAGAL: harus membersihkan 1 salinan, dibersihkan %', n; end if;

  select result into r from public.bot_commands where type = 'social.kata' and result->>'count' = '2';
  if jsonb_array_length(r->'entries') <> 0 or (r->>'entriesPruned')::boolean is not true then
    raise exception 'GAGAL: salinan lama harus dikosongkan (%)', r;
  end if;
  if r->>'page' <> '1' or r->>'count' <> '2' then raise exception 'GAGAL: ringkasan harus tetap (%)', r; end if;
  if r::text like '%isi lama%' then raise exception 'GAGAL: isi tulisan masih tersisa'; end if;
  raise notice 'ok - salinan > 60 menit dikosongkan, ringkasan tetap';

  if (select jsonb_array_length(result->'entries') from public.bot_commands where result->>'count' = '1' and type = 'social.kata') <> 1 then
    raise exception 'GAGAL: salinan baru (5 menit) harus tetap';
  end if;
  if (select jsonb_array_length(result->'entries') from public.bot_commands where type = 'social.detail') <> 1 then
    raise exception 'GAGAL: tipe perintah lain tidak boleh disentuh';
  end if;
  raise notice 'ok - salinan baru & tipe lain tetap';

  if public.prune_social_kata_results(60) <> 0 then raise exception 'GAGAL: panggilan kedua harus 0'; end if;
  raise notice 'ok - idempoten';

  begin
    perform public.prune_social_kata_results(1);
    raise exception 'GAGAL: p_minutes < 5 harus ditolak';
  exception when raise_exception then
    if sqlerrm like 'GAGAL%' then raise; end if;
  end;
  raise notice 'ok - p_minutes < 5 ditolak';

  if has_function_privilege('anon', 'public.prune_social_kata_results(integer)', 'execute') then
    raise exception 'GAGAL: anon tidak boleh memanggil prune_social_kata_results';
  end if;
  if has_function_privilege('authenticated', 'public.prune_social_kata_results(integer)', 'execute') then
    raise exception 'GAGAL: authenticated tidak boleh memanggil prune_social_kata_results';
  end if;
  if not has_function_privilege('service_role', 'public.prune_social_kata_results(integer)', 'execute') then
    raise exception 'GAGAL: service_role harus boleh memanggil prune_social_kata_results';
  end if;
  raise notice 'ok - hak panggil: hanya service_role';

  delete from public.bot_commands where type in ('social.kata', 'social.detail');
end;
$$;

select 'LULUS - retensi salinan Pemantau Kata-Kata';
