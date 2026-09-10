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
- **Sistem animasi reusable** (`src/scripts/motion.ts`) — reveal, counter,
  magnetic, 3D tilt, parallax, dan cursor ring. Opt-in lewat `data-*`, patuh
  `prefers-reduced-motion` + mode Performa, tanpa library. Lihat bagian
  [Sistem animasi](#sistem-animasi-motionts) di bawah.
- **3D interaktif** — galaxy WebGL merespons pointer/gerak perangkat (parallax
  kamera berbasis kedalaman) tanpa Three.js.
- **Cepat** — statis, ~10KB JS (gzip), tanpa library berat (tanpa Three.js).

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

> **Catatan email:** alamat kontak publik `andikurniawanoke23@gmail.com`
> diatur di `src/data/content.ts` (`site.email`) dan otomatis dipakai di
> seluruh situs (contact, footer, tombol email, `mailto:`).

> **Foto:** hero dan OG memakai monogram AK. Untuk memasang foto asli, taruh
> file di `public/` lalu tambahkan `<img>` di `src/components/Hero.astro`
> (layout sudah menyediakan ruang di sisi visual).

## Sistem animasi (motion.ts)

Seluruh mikro-interaksi berjalan lewat **satu engine tanpa dependensi**
(`src/scripts/motion.ts`), di-boot sekali dari `BaseLayout.astro`. Prinsipnya
**content-first**: setiap efek bersifat _opt-in_ lewat atribut `data-*`, dan
selalu tunduk pada tiga sinyal global yang sudah ada di situs —
`prefers-reduced-motion`, mode **Performa** (`data-perf`), dan jenis pointer.
Tanpa JS pun konten tetap tampil utuh.

| Atribut | Fungsi | Catatan |
| --- | --- | --- |
| `data-reveal` | Muncul saat masuk viewport | Varian: `up` (default), `down`, `left`, `right`, `scale`, `fade`. Delay per elemen via `--reveal-delay`. |
| `data-reveal-stagger="80"` | Stagger otomatis anak-anaknya | Angka = jeda antar-anak (ms); `data-reveal-base` untuk offset awal. |
| `data-count` | Angka menghitung naik saat terlihat | Teks elemen jadi target (mis. `150K+`, `+300%`, `2026`). |
| `data-magnetic="0.3"` | Elemen menarik ke arah pointer | Desktop saja; angka = kekuatan. |
| `data-tilt="7"` | 3D tilt mengikuti pointer | Desktop + Performa Tinggi saja; angka = derajat maks. Tambah `<span class="tilt-glare">` untuk kilau. Lift hover pakai `--lift`. |
| `data-parallax="0.12"` | Geser halus saat scroll | Hanya untuk elemen dekoratif, bukan teks penting. |
| `data-cursor` | Cincin cursor aditif | Satu elemen global di `BaseLayout` (Performa Tinggi + mouse). |

**Gating otomatis:** `reduced-motion` mematikan seluruh gerak dekoratif (konten
langsung final), **Performa Ringan** melepas tilt + cursor + glare tapi
mempertahankan cerita, dan perangkat sentuh tidak pernah mendapat efek
hover-only. Engine mendengarkan event `exp:perf`, jadi mengganti Performa di nav
langsung berpengaruh tanpa reload.

Karena berdiri sendiri dan bebas dependensi, `motion.ts` + utilitasnya di
`global.css` bisa disalin ke situs Vanillate lain.

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
