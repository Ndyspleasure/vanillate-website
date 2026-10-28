// Penghubung blog ↔ data situs (produk & FAQ) — dipakai halaman blog saat build
// dan pratinjau di /admin/blog/tulis. Modul murni ada di ./model.ts & ./markdown.ts.

import { bots, type Bot } from '@data/bots';
import { faqs, faqUrl, getFaqCategory } from '@data/faq';
import { site } from '@data/site';
import { url } from '@utils/url';
import { renderBlogMarkdown, type RenderResult } from './markdown.ts';
import { productCardHtml, type ProductLite } from './product-card.ts';
import type { SiteInfo } from './model.ts';

export const siteInfo: SiteInfo = {
  url: site.url,
  name: site.name,
  logo: new URL('/apple-touch-icon.png', site.url).toString(),
};

export type { ProductLite };

export interface FaqLite {
  ref: string;
  question: string;
  category: string;
  href: string;
}

export const productList: ProductLite[] = bots.map((b: Bot) => ({
  slug: b.slug,
  name: b.name,
  tagline: b.tagline,
  color: b.color,
}));

export const faqList: FaqLite[] = faqs.map((f) => ({
  ref: `${f.category}/${f.slug}`,
  question: f.question,
  category: getFaqCategory(f.category)?.name ?? f.category,
  href: faqUrl(f.category, f.slug),
}));

/** Render isi artikel untuk halaman publik. */
export function renderArticle(body: string): RenderResult {
  const bySlug = new Map(productList.map((p) => [p.slug, p]));
  return renderBlogMarkdown(body, {
    internalUrl: url,
    blockToken: (name, arg) => (name === 'produk' ? productCardHtml(bySlug.get(arg), url(`/products/${arg}`)) : null),
  });
}
