// Pengambil data blog dari Sanity — HANYA berjalan saat build (Node), tidak
// pernah di browser pengunjung. Halaman /blog dibangun jadi HTML statis.
//
// Dibaca lewat API CDN tanpa token: dataset `production` public, dan perspektif
// `published` memastikan draft tidak pernah ikut terbangun.
//
// Perilaku saat gagal:
//   • Default: build GAGAL. Lebih aman daripada menerbitkan situs dengan blog
//     kosong (artikel hilang dari Google) — GitHub Pages tetap menayangkan
//     versi terakhir yang berhasil.
//   • BLOG_ALLOW_EMPTY=1 → lanjut dengan blog kosong (dev lokal tanpa jaringan).
//   • BLOG_FIXTURE=path.json → baca hasil GROQ dari file (tes & dev lokal).

import { readFile } from 'node:fs/promises';
import { DOC_TYPES, SANITY_API_VERSION, SANITY_DATASET, SANITY_PROJECT_ID } from './config.ts';
import { buildBlogData, EMPTY_BLOG, postPath, type BlogData } from './model.ts';

const NOT_DRAFT = `!(_id in path("drafts.**"))`;
const IMG = `{alt, caption, "url": asset->url, "width": asset->metadata.dimensions.width, "height": asset->metadata.dimensions.height, "lqip": asset->metadata.lqip}`;

export const BLOG_QUERY = `{
  "posts": *[_type == "${DOC_TYPES.post}" && ${NOT_DRAFT} && defined(slug.current)] | order(publishedAt desc) {
    "id": _id, title, "slug": slug.current, excerpt, tldr, body, publishedAt, updatedAt, tags,
    faqs[]{q, a}, relatedProducts, relatedFaqs, "relatedPostIds": relatedPosts[]._ref, previousSlugs,
    seo{title, description, noindex},
    "mainImage": mainImage${IMG},
    "authorId": author._ref,
    "categoryIds": categories[]._ref
  },
  "authors": *[_type == "${DOC_TYPES.author}" && ${NOT_DRAFT}] {
    "id": _id, name, "slug": slug.current, role, bio, links, "avatar": avatar${IMG}
  },
  "categories": *[_type == "${DOC_TYPES.category}" && ${NOT_DRAFT}] {
    "id": _id, title, "slug": slug.current, description, sort
  }
}`;

async function fetchRaw(): Promise<unknown> {
  const fixture = process.env.BLOG_FIXTURE;
  if (fixture) return JSON.parse(await readFile(fixture, 'utf8'));

  const url =
    `https://${SANITY_PROJECT_ID}.apicdn.sanity.io/${SANITY_API_VERSION}/data/query/${SANITY_DATASET}` +
    `?query=${encodeURIComponent(BLOG_QUERY)}&perspective=published`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Sanity HTTP ${res.status}`);
      const json = (await res.json()) as { result?: unknown };
      return json.result;
    } catch (e) {
      lastError = e;
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
  throw lastError;
}

let cache: Promise<BlogData> | null = null;

/** Seluruh data blog yang sudah terbit (di-cache per proses build). */
export function getBlog(): Promise<BlogData> {
  if (!cache) {
    cache = fetchRaw()
      .then((raw) => buildBlogData(raw))
      .catch((e) => {
        if (process.env.BLOG_ALLOW_EMPTY === '1') {
          console.warn(`[blog] Gagal memuat dari Sanity (${(e as Error)?.message ?? e}). BLOG_ALLOW_EMPTY=1 → blog kosong.`);
          return EMPTY_BLOG;
        }
        throw new Error(
          `[blog] Gagal memuat artikel dari Sanity: ${(e as Error)?.message ?? e}. ` +
          'Build dihentikan supaya artikel tidak hilang dari situs. Untuk dev lokal tanpa jaringan: BLOG_ALLOW_EMPTY=1.',
        );
      });
  }
  return cache;
}

/**
 * Info untuk sitemap (dipakai astro.config.mjs): lastmod tiap artikel dan
 * halaman yang tidak boleh masuk sitemap (redirect slug lama). Tidak pernah
 * melempar — sitemap tanpa lastmod tetap valid.
 */
export async function blogSitemapInfo(): Promise<{ lastmod: Map<string, string>; exclude: Set<string> }> {
  const lastmod = new Map<string, string>();
  const exclude = new Set<string>();
  try {
    const blog = await getBlog();
    for (const p of blog.posts) lastmod.set(postPath(p.slug), p.updatedAt);
    const terbaru = blog.posts.map((p) => p.updatedAt).sort().pop();
    if (terbaru) lastmod.set('/blog', terbaru);
    for (const r of blog.redirects) exclude.add(postPath(r.from));
    for (const p of blog.posts) if (p.seo.noindex) exclude.add(postPath(p.slug));
  } catch {
    // build halaman yang akan melaporkan errornya
  }
  return { lastmod, exclude };
}
