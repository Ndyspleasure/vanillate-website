// ════════════════════════════════════════════════════════════════════════════
//  Edge Function: blog-writer
//
//  Sisi server Portal Penulis Blog (/blog/masuk, /blog/dashboard). Penulis
//  login Google dan menautkan Discord di Supabase Auth; semua baca/tulis data
//  penulis lewat sini memakai service_role (tabel blog_* tertutup untuk
//  browser). Tidak punya token Sanity: tulisan baru masuk Sanity hanya saat
//  admin menyetujuinya di blog-admin. Acuan: docs/BLOG-PENULIS.md.
//
//  Panggilan: POST, Authorization: Bearer <JWT penulis>.
//    JSON { "action": … }:
//      me                          → profil, status Discord, apakah anggota tim
//      saveProfile { … }           → buat/ubah profil penulis
//      meta                        → kategori yang tersedia
//      list                        → tulisan milikmu + riwayat tinjauan
//      get      { id }             → satu tulisan + URL gambar sementara
//      save     { id?, data }      → simpan draf
//      submit   { id }             → ajukan untuk ditinjau
//      withdraw { id }             → tarik pengajuan kembali jadi draf
//      revise   { id }             → buat draf revisi dari tulisan terbit
//      remove   { id }             → hapus draf / tulisan ditolak milikmu
//    Upload gambar: body = byte gambar, x-blog-action: upload, Content-Type
//      image/webp|jpeg|png, maks 2 MB.
//
//  Error: { error: KODE, details? } — NOT_AUTHENTICATED, BLOCKED, NO_PROFILE,
//  DISCORD_REQUIRED, VALIDATION, SLUG_TAKEN, NOT_FOUND, LIMIT, TOO_LARGE,
//  BAD_REQUEST, INTERNAL.
//
//  Deploy dengan verify_jwt = true. SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY
//  otomatis tersedia. Opsional: BLOG_ALLOWED_ORIGINS, SANITY_PROJECT_ID,
//  SANITY_DATASET.
// ════════════════════════════════════════════════════════════════════════════

import { allowedOrigin, isDocId, TYPES } from '../blog-admin/logic.ts';
import {
  allImagePaths,
  cleanProfile,
  cleanWriterInput,
  discordFromUser,
  isStoragePath,
  newStoragePath,
  submitProblems,
  WRITER_IMAGE_TYPES,
  WRITER_LIMITS,
} from '../blog-admin/review.ts';

const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SANITY_PROJECT = Deno.env.get('SANITY_PROJECT_ID') ?? '62jp784l';
const SANITY_DATASET = Deno.env.get('SANITY_DATASET') ?? 'production';
const SANITY_CDN = `https://${SANITY_PROJECT}.apicdn.sanity.io/v2025-02-19/data/query/${SANITY_DATASET}`;
const BUCKET = 'blog-penulis';
/** Batas berkas tersimpan per penulis (gambar yatim ikut terhitung). */
const MAX_FILES_PER_WRITER = 60;
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

const SVC = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

// ─── Supabase REST ───────────────────────────────────────────────────────────

async function rest<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...SVC, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) },
  });
  if (res.ok) {
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  }
  const err = await res.json().catch(() => ({}));
  throw dbError(err);
}

/** Galat Postgres → HttpError dengan kode yang dipahami portal. */
function dbError(err: any): HttpError {
  const code = String(err?.code ?? '');
  const message = String(err?.message ?? '');
  if (code === '23505') return new HttpError(409, 'SLUG_TAKEN');
  if (code === '53400') return new HttpError(429, 'LIMIT', { details: [message] });
  if (code === '42501') return new HttpError(403, 'BLOCKED', { details: [message] });
  if (code === '22023' || code === '23514' || code === 'P0001') return new HttpError(422, 'VALIDATION', { details: [message] });
  console.error('[blog-writer] database:', code, message.slice(0, 200));
  return new HttpError(500, 'INTERNAL');
}

const rpc = <T = any>(name: string, args: Record<string, unknown>) =>
  rest<T>(`rpc/${name}`, { method: 'POST', body: JSON.stringify(args) });

// ─── Auth ────────────────────────────────────────────────────────────────────

interface AuthedUser {
  id: string;
  email: string;
  raw: any;
}

async function currentUser(req: Request): Promise<AuthedUser> {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) throw new HttpError(401, 'NOT_AUTHENTICATED');
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${jwt}` } });
  if (!res.ok) throw new HttpError(401, 'NOT_AUTHENTICATED');
  const user = await res.json();
  if (!user?.id) throw new HttpError(401, 'NOT_AUTHENTICATED');
  return { id: String(user.id), email: String(user.email ?? ''), raw: user };
}

async function isTeam(userId: string): Promise<boolean> {
  const rows = await rest<any[]>(`admin_users?id=eq.${encodeURIComponent(userId)}&select=role`);
  return ['owner', 'admin'].includes(rows?.[0]?.role);
}

async function loadWriter(userId: string): Promise<any | null> {
  const rows = await rest<any[]>(`blog_writers?user_id=eq.${encodeURIComponent(userId)}&select=*`);
  return rows?.[0] ?? null;
}

/** Catat Discord dari identitas auth (server) ke profil bila berubah. */
async function syncDiscord(user: AuthedUser, writer: any | null) {
  const d = discordFromUser(user.raw);
  if (!writer || !d) return { writer, discord: d };
  if (writer.discord_id !== d.id || writer.discord_username !== d.username) {
    const rows = await rest<any[]>(`blog_writers?user_id=eq.${encodeURIComponent(user.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ discord_id: d.id, discord_username: d.username || null }),
    });
    writer = rows?.[0] ?? writer;
  }
  return { writer, discord: d };
}

async function activeWriter(user: AuthedUser): Promise<{ writer: any; discord: { id: string; username: string } | null }> {
  const { writer, discord } = await syncDiscord(user, await loadWriter(user.id));
  if (!writer) throw new HttpError(409, 'NO_PROFILE');
  if (writer.status !== 'aktif') throw new HttpError(403, 'BLOCKED', { details: ['Akun penulismu diblokir. Hubungi tim Vanillate.'] });
  return { writer, discord };
}

// ─── Storage ─────────────────────────────────────────────────────────────────

async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(paths.map(async (p) => {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${p}`, {
      method: 'POST',
      headers: { ...SVC, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 3600 }),
    });
    if (!res.ok) return;
    const j = await res.json().catch(() => null);
    if (j?.signedURL) out[p] = `${SUPABASE_URL}/storage/v1${j.signedURL}`;
  }));
  return out;
}

async function removeObjects(paths: string[]) {
  if (!paths.length) return;
  await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: { ...SVC, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: paths }),
  }).catch(() => undefined);
}

async function countFiles(userId: string): Promise<number> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: { ...SVC, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: userId, limit: MAX_FILES_PER_WRITER + 1 }),
  });
  if (!res.ok) return 0;
  const j = await res.json().catch(() => []);
  return Array.isArray(j) ? j.length : 0;
}

async function upload(req: Request, user: AuthedUser) {
  await activeWriter(user);
  const type = (req.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
  const ext = WRITER_IMAGE_TYPES[type] as 'webp' | 'jpg' | 'png' | undefined;
  if (!ext) throw new HttpError(415, 'BAD_REQUEST', { details: ['Format gambar harus WebP, JPG, atau PNG.'] });
  if (Number(req.headers.get('Content-Length') ?? '0') > WRITER_LIMITS.imageBytes) throw new HttpError(413, 'TOO_LARGE');
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength === 0) throw new HttpError(400, 'BAD_REQUEST');
  if (bytes.byteLength > WRITER_LIMITS.imageBytes) throw new HttpError(413, 'TOO_LARGE');
  if ((await countFiles(user.id)) >= MAX_FILES_PER_WRITER) {
    throw new HttpError(429, 'LIMIT', { details: ['Gambar tersimpan sudah mencapai batas. Hapus draf lama dulu.'] });
  }
  const path = newStoragePath(user.id, ext);
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...SVC, 'Content-Type': type, 'x-upsert': 'false' },
    body: bytes,
  });
  if (!res.ok) {
    console.error('[blog-writer] upload storage →', res.status);
    throw new HttpError(502, 'INTERNAL');
  }
  return { path, url: (await signedUrls([path]))[path] ?? null };
}

// ─── Kategori publik (tanpa token) ───────────────────────────────────────────

async function categories(): Promise<{ id: string; title: string }[]> {
  const q = `*[_type == "${TYPES.category}" && !(_id in path("drafts.**"))] | order(sort asc, title asc){ "id": _id, title }`;
  const res = await fetch(`${SANITY_CDN}?query=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  const j = await res.json().catch(() => null);
  return Array.isArray(j?.result) ? j.result : [];
}

/** Slug tidak boleh dipakai (atau pernah dipakai) artikel yang sudah terbit. */
async function slugUsedInSanity(slug: string, ownSanityId: string | null): Promise<boolean> {
  const q = `count(*[_type == "${TYPES.post}" && !(_id in path("drafts.**")) && _id != $own && (slug.current == $slug || $slug in previousSlugs)])`;
  const url = `${SANITY_CDN}?query=${encodeURIComponent(q)}&$slug=${encodeURIComponent(JSON.stringify(slug))}&$own=${encodeURIComponent(JSON.stringify(ownSanityId ?? ''))}`;
  const res = await fetch(url);
  if (!res.ok) return false; // pemeriksaan akhir ada di blog-admin saat menyetujui
  return Number((await res.json().catch(() => null))?.result ?? 0) > 0;
}

// ─── Aksi ────────────────────────────────────────────────────────────────────

const LIST_COLS =
  'id,title,slug,status,reject_reason,revision_of,sanity_id,submitted_at,reviewed_at,created_at,updated_at,main_image_alt';

async function me(user: AuthedUser) {
  const { writer, discord } = await syncDiscord(user, await loadWriter(user.id));
  return {
    email: user.email,
    writer: writer && {
      displayName: writer.display_name, slug: writer.slug, bio: writer.bio, links: writer.links,
      status: writer.status, discordUsername: writer.discord_username,
    },
    discord: discord ? { linked: true, username: discord.username } : { linked: false, username: null },
    isTeam: await isTeam(user.id),
    limits: { imageBytes: WRITER_LIMITS.imageBytes, bodyImages: WRITER_LIMITS.bodyImages },
  };
}

async function saveProfile(user: AuthedUser, body: any) {
  const { value, errors } = cleanProfile(body?.profile);
  if (!value) throw new HttpError(422, 'VALIDATION', { details: errors });
  const existing = await loadWriter(user.id);
  if (existing && existing.status !== 'aktif') throw new HttpError(403, 'BLOCKED', { details: ['Akun penulismu diblokir.'] });
  const d = discordFromUser(user.raw);
  try {
    if (existing) {
      await rest(`blog_writers?user_id=eq.${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...value, ...(d ? { discord_id: d.id, discord_username: d.username || null } : {}) }),
      });
    } else {
      await rest('blog_writers', {
        method: 'POST',
        body: JSON.stringify({ user_id: user.id, ...value, discord_id: d?.id ?? null, discord_username: d?.username || null }),
      });
    }
  } catch (e) {
    if (e instanceof HttpError && e.message === 'SLUG_TAKEN') {
      throw new HttpError(409, 'SLUG_TAKEN', { details: ['Slug profil sudah dipakai penulis lain.'] });
    }
    throw e;
  }
  return { saved: true };
}

async function list(user: AuthedUser) {
  await activeWriter(user);
  const [rows, log] = await Promise.all([
    rest<any[]>(`blog_submissions?writer_id=eq.${encodeURIComponent(user.id)}&select=${LIST_COLS}&order=updated_at.desc&limit=100`),
    rest<any[]>(`blog_review_log?writer_id=eq.${encodeURIComponent(user.id)}&select=submission_id,title,action,reason,at&order=id.desc&limit=50`),
  ]);
  return { submissions: rows ?? [], log: log ?? [] };
}

async function loadOwn(user: AuthedUser, id: unknown): Promise<any> {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(400, 'BAD_REQUEST');
  const rows = await rest<any[]>(`blog_submissions?id=eq.${id}&writer_id=eq.${encodeURIComponent(user.id)}&select=*`);
  if (!rows?.[0]) throw new HttpError(404, 'NOT_FOUND');
  return rows[0];
}

async function get(user: AuthedUser, body: any) {
  await activeWriter(user);
  const row = await loadOwn(user, body?.id);
  return { submission: row, imageUrls: await signedUrls(allImagePaths(row)) };
}

async function save(user: AuthedUser, body: any) {
  await activeWriter(user);
  const patch = cleanWriterInput(body?.data, user.id);
  if (!patch.title && !patch.body) throw new HttpError(422, 'VALIDATION', { details: ['Isi judul atau isi tulisan dulu.'] });
  let row: any = null;
  if (body?.id) {
    row = await loadOwn(user, body.id);
    if (!['draf', 'ditolak'].includes(row.status)) {
      throw new HttpError(409, 'BAD_REQUEST', { details: ['Tulisan yang sedang menunggu atau sudah terbit tidak bisa diubah. Tarik dulu atau buat revisi.'] });
    }
  }
  if (patch.slug && (await slugUsedInSanity(patch.slug, row?.revision_of ?? null))) {
    throw new HttpError(409, 'SLUG_TAKEN', { details: ['Slug ini sudah dipakai artikel yang terbit. Ganti slug.'] });
  }
  try {
    if (row) {
      const rows = await rest<any[]>(`blog_submissions?id=eq.${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...patch, ...(row.status === 'ditolak' ? { status: 'draf' } : {}) }),
      });
      return { id: row.id, saved: true, status: rows?.[0]?.status ?? row.status };
    }
    const rows = await rest<any[]>('blog_submissions', {
      method: 'POST',
      body: JSON.stringify({ ...patch, writer_id: user.id }),
    });
    return { id: rows[0].id, saved: true, status: 'draf' };
  } catch (e) {
    if (e instanceof HttpError && e.message === 'SLUG_TAKEN') {
      throw new HttpError(409, 'SLUG_TAKEN', { details: ['Slug ini sudah dipakai tulisan lain. Ganti slug.'] });
    }
    throw e;
  }
}

async function submit(user: AuthedUser, body: any) {
  const { writer } = await activeWriter(user);
  if (!writer.discord_id) throw new HttpError(409, 'DISCORD_REQUIRED', { details: ['Tautkan akun Discord dulu sebelum mengajukan tulisan.'] });
  const row = await loadOwn(user, body?.id);
  const problems = submitProblems(row, user.id);
  if (problems.length) throw new HttpError(422, 'VALIDATION', { details: problems });
  if (row.slug && !row.revision_of && (await slugUsedInSanity(row.slug, null))) {
    throw new HttpError(409, 'SLUG_TAKEN', { details: ['Slug ini sudah dipakai artikel yang terbit. Ganti slug.'] });
  }
  await rpc('blog_submission_submit', { p_id: row.id, p_writer: user.id });
  return { id: row.id, status: 'menunggu', isTeam: await isTeam(user.id) };
}

async function withdraw(user: AuthedUser, body: any) {
  await activeWriter(user);
  const row = await loadOwn(user, body?.id);
  if (row.status !== 'menunggu') throw new HttpError(409, 'BAD_REQUEST', { details: ['Hanya tulisan yang menunggu yang bisa ditarik.'] });
  await rest(`blog_submissions?id=eq.${row.id}&status=eq.menunggu`, { method: 'PATCH', body: JSON.stringify({ status: 'draf' }) });
  return { id: row.id, status: 'draf' };
}

async function revise(user: AuthedUser, body: any) {
  await activeWriter(user);
  const row = await loadOwn(user, body?.id);
  const id = await rpc<string>('blog_submission_revise', { p_id: row.id, p_writer: user.id });
  return { id };
}

async function remove(user: AuthedUser, body: any) {
  await activeWriter(user);
  const row = await loadOwn(user, body?.id);
  if (!['draf', 'ditolak'].includes(row.status)) {
    throw new HttpError(409, 'BAD_REQUEST', { details: ['Hanya draf atau tulisan ditolak yang bisa dihapus.'] });
  }
  const paths = await rpc<string[]>('blog_submission_delete', { p_id: row.id });
  await removeObjects((paths ?? []).filter((p) => isStoragePath(p, user.id)));
  return { id: row.id, deleted: true };
}

// ─── Router ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const origin = allowedOrigin(req.headers.get('Origin'), ORIGINS);
  const cors: Record<string, string> = {
    'Access-Control-Allow-Origin': origin ?? ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-blog-action',
    Vary: 'Origin',
  };
  const json = (status: number, data: unknown) =>
    new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'BAD_REQUEST' });

  try {
    const user = await currentUser(req);
    if (req.headers.get('x-blog-action') === 'upload') return json(200, await upload(req, user));

    const body = await req.json().catch(() => null);
    switch (typeof body?.action === 'string' ? body.action : '') {
      case 'me': return json(200, await me(user));
      case 'saveProfile': return json(200, await saveProfile(user, body));
      case 'meta': return json(200, { categories: await categories() });
      case 'list': return json(200, await list(user));
      case 'get': return json(200, await get(user, body));
      case 'save': return json(200, await save(user, body));
      case 'submit': return json(200, await submit(user, body));
      case 'withdraw': return json(200, await withdraw(user, body));
      case 'revise': return json(200, await revise(user, body));
      case 'remove': return json(200, await remove(user, body));
      default: throw new HttpError(400, 'BAD_REQUEST');
    }
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message, ...e.extra });
    console.error('[blog-writer] tak terduga:', e);
    return json(500, { error: 'INTERNAL' });
  }
});
