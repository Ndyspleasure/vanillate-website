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
  unit        text,
  min_quantity integer,
  enabled     boolean not null default true
);
insert into public.partnership_products (key, name, price, price_unit, unit, min_quantity, enabled) values
  ('broadcast_dm',  'Broadcast via DM', 150,  'per dm', 'Pemain', 100, true),
  ('tanpa_harga',   'Paket Khusus',     null, null,     null,     null, true),
  ('nonaktif',      'Paket Mati',       1000, null,     null,     null, false)
on conflict (key) do nothing;

\ir ../partner-portal.sql
\ir ../partner-portal.sql
\ir ../partner-order-fields.sql
\ir ../partner-order-fields.sql

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
  public.partner_order_submit('broadcast_dm', 100, '  Server Uji  ', 'https://discord.gg/abc', null,
    'Halo **dunia**', 'catatan') > 0,
  'partner mencatat pesanan lewat RPC');
select tests_dev.ok(
  (select price_text = 'Rp 150 per dm' and total_text = 'Rp 15.000' and quantity = 100 and unit = 'Pemain' and product_name = 'Broadcast via DM'
          and brand_name = 'Server Uji' and status = 'dicatat' and partner_name = 'Mitra Satu'
     from public.partner_orders limit 1),
  'nama, harga, status diambil server (bukan input partner)');
select public.partner_order_submit('tanpa_harga', 1, 'Brand B');
select tests_dev.ok(
  (select price_text = 'Harga belum ditentukan' from public.partner_orders where product_key = 'tanpa_harga'),
  'paket tanpa harga ditulis jelas');

select tests_dev.throws($$select public.partner_order_submit('nonaktif', 100, 'X')$$, '22023', 'paket nonaktif ditolak');
select tests_dev.throws($$select public.partner_order_submit('ngawur', 100, 'X')$$, '22023', 'paket tak dikenal ditolak');
select tests_dev.throws($$select public.partner_order_submit('broadcast_dm', 99, 'X')$$, '22023', 'jumlah di bawah minimum katalog ditolak');
select tests_dev.throws($$select public.partner_order_submit('broadcast_dm', null, 'X')$$, '22023', 'jumlah kosong ditolak');
select tests_dev.throws($$select public.partner_order_submit('broadcast_dm', 100, '')$$, '22023', 'brand kosong ditolak');
select tests_dev.throws($$select public.partner_order_submit('broadcast_dm', 100, 'X', 'http://x.id')$$, '22023', 'link non-https ditolak');
select tests_dev.throws($$select public.partner_order_submit('broadcast_dm', 100, 'X', 'https://a b')$$, '22023', 'link berspasi ditolak');
select tests_dev.throws($$select public.partner_order_submit('broadcast_dm', 100, 'X', null, current_date - 5)$$, '22023', 'tanggal lewat ditolak');
select tests_dev.throws($$select public.partner_order_submit('broadcast_dm', 100, 'X', null, null, repeat('a', 2001))$$, '22023', 'iklan > 2000 ditolak');

select tests_dev.throws($$insert into public.partner_orders (partner_name, product_name, price_text, brand_name)
  values ('x','x','x','x')$$, '42501', 'partner tidak bisa INSERT langsung');
update public.partner_orders set status = 'selesai';
select tests_dev.throws($$delete from public.partner_orders$$, '42501', 'partner tidak bisa hapus');
select tests_dev.ok((select count(*) = 2 and count(*) filter (where status = 'dicatat') = 2 from public.partner_orders),
  'partner tidak bisa ubah status (RLS menyaring semua baris)');
select tests_dev.ok((select count(*) = 0 from public.bot_commands), 'partner tidak melihat antrean bot (RLS)');
select tests_dev.ok((select count(*) = 1 from public.partner_accounts), 'partner hanya melihat akun sendiri');

-- ─── Form lengkap: judul, footer, gambar, tombol ───────────────────────────
select tests_dev.ok(
  public.partner_order_submit('broadcast_dm', 100, 'Brand Lengkap', null, null, 'isi', null,
    '  Judul Iklan ', 'Footer Iklan', 'https://cdn.contoh.id/a.png',
    '[{"label":" Gabung ","url":"https://discord.gg/x"},{"label":"Web","url":"https://contoh.id"}]'::jsonb) > 0,
  'pesanan lengkap tersimpan');
select tests_dev.ok(
  (select ad_title = 'Judul Iklan' and ad_footer = 'Footer Iklan' and ad_image_url = 'https://cdn.contoh.id/a.png'
          and jsonb_array_length(ad_buttons) = 2 and ad_buttons->0->>'label' = 'Gabung'
     from public.partner_orders where brand_name = 'Brand Lengkap'),
  'kolom iklan dinormalisasi dan tombol dibersihkan');
select tests_dev.throws($$select public.partner_order_submit('broadcast_dm', 100, 'X', null, null, null, null, repeat('a', 101))$$, '22023', 'judul > 100 ditolak');
select tests_dev.throws($$select public.partner_order_submit('broadcast_dm', 100, 'X', null, null, null, null, null, repeat('a', 101))$$, '22023', 'footer > 100 ditolak');
select tests_dev.throws($$select public.partner_order_submit('broadcast_dm', 100, 'X', null, null, null, null, null, null, 'http://a.id/x.png')$$, '22023', 'gambar non-https ditolak');
select tests_dev.throws($$select public.partner_order_submit('broadcast_dm', 100, 'X', null, null, null, null, null, null, null, '[{"label":"a","url":"http://x"}]'::jsonb)$$, '22023', 'link tombol non-https ditolak');
select tests_dev.throws($$select public.partner_order_submit('broadcast_dm', 100, 'X', null, null, null, null, null, null, null, '[{"label":"","url":"https://x.id"}]'::jsonb)$$, '22023', 'nama tombol kosong ditolak');
select tests_dev.throws($$select public.partner_order_submit('broadcast_dm', 100, 'X', null, null, null, null, null, null, null, '[{"label":"a","url":"https://x.id"},{"label":"b","url":"https://x.id"},{"label":"c","url":"https://x.id"},{"label":"d","url":"https://x.id"}]'::jsonb)$$, '22023', 'lebih dari 3 tombol ditolak');
select tests_dev.throws($$select public.partner_order_submit('broadcast_dm', 100, 'X', null, null, null, null, null, null, null, '{"a":1}'::jsonb)$$, '22023', 'tombol bukan array ditolak');

-- ─── Partner 2: isolasi ─────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', false);
select tests_dev.ok((select count(*) = 0 from public.partner_orders), 'partner 2 tidak melihat pesanan partner 1');
select public.partner_order_submit('broadcast_dm', 100, 'Brand Dua');
select tests_dev.ok((select count(*) = 1 and bool_and(partner_name = 'Mitra Dua') from public.partner_orders),
  'partner 2 hanya melihat pesanannya');

-- ─── Wajib ganti kredensial; bukan partner ──────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000003","role":"authenticated"}', false);
select tests_dev.throws($$select public.partner_order_submit('broadcast_dm', 100, 'X')$$, '42501', 'wajib ganti kredensial dulu');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000101","role":"authenticated"}', false);
select tests_dev.throws($$select public.partner_order_submit('broadcast_dm', 100, 'X')$$, '42501', 'admin CMS bukan partner');
select set_config('request.jwt.claims', '{}', false);
select tests_dev.throws($$select public.partner_order_submit('broadcast_dm', 100, 'X')$$, '42501', 'tanpa login ditolak');
reset role;
set role anon;
select tests_dev.throws($$select count(*) from public.partner_orders$$, '42501', 'anon tidak bisa baca pesanan');
reset role;

-- ─── Batas harian ───────────────────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', false);
select public.partner_order_submit('broadcast_dm', 100, 'Loop ' || g) from generate_series(1, 9) g;
select tests_dev.throws($$select public.partner_order_submit('broadcast_dm', 100, 'Kelebihan')$$, '54000', 'batas 10 per hari');
reset role;

-- ─── Trigger → bot_commands ─────────────────────────────────────────────────
select tests_dev.ok(
  (select count(*) = 13 from public.bot_commands where type = 'partner.order.report' and created_by is null and status = 'pending'),
  'tiap pesanan mengantre satu laporan tanpa pembuat');
select tests_dev.ok(
  (select payload->>'brandName' = 'Server Uji' and payload->>'partnerName' = 'Mitra Satu'
          and payload->>'priceText' = 'Rp 150 per dm' and payload->>'totalText' = 'Rp 15.000'
          and (payload->>'quantity')::int = 100 and payload->>'unit' = 'Pemain' and payload->>'adText' = 'Halo **dunia**'
          and payload->>'inviteUrl' = 'https://discord.gg/abc' and bot_slug = 'vanillateID'
     from public.bot_commands where payload->>'brandName' = 'Server Uji'),
  'payload laporan sesuai kontrak bot');
select tests_dev.ok(
  (select payload->>'adTitle' = 'Judul Iklan' and payload->>'adFooter' = 'Footer Iklan'
          and payload->>'imageUrl' = 'https://cdn.contoh.id/a.png' and jsonb_array_length(payload->'buttons') = 2
     from public.bot_commands where payload->>'brandName' = 'Brand Lengkap'),
  'payload laporan memuat judul, footer, gambar, tombol');
select tests_dev.ok(
  (select not (payload ? 'username') from public.bot_commands where type = 'partner.order.report' limit 1),
  'payload tidak membawa data akun');

-- ─── Admin ──────────────────────────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000101","role":"authenticated"}', false);
select tests_dev.ok((select count(*) = 13 from public.partner_orders), 'editor CMS melihat semua pesanan');
update public.partner_orders set status = 'berjalan', status_note = 'Tayang besok' where brand_name = 'Server Uji';
select tests_dev.ok((select status = 'berjalan' and updated_at >= created_at from public.partner_orders where brand_name = 'Server Uji'),
  'editor mengubah status');
select tests_dev.throws($$update public.partner_orders set brand_name = 'palsu'$$, '42501', 'editor tidak bisa ubah kolom lain');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000102","role":"authenticated"}', false);
select tests_dev.ok((select count(*) = 13 from public.partner_orders), 'viewer boleh melihat');
update public.partner_orders set status = 'selesai';
select tests_dev.ok((select count(*) = 0 from public.partner_orders where status = 'selesai'), 'viewer tidak bisa ubah status');
reset role;

-- ─── Hapus akun: riwayat tetap ──────────────────────────────────────────────
delete from auth.users where id = 'b0000000-0000-0000-0000-000000000001';
select tests_dev.ok(
  (select count(*) = 3 and bool_and(partner_id is null) from public.partner_orders where partner_name = 'Mitra Satu'),
  'riwayat pesanan tetap ada setelah akun dihapus');

-- ─── Tautan campaign broadcast ──────────────────────────────────────────────
reset role;
create table if not exists public.partnership_campaigns (
  id            bigint generated always as identity primary key,
  broadcast_id  text not null unique,
  name          text not null,
  channel       text not null default 'dm',
  status        text not null default 'draft',
  message       text not null default 'x',
  target_total  integer not null default 0,
  success_count integer not null default 0,
  failed_count  integer not null default 0,
  skipped_count integer not null default 0,
  logs          jsonb not null default '[]'::jsonb,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);
alter table public.partnership_campaigns enable row level security;
-- pesanan baru milik partner 2 (status awal dicatat) untuk uji tautan
insert into public.partner_orders (partner_id, partner_name, product_name, price_text, brand_name)
  values ('b0000000-0000-0000-0000-000000000002', 'Mitra Dua', 'Broadcast via DM', 'Rp 150 per dm', 'Tautan Uji');

\ir ../partner-campaign-link.sql
\ir ../partner-campaign-link.sql

insert into public.partnership_campaigns (broadcast_id, name, status, order_id, target_total)
  select 'PTN-T-1', 'Kampanye Uji', 'queued', id, 100 from public.partner_orders where brand_name = 'Tautan Uji';
select tests_dev.ok(
  (select c.partner_id = 'b0000000-0000-0000-0000-000000000002' from public.partnership_campaigns c where broadcast_id = 'PTN-T-1'),
  'partner_id campaign mengikuti pesanan');
select tests_dev.ok((select status = 'diproses' from public.partner_orders where brand_name = 'Tautan Uji'), 'queued menggerakkan pesanan ke diproses');
update public.partnership_campaigns set status = 'running', started_at = now() where broadcast_id = 'PTN-T-1';
select tests_dev.ok((select status = 'berjalan' from public.partner_orders where brand_name = 'Tautan Uji'), 'running menggerakkan pesanan ke berjalan');
update public.partnership_campaigns set status = 'queued' where broadcast_id = 'PTN-T-1';
select tests_dev.ok((select status = 'berjalan' from public.partner_orders where brand_name = 'Tautan Uji'), 'status pesanan tidak pernah mundur');
update public.partnership_campaigns set status = 'completed', success_count = 95, failed_count = 5, completed_at = now() where broadcast_id = 'PTN-T-1';
select tests_dev.ok((select status = 'selesai' from public.partner_orders where brand_name = 'Tautan Uji'), 'completed menggerakkan pesanan ke selesai');

-- pesanan dibatalkan manual tidak ditimpa
insert into public.partner_orders (partner_id, partner_name, product_name, price_text, brand_name, status)
  values ('b0000000-0000-0000-0000-000000000002', 'Mitra Dua', 'Broadcast via DM', 'Rp 150 per dm', 'Batal Uji', 'dibatalkan');
insert into public.partnership_campaigns (broadcast_id, name, status, order_id)
  select 'PTN-T-2', 'Kampanye Batal', 'completed', id from public.partner_orders where brand_name = 'Batal Uji';
select tests_dev.ok((select status = 'dibatalkan' from public.partner_orders where brand_name = 'Batal Uji'), 'pesanan dibatalkan tidak ditimpa');
-- campaign tanpa pesanan tetap normal
insert into public.partnership_campaigns (broadcast_id, name, status) values ('PTN-T-3', 'Internal', 'queued');
select tests_dev.ok((select partner_id is null and order_id is null from public.partnership_campaigns where broadcast_id = 'PTN-T-3'), 'campaign internal tanpa partner tetap jalan');

-- RPC laporan: hanya milik sendiri, hanya angka
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', false);
select tests_dev.ok(
  (select count(*) = 2 and bool_or(broadcast_id = 'PTN-T-1' and success_count = 95 and failed_count = 5 and target_total = 100)
     from public.partner_order_campaigns((select array_agg(id) from public.partner_orders))),
  'partner melihat laporan campaign pesanannya (agregat)');
select tests_dev.ok(
  (select not exists (select 1 from jsonb_object_keys(to_jsonb(r)) k where k in ('message', 'logs', 'name'))
     from public.partner_order_campaigns((select array_agg(id) from public.partner_orders)) r limit 1),
  'laporan tidak memuat pesan, log, atau nama internal');
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000003","role":"authenticated"}', false);
select tests_dev.ok(
  (select count(*) = 0 from public.partner_order_campaigns(array(select id from public.partner_orders))),
  'partner lain tidak melihat campaign milik partner 2');
select set_config('request.jwt.claims', '{}', false);
select tests_dev.ok(
  (select count(*) = 0 from public.partner_order_campaigns(array[1,2,3])), 'tanpa login hasil kosong');
reset role;

\ir ../partner-campaign-link-rollback.sql
select tests_dev.ok(
  (select count(*) = 0 from information_schema.columns where table_name = 'partnership_campaigns' and column_name in ('partner_id', 'order_id')),
  'rollback tautan campaign menghapus kolom');
drop table public.partnership_campaigns;

-- ─── Rollback ───────────────────────────────────────────────────────────────
\ir ../partner-order-fields-rollback.sql
select tests_dev.ok(
  (select count(*) = 0 from information_schema.columns where table_name = 'partner_orders' and column_name in ('ad_title', 'ad_footer', 'ad_image_url', 'ad_buttons')),
  'rollback form lengkap menghapus kolom iklan');
\ir ../partner-portal-rollback.sql
select tests_dev.ok(
  (select count(*) = 0 from information_schema.tables
    where table_schema = 'public' and table_name in ('partner_accounts', 'partner_orders')),
  'rollback menghapus kedua tabel');
delete from public.bot_commands where type = 'partner.order.report';
drop table public.partnership_products;
