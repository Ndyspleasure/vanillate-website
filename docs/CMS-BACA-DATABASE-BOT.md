# CMS membaca data bot sesuai permintaan

Keputusan pemilik 2026-11-09 (CLAUDE.md, "Pengecualian kedua" dan "Tujuan utama:
hemat sumber daya database"). Halaman CMS admin membaca ringkasan Game Hub, Sosial Hub,
dan Server Hub saat halaman dibuka, bukan dari snapshot yang didorong bot tiap 10 sampai
30 detik. Item kerja: `claudereport.md` bot, PLAN-006 dan HO-037.

## Arsitektur sekarang (HO-037; data game di VPS sejak cutover 2026-11-22)

```
browser admin (JWT sesi CMS)
   │  1. riwayat read.<tampilan> terbaru masih segar (< 60 dtk)? pakai ulang, selesai
   │  2. INSERT bot_commands { type: 'read.serverhub', payload: {} }   (RLS proyek CMS)
   ▼
bot (PostgreSQL lokal di VPS)
   verifikasi ulang peran pembuat dari admin_users, jalankan handler `read.serverhub`
   (src/cms/handlers/read.js di repo bot): beberapa COUNT, cache 60 dtk di memori
   │  3. hasil ditulis ke bot_commands.result
   ▼
browser: kirimPerintah() menunggu hasilnya (src/lib/dev-panel/client.ts)
```

Kode: klien `src/lib/cms-read/client.ts`, pemakaian ulang `src/lib/cms-read/reuse.ts`
(dites di `tests/cms-read-reuse.test.ts`), model tampilan
`src/lib/cms-read/serverhub-model.ts`. Sisi bot: `src/cms/handlers/read.js`, peran
`viewer` untuk tipe `read.*` di `src/cms/registry.js`.

## Keamanan

- Hanya baca dan hanya angka agregat, tanpa Discord ID, nama pemain, atau isi pesan.
  Aksi ke bot tetap lewat `bot_commands` dengan tipe biasa.
- Tipe `read.*` berperan **viewer** (semua akun admin CMS boleh). Policy RLS
  `viewer tambah bot_commands baca-saja` (`supabase/bot-commands-viewer-read.sql`,
  rollback dan tes menyertai) mengizinkan INSERT hanya untuk: akun admin, atas nama
  dirinya, status `pending`, tipe `^read\.[A-Za-z][A-Za-z0-9.]{0,63}$`, payload maksimal
  2 KB. Perintah lain tetap hanya owner dan admin, `sys.*` tetap hanya owner.
- Bot memverifikasi ulang peran pembuat dari `admin_users` dan wajib menjaga setiap
  handler `read.*` baca-saja dan `quiet` (dijaga `test/cms.test.js` di repo bot).
- `service_role` dan `DATABASE_URL` tidak ada di browser maupun kode website.

## Biaya

- Tanpa admin yang membuka halaman: **nol**. Tidak ada polling dan tidak ada snapshot.
- Satu pembukaan halaman: satu INSERT `bot_commands`, beberapa pembacaan status (jeda 2
  sampai 3 detik) dan satu rangkaian ±12 `COUNT` di database lokal bot (sekitar 1 ms).
  Hasil dipakai ulang 60 detik (di klien dan di bot): beberapa admin dalam semenit yang
  sama tidak menambah pekerjaan. Egress Supabase database bot: nol (query berjalan di VPS).
- Jawaban bisa tertunda sampai beberapa detik (bot memeriksa antrean tiap 15 detik saat
  sepi), batas tunggu 40 detik.

## Menambah tampilan baru

1. Bot: handler `read.<nama>` di `src/cms/handlers/read.js` (agregat saja, `quiet: true`,
   cache 60 dtk) dan tes di `test/cms.test.js`.
2. Website: tambah `READ_TYPE` di `src/lib/cms-read/reuse.ts` dan `CmsView`, model murni
   + tes, halaman yang memanggil `bacaCms('<nama>')`, entri menu di `src/lib/admin-menu.ts`.
3. Catat perkiraan biaya di deskripsi PR.

## Riwayat: Edge Function `cms-read` (dipensiunkan)

Sebelum HO-037, data game ada di Supabase Database Bot dan halaman membaca lewat Edge
Function `cms-read` (`supabase/functions/cms-read/`, `verify_jwt = false`) yang memanggil
fungsi SQL `cms_read_serverhub()` dengan `service_role`. Klien sudah tidak memakainya.
Cutover database ke VPS sudah dilakukan (2026-11-22). Fungsi dan kodenya dibiarkan
sampai stabil ≥ 7 hari (2026-11-29), lalu dihapus (Edge Function, folder
`supabase/functions/cms-read/`, dan `drop function public.cms_read_serverhub()` di Database Bot;
izin pemilik, tercatat di `claudereport.md` bot HO-037), supaya rollback cutover tidak
membutuhkan deploy ulang. Perhatian: fungsi itu membaca tabel game di Supabase yang sejak
cutover tidak lagi diperbarui, jadi datanya basi dan tidak boleh dipakai.

## Rollback

- Policy: `supabase/bot-commands-viewer-read-rollback.sql` (viewer kembali tidak bisa
  mengantre apa pun). Tidak mengubah data.
- Kembali ke Edge Function: kembalikan `src/lib/cms-read/client.ts` ke versi sebelum HO-037
  (selama fungsi `cms-read` dan data game di Supabase masih ada).
