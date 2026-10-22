-- ════════════════════════════════════════════════════════════════════════════
--  Tes 📣 Share Server (supabase/share-server.sql). Dijalankan setelah suite
--  guild dashboard oleh scripts/test-guild-dashboard-sql.sh (memakai skema &
--  fixture auth-nya). Gagal = exception.
--
--  Cakupan: idempoten, akses (anon / tanpa akses / user lain), tipe & payload
--  tidak sah, satu permintaan aktif per server, tabel tertutup untuk browser,
--  status bot terbaca lewat RPC, kotak masuk vote unik per event.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
set client_min_messages = notice;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

create or replace function tests.ok(p_cond boolean, p_name text)
returns void language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'GAGAL: %', p_name; end if;
  raise notice 'ok - %', p_name;
end $$;

create or replace function tests.share_throws(p_sql text, p_code text, p_name text)
returns void language plpgsql as $$
declare v_msg text;
begin
  execute p_sql;
  raise exception 'GAGAL: % (tidak ada error, harusnya %)', p_name, p_code;
exception when others then
  get stacked diagnostics v_msg = message_text;
  if v_msg like 'GAGAL:%' then raise; end if;
  if position(p_code in v_msg) = 0 then
    raise exception 'GAGAL: % (dapat "%", harusnya %)', p_name, v_msg, p_code;
  end if;
  raise notice 'ok - %', p_name;
end $$;
grant execute on all functions in schema tests to anon, authenticated, service_role;

-- Fixture: user A (akses guild …701), user B (tanpa akses).
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'share-a@contoh.id'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'share-b@contoh.id')
on conflict do nothing;
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at) values
  ('300000000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '{"name":"admin-a"}', 'discord', now()),
  ('300000000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', '{"name":"member-b"}', 'discord', now())
on conflict do nothing;
insert into public.guild_dashboard_access (user_id, guild_id, discord_user_id, guild_name, verified_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '700000000000000701', '300000000000000001', 'Server Share', now())
on conflict do nothing;

-- Idempoten.
\ir ../share-server.sql
\ir ../share-server.sql

-- ─── Browser tanpa login / tanpa akses ──────────────────────────────────────
set role anon;
select tests.share_throws($$select public.share_dashboard_get('700000000000000701')$$, 'permission denied', 'anon tidak bisa membaca');
select tests.share_throws($$select * from public.share_requests$$, 'permission denied', 'anon tidak bisa membaca tabel');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', false);
select tests.share_throws($$select public.share_dashboard_get('700000000000000701')$$, 'ACCESS_DENIED', 'user tanpa akses ditolak');
select tests.share_throws($$select public.share_request_submit('700000000000000701', 'sambung-kata', 'activate', '{}')$$, 'ACCESS_DENIED', 'user tanpa akses tidak bisa mengirim aksi');
select tests.share_throws($$select * from public.share_guild_state$$, 'permission denied', 'tabel status tertutup untuk browser');
select tests.share_throws($$insert into public.share_topgg_votes (event_key, discord_user_id) values ('x', '300000000000000002')$$, 'permission denied', 'browser tidak bisa memalsukan vote');

-- ─── Admin server ───────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', false);
select tests.ok((public.share_dashboard_get('700000000000000701') ->> 'state') is null, 'belum ada status → state null');
select tests.share_throws($$select public.share_request_submit('700000000000000701', 'sambung-kata', 'hapus_semua', '{}')$$, 'INVALID_TYPE', 'tipe aksi tak dikenal ditolak');
select tests.share_throws($$select public.share_request_submit('700000000000000701', 'sambung-kata', 'save', '[]')$$, 'INVALID_PAYLOAD', 'payload bukan objek ditolak');
select tests.share_throws(format($$select public.share_request_submit('700000000000000701', 'sambung-kata', 'save', %L)$$,
  jsonb_build_object('description', repeat('x', 600))::text), 'INVALID_PAYLOAD', 'deskripsi raksasa ditolak');
select tests.ok((public.share_request_submit('700000000000000701', 'sambung-kata', 'save', '{"category":"gaming"}') ->> 'ok')::boolean, 'aksi admin masuk antrean');
select tests.share_throws($$select public.share_request_submit('700000000000000701', 'sambung-kata', 'activate', '{}')$$, 'TOO_MANY_REQUESTS', 'satu permintaan aktif per server');
reset role;

-- ─── Bot (service_role) ─────────────────────────────────────────────────────
set role service_role;
select tests.ok((select discord_user_id = '300000000000000001' and actor_name = 'admin-a' from public.share_requests
  where guild_id = '700000000000000701'), 'identitas Discord diambil dari auth.identities, bukan dari browser');
update public.share_requests set status = 'done', result = '{"ok":true,"message":"Profil promosi disimpan."}', finished_at = now()
  where guild_id = '700000000000000701';
insert into public.share_guild_state (guild_id, data) values ('700000000000000701', '{"status":"OFF","votes":0}')
  on conflict (bot_slug, guild_id) do update set data = excluded.data, updated_at = now();
insert into public.share_topgg_votes (event_key, discord_user_id) values ('topgg:1', '300000000000000002');
select tests.share_throws($$insert into public.share_topgg_votes (event_key, discord_user_id) values ('topgg:1', '300000000000000002')$$, 'duplicate key', 'satu event vote hanya sekali');
select tests.share_throws($$insert into public.share_topgg_votes (event_key, discord_user_id) values ('topgg:2', 'bukan-id')$$, 'check', 'Discord ID wajib snowflake');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', false);
select tests.ok((public.share_dashboard_get('700000000000000701') -> 'state' ->> 'status') = 'OFF', 'status dari bot terbaca');
select tests.ok(jsonb_array_length(public.share_dashboard_get('700000000000000701') -> 'requests') = 1, 'riwayat permintaan terbaca');
select tests.ok((public.share_request_submit('700000000000000701', 'sambung-kata', 'activate', '{}') ->> 'ok')::boolean, 'setelah selesai, aksi baru boleh');
reset role;

select 'SEMUA TES SHARE SERVER LULUS' as hasil;
