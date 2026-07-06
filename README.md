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
│   ├── favicon.svg
│   ├── robots.txt                  SEO: allow sitemap, disallow crawl abuse paths
│   └── ...
├── src/
│   ├── components/
│   │   ├── Header.astro            Header dengan nav & dark/light toggle
│   │   ├── Footer.astro            Footer dengan social & contact links
│   │   ├── Button.astro            Tombol (internal url() helper built-in)
│   │   ├── BotCard.astro           Card untuk bot di katalog
│   │   ├── SEO.astro               Meta tags (og:image, twitter:card, dll)
│   │   └── ThemeToggle.astro       Dark/light mode toggle
│   ├── data/
│   │   ├── site.ts                 Global config: domain, titles, social links
│   │   ├── bots.ts                 Registry semua bot + buildInviteUrl() helper
│   │   └── docs.ts                 Konten dokumentasi (Sambung Kata & Tahu Bulat)
│   ├── i18n/id.ts                  Copy text ID (siap + EN nanti)
│   ├── layouts/BaseLayout.astro    Base layout semua page (Header, Footer, SEO)
│   ├── pages/                      File-based routing
│   │   ├── index.astro             / (Beranda)
│   │   ├── about.astro             /about (Tentang Studio)
│   │   ├── support.astro           /support (Kontak & bantuan)
│   │   ├── terms.astro             /terms (ToS — studio-wide, berlaku semua produk)
│   │   ├── privacy.astro           /privacy (PP — studio-wide + future bots)
│   │   ├── bots/
│   │   │   ├── index.astro         /bots (katalog)
│   │   │   └── [slug].astro        /bots/[slug] (detail bot, dynamic dari bots.ts)
│   │   ├── docs/
│   │   │   └── [slug].astro        /docs/[slug] (dokumentasi per bot, dari docs.ts)
│   │   └── 404.astro               /404 (custom error page)
│   ├── utils/
│   │   └── url.ts                  url() helper untuk internal links (base path aware)
│   └── styles/global.css           Tailwind + global styles
├── astro.config.mjs                SITE_URL: https://vanillate.id (no base)
├── tailwind.config.mjs             Brand palette (ink, cream, amber, teal) + typography
├── tsconfig.json
├── package.json
├── PANDUAN-DEPLOY.md               Dokumentasi deploy step-by-step
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
  icon: '🎮',
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
- ✅ `links.github` = `https://github.com/Ndyspleasure` (opsional)

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
- Mencakup: Sambung Kata, Tahu Bulat, dan future products
- **Section 6:** Virtual Items & In-Game Economy — item tidak punya nilai uang nyata, dapat di-rebalance

**Privacy Policy** (`src/pages/privacy.astro`) — **Aktif ✓**
- Data collection & retention policy untuk semua Services
- Klarifikasi: sebagian bot memproses message content (word-chain), sebagian tidak (idle game)
- User rights: request akses, koreksi, atau hapus data lintas semua produk
- Comply dengan Discord ToS & best practice privasi

**Last Updated:** 6 July 2026

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

Seluruh **backend** (API, game logic, database, auth) tetap terpisah:
- Bot Discord dijalankan via PM2 (Node.js di Windows)
- Database: better-sqlite3 (.db file lokal)
- OG images & assets: CDN atau hosted terpisah
- Tidak ada server-side rendering atau dynamic backend di Astro

Benefit: deployment sederhana (push ke GitHub), cepat (static files), dan murah (free GitHub Pages).
