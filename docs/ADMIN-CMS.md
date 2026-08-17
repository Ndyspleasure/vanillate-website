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
              │  GitHub Actions (sync-content.yml), tiap jam + manual
              ▼
   src/data/synced/site-content.json  ─── di-commit bila berubah
              │
              ▼
   Build + deploy ke vanillate.id
```

**Perubahan tidak langsung tampil.** Situsnya statis, jadi harus di-build ulang
dulu — biasanya beberapa menit. Untuk menerbitkan segera: tab **Actions** →
**Sync konten dari Supabase** → **Run workflow**.

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
Tunggu workflow sync konten berikutnya, atau jalankan manual lewat tab Actions.

---

## 10. Peta file

| File | Isi |
|---|---|
| `supabase/schema.sql` | Skema tabel, fungsi, dan seluruh aturan RLS |
| `supabase/seed-demo.sql` | Data contoh untuk mencoba panel sebelum bot tersambung |
| `src/lib/supabase.ts` | Inisialisasi klien Supabase |
| `src/lib/admin-auth.ts` | Login, guard sesi, profil admin |
| `src/lib/admin-ui.ts` | Escaping & blok status tampilan |
| `src/lib/admin-chart.ts` | Grafik tren di halaman statistik |
| `src/layouts/AdminLayout.astro` | Kerangka panel + penjaga sesi |
| `src/pages/admin/*.astro` | Halaman login dan dashboard |
| `src/pages/admin/kontrol.astro` | **Control panel** — atur setting bot (maintenance/pengumuman/mode/tunable/fitur) |
| `src/pages/admin/operasi.astro` | **Console aksi** — antrean perintah bot (kelola pemain/boost/promo/quest/broadcast) |
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

- **Setting**: tambah baris di seed `bot_settings` (`supabase/schema.sql`) — otomatis
  muncul di `/admin/kontrol`. Konsumsi di bot lewat `remoteConfig.getFlag/tunable`.
- **Aksi**: tambah entri form di `GRUP` (`src/pages/admin/operasi.astro`) + handler dengan
  `type` yang sama di `HANDLERS` (`src/services/remoteCommands.js`). Tidak perlu tabel baru.
