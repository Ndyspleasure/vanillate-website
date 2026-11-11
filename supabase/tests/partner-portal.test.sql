-- ════════════════════════════════════════════════════════════════════════════
--  Tes Portal Partner (supabase/partner-portal.sql). Dijalankan oleh
--  scripts/test-guild-dashboard-sql.sh setelah suite Panel Developer (memakai
--  tests_dev.ok/throws, admin_users, bot_commands).
--  Cakupan: isolasi antar partner (RLS), partner tidak bisa menulis langsung,
--  RPC memvalidasi + mengambil harga dari katalog, wajib ganti kredensial,
--  batas harian, trigger mengantre bot_commands tanpa pembuat, editor hanya
--  mengubah status, riwayat bertahan setelah akun dihapus, idempoten, rollback.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
reset role;
set client_min_messages = notice;

create table if not exists public.partnership_products (
  key         text primary key,
  name        text not null,
  price       numeric,
  price_unit  text,
  enabled     boolean not null default true
);
insert into public.partnership_products (key, name, price, price_unit, enabled) values
  ('broadcast_dm',  'Broadcast via DM', 1500000, 'per campaign', true),
  ('tanpa_harga',   'Paket Khusus',     null,    null,           true),
  ('nonaktif',      'Paket Mati',       1000,    null,           false)
on conflict (key) do nothing;

\ir ../partner-portal.sql
\ir ../partner-portal.sql

insert into auth.users (id, email) values
  ('b0000000-0000-0000-0000-000000000001', 'p1@partner.vanillate.id'),
  ('b0000000-0000-0000-0000-000000000002', 'p2@partner.vanillate.id'),
  ('b0000000-0000-0000-0000-000000000003', 'baru@partner.vanillate.id'),
  ('a0000000-0000-0000-0000-000000000101', 'edit@contoh.id'),
  ('a0000000-0000-0000-0000-000000000102', 'lihat@contoh.id')
on conflict (id) do nothing;
insert into public.admin_users (id, username, role) values
  ('a0000000-0000-0000-0000-000000000101', 'editor_pp', 'admin'),
  ('a0000000-0000-0000-0000-000000000102', 'viewer_pp', 'viewer')
on conflict (id) do nothing;
insert into public.partner_accounts (id, username, display_name, must_change_credentials) values
  ('b0000000-0000-0000-0000-000000000001', 'mitra.satu', 'Mitra Satu', false),
  ('b0000000-0000-0000-0000-000000000002', 'mitra.dua',  'Mitra Dua',  false),
  ('b0000000-0000-0000-0000-000000000003', 'mitra.baru', 'Mitra Baru', true);

select tests_dev.throws($$insert into public.partner_accounts (id, username, display_name)
  values (gen_random_uuid(), 'AB', 'x')$$, '23514', 'username tidak sah ditolak');

-- ─── Partner 1 ──────────────────────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

select tests_dev.ok(
  public.partner_order_submit('broadcast_dm', '  Server Uji  ', 'https://discord.gg/abc', null,
    'Halo **dunia**', 'catatan') > 0,
  'partner mencatat pesanan lewat RPC');
select tests_dev.ok(
  (select price_text = 'Rp 1.500.000 per campaign' and product_name = 'Broadcast via DM'
          and brand_name = 'Server Uji' and status = 'dicatat' and partner_name = 'Mitra Satu'
     from public.partner_orders limit 1),
  'nama, harga, status diambil server (bukan input partner)');
select public.partner_order_submit('tanpa_harga', 'Brand B');
select tests_dev.ok(
  (select price_text = 'Harga belum ditentukan' from public.partner_orders where product_key = 'tanpa_harga'),
  'paket tanpa harga ditulis jelas');

select tests_dev.throws($$select public.partner_order_submit('nonaktif', 'X')$$, '22023', 'paket nonaktif ditolak');
select tests_dev.throws($$select public.partner_order_submit('ngawur', 'X')$$, '22023', 'paket tak dikenal ditolak');
select tests_dev.throws($$select public.partner_order_submit('broadcast_dm', '')$$, '22023', 'brand kosong ditolak');
select tests_dev.throws($$select public.partner_order_submit('broadcast_dm', 'X', 'http://x.id')$$, '22023', 'link non-https ditolak');
select tests_dev.throws($$select public.partner_order_submit('broadcast_dm', 'X', 'https://a b')$$, '22023', 'link berspasi ditolak');
select tests_dev.throws($$select public.partner_order_submit('broadcast_dm', 'X', null, current_date - 5)$$, '22023', 'tanggal lewat ditolak');
select tests_dev.throws($$select public.partner_order_submit('broadcast_dm', 'X', null, null, repeat('a', 2001))$$, '22023', 'iklan > 2000 ditolak');

select tests_dev.throws($$insert into public.partner_orders (partner_name, product_name, price_text, brand_name)
  values ('x','x','x','x')$$, '42501', 'partner tidak bisa INSERT langsung');
update public.partner_orders set status = 'selesai';
select tests_dev.throws($$delete from public.partner_orders$$, '42501', 'partner tidak bisa hapus');
select tests_dev.ok((select count(*) = 2 and count(*) filter (where status = 'dicatat') = 2 from public.partner_orders),
  'partner tidak bisa ubah status (RLS menyaring semua baris)');
select tests_dev.ok((select count(*) = 0 from public.bot_commands), 'partner tidak melihat antrean bot (RLS)');
select tests_dev.ok((select count(*) = 1 from public.partner_accounts), 'partner hanya melihat akun sendiri');

-- ─── Partner 2: isolasi ─────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', false);
select tests_dev.ok((select count(*) = 0 from public.partner_orders), 'partner 2 tidak melihat pesanan partner 1');
select public.partner_order_submit('broadcast_dm', 'Brand Dua');
select tests_dev.ok((select count(*) = 1 and bool_and(partner_name = 'Mitra Dua') from public.partner_orders),
  'partner 2 hanya melihat pesanannya');

-- ─── Wajib ganti kredensial; bukan partner ──────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000003","role":"authenticated"}', false);
select tests_dev.throws($$select public.partner_order_submit('broadcast_dm', 'X')$$, '42501', 'wajib ganti kredensial dulu');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000101","role":"authenticated"}', false);
select tests_dev.throws($$select public.partner_order_submit('broadcast_dm', 'X')$$, '42501', 'admin CMS bukan partner');
select set_config('request.jwt.claims', '{}', false);
select tests_dev.throws($$select public.partner_order_submit('broadcast_dm', 'X')$$, '42501', 'tanpa login ditolak');
reset role;
set role anon;
select tests_dev.throws($$select count(*) from public.partner_orders$$, '42501', 'anon tidak bisa baca pesanan');
reset role;

-- ─── Batas harian ───────────────────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', false);
select public.partner_order_submit('broadcast_dm', 'Loop ' || g) from generate_series(1, 9) g;
select tests_dev.throws($$select public.partner_order_submit('broadcast_dm', 'Kelebihan')$$, '54000', 'batas 10 per hari');
reset role;

-- ─── Trigger → bot_commands ─────────────────────────────────────────────────
select tests_dev.ok(
  (select count(*) = 12 from public.bot_commands where type = 'partner.order.report' and created_by is null and status = 'pending'),
  'tiap pesanan mengantre satu laporan tanpa pembuat');
select tests_dev.ok(
  (select payload->>'brandName' = 'Server Uji' and payload->>'partnerName' = 'Mitra Satu'
          and payload->>'priceText' = 'Rp 1.500.000 per campaign' and payload->>'adText' = 'Halo **dunia**'
          and payload->>'inviteUrl' = 'https://discord.gg/abc' and bot_slug = 'vanillateID'
     from public.bot_commands where payload->>'brandName' = 'Server Uji'),
  'payload laporan sesuai kontrak bot');
select tests_dev.ok(
  (select not (payload ? 'username') from public.bot_commands where type = 'partner.order.report' limit 1),
  'payload tidak membawa data akun');

-- ─── Admin ──────────────────────────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000101","role":"authenticated"}', false);
select tests_dev.ok((select count(*) = 12 from public.partner_orders), 'editor CMS melihat semua pesanan');
update public.partner_orders set status = 'berjalan', status_note = 'Tayang besok' where brand_name = 'Server Uji';
select tests_dev.ok((select status = 'berjalan' and updated_at >= created_at from public.partner_orders where brand_name = 'Server Uji'),
  'editor mengubah status');
select tests_dev.throws($$update public.partner_orders set brand_name = 'palsu'$$, '42501', 'editor tidak bisa ubah kolom lain');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000102","role":"authenticated"}', false);
select tests_dev.ok((select count(*) = 12 from public.partner_orders), 'viewer boleh melihat');
update public.partner_orders set status = 'selesai';
select tests_dev.ok((select count(*) = 0 from public.partner_orders where status = 'selesai'), 'viewer tidak bisa ubah status');
reset role;

-- ─── Hapus akun: riwayat tetap ──────────────────────────────────────────────
delete from auth.users where id = 'b0000000-0000-0000-0000-000000000001';
select tests_dev.ok(
  (select count(*) = 2 and bool_and(partner_id is null) from public.partner_orders where partner_name = 'Mitra Satu'),
  'riwayat pesanan tetap ada setelah akun dihapus');

-- ─── Rollback ───────────────────────────────────────────────────────────────
\ir ../partner-portal-rollback.sql
select tests_dev.ok(
  (select count(*) = 0 from information_schema.tables
    where table_schema = 'public' and table_name in ('partner_accounts', 'partner_orders')),
  'rollback menghapus kedua tabel');
delete from public.bot_commands where type = 'partner.order.report';
drop table public.partnership_products;
