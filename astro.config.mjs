import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import { blogSitemapInfo } from './src/lib/blog/sanity.ts';

// Custom domain aktif: vanillate.id
// Jika suatu saat kembali ke GitHub Pages tanpa domain,
// ganti SITE_URL ke 'https://ndyspleasure.github.io'
// dan aktifkan lagi base: '/vanillate-website'
const SITE_URL = 'https://vanillate.id';

// Info artikel blog untuk sitemap: lastmod per artikel (dari Sanity) dan
// halaman yang tidak boleh masuk sitemap (redirect slug lama, artikel noindex).
// Gagal memuat = sitemap tanpa lastmod; build halaman blog yang melapor error.
const blogInfo = await blogSitemapInfo();
const pathOf = (page) => new URL(page).pathname.replace(/\/$/, '') || '/';

export default defineConfig({
  site: SITE_URL,
  // base tidak dipakai saat custom domain (site di root):
  // base: '/vanillate-website',
  integrations: [
    tailwind({ applyBaseStyles: false }),
    // Halaman /admin dikeluarkan dari sitemap: itu area internal,
    // bukan halaman yang ingin ditemukan lewat pencarian.
    sitemap({
      // /admin & /dashboard area login; /bots & /docs hanya stub redirect (ke /products dan /faq),
      // begitu juga slug lama produk yang sudah diganti.
      filter: (page) =>
        !page.includes('/admin') &&
        !page.includes('/dashboard') &&
        !page.includes('/bots') &&
        !page.includes('/docs') &&
        !page.includes('/products/vanillatehandsigncamera') &&
        // Tag blog noindex (tumpang tindih dengan kategori); redirect slug lama.
        !page.includes('/blog/tag/') &&
        !blogInfo.exclude.has(pathOf(page)),
      serialize(item) {
        const lastmod = blogInfo.lastmod.get(pathOf(item.url));
        return lastmod ? { ...item, lastmod } : item;
      },
    }),
  ],
  build: {
    inlineStylesheets: 'auto',
  },
  compressHTML: true,
});
