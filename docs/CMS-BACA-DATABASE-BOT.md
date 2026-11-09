# CMS membaca Database Bot sesuai permintaan

Keputusan pemilik 2026-11-09 (CLAUDE.md, "Pengecualian kedua" dan "Tujuan utama:
hemat sumber daya database"). Halaman CMS admin membaca data Game Hub, Sosial Hub,
dan Server Hub langsung dari proyek **Database Bot** saat halaman dibuka, bukan dari
snapshot yang didorong bot ke proyek CMS tiap 10 sampai 30 detik. Item kerja:
`claudereport.md` bot, PLAN-006.

## Arsitektur

```
browser admin (JWT sesi CMS)
   │  POST { view }  (Authorization: Bearer <JWT CMS>)
   ▼
Edge Function `cms-read` (proyek Database Bot, verify_jwt = false)
   1. peran admin: GET admin_users?id=eq.<sub> ke PostgREST CMS dengan JWT yang sama
      (PostgREST CMS yang memverifikasi tanda tangan; peran owner/admin/viewer; cache 60 dtk)
   2. cache hasil per tampilan 60 dtk (satu panggilan melayani semua admin)
   3. RPC `cms_read_<view>()` dengan service_role (hanya di dalam fungsi)
   ▼
Postgres Database Bot: fungsi SECURITY DEFINER, hanya service_role boleh EXECUTE
```

Kode: `supabase/functions/cms-read/` (`logic.ts` murni dan dites di
`tests/cms-read.test.ts`), klien `src/lib/cms-read/client.ts`, model tampilan
`src/lib/cms-read/serverhub-model.ts`. Fungsi SQL: `migrations/0026_cms_read.sql`
di repo bot (idempoten, tabel tidak diubah).

## Keamanan

- Hanya baca dan hanya angka agregat. Aksi ke bot tetap lewat `bot_commands`.
- `service_role` hanya ada di lingkungan Edge Function. Browser tidak pernah
  memegangnya. `anon` dan `authenticated` dicabut dari fungsi baca.
- Token palsu ditolak PostgREST CMS (403), token tanpa baris `admin_users` ditolak (403),
  tanpa token 401, selain POST 405, tampilan di luar daftar 400. CORS hanya untuk
  `vanillate.id`, `www.vanillate.id`, dan localhost dev.
- `sub` dibaca dari JWT tanpa verifikasi hanya untuk menyaring baris; verifikasi
  tanda tangan tetap di PostgREST CMS. Owner bisa melihat semua baris
  `admin_users`, karena itu filter `id = sub` wajib.
- Tidak ada Discord ID, nama pemain, atau isi pesan di hasil.

## Biaya (perkiraan dan pengukuran 2026-11-09)

- Satu pemanggilan `cms_read_serverhub()` = sekitar 20 `COUNT` pada tabel kecil,
  sekitar 83 ms pada pengukuran pertama.
- Cache 60 detik di fungsi dan `Cache-Control: private, max-age=30` di respons:
  paling banyak satu panggilan database per menit per tampilan, berapa pun jumlah
  admin yang membuka halaman. Tanpa admin yang membuka, biayanya **nol**.
- Pembanding: snapshot dorong menjalankan query hitung terus-menerus (satu keluarga
  query campaign saja sekitar 590 detik waktu database dalam 11 hari, untuk data
  268 byte). Lihat `docs/hemat-sumber-daya-database.md` di repo bot.
- Pemeriksaan peran: satu GET ke CMS per token per menit (di-cache).

## Menambah tampilan baru

1. Migration di repo bot: `public.cms_read_<nama>()` (`security definer`, `stable`,
   `set search_path = ''`, agregat saja), `revoke ... from public, anon, authenticated`,
   `grant execute ... to service_role`. Terapkan lewat Supabase MCP `apply_migration`
   ke Database Bot, ukur dengan `explain analyze`.
2. `logic.ts`: tambah `RPC_BY_VIEW`, `CACHE_TTL_MS`; deploy ulang fungsi
   (`verify_jwt = false`).
3. Website: model murni + tes, halaman yang memanggil `bacaCms('<nama>')`, entri menu
   di `src/lib/admin-menu.ts`.
4. Catat perkiraan biaya di deskripsi PR.

## Deploy dan rollback

- Deploy: Supabase MCP `deploy_edge_function` ke proyek `ggsshrnpgnfqvlhzxnoq`,
  nama `cms-read`, `verify_jwt = false`. URL: `<PUBLIC_BOT_SUPABASE_URL>/functions/v1/cms-read`.
- URL dan kunci publishable CMS adalah bawaan di kode (nilai publik); env
  `CMS_SUPABASE_URL`, `CMS_SUPABASE_ANON_KEY`, `CMS_READ_ALLOWED_ORIGINS` hanya untuk menimpa.
- Rollback: hapus fungsi `cms-read` dan halaman; `drop function public.cms_read_serverhub()`
  tidak mengubah data apa pun.
