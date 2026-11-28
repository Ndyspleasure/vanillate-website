# 🖥️ Vanillate Dashboard — Konfigurasi Server Discord

Admin server Discord masuk dengan **Discord** di `vanillate.id/dashboard`, memilih
server yang boleh dikelolanya, lalu mengatur fitur & channel bot Vanillate.
Pintu masuknya — seperti Changelog — tombol **Dashboard** di halaman produk
Vanillate.ID (`DASHBOARD_PRODUCT` di `src/data/bots.ts`) dan tautan
footer; sengaja tidak di menu utama studio.
Website adalah **control plane**; bot adalah **executor**.

> Implementasi dari *Vanillate Dashboard — Server Configuration Specification*
> (4 Okt 2026). Sisi bot: `sambung-kata-bot/docs/dashboard-sync.md`.
>
> **PLAN-001 (2026-11): seluruh backend dashboard pindah dari proyek CMS ke
> proyek Supabase "Database Bot"** (`ggsshrnpgnfqvlhzxnoq`): login Discord
> (Supabase Auth), tabel `guild_*` & `share_*`, RPC, Edge Function
> `dashboard-discord` dan `topgg-webhook`. Website memakai klien kedua dengan
> `PUBLIC_BOT_SUPABASE_URL` / `PUBLIC_BOT_SUPABASE_ANON_KEY` (hanya URL + anon
> key). Skema sekarang dimiliki repo bot (`migrations/0012_dashboard.sql`,
> `0013_share_server.sql`); semua kata "Supabase" di bawah berarti proyek
> Database Bot, kecuali disebut CMS. `supabase/guild-dashboard-schema.sql` dan
> `share-server.sql` di repo ini tinggal salinan lama untuk rollback. Runbook
> cutover: `sambung-kata-bot/docs/rencana-dashboard-ke-database-bot.md` §4a.
> Pengaturan Auth (provider Discord, Site URL, Redirect URLs) dan secret Edge
> Function (`TOPGG_WEBHOOK_SECRET`) kini diatur di proyek Database Bot.

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
   menekan **Coba terapkan lagi** (tampil sebagai **Terapkan perubahan ini** pada
   kendala `ACTOR_FORBIDDEN`) mengambil alih (menyetujui) revisi itu.

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
| `guild_discord_snapshot` | Channel + izin bot per channel dari bot; `requested_at` = tombol Cek lagi |
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

**Coba terapkan lagi** (dulu Retry Sync) meminta bot memuat & menerapkan ulang
revisi terbaru (untuk revisi website yang belum berlaku, sekaligus atas nama admin
yang menekannya). **Cek lagi** (dulu Refresh Discord Data) meminta bot menerbitkan
ulang daftar channel & izin. Kendala tampil sebagai pop up dan lencana; teks dan
perilakunya di `docs/DASHBOARD-PANDUAN-KENDALA.md`.
Keduanya bisa diulang segera setelah bot melayani permintaan sebelumnya.
Revisi yang gagal diulang otomatis tiap 10 menit, jadi memperbaiki izin di
Discord cukup — tanpa wajib menekan tombol.

Halaman server memakai jam server (`server_time`) untuk batas waktu, tidak
menggambar ulang bila tidak ada yang berubah (fokus keyboard & dropdown yang
sedang dibuka aman), dan menyimpan dengan revisi tempat draft dibuat — jadi
perubahan dari tempat lain selama mengedit selalu ditolak `STALE_REVISION`,
tidak pernah tertimpa diam-diam.

**Dashboard adalah satu-satunya tempat admin server mengatur bot** (sejak bot
v3.28). `/pengaturan` di Discord tidak lagi berisi panel — ia hanya membalas
tombol tautan ke `/dashboard/server/?id=<guildId>` (tab lewat hash, mis.
`#social-hub`); tautan itu dibawa melewati login. Perubahan dari luar
dashboard (Social Monitor CMS, channel dihapus) tetap tercatat sebagai revisi
baru (sumber "Discord") — dashboard & bot selalu sama.

**Navigasi.** Kategori utama di atas: **Ringkasan · Game Hub · Social Hub ·
Server Hub**. Server Hub punya menu berkelompok (sidebar kiri di layar lebar, satu
menu pilih di HP supaya tidak perlu digeser menyamping):

| Kelompok | Isi |
|---|---|
| Member baru | Verification · Auto Role · Welcome |
| Aktivitas dan keamanan | Leveling · Security Center |
| Promosi | Share Server |
| Alat | Peta Channel · Riwayat · Salin Pengaturan |

Hash URL tetap id tab (`#overview`, `#game-hub`, `#social-hub`, `#verification`,
`#leveling`, `#autorole`, `#welcome`, `#security`, `#share-server`, `#channels`,
`#audit-log`, `#copy`); `#server-hub` membuka submenu Server Hub terakhir (bawaan
Verification). Daftar dan pemetaan hash ada di `src/lib/dashboard/nav-model.ts`
dan dijaga `tests/dashboard-review.test.ts`, jadi tautan lama dan tautan dari
`/pengaturan` di Discord tidak boleh rusak.

**🚫 Tidak dipakai (fitur sosial).** Bot menerbitkan setelan `not_used` di
`settings_schema` fitur sosial. Saat fitur OFF, kartu menampilkan centang
"🚫 Tidak dipakai di server ini" (`settings.not_used = true`); bot mencatatnya
sebagai keputusan onboarding (`guild_social_declines`) sehingga panduan setup
berhenti menanyakan fitur itu. `false` eksplisit membatalkan keputusan;
mengaktifkan fitur otomatis membatalkannya.

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
   di channel lain lalu simpan → pop up kendala dengan pesan izin yang hilang.

## 5a. 📣 Share Server (tab `#share-server`)

Broadcast promosi antar server (Sosial Hub Sambung Kata). Aturan lengkap ada di
repo bot: `docs/share-server.md`. Berbeda dengan fitur lain, Share Server
**tidak** memakai revisi `guild_config`, karena isinya bukan sekadar
nyala/mati + channel (ada profil, undangan, antrean, sanksi). Website tetap
**tidak** menyimpan konfigurasi sendiri:

| Komponen | Peran |
|---|---|
| `share_guild_state` | Status + riwayat per server, **diterbitkan bot**. Dibaca lewat RPC `share_dashboard_get` (cek `guild_dashboard_assert_access`) |
| `share_requests` | Aksi admin (`save`, `activate`, `deactivate`, `test`, `recheck_invite`, `ack`) lewat RPC `share_request_submit`. Identitas Discord diambil dari `auth.identities`; satu permintaan aktif per server; maks. 30/jam per user. **Bot memverifikasi ulang** izin Manage Server user di Discord, lalu menjalankan aksi dengan aturan yang sama dengan Social Monitor CMS (`src/social/share/service.js`) |
| `share_topgg_votes` | Kotak masuk webhook Top.gg, ditulis Edge Function `topgg-webhook` (service_role), dibaca bot |
| UI | `src/lib/dashboard/share-server.ts` (tab), `share-model.ts` (model murni, `tests/share-model.test.ts`) |

Migrasi: `supabase/share-server.sql` (aditif & idempoten; rollback
`share-server-rollback.sql`; tes `supabase/tests/share-server.test.sql`).

**Edge Function `topgg-webhook`** (`supabase/functions/topgg-webhook/`): deploy
dengan **`verify_jwt = false`** (Top.gg tidak mengirim JWT). Autentikasinya tanda
tangan HMAC-SHA256 `x-topgg-signature: t=…,v1=…` (jendela 5 menit). Webhook lama
(header `Authorization` = secret) **ditolak sejak 2026-11-23** (keputusan pemilik
K-10, `LEGACY_ENABLED = false` di `logic.ts`) karena tanpa stempel waktu bisa
diputar ulang menjadi vote ganda. Secret wajib di
`TOPGG_WEBHOOK_SECRET`. Tanpa secret, semua permintaan ditolak (503). Fungsi
hanya menyimpan vote (`event_key` unik). Penghitungan, server tujuan, dan
penyaring akun dilakukan bot. Tes: `tests/topgg-webhook.test.ts`.

URL untuk dashboard Top.gg: `https://<project>.supabase.co/functions/v1/topgg-webhook`.

### 5a-2. 🌐 Tampil di website (Showcase Server)

Kartu di atas tab Share Server. Bawaannya server tampil di daftar server pengguna
di vanillate.id; admin bisa mematikan, memasukkan link undangan manual, meminta bot
membuat link otomatis, menghapus, atau cek ulang. Lewat permintaan `save` dengan kunci
`showcase*` (tanpa RPC baru), tetap jalan walau Share Server belum dibuka. Status
dan teks penjelasan dari bot (`share_guild_state.data.showcase`): `NSFW` dan
`REVIEW` mengunci toggle dengan penjelasan, "buat link otomatis" terkunci dengan
`lockedNote` bila bot tak punya izin Create Invite. Acuan: `docs/SHOWCASE-SERVER.md`.

## 5b. Setelan bertipe, role, & fitur manajemen server (✅ Verification)

Selain game dan sosial, registry bot kini memuat bagian **manajemen server**
(`section = 'verification'`, nanti `'leveling'`) dengan tab sendiri.
Perubahan skema (aditif & idempoten, `supabase/guild-dashboard-schema.sql`):

| Perubahan | Isi |
|---|---|
| `guild_feature_registry.section` | Constraint diperluas: `game`, `social`, `verification`, `leveling`, `other` |
| `guild_discord_snapshot.roles`, `.bot_top_position` | Role server (id, nama, posisi, managed) + posisi role tertinggi bot, diterbitkan bot lewat `guild_bot_publish_snapshot`; dikirim ke website di `guild_dashboard_get → snapshot` |
| `guild_config_validate` | Memvalidasi `settings_schema.properties.<k>.type` (`boolean`, `integer` + `min`/`max`, `string` + `max_length`, `enum`, `role`, `role_list`, `channel_list` + `max_items`; `color` (#RRGGBB) dan `guide_list` tidak punya cabang SQL, divalidasi bot + website), `required` (hanya fitur aktif), dan role baru/berubah harus ada di snapshot. Kode: `SETTING_INVALID`, `SETTING_OUT_OF_RANGE`, `SETTING_REQUIRED`, `ROLE_NOT_FOUND` |

Validasi final berada di RPC (bukan hanya UI) dan diulang bot sebelum
menerapkan (`ROLE_UNUSABLE` bila bot tak bisa memberi role). UI
(`model.ts`: `typedSettings`, `validateSettingValues`, `roleGrantProblem`)
hanya memberi umpan balik cepat — rentang yang sama persis dengan yang diterbitkan bot.

Tes: `tests/dashboard-model.test.ts` (model) dan
`supabase/tests/guild-dashboard.test.sql` (RPC, `npm run test:sql`).
Sisi bot: `sambung-kata-bot/docs/verification.md` dan `docs/leveling.md`.
Setelan bertipe **`reward_list`** (Level Rewards): `[{category, level, role_id}]` dengan `limits`
per kategori (Chat 10 · Voice 10 · Combined 5) dan `max_level` dari schema bot. RPC memvalidasi bentuk,
batas per kategori (`REWARD_LIMIT`), level unik per kategori (`REWARD_DUPLICATE`), dan role harus ada di
snapshot. Batas ukuran `settings` per fitur dinaikkan 4000 → 8000 karakter agar 25 reward + blacklist muat.
Role yang sama dengan Verified Role ditolak UI dan bot (`ROLE_CONFLICT`). Editor baris reward ada di tab Leveling.

Opsi **Role belum terverifikasi** (`unverified_role`, tab Verification) diberikan bot saat member masuk
dan dicabut saat lulus. Opsi ini butuh intent Server Members: bot menerbitkan `available: false` di
properti schema bila intent mati, lalu `typedSettings` menyembunyikannya (nilai tersimpan tetap ikut
disimpan apa adanya) dan menampilkannya sebagai catatan penjelasan (bagian 5c). Role ini tidak boleh sama dengan Verified Role atau dipakai sebagai reward (`ROLE_CONFLICT`).

Tab **Leveling** memakai mekanisme yang sama (`channel_list` untuk channel tanpa XP, `help` per setelan untuk daftar variabel pesan).

Tab **Auto Role** (`section: autorole`, `role_list` member & bot + tunda) dan **Welcome** (`section: welcome`, dua tujuan channel welcome/goodbye + pesan teks dengan gaya) dibangun dari registry bot dengan mekanisme yang sama. Role Auto Role yang sama dengan Verified Role ditolak (`ROLE_CONFLICT`, `key` `member_roles`/`bot_roles`). Keduanya butuh intent Server Members di bot: selama intent mati, setelannya terkunci (`available: false`) dan kartu fitur menampilkan kotak "Belum tersedia" dengan penjelasan dari bot (bagian 5c). Acuan bot: `docs/autorole-welcome.md`.

## 5c. 🔒 Setelan terkunci (`available: false` + `locked_note`)

Fitur atau setelan yang belum bisa dipakai (sekarang: butuh intent Server Members
yang belum diaktifkan pemilik bot) **harus dijelaskan**, bukan hilang diam-diam,
supaya admin atau owner server tidak mengira itu bug. Kontrak lengkap, checklist
fitur baru, dan aturan menulis teksnya ada di repo bot:
`sambung-kata-bot/docs/dashboard-setelan-terkunci.md`.

Sisi website (`src/lib/dashboard/model.ts` dan `server-page.ts`):

| Keadaan | Tampilan |
|---|---|
| **Seluruh setelan fitur terkunci** (Auto Role, Welcome) | Kotak "Belum tersedia" berisi `locked_note`, pill status "Belum tersedia", toggle fitur mati dengan keterangan (fitur tidak akan berfungsi, jadi tidak boleh dinyalakan) |
| **Sebagian terkunci** (`unverified_role` di Verification, `rejoin_alert` di Security Center) | Fitur berfungsi normal, ditambah catatan "Sebagian opsi belum tersedia" berisi nama opsi dan alasannya |
| Bot lama tanpa `locked_note` | Memakai teks bawaan `LOCK_FALLBACK_NOTE` |

Aturan:
- `featureLock(f)` adalah satu-satunya pembaca status terkunci; `typedSettings` tetap menyaring setelan terkunci dari isian dan validasi.
- Website **tidak boleh mengarang alasan** per fitur: teks penjelasan datang dari bot (`locked_note`).
- Fitur baru yang punya gerbang serupa cukup menerbitkan `available`, `requires`, dan `locked_note` dari bot; tampilan di website otomatis mengikuti.
- Tes: `tests/dashboard-model.test.ts` (`featureLock`).

## 5d. 📊 Ringkasan Statistik (tab Ringkasan)

Tab Ringkasan menampilkan statistik server dari **data fitur bot yang sudah ada**
(Leveling, Verification, Streak Harian, Counting, Security Center, jumlah member).
Tidak ada RPC baru dan tidak ada akses website ke tabel pemain: bot menulis angka
agregat ke `guild_discord_snapshot.stats_summary` (proyek Database Bot, migration
`0021` di repo bot), dan website membacanya lewat `guild_dashboard_get` yang sudah
ada (`snapshot.stats_summary`). Daftar 7 RPC dashboard tidak berubah. Spesifikasi
sisi bot: `docs/dashboard-sync.md` §5a di repo `sambung-kata-bot`.

| Berkas | Isi |
|---|---|
| `src/lib/dashboard/stats-model.ts` | Tipe, `parseStatsSummary` (defensif: bentuk salah → `null`, angka dipaksa bilangan bulat >= 0), `isStatsStale`, `growthOf`, `percentOf`, format angka. Tes: `tests/stats-model.test.ts` |
| `src/lib/dashboard/overview.ts` | HTML kartu statistik (Aktivitas member, Pertumbuhan member, Keamanan dan verifikasi, Komunitas) |
| `src/lib/dashboard/tab-overview.ts` | Merakit kartu status, Langkah awal, "Perlu perhatian" (dari `featureIssues`, tanpa data bot tambahan), dan kartu statistik |

Aturan:

- **Fitur belum aktif tampil sebagai kotak penjelasan** dengan tombol ke tabnya
  (Leveling, Verification, Security Center, Social Hub), tidak disembunyikan.
- **Alasan terkunci berasal dari bot** (`join_leave.locked_note`, `members.history_note`,
  teks intent Server Members). Website tidak mengarang alasan. Bila kedua teks sama,
  hanya satu kotak ditampilkan.
- Grafik pertumbuhan member baru muncul setelah bot punya riwayat (hanya dicatat saat
  intent Server Members aktif). Member masuk dan keluar belum tersedia.
- **Angka turunan dihitung di browser** dari data yang sudah dikirim bot (tanpa query, tanpa
  penulisan, tanpa perubahan bot): keterikatan harian (aktif 24 jam ÷ aktif 7 hari,
  `stickinessOf`), aktif 30 hari sebagai persen member, member yang pernah mendapat XP
  (`activity.ever`, bisa memuat member yang sudah keluar), total XP chat dan voice, detail
  moderasi dari `security_summary` (kick dan ban aktif, alasan tidak jelas, dicabut, kejadian
  terakhir, diagram kategori alasan), persen dan rata-rata lulus verifikasi serta hari terbaik
  (`verifyStatsOf`), dan laju pertumbuhan dari riwayat member (`growthRateOf`, memakai jarak
  hari sebenarnya supaya hari yang bolong tidak menyesatkan). Menambah angka turunan baru:
  tulis helper murni di `stats-model.ts` dengan tes, jangan menghitung di `overview.ts`.
- **Semua teks dari bot lewat `esc()`.** Tidak ada nama atau ID member di halaman ini.
- Statistik dihitung bot **hanya saat refresh diminta**. Saat Ringkasan dibuka dan
  ringkasannya belum ada atau lebih tua dari `STATS_STALE_MS` (15 menit),
  halaman meminta refresh otomatis (diam, tanpa toast), paling sering sekali per jam
  per server per tab (`sessionStorage`), supaya bot lama yang belum menerbitkan
  ringkasan tidak dibanjiri. Tombol Cek lagi tetap ada.
- Website harus aman terhadap bot yang lebih lama atau lebih baru: `stats_summary`
  kosong atau berversi lain ditampilkan sebagai "belum diterbitkan bot".
- Teks pengguna tanpa tanda pisah (`—`, `–`, ` - `); grafik memakai SVG inline,
  tanpa pustaka grafik tambahan.

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
| `src/lib/dashboard/servers-page.ts` | UI daftar server |
| `src/lib/dashboard/server-page.ts` | Inti halaman server: data, polling, kepala halaman, navigasi, bar simpan |
| `src/lib/dashboard/tab-*.ts`, `share-server.ts` | Isi tiap tab, diunduh saat tab dibuka (bagian 7) |
| `src/lib/dashboard/polling.ts` | Penjadwal poll hemat (tes `tests/dashboard-polling.test.ts`) |
| `src/lib/dashboard/review-model.ts`, `nav-model.ts` | Model murni tinjau, Riwayat, langkah awal, navigasi (tes `tests/dashboard-review.test.ts`) |
| `scripts/dashboard-fixture/` | Uji manual dan pengukuran dengan data fixture (bagian 7) |
| `src/pages/dashboard/` | Kerangka halaman (`/dashboard`, `/dashboard/server/?id=`) |

Deploy ulang Edge Function setelah mengubahnya (MCP Supabase atau
`supabase functions deploy dashboard-discord`, verify JWT aktif). Mengubah
skema: edit `supabase/guild-dashboard-schema.sql` (tetap idempoten), jalankan
`npm run test:sql`, lalu terapkan sebagai migration baru.


### Pengaturan pesan (gaya kartu) dan preview

Kelompok setelan dengan `category: 'message'` tampil di bagian **Pesan teks**
(sisanya **Konfigurasi**). Setelan gaya pesan bertipe `enum` + `labels`
(gambar kecil: tanpa/foto member/ikon server), `color` (`#RRGGBB`), dan
`guide_list` (`[{channel_id, text}]`, `max_items`, `max_text`). `placeholder`
berisi teks/warna bawaan bot. `src/lib/dashboard/message-preview.ts` menggambar
**preview kartu** dari draft yang belum disimpan (data contoh, kartu mengikuti
tampilan Components V2); tes `tests/message-preview.test.ts`. Batas ukuran
`settings` di `guild_config_validate` naik ke 20000 karakter
(`supabase/guild-dashboard-schema.sql`, harus diterapkan ke proyek CMS).

## 7. Hemat sumber daya (aturan mengikat)

Kuota Database Bot (egress, jumlah query) adalah batas keras (CLAUDE.md). Satu
`guild_dashboard_get` di produksi berukuran kira-kira 50 KB (registry sekitar
47 KB, snapshot median 3,6 KB; diukur 2026-11-17), jadi **jumlah poll adalah
biaya utama dashboard**.

### 7a. Polling (`src/lib/dashboard/polling.ts`)

| Keadaan | Jeda |
|---|---|
| Ada aksi yang ditunggu dari bot (Simpan, Coba terapkan lagi, Cek lagi) | 2,5 dtk selama 20 dtk pertama, lalu 5 dtk, paling lama 60 dtk (30 dtk untuk Refresh) |
| Revisi belum diterapkan tetapi jendela cepat sudah lewat (mis. bot offline) | 15 → 30 → 60 → 120 → 300 dtk |
| Tidak ada yang ditunggu | 30 → 60 → 120 → 300 dtk |
| Tab browser tersembunyi | Tidak ada permintaan dan tidak ada timer |
| Kembali ke tab browser | Muat ulang hanya bila data lebih tua dari 15 dtk |

- Jeda kembali ke langkah pertama saat isi respons berubah atau ragam berganti.
  Stempel yang berubah sendiri dan tidak ditampilkan (`server_time`, heartbeat
  bot, `health_checked_at`, `access_verified_at`) tidak dihitung sebagai perubahan.
- Permintaan tidak pernah tumpang tindih. Gagal jaringan ikut memundurkan jeda.
- Share Server memakai penjadwal yang sama: 3 dtk hanya selama ada permintaan
  atau Pesan Uji yang berjalan, selain itu 20 → 40 → 80 → 160 → 300 dtk, dan
  berhenti saat tab Share Server ditutup atau tab browser tersembunyi. Membuka
  ulang tab dalam 20 dtk memakai data yang sudah dimuat.
- **Jangan menambah `setInterval` atau timer poll baru.** Kebutuhan baru memakai
  `createPoller`, dengan tes di `tests/dashboard-polling.test.ts`.

### 7a-2. Poll ringan (migration 0029 repo bot)

`getGuildIfChanged` (dipakai poll) memanggil `guild_dashboard_get` dengan
`p_fields = 'status'`: jawabannya hanya `version` (md5 isi yang ditampilkan).
Hasil penuh diunduh hanya bila `version` berubah, dan registry (sekitar 47 KB)
tidak dikirim ulang selama `registry_version` sama. Database yang belum
menerapkan migration 0029 menjawab `PGRST202`; klien lalu memakai fungsi dua
argumen seperti dulu dan mencoba lagi setelah 6 jam (`sessionStorage`).
Fixture: sejam diam 172.650 B menjadi 13.583 B dengan jumlah permintaan sama.

### 7b. Muat malas per tab

Data: Riwayat (`guild_config_audit_list`) dan Share Server (`share_dashboard_get`)
hanya diminta saat tabnya dibuka. Tab lain memakai data `guild_dashboard_get`
yang sudah ada, tanpa permintaan tambahan.

Kode: `server-page.ts` hanya memuat inti. Isi tab diunduh saat dibuka
(`tab-overview.ts`, `tab-features.ts`, `tab-channels.ts`, `tab-audit.ts`,
`share-server.ts`), bersamaan dengan data awal. Tab baru = modul `tab-*.ts`
baru yang didaftarkan di `ensureModule`, bukan tambahan di inti.

### 7c. Angka terukur (fixture, `scripts/dashboard-fixture/run.mjs measure`)

| Skenario | Sebelum | Sesudah |
|---|---|---|
| Buka Ringkasan, diam 1 jam, tab terlihat | 120 permintaan | 15 |
| Tab Share Server terbuka, tab browser tersembunyi 1 jam | 180 | 0 |
| Share Server terbuka dan diam 1 jam | 300 | 31 |
| Simpan, bot menerapkan dalam 8 dtk, lalu diam 10 menit | 24 | 9 |
| Keliling semua tab sekali | 4 | 3 |
| JS awal halaman server (sebelum tab) | 369.915 B (gzip 108.024) | 300.350 B (gzip 87.884), tab dibuka 1,8 sampai 31 KB |

Dari JS awal itu 216.852 B adalah `@supabase/supabase-js` (dipakai bersama
`/admin`), tidak berubah. Angka permintaan berasal dari backend tiruan dengan jam
tiruan, bukan dari produksi: egress nyata bergantung pada berapa lama admin
membiarkan halaman terbuka dan seberapa sering data server berubah.

### 7d. Uji manual dengan fixture

```bash
BLOG_FIXTURE=tests/fixtures/blog.json BLOG_ALLOW_EMPTY=1 \
PUBLIC_BOT_SUPABASE_URL=https://fixture.supabase.test PUBLIC_BOT_SUPABASE_ANON_KEY=anon-fixture \
npx astro build
node scripts/dashboard-fixture/run.mjs measure        # jumlah permintaan per skenario
node scripts/dashboard-fixture/run.mjs check          # overflow dan target sentuh 360/390/768/1440
node scripts/dashboard-fixture/run.mjs shots <folder> # tangkapan layar terang dan gelap
```

Butuh Playwright dan Chromium di mesin (bukan dependensi repo). Data di
`scripts/dashboard-fixture/fixture.mjs` karangan untuk pengujian, bukan data produksi.

## 8. Alat bantu admin (semuanya tanpa RPC baru)

| Fitur | Tempat | Cara kerja | Biaya |
|---|---|---|---|
| **Tinjau perubahan** | Bar simpan, tombol Tinjau | Daftar "fitur, setelan, dari, menjadi" dari `diffStates(base, draft)` (`describeChange`) | Nol permintaan |
| **Kembalikan ke sebelum ini** | Riwayat, pada catatan perubahan pengaturan | `revertChanges` menyalin nilai lama (`changed_fields[].from`) ke **draft**. Tidak ada yang disimpan sampai admin menekan Simpan, jadi revisi, `STALE_REVISION`, validasi RPC, dan validasi bot tetap berlaku seperti biasa | Nol permintaan |
| **Pulihkan ke revisi ini** | Riwayat, pada 20 perubahan pengaturan terakhir | Satu permintaan `guild_config_audit_list` (isi revisi), lalu `restoreState` memuatnya ke **draft**. Butuh migration 0030 bot; tanpa itu tombolnya tidak tampil | Satu permintaan baca saat ditekan |
| **Salin Pengaturan** | Server Hub, Alat (`#copy`) | Daftar server dari `dashboard-discord` saat tab dibuka, lalu satu `guild_dashboard_get` server sumber. `copyFromServer` menyalin status fitur dan setelan umum ke **draft**; channel dan role tidak disalin | Satu panggilan daftar saat tab dibuka, satu baca saat ditekan |
| **Draft tidak hilang saat muat ulang** | Semua tab | Draft dititipkan di `sessionStorage` dan dipakai lagi hanya bila revisinya masih sama (`recoverDraft`) | Nol permintaan |
| **Cari, saring, ekspor CSV** | Riwayat | `filterAudit`, `auditToCsv` atas catatan yang sudah dimuat. Saringan jenis dijalankan di server bila migration 0030 bot ada (satu permintaan per ganti saringan). Sel CSV yang berawalan `=`, `+`, `-`, `@` dinetralkan | Nol permintaan |
| **Langkah awal** | Ringkasan, selama ada yang belum selesai | `setupSteps`: bot terpasang, data Discord dimuat, fitur sosial diputuskan, bot sudah menerapkan. Bisa disembunyikan per browser (`localStorage`) | Nol permintaan |
| **Arti status dan tombol** | Kepala halaman | Teks dari `STATUS_META` | Nol |
| **Peta Channel** | Server Hub, Alat | Kartu di HP, baris di layar lebar, dengan jumlah tujuan yang perlu diperiksa | Nol permintaan |
| **Gelembung bantuan Vani** | Semua halaman `/dashboard`, di atas tombol Vani "Hubungi kami" | Muncul di dua kesempatan saja (`src/lib/dashboard/help-nudge.ts`, event `vani:help`, ditampilkan `VaniContact.astro`). (1) **Sapaan**: pertama kali membuka dashboard di browser itu (`localStorage`), hilang sendiri setelah 15 detik. (2) **Kegagalan**: `failureTracker` di halaman server menghitung kegagalan berbeda (simpan ditolak, bot menolak menerapkan suatu revisi, sinkron macet); setelah 2 kegagalan muncul "Ada kendala atau masalah? Hubungi tim kami, tim kami siap membantu!" sekali per tab (`sessionStorage`) dan tetap tampil sampai ditutup. Menekan gelembung membuka panel kontak | Nol permintaan |
| **Undang ulang dengan izin lengkap** | Pop up kendala, kartu fitur, pilihan channel, Ringkasan, Peta Channel | Saat izin bot kurang, `permissionFix` membandingkan izin yang kurang dengan izin role bot di tingkat server (`snapshot.bot_permissions`). Bila role bot belum punya izinnya dan tautan undangan memintanya, tampil tautan undang ulang (`inviteUrl` dengan `guild_id`, izin dari data produk). Bila role bot sudah punya izinnya, berarti channel yang menolak, jadi yang tampil adalah langkah Edit Channel › Permissions (undang ulang tidak mengubah izin channel). Bila bot memegang Administrator, hasilnya `stale` (data lama, saran Cek lagi), karena Administrator tidak bisa ditolak channel. Label izin dipetakan di `PERMISSION_BITS`; tes `tests/dashboard-reinvite.test.ts` memastikan tautan undangan memuat semuanya | Nol permintaan |

Hal yang butuh data atau RPC baru dari bot dicatat di
`docs/DASHBOARD-PERMINTAAN-BOT.md`, tidak dibangun diam-diam di website.


## Vani (Social AI) di Sosial Hub

Opsi `SOCIAL_AI_CHAT` (satu channel AI per server) diterbitkan bot sebagai fitur Sosial Hub tersembunyi. Selama sakelar CMS `social_ai_enabled` mati (bawaan, `supabase/social-ai.sql`), opsi tampil terkunci memakai `locked_note` dari bot, jadi tidak ada teks buatan website. Biaya sumber daya website nol: tidak ada polling atau tabel baru, hanya dua baris `bot_settings`. Rancangan lengkap ada di `docs/social-ai.md` repo bot. Kebijakan privasi (`/privacy`, bagian 04) menyebut penyedia AI.

> **Sapa Voice dicabut dari dashboard (2026-11-22).** Fitur bawaan Vanillate ini diatur pengembang
> lewat sakelar CMS `voice_sapa_enabled`, bukan setelan admin server. Tab `#voice-sapa` dihapus,
> dan bagian registry `voice_sapa` disaring di `src/lib/dashboard/api.ts` (`REMOVED_SECTIONS` di
> `nav-model.ts`) karena RPC publikasi registry tidak menghapus baris lama dan bagian tak dikenal
> jatuh ke Game Hub. Tautan lama `#voice-sapa` jatuh ke Ringkasan.
