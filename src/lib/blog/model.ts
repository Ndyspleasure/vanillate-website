// Model data blog: bentuk artikel/penulis/kategori, penormalan hasil GROQ,
// artikel terkait, indeks tag, dan structured data (JSON-LD).
//
// Murni (tanpa alias impor & tanpa jaringan) supaya bisa diuji `node --test`
// dan dipakai ulang oleh astro.config.mjs. Pengambilan data ada di ./sanity.ts.

import { BLOG_PATH, RELATED_LIMIT } from './config.ts';
import { markdownPlainText, readingMinutes, slugify, truncate, wordCount } from './markdown.ts';

export interface BlogImage {
  url: string;
  alt: string;
  caption: string;
  width: number | null;
  height: number | null;
  lqip: string | null;
}

export interface BlogAuthor {
  id: string;
  name: string;
  slug: string;
  role: string;
  bio: string;
  avatar: BlogImage | null;
  links: string[];
}

export interface BlogCategory {
  id: string;
  title: string;
  slug: string;
  description: string;
  sort: number;
}

export interface BlogFaq {
  q: string;
  a: string;
}

export interface BlogTag {
  slug: string;
  name: string;
  count: number;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  tldr: string[];
  body: string;
  mainImage: BlogImage | null;
  author: BlogAuthor | null;
  categories: BlogCategory[];
  tags: { slug: string; name: string }[];
  publishedAt: string;
  updatedAt: string;
  seo: { title: string; description: string; noindex: boolean };
  faqs: BlogFaq[];
  relatedProducts: string[];
  relatedFaqs: string[];
  relatedPostIds: string[];
  previousSlugs: string[];
  wordCount: number;
  readingMinutes: number;
}

export interface BlogData {
  posts: BlogPost[];
  authors: BlogAuthor[];
  categories: BlogCategory[];
  tags: BlogTag[];
  /** Slug lama → slug terkini, untuk halaman redirect. */
  redirects: { from: string; to: string }[];
}

export const EMPTY_BLOG: BlogData = { posts: [], authors: [], categories: [], tags: [], redirects: [] };

// ─── Penormalan ──────────────────────────────────────────────────────────────

const str = (v: unknown, max = 10_000): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const strList = (v: unknown, max = 50): string[] =>
  Array.isArray(v) ? v.map((x) => str(x, 300)).filter(Boolean).slice(0, max) : [];
const SLUG_OK = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isoOrNull(v: unknown): string | null {
  if (typeof v !== 'string' || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function image(v: any): BlogImage | null {
  const url = str(v?.url, 1000);
  if (!/^https:\/\/cdn\.sanity\.io\//.test(url)) return null;
  const w = Number(v?.width);
  const h = Number(v?.height);
  return {
    url,
    alt: str(v?.alt, 300),
    caption: str(v?.caption, 300),
    width: Number.isFinite(w) && w > 0 ? w : null,
    height: Number.isFinite(h) && h > 0 ? h : null,
    lqip: typeof v?.lqip === 'string' && v.lqip.startsWith('data:image/') ? v.lqip : null,
  };
}

function author(v: any): BlogAuthor | null {
  const id = str(v?.id, 200);
  const slug = str(v?.slug, 100);
  const name = str(v?.name, 120);
  if (!id || !name || !SLUG_OK.test(slug)) return null;
  return {
    id,
    name,
    slug,
    role: str(v?.role, 120),
    bio: str(v?.bio, 1000),
    avatar: image(v?.avatar),
    links: strList(v?.links, 10).filter((l) => /^https:\/\//.test(l)),
  };
}

function category(v: any): BlogCategory | null {
  const id = str(v?.id, 200);
  const slug = str(v?.slug, 100);
  const title = str(v?.title, 120);
  if (!id || !title || !SLUG_OK.test(slug)) return null;
  const sort = Number(v?.sort);
  return { id, title, slug, description: str(v?.description, 400), sort: Number.isFinite(sort) ? sort : 100 };
}

/**
 * Hasil GROQ mentah → data blog yang siap dirender. Dokumen yang tidak lengkap
 * (tanpa judul/slug/isi/tanggal) dibuang, bukan dirender setengah jadi. Artikel
 * bertanggal masa depan (terjadwal) belum ikut.
 */
export function buildBlogData(raw: any, now: Date = new Date()): BlogData {
  const authors = (Array.isArray(raw?.authors) ? raw.authors : []).map(author).filter(Boolean) as BlogAuthor[];
  const categories = ((Array.isArray(raw?.categories) ? raw.categories : []).map(category).filter(Boolean) as BlogCategory[])
    .sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title, 'id'));
  const authorById = new Map(authors.map((a) => [a.id, a]));
  const catById = new Map(categories.map((c) => [c.id, c]));

  const seen = new Set<string>();
  const posts: BlogPost[] = [];
  for (const p of Array.isArray(raw?.posts) ? raw.posts : []) {
    const id = str(p?.id, 200);
    const slug = str(p?.slug, 100);
    const title = str(p?.title, 200);
    const body = str(p?.body, 200_000);
    const publishedAt = isoOrNull(p?.publishedAt);
    if (!id || id.startsWith('drafts.') || !title || !body || !publishedAt || !SLUG_OK.test(slug)) continue;
    if (new Date(publishedAt).getTime() > now.getTime()) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);

    const updatedAt = isoOrNull(p?.updatedAt) ?? publishedAt;
    const tags = new Map<string, string>();
    for (const t of strList(p?.tags, 20)) {
      const s = slugify(t, 60);
      if (s && !tags.has(s)) tags.set(s, t.slice(0, 60));
    }
    // Ringkasan otomatis dari paragraf, tanpa teks heading.
    const excerpt = str(p?.excerpt, 400) || truncate(markdownPlainText(body.replace(/^\s*#{1,6}\s.*$/gm, '')), 160);

    posts.push({
      id,
      title,
      slug,
      excerpt,
      tldr: strList(p?.tldr, 8),
      body,
      mainImage: image(p?.mainImage),
      author: authorById.get(str(p?.authorId, 200)) ?? null,
      categories: strList(p?.categoryIds, 10).map((c) => catById.get(c)).filter(Boolean) as BlogCategory[],
      tags: [...tags].map(([s, name]) => ({ slug: s, name })),
      publishedAt,
      updatedAt: new Date(updatedAt) < new Date(publishedAt) ? publishedAt : updatedAt,
      seo: {
        title: str(p?.seo?.title, 120),
        description: str(p?.seo?.description, 300),
        noindex: p?.seo?.noindex === true,
      },
      faqs: (Array.isArray(p?.faqs) ? p.faqs : [])
        .map((f: any) => ({ q: str(f?.q, 300), a: str(f?.a, 3000) }))
        .filter((f: BlogFaq) => f.q && f.a)
        .slice(0, 20),
      relatedProducts: strList(p?.relatedProducts, 6).filter((s) => SLUG_OK.test(s)),
      relatedFaqs: strList(p?.relatedFaqs, 8).filter((s) => /^[a-z0-9-]+\/[a-z0-9-]+$/.test(s)),
      relatedPostIds: strList(p?.relatedPostIds, 6),
      previousSlugs: strList(p?.previousSlugs, 20).filter((s) => SLUG_OK.test(s) && s !== slug),
      wordCount: wordCount(body),
      readingMinutes: readingMinutes(body),
    });
  }
  posts.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  // Redirect: slug lama yang tidak sedang dipakai artikel lain.
  const live = new Set(posts.map((p) => p.slug));
  const redirects: { from: string; to: string }[] = [];
  const dariDipakai = new Set<string>();
  for (const p of posts) {
    for (const from of p.previousSlugs) {
      if (live.has(from) || dariDipakai.has(from)) continue;
      dariDipakai.add(from);
      redirects.push({ from, to: p.slug });
    }
  }

  return { posts, authors, categories, tags: tagIndex(posts), redirects };
}

export function tagIndex(posts: BlogPost[]): BlogTag[] {
  const map = new Map<string, BlogTag>();
  for (const p of posts) {
    for (const t of p.tags) {
      const cur = map.get(t.slug);
      if (cur) cur.count++;
      else map.set(t.slug, { slug: t.slug, name: t.name, count: 1 });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'id'));
}

// ─── Artikel terkait ─────────────────────────────────────────────────────────

/**
 * Artikel terkait: pilihan manual penulis lebih dulu, lalu yang paling mirip
 * (kategori sama ×3, tag sama ×2, produk sama ×1), seri diputus oleh yang
 * terbaru. Kekurangan diisi artikel terbaru supaya bagian ini tidak pernah
 * kosong selama ada artikel lain.
 */
export function relatedPosts(post: BlogPost, all: BlogPost[], limit = RELATED_LIMIT): BlogPost[] {
  const others = all.filter((p) => p.id !== post.id);
  const byId = new Map(others.map((p) => [p.id, p]));
  const out: BlogPost[] = [];
  const pakai = (p: BlogPost | undefined) => {
    if (p && out.length < limit && !out.includes(p)) out.push(p);
  };

  post.relatedPostIds.forEach((id) => pakai(byId.get(id)));

  const cats = new Set(post.categories.map((c) => c.id));
  const tags = new Set(post.tags.map((t) => t.slug));
  const prods = new Set(post.relatedProducts);
  const skor = (p: BlogPost) =>
    p.categories.filter((c) => cats.has(c.id)).length * 3 +
    p.tags.filter((t) => tags.has(t.slug)).length * 2 +
    p.relatedProducts.filter((s) => prods.has(s)).length;

  others
    .map((p) => ({ p, s: skor(p) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || b.p.publishedAt.localeCompare(a.p.publishedAt))
    .forEach((x) => pakai(x.p));

  others.forEach(pakai);
  return out;
}

/** Artikel yang menautkan sebuah produk — untuk "Dari blog" di halaman produk. */
export function postsForProduct(productSlug: string, all: BlogPost[], limit = 3): BlogPost[] {
  return all.filter((p) => p.relatedProducts.includes(productSlug)).slice(0, limit);
}

/** Artikel yang menautkan sebuah FAQ ("kategori/slug"). */
export function postsForFaq(ref: string, all: BlogPost[], limit = 3): BlogPost[] {
  return all.filter((p) => p.relatedFaqs.includes(ref)).slice(0, limit);
}

export function pageCount(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / perPage));
}

// ─── URL ─────────────────────────────────────────────────────────────────────

// Tanpa garis miring penutup, sama dengan konvensi URL lain di situs (/faq/…).
export const postPath = (slug: string) => `${BLOG_PATH}/${slug}`;
export const categoryPath = (slug: string) => `${BLOG_PATH}/kategori/${slug}`;
export const tagPath = (slug: string) => `${BLOG_PATH}/tag/${slug}`;
export const authorPath = (slug: string) => `${BLOG_PATH}/penulis/${slug}`;
export const listPath = (page: number) => (page <= 1 ? BLOG_PATH : `${BLOG_PATH}/halaman/${page}`);

// ─── Tanggal ─────────────────────────────────────────────────────────────────

export function formatTanggal(iso: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** Dua tanggal dianggap berbeda bila selisihnya lebih dari sehari. */
export function wasUpdated(post: BlogPost): boolean {
  return new Date(post.updatedAt).getTime() - new Date(post.publishedAt).getTime() > 86_400_000;
}

// ─── Structured data ─────────────────────────────────────────────────────────

export interface SiteInfo {
  url: string;
  name: string;
  logo: string;
}

/**
 * URL absolut dalam bentuk canonical situs. GitHub Pages menyajikan halaman
 * sebagai <path>/index.html, jadi canonical dari SEO.astro berakhiran "/" —
 * structured data, RSS, dan tombol share harus memakai bentuk yang sama.
 */
export function canonicalUrl(siteUrl: string, path: string): string {
  const u = new URL(path, siteUrl);
  if (!u.pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(u.pathname)) u.pathname += '/';
  return u.toString();
}

const abs = (site: SiteInfo, path: string) => canonicalUrl(site.url, path);

export function blogPostingJsonLd(post: BlogPost, site: SiteInfo, ogImage: string | null) {
  const url = abs(site, postPath(post.slug));
  const node: Record<string, unknown> = {
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    headline: post.title.slice(0, 110),
    description: post.seo.description || post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    inLanguage: 'id-ID',
    wordCount: post.wordCount,
    publisher: { '@id': `${site.url}/#organization` },
    isPartOf: { '@id': `${site.url}/#website` },
  };
  if (ogImage) node.image = [ogImage];
  if (post.author) {
    node.author = {
      '@type': 'Person',
      name: post.author.name,
      url: abs(site, authorPath(post.author.slug)),
      ...(post.author.links.length ? { sameAs: post.author.links } : {}),
    };
  } else {
    node.author = { '@id': `${site.url}/#organization` };
  }
  if (post.categories[0]) node.articleSection = post.categories[0].title;
  if (post.tags.length) node.keywords = post.tags.map((t) => t.name).join(', ');
  return node;
}

export function breadcrumbJsonLd(site: SiteInfo, items: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: abs(site, it.path),
    })),
  };
}

export function faqPageJsonLd(faqs: BlogFaq[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: markdownPlainText(f.a) },
    })),
  };
}

/** `</script>` di dalam teks tidak boleh menutup tag JSON-LD lebih awal. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
