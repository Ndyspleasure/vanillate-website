# Panduan Deploy — Vanillate Website

Langkah lengkap dari kode di komputer sampai website live di GitHub Pages.

## 1. Persiapan Lokal

**Pastikan Node.js 20+ terinstal:**

```bash
node --version   # v20.x atau lebih tinggi
```

**Install dependencies dan tes lokal:**

```bash
cd vanillate-website
npm install
npm run dev
```

Buka http://localhost:4321 — pastikan semua halaman tampil dengan baik.

## 2. Isi Nilai Placeholder

Sebelum push, isi nilai yang bertanda `REPLACE_ME` atau `REPLACE_WITH_CLIENT_ID`:

### `src/data/site.ts`

```ts
links: {
  discordSupport: 'https://discord.gg/xxxxx',  // ← invite Discord support
  github: 'https://github.com/vanillate-studio', // ← opsional
}
```

### `src/data/bots.ts`

Isi `clientId` untuk setiap bot dengan Discord Application ID:

```ts
{
  slug: 'sambung-kata',
  // ...
  clientId: '1234567890123456789',  // ← Application ID dari Discord Developer Portal
}
```

**Cara ambil Client ID:**
1. Buka https://discord.com/developers/applications
2. Pilih aplikasi bot → **General Information**
3. Copy **Application ID**

## 3. Setup Repository GitHub

**Buat repository baru** di GitHub dengan nama `vanillate-website` (public).

**Push kode:**

```bash
cd vanillate-website
git init
git add .
git commit -m "Initial commit: Vanillate Studio website"
git branch -M main
git remote add origin https://github.com/USERNAME/vanillate-website.git
git push -u origin main
```

Ganti `USERNAME` dengan username GitHub kamu.

## 4. Aktifkan GitHub Pages

1. Buka repository di GitHub
2. **Settings** → **Pages**
3. Di **Build and deployment** → **Source**: pilih **GitHub Actions**
4. Kembali ke tab **Actions** — workflow "Deploy to GitHub Pages" akan otomatis jalan
5. Tunggu ~1-2 menit sampai deploy selesai (ada tanda ✅ hijau)
6. URL akan muncul di **Settings** → **Pages** (biasanya `https://USERNAME.github.io/vanillate-website`)

## 5. Konfigurasi URL Sementara (Tanpa Custom Domain)

Jika masih pakai URL default GitHub Pages (`https://USERNAME.github.io/vanillate-website`), edit `astro.config.mjs`:

```js
const SITE_URL = 'https://USERNAME.github.io';

export default defineConfig({
  site: SITE_URL,
  base: '/vanillate-website',   // ← uncomment baris ini
  // ...
});
```

Commit dan push. Deploy akan berjalan ulang otomatis.

## 6. Hubungkan Domain Kustom (`vanillate.com`)

Ketika sudah beli domain:

### a. Aktifkan CNAME di repo

```bash
mv public/CNAME.example public/CNAME
git add public/CNAME
git commit -m "Add custom domain"
git push
```

### b. Setup DNS di provider domain

Tambahkan record DNS berikut:

**Apex domain (vanillate.com):**
```
Type: A     Name: @   Value: 185.199.108.153
Type: A     Name: @   Value: 185.199.109.153
Type: A     Name: @   Value: 185.199.110.153
Type: A     Name: @   Value: 185.199.111.153
```

**Subdomain www (opsional):**
```
Type: CNAME   Name: www   Value: USERNAME.github.io
```

### c. Setup di GitHub

1. **Settings** → **Pages** → **Custom domain**: masukkan `vanillate.com`
2. Tunggu proses **DNS check** selesai (kadang butuh 5–30 menit)
3. Centang **Enforce HTTPS** setelah cek berhasil

### d. Update `astro.config.mjs`

```js
const SITE_URL = 'https://vanillate.com';

export default defineConfig({
  site: SITE_URL,
  // base: '/vanillate-website',  ← hapus atau comment baris ini
  // ...
});
```

Commit + push. Website live di `https://vanillate.com` ✨

## 7. Update Konten

Setiap kali update konten (misal tambah bot, edit halaman About), cukup:

```bash
git add .
git commit -m "Update: deskripsi perubahan"
git push
```

GitHub Actions akan otomatis re-deploy dalam ~1-2 menit.

## Troubleshooting

**Build gagal di GitHub Actions?**
- Cek tab **Actions** → klik workflow yang error → lihat log
- Biasanya karena typo di TypeScript atau missing dependency

**Halaman blank atau 404 setelah deploy?**
- Cek konfigurasi `base` di `astro.config.mjs` — harus sesuai path URL

**Font Google Fonts tidak muncul?**
- Cek koneksi internet browser
- Pastikan tidak ada content blocker

**CSS terlihat aneh (sepertinya tidak load)?**
- Clear browser cache dan hard reload (Ctrl+Shift+R)
- Cek console browser untuk error

**Custom domain tidak jalan?**
- Verifikasi DNS di https://dnschecker.org
- Tunggu propagasi DNS (max 48 jam, biasanya <1 jam)
