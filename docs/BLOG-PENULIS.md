# ✍️ Portal Penulis Blog (RANCANGAN, belum dibangun)

Status: **rancangan** (2026-11-12), disetujui garis besarnya oleh pemilik.
Tujuan: menulis blog pindah dari CMS admin ke portal sendiri
`/blog/masuk` dan `/blog/dashboard`, mirip Portal Partner. Siapa pun boleh
mendaftar jadi penulis. Tulisan baru masuk antrean persetujuan di CMS. Sanity
tetap menjadi tempat tulisan **yang sudah terbit**.

## 1. Keputusan pemilik

| # | Keputusan |
|---|---|
| 1 | Pendaftaran terbuka untuk semua orang. |
| 2 | Tulisan ditolak **tidak** langsung dihapus. Penulis merevisi dan mengajukan ulang. Riwayat menyimpan tulisan yang ditolak beserta alasannya. CMS punya tombol **hapus permanen**. |
| 3 | Penulis boleh mengunggah gambar sendiri. Editor memberi info bahwa gambar boleh dibuat dengan AI dan alt text boleh dibantu AI. |
| 4 | Email lewat Resend, sama seperti `live-chat-email`. |
| 5 | Editor lama di `/admin/blog/tulis` diganti seluruhnya oleh portal. Tim Vanillate juga menulis lewat portal. |
| 6 | Login **Google** (sumber email notifikasi). **Discord wajib ditautkan** sebelum mengajukan tulisan (verifikasi). |
| 7 | Tiap penulis punya dasbor sendiri dan halaman profil publik `/blog/penulis/<slug>`. Tim Vanillate (peran di `admin_users`) terbit langsung tanpa antrean. |
| 8 | Tulisan terbit yang diedit penulisnya masuk lagi ke antrean sebagai **revisi**. Versi lama tetap tayang sampai revisi disetujui. |

## 2. Arsitektur

```
/blog/masuk, /blog/dashboard   (halaman statis, klien Supabase sendiri,
   │                            storageKey 'vanillate-blog-auth')
   │  Google (signInWithOAuth) + tautkan Discord (linkIdentity)
   ▼
Edge Function blog-writer   (verify_jwt aktif, service_role hanya di sini)
   │  • cek Discord tertaut dari identitas auth (jangan percaya klien)
   │  • validasi isi (logic.ts → publishErrors, batas ukuran, batas harian)
   │  • simpan draf / ajukan ke tabel blog_submissions
   ▼
Supabase CMS (lvfwopnvvqncopvathop)   tabel blog_*, bucket privat blog-penulis
   ▼
/admin/blog (CMS)  → Edge Function blog-admin (aksi baru: antrean, setujui,
                     tolak, hapus permanen, blokir penulis)
   │  setujui → buat/ubah blogAuthor + blogPost di Sanity, salin gambar ke
   │            Sanity, dispatch build, email "disetujui"
   │  tolak   → status ditolak + alasan, email "ditolak"
   ▼
Sanity (dataset public, hanya yang SUDAH terbit) → build statis → /blog
```

Prinsip yang tetap berlaku (CLAUDE.md): browser hanya anon key dan JWT; token
Sanity, GitHub, dan Resend hanya secret Edge Function; **draf tidak pernah
ke Sanity** karena dataset-nya public.

## 3. Data (proyek CMS)

SQL aditif dan idempoten di `supabase/blog-writers.sql` (+ rollback + tes di
`supabase/tests/`). Semua tabel `ENABLE ROW LEVEL SECURITY` **tanpa policy**:
akses hanya lewat Edge Function.

- `blog_writers`: `user_id` (PK, `auth.users`), `display_name`, `slug`,
  `bio`, `avatar_path`, `links[]`, `discord_id`, `discord_username`,
  `status` (`aktif` | `diblokir`), `sanity_author_id`, `created_at`.
- `blog_submissions`: `id`, `writer_id`, `title`, `slug`, `excerpt`,
  `tldr[]`, `body` (Markdown), `categories[]`, `tags[]`, `main_image_path`,
  `main_image_alt`, `ai_image` (boolean), `status`
  (`draf` | `menunggu` | `ditolak` | `terbit`), `reject_reason`,
  `revision_of` (id Sanity bila ini revisi tulisan terbit), `submitted_at`,
  `reviewed_by`, `reviewed_at`, `sanity_id`, `updated_at`.
- `blog_review_log`: `submission_id`, `title`, `writer_id`, `action`
  (`ajukan` | `setujui` | `tolak`), `reason`, `actor`, `at`. Inilah **riwayat**
  yang menampilkan tulisan ditolak beserta alasannya.
- Bucket Storage privat `blog-penulis`, folder per penulis. Gambar dikompres di
  browser (sisi terpanjang 2000 px, WebP) dan dibatasi ukurannya. Setelah
  disetujui gambar disalin ke Sanity lalu berkas bucket dihapus.

**Hapus permanen** (owner dan admin CMS) menghapus baris tulisan, gambarnya,
dan entri log tulisan itu.

## 4. Alur

1. **Daftar/masuk.** Google. Penulis baru mengisi nama tampil, slug, dan bio.
2. **Tautkan Discord.** Tanpa Discord tertaut tombol Ajukan mati dan ada
   penjelasan. Draf tetap bisa disimpan.
3. **Tulis.** Editor Markdown yang sama dengan editor lama (toolbar, checklist
   SEO, kompres gambar, pratinjau), dipindah ke komponen bersama. Kotak info:
   gambar boleh dibuat AI (centang "dibuat dengan AI" bila ya) dan alt text
   wajib, boleh dibantu AI.
4. **Ajukan.** Status `menunggu`. Muncul di CMS › Blog › Antrean.
5. **Tinjau di CMS.** Setujui (terbit, email berisi tautan) atau Tolak
   (wajib alasan, email berisi alasan). Tulisan ditolak berstatus `ditolak`,
   penulis merevisi dan mengajukan lagi.
6. **Edit tulisan terbit.** Menjadi baris revisi `menunggu`. Disetujui:
   dokumen Sanity diperbarui dan situs dibangun ulang. Ditolak: versi lama
   tetap tayang.
7. **Tim Vanillate.** Email terverifikasi cocok dengan akun di `admin_users`
   (cara pencocokan dipastikan saat implementasi) dan tulisannya terbit
   langsung, tanpa antrean.

## 5. Keamanan dan anti-spam

- Email Google terverifikasi + Discord tertaut. Discord dibaca server dari
  identitas auth, bukan dari kiriman klien.
- Batas (angka awal, bisa diubah): maks. 3 tulisan menunggu sekaligus, maks. 5
  pengajuan per hari, isi maks. ±60 KB, maks. 10 gambar per tulisan.
- Penulis bisa diblokir dari CMS (`status = 'diblokir'`).
- Isi dari penulis luar **harus diperiksa** sebelum dibangun: renderer
  `markdown.ts` tidak boleh meneruskan HTML mentah. Tautan luar dari penulis
  non-tim diberi `rel="ugc nofollow noopener"`. Dites.
- Profil (bio, avatar, tautan) hanya disinkron ke dokumen `blogAuthor` Sanity
  saat tulisan disetujui, jadi ikut tertinjau.
- `/privacy` perlu memuat penjelasan data penulis (email, Discord).

## 6. Biaya sumber daya database

- Tidak ada polling dan tidak ada realtime. Dasbor dan antrean membaca saat
  halaman dibuka.
- Daftar mengembalikan kolom ringkas (tanpa `body`); isi penuh hanya dibaca saat
  satu tulisan dibuka.
- Tabel kecil (satu baris per tulisan). Log hanya menyimpan metadata.
- Storage hanya menampung gambar sementara sampai disetujui atau dihapus.
- Email hanya pada setuju, tolak, dan blokir: volume rendah. Cek kuota gratis
  Resend di dashboard-nya.
- Sanity: tulisan baru menambah aset gambar dan dokumen (lihat kuota di
  `docs/BLOG.md` §5). Pantau Usage setelah penulis luar mulai aktif.

## 7. Langkah manual owner (saat dibangun)

1. Supabase Auth: aktifkan **Discord provider** (buat aplikasi di Discord
   Developer Portal, isi client id dan secret, daftarkan redirect URL Supabase)
   dan aktifkan **manual linking** agar `linkIdentity` jalan.
2. Tambahkan `https://vanillate.id/blog/masuk` dan `/blog/dashboard` ke
   Redirect URLs Auth. Google sudah aktif untuk Live Chat.
3. Secret Edge Function: `RESEND_API_KEY` sudah ada. Tambah
   `BLOG_FROM_EMAIL` (mis. `Vanillate Blog <blog@vanillate.id>`) bila berbeda.
4. Deploy `blog-writer` dan `blog-admin` (versi baru), terapkan SQL lewat
   `apply_migration`.

## 8. Tahap pembangunan (PR terpisah)

1. **Skema + tes SQL** (`blog-writers.sql`, rollback, `supabase/tests/`).
2. **Edge Function `blog-writer`** + logika murni teruji (batas, validasi,
   status). `blog-admin`: aksi `reviewList`, `approve`, `reject`,
   `deleteSubmission`, `blockWriter`, pengirim email.
3. **Portal penulis**: `/blog/masuk`, `/blog/dashboard`, editor bersama,
   profil.
4. **CMS**: `/admin/blog` menjadi Semua Artikel, Antrean, Riwayat, Penulis.
   Hapus menu "Tulis Artikel" dan `/admin/blog/tulis` (atau alihkan ke portal).
5. **Dokumen**: perbarui `docs/BLOG.md`, `CLAUDE.md`, `docs/ADMIN-CMS.md`.

## 9. Pertanyaan terbuka

- Artikel lama di Sanity: penulisnya belum punya akun. Usul: biarkan, dan
  tautkan ke akun penulis saat orangnya mendaftar (dipilih admin di CMS).
- Riwayat setelah hapus permanen: usul ikut terhapus (sesuai arti "permanen").
