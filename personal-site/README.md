# Situs Personal — `personal.andikurniawan.vanillate.id`

Situs personal (halaman **data diri**) untuk tim Vanillate. Dibangun dengan
**Astro** (output statis), di-deploy ke **Vercel**, dengan domain produksi
**`https://personal.andikurniawan.vanillate.id`** sebagai satu-satunya origin
canonical.

Proyek ini berdiri sendiri di dalam subfolder `personal-site/` dan **tidak
mengganggu** situs utama studio (`vanillate.id`, yang tetap di GitHub Pages).
Punya `package.json`, `node_modules`, dan pipeline build sendiri.

---

## Struktur

```
personal-site/
├── astro.config.mjs      site = https://personal.andikurniawan.vanillate.id
├── vercel.json           framework + security headers
├── src/
│   ├── data/profile.ts   ← DATA DIRI ada di sini (satu-satunya yang perlu diedit)
│   ├── components/SEO.astro   canonical + Open Graph + JSON-LD Person
│   ├── layouts/BaseLayout.astro
│   ├── pages/index.astro
│   └── styles/global.css
└── public/               robots.txt, favicon.svg
```

## Edit isi

Semua teks halaman ada di **`src/data/profile.ts`** — nama, peran, bio, data
diri, fokus, dan tautan kontak. Tidak perlu menyentuh markup.

> **Catatan email:** `profile.ts` memakai placeholder
> `halo@andikurniawan.vanillate.id`. Ganti ke alamat yang memang ingin
> ditampilkan publik. Email pribadi hanya ditayangkan bila kamu sendiri yang
> mengisinya.

## Jalankan lokal

```bash
cd personal-site
npm install
npm run dev        # http://localhost:4321
npm run build      # output ke dist/
npm run preview    # pratinjau hasil build
```

---

## Deploy ke Vercel

1. **Import project** di https://vercel.com/new → pilih repo
   `Ndyspleasure/vanillate-website`.
2. **Root Directory:** set ke **`personal-site`** (penting — bukan root repo).
   Vercel otomatis mendeteksi Astro; build `npm run build`, output `dist/`.
3. Deploy. Situs sementara tayang di URL `*.vercel.app`.

### Pasang domain nested + HTTPS

4. Di project Vercel → **Settings → Domains** → tambah
   **`personal.andikurniawan.vanillate.id`**. Jadikan sebagai **Production
   domain (primary)** agar semua domain lain (termasuk `*.vercel.app`)
   di-redirect ke sini.
5. Vercel menampilkan record DNS yang diminta. Tambahkan di **penyedia DNS
   `vanillate.id`** (README studio menyebut **Domosquare Free DNS**):

   ```
   Type:  CNAME
   Name:  personal.andikurniawan        (relatif terhadap zona vanillate.id)
   Value: cname.vercel-dns.com
   ```

   > DNS mendukung subdomain nested (bertingkat) tanpa batas, jadi
   > `personal.andikurniawan.vanillate.id` valid. Bila panel DNS meminta nama
   > lengkap (FQDN), isi `personal.andikurniawan.vanillate.id`. Ikuti
   > nilai persis yang ditunjukkan Vercel bila berbeda.

6. Tunggu verifikasi DNS. **HTTPS otomatis** disediakan Vercel (sertifikat
   Let's Encrypt) begitu DNS terverifikasi — termasuk untuk subdomain
   bertingkat ini, yang justru sulit dilakukan di GitHub Pages. Tidak perlu
   konfigurasi sertifikat manual.

---

## Kenapa Vercel, bukan GitHub Pages?

Situs studio (`vanillate.id`) memakai GitHub Pages, tetapi GitHub Pages hanya
melayani **satu** custom domain per repo dan **tidak menyediakan HTTPS otomatis
yang andal untuk subdomain bertingkat** seperti
`personal.andikurniawan.vanillate.id`. Vercel bisa memasang domain bertingkat
apa pun ke satu project berikut sertifikat HTTPS otomatis, sehingga cocok untuk
pola `personal.<nama>.vanillate.id` per anggota tim.

## Canonical / SEO

- `site` di `astro.config.mjs` = `https://personal.andikurniawan.vanillate.id`.
- `SEO.astro` membangun `<link rel="canonical">`, `og:url`, `og:image`, dan
  JSON-LD `Person` dari `Astro.site` — jadi **selalu** domain produksi, tidak
  pernah URL `*.vercel.app`.
- `sitemap` (integrasi `@astrojs/sitemap`) dan `robots.txt` menunjuk ke domain
  produksi.
- Jadikan domain produksi sebagai **primary** di Vercel agar `*.vercel.app`
  di-redirect (bukan sekadar duplikat konten).

## Template untuk anggota tim lain

Untuk anggota lain: salin folder `personal-site/`, ubah `SITE_URL` di
`astro.config.mjs` ke subdomain-nya (mis.
`https://personal.budi.vanillate.id`), sesuaikan `robots.txt` dan
`src/data/profile.ts`, lalu deploy sebagai project Vercel tersendiri dengan
record DNS-nya sendiri.
