# Portal Partner (`/partnership/masuk`)

Status: **dibangun** (disetujui pemilik 2026-11-11). Sisi bot: handler `partner.order.report` di repo Vanillate.ID (`src/cms/handlers/partner.js`).

## Tujuan
Partner yang sudah memesan lewat WhatsApp masuk ke `/partnership/masuk`, mencatat
pesanan di form, dan melihat riwayat serta status pesanan **miliknya sendiri**.
Setiap pesanan baru dilaporkan bot Vanillate.ID ke channel Discord
`1570076513230131210`. Tidak ada pembayaran online. WhatsApp tetap jalur pesan utama.

## Keputusan pemilik
1. Pesanan di portal hanya **catatan**. Pemesanan sebenarnya lewat WhatsApp.
2. **Akun dibuat dan dihapus owner** di CMS. Tidak ada pendaftaran mandiri.
3. Lupa username atau password: dashboard menampilkan arahan menghubungi WhatsApp resmi. Owner mereset dari CMS.
4. Laporan ke Discord **hanya pesanan baru**.
5. Partner hanya melihat data miliknya. Isolasi dijaga RLS, bukan kode halaman.
6. Form lengkap dan mendukung format markdown Discord, dengan pratinjau.
7. Hanya **owner** yang mengelola akun partner.

## Alur
1. Owner membuat akun di `/admin/partnership/partners` (username, nama tampilan, password awal).
2. Partner login di `/partnership/masuk`. Login pertama **wajib ganti username dan password**.
3. Dashboard: form catatan pesanan (dengan pratinjau) dan riwayat pesanan + status.
4. Pesanan disimpan, trigger mengantre perintah bot, bot mengirim kartu ke channel laporan.
5. Owner/admin mengubah status pesanan di CMS (`dicatat`, `diproses`, `berjalan`, `selesai`, `dibatalkan`). Partner melihat statusnya.

## Data (proyek CMS `lvfwopnvvqncopvathop`, SQL aditif)
- `partner_accounts`: `id` (= auth.users.id), `username` unik, `display_name`, `must_change_credentials`, `created_at`, `last_login_at`.
- `partner_orders`: `id`, `partner_id`, `product_id`/`product_name` (snapshot), `price_text`, `brand_name`, `invite_url`, `scheduled_for`, `ad_text` (markdown Discord, maks. 2000), `note`, `status`, `status_note`, `created_at`, `updated_at`.
- RLS: partner `select` hanya `partner_id = auth.uid()`. Tidak ada policy insert/update/delete untuk partner. Pesanan masuk lewat RPC `partner_order_submit()` (SECURITY DEFINER) yang memvalidasi panjang, URL, tanggal, dan mengambil nama/harga dari `partnership_products`, bukan dari input partner. Admin: baca semua, editor boleh ubah status.
- Trigger `after insert` pada `partner_orders` mengisi `bot_commands` tipe `partner.order.report` (tanpa `created_by`). Ringkasan saja, tidak membawa data akun.
- Rate limit di RPC: maks. 10 pesanan per partner per hari.

## Auth
- Supabase Auth proyek CMS. Email sintetis `<username>@partner.vanillate.id` (tidak pernah dikirimi email). Pendaftaran publik dimatikan.
- Edge Function `partner-admin` (secret `service_role` hanya di sana): owner membuat, mereset, dan menghapus akun. Partner mengganti username/password sendiri (JWT diperiksa). Cek peran owner di sisi server.
- Browser hanya memakai anon key + JWT. Sesi partner memakai `storageKey` sendiri, terpisah dari sesi admin.
- Partner bukan baris `admin_users`, jadi `is_admin()` salah dan tabel CMS lain tertutup.

## Bot (repo Vanillate.ID)
- Handler baru `partner.order.report` di `src/cms/handlers/`. Hanya tipe ini yang diterima tanpa pembuat admin, dan hanya bila dikirim dari trigger (payload divalidasi ketat).
- Kirim kartu Components V2 ke channel `1570076513230131210`. Teks iklan/catatan tidak memicu mention (mention mati). Footer baku `v2Footer`.

## Katalog dan jumlah
Harga katalog per satuan (mis. Rp 150 per DM, minimum 100). Form meminta **jumlah** (minimal `min_quantity` produk). Nama, harga satuan, dan total dihitung server dari `partnership_products`, bukan dari input partner.

## Penerapan
1. `supabase/partner-portal.sql` lewat `apply_migration` (rollback: `partner-portal-rollback.sql`).
2. Deploy Edge Function `partner-admin` (verify_jwt aktif). Env otomatis dari Supabase.
3. Dashboard Supabase Auth: matikan pendaftaran publik (Sign ups disabled) supaya akun hanya dibuat owner.
4. Bot Vanillate.ID: merge PR handler lalu Update dan Restart dari Kontrol Server.

## Pratinjau
- Teks iklan: render markdown Discord (`src/lib/dev-panel/discord-md.ts`) lewat `esc()`.
- Kartu laporan: tampilan sama dengan yang dikirim bot.

## Biaya sumber daya
Tanpa polling dan tanpa snapshot dorong. Database hanya disentuh saat login, saat membuka riwayat (satu query terpaginasi, maks. 20 baris), dan saat pesanan dikirim (1 insert + 1 antrean bot). Tidak ada Realtime.

## Tahap
1. SQL + rollback + tes (`supabase/partner-portal*.sql`, `supabase/tests/`).
2. Edge Function `partner-admin` + tes logika.
3. Halaman `/partnership/masuk`, dashboard, dan pratinjau.
4. Halaman CMS `/admin/partnership/partners` dan status pesanan.
5. Handler bot di repo Vanillate.ID + tes.

## Campaign partner (Broadcast DM)
- `supabase/partner-campaign-link.sql`: kolom `partner_id` dan `order_id` (opsional) di `partnership_campaigns`.
- Di CMS › Broadcast DM ada pilihan **Untuk partner** lalu **Pesanan partner** (pesanan DM yang belum selesai). `partner_id` selalu mengikuti pesanan (trigger), jadi admin tidak bisa mencampur partner.
- Status campaign menggerakkan status pesanan, tidak pernah mundur dan tidak menimpa `dibatalkan` atau `selesai` manual: `queued` menjadi diproses, `running` menjadi berjalan, `completed` menjadi selesai. `cancelled` dan `failed` tidak mengubah pesanan (diputuskan tim).
- Dashboard partner menampilkan **Laporan campaign** per pesanan lewat RPC `partner_order_campaigns()` (SECURITY DEFINER): hanya angka agregat (target, terkirim, gagal, dilewati, status, waktu), tanpa User ID penerima, isi pesan, atau log. Satu panggilan RPC per halaman riwayat.
- **Lobby:** belum ada eksekusi otomatis. Pesanan paket Lobby cukup menjadi riwayat pemesanan, statusnya diubah manual di `/admin/partnership/orders`, dan dashboard menampilkan catatan itu.
- Biaya: tanpa polling. Tambahan satu kolom, dua query ringan saat form Broadcast dibuka, satu RPC saat riwayat partner dibuka, satu update status per perubahan campaign.

## Form pesanan lengkap
`supabase/partner-order-fields.sql` (jalankan setelah `partner-portal.sql`): kolom `ad_title` (maks. 100), `ad_footer` (maks. 100), `ad_image_url` (https), `ad_buttons` (maks. 3 tombol, nama maks. 80 dan link https). RPC `partner_order_submit` kini 11 argumen (yang lama dihapus). Payload laporan bot menambah `adTitle`, `adFooter`, `imageUrl`, `buttons` (semuanya opsional di bot). Dashboard menampilkan pratinjau iklan bergaya Discord (judul, isi berformat, gambar, footer, tombol) dan pratinjau kartu laporan. CMS Pesanan Partner menampilkan iklan yang sama beserta daftar link tombol.

## Draft campaign otomatis
`supabase/partner-order-draft.sql`: trigger `partner_orders_draft` membuat campaign **draft** di `partnership_campaigns` setiap ada pesanan paket DM (produk berkanal `dm`). Paket Lobby tidak membuat draft (riwayat pemesanan saja).
- Isi draft: nama `Partner <brand> #<id pesanan>`, kategori marketing, pesan tersusun dari form partner (`# judul`, isi, `-# footer`), tombol `Partnership` (wajib, dari Settings) lalu tombol partner, `order_id` tertaut (maka `partner_id` mengikuti), target 0.
- Draft tidak dikirim bot (bot hanya memproses status `queued`) dan tidak menggerakkan status pesanan. Draft tidak tampil di laporan partner.
- Admin membuka draft dari **Pesanan Partner › Cek dan konfigurasi** atau **Campaign History › Lanjutkan di Broadcast DM** (`/admin/partnership/broadcast?draft=PTN-...`). Form terisi otomatis: ubah pesan, hidup/matikan tombol partner, tempel target User ID, Preview, Confirm. Confirm mengubah draft menjadi `queued` (bukan membuat campaign baru).
- Gambar iklan tidak ikut ke pesan DM (Broadcast DM berisi teks dan tombol). Linknya tampil di halaman Pesanan Partner.
- Bila pembuatan draft gagal (mis. bentrok Broadcast ID tiga kali), pesanan partner tetap tersimpan.
