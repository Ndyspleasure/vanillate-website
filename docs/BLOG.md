# 📝 Blog — vanillate.id/blog

Blog SEO Vanillate. **Semua pekerjaan ada di CMS admin** (`/admin/blog`):
menulis, mengedit, mengunggah gambar, mengatur SEO, pratinjau, simpan draft,
dan menerbitkan. **Sanity hanya tempat penyimpanan** (artikel + gambar); tidak
perlu membuka Sanity Studio sama sekali.

---

## 1. Arsitektur

```
/admin/blog (browser, JWT admin Supabase)
   │  supabase.functions.invoke('blog-admin')
   ▼
Edge Function blog-admin (Supabase)  ← SANITY_WRITE_TOKEN, GITHUB_DISPATCH_TOKEN (secret)
   │  • cek peran di admin_users (owner/admin tulis, viewer baca)
   │  • validasi akhir artikel (logic.ts → publishErrors)
   │  • simpan ke Sanity: draft = drafts.<id>, terbit = <id>
   │  • publish → repository_dispatch "blog-publish"
   ▼
Sanity  (project 62jp784l "Vanillate Studio", dataset production — public)
   ▼
GitHub Actions deploy.yml → astro build (GROQ ke API CDN Sanity, tanpa token)
   ▼
GitHub Pages: HTML statis /blog, /blog/<slug>, kategori, tag, penulis, RSS, sitemap
```

- **Tidak ada project Supabase baru dan tidak ada tabel baru.** Edge Function
  hanya membaca `admin_users` (peran) yang sudah ada.
- **Browser tidak pernah memegang token Sanity atau GitHub** — sesuai aturan
  `CLAUDE.md`. Dataset Sanity public hanya mengekspos dokumen yang sudah terbit;
  draft (`drafts.*`) tetap tertutup.
- Halaman publik **statis** (dibangun saat build) → cepat, nol JavaScript
  wajib, ramah crawler Google & mesin AI.

### Waktu tayang

| Kejadian | Jalur | Sampai tayang |
|---|---|---|
| Klik **Publish** (token GitHub terpasang) | `repository_dispatch` → `deploy.yml` | ±2–5 menit |
| Artikel **terjadwal** (tanggal terbit di masa depan) | `blog-schedule.yml` tiap jam | ≤ ±1 jam setelah tanggalnya |
| Token GitHub belum diisi / dispatch gagal | `blog-schedule.yml` tiap jam | ≤ ±1–2 jam |
| Tombol **Bangun ulang situs sekarang** di `/admin/blog` | `repository_dispatch` | ±2–5 menit |

`blog-schedule.yml` membandingkan `_updatedAt` dokumen blog di Sanity dengan
waktu deploy GitHub Pages terakhir; deploy hanya dipicu bila memang ada
perubahan. Artikel yang **dihapus/ditarik** tanpa dispatch baru hilang dari
situs pada deploy berikutnya.

---

## 2. Setup sekali (owner)

### a. Token tulis Sanity
1. Buka **sanity.io/manage** → project **Vanillate Studio** (`62jp784l`) → **API** → **Tokens** → **Add API token**.
2. Nama `blog-admin`, izin **Editor**. Salin tokennya (hanya tampil sekali).

### b. Token GitHub (agar Publish langsung tayang)
1. GitHub → **Settings → Developer settings → Fine-grained personal access tokens → Generate new token**.
2. *Repository access*: **Only select repositories** → `Ndyspleasure/vanillate-website`.
3. *Repository permissions*: **Contents: Read and write** (syarat API `repository_dispatch`). Izin lain biarkan *No access*.
4. Catat tanggal kedaluwarsanya — perbarui sebelum habis.

### c. Secret Edge Function
Supabase Dashboard → project `lvfwopnvvqncopvathop` → **Edge Functions → Secrets**:

| Secret | Isi | Wajib |
|---|---|---|
| `SANITY_WRITE_TOKEN` | token dari langkah a | ✅ |
| `GITHUB_DISPATCH_TOKEN` | token dari langkah b | disarankan (tanpa ini tayang lewat cek per jam) |

Opsional: `BLOG_ALLOWED_ORIGINS`, `SANITY_PROJECT_ID`, `SANITY_DATASET`, `GITHUB_REPO`.

### d. Deploy Edge Function
```bash
supabase functions deploy blog-admin
```
(`verify_jwt` dibiarkan **aktif** — default.) Bisa juga lewat Supabase MCP `deploy_edge_function`.

### e. Isi awal
1. `/admin/blog/pengaturan` → tambah minimal **satu penulis** (wajib untuk terbit) dan beberapa **kategori**.
2. `/admin/blog/tulis` → tulis artikel pertama → **Publish**.
3. Google Search Console: sitemap `https://vanillate.id/sitemap-index.xml` sudah terdaftar — artikel baru otomatis masuk. Untuk artikel penting, pakai **URL Inspection → Request indexing**.

---

## 3. Menulis artikel (`/admin/blog/tulis`)

- **Isi = Markdown.** Tulisan dari Claude/ChatGPT bisa langsung ditempel; tombol
  **✨ Rapikan tulisan AI** memindah `# Judul` ke kolom Judul, menaikkan
  `###` → `##` bila perlu, mengubah bullet `•` jadi daftar, dan merapikan spasi.
- **Toolbar**: H2/H3, tebal, miring, tautan, daftar, kutipan, kotak Tips
  (`> [!TIP] …`, juga `[!INFO]`, `[!PENTING]`), tabel, gambar, dan menu
  **Tautan internal** (kartu produk `{{produk:slug}}`, tautan produk, artikel, FAQ).
- **Gambar**: klik, tarik-lepas, atau tempel (Ctrl+V) ke editor. Gambar
  **dikompres di browser** (sisi terpanjang 2000 px, WebP 85%) sebelum diunggah —
  foto HP 4–8 MB biasanya jadi 200–600 KB. Alt text diminta untuk setiap gambar.
- **Pratinjau** memakai renderer yang sama dengan halaman publik
  (`src/lib/blog/markdown.ts`).
- **Checklist SEO** langsung (judul, meta description, slug, panjang isi,
  subjudul, gambar+alt, tautan internal, kategori, poin penting, FAQ). Tanda ✕
  = akan ditolak saat Publish.
- **Simpan draft** (Ctrl+S) tidak mengubah situs. Artikel yang sudah terbit
  lalu diedit berstatus *ada perubahan* sampai **Publish perubahan** diklik.
- Tulisan juga disimpan otomatis di browser; bila tab tertutup sebelum disimpan,
  editor menawarkan **Pulihkan**.
- **Lainnya ▾**: Tarik dari situs (kembali jadi draft), Buang perubahan draft, Hapus.

### Syarat terbit (divalidasi di Edge Function)
Judul ≥ 5 karakter · slug valid & bukan `kategori/tag/penulis/halaman/…` · isi
≥ 50 kata · Ringkasan **atau** Meta description · alt text bila ada featured
image · penulis dipilih · slug tidak dipakai (atau pernah dipakai) artikel lain.

### Ganti slug artikel yang sudah terindeks
Ubah slug lalu **Publish**. Slug lama otomatis dicatat di `previousSlugs` dan
dibangun sebagai halaman redirect (`RedirectStub`: meta refresh 0 detik +
canonical + `noindex`) — pola yang sama dengan FAQ/produk, karena GitHub Pages
tidak bisa mengirim 301. Slug lama tidak bisa dipakai artikel lain.

---

## 4. SEO & GEO yang dipasang

| Fitur | Di mana |
|---|---|
| Title, meta description, canonical, `noindex` per artikel | `SEO.astro` (prop `article`, `rawTitle`, `imageAlt`) |
| Open Graph `article` + `article:published_time/modified_time/section/tag/author`, gambar 1200×630 | `SEO.astro` |
| JSON-LD `BlogPosting` + `BreadcrumbList` (+ `FAQPage` bila ada FAQ), `Blog`, `ProfilePage` penulis | `src/lib/blog/model.ts`, halaman `/blog/*` |
| Sitemap + `lastmod` per artikel; tag & redirect dikecualikan | `astro.config.mjs` (`blogSitemapInfo`) |
| RSS `/blog/rss.xml` (+ `<link rel=alternate>` di semua halaman) | `src/pages/blog/rss.xml.ts` |
| Daftar isi ber-anchor, poin penting (TL;DR), FAQ artikel | `src/pages/blog/[slug].astro` |
| Internal linking: kartu/tautan produk, FAQ terkait, artikel terkait (manual → kategori/tag/produk → terbaru); "Dari blog" di halaman produk, "Dibahas di Blog" di FAQ | `model.ts` (`relatedPosts`, `postsForProduct`, `postsForFaq`) |
| Gambar responsif dari CDN Sanity (`srcset`, WebP/AVIF, width/height, LQIP, lazy) | `markdown.ts`, `PostCard.astro` |
| Halaman tag `noindex,follow` (tipis & tumpang tindih kategori) | `src/pages/blog/tag/[slug].astro` |
| `robots.txt` tetap `Allow: /` (termasuk GPTBot, ClaudeBot, PerplexityBot) | `public/robots.txt` |

---

## 4a. Iklan Google AdSense (hanya halaman artikel)

Skrip AdSense **hanya** dimuat di `/blog/<slug>`. `/blog`, kategori, tag,
penulis, halaman redirect, dan seluruh situs lain tidak memuatnya — jadi Auto
ads pun tidak bisa muncul di sana. Pengaturan di `src/lib/blog/ads.ts`
(`ADSENSE`, publisher `ca-pub-7666352445473199`); bila `client` dikosongkan iklan mati dan `/ads.txt` hanya komentar.

| Posisi | Slot | Format AdSense |
|---|---|---|
| Tengah isi, sebelum subjudul H2 ke-3 (artikel < 3 H2 dilewati) | `slots.inArticle` | In-article |
| Setelah isi, sebelum FAQ | `slots.afterArticle` | Display, responsif |

Cara mengaktifkan:
1. Daftarkan `vanillate.id` di AdSense dan tunggu situs disetujui.
2. AdSense › Iklan › **Menurut unit iklan**: buat unit *In-article* dan *Display*, salin angka `data-ad-slot`-nya.
3. Isi `client` (`ca-pub-…`) dan kedua slot di `ADSENSE`, lalu deploy. `/ads.txt` ikut terisi otomatis.
4. **Matikan Auto ads** (atau batasi di AdSense) supaya penempatan tetap dari kode.

Kotak iklan (kelas `blog-iklan`) disembunyikan bila AdSense tidak mengisi unitnya
(`data-ad-status="unfilled"`) atau skripnya gagal dimuat (mis. ad blocker → `html.iklan-gagal`),
jadi pembaca tidak melihat label "Iklan" dengan kotak kosong (`src/styles/global.css`).

Kebijakan privasi (`/privacy` › Third-Party Services) sudah menyebut cookie
iklan Google. Untuk pengunjung EEA/UK, aktifkan pesan persetujuan (CMP) di
AdSense › Privasi & pesan.

## 5. Model data di Sanity

Ditulis hanya oleh Edge Function (`supabase/functions/blog-admin/logic.ts`).
Nama tipe harus sama dengan `src/lib/blog/config.ts` (`DOC_TYPES`, dites).

| Tipe | Field |
|---|---|
| `blogPost` | `title`, `slug{current}`, `excerpt`, `tldr[]`, `body` (Markdown), `mainImage{asset→, alt, caption}`, `author→` (ref kuat), `categories[]→` (ref kuat), `tags[]`, `publishedAt`, `updatedAt` (diisi saat Publish), `seo{title, description, noindex}`, `faqs[]{q,a}`, `relatedProducts[]` (slug produk), `relatedFaqs[]` (`kategori/slug`), `relatedPosts[]→` (ref lemah), `previousSlugs[]` |
| `blogAuthor` | `name`, `slug`, `role`, `bio`, `avatar`, `links[]` |
| `blogCategory` | `title`, `slug`, `description`, `sort` |

Id: `post-<uuid>`, `author-<uuid>`, `category-<uuid>`; draft = `drafts.<id>`. **Jangan** memakai
titik di id dokumen terbit: Sanity menyembunyikan id bertitik dari pembaca tanpa token
(walau dataset public), sehingga build situs tidak melihatnya. Id lama `post.<uuid>` masih
diterima `isDocId`, tetapi sudah dimigrasi ke format baru.
Penulis/kategori yang masih dipakai artikel (termasuk draft) tidak bisa dihapus.

### Kuota Sanity (paket Free)
Pengunjung **tidak** memakai kuota API (halaman statis). Yang terpakai:
penyimpanan aset (gambar asli setelah kompres) dan bandwidth CDN gambar. Pantau
di sanity.io/manage → project → **Usage**. Di paket Free kuota yang habis
**diblokir, bukan ditagih**.

---

## 6. Berkas

| Berkas | Isi |
|---|---|
| `src/lib/blog/config.ts` | project/dataset Sanity, path, tipe dokumen |
| `src/lib/blog/markdown.ts` | renderer Markdown artikel + helper gambar Sanity (murni, teruji) |
| `src/lib/blog/model.ts` | penormalan data, artikel terkait, JSON-LD, URL (murni, teruji) |
| `src/lib/blog/editor.ts` | checklist SEO, rapikan tulisan AI, tanggal (murni, teruji) |
| `src/lib/blog/ads.ts`, `src/pages/ads.txt.ts` | iklan AdSense di halaman artikel + ads.txt (§4a) |
| `src/lib/blog/sanity.ts` | ambil data saat build; `BLOG_FIXTURE`, `BLOG_ALLOW_EMPTY` |
| `src/lib/blog/site.ts`, `product-card.ts` | penghubung ke data produk & FAQ |
| `src/lib/blog/admin-client.ts` | klien browser Edge Function + kompres gambar |
| `src/pages/blog/**` | halaman publik |
| `src/pages/admin/blog/{index,tulis,pengaturan}.astro` | CMS |
| `supabase/functions/blog-admin/{index,logic}.ts` | Edge Function |
| `.github/workflows/blog-schedule.yml` | cek per jam (terjadwal & cadangan) |
| `tests/blog-model.test.ts`, `tests/blog-admin.test.ts`, `tests/fixtures/blog.json` | tes |

### Pengembangan lokal
```bash
BLOG_FIXTURE=tests/fixtures/blog.json npm run build   # build dengan artikel contoh
BLOG_ALLOW_EMPTY=1 npm run dev                         # dev tanpa jaringan ke Sanity
```
Build produksi **gagal** bila Sanity tak terjangkau (disengaja: lebih baik
GitHub Pages tetap menayangkan versi terakhir daripada menerbitkan blog
kosong). PR (`test.yml`) memakai `BLOG_ALLOW_EMPTY=1`.

---

## 7. Troubleshooting

| Gejala | Penyebab | Tindakan |
|---|---|---|
| CMS: "Edge Function blog-admin belum di-deploy" | function belum ada | Langkah 2d |
| CMS: "secret SANITY_WRITE_TOKEN … belum diisi" | secret kosong | Langkah 2a + 2c |
| Banner kuning "Terbit otomatis belum aktif" | `GITHUB_DISPATCH_TOKEN` kosong | Langkah 2b + 2c (tanpa ini tetap tayang ≤ ±1–2 jam) |
| "Gagal memicu build" | token GitHub kedaluwarsa/izin kurang | Buat ulang token (Contents: Read and write) |
| Deploy merah: `[blog] Gagal memuat artikel dari Sanity` | Sanity down/terblokir saat build | Jalankan ulang workflow; situs lama tetap tayang |
| "Slug … sudah dipakai" | slug aktif/lama milik artikel lain | Pilih slug lain |
| Tidak bisa hapus penulis/kategori | masih dipakai artikel (termasuk draft) | Ganti dulu di artikel terkait |
