import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

// Custom domain aktif: vanillate.id
// Jika suatu saat kembali ke GitHub Pages tanpa domain,
// ganti SITE_URL ke 'https://ndyspleasure.github.io'
// dan aktifkan lagi base: '/vanillate-website'
const SITE_URL = 'https://vanillate.id';

export default defineConfig({
  site: SITE_URL,
  // base tidak dipakai saat custom domain (site di root):
  // base: '/vanillate-website',
  integrations: [
    tailwind({ applyBaseStyles: false }),
    // Halaman /admin dikeluarkan dari sitemap: itu area internal,
    // bukan halaman yang ingin ditemukan lewat pencarian.
    sitemap({
      // /admin internal; /bots hanya stub redirect ke /products.
      filter: (page) => !page.includes('/admin') && !page.includes('/bots'),
    }),
  ],
  build: {
    inlineStylesheets: 'auto',
  },
  compressHTML: true,
});
