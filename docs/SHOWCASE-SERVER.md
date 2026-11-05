# 🌐 Showcase Server: Daftar Server Pemakai Bot di Website

Barisan kartu server Discord yang memakai Vanillate.ID, bergerak menyamping di
**beranda** (satu baris ringkas) dan **`/products/vanillateID/`** (dua baris, ada
tombol Gabung dan "Lihat semua server"). Keputusan pemilik 2026-11-05.
Sisi bot: repo `sambung-kata-bot`, `docs/showcase-server.md`.

## 1. Aturan

- **Bawaan semua server yang memakai bot tampil.** Admin/owner server mematikannya
  di Dashboard › Share Server (kartu "Tampil di website"). Tidak bergantung pada
  sakelar Share Server.
- Yang tampil hanya nama, ikon, perkiraan jumlah member (dikasarkan bot), dan
  opsional tombol Gabung. Tidak ada deskripsi atau data lain.
- Judul seksi sengaja **tanpa angka** ("Ribuan server menggunakan dan merasakan
  manfaat komunitas Vanillate") supaya tidak perlu diubah saat jumlah bertambah.
- Server yang ditinjau tim disembunyikan di `/admin/showcase`. Dashboard admin
  server hanya menampilkan teks netral, alasan dan catatan tidak pernah keluar CMS.
- Tombol Gabung (jalan tengah): link admin, lalu vanity URL, lalu link otomatis hanya untuk server Discovery. Link admin yang valid tidak pernah diganti, menghapus link berarti tanpa tombol Gabung. Rinciannya di repo bot `docs/showcase-server.md` §7.
- Bot keluar dari server: data tampil dihapus bot, server hilang dari daftar pada
  penerbitan berikutnya (daftar diganti utuh, bukan ditambah).
- Teks pengguna tanpa tanda pisah. Semua teks dari Discord di-escape (Astro
  otomatis, `esc()` di JS, `textContent` di daftar lengkap).

## 2. Alur data

```
Bot ──(service_role, daftar DIGANTI utuh)──► showcase_snapshot (CMS, 1 baris)
Admin ── /admin/showcase ──► showcase_hidden (+ showcase_hidden_log)
Build ── RPC showcase_public_list() (anon, memfilter yang tersembunyi) ──► HTML
Browser ── klik "Lihat semua" ──► /data/showcase.json (berkas statis hasil build)
```

SQL: `supabase/showcase-servers.sql` (aditif, idempoten), rollback
`supabase/showcase-servers-rollback.sql`, tes `supabase/tests/showcase-servers.test.sql`
(`npm run test:sql`). Terapkan lewat Supabase MCP `apply_migration` di proyek
`lvfwopnvvqncopvathop`. Tabel tidak punya policy anon; publik hanya lewat RPC.

## 3. Kode

| Berkas | Isi |
|---|---|
| `src/lib/showcase-model.ts` | Model murni + `fetchShowcase()` (diuji `tests/showcase-model.test.ts`): validasi ketat, sampel berbenih, layout, format |
| `src/lib/showcase.ts` | Menghubungkan env Astro, cache satu build |
| `src/components/ServerShowcase.astro` | Marquee (`compact` beranda, `wall` produk) + daftar lengkap (dialog) |
| `src/pages/data/showcase.json.ts` | Daftar lengkap statis untuk tombol "Lihat semua" |
| `src/pages/admin/showcase.astro` | Kelola server tersembunyi + riwayat |
| `src/lib/dashboard/share-server.ts`, `share-model.ts` | Kartu "Tampil di website" di tab Share Server |

## 4. SEO dan performa

- HTML hasil build **stabil**: sampel tetap per hari (benih tanggal UTC), urutan tetap.
  Sampel mengutamakan server dengan link Gabung valid dan member besar (`priorityOf`,
  70% slot, `PRIORITY_SHARE`), sisanya bergilir harian dari semua server lain supaya
  server kecil juga tampil. Pengacakan urutan tampilan, penggandaan baris gelung,
  dan animasi hanya di browser. Teks halaman tidak menyebut kata "acak" supaya
  terkesan komunitas, bukan undian.
- Hanya sampel di HTML (36 di beranda, 90 di produk). Daftar lengkap dimuat saat
  diklik dan diurutkan acak tiap dibuka (tidak terbesar dulu), jadi server kecil ikut terlihat. Konsekuensinya tidak semua server selalu ada di HTML, dan itu disengaja.
- Link undangan `rel="nofollow ugc noopener noreferrer"` (konten buatan pengguna).
- Tanpa layout shift: kartu berukuran tetap, gambar punya `width`/`height` dan
  `loading="lazy"`, animasi hanya `transform`. Ikon gagal dimuat diganti inisial.
- Aksesibilitas: tombol "Jeda gerakan", berhenti saat hover/fokus dan saat di luar
  layar, `prefers-reduced-motion` mematikan gerakan (baris bisa digeser manual).
- Layout menyesuaikan jumlah: kurang dari 3 server seksi disembunyikan, 3 sampai 7
  statis, 8 ke atas marquee.
- Build gagal membaca daftar (atau daftar lebih tua dari 7 hari) = seksi
  disembunyikan, build tetap jalan. Ini sengaja berbeda dari blog.
- Pembangunan ulang harian dijadwalkan di `.github/workflows/deploy.yml` (cron).
  Daftar baru tayang paling lambat sehari setelah bot menerbitkannya.

## 5. Langkah pemilik

1. Terapkan `supabase/showcase-servers.sql` (jika belum diterapkan oleh Claude).
2. Merge PR bot, lalu Update & Restart bot (migration 0023 otomatis). Bot menerbitkan
   daftar pertama sekitar 2 menit setelah hidup.
3. Merge PR website. Build berikutnya (atau jalankan workflow Deploy manual) memuat daftar.
4. Umumkan ke admin server (broadcast dilakukan pemilik) bahwa server tampil secara
   bawaan dan bisa dimatikan di Dashboard › Share Server.
