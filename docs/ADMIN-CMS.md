# 🔐 Panel Admin & CMS — Vanillate Website

Panduan lengkap panel `/admin`: cara kerjanya, cara menyiapkannya, dan apa yang
masih perlu dikerjakan di sisi bot.

---

## 1. Model keamanan — baca ini dulu

Website vanillate.id adalah **situs statis** di GitHub Pages. Tidak ada server
milik kita yang menerima permintaan dan bisa memeriksa siapa yang datang. Ini
mengubah arti "halaman terkunci", jadi penting dipahami sejak awal:

| Yang **bisa** dijamin | Yang **tidak bisa** dijamin |
|---|---|
| Tanpa login yang sah, **tidak ada satu baris data pun** yang keluar dari Supabase | Menyembunyikan keberadaan halaman `/admin` |
| Password diverifikasi Supabase, bukan oleh kode di browser | Mencegah orang mengunduh file HTML `/admin` |
| Peran (owner/admin/viewer) ditegakkan database, bukan tampilan | Menyembunyikan `anon key` (memang publik) |

Singkatnya: **kerangka halaman admin memang publik, tapi isinya kosong.**
Orang yang membuka `/admin` tanpa akun hanya melihat form login. Semua angka,
log, dan daftar pemain dijaga **Row Level Security (RLS)** di Supabase — aturan
di database yang menolak permintaan tanpa JWT admin yang valid.

> Ini bukan kompromi keamanan, melainkan pemindahan tempat penjagaan: dari
> "server yang memblokir halaman" ke "database yang menolak data". Untuk panel
> admin sebuah studio bot, ini setara amannya.

Kalau suatu saat `/admin` benar-benar harus tidak terlihat tanpa login,
pindahkan hosting ke Cloudflare Pages atau Vercel dan aktifkan SSR Astro. Saat
itu barulah API route dan cookie httpOnly bisa dipakai.

### Aturan kunci yang tidak boleh dilanggar

| Kunci | Boleh di browser? | Tempatnya |
|---|---|---|
| `anon key` (`PUBLIC_SUPABASE_ANON_KEY`) | ✅ Ya, memang dirancang publik | GitHub Actions secret → ikut ter-build |
| `service_role key` | ❌ **Tidak pernah** | Hanya di server bot & GitHub Actions secret |

`service_role key` mem-bypass seluruh RLS. Bila ia bocor ke browser, semua data
di atas ikut terbuka.

---

## 2. Setup Supabase (sekali saja)

### a. Buat project

1. Daftar di [supabase.com](https://supabase.com) — paket gratis cukup.
2. **New project** → pilih region **Southeast Asia (Singapore)** agar dekat
   dengan pemain Indonesia.
3. Simpan password database yang dibuat di langkah ini.

### b. Jalankan skema

1. Buka **SQL Editor** → **New query**.
2. Salin seluruh isi [`supabase/schema.sql`](../supabase/schema.sql) → **Run**.
3. Pastikan tidak ada error merah. File ini aman dijalankan berulang.

Skema itu membuat tabel `admin_users`, `bot_logs`, `bot_stats`, `bot_guilds`,
`bot_players`, `site_content`, plus seluruh aturan RLS-nya.

### c. Ambil kunci

**Settings → API**, catat:

- **Project URL** → `https://xxxxx.supabase.co`
- **anon public** → dipakai website
- **service_role** → dipakai bot & workflow konten (rahasia)

---

## 3. Isi GitHub Secrets

**Settings → Secrets and variables → Actions → New repository secret**:

| Nama secret | Isi | Dipakai untuk |
|---|---|---|
| `PUBLIC_SUPABASE_URL` | Project URL | Build website |
| `PUBLIC_SUPABASE_ANON_KEY` | anon public key | Build website |
| `SUPABASE_URL` | Project URL (sama) | Workflow sync konten |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | Workflow sync konten |

Tanpa dua secret pertama, website tetap ter-build dengan aman — halaman `/admin`
otomatis menampilkan panduan setup, bukan error.

### Pengembangan lokal

```bash
cp .env.example .env
# isi PUBLIC_SUPABASE_URL dan PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

`.env` sudah masuk `.gitignore`.

---

## 4. Membuat admin pertama

**Langkah 1 — buat akun auth.** Supabase Dashboard → **Authentication → Users**
→ **Add user → Create new user**:

- Email: `owner@vanillate.id` (boleh email apa saja, tidak harus nyata)
- Password: pilih yang kuat
- Centang **Auto Confirm User**

**Langkah 2 — daftarkan sebagai admin.** SQL Editor:

```sql
insert into public.admin_users (id, username, display_name, role)
select id, 'andi', 'Andi Kurniawan', 'owner'
from auth.users where email = 'owner@vanillate.id'
on conflict (id) do update
  set username = excluded.username,
      display_name = excluded.display_name,
      role = excluded.role;
```

Sekarang buka `/admin` dan login dengan username `andi` + password tadi.

> **Kenapa dua langkah?** Supabase Auth hanya mengenal email. Baris di
> `admin_users` yang menambahkan username dan peran. Akun auth **tanpa** baris
> di sana tidak dianggap admin dan tidak bisa melihat apa pun — jadi menambah
> user di Dashboard saja tidak otomatis memberi akses.

### Peran

| Peran | Bisa |
|---|---|
| `owner` | Lihat semua + edit konten + lihat daftar admin lain |
| `admin` | Lihat semua + edit konten |
| `viewer` | Lihat saja |

---

## 5. Kontrak data — yang perlu dikerjakan di repo bot

Halaman log, statistik, server, dan pemain **hanya membaca**. Yang mengisinya
adalah bot, memakai `service_role key`. Selama bot belum mengirim apa pun,
halaman-halaman itu tampil kosong dengan pesan yang menjelaskan — bukan error.

### Mau lihat panelnya terisi dulu? Jalankan seed demo

Sebelum bot tersambung, isi data contoh supaya bisa memastikan panelnya
berfungsi — grafik muncul, filter log jalan, tabel server dan pemain terisi:

1. Supabase → **SQL Editor** → tempel seluruh isi `supabase/seed-demo.sql` → **Run**
2. Buka `/admin/dashboard`, `/admin/logs`, `/admin/statistik`, `/admin/server`,
   dan `/admin/pemain` — semuanya sudah ada isinya

Seed ini aman dijalankan berulang kali; setiap kali dijalankan ia membersihkan
data demo sebelumnya lebih dulu. Semua barisnya ditandai `meta->>'demo' = 'true'`,
jadi saat bot asli sudah mengirim data, hapus yang demo saja lewat blok
**MEMBERSIHKAN DATA DEMO** di bagian bawah file itu — data asli tidak tersentuh.

### Yang dipasang di repo bot

Pasang di repo bot:

```bash
npm install @supabase/supabase-js
```

```js
// db-website.js — di repo sambung-kata-bot
import { createClient } from '@supabase/supabase-js';

// service_role key: HANYA di server bot, lewat environment variable.
const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

/** Catat satu kejadian. Panggil saat command dijalankan, error, dsb. */
export async function catatLog({ level = 'info', event, message, guildId, guildName, actorId, meta }) {
  await db.from('bot_logs').insert({
    level, event, message,
    guild_id: guildId, guild_name: guildName, actor_id: actorId, meta,
  });
}

/** Kirim snapshot statistik. Panggil berkala, mis. tiap 5 menit. */
export async function kirimStatistik(client) {
  await db.from('bot_stats').insert({
    guild_count: client.guilds.cache.size,
    member_reach: client.guilds.cache.reduce((n, g) => n + g.memberCount, 0),
    active_players: await hitungPemainAktif(),   // dari database bot
    games_played: await hitungGameHariIni(),     // dari database bot
    commands_run: await hitungCommandHariIni(),  // dari database bot
    uptime_seconds: Math.floor(client.uptime / 1000),
    latency_ms: Math.round(client.ws.ping),
  });
}

/** Segarkan daftar server. Panggil saat start, guildCreate, dan guildDelete. */
export async function segarkanDaftarServer(client) {
  const daftar = client.guilds.cache.map((g) => ({
    guild_id: g.id,
    name: g.name,
    member_count: g.memberCount,
    owner_id: g.ownerId,
    joined_at: g.joinedAt?.toISOString(),
    last_seen_at: new Date().toISOString(),
    is_active: true,
  }));

  // upsert: server yang sudah ada diperbarui, yang baru ditambahkan.
  await db.from('bot_guilds').upsert(daftar, { onConflict: 'bot_slug,guild_id' });

  // Tandai server yang sudah tidak ada sebagai tidak aktif — jangan dihapus,
  // supaya riwayatnya tetap terbaca di dashboard.
  const idAktif = daftar.map((g) => g.guild_id);
  await db.from('bot_guilds')
    .update({ is_active: false })
    .not('guild_id', 'in', `(${idAktif.join(',')})`);
}
```

### Bentuk tabel

| Tabel | Kolom penting | Kapan diisi |
|---|---|---|
| `bot_logs` | `level` (`debug`/`info`/`warn`/`error`), `event`, `message`, `guild_id`, `guild_name`, `meta` | Setiap kejadian |
| `bot_stats` | `guild_count`, `active_players`, `games_played`, `commands_run`, `latency_ms` | Berkala (mis. 5 menit) |
| `bot_guilds` | `guild_id`, `name`, `member_count`, `is_active` | Saat start + guild masuk/keluar |
| `bot_players` | `player_id`, `display_name`, `level`, `games_played`, `wins`, `last_seen_at` | Saat progres pemain berubah |

### Rawat volume log

`bot_logs` tumbuh cepat. Pasang pembersih otomatis di SQL Editor supaya paket
gratis tidak cepat penuh:

```sql
delete from public.bot_logs
where created_at < now() - interval '30 days';
```

---

## 6. Alur edit konten

Halaman **Konten** di panel admin mengubah teks yang sering berganti
(pengumuman/banner) tanpa menyentuh kode. Alurnya:

```
   Admin edit di /admin/konten
              │
              ▼
   Supabase: tabel site_content
              │
              │  GitHub Actions (sync-content.yml), tiap 15 menit + manual
              ▼
   src/data/synced/site-content.json  ─── di-commit bila berubah
              │
              ▼
   Build + deploy ke vanillate.id
```

**Perubahan tidak langsung tampil.** Situsnya statis, jadi harus di-build ulang
dulu. Realistisnya **~5–45 menit**: sync terjadwal tiap 15 menit, tetapi jadwal
GitHub Actions kerap tertunda, lalu build + deploy Pages memakan ~2–3 menit.
Untuk menerbitkan segera: tab **Actions** → **Sync konten dari Supabase** →
**Run workflow** (~2–3 menit).

Perkiraan waktu untuk semua jalur data, penyebab keterlambatan, dan
troubleshooting-nya ada di [`PIPELINE-TERBIT.md`](./PIPELINE-TERBIT.md).

Kenapa lewat build, bukan dibaca langsung di browser pengunjung? Karena
`site_content` dijaga RLS. Kalau halaman publik membacanya langsung, tabel itu
harus dibuka untuk anon. Menariknya saat build membuat pengunjung cukup menerima
HTML biasa: nol query, nol kunci, halaman tetap cepat.

### Menambah field konten baru

```sql
insert into public.site_content (key, label, value, kind, help) values
  ('hero_subtitle', 'Subjudul beranda', 'Teks awal', 'text', 'Tampil di bawah judul utama.');
```

`kind` yang didukung: `text`, `markdown`, `url`, `boolean`. Field baru otomatis
muncul di panel. Untuk memakainya di halaman, tambahkan pemetaannya di
`scripts/sync-content.mjs` lalu baca dari `site-content.json`.

---

## 7. Soal Discord API

Panel ini **tidak** memanggil Discord API langsung dari browser, dan itu
disengaja. Memanggil Discord API butuh **bot token**, dan token itu rahasia
penuh — siapa pun yang memegangnya bisa mengambil alih bot. Di situs statis,
apa pun yang dikirim ke browser bisa dibaca pengunjung, jadi menaruh bot token
di sana sama saja mempublikasikannya.

Karena itu polanya: **bot** yang memanggil Discord API (ia memang sudah
memegang tokennya), lalu mengirim hasilnya ke Supabase. Panel admin membaca dari
Supabase. Jumlah server, daftar server, dan daftar pemain semuanya lewat jalur
ini.

---

## 8. Privasi

Halaman **Pemain** menampilkan data orang lain. Beberapa hal yang perlu dijaga:

- **Simpan seminimal mungkin.** Discord ID, nama tampilan, dan progres
  permainan sudah cukup untuk dukungan dan moderasi.
- **Jangan** menaruh isi percakapan, email, atau alamat IP di `bot_players`
  atau `meta`.
- Pastikan [kebijakan privasi](../src/pages/privacy.astro) menyebutkan data apa
  yang dikumpulkan dan berapa lama disimpan.
- Beri peran `viewer` untuk anggota tim yang hanya perlu melihat statistik.

---

## 9. Troubleshooting

**"Username atau password salah" padahal yakin benar**
Cek baris di `admin_users` sudah ada dan `username`-nya cocok:
```sql
select a.username, a.role, u.email
from public.admin_users a join auth.users u on u.id = a.id;
```

**"Tabel belum ada di Supabase"**
`supabase/schema.sql` belum dijalankan, atau hanya sebagian. Jalankan ulang
seluruh isinya — file itu aman diulang.

**"Akun ini tidak punya akses admin"**
Akun auth-nya ada, tapi belum terdaftar di `admin_users`. Lihat bagian 4
langkah 2.

**"Aturan keamanan database saling memanggil (rekursi)"**
Skema versi lama punya policy `admin_users` yang menanyai `admin_users` lagi di
dalam dirinya sendiri — PostgreSQL menolaknya (error 42P17), dan login jadi
gagal walau username, password, serta barisnya sudah benar. Jalankan ulang
seluruh `supabase/schema.sql` versi terbaru; data yang sudah ada tidak
terpengaruh.

**Halaman admin menampilkan "Belum dikonfigurasi"**
Secret `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` belum diisi saat
build. Isi secret-nya lalu jalankan ulang workflow deploy.

**Semua angka nol, tapi tidak ada error**
Normal bila bot belum mengirim data. Lihat bagian 5.

**Konten sudah disimpan tapi belum tampil di situs**
Normal sampai ~45 menit: situsnya statis dan menunggu sync terjadwal + build.
Jalankan **Actions → Sync konten dari Supabase → Run workflow** untuk terbit
dalam ~2–3 menit. Kalau setelah workflow hijau isinya tetap lama, cek apakah
field itu memang disinkron oleh `scripts/sync-content.mjs`.

**Panel terasa "tidak nyambung" ke bot**
Cek `/admin/logs` dulu. Kalau ada log berumur detik/menit, jalur bot ↔ Supabase
sehat dan yang tertinggal adalah halaman publik (butuh build). Setting di
`/admin/kontrol` sendiri diterapkan bot dalam ≤60 detik tanpa build.

**"Data terakhir berubah" terlihat basi berjam-jam**
Itu memang stempel *perubahan terakhir*, bukan *pemeriksaan terakhir* —
`_status.json` sengaja hanya di-commit saat datanya berubah. Bukti bahwa
pemeriksaan jalan ada di tab Actions.

---

## 10. Peta file

| File | Isi |
|---|---|
| `supabase/schema.sql` | Skema tabel, fungsi, dan seluruh aturan RLS |
| `supabase/seed-demo.sql` | Data contoh untuk mencoba panel sebelum bot tersambung |
| `supabase/seed-faq.sql` | Isi awal FAQ (hasil migrasi dokumentasi lama) — **digenerate** |
| `scripts/faq-seed-data.mjs` | Sumber isi awal FAQ; `scripts/build-faq-seed.mjs` yang menuliskannya |
| `src/lib/supabase.ts` | Inisialisasi klien Supabase |
| `src/lib/admin-auth.ts` | Login, guard sesi, profil admin |
| `src/lib/admin-ui.ts` | Escaping & blok status tampilan |
| `src/lib/admin-chart.ts` | Grafik tren di halaman statistik |
| `src/layouts/AdminLayout.astro` | Kerangka panel + penjaga sesi |
| `src/pages/admin/*.astro` | Halaman login dan dashboard |
| `src/pages/admin/kontrol.astro` | **Control panel** — atur setting bot + jadwal + kartu pemantauan + riwayat perubahan |
| `src/pages/admin/operasi.astro` | **Console aksi** — antrean perintah bot (dengan konfirmasi aksi berbahaya & test-send) |
| `src/pages/admin/games.astro` | **Monitor game** live (akhiri game mode klasik) |
| `src/pages/admin/promo.astro` | **Manajemen promo** (daftar + analitik + nyalakan/matikan) |
| `src/pages/admin/kata.astro` | **Moderasi kata** (terima/tolak usulan Word Collection) |
| `src/pages/admin/faq/index.astro` | **FAQ** — tulis & kelola seluruh panduan |
| `src/pages/admin/faq/categories.astro` | **Kategori FAQ** — struktur panduan |
| `src/utils/markdown.ts` | Renderer jawaban FAQ (dipakai situs publik & pratinjau CMS) |
| `scripts/sync-content.mjs` | Menarik konten Supabase saat build |
| `.github/workflows/sync-content.yml` | Penjadwalan sync konten |

---

## 11. Control Panel Bot (arah balik: website → bot)

Bagian 1–10 memakai arah data **bot → website** (bot menulis, panel membaca).
Panel `/admin/kontrol` dan `/admin/operasi` menambahkan **arah balik website → bot**,
mengubah panel menjadi control panel: developer mengatur bot dari website tanpa
menyentuh source code atau me-restart bot. Setara Developer Dashboard di dalam
Discord.

Dua tabel Supabase (dibuat oleh `supabase/schema.sql` bagian 7):

| Tabel | Peran | Ditulis oleh | Dibaca oleh |
|---|---|---|---|
| `bot_settings` | State deklaratif (maintenance, pengumuman, toggle mode, tunable, feature flag) | editor via panel `/admin/kontrol` | bot (service_role, live polling) |
| `bot_commands` | Antrean aksi sekali-jalan (kelola pemain/boost/promo/quest/broadcast) | editor via panel `/admin/operasi` | bot (service_role, dieksekusi lalu status ditulis balik) |

### Cara kerja

```
   Admin ubah setting di /admin/kontrol         Admin kirim aksi di /admin/operasi
              │                                             │
              ▼                                             ▼
   Supabase: bot_settings                        Supabase: bot_commands (pending)
              │                                             │
              │  bot menarik tiap ± 1 menit                 │ bot menarik tiap ± 45 dtk
              ▼                                             ▼
   remoteConfig menerapkan LIVE:                 remoteCommands eksekusi lewat
   maintenance, pengumuman, toggle mode,         manager bot (playerStats, boost,
   tunable (di-clamp), feature flag              promo, broadcast) → tulis balik
                                                 status done/error + hasil
```

Berbeda dari halaman **Konten** (yang me-rebuild situs statis), halaman kontrol
menyetir bot, **bukan** situs publik — jadi tidak ada build/deploy yang terpicu.

### Keamanan (RLS)

- `bot_settings`: admin boleh baca, `owner`/`admin` boleh ubah. Bot menulis balik
  (best-effort, saat kontrol yang sama diubah dari Discord) via service_role.
- `bot_commands`: admin boleh baca riwayat; `owner`/`admin` boleh **INSERT** perintah,
  dipaksa `status = 'pending'` + `created_by = auth.uid()`. **Tidak ada** UPDATE/DELETE
  untuk `authenticated` — status hanya ditulis bot (service_role).
- Nilai numerik & payload perintah **selalu divalidasi ulang & di-clamp di sisi bot**;
  input panel tidak pernah dipercaya mentah.
- **Versi & changelog tidak dikontrol dari sini** — SSoT-nya tetap `version.json` +
  `CHANGELOG.json` di repo bot. Panel sengaja tidak menyediakan editornya.

### Sisi bot (repo `sambung-kata-bot`)

Aktif otomatis begitu `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` terisi (env yang
sama dengan Website Sync — tanpa secret baru). Bila kosong, seluruh fitur diam total.

| File | Peran |
|---|---|
| `src/services/remoteConfig.js` | Tarik `bot_settings`, terapkan live (`isModeEnabled`/`tunable`/`getFlag`) |
| `src/services/remoteCommands.js` | Proses antrean `bot_commands` (registry `HANDLERS`) |
| `src/services/websiteSync.js` | (sudah ada) kirim log/statistik + metrik pemantauan ke `bot_stats.meta` |

### Menambah aksi/setting baru

- **Setting (item)**: tambah baris di seed `bot_settings` (`supabase/schema.sql`) dengan
  kolom `category` menunjuk ke sebuah `key` di `bot_setting_categories` — otomatis muncul
  sebagai item di bawah section kategori itu di `/admin/kontrol`. Konsumsi di bot lewat
  `remoteConfig.getFlag/tunable`.
- **Kategori**: tambah baris di `bot_setting_categories` (`key`, `label`, `description`,
  `icon`, `sort`). Section baru langsung terbentuk — tampilannya **data-driven**, tak perlu
  ubah frontend. `icon` = nama Lucide (mis. `wrench`); nama tak dikenal memakai ikon default.
- **Aksi**: tambah entri form di `GRUP` (`src/pages/admin/operasi.astro`) + handler dengan
  `type` yang sama di `HANDLERS` (`src/services/remoteCommands.js`). Tidak perlu tabel baru.

### Peningkatan (bagian 8 schema)

Selain dua tabel inti, `supabase/schema.sql` bagian 8 menambahkan:

| Tabel | Peran |
|---|---|
| `bot_setting_categories` | Metadata kategori (label/deskripsi/ikon/urutan) — hierarki **Kategori → Item** yang data-driven di `/admin/kontrol` (bagian 9). |
| `bot_settings_audit` | Riwayat perubahan setting (trigger otomatis: key, old→new, kapan). Tampil di `/admin/kontrol`. |
| `bot_games` | Snapshot game aktif (di-upsert bot ~30 dtk, auto-bersih saat selesai) → `/admin/games`. |
| `bot_promos` | Cermin daftar promo untuk baca cepat → `/admin/promo`. |
| `bot_word_queue` | Antrean kata menunggu moderasi → `/admin/kata`. |
| `partnership_slots` | Partner yang tampil di **Dashboard Partnership** pada lobby bot → `/admin/partnership/lobby` (bagian 11). |
| `partnership_lobby` | Judul dashboard + seluruh teks & posisi item **Order Partnership** (bagian 11). |
| `partnership_categories` | Struktur kategori partner & paket — dipakai CMS, halaman publik, dan bot (bagian 12). |

Tambahan lain:
- **Penjadwalan**: setting `maintenance_start_at`/`maintenance_end_at` (maintenance efektif =
  manual OR jendela terjadwal) dan `discord_announcement_expires_at` (pengumuman auto-mati).
- **Keselamatan aksi**: `/admin/operasi` meminta konfirmasi untuk aksi berbahaya; broadcast massal
  wajib ketik `BROADCAST` dan punya **test-send** (`broadcast.test`) ke satu ID lebih dulu.
- **Robustness bot**: perintah yang nyangkut di `processing` > 10 menit ditandai error
  (bukan diulang); tunable pemain dijaga `min ≤ max`; lonjakan error memicu alert ke channel
  developer.
- **Pemantauan**: `bot_stats.meta` kini memuat memori, game aktif, total pemain/coin, banned —
  ditampilkan sebagai kartu di `/admin/kontrol` dan grafik di `/admin/statistik`.

> **Realtime:** kontrol memakai polling (setting ~60 dtk, perintah ~20 dtk). WebSocket realtime
> sengaja tidak dipakai agar bot tetap pada jalur REST minimal & fail-safe tanpa dependency baru.

---

## 12. Partnership System

Partnership adalah **layanan berbayar**: studio menjual dua produk broadcast ke partner, dan
seluruh harga serta konten halaman publiknya dikelola dari CMS.

| Produk | `channel` | Status |
|---|---|---|
| **Broadcast via DM** | `dm` | Dijual **dan** dieksekusi otomatis oleh bot (queue + rate limit + laporan) |
| **Broadcast via Lobby** | `lobby` | Dijual & ditampilkan dengan harga; delivery masih manual |

Kolom `channel` sudah ada sejak awal, jadi delivery Lobby bisa ditambahkan nanti tanpa mengubah
struktur.

### Dua sisi

- **Admin** — `/admin/partnership` dengan tab: Overview, Broadcast DM, Active Players,
  Campaign History, Produk & Harga, **Kategori**, Lobby Bot, Templates, Settings.
- **Publik** — `/partnership`, halaman penjualan: hero, bukti jangkauan, kartu produk + harga,
  info program, benefit, cara kerja, FAQ, CTA.

### Alur broadcast

```
Active Players → Copy User IDs → Broadcast DM → paste → validasi & dedup
   → nama + pesan → tombol Partnership (wajib) + custom link → Preview → Confirm
   → campaign `queued` + daftar penerima
        │  bot poll tiap ~30 dtk (service_role)
        ▼
   running → kirim DM (jeda ≥800ms, retry 1× untuk error sesaat)
   → status per User ID (success/failed/skipped) + progress
   → completed  →  terlihat di Campaign History
```

Penerima broadcast menekan tombol **Partnership** → mendarat di `/partnership`.

### Tabel (bagian 10 schema)

| Tabel | Peran |
|---|---|
| `partnership_products` | Katalog + **harga** (dikelola CMS → tampil di halaman publik) |
| `partnership_campaigns` | Campaign persistent: pesan, tombol, counter, status, log |
| `partnership_recipients` | Status pengiriman **per User ID** |
| `partnership_links` | Custom link opsional untuk tombol broadcast |
| `partnership_settings` | Partnership URL & Apply URL |
| `partnership_page` | Seluruh konten halaman publik (jsonb) |
| `partnership_templates` | Template pesan yang bisa dipakai ulang |
| `partnership_categories` | **Struktur kategori** partner & paket (bagian 12) — dipakai CMS, halaman publik, dan bot |

Fungsi `next_partnership_broadcast_id()` membuat ID harian `PTN-YYYYMMDD-NNNN`.

### Keamanan & konsen

- **RLS**: admin baca; `owner`/`admin` kelola. Penerima hanya boleh **di-INSERT** dengan status
  `pending` — status pengiriman **tidak bisa diubah dari browser**, hanya bot (service_role), supaya
  laporan pengiriman tidak bisa dipalsukan.
- **Konsen dihormati di jalur mana pun**: bot melewati pemain yang `dm_opt_in=false` atau diblokir,
  walau User ID-nya diketik manual oleh admin — ditandai `skipped`, bukan `failed`.
- URL tombol wajib http(s) (menutup `javascript:`), maksimal 5 tombol per pesan (batas Discord).
- **Cancel**: panel menyetel `cancel_requested`; bot berhenti di sela pengiriman dan menandai sisa
  penerima `skipped`. Pesan yang sudah terkirim tentu tidak bisa ditarik.
- Bot melanjutkan campaign `running` setelah restart (penerima `pending` diproses lagi).

### Harga & konten publik → build

`scripts/sync-content.mjs` menarik `partnership_products` (yang `enabled`), `partnership_settings`,
`partnership_links`, `partnership_categories`, dan `partnership_page.content` ke
`src/data/synced/partnership.json`; halaman publik meng-`import` file itu. **Perubahan harga tampil setelah build ulang** — terjadwal tiap 15
menit (realistis ~5–45 menit), atau jalankan **Actions → Sync konten dari Supabase** untuk terbit
dalam ~2–3 menit. Lihat [`PIPELINE-TERBIT.md`](./PIPELINE-TERBIT.md).

Field yang belum disebut di `scripts/sync-content.mjs` **tidak ikut terbit** walau bisa diisi di
panel. Saat menambah kolom baru di `partnership_products`, tambahkan juga namanya di query `select`
dan pemetaan objeknya di skrip itu.

**Harga tanpa pembatasan nominal.** Kolom `price` adalah `numeric` biasa: tanpa presisi tetap,
tanpa batas atas, dan tanpa `check`. Di CMS harganya diketik sebagai teks bebas — `150000`,
`150.000`, `Rp 1.250.000,75` semuanya diterima (dibaca `parsePrice` di `src/data/partnership.ts`),
dan tidak ada `step`/`min`/`max` yang menolak nominal tertentu. Yang ditolak hanya input yang
memang bukan angka.

Tiga keadaan sengaja dibedakan:

| Nilai | Halaman publik | Dashboard bot |
|---|---|---|
| kosong (`null`) | **"—"** + "Hubungi kami untuk penawaran" | "Hubungi kami untuk penawaran" |
| `0` | **"Gratis"** | "Gratis" (+ satuan bila ada) |
| angka lain | diformat penuh, mis. `Rp1.250.000,75` | `Rp 1.250.000,75 / <satuan>` |

Minimum order mengikuti aturan yang sama: bebas angka, tanpa batas atas.

### CTA → WhatsApp official

Tombol tiap produk membuka WhatsApp official dengan pesan terisi (produk + kategori; **tanpa harga
dan tanpa ID**). Nomornya diambil dari `whatsappNumber` di `src/data/support.ts` (env
`PUBLIC_SUPPORT_WHATSAPP`) — tidak pernah ditulis ulang di komponen. Karena pesannya statis per
produk, tautannya dibangun saat build sehingga halaman publik **tidak butuh JavaScript**.

Per produk, admin bisa mengganti tujuan tombol ke URL kustom (`cta_mode = url`, mis. Google Form).

### SEO

`/partnership` memasang structured data khusus lewat slot `head` di `BaseLayout`:
`Service` + **`Offer` per produk** (harga dari CMS → berpeluang rich result harga), `FAQPage`
(berpeluang accordion di hasil pencarian), dan `BreadcrumbList`. SEO title/description/OG image
juga diatur dari CMS. Halaman ini masuk `nav` dan sitemap.

---

## 13. Partnership di Lobby Bot

Selain halaman publik `/partnership`, Partnership punya "panggung" di dalam permainan:
bot menampilkan **Dashboard Partnership** sebagai pesan **terpisah** tepat di bawah
Dashboard Lobby. Semua isinya dikelola dari `/admin/partnership/lobby` — tidak ada
nama partner, harga, satuan, atau minimum order yang ditulis di kode bot.

| Yang diatur | Di mana | Dipakai bot untuk |
|---|---|---|
| Partner (nama, emoji, judul, deskripsi, **kategori**, logo/banner, tautan, label tombol, urutan, aktif, jadwal mulai/berakhir) | tab **Lobby Bot** → *Partner yang tampil* | item list di Dashboard Partnership |
| **Detail partnership** (judul, deskripsi panjang, sorotan, gambar, label tombol tautan, catatan kaki) | tab **Lobby Bot** → kotak *Detail partnership* pada tiap partner | isi balasan ephemeral saat tombol partner ditekan |
| Judul dashboard, catatan, dan seluruh teks item CTA + posisinya (`atas`/`bawah`) | tab **Lobby Bot** → *Dashboard & item CTA* | header + item CTA "Order Partnership" |
| Struktur kategori (label, deskripsi, emoji, urutan, cakupan) | tab **Kategori** | judul & urutan kelompok di dashboard dan baris tombolnya |
| Satuan paket & minimum order (mis. **Pemain** min 100, **Hari** min 15) + harga | tab **Produk & Harga** | layar paket saat pemain menekan **Order Partnership** |

**Tombol partner: detail dulu, baru tautan**

Menekan tombol partner **tidak** langsung membuka link tujuan. Bot membalas
**ephemeral** (`flags: 64` — hanya terlihat oleh penekannya) berisi detail
partnership dari CMS; tautan tujuan menjadi tombol **di dalam** balasan itu,
berdampingan dengan jalan pintas *Order Partnership*. Jadi pemain memahami
partnernya lebih dulu sebelum memutuskan.

Kolom detail yang dikosongkan jatuh ke kolom ringkasnya (judul item, deskripsi
singkat, banner), sehingga balasannya tidak pernah kosong.

**Perilaku yang dijamin**

- Dashboard **selalu tampil**, bahkan tanpa partner sama sekali — item CTA menjadi
  satu-satunya isi list, sehingga areanya tidak pernah terlihat kosong.
- Item CTA adalah **bagian dari list** (field embed), **bukan footer**.
- Partner **dikelompokkan per kategori** dengan urutan yang sama persis dengan CMS;
  kategori yang belum terdaftar tetap tampil di akhir, jadi tidak ada partner yang
  hilang dari dashboard.
- Partner otomatis berhenti tampil di luar jendela `start_at`–`end_at` atau saat
  dinonaktifkan — tanpa perlu menghapusnya.
- Harga bebas nominal; yang belum diisi ditulis **"Hubungi kami untuk penawaran"**,
  `0` ditulis **"Gratis"**.
- Bot menyegarkan konten berkala (± 5 menit), jadi perubahan berlaku **tanpa restart
  bot dan tanpa build website**.

Rinciannya (struktur embed, tombol, `customId` `ptn_*`) ada di repo bot:
`docs/lobbysambungkata.md` § 7b.

### Kategori Partnership (bagian 12 schema)

`partnership_categories` adalah **satu-satunya** sumber struktur kategori, dipakai
tiga tempat sekaligus supaya tidak pernah berbeda:

| Tempat | Yang mengikuti kategori |
|---|---|
| CMS | Section per kategori di tab **Produk & Harga** dan **Lobby Bot** (tidak lagi satu daftar panjang) |
| Halaman publik `/partnership` | Pengelompokan kartu paket (setelah build) |
| Dashboard Partnership di bot | Header kelompok di embed + pengelompokan baris tombol |

| Kolom | Peran |
|---|---|
| `key` | Kunci yang disimpan `partnership_slots.category` / `partnership_products.category` |
| `label`, `description` | Judul & keterangan section |
| `icon` | Nama ikon Lucide untuk CMS (registry aman di `src/lib/partnership-kategori.ts`; DB tidak pernah menyimpan markup) |
| `emoji` | Ikon teks untuk Discord — bot tidak bisa merender SVG |
| `scope` | `partner` / `produk` / `semua` — menentukan di tab mana kategori boleh dipilih |
| `enabled`, `sort` | Muncul sebagai pilihan atau tidak, dan urutan section di semua tempat |

Kategori **tanpa foreign key** (sama seperti `bot_settings.category`): menghapus
kategori tidak ikut menghapus partner/produknya — item-nya hanya berpindah ke
section **Lainnya** sampai admin memindahkannya.

---

## 14. Konten halaman publik `/partnership`

Seluruh isi halaman penjualan dikelola dari **Partnership → Settings** (bagian
*Konten publik*) dan disimpan sebagai satu JSON di `partnership_page.content`.
Halaman publik membacanya **saat build** (lewat `scripts/sync-content.mjs`), jadi
mengubah copy tidak pernah butuh perubahan kode.

### Bagian yang tersedia

| Bagian | Kunci JSON | Bentuk pengisian di CMS | Perilaku bila dikosongkan |
|---|---|---|---|
| Hero (judul, subjudul, label CTA) | `hero` | tiga kolom teks | judul jatuh ke "Partnership" |
| Bukti jangkauan (statistik) | `showStats` | otomatis dari `homeStats` | set `false` untuk menyembunyikan |
| Paket & harga | *(dari tab Produk & Harga)* | — | bagian hilang bila tak ada produk aktif |
| **Bandingkan paket** | `compare` | judul, catatan, nama kolom (satu per baris), baris `Aspek \| Kolom 1 \| Kolom 2` | tabel disembunyikan |
| **Contoh tampilan** | `preview` | judul, catatan, kartu `Label \| Judul \| Isi \| Label tombol` | bagian disembunyikan |
| **Cocok untuk siapa** | `audience` | daftar `Judul \| Isi` | bagian disembunyikan |
| Tentang program | `intro` | daftar `Judul \| Isi` | bagian disembunyikan |
| Yang partner dapatkan | `benefits` | daftar `Judul \| Isi` | bagian disembunyikan |
| Cara kerjanya | `process` | daftar `Judul \| Isi` (nomor otomatis) | bagian disembunyikan |
| **Ketentuan** | `rules` | judul, catatan, dua daftar (diterima / tidak diterima), satu poin per baris | bagian disembunyikan |
| Pertanyaan umum | `faq` | daftar `Pertanyaan \| Jawaban` | bagian & JSON-LD FAQ disembunyikan |
| CTA penutup | `cta` | judul, teks, label tombol | judul jatuh ke teks bawaan |
| SEO | `seo` | title, description, Open Graph image | jatuh ke hero + OG default situs |

**Setiap bagian menghilang rapi bila dikosongkan** — tidak ada judul kosong atau
kartu melayang. Jadi halaman bisa dibuat ringkas maupun lengkap tanpa ngoding.

### Catatan isi

- **Contoh tampilan** adalah ilustrasi ber-CSS (bukan tangkapan layar), jadi
  selalu tajam, ringan, dan ikut berubah saat teksnya diedit. Halaman ini tetap
  **tanpa JavaScript**.
- **FAQ otomatis masuk JSON-LD `FAQPage`** — menambah pertanyaan di CMS berpeluang
  memunculkan accordion di hasil pencarian Google, tanpa langkah tambahan.
- **Harga & satuan** diambil dari tab *Produk & Harga* (`unit`, `min_quantity`),
  sehingga kartu paket menulis mis. "Rp 15.000 / Hari" dan "Minimum 15 Hari".
  Harga yang dibiarkan kosong tampil "—" + "Hubungi kami untuk penawaran".
- Kami sengaja **tidak** menyediakan bagian testimoni berisi kutipan buatan.
  Bila nanti ada testimoni asli dari partner, bagian itu bisa ditambahkan dengan
  pola yang sama (kunci baru di `content` + satu section di halaman).

### Menambah bagian baru

1. Tambah kunci di `partnership_page.content` (lewat CMS atau blok top-up di
   `supabase/schema.sql` § 10j — hanya menulis bila kunci belum ada, sehingga
   editan admin tidak tertimpa).
2. Tambah editornya di `src/pages/admin/partnership/settings.astro`
   (`inp` untuk satu baris, `ta` untuk paragraf, `daftar` untuk tabel
   berkolom, `listTeks` untuk daftar poin).
3. Render di `src/pages/partnership.astro`, dibungkus pemeriksaan kosong agar
   bagiannya hilang otomatis saat belum diisi.

`scripts/sync-content.mjs` meneruskan `content` apa adanya, jadi **tidak perlu**
diubah saat menambah bagian konten baru.

---

## 15. Katalog Produk (umbrella studio)

Reposisi situs dari "situs Sambung Kata" menjadi **rumah & katalog seluruh produk
Vanillate Studio**. Satu katalog menampung Discord bot, aplikasi Android (APK
diunduh langsung dari situs), dan produk berikutnya — dikelola dari **`/admin/produk`**.

### Tabel (schema.sql bagian 13)

| Tabel | Peran |
|---|---|
| `products` | Baris = satu produk. `platform` (`discord`/`android`/`web`) menentukan pola CTA di halaman publik (Undang vs Download APK). |
| `product_media` | Foto/video/ikon/banner per produk — file di bucket **`product-media`**. |
| `product_releases` | Rilis **APK** per produk (versi, ukuran, **SHA-256**, catatan) — file di bucket **`product-apk`**; satu `is_latest` per produk. |

RLS sama seperti Partnership: admin baca, `owner`/`admin` kelola. Halaman publik
**tidak** membaca tabel ini — ditarik saat build (service_role).

### Storage

Dua bucket **publik** dibuat oleh schema: `product-media` (≤50 MB) & `product-apk`
(≤250 MB). Siapa pun boleh **mengunduh** lewat URL publik; **menulis/menghapus**
hanya editor (lewat panel, memakai JWT admin). File APK **tidak** disimpan di repo.

> **Hosting APK — kuota.** Paket gratis Supabase Storage terbatas pada penyimpanan
> & bandwidth/egress bulanan. Karena situs hanya menyimpan **URL**, file mudah
> dipindah nanti ke **Cloudflare R2** (egress gratis) atau **GitHub Releases** bila
> unduhan membesar — cukup ganti URL di metadata.

### Alur edit → terbit

```
   Admin di /admin/produk  (CRUD + upload media/APK ke Storage)
              │
              ▼
   Supabase: products / product_media / product_releases  (+ file di Storage)
              │  scripts/sync-content.mjs (syncProducts), saat build
              ▼
   src/data/synced/products.json  ─── di-commit bila berubah
              │
              ▼
   src/data/bots.ts membacanya → homepage, /bots (katalog), /bots/[slug]
```

Sama seperti Partnership: **perubahan tampil setelah build ulang** (Actions → Sync
konten, ~2–3 menit), sedangkan file di Storage bisa diunduh seketika. `bots.ts`
sengaja tetap bernama `bots` dan mempertahankan API lama supaya seluruh halaman
yang ada tidak perlu diubah. Untuk **Sambung Kata**, `features` & `commands` tetap
ditarik dari repo bot (`bot-info.json`) — satu sumber kebenaran.

### Isi halaman produk yang bisa diedit

Selain identitas produk (nama, tagline, deskripsi, kategori, status), panel juga
mengelola: **badge + nada warnanya**, **ikon fallback** (dropdown dari registry
situs), **logo/thumbnail** (unggah, ganti, hapus), **screenshot/video** beserta
**alt text** dan urutannya, **fitur**, **FAQ produk**, **langkah pemasangan**,
**CTA penutup** (judul, teks, catatan), tautan, dan **urutan produk**.

> **Visual sepenuhnya opsional.** Menghapus gambar membuang berkasnya di Storage
> sekaligus mengosongkan kolomnya, jadi tidak ada URL yatim. Produk tanpa gambar
> memakai ikon aksen sebagai gantinya, dan gambar yang gagal dimuat membuang
> dirinya sendiri — situs tidak pernah menampilkan gambar rusak atau ruang kosong.

### Menambah kolom produk baru

Tambah kolom di `products` (schema.sql § 13a) → tambahkan namanya di query `select`
dan pemetaan objek di `syncProducts()` (`scripts/sync-content.mjs`) → baca dari
`products.json` di `src/data/bots.ts`. Field yang belum disebut di skrip **tidak
ikut terbit** walau bisa diisi di panel.

---

## 16. Konten Halaman Publik

Teks halaman publik dikelola dari **`/admin/halaman`** — tanpa menyentuh kode.

### Cara kerja

```
   Admin edit di /admin/halaman
              │
              ▼
   Supabase: page_content (key + content jsonb)
              │  scripts/sync-content.mjs (syncPages), saat build
              ▼
   src/data/synced/pages.json
              │
              ▼
   src/data/pages.ts  →  halaman publik
```

**Field kosong = pakai teks bawaan.** `pages.ts` menyimpan seluruh teks yang
sedang tayang sebagai default, dan hanya menimpanya dengan nilai dari CMS yang
benar-benar diisi. Jadi mengosongkan kolom di panel **tidak pernah** menghasilkan
judul kosong atau section melayang — situs kembali ke teks aslinya. Tombol
**Kosongkan halaman ini** memanfaatkan sifat itu untuk mengembalikan satu halaman
ke keadaan bawaan.

Di panel, teks bawaan tampil sebagai **placeholder abu-abu** pada tiap kolom,
jadi kamu selalu tahu apa yang akan dipakai bila kolom dibiarkan kosong.

### Halaman yang tersedia

| Tab | Yang bisa diubah |
|---|---|
| **Beranda** | Hero (eyebrow, judul, kata beraksen, paragraf, label tombol), label statistik, section katalog, section studio, daftar prinsip, CTA penutup |
| **Tentang** | Hero halaman Tentang |
| **Katalog Produk** | Hero, section langkah mulai, section keunggulan, section FAQ, CTA penutup |
| **Support** | Paragraf pengantar |
| **Global** | Tagline, deskripsi SEO & footer, teks kecil footer |

### Menambah field konten baru

Cukup **satu tempat**: tambahkan entri di `pageSchemas` dan teks bawaannya di
`pageDefaults` (keduanya di `src/data/pages.ts`), lalu pakai di halaman lewat
`pageContent('<key>')`. Panel admin ikut menampilkan field itu secara otomatis,
dan `scripts/sync-content.mjs` **tidak perlu diubah** karena `content` diteruskan
apa adanya.

Tipe field yang didukung: `text`, `textarea`, `list` (satu item per baris), dan
`pairs` (satu per baris, format `Judul | Deskripsi`).

### Struktur menu panel

Sidebar admin dikelompokkan per bidang kerja supaya tetap terbaca saat halaman
bertambah: **Ringkasan**, **Konten** (Konten Halaman, Pengumuman), **FAQ & Panduan**
(Pertanyaan, Kategori), **Produk** (Katalog Produk), **Operasional Bot** (Kontrol,
Operasi, Monitor Game, Promo, Moderasi Kata), **Partnership**, dan **Data & Laporan**
(Statistik, Log, Server, Pemain). Grup berisi halaman yang sedang dibuka otomatis terbuka; pilihan
buka-tutup lainnya diingat per browser.

---

## 17. FAQ Terpusat (panduan seluruh produk)

Sebelumnya setiap produk punya dokumentasinya sendiri: konten ditulis di
`src/data/docs.ts` dan tampil di `/docs/<slug>`, sementara daftar FAQ ditulis
lagi di `src/data/faq.ts`. Dua tempat, konten saling menyalin, dan pelan-pelan
isinya berbeda — angka EXP di dokumentasi sempat tidak cocok dengan angka di
FAQ-nya sendiri.

Sekarang keduanya dilebur menjadi **satu sistem FAQ berkategori yang dikelola
dari CMS**. Tidak ada lagi panduan yang ditulis di source code.

### Bentuknya

```
FAQ
├── Vanillate Sambung Kata      ← kategori yang dipetakan ke produk
│   ├── Bagaimana cara bermain?
│   ├── Apa itu Dungeon Mode?
│   └── …
├── Umum & Produk               ← kategori umum, tidak terikat produk
├── Akun & Data
└── Bantuan & Troubleshooting
```

Satu FAQ = satu halaman publik dengan URL sendiri:

```
/faq                                    pusat panduan + pencarian
/faq/sambung-kata                       daftar FAQ satu kategori
/faq/sambung-kata/cara-bermain          jawaban lengkap (target deep link)
```

### Alur data

```
   Admin menulis di /admin/faq
              │
              ▼
   Supabase: faq_categories + faqs (+ faq_slug_aliases)
              │
              │  GitHub Actions (sync-content.yml), tiap 15 menit + manual
              ▼
   src/data/synced/faq.json  ─── di-commit bila berubah
              │
              ▼
   Build: halaman /faq, /faq/<kategori>, /faq/<kategori>/<slug>
```

Sama seperti konten lain, perubahan **tidak langsung tampil** — lihat bagian 6
untuk perkiraan waktu dan cara menerbitkan segera.

### Tabel (bagian 15 schema)

| Tabel | Isi |
|---|---|
| `faq_categories` | `name`, `slug`, `description`, `icon`, `enabled`, `sort` |
| `faqs` | `category_id`, `question`, `slug`, `answer`, `enabled`, `sort` |
| `faq_slug_aliases` | Slug lama sebuah FAQ, untuk menjaga tautan yang sudah tersebar |

Relasi `faqs.category_id` memakai **`on delete restrict`**: menghapus kategori
tidak boleh diam-diam membuang seluruh panduan di dalamnya. Panel menampilkan
jumlah FAQ per kategori dan meminta isinya dipindahkan/dihapus lebih dulu.

Produk menunjuk kategorinya lewat `products.faq_category_id` (diisi dari
**/admin/produk** → *Kategori FAQ*). Kolom lama `products.docs_slug` sudah
**dihapus** (migration `drop_products_docs_slug`) setelah dipastikan tidak ada
view, constraint, index, fungsi, maupun repo bot yang membacanya.

### Menulis jawaban

Jawaban memakai **Markdown ringan** dengan pratinjau langsung di panel — dan
pratinjaunya memakai renderer yang sama persis dengan situs publik
(`src/utils/markdown.ts`), jadi yang terlihat memang yang akan terbit.

Didukung: judul (`##`, `###`), paragraf, **tebal**, *miring*, `kode`, daftar
berurutan & tidak berurutan, tautan, gambar, tabel, blok kode, dan kutipan.
HTML mentah **tidak** diizinkan: seluruh masukan di-escape lebih dulu, dan hanya
tautan `http(s)`, path internal, serta `mailto:` yang boleh menjadi `href`.

Satu token khusus tersedia:

```
{{shop-table}}     → tabel harga shop yang tersinkron otomatis dari repo bot
```

Token ini ada supaya harga tidak perlu disalin ulang setiap kali berubah di
dalam game — angkanya tetap mengikuti `src/data/synced/shop.json`.

### Status, urutan, dan validasi

* **Status** memakai `enabled boolean`, mengikuti seluruh tabel konten lain di
  database ini (`products`, `partnership_*`). Perlu diperhatikan: di project ini
  `status` punya arti berbeda — siklus hidup, seperti `products.status` =
  live/beta/preorder — jadi visibilitas tidak boleh memakai nama itu.
  FAQ nonaktif tidak ikut ditarik saat sync, jadi ia tidak pernah sampai ke
  situs publik — bukan sekadar disembunyikan CSS. Kategori nonaktif
  menyembunyikan seluruh isinya.
* **Urutan** (`sort`, kecil = atas) menentukan urutan tampil, jadi tidak
  bergantung pada tanggal atau ID.
* **Wajib diisi**: kategori, pertanyaan, jawaban, dan slug. Slug harus unik
  **per kategori** (URL sudah memuat kategori, jadi dua kategori boleh punya
  slug yang sama).

### URL tetap hidup

Tiga lapis penjagaan supaya tautan panduan tidak berujung 404:

1. **Slug diganti di CMS** → slug lama otomatis tersimpan sebagai alias
   (trigger `faqs_remember_slug`), dan alias itu dibangun sebagai halaman
   redirect ke slug baru.
2. **URL dokumentasi lama** → `/docs` dan `/docs/<slug>` tetap dibangun sebagai
   stub redirect ke FAQ, lengkap dengan pemetaan anchor section lama
   (mis. `/docs/sambung-kata#event-spesial`).
3. **Tautan dari halaman lain** → dibangun lewat helper (`<FAQLink>`,
   `faqUrl()`, `resolveFaqUrl()`), yang jatuh ke halaman kategori lalu ke `/faq`
   bila FAQ yang dirujuk tidak ditemukan.

### Menautkan panduan dari halaman mana pun

```astro
<FAQLink faq="cara-melakukan-order" />                 <!-- deep link -->
<FAQLink category="sambung-kata" variant="button" />   <!-- halaman kategori -->
```

Jangan menulis URL FAQ langsung di halaman: satu-satunya tempat yang tahu bentuk
URL FAQ adalah `src/data/faq.ts`, supaya struktur rute bisa berubah tanpa
berburu alamat yang tertanam di seluruh situs.

### Isi awal & migrasi

Konten hasil migrasi dokumentasi lama tersimpan di `scripts/faq-seed-data.mjs`.
Jalankan sekali:

```bash
node scripts/build-faq-seed.mjs   # menulis supabase/seed-faq.sql + snapshot faq.json
```

lalu jalankan `supabase/seed-faq.sql` di Supabase SQL Editor **setelah**
`supabase/schema.sql`. Seed-nya idempoten dan tidak menimpa baris yang slug-nya
sudah ada, jadi penyuntingan yang sudah dilakukan admin tetap aman.

> **Sudah dijalankan di project CMS | VANILLATE.** Tabel FAQ, trigger, RLS, dan
> 30 FAQ hasil migrasi sudah ada di database (migration `add_centralized_faq`,
> `seed_faq_*`, `index_products_faq_category`), dan `products.faq_category_id`
> untuk Sambung Kata sudah terisi. Langkah di atas hanya diperlukan saat
> menyiapkan project Supabase baru — mis. lingkungan staging.

### Izin

Mengikuti pola modul CMS lain: **owner/admin** boleh membuat, mengubah, dan
menghapus; **viewer** hanya melihat (form dinonaktifkan di panel, dan RLS yang
menolak di database). Setiap perubahan mencatat `updated_by` dan `updated_at`,
sama seperti tabel konten lainnya.
