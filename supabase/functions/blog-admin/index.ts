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
//    Portal Penulis (docs/BLOG-PENULIS.md):
//      reviewList                   → antrean, ditolak, riwayat, penulis
//      reviewGet  { id }            → satu pengajuan + URL gambar sementara
//      approve    { id }            → terbitkan ke Sanity + email penulis
//      reject     { id, reason }    → tolak (alasan wajib) + email penulis
//      deleteSubmission { id }      → hapus permanen (+ riwayat, gambar)
//      setWriterStatus { userId, status } → aktif / diblokir
//      linkAuthor { userId, authorId|null } → tautkan ke penulis Sanity lama
//    Upload gambar: body = byte gambar, header x-blog-action: upload,
//      Content-Type image/*, x-blog-filename (opsional). Maks 10 MB.
//
//  Peran (tabel admin_users): owner/admin boleh semuanya; viewer hanya list/get.
//  Error: { error: KODE, details? } — NOT_AUTHENTICATED, FORBIDDEN, BAD_REQUEST,
//  VALIDATION, SLUG_TAKEN, NOT_FOUND, IN_USE, TOO_LARGE, NOT_CONFIGURED,
//  SANITY_ERROR.
//
//  Secret: SANITY_WRITE_TOKEN (token Editor project Sanity)
//  Email penulis: RESEND_API_KEY (sama dengan live-chat-email), BLOG_FROM_EMAIL
//            (default "Vanillate Blog <blog@vanillate.id>"), BLOG_SITE_URL
//            (default https://vanillate.id).
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
import {
  allImagePaths,
  reviewEmail,
  rewriteBodyImages,
  submissionToPostFields,
  submitProblems,
} from './review.ts';

const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SANITY_TOKEN = Deno.env.get('SANITY_WRITE_TOKEN') ?? '';
const SANITY_PROJECT = Deno.env.get('SANITY_PROJECT_ID') ?? '62jp784l';
const SANITY_DATASET = Deno.env.get('SANITY_DATASET') ?? 'production';
const SANITY_API = `https://${SANITY_PROJECT}.api.sanity.io/v2025-02-19`;
const GITHUB_TOKEN = Deno.env.get('GITHUB_DISPATCH_TOKEN') ?? '';
const GITHUB_REPO = Deno.env.get('GITHUB_REPO') ?? 'Ndyspleasure/vanillate-website';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const EMAIL_FROM = Deno.env.get('BLOG_FROM_EMAIL') ?? 'Vanillate Blog <blog@vanillate.id>';
const SITE_URL = (Deno.env.get('BLOG_SITE_URL') ?? 'https://vanillate.id').replace(/\/+$/, '');
const BUCKET = 'blog-penulis';
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

  return await uploadToSanity(bytes, type, safeFilename(req.headers.get('x-blog-filename')));
}

async function uploadToSanity(bytes: Uint8Array, type: string, filename: string) {
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

// ─── Portal Penulis: peninjauan ──────────────────────────────────────────────

const SVC = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

async function dbRest<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...SVC, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) },
  });
  if (res.ok) {
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  }
  const err = await res.json().catch(() => ({}));
  const code = String(err?.code ?? '');
  const message = String(err?.message ?? '');
  if (code === '22023' || code === '23514' || code === 'P0001') throw new HttpError(422, 'VALIDATION', { details: [message] });
  console.error('[blog-admin] database:', code, message.slice(0, 200));
  throw new HttpError(500, 'DATABASE_ERROR');
}

const dbRpc = <T = any>(name: string, args: Record<string, unknown>) =>
  dbRest<T>(`rpc/${name}`, { method: 'POST', body: JSON.stringify(args) });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const uuidOf = (v: unknown): string => {
  if (typeof v !== 'string' || !UUID_RE.test(v)) throw new HttpError(400, 'BAD_REQUEST');
  return v;
};

async function loadSubmission(id: unknown): Promise<any> {
  const rows = await dbRest<any[]>(`blog_submissions?id=eq.${uuidOf(id)}&select=*`);
  if (!rows?.[0]) throw new HttpError(404, 'NOT_FOUND');
  return rows[0];
}

async function loadWriterRow(userId: string): Promise<any> {
  const rows = await dbRest<any[]>(`blog_writers?user_id=eq.${uuidOf(userId)}&select=*`);
  if (!rows?.[0]) throw new HttpError(404, 'NOT_FOUND');
  return rows[0];
}

async function isTeamUser(userId: string): Promise<boolean> {
  const rows = await dbRest<any[]>(`admin_users?id=eq.${uuidOf(userId)}&select=role`);
  return canWrite(rows?.[0]?.role);
}

async function authEmail(userId: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uuidOf(userId)}`, { headers: SVC });
  if (!res.ok) return null;
  const email = (await res.json().catch(() => null))?.email;
  return typeof email === 'string' && email.includes('@') ? email : null;
}

/** Kirim email lewat Resend. Gagal tidak membatalkan aksi (hasilnya dilaporkan). */
async function sendEmail(to: string | null, mail: { subject: string; html: string; text: string }): Promise<boolean> {
  if (!to || !RESEND_API_KEY) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject: mail.subject, html: mail.html, text: mail.text }),
    });
    if (!res.ok) console.error(`[blog-admin] Resend → ${res.status}`);
    return res.ok;
  } catch {
    return false;
  }
}

async function storageSigned(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(paths.map(async (p) => {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${p}`, {
      method: 'POST', headers: { ...SVC, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 }),
    });
    const j = res.ok ? await res.json().catch(() => null) : null;
    if (j?.signedURL) out[p] = `${SUPABASE_URL}/storage/v1${j.signedURL}`;
  }));
  return out;
}

async function storageRemove(paths: string[]) {
  if (!paths.length) return;
  await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE', headers: { ...SVC, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: paths }),
  }).catch(() => undefined);
}

async function storageToSanity(path: string) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, { headers: SVC });
  if (!res.ok) throw new HttpError(409, 'VALIDATION', { details: ['Ada gambar tulisan yang hilang dari penyimpanan. Minta penulis mengunggah ulang.'] });
  const type = (res.headers.get('Content-Type') ?? 'image/webp').split(';')[0];
  const bytes = new Uint8Array(await res.arrayBuffer());
  return await uploadToSanity(bytes, type, safeFilename(path.split('/').pop()));
}

const QUEUE_COLS =
  'id,writer_id,title,slug,status,reject_reason,revision_of,submitted_at,reviewed_at,updated_at,blog_writers(display_name,slug,discord_username)';

async function reviewList() {
  const [queue, rejected, log, writers] = await Promise.all([
    dbRest<any[]>(`blog_submissions?status=eq.menunggu&select=${QUEUE_COLS}&order=submitted_at.asc&limit=100`),
    dbRest<any[]>(`blog_submissions?status=eq.ditolak&select=${QUEUE_COLS}&order=reviewed_at.desc&limit=100`),
    dbRest<any[]>('blog_review_log?select=id,submission_id,title,action,reason,at,blog_writers(display_name)&order=id.desc&limit=100'),
    dbRest<any[]>('blog_writers?select=user_id,display_name,slug,discord_username,status,sanity_author_id,created_at&order=created_at.desc&limit=200'),
  ]);
  return { queue: queue ?? [], rejected: rejected ?? [], log: log ?? [], writers: writers ?? [] };
}

async function reviewGet(body: any) {
  const row = await loadSubmission(body?.id);
  const writer = await loadWriterRow(row.writer_id);
  return {
    submission: row,
    writer: { userId: writer.user_id, displayName: writer.display_name, slug: writer.slug, bio: writer.bio, links: writer.links, discordUsername: writer.discord_username, status: writer.status },
    imageUrls: await storageSigned(allImagePaths(row)),
  };
}

/** Dokumen penulis di Sanity untuk penulis portal (dibuat/diperbarui saat menyetujui). */
async function ensureAuthor(writer: any, team: boolean): Promise<string> {
  if (writer.sanity_author_id && isDocId(writer.sanity_author_id, 'author')) return writer.sanity_author_id;
  const id = `author-${writer.user_id}`;
  const { doc, errors } = authorDocument(id, {
    name: writer.display_name, slug: writer.slug, role: team ? 'Tim Vanillate' : 'Penulis tamu', bio: writer.bio, links: writer.links,
  });
  if (!doc) throw new HttpError(422, 'VALIDATION', { details: errors });
  const slug = (doc.slug as { current: string }).current;
  const n = await sanityQuery<number>(`count(*[_type == $type && _id != $id && slug.current == $slug])`, { type: TYPES.author, id, slug });
  if (n > 0) throw new HttpError(409, 'SLUG_TAKEN', { slug, details: [`Slug profil penulis "${slug}" sudah dipakai penulis Sanity lain. Tautkan penulis ini ke penulis yang ada atau minta ia mengganti slug.`] });
  await sanityMutate([{ createOrReplace: doc }]);
  await dbRest(`blog_writers?user_id=eq.${writer.user_id}`, { method: 'PATCH', body: JSON.stringify({ sanity_author_id: id }) });
  return id;
}

async function approve(body: any, admin: { userId: string; role: string }) {
  const row = await loadSubmission(body?.id);
  if (row.status !== 'menunggu') throw new HttpError(409, 'BAD_REQUEST', { details: ['Hanya tulisan berstatus menunggu yang bisa disetujui.'] });
  const writer = await loadWriterRow(row.writer_id);
  const team = await isTeamUser(writer.user_id);
  const problems = submitProblems(row, writer.user_id);
  if (problems.length) throw new HttpError(422, 'VALIDATION', { details: problems });

  const authorId = await ensureAuthor(writer, team);

  // Gambar dari Storage → aset Sanity.
  const paths = allImagePaths(row);
  const assets: Record<string, { assetId: string; url: string }> = {};
  for (const p of paths) {
    const a = await storageToSanity(p);
    if (!a.assetId || !a.url) throw new HttpError(502, 'SANITY_ERROR');
    assets[p] = { assetId: a.assetId, url: a.url };
  }
  const urls = Object.fromEntries(Object.entries(assets).map(([p, a]) => [p, a.url]));
  const fields = submissionToPostFields(row, {
    authorId,
    assetId: row.main_image_path ? assets[row.main_image_path]?.assetId : null,
    body: rewriteBodyImages(row.body, urls),
    ugc: !team,
  });
  const errors = publishErrors(fields);
  if (errors.length) throw new HttpError(422, 'VALIDATION', { details: errors });

  const id = row.revision_of && isDocId(row.revision_of, 'post') ? row.revision_of : `post-${row.id}`;
  await assertSlugFree(id, fields.slug);
  const { pub } = await loadPair(id);
  const now = new Date().toISOString();
  const doc = postDocument(id, fields, {
    previousSlugs: nextPreviousSlugs(pub, fields.slug),
    publishedAt: pub?.publishedAt ?? now,
    updatedAt: now,
  });
  await sanityMutate([{ createOrReplace: doc }, { delete: { id: draftId(id) } }]);

  await dbRpc('blog_submission_review', { p_id: row.id, p_action: 'setujui', p_actor: admin.userId, p_reason: null, p_sanity_id: id });
  await storageRemove(paths);
  const rebuild = await triggerRebuild(`approve ${fields.slug}`);
  const emailed = await sendEmail(
    await authEmail(writer.user_id),
    reviewEmail({ kind: 'setujui', writerName: writer.display_name, title: row.title, url: `${SITE_URL}/blog/${fields.slug}/` }),
  );
  return { id, approved: true, slug: fields.slug, rebuild, emailed };
}

async function reject(body: any, admin: { userId: string }) {
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
  if (reason.length < 3) throw new HttpError(422, 'VALIDATION', { details: ['Alasan penolakan wajib diisi.'] });
  const row = await loadSubmission(body?.id);
  await dbRpc('blog_submission_review', { p_id: row.id, p_action: 'tolak', p_actor: admin.userId, p_reason: reason, p_sanity_id: null });
  const writer = await loadWriterRow(row.writer_id);
  const emailed = await sendEmail(
    await authEmail(writer.user_id),
    reviewEmail({ kind: 'tolak', writerName: writer.display_name, title: row.title, reason, url: `${SITE_URL}/blog/dashboard/` }),
  );
  return { id: row.id, rejected: true, emailed };
}

async function deleteSubmission(body: any) {
  const row = await loadSubmission(body?.id);
  let rebuild: string = 'skipped';
  if (row.status === 'terbit' && row.sanity_id && isDocId(row.sanity_id, 'post')) {
    await sanityMutate([{ delete: { id: row.sanity_id } }, { delete: { id: draftId(row.sanity_id) } }]);
    rebuild = await triggerRebuild('delete submission');
  }
  const paths = await dbRpc<string[]>('blog_submission_delete', { p_id: row.id });
  await storageRemove(paths ?? []);
  return { id: row.id, deleted: true, rebuild };
}

async function setWriterStatus(body: any) {
  if (body?.status !== 'aktif' && body?.status !== 'diblokir') throw new HttpError(400, 'BAD_REQUEST');
  await loadWriterRow(body?.userId);
  await dbRest(`blog_writers?user_id=eq.${uuidOf(body.userId)}`, { method: 'PATCH', body: JSON.stringify({ status: body.status }) });
  return { userId: body.userId, status: body.status };
}

async function linkAuthor(body: any) {
  await loadWriterRow(body?.userId);
  const authorId = body?.authorId ?? null;
  if (authorId !== null && !isDocId(authorId, 'author')) throw new HttpError(400, 'BAD_REQUEST');
  if (authorId) {
    const n = await sanityQuery<number>(`count(*[_id == $id && _type == "${TYPES.author}"])`, { id: authorId });
    if (n < 1) throw new HttpError(404, 'NOT_FOUND');
  }
  await dbRest(`blog_writers?user_id=eq.${uuidOf(body.userId)}`, { method: 'PATCH', body: JSON.stringify({ sanity_author_id: authorId }) });
  return { userId: body.userId, authorId };
}

// ─── Router ──────────────────────────────────────────────────────────────────

const READ_ACTIONS = new Set(['list', 'get', 'reviewList', 'reviewGet']);

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
      case 'reviewList': return json(200, await reviewList());
      case 'reviewGet': return json(200, await reviewGet(body));
      case 'approve': return json(200, await approve(body, admin));
      case 'reject': return json(200, await reject(body, admin));
      case 'deleteSubmission': return json(200, await deleteSubmission(body));
      case 'setWriterStatus': return json(200, await setWriterStatus(body));
      case 'linkAuthor': return json(200, await linkAuthor(body));
      default: throw new HttpError(400, 'BAD_REQUEST');
    }
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message, ...e.extra });
    console.error('[blog-admin] tak terduga:', e);
    return json(500, { error: 'INTERNAL' });
  }
});
