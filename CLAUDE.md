# Vanillate Website — Instruksi Claude

Website resmi Vanillate Studio (Astro statis di GitHub Pages) + **CMS Admin**
(`/admin/*`, Supabase dengan RLS). CMS ini juga **Panel Developer** bot
Discord **Vanillate.ID** (dulu "Vanillate Sambung Kata"; Sambung Kata kini nama
game/mode-nya; grup sidebar **Discord Bot**) sejak bot v3.0.0 — slash command `/developer` di Discord sudah
dihapus. Repo bot: **`Ndyspleasure/sambung-kata-bot`** (instruksinya di
`CLAUDE.md` repo itu).

## Aturan utama

- **Browser hanya memakai anon key + JWT admin.** Token bot, `service_role`
  key, dan kredensial database **tidak pernah** masuk ke kode website.
- **Setelan terkunci wajib dijelaskan.** Opsi atau fitur dashboard dengan
  `available: false` tampil sebagai kotak/catatan penjelasan (`featureLock`,
  teks `locked_note` dari bot), tidak boleh hilang diam-diam dan toggle fitur
  yang seluruhnya terkunci harus mati. Jangan mengarang alasan di website.
  Acuan: `docs/DASHBOARD-SERVER.md` §5c dan `docs/dashboard-setelan-terkunci.md`
  di repo bot.
- **Teks untuk pengguna tanpa tanda pisah.** Di dashboard (Server Hub, Game
  Hub, Social Hub, dst.) jangan memakai `—`, `–`, atau ` - ` sebagai penghubung
  kalimat; pakai titik, koma, atau kata ("sampai", "karena"). Placeholder kosong
  ditulis dengan kata ("tidak diatur", "belum ada"), bukan `—`. Kata ulang baku
  (kata-kata, berturut-turut) tetap boleh. Teks dari registry bot ikut aturan ini.
- Semua teks dari bot/Discord yang masuk `innerHTML` **wajib** lewat `esc()`
  (`src/lib/admin-ui.ts`).
- Aksi ke bot = INSERT ke `bot_commands` lewat `src/lib/dev-panel/client.ts`
  (`kirimPerintah`), dengan `type` yang **sama persis** dengan handler di
  `src/cms/handlers/*` repo bot. Tipe `sys.*` khusus owner (trigger DB + bot).
  Validasi akhir selalu di bot; `src/lib/dev-panel/model.ts` hanya umpan balik.
- Perubahan skema Supabase: SQL **aditif & idempoten** di `supabase/*.sql`
  (+ berkas rollback + tes di `supabase/tests/`), terapkan lewat Supabase MCP
  `apply_migration`. Hindari `DROP` di migrasi (pakai `create or replace` /
  blok `DO … if not exists`) — data lama tidak boleh diubah/dihapus.
- Blog: token Sanity/GitHub **hanya** di secret Edge Function `blog-admin`;
  tipe dokumen Sanity sama persis antara `src/lib/blog/config.ts` dan
  `supabase/functions/blog-admin/logic.ts` (dites). Build produksi sengaja gagal
  bila Sanity tak terjangkau (`BLOG_ALLOW_EMPTY=1` hanya untuk dev/PR).
- **Database game bot = proyek Supabase TERPISAH "Database Bot" (dulu "Vanillate Game")**
  (`ggsshrnpgnfqvlhzxnoq`, acuan `docs/database-game.md` repo bot; data baru
  untuk game/fitur sosial: `docs/database-fitur-baru.md`). Proyek Supabase di
  repo ini (`lvfwopnvvqncopvathop`) tetap **khusus CMS & website** (admin,
  Panel Developer, blog, FAQ, konten) — jangan memindahkan data pemain ke proyek
  CMS.
- **Satu pengecualian (PLAN-001, disetujui pemilik 2026-11-03): Vanillate
  Dashboard (`/dashboard`) memakai proyek Database Bot** untuk login Discord,
  RPC `guild_*` & `share_*`, serta Edge Function `dashboard-discord` &
  `topgg-webhook`. Website memegang **hanya URL + anon key**
  (`PUBLIC_BOT_SUPABASE_URL` / `PUBLIC_BOT_SUPABASE_ANON_KEY`, klien kedua
  khusus `src/lib/dashboard/api.ts`). Semua tabelnya RLS tanpa policy; hanya
  7 RPC (`guild_dashboard_get`, `guild_config_save`, `guild_config_request_resync`,
  `guild_dashboard_request_refresh`, `guild_config_audit_list`,
  `share_dashboard_get`, `share_request_submit`) yang bisa dipanggil
  `authenticated`. **`service_role` dan `DATABASE_URL` Database Bot tetap TIDAK
  PERNAH di website**, dan website tidak boleh membaca tabel pemain/gameplay.
  Skema dashboard sekarang dimiliki repo bot (`migrations/0012_dashboard.sql`,
  `0013_share_server.sql`); `supabase/guild-dashboard-schema.sql` &
  `share-server.sql` di sini adalah salinan lama proyek CMS (rollback) dan
  dihapus bersama tabelnya setelah ≥ 7 hari stabil.
- Versi & changelog bot **read-only** di sini (SSoT `version.json` /
  `CHANGELOG.json` di repo bot).

## Tes

```bash
npm test          # node --test (model dashboard, edge function, dev-panel model, blog)
npm run test:sql  # Postgres lokal sekali-pakai: skema guild dashboard + Panel Developer
npm run build     # Astro build
```

## 🐛 Mencari bug bot dari data CMS

Bot produksi menulis log & keadaannya ke Supabase project
**`lvfwopnvvqncopvathop`**. Untuk investigasi pakai Supabase MCP
`execute_sql` **hanya SELECT**:

| Tabel | Isi |
|---|---|
| `bot_logs` | Log bot (`level`, `event`, `message`, `meta.stack`) — kelompokkan error/warn 7 hari terakhir. Hanya 30 hari terakhir (`supabase/bot-logs-retention.sql`, pg_cron harian) |
| `bot_panel_snapshots` | Keadaan bot per key: `errors` (Error KB), `autoheal` (incident), `system` (versi & kesehatan), `games`, dll. `updated_at` > 2 menit = bot offline |
| `bot_commands` | Perintah CMS beserta `status`/`error` dari bot |
| `bot_commands` tipe `sys.console.run` | Hasil **Konsol Dev** (git/pm2/npm/node baca-saja di host bot): `result.stdout/stderr/exitCode/cwd`. Status komputer host (RAM, CPU, disk `health.disk`, PM2) ada di snapshot `system`. Claude **tidak** mengirim perintah konsol sendiri — minta owner menjalankannya di Kontrol Server › Konsol, lalu baca hasilnya (SELECT). Acuan repo bot: `CLAUDE.md` › "Mengecek status komputer host" & `docs/panel-developer-cms.md` §8a |

Temuan bug **dicatat di `claudereport.md` repo bot** (papan bug bersama),
lalu diperbaiki lewat PR di repo yang tepat. Data pemain (nama, Discord ID,
isi tulisan) tidak dikutip ke issue/PR/commit.

## Acuan

| Dokumen | Isi |
|---|---|
| `docs/DEVELOPER-PANEL.md` | Panel Developer: arsitektur antrean & snapshot, peran, halaman, kode, database, cara menambah aksi |
| `docs/ADMIN-CMS.md` | Model keamanan CMS, setup Supabase, kontrak data bot, Control Panel (`/admin/kontrol`) |
| `docs/DASHBOARD-SERVER.md` | Vanillate Dashboard (`/dashboard`, admin server login Discord; **data & login di proyek Database Bot sejak PLAN-001**) · §5a 📣 Share Server (tab, `share_*`, Edge Function `topgg-webhook` — `verify_jwt = false`, secret `TOPGG_WEBHOOK_SECRET`, di proyek Database Bot) |
| `docs/SHOWCASE-SERVER.md` | Daftar server pemakai bot di beranda dan `/products/vanillateID/` (bawaan tampil, admin mematikan di dashboard › Share Server, tinjauan tim di `/admin/showcase`), RPC publik `showcase_public_list()` di proyek CMS, SEO dan performa |
| `docs/PIPELINE-TERBIT.md`, `docs/AUTO-SYNC-DATA.md` | Alur terbit konten & sinkron data dari repo bot |
| `docs/BLOG.md` | Blog `/blog`: ditulis & diterbitkan di `/admin/blog`, disimpan di **Sanity** (project `62jp784l`, dataset `production` public) lewat Edge Function `blog-admin` (secret `SANITY_WRITE_TOKEN`, `GITHUB_DISPATCH_TOKEN`); halaman dibangun statis saat build |
