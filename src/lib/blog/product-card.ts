// Kartu produk untuk token {{produk:slug}} di isi artikel. Modul murni supaya
// halaman publik (lewat ./site.ts) dan pratinjau CMS memakai HTML yang sama.

import { escapeHtml } from './markdown.ts';

export interface ProductLite {
  slug: string;
  name: string;
  tagline: string;
  color: string;
}

/** HTML kartu produk, atau null bila produknya tidak dikenal (token dibiarkan jadi teks). */
export function productCardHtml(p: ProductLite | undefined, href: string): string | null {
  if (!p) return null;
  return (
    `<aside class="my-8 not-prose rounded-2xl border border-ink-900/10 dark:border-cream-100/10 bg-cream-100/50 dark:bg-ink-900/50 p-5 md:p-6 flex flex-col sm:flex-row sm:items-center gap-4">` +
    `<span class="h-10 w-1 rounded-full flex-none hidden sm:block" style="background:${escapeHtml(/^#[0-9a-f]{3,8}$/i.test(p.color) ? p.color : '#E8B84A')}" aria-hidden="true"></span>` +
    `<div class="flex-1 min-w-0"><p class="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-amber-700 dark:text-amber-400 mb-1">Produk Vanillate</p>` +
    `<p class="font-display text-lg font-semibold tracking-tightest text-ink-900 dark:text-cream-50">${escapeHtml(p.name)}</p>` +
    `<p class="text-sm text-ink-600 dark:text-cream-200/80 leading-relaxed">${escapeHtml(p.tagline)}</p></div>` +
    `<a href="${escapeHtml(href)}" class="inline-flex items-center justify-center gap-1.5 rounded-full bg-ink-900 dark:bg-amber-500 text-cream-50 dark:text-ink-950 px-5 py-2.5 text-sm font-medium hover:-translate-y-0.5 transition-transform whitespace-nowrap">Lihat produk →</a>` +
    `</aside>`
  );
}

