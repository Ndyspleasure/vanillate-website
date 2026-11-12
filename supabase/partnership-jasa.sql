-- ════════════════════════════════════════════════════════════════════════════
-- PARTNERSHIP JASA (/partnership/jasa): hosting bot & pembuatan bot
--
-- Satu baris jsonb berisi seluruh isi halaman (hero, paket + harga + spesifikasi,
-- FAQ, CTA, SEO). Sengaja TIDAK memakai `partnership_products`: tabel itu dibaca
-- bot untuk Dashboard Partnership (broadcast DM/Lobby) dan punya check
-- channel in ('dm','lobby'), sehingga paket jasa akan bocor ke Discord.
--
-- Biaya: ditarik SEKALI per build oleh scripts/sync-content.mjs (satu GET satu
-- baris). Tanpa polling, tanpa baca dari browser pengunjung. Admin menulis
-- lewat /admin/partnership/jasa.
--
-- Aditif & idempoten: aman dijalankan berulang, tanpa DROP, tanpa mengubah data.
-- Rollback: partnership-jasa-rollback.sql
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.partnership_jasa_page (
  id         smallint primary key default 1 check (id = 1),
  content    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.admin_users(id) on delete set null
);

comment on table public.partnership_jasa_page is
  'Isi halaman publik /partnership/jasa (satu baris). Dikelola dari /admin/partnership/jasa, ditarik saat build.';

alter table public.partnership_jasa_page enable row level security;

drop policy if exists "admin baca ptn jasa" on public.partnership_jasa_page;
create policy "admin baca ptn jasa" on public.partnership_jasa_page
  for select to authenticated using (public.is_admin());
drop policy if exists "editor kelola ptn jasa" on public.partnership_jasa_page;
create policy "editor kelola ptn jasa" on public.partnership_jasa_page
  for all to authenticated
  using (public.is_admin_editor()) with check (public.is_admin_editor());

-- Isi awal. `on conflict do nothing`: tidak menimpa suntingan admin.
insert into public.partnership_jasa_page (id, content) values (1, jsonb_build_object(
  'hero', jsonb_build_object(
    'title', 'Jasa Bot Discord',
    'subtitle', 'Hosting bot yang stabil dan pembuatan bot sesuai kebutuhan komunitasmu. Pesan lewat WhatsApp official kami.',
    'ctaLabel', 'Pesan Sekarang'
  ),
  'packages', jsonb_build_array(
    jsonb_build_object(
      'key', 'hosting_bot',
      'name', 'Hosting Bot',
      'tagline', 'Bot Discord kamu online terus tanpa mengurus server sendiri.',
      'badge', 'Terpopuler',
      'price', 5000,
      'currency', 'IDR',
      'unit', 'bulan',
      'priceNote', '',
      'specs', jsonb_build_array(
        jsonb_build_object('label', 'Memory (RAM)', 'value', '512 MB'),
        jsonb_build_object('label', 'Disk Storage', 'value', '1 GB'),
        jsonb_build_object('label', 'CPU Allocation', 'value', '35%'),
        jsonb_build_object('label', 'Uptime Target', 'value', '99,9%')
      ),
      'features', '[]'::jsonb,
      'ctaLabel', 'Pesan Hosting'
    ),
    jsonb_build_object(
      'key', 'pembuatan_bot',
      'name', 'Pembuatan Bot',
      'tagline', 'Bot Discord dibuat sesuai kebutuhan komunitasmu.',
      'badge', '',
      'price', 30000,
      'currency', 'IDR',
      'unit', '',
      'priceNote', 'Harga untuk bot ringan. Bot yang lebih kompleks menyesuaikan kesepakatan, hubungi WhatsApp official kami.',
      'specs', '[]'::jsonb,
      'features', '[]'::jsonb,
      'ctaLabel', 'Diskusi Pembuatan Bot'
    )
  ),
  'process', jsonb_build_array(
    jsonb_build_object('n', '01', 'title', 'Hubungi', 'text', 'Pilih jasa lalu hubungi WhatsApp official kami.'),
    jsonb_build_object('n', '02', 'title', 'Diskusi', 'text', 'Kami bahas kebutuhan, jadwal, dan harga yang disepakati.'),
    jsonb_build_object('n', '03', 'title', 'Pengerjaan', 'text', 'Bot dibuat atau di-hosting sesuai kesepakatan.'),
    jsonb_build_object('n', '04', 'title', 'Serah terima', 'text', 'Bot siap dipakai dan kami bantu sampai berjalan.')
  ),
  'faq', jsonb_build_array(
    jsonb_build_object('q', 'Bagaimana cara memesan?', 'a', 'Tekan tombol pesan di paket yang kamu mau. WhatsApp official kami terbuka dengan pesan yang sudah terisi.'),
    jsonb_build_object('q', 'Apakah harga pembuatan bot pasti?', 'a', 'Harga yang tampil adalah harga untuk bot ringan. Bot yang lebih kompleks menyesuaikan kesepakatan, jadi hubungi kami dulu.')
  ),
  'cta', jsonb_build_object(
    'title', 'Butuh bot untuk komunitasmu?',
    'text', 'Ceritakan kebutuhanmu, kami bantu carikan paket yang pas.',
    'label', 'Hubungi via WhatsApp'
  ),
  'seo', jsonb_build_object(
    'title', 'Jasa Hosting Bot dan Pembuatan Bot Discord',
    'description', 'Hosting bot Discord mulai Rp5.000 per bulan dan jasa pembuatan bot mulai Rp30.000. Pesan lewat WhatsApp official Vanillate Studio.',
    'ogImage', ''
  )
)) on conflict (id) do nothing;
