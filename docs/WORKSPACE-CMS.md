# 🗂️ CMS Konfigurasi — Vanillate Workspace

Panduan konfigurasi bot **Vanillate Workspace** (bot Discord manajemen kerja)
lewat panel `/admin` di website. Ini **produk kedua** di CMS, terpisah penuh dari
**Sambung Kata**.

> Ringkas: dulu konfigurasi bot diatur lewat command `/developer` di Discord.
> Sekarang **semua konfigurasi pindah ke sini**. Command Discord jadi murni
> dashboard & laporan (tugas, absensi, laporan, kalender, notifikasi).

---

## 1. Pemisahan per-produk (tidak boleh tercampur)

| | Sambung Kata | Vanillate Workspace |
|---|---|---|
| Tabel Supabase | `bot_*` (+ kolom `bot_slug`) | `workspace_*` |
| Menu `/admin` | Grup **🎮 Sambung Kata** | Grup **🗂️ Vanillate Workspace** |
| Bot | `sambung-kata-bot` (baca `bot_settings` live) | `vanillate-workspace` (sync ke cache lokal) |
| Skema | `supabase/schema.sql` | `supabase/workspace-schema.sql` |

Query tidak pernah lintas-produk; satu section produk tak menampilkan setting
produk lain.

**(Opsional) akses admin per-produk.** `supabase/workspace-schema.sql` bagian 0
menyiapkan kolom `admin_users.products text[]` + fungsi `is_workspace_editor()`
(default OFF). Aktifkan bila ingin membatasi editor tertentu ke satu produk.

---

## 2. Yang dikelola di sini (KONFIGURASI) vs tetap di bot (OPERASIONAL)

| Pindah ke CMS (konfigurasi) | Tetap di bot (operasional) |
|---|---|
| Role & izin (`workspace_roles`) | Assignment member→role |
| Tim — definisi (`workspace_teams`) | Keanggotaan tim (member→tim) |
| Jadwal kerja — template (`workspace_schedules`) | Penetapan template→member |
| Welcome & onboarding (`workspace_welcome`) | Pengiriman welcome, `welcomeSentAt` |
| Feature toggle (`workspace_features`) | — |
| Automation — definisi (`workspace_automation`) | Statistik eksekusi (`runCount`, `lastRunAt`) |
| Konfigurasi sistem (`workspace_settings`) | `ownerId`, `setupDone`, absensi, tugas, persetujuan, notifikasi |

---

## 3. Cara kerja (CMS → Supabase → Bot)

```
   Admin /admin/workspace/*            Supabase (workspace_*)         Bot vanillate-workspace
   ────────────────────────           ──────────────────────         ───────────────────────
   edit config  ──(anon key + RLS)──►  tabel workspace_*   ◄──(service_role, baca)── configSync
                                        (RLS: admin baca,                 │ tiap ±5 menit
                                         editor tulis)                    ▼
                                                              merge → cache lokal (data/*.json)
                                                              + snapshot data/config-cache/*.json
                                                                         │
                                                                         ▼  (last-good bila gagal)
                                                              bot memakai config saat beroperasi
```

- **Bot tidak baca live tiap saat** — ia men-sync berkala ke **cache file lokal**
  supaya tahan bila Supabase/jaringan bermasalah (last-good tetap dipakai).
- **Field operasional dipertahankan** saat merge (memberIds tim, runCount
  automation, ownerId/setupDone). CMS hanya sumber **definisi**.
- Tabel yang mengembalikan **0 baris dilewati** (dianggap belum dikonfigurasi),
  jadi seed lokal bot tidak terhapus sebelum di-bootstrap.

### Keamanan
- Browser hanya memegang **anon key**; **RLS** yang menjaga (tanpa JWT admin = 0 baris).
- **`service_role` HANYA di server bot** (env `SUPABASE_SERVICE_ROLE_KEY`) —
  tidak pernah di repo/website/browser.
- Nilai dari CMS **tidak dipercaya mentah**: bot tetap memvalidasi & clamp
  (mis. toleransi/offset menit) saat menerapkan.

---

## 4. Setup

### 4a. Jalankan skema
Di Supabase → SQL Editor, jalankan **setelah** `supabase/schema.sql`:
```
supabase/workspace-schema.sql
```
Idempoten (aman diulang), lengkap dengan RLS + audit (`workspace_settings_audit`).

### 4b. Bootstrap data awal (satu kali)
Supaya nilai produksi bot tidak reset ke default seed, ekspor config lokal bot ke
Supabase. Di server bot (`vanillate-workspace`):
```bash
# lihat dulu yang akan ditulis (DRY-RUN):
node scripts/bootstrap-config-to-supabase.mjs
# tulis sungguhan:
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  node scripts/bootstrap-config-to-supabase.mjs --apply
```
ID role/tim/jadwal/automation bot dipertahankan sebagai PK → assignment member
di bot tidak perlu migrasi.

### 4c. Env bot
Di `.env` bot (`vanillate-workspace`):
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key — RAHASIA, hanya di server bot>
WORKSPACE_CONFIG_SYNC_MS=300000        # opsional, default 5 menit
WORKSPACE_ADMIN_URL=https://vanillate.id/admin   # tautan dari Discord ke CMS
```
Tanpa env ini, bot memakai config lokal (fitur sync nonaktif, tidak error).

---

## 5. Halaman CMS

Semua di grup **🗂️ Vanillate Workspace** (`/admin/workspace/…`):

| Halaman | Tabel | Isi |
|---|---|---|
| Ringkasan | — | Kartu navigasi produk |
| Role & Izin | `workspace_roles` | Nama, rank, izin per-kategori, cakupan, wildcard `*` |
| Tim | `workspace_teams` | Nama, deskripsi, ID ketua |
| Jadwal Kerja | `workspace_schedules` | Template shift 7 hari + toleransi |
| Welcome & Onboarding | `workspace_welcome` | Toggle, target status, DM/channel, template, langkah |
| Feature Toggle | `workspace_features` | on / off / maintenance per fitur |
| Automation | `workspace_automation` | Trigger → aksi, enable, pesan |
| Konfigurasi Sistem | `workspace_settings` | Reminder, toleransi, daily brief, eskalasi, notif wajib |

Peran **viewer** hanya bisa melihat; **admin/owner** bisa menulis (ditegakkan RLS).

> Katalog kunci `Permission`, `AutomationTrigger`, `AutomationAction`, dsb. ada di
> `src/lib/workspace-admin.ts` dan **harus selaras** dengan
> `Vanillate-Workspace/src/types/models.ts`. Bila enum bot berubah, perbarui file itu.

---

## 6. Tahap berikutnya (di luar cakupan sekarang)
Mengirim **data operasional** (absensi, status tugas) dari bot ke Supabase untuk
ditampilkan di dashboard website — dikerjakan terpisah nanti.
