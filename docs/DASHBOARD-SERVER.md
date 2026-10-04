# 🖥️ Vanillate Dashboard — Konfigurasi Server Discord

Admin server Discord masuk dengan **Discord** di `vanillate.id/dashboard`, memilih
server yang boleh dikelolanya, lalu mengatur fitur & channel bot Vanillate.
Pintu masuknya — seperti Changelog — tombol **Dashboard** di halaman produk
Vanillate Sambung Kata (`DASHBOARD_PRODUCT` di `src/data/bots.ts`) dan tautan
footer; sengaja tidak di menu utama studio.
Website adalah **control plane**; bot adalah **executor**.

> Implementasi dari *Vanillate Dashboard — Server Configuration Specification*
> (4 Okt 2026). Sisi bot: `sambung-kata-bot/docs/dashboard-sync.md`.

---

## 1. Arsitektur

```
Browser (/dashboard, statis di GitHub Pages)
  │  login Discord (Supabase Auth, scope identify + guilds)
  │
  ├─► Edge Function dashboard-discord ──► Discord API (/users/@me/guilds, token user)
  │       verifikasi server yang boleh dikelola → guild_dashboard_access
  │
  ├─► RPC guild_dashboard_get / guild_config_save / … (security definer)
  │       cek akses server-side → validasi → transaksi → revisi +1 → audit
  │
Supabase (sumber kebenaran: guild_config*, revisi, audit)
  ▲
  │  service_role: guild_bot_poll / guild_bot_report / snapshot / registry
Bot sambung-kata-bot (src/dashboard) — validasi ulang di Discord → terapkan → lapor
```

| Komponen | Tanggung jawab |
|---|---|
| Website (`src/pages/dashboard/`, `src/lib/dashboard/`) | UI, login, draft lokal, validasi awal, tampilan status |
| Edge Function `dashboard-discord` | Satu-satunya yang memanggil Discord API atas nama user; menentukan server yang boleh dikelola |
| RPC Postgres (`supabase/guild-dashboard-schema.sql`) | Otorisasi, validasi final, transaksi, revisi, audit, sinkronisasi |
| Bot | Membaca revisi, memvalidasi kemampuan bot di Discord, menerapkan, melapor |

**Tanpa rahasia baru di browser.** Browser hanya memegang anon key. Token bot
tidak pernah keluar dari bot: daftar channel & izin bot dikirim bot sebagai
*snapshot*. Token OAuth Discord user dikirim **sekali** ke Edge Function lalu
disimpan server-side (`guild_dashboard_tokens`, tanpa policy RLS), dan sesi
browser di-refresh agar token itu tidak tertinggal di localStorage.

## 2. Otorisasi (spesifikasi §17)

Setiap RPC user memanggil `guild_dashboard_assert_access(guild_id)`:

1. Sesi Supabase valid (`auth.uid()`).
2. Identitas Discord dari **`auth.identities`** (bukan `user_metadata` yang bisa
   diubah user).
3. Baris `guild_dashboard_access` untuk (user, guild) **diverifikasi ≤ 15 menit
   lalu** oleh Edge Function lewat Discord API: pemilik server, Administrator,
   atau Manage Server. Lebih tua → `ACCESS_STALE`; website memverifikasi ulang
   otomatis lalu mengulang permintaan.
4. Simpan butuh bot terpasang (`bot_guilds.is_active`) → `BOT_NOT_INSTALLED`.
5. Bot memeriksa lagi saat menerapkan: penyimpan revisi website yang belum
   berlaku masih Manage Server? (`ACTOR_FORBIDDEN` bila tidak). Perubahan dari
   Discord yang menumpuk di atas revisi itu tidak menghapus pemeriksaan ini —
   revisi gabungannya tetap atas nama penyimpan website. Admin lain yang
   menekan **Retry Sync** mengambil alih (menyetujui) revisi itu.

`guild_id`/`channel_id` dari browser tidak pernah dipercaya: channel baru harus
ada di snapshot Discord terbaru dari bot dengan tipe yang benar.

## 3. Model data

| Tabel | Isi |
|---|---|
| `guild_feature_registry` | Fitur yang bisa diatur (diterbitkan bot; satu-satunya tabel yang boleh dibaca publik) |
| `guild_config` | Per server: `current_revision`, `applied_revision`, `sync_status`, hasil percobaan & kesehatan |
| `guild_feature_config` | `enabled` + `settings` (jsonb) per fitur |
| `guild_channel_config` | Channel per (fitur, purpose) |
| `guild_config_audit` | Riwayat append-only: aktor, sumber, revisi, aksi, field yang berubah |
| `guild_dashboard_access` / `guild_dashboard_tokens` | Hasil verifikasi akses & token OAuth (Edge Function saja) |
| `guild_discord_snapshot` | Channel + izin bot per channel dari bot; `requested_at` = Refresh Discord Data |
| `guild_dashboard_bot_state` | Heartbeat bot (online bila < 90 detik) |

Fitur baru cukup didaftarkan di bot (registry diturunkan dari daftar game &
fitur sosial) — website dan database tidak perlu diubah (spesifikasi §25).

## 4. Alur simpan & sinkronisasi

```
Draft (DRAFT) → Simpan (SAVING) → guild_config_save:
   cek akses → cek revisi (STALE_REVISION bila basi) → validasi → tulis → revisi N+1 → audit
→ SAVED/SYNCING → bot poll (±5 dtk) → cek penyimpan → validasi di Discord
   ├─ lolos  → terapkan → applied = N+1 → ACTIVE
   ├─ gagal pada fitur yang DIUBAH revisi ini (atau penyimpan bukan admin lagi,
   │  bot tidak di server) → revisi tidak diterapkan, konfigurasi lama tetap
   │  berlaku → NEEDS_ATTENTION (+ detail masalah)
   └─ masalah hanya pada fitur yang TIDAK diubah (mis. channel lamanya dihapus)
      → perubahan lain tetap diterapkan, fitur itu memakai pengaturan lamanya →
      applied = N+1 → NEEDS_ATTENTION (+ detail, sebagai laporan kesehatan)
```

Kontrak ini sama dengan validasi simpan di database: channel tersimpan yang
kini bermasalah tidak menahan perubahan fitur lain.

| Status | Arti |
|---|---|
| `DRAFT` | Ada perubahan di browser yang belum disimpan |
| `SAVING` | Sedang disimpan |
| `SAVED` | Tersimpan, menunggu bot |
| `SYNCING` | Revisi tersimpan > revisi diterapkan |
| `ACTIVE` | Bot sudah menerapkan revisi terbaru & tidak ada masalah |
| `NEEDS_ATTENTION` | Apply gagal, atau bot menemukan masalah setelah apply (channel dihapus, izin dicabut) |
| `BOT_OFFLINE` | Heartbeat bot > 90 detik |
| `NOT_INSTALLED` | Bot tidak ada di server |

**Retry Sync** meminta bot memuat & menerapkan ulang revisi terbaru (untuk
revisi website yang belum berlaku, sekaligus atas nama admin yang menekannya).
**Refresh Discord Data** meminta bot menerbitkan ulang daftar channel & izin.
Keduanya bisa diulang segera setelah bot melayani permintaan sebelumnya.
Revisi yang gagal diulang otomatis tiap 10 menit, jadi memperbaiki izin di
Discord cukup — tanpa wajib menekan tombol.

Halaman server memakai jam server (`server_time`) untuk batas waktu, tidak
menggambar ulang bila tidak ada yang berubah (fokus keyboard & dropdown yang
sedang dibuka aman), dan menyimpan dengan revisi tempat draft dibuat — jadi
perubahan dari tempat lain selama mengedit selalu ditolak `STALE_REVISION`,
tidak pernah tertimpa diam-diam.

Perubahan dari `/pengaturan` di Discord tetap berlaku dan tercatat sebagai
revisi baru (sumber "Discord") — dashboard & bot selalu sama.

## 5. Setup (sekali, oleh pemilik)

Sudah dilakukan otomatis: migrasi `guild_dashboard_config` dan Edge Function
`dashboard-discord` di project **CMS | VANILLATE**.

Yang butuh pemilik (perlu Client Secret Discord yang hanya ada di Discord
Developer Portal):

1. **Discord Developer Portal** → aplikasi bot Vanillate → **OAuth2**:
   - Salin **Client ID** & **Client Secret** (Reset Secret bila belum pernah).
   - **Redirects** → tambahkan `https://lvfwopnvvqncopvathop.supabase.co/auth/v1/callback`.
2. **Supabase → Authentication → Sign In / Providers → Discord**: Enable, isi
   Client ID & Client Secret → Save.
3. **Supabase → Authentication → URL Configuration → Redirect URLs**: pastikan
   ada `https://vanillate.id/dashboard/` (atau `https://vanillate.id/**`) dan
   `http://localhost:4321/dashboard/` untuk pengembangan.
4. Biarkan **Confirm email** tetap aktif (bawaan). Ini memastikan email dari
   Discord yang belum terverifikasi tidak bisa dipakai — RLS Live Chat
   mencocokkan email dari JWT.
5. Restart bot setelah PR bot di-merge (tanpa command baru).

Sebelum langkah 1–2 selesai, `/dashboard` menampilkan "Login Discord sedang
disiapkan" (dicek otomatis lewat `/auth/v1/settings`), bukan error.

### Uji end-to-end (spesifikasi §22 Phase 2)

1. Buka `/dashboard` → Masuk dengan Discord → server tempatmu admin tampil.
2. Kelola → Game Hub → Sambung Kata: pilih channel → **Simpan Perubahan**.
3. Status: `Menyinkronkan` → `Aktif` dalam ±5 detik; Riwayat mencatat revisi.
4. Di Discord, jalankan `/sambungkata` dari channel lain → diarahkan ke channel
   tadi. Matikan UNO di dashboard → tombol UNO di `/game` nonaktif.
5. Cabut izin *Send Messages* bot di channel itu → pilih ulang channel yang sama
   di channel lain lalu simpan → `Perlu perhatian` dengan pesan izin yang hilang.

## 6. Pengembangan & tes

```bash
npm test          # model dashboard + logika Edge Function (Node ≥ 22.6)
npm run test:sql  # skema & RPC di Postgres sekali-pakai (butuh binary PostgreSQL)
```

Workflow `.github/workflows/test.yml` menjalankan keduanya + build di setiap PR.

| Berkas | Isi |
|---|---|
| `supabase/guild-dashboard-schema.sql` | Tabel, RLS, trigger status, seluruh RPC (idempoten) |
| `supabase/tests/*.sql`, `scripts/test-guild-dashboard-sql.sh` | Tes SQL (otorisasi, simpan, revisi, audit, alur bot) |
| `supabase/functions/dashboard-discord/` | Edge Function (`logic.ts` murni & teruji) |
| `src/lib/dashboard/model.ts` | Draft/diff, validasi klien, status, pesan error, format WIB |
| `src/lib/dashboard/api.ts` | Klien Supabase dashboard (sesi terpisah dari /admin & /chat) |
| `src/lib/dashboard/servers-page.ts`, `server-page.ts` | UI daftar server & halaman konfigurasi |
| `src/pages/dashboard/` | Kerangka halaman (`/dashboard`, `/dashboard/server/?id=`) |

Deploy ulang Edge Function setelah mengubahnya (MCP Supabase atau
`supabase functions deploy dashboard-discord`, verify JWT aktif). Mengubah
skema: edit `supabase/guild-dashboard-schema.sql` (tetap idempoten), jalankan
`npm run test:sql`, lalu terapkan sebagai migration baru.
