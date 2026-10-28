# Vanillate Website — Instruksi Claude

Website resmi Vanillate Studio (Astro statis di GitHub Pages) + **CMS Admin**
(`/admin/*`, Supabase dengan RLS). CMS ini juga **Panel Developer** bot
Sambung Kata sejak bot v3.0.0 — slash command `/developer` di Discord sudah
dihapus. Repo bot: **`Ndyspleasure/sambung-kata-bot`** (instruksinya di
`CLAUDE.md` repo itu).

## Aturan utama

- **Browser hanya memakai anon key + JWT admin.** Token bot, `service_role`
  key, dan kredensial database **tidak pernah** masuk ke kode website.
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
| `docs/DASHBOARD-SERVER.md` | Vanillate Dashboard (`/dashboard`, admin server login Discord) · §5a 📣 Share Server (tab, `share_*`, Edge Function `topgg-webhook` — `verify_jwt = false`, secret `TOPGG_WEBHOOK_SECRET`) |
| `docs/PIPELINE-TERBIT.md`, `docs/AUTO-SYNC-DATA.md` | Alur terbit konten & sinkron data dari repo bot |
| `docs/BLOG.md` | Blog `/blog`: ditulis & diterbitkan di `/admin/blog`, disimpan di **Sanity** (project `62jp784l`, dataset `production` public) lewat Edge Function `blog-admin` (secret `SANITY_WRITE_TOKEN`, `GITHUB_DISPATCH_TOKEN`); halaman dibangun statis saat build |
