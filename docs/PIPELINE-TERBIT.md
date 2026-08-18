# 🚀 Pipeline Terbit — dari edit sampai tayang di vanillate.id

Dokumen ini menjawab satu pertanyaan: **“sudah saya ubah, kenapa belum berubah
di web?”** Isinya jalur datanya, perkiraan waktu yang jujur, cara menerbitkan
segera, dan cara membaca gejala saat ada yang macet.

Bacaan pendamping: [`ADMIN-CMS.md`](./ADMIN-CMS.md) (panel & tabel Supabase) dan
[`AUTO-SYNC-DATA.md`](./AUTO-SYNC-DATA.md) (data dari repo bot).

---

## 1. Ada tiga jalur, dan hanya dua yang lewat build

```
  (A) CMS → halaman publik                      lambat: harus build ulang
      /admin  →  Supabase  →  sync-content.yml  →  commit  →  build  →  Pages

  (B) Repo bot → halaman publik                 lambat: harus build ulang
      config-data/*.json, version.json, CHANGELOG.json
              →  sync-data.yml  →  commit  →  build  →  Pages

  (C) Bot ↔ panel /admin                        cepat: tanpa build sama sekali
      bot  →(service_role)→  Supabase  →(anon + RLS)→  panel dibaca di browser
      bot  ←(polling 20–60 dtk)←  bot_settings / bot_commands
```

Yang sering disangka “integrasi error” biasanya jalur **A atau B** yang masih
menunggu jadwal — bukan jalur C. Jalur C tidak pernah menunggu build: panel
membaca Supabase langsung dari browser, dan bot menarik perubahan setting tiap
60 detik (`remoteConfig.js`) serta antrean perintah tiap 20 detik
(`remoteCommands.js`).

**Cara membedakannya dalam 10 detik:** buka `/admin/logs`. Kalau log terbaru
berumur beberapa detik/menit, bot–Supabase sehat dan yang kamu tunggu adalah
build.

---

## 2. Berapa lama sampai tayang

| Yang diubah | Workflow | Jadwal | Realistis sampai tayang |
|---|---|---|---|
| Banner pengumuman (`/admin/konten`) | `sync-content.yml` | tiap 15 menit | ~5–45 menit |
| Konten & harga Partnership (`/admin/partnership/*`) | `sync-content.yml` | tiap 15 menit | ~5–45 menit |
| Versi, changelog, shop, fitur/command (repo bot) | `sync-data.yml` | tiap jam | ~1–2 jam |
| Setting bot (`/admin/kontrol`) | — | polling bot | **≤ 60 detik** |
| Aksi bot (`/admin/operasi`) | — | polling bot | **≤ 20 detik** |
| Angka & log di panel admin | — | tulisan bot | 30 dtk (log) – 15 mnt (pemain) |

Kolom terakhir sudah termasuk build + deploy Pages (~2–3 menit) dan
keterlambatan jadwal GitHub yang wajar. Butuh lebih cepat dari itu? Lihat
bagian 4.

---

## 3. Kenapa tidak bisa instan

Situs ini **statis** di GitHub Pages: halaman publik tidak melakukan query apa
pun ke Supabase. Data dibaca sekali saat *build* dari `src/data/synced/*.json`,
lalu ikut ter-bake ke HTML. Jadi setiap perubahan konten butuh build ulang.

Itu keputusan sadar, bukan kelalaian:

- Tabel `site_content` dan `partnership_*` dijaga **RLS** — hanya admin yang
  boleh membacanya. Kalau halaman publik membacanya langsung, tabel-tabel itu
  harus dibuka untuk `anon`.
- Pengunjung cukup menerima HTML biasa: nol query, nol kunci, halaman cepat, dan
  situs tetap hidup walau Supabase sedang bermasalah.

Konsekuensinya jelas: **kecepatan ditukar dengan kesederhanaan & keamanan.**
Kalau suatu saat butuh benar-benar real-time untuk banner, opsinya ada di
bagian 8.

---

## 4. Menerbitkan segera (tanpa menunggu jadwal)

1. Buka repo website → tab **Actions**.
2. Pilih workflow:
   - **Sync konten dari Supabase** — untuk perubahan dari panel `/admin`.
   - **Sync data dari bot repo** — untuk versi, changelog, shop, fitur/command.
3. Klik **Run workflow** → pilih branch `main` → **Run workflow**.

Selesai dalam ~2–3 menit. Kalau tidak ada perubahan, workflow berhenti lebih
awal dan menulis `✓ … tidak berubah — lewati deploy` (itu normal, bukan error).

---

## 5. Kenapa jadwalnya sering meleset jauh

Cron GitHub Actions adalah **antrean, bukan janji**. Repo publik memakai runner
bersama, jadi run terjadwal bisa tertunda — kadang menit, kadang jam. Contoh
nyata dari repo ini pada 18 Agustus 2026 (WIB +7 dari waktu di log):

| Slot cron | Benar-benar jalan | Telat |
|---|---|---|
| 12:15 | 13:06 | 51 menit |
| 13:15 | 13:56 | 41 menit |
| 15:15 | 16:30 | 45 menit |
| 12:00 (`sync-data`) | 16:31 | **4 jam 11 menit** |

Karena itu jadwalnya dirapatkan (15 menit / 1 jam) supaya antrean lebih sering
diisi, dan **Run workflow** tetap jadi jalan pintas resmi saat butuh sekarang.

---

## 6. Dua jebakan yang sudah ditutup di workflow

### a. Push ditolak karena `main` sudah maju

Run terjadwal memakai *snapshot* repo dari saat ia diantrekan. Kalau selama
menunggu ada PR yang di-merge, `git push` di akhir sync ditolak:

```
! [rejected]  main -> main (fetch first)
error: failed to push some refs
```

Itu benar-benar terjadi pada run 18 Agustus 16:31: data v2.40.0 berhasil
ditarik, di-commit, lalu **gagal terbit** karena PR #19 sudah merge pukul 15:52.
Halaman `/status` tetap menampilkan v2.39.0 sampai jadwal berikutnya.

Penjagaannya sekarang ada dua lapis di `sync-content.yml` & `sync-data.yml`:

- `actions/checkout` dipanggil dengan **`ref: main`** → runner selalu bekerja di
  atas `main` terbaru, bukan snapshot lama;
- sebelum push, workflow menjalankan **`git pull --rebase origin main`** dan
  mengulang sampai 3 kali kalau ada yang push berbarengan. Gagal tiga kali =
  job merah dengan pesan jelas, bukan diam-diam hilang.

> **Catatan yang tidak bisa dihindari:** *isi file workflow* sendiri tetap
> diambil dari versi saat run diantrekan — itu perilaku GitHub. Jadi setelah
> mengubah file workflow, run pertama sesudahnya mungkin masih memakai versi
> lama. Cukup tunggu satu siklus, atau picu manual lewat **Run workflow**.

### b. Deploy yang dibatalkan di tengah jalan

Ketiga workflow berbagi `concurrency: group: pages`. Dulu `deploy.yml` memakai
`cancel-in-progress: true`, yang bisa membunuh run sync **setelah** ia menekan
commit ke `main` tetapi **sebelum** sempat deploy. Akibatnya isi baru ada di
repo tapi tidak tayang — dan sync berikutnya melihat “tidak ada perubahan”
sehingga situs tertinggal diam-diam.

Sekarang ketiganya `cancel-in-progress: false`: deploy **mengantre**, tidak
saling membunuh. Konsekuensinya, dua push berdekatan menghasilkan dua deploy
berurutan (beberapa menit lebih lama) — pertukaran yang sepadan.

---

## 7. Membaca status tanpa salah paham

`src/data/synced/_status.json` **hanya di-commit saat file datanya berubah** —
kalau tidak, tiap sync akan melahirkan commit kosong tiap jam. Artinya:

> Waktu di `/status` dan `/admin` adalah **kapan data terakhir berubah**, bukan
> kapan terakhir diperiksa.

Jadi tulisan “Data terakhir berubah: kemarin” itu **normal** selama bot memang
belum merilis apa pun. Untuk memastikan pemeriksaannya jalan, lihat tab
**Actions** — di situ tercatat tiap run, termasuk yang berakhir “tidak berubah”.

---

## 8. Kalau nanti butuh lebih cepat

| Opsi | Efek | Harga yang dibayar |
|---|---|---|
| Tombol **Terbitkan sekarang** di panel admin (`repository_dispatch` ke Actions) | Terbit ~2–3 menit sejak diklik | Butuh token PAT tersimpan untuk panel; permukaan serangan bertambah |
| Halaman publik membaca Supabase langsung di browser | Perubahan instan tanpa build | Tabel terkait harus dibuka `select` untuk `anon`; halaman butuh JS & ikut mati bila Supabase mati |
| Rapatkan cron lagi (mis. 5 menit) | Rata-rata tunggu turun sedikit | Kuota Actions terbakar; keterlambatan antrean GitHub tetap tidak hilang |

Rekomendasi saat ini: pertahankan pola build, dan tambahkan tombol terbit
kalau frekuensi edit CMS sudah tinggi.

---

## 9. Troubleshooting

| Gejala | Yang sebenarnya terjadi | Tindakan |
|---|---|---|
| Edit CMS belum tampil setelah beberapa menit | Menunggu jadwal sync | **Run workflow** manual, atau tunggu ≤15 menit |
| Versi/changelog di web tertinggal dari bot | `sync-data` belum jalan sejak rilis | Jalankan **Sync data dari bot repo** manual |
| Job sync merah, log `! [rejected] … (fetch first)` | `main` maju saat run berjalan | Sudah ditangani rebase otomatis; kalau tetap gagal 3×, jalankan ulang run-nya |
| Job sync merah, log `404` / `401` / `403` | `BOT_REPO_TOKEN` salah, kedaluwarsa, atau kurang izin | Perbarui secret (lihat `AUTO-SYNC-DATA.md` bagian 3) |
| Workflow hijau tapi isi tidak berubah | Memang tidak ada perubahan data | Cek nilainya di Supabase; kalau field-nya belum ikut disinkron, tambahkan di `scripts/sync-*.mjs` |
| Panel admin kosong / angka nol | Bot belum menulis ke Supabase | Cek `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY` di server bot, lalu `/admin/logs` |
| Setting di `/admin/kontrol` tidak berefek di bot | Bot belum menarik, atau env bot kosong | Tunggu ≤60 detik; kalau tetap, cek log bot `[RemoteConfig] Aktif` |

---

## 10. File yang mengatur pipeline ini

| File | Perannya |
|---|---|
| `.github/workflows/sync-content.yml` | Supabase → `site-content.json` + `partnership.json` → build & deploy |
| `.github/workflows/sync-data.yml` | Repo bot → `shop/bot-info/version/changelog.json` → build & deploy |
| `.github/workflows/deploy.yml` | Build & deploy tiap push ke `main` |
| `scripts/sync-content.mjs` | Query Supabase + sanitasi nilai dari CMS |
| `scripts/sync-data.mjs` | Fetch file repo bot + validasi bentuk, pertahankan last-good |
| `src/data/synced/*.json` | Hasil sync — **jangan diedit manual**, akan tertimpa |
| `src/pages/status.astro` | Halaman `/status` publik |
| `src/pages/admin/dashboard.astro` | Kartu status sinkronisasi di panel |
