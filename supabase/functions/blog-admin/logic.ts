// ════════════════════════════════════════════════════════════════════════════
//  blog-admin — logika murni (tanpa Deno/jaringan) supaya bisa diuji dengan
//  Node: `node --experimental-strip-types --test tests/`.
//  Hanya sintaks TypeScript yang bisa di-strip (tanpa enum/namespace).
//
//  Di sinilah validasi AKHIR artikel blog. Form di /admin/blog hanya memberi
//  umpan balik; apa pun yang dikirim browser dibersihkan ulang di sini sebelum
//  menjadi dokumen Sanity.
// ════════════════════════════════════════════════════════════════════════════

/** Harus sama dengan src/lib/blog/config.ts → DOC_TYPES. */
export const TYPES = { post: 'blogPost', author: 'blogAuthor', category: 'blogCategory' } as const;

export const LIMITS = {
  title: 120,
  slug: 80,
  excerpt: 300,
  body: 150_000,
  tldr: 6,
  tldrItem: 240,
  tags: 12,
  tag: 40,
  categories: 4,
  faqs: 12,
  faqQ: 200,
  faqA: 2000,
  seoTitle: 70,
  seoDescription: 170,
  alt: 200,
  caption: 240,
  relatedProducts: 4,
  relatedFaqs: 6,
  relatedPosts: 3,
  imageBytes: 10 * 1024 * 1024,
};

/** Segmen URL milik halaman blog lain — tidak boleh dipakai jadi slug artikel. */
export const RESERVED_SLUGS = new Set(['kategori', 'tag', 'penulis', 'halaman', 'rss', 'rss-xml', 'feed', 'preview', 'admin']);

export const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ASSET_ID = /^image-[a-f0-9]{20,64}-\d{1,5}x\d{1,5}-(jpg|jpeg|png|webp|gif|avif|svg)$/;
const DOC_ID = /^(post|author|category)\.[a-z0-9-]{8,64}$/;
const FAQ_REF = /^[a-z0-9-]{1,80}\/[a-z0-9-]{1,120}$/;

export type Role = 'owner' | 'admin' | 'viewer';

export function canWrite(role: unknown): boolean {
  return role === 'owner' || role === 'admin';
}

export function allowedOrigin(origin: string | null, allowed: string[]): string | null {
  return origin && allowed.includes(origin) ? origin : null;
}

export function isDocId(id: unknown, kind?: 'post' | 'author' | 'category'): id is string {
  if (typeof id !== 'string' || !DOC_ID.test(id)) return false;
  return !kind || id.startsWith(`${kind}.`);
}

export function newDocId(kind: 'post' | 'author' | 'category'): string {
  return `${kind}.${crypto.randomUUID()}`;
}

export const draftId = (id: string) => `drafts.${id}`;
export const baseId = (id: string) => id.replace(/^drafts\./, '');

export function slugify(text: string, max = LIMITS.slug): string {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' dan ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

// ─── Bersihkan input ─────────────────────────────────────────────────────────

/** Teks satu baris: karakter kontrol dibuang, spasi dirapikan, dipotong. */
function line(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Teks multi-baris (Markdown): hanya \n dan \t yang dipertahankan. */
function multiline(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, max);
}

function uniq<T>(list: T[]): T[] {
  return [...new Set(list)];
}

function uniqBy<T>(list: T[], key: (x: T) => string): T[] {
  const seen = new Set<string>();
  return list.filter((x) => (seen.has(key(x)) ? false : (seen.add(key(x)), true)));
}

export interface ImageInput {
  assetId: string;
  alt: string;
  caption: string;
}

export interface PostFields {
  title: string;
  slug: string;
  excerpt: string;
  tldr: string[];
  body: string;
  mainImage: ImageInput | null;
  authorId: string | null;
  categoryIds: string[];
  tags: string[];
  publishedAt: string | null;
  seo: { title: string; description: string; noindex: boolean };
  faqs: { q: string; a: string }[];
  relatedProducts: string[];
  relatedFaqs: string[];
  relatedPostIds: string[];
}

function isoOrNull(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  return y >= 2000 && y <= 2100 ? d.toISOString() : null;
}

function imageInput(v: any): ImageInput | null {
  const assetId = typeof v?.assetId === 'string' ? v.assetId.trim() : '';
  if (!ASSET_ID.test(assetId)) return null;
  return { assetId, alt: line(v?.alt, LIMITS.alt), caption: line(v?.caption, LIMITS.caption) };
}

/**
 * Bentuk aman dari isian form. Tidak menolak apa pun — draft boleh setengah
 * jadi. Penolakan untuk terbit ada di `publishErrors`.
 */
export function cleanPostFields(input: any): PostFields {
  const title = line(input?.title, LIMITS.title);
  const slugRaw = typeof input?.slug === 'string' ? input.slug : '';
  const slug = slugify(slugRaw || title);
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  return {
    title,
    slug,
    excerpt: line(input?.excerpt, LIMITS.excerpt),
    tldr: list(input?.tldr).map((t) => line(t, LIMITS.tldrItem)).filter(Boolean).slice(0, LIMITS.tldr),
    body: multiline(input?.body, LIMITS.body),
    mainImage: imageInput(input?.mainImage),
    authorId: isDocId(input?.authorId, 'author') ? input.authorId : null,
    categoryIds: uniq(list(input?.categoryIds).filter((c) => isDocId(c, 'category')) as string[]).slice(0, LIMITS.categories),
    tags: uniqBy(list(input?.tags).map((t) => line(t, LIMITS.tag)).filter((t) => slugify(t)), (t) => slugify(t)).slice(0, LIMITS.tags),
    publishedAt: isoOrNull(input?.publishedAt),
    seo: {
      title: line(input?.seo?.title, LIMITS.seoTitle),
      description: line(input?.seo?.description, LIMITS.seoDescription),
      noindex: input?.seo?.noindex === true,
    },
    faqs: list(input?.faqs)
      .map((f: any) => ({ q: line(f?.q, LIMITS.faqQ), a: multiline(f?.a, LIMITS.faqA) }))
      .filter((f) => f.q && f.a)
      .slice(0, LIMITS.faqs),
    relatedProducts: uniq(list(input?.relatedProducts).filter((s) => typeof s === 'string' && SLUG.test(s)) as string[]).slice(0, LIMITS.relatedProducts),
    relatedFaqs: uniq(list(input?.relatedFaqs).filter((s) => typeof s === 'string' && FAQ_REF.test(s)) as string[]).slice(0, LIMITS.relatedFaqs),
    relatedPostIds: uniq(list(input?.relatedPostIds).filter((s) => isDocId(s, 'post')) as string[]).slice(0, LIMITS.relatedPosts),
  };
}

export function wordCount(md: string): number {
  const t = md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|{}-]/g, ' ')
    .trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Syarat minimum supaya artikel layak tayang & layak diindeks. */
export function publishErrors(f: PostFields): string[] {
  const e: string[] = [];
  if (f.title.length < 5) e.push('Judul minimal 5 karakter.');
  if (!f.slug || !SLUG.test(f.slug)) e.push('Slug URL wajib diisi (huruf kecil, angka, tanda hubung).');
  else if (RESERVED_SLUGS.has(f.slug) || /^\d+$/.test(f.slug)) e.push(`Slug "${f.slug}" dipakai halaman blog lain. Pilih slug lain.`);
  if (wordCount(f.body) < 50) e.push('Isi artikel minimal 50 kata.');
  if (!f.excerpt && !f.seo.description) e.push('Isi Ringkasan atau Meta description — dipakai Google & kartu share.');
  if (f.mainImage && !f.mainImage.alt) e.push('Featured image wajib punya alt text.');
  if (!f.authorId) e.push('Pilih penulis. Buat dulu di Blog › Kategori & Penulis bila belum ada.');
  return e;
}

// ─── Dokumen Sanity ──────────────────────────────────────────────────────────

const ref = (id: string, key?: string, weak = false) => ({
  _type: 'reference',
  _ref: id,
  ...(key ? { _key: key } : {}),
  ...(weak ? { _weak: true } : {}),
});

/** Kunci array Sanity yang stabil untuk isi yang sama (diff revisi tetap rapi). */
export function arrayKey(i: number, seed: string): string {
  let h = 0;
  for (const ch of `${i}:${seed}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `k${h.toString(36)}${i}`;
}

export interface PostMeta {
  previousSlugs: string[];
  publishedAt: string | null;
  updatedAt: string | null;
}

/**
 * PostFields → dokumen `blogPost`. Penulis & kategori memakai referensi kuat
 * (Sanity menolak menghapus yang masih dipakai); artikel terkait memakai
 * referensi lemah karena artikel lain bisa saja belum/tidak lagi terbit.
 */
export function postDocument(id: string, f: PostFields, meta: PostMeta): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    _id: id,
    _type: TYPES.post,
    title: f.title,
    slug: { _type: 'slug', current: f.slug },
    excerpt: f.excerpt,
    tldr: f.tldr,
    body: f.body,
    tags: f.tags,
    categories: f.categoryIds.map((c, i) => ref(c, arrayKey(i, c))),
    seo: { _type: 'seo', ...f.seo },
    faqs: f.faqs.map((q, i) => ({ _key: arrayKey(i, q.q), _type: 'faq', ...q })),
    relatedProducts: f.relatedProducts,
    relatedFaqs: f.relatedFaqs,
    relatedPosts: f.relatedPostIds.filter((p) => baseId(p) !== baseId(id)).map((p, i) => ref(p, arrayKey(i, p), true)),
    previousSlugs: uniq(meta.previousSlugs.filter((s) => SLUG.test(s) && s !== f.slug)).slice(0, 20),
  };
  if (f.mainImage) {
    doc.mainImage = {
      _type: 'image',
      asset: ref(f.mainImage.assetId),
      alt: f.mainImage.alt,
      caption: f.mainImage.caption,
    };
  }
  if (f.authorId) doc.author = ref(f.authorId);
  const publishedAt = meta.publishedAt ?? f.publishedAt;
  if (publishedAt) doc.publishedAt = publishedAt;
  if (meta.updatedAt) doc.updatedAt = meta.updatedAt;
  return doc;
}

/**
 * Riwayat slug saat terbit: slug terbit sebelumnya ikut dicatat bila berubah,
 * supaya alamat lama yang sudah terindeks dialihkan ke alamat baru.
 */
export function nextPreviousSlugs(published: any, newSlug: string): string[] {
  const lama: string[] = Array.isArray(published?.previousSlugs) ? published.previousSlugs : [];
  const slugTerbit = published?.slug?.current;
  const semua = typeof slugTerbit === 'string' && slugTerbit !== newSlug ? [...lama, slugTerbit] : lama;
  return uniq(semua.filter((s) => typeof s === 'string' && SLUG.test(s) && s !== newSlug));
}

/** Dokumen Sanity (dengan url aset hasil GROQ) → isian form editor. */
export function fieldsFromDocument(doc: any): PostFields & { mainImageUrl: string | null } {
  const f = cleanPostFields({
    title: doc?.title,
    slug: doc?.slug?.current,
    excerpt: doc?.excerpt,
    tldr: doc?.tldr,
    body: doc?.body,
    mainImage: doc?.mainImage?.asset?._ref
      ? { assetId: doc.mainImage.asset._ref, alt: doc.mainImage.alt, caption: doc.mainImage.caption }
      : null,
    authorId: doc?.author?._ref,
    categoryIds: (doc?.categories ?? []).map((c: any) => c?._ref),
    tags: doc?.tags,
    publishedAt: doc?.publishedAt,
    seo: doc?.seo,
    faqs: doc?.faqs,
    relatedProducts: doc?.relatedProducts,
    relatedFaqs: doc?.relatedFaqs,
    relatedPostIds: (doc?.relatedPosts ?? []).map((p: any) => p?._ref),
  });
  return { ...f, mainImageUrl: typeof doc?.mainImageUrl === 'string' ? doc.mainImageUrl : null };
}

/** Salinan dokumen tanpa field sistem (_rev, _createdAt, …) untuk dipindah id. */
export function withoutSystemFields(doc: Record<string, unknown>, newId: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) {
    if (k.startsWith('_') && k !== '_type') continue;
    out[k] = v;
  }
  return { _id: newId, ...out };
}

// ─── Daftar artikel ──────────────────────────────────────────────────────────

export type PostStatus = 'draft' | 'published' | 'changed' | 'scheduled';

export interface PostListItem {
  id: string;
  title: string;
  slug: string;
  status: PostStatus;
  publishedAt: string | null;
  updatedAt: string | null;
  editedAt: string | null;
  hasDraft: boolean;
  hasPublished: boolean;
  publishedSlug: string | null;
  imageUrl: string | null;
  categoryIds: string[];
}

/** Gabungkan dokumen terbit & draft (drafts.<id>) menjadi satu baris per artikel. */
export function buildListing(docs: any[], now: Date = new Date()): PostListItem[] {
  const map = new Map<string, { pub?: any; draft?: any }>();
  for (const d of Array.isArray(docs) ? docs : []) {
    if (typeof d?._id !== 'string') continue;
    const id = baseId(d._id);
    if (!isDocId(id, 'post')) continue;
    const cur = map.get(id) ?? {};
    if (d._id.startsWith('drafts.')) cur.draft = d;
    else cur.pub = d;
    map.set(id, cur);
  }
  const out: PostListItem[] = [];
  for (const [id, { pub, draft }] of map) {
    const tampil = draft ?? pub;
    let status: PostStatus = 'draft';
    if (pub) {
      const terjadwal = pub.publishedAt && new Date(pub.publishedAt).getTime() > now.getTime();
      status = draft ? 'changed' : terjadwal ? 'scheduled' : 'published';
    }
    out.push({
      id,
      title: String(tampil?.title ?? '') || 'Tanpa judul',
      slug: String(tampil?.slug?.current ?? ''),
      status,
      publishedAt: pub?.publishedAt ?? null,
      updatedAt: pub?.updatedAt ?? null,
      editedAt: tampil?._updatedAt ?? null,
      hasDraft: Boolean(draft),
      hasPublished: Boolean(pub),
      publishedSlug: pub?.slug?.current ?? null,
      imageUrl: typeof tampil?.imageUrl === 'string' ? tampil.imageUrl : null,
      categoryIds: Array.isArray(tampil?.categories) ? tampil.categories.map((c: any) => c?._ref).filter(Boolean) : [],
    });
  }
  return out.sort((a, b) => String(b.editedAt ?? '').localeCompare(String(a.editedAt ?? '')));
}

// ─── Penulis & kategori ──────────────────────────────────────────────────────

export function authorDocument(id: string, input: any): { doc?: Record<string, unknown>; errors: string[] } {
  const name = line(input?.name, 80);
  const slug = slugify(typeof input?.slug === 'string' && input.slug ? input.slug : name, 60);
  const errors: string[] = [];
  if (name.length < 2) errors.push('Nama penulis minimal 2 karakter.');
  if (!slug) errors.push('Slug penulis tidak valid.');
  const avatar = imageInput(input?.avatar);
  const links = (Array.isArray(input?.links) ? input.links : [])
    .map((l: unknown) => line(l, 300))
    .filter((l: string) => /^https:\/\/[^\s]+$/.test(l))
    .slice(0, 6);
  if (errors.length) return { errors };
  const doc: Record<string, unknown> = {
    _id: id,
    _type: TYPES.author,
    name,
    slug: { _type: 'slug', current: slug },
    role: line(input?.role, 80),
    bio: multiline(input?.bio, 800),
    links,
  };
  if (avatar) doc.avatar = { _type: 'image', asset: ref(avatar.assetId), alt: avatar.alt || name };
  return { doc, errors };
}

export function categoryDocument(id: string, input: any): { doc?: Record<string, unknown>; errors: string[] } {
  const title = line(input?.title, 60);
  const slug = slugify(typeof input?.slug === 'string' && input.slug ? input.slug : title, 60);
  const errors: string[] = [];
  if (title.length < 2) errors.push('Nama kategori minimal 2 karakter.');
  if (!slug) errors.push('Slug kategori tidak valid.');
  const sort = Number.parseInt(String(input?.sort ?? '100'), 10);
  if (errors.length) return { errors };
  return {
    doc: {
      _id: id,
      _type: TYPES.category,
      title,
      slug: { _type: 'slug', current: slug },
      description: line(input?.description, 300),
      sort: Number.isFinite(sort) ? Math.max(0, Math.min(9999, sort)) : 100,
    },
    errors,
  };
}

/** Nama file aman untuk upload aset. */
export function safeFilename(name: unknown): string {
  const n = typeof name === 'string' ? name : '';
  const base = n.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return base || 'gambar';
}
