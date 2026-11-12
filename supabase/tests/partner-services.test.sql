-- Tes supabase/partner-services.sql. Dijalankan scripts/test-guild-dashboard-sql.sh
-- setelah suite Panel Developer (tests_dev.ok/throws, admin_users, bot_commands).
-- Cakupan: layanan Lobby otomatis dari pesanan, pemeriksa harian (habis, H-5,
-- tanpa email = dilewati, idempoten), perpanjangan, RLS partner dan editor,
-- validasi email kontak, idempoten, rollback.
\set ON_ERROR_STOP on
reset role;
set client_min_messages = notice;

create table if not exists public.partnership_products (
  key text primary key, name text not null, price numeric, price_unit text,
  channel text not null default 'dm', unit text, min_quantity integer, enabled boolean not null default true
);
insert into public.partnership_products (key, name, price, price_unit, unit, min_quantity, enabled, channel) values
  ('broadcast_dm', 'Broadcast via DM', 150, 'per dm', 'Pemain', 100, true, 'dm'),
  ('broadcast_lobby', 'Broadcast via Lobby', 200, 'per hari', 'Hari', 20, true, 'lobby')
on conflict (key) do nothing;

\ir ../partner-portal.sql
\ir ../partner-services.sql
\ir ../partner-services.sql

insert into auth.users (id, email) values
  ('c0000000-0000-0000-0000-000000000001', 'm1@partner.vanillate.id'),
  ('c0000000-0000-0000-0000-000000000002', 'm2@partner.vanillate.id'),
  ('d0000000-0000-0000-0000-000000000101', 'edit@contoh.id'),
  ('d0000000-0000-0000-0000-000000000102', 'lihat@contoh.id')
on conflict (id) do nothing;
insert into public.admin_users (id, username, role) values
  ('d0000000-0000-0000-0000-000000000101', 'editor_ps', 'admin'),
  ('d0000000-0000-0000-0000-000000000102', 'viewer_ps', 'viewer')
on conflict (id) do nothing;
insert into public.partner_accounts (id, username, display_name, must_change_credentials, contact_email) values
  ('c0000000-0000-0000-0000-000000000001', 'mitra.satu', 'Mitra Satu', false, 'satu@contoh.id'),
  ('c0000000-0000-0000-0000-000000000002', 'mitra.dua',  'Mitra Dua',  false, null);

select tests_dev.throws($$update public.partner_accounts set contact_email = 'bukan-email' where username = 'mitra.satu'$$,
  '23514', 'email kontak tidak sah ditolak');

-- ─── Pesanan Lobby berjalan → layanan otomatis ──────────────────────────────
insert into public.partner_orders (partner_id, partner_name, product_key, product_name, price_text, quantity, unit, brand_name, scheduled_for)
values
  ('c0000000-0000-0000-0000-000000000001', 'Mitra Satu', 'broadcast_lobby', 'Broadcast via Lobby', 'Rp 200 per hari', 20, 'Hari', 'Server Uji', current_date),
  ('c0000000-0000-0000-0000-000000000001', 'Mitra Satu', 'broadcast_dm', 'Broadcast via DM', 'Rp 150', 100, 'Pemain', 'Server DM', null);
select tests_dev.ok((select count(*) = 0 from public.partner_services), 'pesanan baru dicatat belum membuat layanan');
update public.partner_orders set status = 'berjalan';
select tests_dev.ok((select count(*) = 1 from public.partner_services), 'hanya pesanan satuan Hari menjadi layanan');
select tests_dev.ok(
  (select kind = 'lobby' and ends_on = starts_on + 19 and status = 'aktif' and partner_name = 'Mitra Satu' from public.partner_services),
  'Lobby 20 hari: selesai = mulai + 19 hari (inklusif)');
update public.partner_orders set status = 'selesai';
update public.partner_orders set status = 'berjalan';
select tests_dev.ok((select count(*) = 1 from public.partner_services), 'berjalan berulang tidak menggandakan layanan');

-- ─── Layanan manual + pemeriksa harian ──────────────────────────────────────
insert into public.partner_services (partner_id, kind, label, starts_on, ends_on) values
  ('c0000000-0000-0000-0000-000000000001', 'hosting_bot', 'Hosting Bot A', current_date - 25, current_date + 3),
  ('c0000000-0000-0000-0000-000000000002', 'hosting_bot', 'Hosting Bot B', current_date - 25, current_date + 5),
  ('c0000000-0000-0000-0000-000000000001', 'hosting_bot', 'Hosting Bot C', current_date - 10, current_date + 20),
  ('c0000000-0000-0000-0000-000000000001', 'hosting_bot', 'Hosting Bot Lama', current_date - 40, current_date - 2);
select tests_dev.ok((select partner_name = 'Mitra Satu' from public.partner_services where label = 'Hosting Bot A'),
  'nama partner diisi otomatis');

select public.partner_services_tick();
select tests_dev.ok((select status = 'habis' from public.partner_services where label = 'Hosting Bot Lama'), 'lewat masa menjadi habis');
select tests_dev.ok((select status = 'aktif' from public.partner_services where label = 'Hosting Bot C'), 'masih lama tetap aktif');
select tests_dev.ok(
  (select n.status = 'pending' and n.to_email = 'satu@contoh.id' and n.kind = 'h5'
     from public.partner_service_notices n join public.partner_services s on s.id = n.service_id where s.label = 'Hosting Bot A'),
  'H-5 diantre ke email kontak partner');
select tests_dev.ok(
  (select n.status = 'skipped' and n.to_email is null
     from public.partner_service_notices n join public.partner_services s on s.id = n.service_id where s.label = 'Hosting Bot B'),
  'tanpa email kontak: dilewati dan tercatat');
select tests_dev.ok(
  (select n.kind = 'habis' and n.status = 'pending'
     from public.partner_service_notices n join public.partner_services s on s.id = n.service_id where s.label = 'Hosting Bot Lama'),
  'email habis diantre');
select tests_dev.ok(
  (select count(*) = 0 from public.partner_service_notices n join public.partner_services s on s.id = n.service_id where s.label = 'Hosting Bot C'),
  'layanan jauh dari habis tidak diingatkan');
do $$ declare a int; b int; begin
  select count(*) into a from public.partner_service_notices;
  perform public.partner_services_tick();
  select count(*) into b from public.partner_service_notices;
  perform tests_dev.ok(a = b, 'pemeriksa idempoten: tidak menggandakan email');
end $$;

-- Perpanjang layanan yang sudah habis: aktif lagi, pengingat baru untuk masa baru.
update public.partner_services set ends_on = current_date + 4 where label = 'Hosting Bot Lama';
select tests_dev.ok((select status = 'aktif' from public.partner_services where label = 'Hosting Bot Lama'), 'perpanjangan mengaktifkan lagi');
select public.partner_services_tick();
select tests_dev.ok(
  (select count(*) = 2 from public.partner_service_notices n join public.partner_services s on s.id = n.service_id where s.label = 'Hosting Bot Lama'),
  'masa baru mendapat pengingat baru (riwayat lama tetap)');

-- ─── RLS ────────────────────────────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-000000000002","role":"authenticated"}', false);
select tests_dev.ok((select count(*) = 1 and bool_and(partner_id = 'c0000000-0000-0000-0000-000000000002') from public.partner_services),
  'partner hanya melihat layanan sendiri');
select tests_dev.ok((select count(*) = 0 from public.partner_service_notices), 'partner tidak melihat antrean email');
select tests_dev.throws($$insert into public.partner_services (kind, label, starts_on, ends_on) values ('lainnya','x',current_date,current_date)$$,
  '42501', 'partner tidak bisa menambah layanan');
select tests_dev.throws($$select public.partner_services_tick()$$, '42501', 'partner tidak bisa menjalankan pemeriksa');
select tests_dev.throws($$select public.partner_services_check_now()$$, '42501', 'partner tidak bisa periksa sekarang');

select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-000000000102","role":"authenticated"}', false);
select tests_dev.ok((select count(*) >= 5 from public.partner_services), 'viewer admin boleh membaca semua layanan');
select tests_dev.throws($$insert into public.partner_services (kind, label, starts_on, ends_on) values ('lainnya','x',current_date,current_date)$$,
  '42501', 'viewer tidak bisa menambah layanan');
select tests_dev.throws($$select public.partner_services_check_now()$$, '42501', 'viewer tidak bisa periksa sekarang');

select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-000000000101","role":"authenticated"}', false);
insert into public.partner_services (partner_id, kind, label, starts_on, ends_on)
  values ('c0000000-0000-0000-0000-000000000002', 'hosting_bot', 'Dari CMS', current_date, current_date + 30);
select tests_dev.ok((select count(*) = 1 from public.partner_services where label = 'Dari CMS'), 'editor menambah layanan');
select tests_dev.ok((public.partner_services_check_now() ->> 'menunggu') is not null, 'editor menjalankan pemeriksaan sekarang');
reset role;

-- ─── Idempoten + rollback ───────────────────────────────────────────────────
\ir ../partner-services.sql
select tests_dev.ok((select count(*) >= 5 from public.partner_services), 'menjalankan ulang tidak menghapus data');
\ir ../partner-services-rollback.sql
select tests_dev.ok(
  (select count(*) = 0 from information_schema.tables where table_name in ('partner_services', 'partner_service_notices')),
  'rollback menghapus kedua tabel');
select tests_dev.ok(
  (select count(*) = 0 from information_schema.columns where table_name = 'partner_accounts' and column_name = 'contact_email'),
  'rollback menghapus kolom email kontak');
\ir ../partner-portal-rollback.sql
drop table public.partnership_products;
