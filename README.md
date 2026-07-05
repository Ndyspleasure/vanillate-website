# Vanillate Studio — Website

Website resmi Vanillate Studio. Situs statis dibangun dengan Astro + Tailwind CSS dan dideploy ke GitHub Pages.

## Stack

- **Astro 4** — static site generator, output HTML murni
- **Tailwind CSS 3** — utility-first styling
- **TypeScript** — untuk data & config
- **GitHub Pages + GitHub Actions** — hosting & auto-deploy

## Struktur

```
vanillate-website/
├── .github/workflows/deploy.yml    Auto-deploy ke GitHub Pages
├── public/                         Aset statis (favicon, robots.txt, gambar OG)
├── src/
│   ├── components/                 Komponen reusable (Header, Footer, Button, BotCard, SEO, ThemeToggle)
│   ├── data/
│   │   ├── site.ts                 Konfigurasi global situs
│   │   └── bots.ts                 Registry bot — tambah bot baru di sini
│   ├── i18n/id.ts                  Struktur i18n (siap ditambah EN)
│   ├── layouts/BaseLayout.astro    Layout dasar semua halaman
│   ├── pages/                      Routing berbasis file
│   │   ├── index.astro             Beranda
│   │   ├── about.astro             Tentang Vanillate Studio
│   │   ├── bots/                   Katalog & detail bot (dynamic)
│   │   ├── docs/                   Dokumentasi (dynamic)
│   │   ├── terms.astro             Syarat Layanan (placeholder)
│   │   ├── privacy.astro           Kebijakan Privasi (placeholder)
│   │   ├── support.astro           Support
│   │   └── 404.astro
│   └── styles/global.css
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
└── package.json
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

Cukup edit `src/data/bots.ts` dan tambahkan objek `Bot` baru ke array `bots`. Halaman `/bots`, `/bots/[slug]`, dan `/docs/[slug]` akan otomatis dibuat.

```ts
{
  slug: 'nama-bot',
  name: 'Vanillate Nama Bot',
  shortName: 'Nama Bot',
  // ... field lainnya sesuai type Bot
}
```

## Konfigurasi Sebelum Deploy

Sebelum push ke GitHub, isi nilai placeholder berikut:

**`src/data/site.ts`:**
- `links.discordSupport` — invite Discord server support
- `links.github` — URL GitHub organization/repo (opsional)

**`src/data/bots.ts`:**
- Setiap bot: `clientId` → isi dengan Discord Application ID masing-masing bot

**`astro.config.mjs`:**
- `SITE_URL` — sudah di-set ke `https://vanillate.com`. Jika belum pakai custom domain, ganti ke `https://<username>.github.io/vanillate-website` dan uncomment `base`.

## Deploy ke GitHub Pages

Lihat **PANDUAN-DEPLOY.md** untuk instruksi lengkap step-by-step.

Ringkasnya:

1. Buat repository `vanillate-website` di GitHub
2. Push kode ke branch `main`
3. Di Settings → Pages → Source: pilih **GitHub Actions**
4. Setiap push ke `main` akan auto-deploy

## Custom Domain (vanillate.com)

Ketika sudah membeli domain:

1. Rename `public/CNAME.example` → `public/CNAME`
2. Di DNS provider, tambahkan record:
   - `A` records ke IP GitHub Pages, atau
   - `CNAME` dari `www` ke `<username>.github.io`
3. Di Settings → Pages → Custom domain, masukkan `vanillate.com`
4. Aktifkan **Enforce HTTPS**

## Design Tokens

Palette dan typography di-define di `tailwind.config.mjs`:

- **Colors:** `ink-*` (dark), `cream-*` (light), `amber-*` (signature), `teal-*` (secondary)
- **Fonts:** `font-display` (Bricolage Grotesque), `font-sans` (Inter), `font-mono` (JetBrains Mono)

## Backend Terpisah

Website ini **hanya frontend statis**. Seluruh backend (API, dashboard, bot, database) tetap berjalan di server pribadi menggunakan PM2, sesuai arsitektur Vanillate Studio.
