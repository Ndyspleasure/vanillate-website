import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

// Ganti SITE_URL saat sudah pakai domain vanillate.com
// Contoh: 'https://vanillate.com'
// Untuk GitHub Pages default: 'https://<username>.github.io'
const SITE_URL = 'https://ndyspleasure.github.io';

export default defineConfig({
  site: SITE_URL,
  // Jika deploy ke <username>.github.io/vanillate-website (bukan custom domain),
  // uncomment baris berikut:
base: '/vanillate-website',
  integrations: [
    tailwind({ applyBaseStyles: false }),
    sitemap(),
  ],
  build: {
    inlineStylesheets: 'auto',
  },
  compressHTML: true,
});
