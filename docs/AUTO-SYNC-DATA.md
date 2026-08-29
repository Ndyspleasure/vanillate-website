# 🔄 Auto-Sync Data: Repo Bot → Website

Website **vanillate.id** menampilkan sebagian data game (harga shop, fitur &
command, versi bot, changelog) yang **sumber kebenarannya ada di repository bot**
`Ndyspleasure/sambung-kata-bot`. Data itu ditarik otomatis, jadi **cukup ubah
data di repo bot → website memakainya & re-deploy sendiri**, tanpa mengedit kode
website.

---

## 1. Konsep

```
   Repo bot (source of truth)                Website (vanillate.id)
   ────────────────────────                  ──────────────────────
   config-data/shop.json      ─┐
   config-data/bot-info.json   │   GitHub    ┌─ src/data/synced/*.json
   version.json                ├─► Actions ──►│  (di-commit bila berubah)
   CHANGELOG.json             ─┘  (sync)     └─ build + deploy ke Pages
                                  tiap 1 jam
                                  + manual
```

Perubahan yang **tidak** mengubah data tidak memicu deploy — tidak ada rebuild
sia-sia.

Perkiraan waktu tayang, keterlambatan jadwal GitHub, dan cara menerbitkan
segera dibahas terpisah di [`PIPELINE-TERBIT.md`](./PIPELINE-TERBIT.md).

---

## 2. Data yang disinkronkan

| Sumber (repo bot) | Tujuan (website) | Dipakai di |
|---|---|---|
| `config-data/shop.json` | `src/data/synced/shop.json` | Tabel harga shop (token `{{shop-table}}` di jawaban FAQ) |
| `config-data/bot-info.json` | `src/data/synced/bot-info.json` | Fitur & command di katalog/detail bot |
| `version.json` | `src/data/synced/version.json` | Versi bot di halaman `/status` |
| `CHANGELOG.json` | `src/data/synced/changelog.json` | Changelog di `/status` |

`src/data/synced/_status.json` dibuat oleh workflow untuk mencatat kapan & dari
commit mana sinkron terakhir (ditampilkan di halaman **`/status`**).

---

## 3. Setup (WAJIB sekali) — token akses repo bot privat

Repo bot **privat**, jadi Actions website butuh token untuk membacanya
(GITHUB_TOKEN bawaan hanya bisa akses repo website sendiri).

1. Buat **Fine-grained Personal Access Token**: GitHub → Settings → Developer
   settings → Fine-grained tokens → *Generate new token*.
   - **Resource owner:** Ndyspleasure
   - **Repository access:** Only select repositories → `sambung-kata-bot`
   - **Permissions:** Repository permissions → **Contents: Read-only**
   - Set masa berlaku secukupnya (mis. 1 tahun) & catat untuk diperbarui.
2. Salin tokennya.
3. Di repo **vanillate-website**: Settings → Secrets and variables → Actions →
   *New repository secret*:
   - **Name:** `BOT_REPO_TOKEN`
   - **Secret:** tempel token tadi.

Selesai. Workflow otomatis memakainya. Tanpa secret ini, sync **gagal dengan
aman** (tidak ada data yang berubah / rusak; halaman `/status` tetap
menampilkan data terakhir yang baik).

> Jika suatu saat repo bot dijadikan **publik**, token tidak wajib lagi (boleh
> dihapus) — workflow tetap jalan tanpa auth.

---

## 4. Cara mengubah data

1. Edit file data di repo bot (mis. ganti `harga` di `config-data/shop.json`,
   atau tambah item fitur di `config-data/bot-info.json`). Merge ke `main`.
2. Tunggu sinkronisasi terjadwal (tiap jam, sering molor — lihat
   [`PIPELINE-TERBIT.md`](./PIPELINE-TERBIT.md) bagian 5) **atau** picu manual:
   repo website → tab **Actions** → workflow **“Sync data dari bot repo”** →
   **Run workflow**.
3. Bila ada perubahan, website commit data baru & re-deploy otomatis. Cek
   hasilnya di halaman **/status**.

Untuk versi & changelog, cukup rilis versi baru di bot seperti biasa
(`version.json` + `CHANGELOG.json` ter-update) — website mengikutinya sendiri.

---

## 5. Keamanan & penanganan error

- **Validasi sebelum pakai.** `scripts/sync-data.mjs` memvalidasi bentuk tiap
  file. File yang gagal fetch/parse/validasi **tidak ditimpa** — versi terakhir
  yang baik (sudah ter-commit) dipertahankan. Website tidak pernah menampilkan
  data corrupt.
- **Deploy hanya bila data berubah.** Deteksi perubahan hanya pada file data
  (bukan timestamp status), jadi tidak ada deploy sia-sia.
- **Gagal total = alarm, bukan kerusakan.** Bila tidak ada satu pun file bisa
  ditarik (mis. token salah), job Actions berwarna merah sebagai peringatan,
  tetapi tidak ada perubahan pada situs.
- **Tahan terhadap `main` yang bergerak.** Run terjadwal bisa menunggu lama di
  antrean GitHub, dan selama itu `main` bisa maju karena PR lain. Workflow
  karena itu checkout dengan `ref: main` (selalu versi terbaru) dan melakukan
  `git pull --rebase origin main` sebelum push, dengan 3× percobaan. Tanpa itu
  push ditolak `! [rejected] … (fetch first)` dan data yang sudah ditarik tidak
  pernah terbit.

---

## 6. Status & log

- **Halaman publik:** [`/status`](https://vanillate.id/status) — waktu sinkron
  terakhir, commit sumber, versi bot, changelog, dan rincian per file.
- **File status:** `src/data/synced/_status.json` (di-commit tiap sinkron yang
  mengubah data).
- **Log run:** repo website → tab **Actions** → workflow *Sync data dari bot
  repo* → pilih run untuk melihat log tiap langkah.

---

## 7. Rollback (kalau update dari repo bermasalah)

Karena semua perubahan data lewat commit, rollback = kembalikan commit.

**A. Data website terlanjur salah (cara tercepat):**
```bash
# di repo website
git revert <sha-commit-"chore(data): sync...">
git push
```
Deploy otomatis jalan lagi dengan data lama yang benar.

**B. Perbaiki di sumbernya (dianjurkan):**
`git revert` / perbaiki data di **repo bot**, lalu jalankan workflow sync manual.
Website akan menyusul ke data yang sudah benar.

**C. Bekukan sementara auto-sync:**
Repo website → Actions → workflow *Sync data dari bot repo* → menu **⋯** →
**Disable workflow**. Aktifkan lagi (**Enable workflow**) saat sudah siap.

---

## 8. Menambah data baru untuk disinkron

1. Tambahkan file JSON di repo bot (mis. `config-data/quests.json`).
2. Di repo website, tambahkan target di `scripts/sync-data.mjs` (array
   `TARGETS`) beserta validator bentuknya, dan sebutkan file itu di langkah
   commit workflow `.github/workflows/sync-data.yml`.
3. Konsumsi datanya lewat `import ... from '../data/synced/<file>.json'` di
   komponen/halaman terkait.

---

## 9. Troubleshooting

| Gejala | Kemungkinan sebab |
|---|---|
| Job sync merah, log `404` | `BOT_REPO_TOKEN` belum di-set / tidak punya akses Contents ke repo bot, atau path file salah. |
| Job sync merah, log `401/403` | Token kedaluwarsa atau rate-limit. Perbarui token. |
| Data tidak berubah di web | Belum ada perubahan data (deploy memang dilewati), atau workflow belum jalan — picu manual dari Actions. |
| Job sync merah, log `! [rejected] … (fetch first)` | `main` maju saat run berjalan dan ketiga percobaan rebase+push gagal (jarang). Jalankan ulang run-nya. |
| `/status` menunjukkan “Perlu perhatian” | Salah satu file gagal disinkron; website memakai data lama. Cek log run. |

---

## 10. Batasan

- Sinkronisasi **satu arah**: repo bot → website. Jangan edit
  `src/data/synced/*.json` manual di repo website; akan tertimpa saat sync.
- File data harus JSON valid & ≤ ~1 MB (batas GitHub Contents API).
- Jadwal GitHub Actions bisa meleset **jauh** dari waktu pas — pernah terpantau
  4 jam untuk workflow ini. Untuk update segera, gunakan **Run workflow**
  manual. Rinciannya di [`PIPELINE-TERBIT.md`](./PIPELINE-TERBIT.md).
- Perubahan pada file workflow baru berlaku di run berikutnya: run terjadwal
  memakai isi workflow dari saat ia diantrekan.
