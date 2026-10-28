// ════════════════════════════════════════════════════════════════════════════
//  Edge Function: blog-admin
//
//  Jembatan CMS admin (/admin/blog) → Sanity. Artikel ditulis, diedit, dan
//  diterbitkan dari panel admin; Sanity hanya tempat penyimpanan. Token tulis
//  Sanity HANYA hidup di secret function ini — browser tidak pernah melihatnya.
//
//  Panggilan: POST, header Authorization: Bearer <JWT admin Supabase>.
//    JSON { "action": … }:
//      list                         → artikel (draft+terbit), penulis, kategori
//      get        { id }            → isian editor (draft bila ada, else terbit)
//      save       { id?, post }     → simpan sebagai DRAFT (drafts.<id>)
//      publish    { id?, post? }    → terbitkan (+ catat slug lama untuk redirect)
//      unpublish  { id }            → tarik dari situs, isi jadi draft
//      discard    { id }            → buang perubahan draft (versi terbit tetap)
//      delete     { id }            → hapus artikel (terbit & draft)
//      saveAuthor / deleteAuthor, saveCategory / deleteCategory
//      rebuild                      → picu build situs sekarang
//    Upload gambar: body = byte gambar, header x-blog-action: upload,
//      Content-Type image/*, x-blog-filename (opsional). Maks 10 MB.
//
//  Peran (tabel admin_users): owner/admin boleh semuanya; viewer hanya list/get.
//  Error: { error: KODE, details? } — NOT_AUTHENTICATED, FORBIDDEN, BAD_REQUEST,
//  VALIDATION, SLUG_TAKEN, NOT_FOUND, IN_USE, TOO_LARGE, NOT_CONFIGURED,
//  SANITY_ERROR.
//
//  Secret: SANITY_WRITE_TOKEN (token Editor project Sanity)
//  Opsional: GITHUB_DISPATCH_TOKEN (fine-grained PAT repo website, izin
//            Contents: read & write) → terbit langsung memicu deploy.
//            BLOG_ALLOWED_ORIGINS (koma; default vanillate.id + localhost),
//            SANITY_PROJECT_ID / SANITY_DATASET (default 62jp784l / production),
//            GITHUB_REPO (default Ndyspleasure/vanillate-website).
//  SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY otomatis tersedia.
//  Deploy dengan verify_jwt = true. Acuan: docs/BLOG.md.
// ════════════════════════════════════════════════════════════════════════════

import {
  allowedOrigin,
  authorDocument,
  buildListing,
  canWrite,
  categoryDocument,
  cleanPostFields,
  draftId,
  fieldsFromDocument,
  IMAGE_TYPES,
  isDocId,
  LIMITS,
  newDocId,
  nextPreviousSlugs,
  postDocument,
  publishErrors,
  safeFilename,
  TYPES,
  withoutSystemFields,
} from './logic.ts';

const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SANITY_TOKEN = Deno.env.get('SANITY_WRITE_TOKEN') ?? '';
const SANITY_PROJECT = Deno.env.get('SANITY_PROJECT_ID') ?? '62jp784l';
const SANITY_DATASET = Deno.env.get('SANITY_DATASET') ?? 'production';
const SANITY_API = `https://${SANITY_PROJECT}.api.sanity.io/v2025-02-19`;
const GITHUB_TOKEN = Deno.env.get('GITHUB_DISPATCH_TOKEN') ?? '';
const GITHUB_REPO = Deno.env.get('GITHUB_REPO') ?? 'Ndyspleasure/vanillate-website';
const ORIGINS = (Deno.env.get('BLOG_ALLOWED_ORIGINS') ??
  'https://vanillate.id,https://www.vanillate.id,http://localhost:4321,http://127.0.0.1:4321')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

class HttpError extends Error {
  status: number;
  extra: Record<string, unknown>;
  constructor(status: number, code: string, extra: Record<string, unknown> = {}) {
    super(code);
    this.status = status;
    this.extra = extra;
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────

async function currentAdmin(req: Request): Promise<{ userId: string; role: string }> {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) throw new HttpError(401, 'NOT_AUTHENTICATED');
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) throw new HttpError(401, 'NOT_AUTHENTICATED');
  const user = await res.json();
  if (!user?.id) throw new HttpError(401, 'NOT_AUTHENTICATED');

  const r = await fetch(`${SUPABASE_URL}/rest/v1/admin_users?id=eq.${encodeURIComponent(user.id)}&select=role`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!r.ok) throw new HttpError(500, 'DATABASE_ERROR');
  const rows = await r.json();
  const role = rows?.[0]?.role;
  if (!role) throw new HttpError(403, 'FORBIDDEN');
  return { userId: String(user.id), role: String(role) };
}

// ─── Sanity ──────────────────────────────────────────────────────────────────

function sanityHeaders(extra: Record<string, string> = {}) {
  if (!SANITY_TOKEN) throw new HttpError(503, 'NOT_CONFIGURED', { missing: 'SANITY_WRITE_TOKEN' });
  return { Authorization: `Bearer ${SANITY_TOKEN}`, ...extra };
}

async function sanityQuery<T = any>(query: string, params: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${SANITY_API}/data/query/${SANITY_DATASET}?perspective=raw`, {
    method: 'POST',
    headers: sanityHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ query, params }),
  });
  if (!res.ok) {
    console.error(`[blog-admin] Sanity query → ${res.status}`);
    throw new HttpError(502, 'SANITY_ERROR');
  }
  return (await res.json()).result as T;
}

async function sanityMutate(mutations: unknown[]): Promise<void> {
  const res = await fetch(`${SANITY_API}/data/mutate/${SANITY_DATASET}?visibility=sync`, {
    method: 'POST',
    headers: sanityHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ mutations }),
  });
  if (res.ok) return;
  const body = await res.text();
  // Referensi kuat: dokumen yang masih dipakai tidak bisa dihapus.
  if (res.status === 409 || /reference/i.test(body)) {
    console.error(`[blog-admin] Sanity mutate ditolak (referensi) → ${res.status}`);
    throw new HttpError(409, 'IN_USE');
  }
  console.error(`[blog-admin] Sanity mutate → ${res.status}: ${body.slice(0, 300)}`);
  throw new HttpError(502, 'SANITY_ERROR');
}

// ─── Rebuild situs ───────────────────────────────────────────────────────────

/** Picu deploy.yml lewat repository_dispatch. Gagal di sini tidak membatalkan aksi. */
async function triggerRebuild(reason: string): Promise<'sent' | 'skipped' | 'failed'> {
  if (!GITHUB_TOKEN) return 'skipped';
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'vanillate-blog-admin',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event_type: 'blog-publish', client_payload: { reason: reason.slice(0, 80) } }),
    });
    if (res.status === 204) return 'sent';
    console.error(`[blog-admin] GitHub dispatch → ${res.status}`);
    return 'failed';
  } catch {
    return 'failed';
  }
}

// ─── Aksi artikel ────────────────────────────────────────────────────────────

const POST_LIST_QUERY = `{
  "posts": *[_type == "${TYPES.post}"]{ _id, _updatedAt, title, slug, publishedAt, updatedAt, categories, "imageUrl": mainImage.asset->url },
  "authors": *[_type == "${TYPES.author}" && !(_id in path("drafts.**"))] | order(name asc){
    "id": _id, name, "slug": slug.current, role, bio, links, "avatar": avatar{ "assetId": asset._ref, alt, "url": asset->url }
  },
  "categories": *[_type == "${TYPES.category}" && !(_id in path("drafts.**"))] | order(sort asc, title asc){
    "id": _id, title, "slug": slug.current, description, sort
  }
}`;

async function list() {
  const r = await sanityQuery<{ posts: any[]; authors: any[]; categories: any[] }>(POST_LIST_QUERY);
  return {
    posts: buildListing(r.posts ?? []),
    authors: r.authors ?? [],
    categories: r.categories ?? [],
    rebuild: GITHUB_TOKEN ? 'auto' : 'cron',
  };
}

async function loadPair(id: string): Promise<{ pub: any | null; draft: any | null }> {
  const docs = await sanityQuery<any[]>(
    `*[_id in [$id, $draft]]{ ..., "mainImageUrl": mainImage.asset->url }`,
    { id, draft: draftId(id) },
  );
  return {
    pub: docs.find((d) => d._id === id) ?? null,
    draft: docs.find((d) => d._id === draftId(id)) ?? null,
  };
}

async function get(body: any) {
  if (!isDocId(body?.id, 'post')) throw new HttpError(400, 'BAD_REQUEST');
  const { pub, draft } = await loadPair(body.id);
  const doc = draft ?? pub;
  if (!doc) throw new HttpError(404, 'NOT_FOUND');
  return {
    id: body.id,
    post: fieldsFromDocument(doc),
    hasDraft: Boolean(draft),
    hasPublished: Boolean(pub),
    publishedSlug: pub?.slug?.current ?? null,
    publishedAt: pub?.publishedAt ?? null,
    updatedAt: pub?.updatedAt ?? null,
    previousSlugs: pub?.previousSlugs ?? [],
  };
}

/** Slug tidak boleh dipakai — atau pernah dipakai (redirect) — artikel lain. */
async function assertSlugFree(id: string, slug: string) {
  const n = await sanityQuery<number>(
    `count(*[_type == "${TYPES.post}" && !(_id in [$id, $draft]) && (slug.current == $slug || $slug in previousSlugs)])`,
    { id, draft: draftId(id), slug },
  );
  if (n > 0) throw new HttpError(409, 'SLUG_TAKEN', { slug });
}

async function save(body: any) {
  const id = body?.id === undefined || body?.id === null ? newDocId('post') : body.id;
  if (!isDocId(id, 'post')) throw new HttpError(400, 'BAD_REQUEST');
  const f = cleanPostFields(body?.post);
  if (!f.title && !f.body) throw new HttpError(422, 'VALIDATION', { details: ['Isi judul atau isi artikel dulu.'] });
  if (f.slug) await assertSlugFree(id, f.slug);
  const { pub } = await loadPair(id);
  const doc = postDocument(draftId(id), f, {
    previousSlugs: pub?.previousSlugs ?? [],
    publishedAt: f.publishedAt,
    updatedAt: pub?.updatedAt ?? null,
  });
  await sanityMutate([{ createOrReplace: doc }]);
  return { id, saved: true };
}

async function publish(body: any) {
  const id = body?.id === undefined || body?.id === null ? newDocId('post') : body.id;
  if (!isDocId(id, 'post')) throw new HttpError(400, 'BAD_REQUEST');
  const { pub, draft } = await loadPair(id);

  // Isi dari form bila dikirim; kalau tidak, terbitkan draft yang tersimpan.
  const sumber = body?.post ?? (draft ? fieldsFromDocument(draft) : null);
  if (!sumber) throw new HttpError(404, 'NOT_FOUND');
  const f = cleanPostFields(sumber);
  const errors = publishErrors(f);
  if (errors.length) throw new HttpError(422, 'VALIDATION', { details: errors });
  await assertSlugFree(id, f.slug);

  const now = new Date().toISOString();
  const doc = postDocument(id, f, {
    previousSlugs: nextPreviousSlugs(pub, f.slug),
    publishedAt: f.publishedAt ?? pub?.publishedAt ?? now,
    updatedAt: now,
  });
  await sanityMutate([{ createOrReplace: doc }, { delete: { id: draftId(id) } }]);
  const rebuild = await triggerRebuild(`publish ${f.slug}`);
  return { id, published: true, slug: f.slug, publishedAt: doc.publishedAt, rebuild };
}

async function unpublish(body: any) {
  if (!isDocId(body?.id, 'post')) throw new HttpError(400, 'BAD_REQUEST');
  const { pub, draft } = await loadPair(body.id);
  if (!pub) throw new HttpError(404, 'NOT_FOUND');
  const { mainImageUrl: _u, ...isi } = pub;
  const mutations: unknown[] = [];
  if (!draft) mutations.push({ create: withoutSystemFields(isi, draftId(body.id)) });
  mutations.push({ delete: { id: body.id } });
  await sanityMutate(mutations);
  return { id: body.id, unpublished: true, rebuild: await triggerRebuild('unpublish') };
}

async function discard(body: any) {
  if (!isDocId(body?.id, 'post')) throw new HttpError(400, 'BAD_REQUEST');
  const { pub } = await loadPair(body.id);
  if (!pub) throw new HttpError(409, 'BAD_REQUEST', { details: ['Artikel ini belum pernah terbit — pakai Hapus.'] });
  await sanityMutate([{ delete: { id: draftId(body.id) } }]);
  return { id: body.id, discarded: true };
}

async function remove(body: any) {
  if (!isDocId(body?.id, 'post')) throw new HttpError(400, 'BAD_REQUEST');
  const { pub } = await loadPair(body.id);
  await sanityMutate([{ delete: { id: body.id } }, { delete: { id: draftId(body.id) } }]);
  return { id: body.id, deleted: true, rebuild: pub ? await triggerRebuild('delete') : 'skipped' };
}

// ─── Penulis & kategori ──────────────────────────────────────────────────────

async function saveTaxonomy(kind: 'author' | 'category', body: any) {
  const id = body?.id ? body.id : newDocId(kind);
  if (!isDocId(id, kind)) throw new HttpError(400, 'BAD_REQUEST');
  const { doc, errors } = kind === 'author' ? authorDocument(id, body?.data) : categoryDocument(id, body?.data);
  if (!doc) throw new HttpError(422, 'VALIDATION', { details: errors });
  const type = kind === 'author' ? TYPES.author : TYPES.category;
  const slug = (doc.slug as { current: string }).current;
  const n = await sanityQuery<number>(
    `count(*[_type == $type && _id != $id && slug.current == $slug])`,
    { type, id, slug },
  );
  if (n > 0) throw new HttpError(409, 'SLUG_TAKEN', { slug });
  await sanityMutate([{ createOrReplace: doc }]);
  return { id, saved: true, rebuild: await triggerRebuild(`${kind} ${slug}`) };
}

async function deleteTaxonomy(kind: 'author' | 'category', body: any) {
  if (!isDocId(body?.id, kind)) throw new HttpError(400, 'BAD_REQUEST');
  const n = await sanityQuery<number>(`count(*[references($id)])`, { id: body.id });
  if (n > 0) throw new HttpError(409, 'IN_USE', { count: n });
  await sanityMutate([{ delete: { id: body.id } }]);
  return { id: body.id, deleted: true };
}

// ─── Upload gambar ───────────────────────────────────────────────────────────

async function upload(req: Request) {
  const type = (req.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
  if (!IMAGE_TYPES.has(type)) throw new HttpError(415, 'BAD_REQUEST', { details: ['Format gambar harus JPG, PNG, WebP, GIF, atau AVIF.'] });
  const declared = Number(req.headers.get('Content-Length') ?? '0');
  if (declared > LIMITS.imageBytes) throw new HttpError(413, 'TOO_LARGE');
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength === 0) throw new HttpError(400, 'BAD_REQUEST');
  if (bytes.byteLength > LIMITS.imageBytes) throw new HttpError(413, 'TOO_LARGE');

  const filename = safeFilename(req.headers.get('x-blog-filename'));
  const res = await fetch(`${SANITY_API}/assets/images/${SANITY_DATASET}?filename=${encodeURIComponent(filename)}`, {
    method: 'POST',
    headers: sanityHeaders({ 'Content-Type': type }),
    body: bytes,
  });
  if (!res.ok) {
    console.error(`[blog-admin] Sanity upload → ${res.status}`);
    throw new HttpError(502, 'SANITY_ERROR');
  }
  const doc = (await res.json()).document;
  return {
    assetId: doc?._id,
    url: doc?.url,
    width: doc?.metadata?.dimensions?.width ?? null,
    height: doc?.metadata?.dimensions?.height ?? null,
  };
}

// ─── Router ──────────────────────────────────────────────────────────────────

const READ_ACTIONS = new Set(['list', 'get']);

Deno.serve(async (req) => {
  const origin = allowedOrigin(req.headers.get('Origin'), ORIGINS);
  const cors: Record<string, string> = {
    'Access-Control-Allow-Origin': origin ?? ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-blog-action, x-blog-filename',
    Vary: 'Origin',
  };
  const json = (status: number, data: unknown) =>
    new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'BAD_REQUEST' });

  try {
    const admin = await currentAdmin(req);
    const headerAction = req.headers.get('x-blog-action');

    if (headerAction === 'upload') {
      if (!canWrite(admin.role)) throw new HttpError(403, 'FORBIDDEN');
      return json(200, await upload(req));
    }

    const body = await req.json().catch(() => null);
    const action = typeof body?.action === 'string' ? body.action : '';
    if (!READ_ACTIONS.has(action) && !canWrite(admin.role)) throw new HttpError(403, 'FORBIDDEN');

    switch (action) {
      case 'list': return json(200, await list());
      case 'get': return json(200, await get(body));
      case 'save': return json(200, await save(body));
      case 'publish': return json(200, await publish(body));
      case 'unpublish': return json(200, await unpublish(body));
      case 'discard': return json(200, await discard(body));
      case 'delete': return json(200, await remove(body));
      case 'saveAuthor': return json(200, await saveTaxonomy('author', body));
      case 'deleteAuthor': return json(200, await deleteTaxonomy('author', body));
      case 'saveCategory': return json(200, await saveTaxonomy('category', body));
      case 'deleteCategory': return json(200, await deleteTaxonomy('category', body));
      case 'rebuild': return json(200, { rebuild: await triggerRebuild('manual') });
      default: throw new HttpError(400, 'BAD_REQUEST');
    }
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message, ...e.extra });
    console.error('[blog-admin] tak terduga:', e);
    return json(500, { error: 'INTERNAL' });
  }
});
