// Helper untuk membangun URL internal yang sesuai dengan `base` di astro.config.mjs.
//
// Ini penting saat website di-deploy ke sub-path (contoh: ndyspleasure.github.io/vanillate-website).
// Astro TIDAK auto-prefix <a href="/..."> dengan base, jadi kita perlu helper manual.
//
// Cara pakai di file .astro:
//   import { url } from '@/utils/url';
//   ...
//   <a href={url('/bots')}>Bots</a>
//   <a href={url('/docs/sambung-kata')}>Docs</a>
//
// External URL (http, https, mailto, #anchor) di-passthrough tanpa perubahan.
//
// Ketika nanti pakai custom domain vanillate.com:
//   1. Hapus `base` di astro.config.mjs
//   2. BASE_URL otomatis jadi '/' -> semua link balik ke root
//   3. Tidak perlu ubah kode di helper ini atau tempat lain

export function url(path: string): string {
  // External / non-path URLs pass through
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('mailto:') ||
    path.startsWith('#')
  ) {
    return path;
  }

  const base = import.meta.env.BASE_URL; // '/vanillate-website/' atau '/'
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanPath = path.startsWith('/') ? path : '/' + path;
  const combined = cleanBase + cleanPath;

  return combined || '/';
}
