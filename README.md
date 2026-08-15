# Vanillate Studio — Website

Website resmi Vanillate Studio untuk showcase produk, dokumentasi lengkap, dan legal documents studio-wide. Situs statis dibangun dengan Astro + Tailwind CSS dan dideploy ke GitHub Pages dengan custom domain **vanillate.id**.

**Live:** https://vanillate.id

## Stack

- **Astro 4** — static site generator, output HTML murni dengan file-based routing
- **Tailwind CSS 3** — utility-first styling dengan custom brand tokens
- **TypeScript** — type-safe data structures & configs
- **GitHub Pages + GitHub Actions** — hosting gratis dengan auto-deploy saat push
- **Domosquare Free DNS** — DNS management untuk custom domain `.id`

## Struktur

```
vanillate-website/
├── .github/workflows/deploy.yml    Auto-deploy ke GitHub Pages saat push ke main
├── public/
│   ├── CNAME                       Custom domain (vanillate.id)
│   ├── favicon-32.png / favicon-64.png / apple-touch-icon.png
│   ├── robots.txt                  SEO: allow all + tautan sitemap
│   └── ...
├── src/
│   ├── components/
│   │   ├── Header.astro            Header dengan nav & dark/light toggle
│   │   ├── Footer.astro            Footer dengan kanal support (Discord/WhatsApp/Email)
│   │   ├── SupportWizard.astro     Support Center: form → template pesan → WhatsApp/Email
│   │   ├── Button.astro            Tombol (internal url() helper built-in)
│   │   ├── BotCard.astro           Card untuk bot di katalog
│   │   ├── Icon.astro              Komponen ikon SVG tunggal (satu icon pack: Lucide)
│   │   ├── BackToTop.astro         Tombol "kembali ke atas" global
│   │   ├── SEO.astro               Meta tags + JSON-LD (Schema.org Organization/WebSite)
│   │   └── ThemeToggle.astro       Dark/light mode toggle
│   ├── data/
│   │   ├── site.ts                 Global config: domain, titles, social links
│   │   ├── bots.ts                 Registry semua bot + buildInviteUrl() helper
│   │   ├── icons.ts                Registry ikon SVG (Lucide) — satu sumber kebenaran
│   │   ├── support.ts              Konfigurasi kanal support + template pesan & Support ID
│   │   └── docs.ts                 Konten dokumentasi (Sambung Kata)
│   ├── i18n/id.ts                  Copy text ID (siap + EN nanti)
│   ├── layouts/BaseLayout.astro    Base layout semua page (Header, Footer, SEO)
│   ├── pages/                      File-based routing
│   │   ├── index.astro             / (Beranda)
│   │   ├── about.astro             /about (Tentang Studio)
│   │   ├── support.astro           /support (Support Center, kontak & bantuan)
│   │   ├── terms.astro             /terms (ToS — studio-wide, berlaku semua produk)
│   │   ├── privacy.astro           /privacy (PP — studio-wide + future bots)
│   │   ├── bots/
│   │   │   ├── index.astro         /bots (katalog)
│   │   │   └── [slug].astro        /bots/[slug] (detail bot, dynamic dari bots.ts)
│   │   ├── docs/
│   │   │   └── [slug].astro        /docs/[slug] (dokumentasi per bot, dari docs.ts)
│   │   ├── changelog.astro         /changelog (riwayat versi, dari synced/changelog.json)
│   │   ├── admin/                  Panel admin (butuh login, noindex) — lihat docs/ADMIN-CMS.md
│   │   │   ├── index.astro         /admin (login username + password)
│   │   │   ├── dashboard.astro     /admin/dashboard (ringkasan)
│   │   │   ├── logs.astro          /admin/logs (log aktivitas bot)
│   │   │   ├── statistik.astro     /admin/statistik (angka & tren)
│   │   │   ├── server.astro        /admin/server (daftar server Discord)
│   │   │   ├── pemain.astro        /admin/pemain (daftar pemain)
│   │   │   └── konten.astro        /admin/konten (editor konten)
│   │   └── 404.astro               /404 (custom error page)
│   ├── lib/                        Kode khusus panel admin (jalan di browser)
│   │   ├── supabase.ts             Inisialisasi klien Supabase (anon key)
│   │   ├── admin-auth.ts           Login, guard sesi, profil admin
│   │   ├── admin-ui.ts             Escaping & blok status tampilan
│   │   └── admin-chart.ts          Grafik tren halaman statistik
│   ├── utils/
│   │   └── url.ts                  url() helper untuk internal links (base path aware)
│   └── styles/global.css           Tailwind + global styles
├── supabase/schema.sql             Skema tabel + Row Level Security panel admin
├── scripts/sync-content.mjs        Tarik konten Supabase → JSON saat build
├── .env.example                    Contoh environment variable (support + Supabase)
├── astro.config.mjs                SITE_URL: https://vanillate.id (no base)
├── tailwind.config.mjs             Brand palette (ink, cream, amber, teal) + typography
├── tsconfig.json
├── package.json
├── PANDUAN-DEPLOY.md               Dokumentasi deploy step-by-step
├── docs/ADMIN-CMS.md               Panduan panel admin & CMS
└── README.md                        (file ini)
```

## Quick Start (Development)

Butuh **Node.js 20+**.

```bash
npm install
npm run dev
```

Buka http://localhost:4321

## Build & Preview

```bash
npm run build      # Output ke ./dist
npm run preview    # Preview hasil build
```

## Cara Menambah Bot Baru

Edit `src/data/bots.ts` dan tambahkan objek `Bot` ke array `bots`. Halaman `/bots`, `/bots/[slug]`, dan `/docs/[slug]` otomatis terbuat dari routing dynamic.

```ts
{
  slug: 'nama-bot',
  name: 'Vanillate Nama Bot',
  shortName: 'Nama Bot',
  icon: 'sparkles',   // nama ikon dari registry SVG (src/data/icons.ts) — dipakai jika belum ada thumbnail
  color: '#5865F2',
  tagline: 'Deskripsi singkat di katalog',
  description: 'Deskripsi panjang di halaman detail',
  features: ['Feature 1', 'Feature 2', 'Feature 3'],
  commands: [
    { name: '/cmd1', description: 'Deskripsi' },
    { name: '/cmd2', description: 'Deskripsi' },
  ],
  clientId: 'XXXXXXXXXXXXXXXXXX',  // ⚠️ Isi dengan Discord App ID
  docsSlug: 'nama-bot',           // Referensi ke docs.ts
}
```

## Cara Update Dokumentasi

Dokumentasi setiap bot di-manage via `src/data/docs.ts` — single source of truth.

**Untuk edit dokumentasi:**
1. Buka `src/data/docs.ts`
2. Cari bot di object `docs['slug-bot']`
3. Edit `sections` array (judul, konten, tabel, tips)
4. Halaman `/docs/[slug]` render otomatis dari data ini

**Struktur subsection:**
```ts
{
  title: '📌 Judul Kecil',
  text: 'Paragraf biasa (support `backtick` → inline code)',
  items: ['Bullet point 1', 'Bullet point 2'],
  table: { headers: [...], rows: [[...], [...]] },
  // (gunakan salah satu atau kombinasi sesuai kebutuhan)
}
```

**Untuk bot baru tanpa dokumentasi:**
- Tambah entry di `docs.ts` dengan struktur minimal, atau
- Halaman otomatis tampil placeholder default jika bot tidak punya entry

## Konfigurasi (Sudah Live)

Setup sekarang **sudah lengkap** untuk **vanillate.id**:

**`src/data/site.ts`:**
- ✅ `links.discordSupport` = `https://discord.gg/A7n88d6uRW`
- ℹ️ Repository GitHub sengaja **tidak** ditautkan di situs publik (footer & JSON-LD)

**`src/data/support.ts`:**
- ✅ Nomor WhatsApp Business & alamat email support (lihat [Support Center](#support-center--whatsapp--email))

**`src/data/bots.ts`:**
- ⚠️ `clientId` per bot — pastikan terisi dengan Discord Application ID (gunakan untuk invite button)

**`astro.config.mjs`:**
- ✅ `SITE_URL` = `https://vanillate.id` (sudah di-set, tanpa `base`)
- ✅ `public/CNAME` — berisi `vanillate.id`
- Jika setup ulang ke domain lain: update `SITE_URL` dan `public/CNAME` sesuai domain baru

**`public/robots.txt`:**
- ✅ Sitemap & allow paths sudah di-set dengan `vanillate.id`

## Deployment & Maintenance

### Auto-Deploy (Sudah Live ✓)

Setiap `git push` ke `main` **otomatis trigger** `.github/workflows/deploy.yml`:
1. Install dependencies (`npm ci`)
2. Build static site (`npm run build` → `dist/`)
3. Deploy ke GitHub Pages (ke branch `gh-pages`)
4. Live di `vanillate.id` dalam ~1-2 menit

**Monitoring:** GitHub → Actions tab — lihat status deployment terbaru.

### Manual Deploy

Jarang perlu, tapi jika diperlukan:

```bash
npm run build
npm run preview      # Test hasil build lokal
# Kalau OK, terus push ke main — auto-deploy akan trigger
```

### Troubleshooting

**Build error:**
```bash
npm run build        # Check error message
npm install          # Update dependencies kalau perlu
rm -rf dist && npm run build
```

**Page tidak update setelah push:**
- Hard-refresh (Ctrl+Shift+R)
- Cek GitHub Actions tab — pastikan deployment lolos
- Cek CNAME file di GitHub & Domosquare DNS propagation

**Broken links:**
- Pastikan gunakan `url()` helper untuk internal links (bukan hardcoded path)
- Test lokal dulu: `npm run preview`

### Dokumentasi Deploy Lengkap

Lihat **PANDUAN-DEPLOY.md** untuk step-by-step setup awal & troubleshooting lanjutan.

## Custom Domain (vanillate.id — Live ✓)

Domain sudah aktif dan live. Setup yang dilakukan:

1. ✅ Domain dibeli via Domosquare & nameserver di-setup
2. ✅ `public/CNAME` berisi `vanillate.id`
3. ✅ GitHub Pages → Settings → Pages → custom domain `vanillate.id`
4. ✅ HTTPS enforcement aktif (GitHub auto-provision SSL)
5. ✅ `astro.config.mjs` → `SITE_URL: https://vanillate.id` (base dihapus)

**Jika ingin ganti domain baru:**
1. Update DNS di Domosquare (atau provider baru)
2. Edit `public/CNAME` → domain baru
3. Edit `astro.config.mjs` → `SITE_URL: https://domain-baru.ext`
4. Settings → Pages → custom domain → domain baru + enforce HTTPS
5. `npm run build && git push`

**SEO & Search Engines:**
- `sitemap-index.xml` & `robots.txt` auto-generate dengan domain yang benar (vanillate.id)
- Untuk Google Search Console: submit vanillate.id via DNS TXT verification
- Initial indexing: 1-2 minggu normal untuk domain baru

## Legal Documents (Studio-Wide)

**Terms of Service** (`src/pages/terms.astro`) — **Aktif ✓**
- Berlaku untuk **semua produk & layanan** Vanillate Studio (bukan hanya 1 bot)
- Otomatis mencakup bot/layanan baru di masa depan (kecuali ada terms terpisah)
- Mencakup Vanillate Sambung Kata dan produk lain di masa depan
- **Section 6:** Virtual Items & In-Game Economy — item tidak punya nilai uang nyata, dapat di-rebalance

**Privacy Policy** (`src/pages/privacy.astro`) — **Aktif ✓**
- Data collection & retention policy untuk semua Services
- Klarifikasi: sebagian bot memproses message content (word-chain), sebagian tidak (idle game)
- User rights: request akses, koreksi, atau hapus data lintas semua produk
- Comply dengan Discord ToS & best practice privasi

**Last Updated:** 6 July 2026

## Support Center → WhatsApp / Email

Halaman `/support` punya wizard **Pilih → Isi → Review → Kirim** (anchor
`#hubungi-support`). Website **tidak** mengirim pesan apa pun dan tidak menyimpan
data ke server mana pun: seluruh proses berjalan di browser, lalu WhatsApp atau
aplikasi email dibuka dengan pesan yang sudah terisi. User sendiri yang menekan
Kirim, sehingga tetap bisa memeriksa isinya lebih dulu.

**Alur:** Produk → Kategori → Kendala → Detail (opsional) → Review → WhatsApp/Email

**File terkait:**

| File | Isi |
| --- | --- |
| `src/data/support.ts` | Konfigurasi kanal, daftar produk & kategori, Support ID, template pesan, builder URL. Semua fungsinya murni (tanpa DOM) sehingga dipakai bersama oleh build & browser. |
| `src/components/SupportWizard.astro` | UI wizard + logika langkah, validasi, review, dan redirect. |
| `src/pages/support.astro` | Menempatkan wizard di section `#hubungi-support`. |

### Konfigurasi kanal

Nomor WhatsApp dan alamat email **tidak ditulis hardcode** di komponen mana pun.
Keduanya dibaca sekali di `src/data/support.ts` dari environment variable, dengan
konstanta fallback agar build tetap jalan tanpa `.env`:

```bash
# .env (salin dari .env.example)
PUBLIC_SUPPORT_WHATSAPP=6281540040115
PUBLIC_SUPPORT_EMAIL=vanillatestudio@gmail.com
```

Prefix `PUBLIC_` wajib karena nilainya dipakai di sisi klien. Situs ini statis,
jadi nilai tersebut ikut ter-bundle ke output — **jangan menaruh rahasia di sana**.
Untuk mengubahnya di produksi, set variable-nya di GitHub Actions atau cukup ubah
konstanta fallback di `src/data/support.ts`.

### Support ID

Setiap pengajuan mendapat ID dengan format konsisten `VS-YYYYMMDD-NNNN`
(mis. `VS-20260815-4827`): prefix studio, tanggal lokal, dan 4 digit acak dari
`crypto.getRandomValues`. ID ini masuk ke pesan WhatsApp maupun subjek email,
jadi bisa langsung dipakai sebagai identifier bila nanti berkembang jadi ticketing.

### Template pesan

Satu template dipakai oleh kedua kanal supaya laporan yang masuk terbaca sama:

```text
Halo Tim Vanillate,

Saya ingin meminta bantuan terkait kendala yang saya alami.

━━━━━━━━━━━━━━━━━━
DETAIL SUPPORT
━━━━━━━━━━━━━━━━━━

Support ID : VS-20260815-4827
Produk     : Vanillate Sambung Kata
Kategori   : Bug / Error

Kendala:
Tombol permainan tidak muncul setelah pertandingan dimulai.

Discord    : @username

━━━━━━━━━━━━━━━━━━

Terima kasih atas bantuannya.
```

Aturannya: tanpa emoji, separator sederhana, label sejajar, dan **field kosong
dihilangkan sepenuhnya** — tidak pernah muncul `-`, `null`, atau `undefined`.
Blok `INFORMASI TEKNIS` (browser, OS, halaman, versi situs) hanya ditambahkan
bila user membiarkan checkbox-nya aktif di Step 4.

Subjek email memakai format `[Support] <Support ID> — <Kategori> — <Produk>`.

### Menambah produk atau kategori

Cukup tambahkan objek ke `supportProducts` atau `supportCategories` di
`src/data/support.ts`; kartu di wizard ikut terbentuk otomatis. `icon` harus
nama yang ada di registry `src/data/icons.ts`.

### Catatan lampiran

Wizard **tidak** punya fitur upload file, dan itu disengaja. `wa.me` maupun
`mailto:` tidak bisa membawa file, jadi gambar yang dipilih di website hanya akan
jadi pratinjau lokal dan tetap harus di-upload ulang setelah aplikasinya terbuka —
user membayar kuota dua kali untuk file yang sama.

Sebagai gantinya, wizard menampilkan catatan di langkah Review dan di panel akhir
yang mengingatkan user melampirkan screenshot atau video langsung di WhatsApp/email.

## Sistem Ikon (SVG — Satu Icon Pack)

Seluruh ikon UI memakai **satu icon pack: [Lucide](https://lucide.dev)** (gaya stroke,
`viewBox="0 0 24 24"`), tanpa mencampur pack lain dan tanpa emoji di elemen UI.

- **Registry:** `src/data/icons.ts` — satu sumber kebenaran; setiap key kebab-case
  memetakan ke isi `<svg>` Lucide. Menambah ikon = salin inner path Lucide baru ke sini.
- **Komponen:** `src/components/Icon.astro` — render `<svg>` dari registry.

```astro
---
import Icon from '@components/Icon.astro';
---
<Icon name="trophy" class="h-5 w-5" />               <!-- dekoratif (aria-hidden) -->
<Icon name="mail" class="h-5 w-5" label="Email" />   <!-- bermakna → role=img + aria-label -->
```

Warna ikut `currentColor`, ukuran dari class Tailwind (mis. `h-5 w-5`). Ikon default
bersifat dekoratif (`aria-hidden`); beri prop `label` untuk ikon yang bermakna.

**Pengecualian yang sengaja tetap emoji:** teks konten dokumentasi (`docs.ts`) & data
tersinkron dari repo bot (`synced/*.json`, mis. nama item shop `🗝️ Golden Key`, skill
`⚔️ Attack`) mencerminkan label asli di dalam Discord bot, jadi dibiarkan apa adanya
agar dokumentasi tetap 1:1 dengan tampilan game. Aset gambar (avatar bot, banner,
thumbnail, screenshot) tetap PNG/WebP sesuai kebutuhan.

## Design Tokens & Styling

Palette dan typography di-define di `tailwind.config.mjs`:

- **Colors:** 
  - `ink-*` (dark, almost-black) → primary dark mode
  - `cream-*` (light, vanilla) → primary light mode
  - `amber-*` (signature gold) → accent & CTAs
  - `teal-*` (secondary) → highlights
- **Fonts:**
  - `font-display` = Bricolage Grotesque (headings, bold)
  - `font-sans` = Inter (body, UI)
  - `font-mono` = JetBrains Mono (code, terminals)

Semua custom token di `tailwind.config.mjs` — edit di sana jika perlu rebrand.

## Architecture: Frontend Statis

Website ini **hanya frontend** — Astro build → static HTML + CSS + JS.
Tidak ada server-side rendering; GitHub Pages memang hanya melayani file statis.

Seluruh **backend** (API, game logic, database, auth) tetap terpisah:
- Bot Discord dijalankan via PM2 (Node.js di Windows)
- Database game: better-sqlite3 (.db file lokal)
- OG images & assets: CDN atau hosted terpisah

Benefit: deployment sederhana (push ke GitHub), cepat (static files), dan murah (free GitHub Pages).

### Panel admin (`/admin`)

Karena tidak ada server sendiri, panel admin memakai **Supabase** sebagai
backend: autentikasi dan data dijaga di sana, browser hanya memegang `anon key`
yang memang publik. Yang menahan data bukan halaman `/admin` — melainkan **Row
Level Security** di Supabase, yang mengembalikan nol baris tanpa JWT admin yang
sah. Artinya kerangka halaman admin publik, tapi isinya kosong tanpa login.

Data bot (log, statistik, daftar server, daftar pemain) **ditulis oleh bot** ke
Supabase memakai service role key, dan panel hanya membacanya. Bot token Discord
tidak pernah menyentuh browser.

Setup lengkap, kontrak data untuk repo bot, dan batasan modelnya ada di
**[docs/ADMIN-CMS.md](docs/ADMIN-CMS.md)**.
