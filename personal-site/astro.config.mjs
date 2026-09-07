import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN PRODUKSI (CANONICAL ORIGIN)
//
// Situs personal ini tayang di subdomain nested milik ekosistem Vanillate.
// `site` menjadi satu-satunya sumber kebenaran untuk SELURUH URL absolut:
// canonical <link>, sitemap, Open Graph, Twitter card, dan JSON-LD.
//
// PENTING: jangan pernah memakai URL deployment Vercel (*.vercel.app) sebagai
// canonical. Astro membangun semua URL absolut dari `site` di bawah ini, jadi
// selama nilainya benar, output-nya selalu memakai domain produksi — di mana
// pun ia di-deploy.
// ─────────────────────────────────────────────────────────────────────────────
const SITE_URL = 'https://personal.andikurniawan.vanillate.id';

export default defineConfig({
  site: SITE_URL,
  // Output statis murni (default). Vercel mendeteksi Astro secara otomatis dan
  // menayangkan folder `dist/` sebagai situs statis — tanpa adapter tambahan.
  integrations: [sitemap()],
  build: {
    inlineStylesheets: 'auto',
  },
  compressHTML: true,
});
