# Situs Personal — Andi Kurniawan

Situs personal premium (halaman **data diri** / personal brand) untuk
`https://personal.andikurniawan.vanillate.id`. Dibangun dengan **Astro**
(output statis, SEO-first), di-deploy ke **Vercel**, dengan domain produksi
sebagai satu-satunya origin canonical.

Proyek ini berdiri sendiri di subfolder `personal-site/` dan **tidak
mengganggu** situs studio (`vanillate.id`, tetap di GitHub Pages). Punya
`package.json`, build, dan `node_modules` sendiri.

**Live (setelah deploy):** https://personal.andikurniawan.vanillate.id

---

## Fitur

- **Bilingual** — Indonesia (canonical, `/`) + English (`/en/`), dengan
  `hreflang`, language toggle, dan sitemap alternates.
- **Dark / light** mengikuti sistem, dengan toggle manual (tersimpan).
- **Dua signature experience** (scroll-driven, ringan, aksesibel):
  SPACE → BEKASI (globe) dan CODE → AK → SYSTEM CORE → PRODUCT.
- **SEO menyeluruh** — satu H1, semantic HTML, canonical, Open Graph + Twitter,
  JSON-LD (`Person`, `CreativeWork`, `BreadcrumbList`), `robots.txt`, sitemap,
  gambar OG 1200×630. Konten inti selalu ada di HTML (tidak bergantung JS/WebGL).
- **Aksesibel** — `prefers-reduced-motion`, skip link, focus states, alt text,
  keyboard-friendly. Animasi tidak pernah wajib untuk memahami halaman.
- **Cepat** — statis, ~6KB JS, tanpa library berat (tanpa Three.js).

## Struktur

```
personal-site/
├── astro.config.mjs         site = https://personal.andikurniawan.vanillate.id + sitemap i18n
├── vercel.json              framework + security headers
├── src/
│   ├── data/
│   │   ├── content.ts        ← SEMUA TEKS (ID + EN) ada di sini
│   │   ├── projects.ts       ← data proyek (kartu + halaman detail)
│   │   └── icons.ts          SVG brand & UI (tanpa emoji)
│   ├── components/           Nav, Hero, About, LocationGlobe, Expertise, Skills,
│   │                         DigitalBuild, Vanillate, Work, BeyondWork, Values,
│   │                         CareerDirection, Contact, Footer, SEO, Icon, ProjectDetail
│   ├── layouts/BaseLayout.astro
│   ├── pages/
│   │   ├── index.astro           /            (ID)
│   │   ├── en/index.astro        /en/         (EN)
│   │   ├── work/[slug].astro     /work/…      (detail proyek, ID)
│   │   ├── en/work/[slug].astro  /en/work/…   (detail proyek, EN)
│   │   └── 404.astro
│   └── styles/global.css     design system (tokens, tipografi, motion)
└── public/                   og-image.png, favicon.svg, robots.txt, work/
```

## Edit isi

Semua teks ada di **`src/data/content.ts`** (objek `content.id` & `content.en`)
dan **`src/data/projects.ts`**. Tidak perlu menyentuh markup komponen.

> **Catatan email:** memakai placeholder `halo@andikurniawan.vanillate.id`
> (di `content.ts`). Ganti ke alamat yang ingin ditampilkan publik. Email
> pribadi hanya ditayangkan bila kamu sendiri yang mengisinya.

> **Foto:** hero dan OG memakai monogram AK. Untuk memasang foto asli, taruh
> file di `public/` lalu tambahkan `<img>` di `src/components/Hero.astro`
> (layout sudah menyediakan ruang di sisi visual).

## Regenerasi gambar OG

`public/og-image.png` (1200×630) di-render dari `scripts/og-template.html`.
Untuk membuat ulang (butuh Chromium):

```bash
node scripts/render-og.mjs
# atau: CHROME_BIN=/path/ke/chromium node scripts/render-og.mjs
```

## Jalankan lokal

```bash
cd personal-site
npm install
npm run dev        # http://localhost:4321
npm run build      # output ke dist/
```

---

## Deploy ke Vercel

1. **Import project** di https://vercel.com/new → pilih repo
   `Ndyspleasure/vanillate-website`.
2. **Root Directory:** set ke **`personal-site`**. Vercel mendeteksi Astro
   otomatis (build `npm run build`, output `dist/`).
3. Deploy. Situs sementara tayang di URL `*.vercel.app`.

### Pasang domain nested + HTTPS

4. Project Vercel → **Settings → Domains** → tambah
   **`personal.andikurniawan.vanillate.id`** dan jadikan **Production domain
   (primary)** agar domain lain (termasuk `*.vercel.app`) di-redirect ke sini.
5. Di penyedia DNS `vanillate.id` (**Domosquare Free DNS**) tambahkan record:

   ```
   Type:  CNAME
   Name:  personal.andikurniawan        (relatif terhadap zona vanillate.id)
   Value: cname.vercel-dns.com
   ```

   > DNS mendukung subdomain nested tanpa batas, jadi
   > `personal.andikurniawan.vanillate.id` valid. Ikuti nilai persis yang
   > ditunjukkan Vercel bila berbeda.

6. Tunggu verifikasi DNS. **HTTPS otomatis** dari Vercel (Let's Encrypt) —
   termasuk untuk subdomain bertingkat ini, yang sulit dilakukan di GitHub Pages.

## Kenapa Vercel, bukan GitHub Pages?

Situs studio (`vanillate.id`) memakai GitHub Pages, yang hanya melayani **satu**
custom domain per repo dan tidak menyediakan HTTPS otomatis yang andal untuk
subdomain bertingkat seperti `personal.andikurniawan.vanillate.id`. Vercel
memasang domain bertingkat apa pun + sertifikat HTTPS otomatis.

## Canonical / SEO

- `site` di `astro.config.mjs` = domain produksi.
- `SEO.astro` membangun canonical, `hreflang`, Open Graph, Twitter, dan JSON-LD
  dari `Astro.site` — **selalu** domain produksi, tidak pernah `*.vercel.app`.
- Jadikan domain produksi sebagai **primary** di Vercel agar `*.vercel.app`
  di-redirect (bukan duplikat konten).

## Template untuk anggota tim lain

Salin folder `personal-site/`, ubah `SITE_URL` di `astro.config.mjs`,
sesuaikan `content.ts`, `projects.ts`, `robots.txt`, dan gambar OG, lalu deploy
sebagai project Vercel tersendiri dengan record DNS-nya sendiri
(mis. `personal.<nama>.vanillate.id`).
