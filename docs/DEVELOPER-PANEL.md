# 🧭 Panel Developer (V3) — CMS Admin menggantikan `/developer`

Sejak bot **Sambung Kata v3.0.0**, slash command `/developer` di Discord dihapus.
Semua fitur Developer Dashboard lama dijalankan dari CMS ini. Pasangan dokumen di
repo bot: `sambung-kata-bot/docs/panel-developer-cms.md` (handler, peta fitur
lama → baru, cara menambah aksi).

## 1. Arsitektur singkat

| Arah | Tabel | Siapa menulis | Siapa membaca |
|---|---|---|---|
| website → bot | `bot_commands` (antrean perintah) | admin login (INSERT `pending`) | bot (service_role): klaim, eksekusi, tulis `status`/`result`/`error`/`progress`/`heartbeat_at` |
| bot → website | `bot_panel_snapshots` (11 key: `system`, `games`, `polls`, `broadcast`, `events`, `errors`, `tutorial`, `campaign`, `social`, `autoheal`, `words`) | bot (service_role) | admin login |
| bot → website | storage `bot-backups` (privat) | bot | **owner** saja (signed URL ±10 menit) |
| state | `bot_settings` (sudah ada) | admin di `/admin/kontrol` | bot (`remoteConfig`) |

- Browser **hanya** memegang anon key + JWT admin. Token bot, service_role key,
  dan kredensial database tidak pernah ada di website (`src/lib/dev-panel/client.ts`).
- Setiap perintah divalidasi ulang di bot. Validasi di website
  (`src/lib/dev-panel/model.ts`) hanya umpan balik cepat.

## 2. Peran

| Peran | Bisa |
|---|---|
| `viewer` | Melihat semua halaman & snapshot. **Tidak bisa** mengirim perintah (ditolak RLS). |
| `admin` | Semua perintah biasa (pemain, game, broadcast biasa, kata, promo, event, error, tutorial per pemain, campaign, sosial). |
| `owner` | Semua di atas + perintah `sys.*`: restart/update bot, backup DB, bersihkan log, reset tutorial massal, keputusan & kontrol Auto-Heal, broadcast 🚨 Darurat. |

Lapisan penjaga: RLS INSERT `bot_commands` (admin, `created_by = auth.uid()`) →
trigger `bot_commands_owner_guard` (`sys.*` hanya owner) → bot membaca ulang peran
pembuat dari `admin_users` → validasi payload per handler. Konfirmasi ketik di UI
(`RESTART`, `UPDATE`, `RESET SEMUA`, `BROADCAST`, `DARURAT`) adalah lapis kenyamanan.

## 3. Halaman

| Halaman | Isi |
|---|---|
| `/admin/developer` | Ringkasan & sistem (server, game aktif, kesehatan, versi & changelog read-only, maintenance/pengumuman, statistik DB & ekonomi), **Live Log** (`log.tail`) |
| `/admin/developer/kontrol-server` | **Owner**: cek update → Update & Restart (ketik `UPDATE`), Restart (ketik `RESTART`), backup DB + unduh (signed URL) + hapus, bersihkan log |
| `/admin/games` | Monitor game semua mode + aksi per room (End, Force Turn, Set Word, Eliminate, Revive, Spawn Event) + broadcast ke semua game aktif |
| `/admin/pemain` | Cermin `bot_players` + **Kelola pemain** (profil live `player.view` + semua aksi per pemain), **Ranking live** (`player.list`), **Banned** (`player.banned`, unban) |
| `/admin/kata` | Statistik (snapshot `words`), antrean pending (terima/tolak), cari kata, review ulang cepat, export TXT/CSV (membuat sesi), review massal (`word.bulk`) |
| `/admin/promo` | Daftar promo, analitik per kode, nyalakan/matikan, buat & ubah promo |
| `/admin/developer/broadcast` | Composer DM (Semua / 👑 Owner server / 🛡️ Owner + Admin / 🚨 Darurat (owner) / 🧪 Test), pratinjau, polling opsional, progres live, riwayat |
| `/admin/developer/polling` | Polling aktif & riwayat, pemilih per opsi, batalkan polling |
| `/admin/developer/event` | Peluang event (jumlah ≤ 1), statistik & reset, perilaku Penjajah |
| `/admin/developer/error` | Error terbaru, detail Error ID, ubah status, fingerprint, recovery |
| `/admin/developer/tutorial` | Status tutorial seluruh pemain, sesi berjalan, aksi per pemain, reset massal (owner) |
| `/admin/developer/campaign` | Statistik DM campaign + kirim paksa ke satu pemain |
| `/admin/developer/sosial` | Social Monitor: server pemakai SocialHub, detail, atur/matikan channel fitur, ✍️ Pemantau Kata-Kata |
| `/admin/developer/autoheal` | Status & breaker, approval tertunda (keputusan owner), buka kunci deploy, uji sandbox, simulasi heal, incident, izin aktif |
| `/admin/operasi` | Konsol semua aksi sederhana + **riwayat perintah** |
| `/admin/kontrol` | Setting (state): maintenance, pengumuman (+ judul), changelog di lobby, gerbang tutorial, DM campaign/hari, mode, tunable, fitur |

Semua halaman: status loading → menunggu bot → hasil/error dari bot, peringatan
"bot mungkin offline" bila snapshot > 2 menit, dan perintah yang belum dijawab
tetap di antrean (bisa dicek di riwayat).

## 4. Kode

| Berkas | Peran |
|---|---|
| `src/lib/dev-panel/client.ts` | `kirimPerintah` (INSERT + tunggu hasil, polling 1–3 dtk), `bacaPerintah`, `riwayatPerintah`, `bacaSnapshot(s)`, `muatUlangDariBot` (`panel.refresh`) |
| `src/lib/dev-panel/model.ts` | Logika murni tanpa DOM (peran, kesegaran, format, validasi broadcast/event, label mode) — diuji `tests/dev-panel-model.test.ts` |
| `src/lib/dev-panel/ui.ts` | Potongan tampilan (`stat`, `table`, `section`, `pill`, `freshness`, `progressBar`) + `formCard`/`pasangAksi` (satu-satunya jalur form → perintah) + `unduhTeks` |
| `src/lib/dev-panel/actions.ts` | Registry form aksi sederhana (`GRUP`) dipakai `/admin/operasi`, `/admin/pemain`, `/admin/promo`, `/admin/developer/tutorial`, `/admin/developer/campaign` |

Semua teks dari bot/Discord masuk `innerHTML` lewat `esc()`.

## 5. Database

| Berkas | Isi |
|---|---|
| `supabase/developer-panel-schema.sql` | `bot_panel_snapshots` + RLS baca admin, kolom `bot_commands.progress`/`heartbeat_at`, trigger `bot_commands_owner_guard`, bucket privat `bot-backups` (50 MB, `application/gzip`) + policy baca/hapus owner. Aditif, idempoten, **tanpa DROP**. |
| `supabase/developer-panel-settings.sql` | 2 kategori (`tutorial`, `campaign`) + 5 setting baru bernilai NULL (bot mengisinya dari nilai lokal) |
| `supabase/developer-panel-rollback.sql` | Pemulihan (kebalikan dua berkas di atas) |
| `supabase/tests/developer-panel*.sql` | Tes SQL (peran, trigger owner, RLS snapshot & bucket, idempoten) — `npm run test:sql` |

Status produksi: `developer-panel-schema.sql` **sudah diterapkan** (2026-10-17,
migrasi `developer_panel_v3_*`). `developer-panel-settings.sql` diterapkan
**setelah** website v3 live — halaman Kontrol lama menyimpan semua field saat
Simpan dan akan menimpa nilai NULL; halaman v3 hanya menulis field yang diubah.

## 6. Menambah aksi

1. Handler di bot (`src/cms/handlers/*`, lihat dokumen pasangan di repo bot).
2. Aksi sederhana → entri di `GRUP` (`actions.ts`); UI kaya → halaman di
   `src/pages/admin/developer/` + item menu di `src/layouts/AdminLayout.astro`.
3. `type` harus sama persis dengan handler bot. Aksi sistem → prefiks `sys.`.
4. Validasi cepat yang mencerminkan aturan bot → `model.ts` + tes.

## 7. Tes

```bash
npm test          # node --test: model dashboard, edge function, dev-panel model
npm run test:sql  # Postgres lokal sekali-pakai: skema guild dashboard + Panel Developer
npm run build     # Astro build (semua halaman admin ikut dibangun)
```
