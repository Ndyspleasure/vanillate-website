// ════════════════════════════════════════════════════════════════════════════
//  Edge Function: partner-admin  (proyek Supabase CMS)
//
//  Mengelola akun Portal Partner (docs/PARTNER-PORTAL.md). Kunci service_role
//  hanya ada di sini (otomatis tersedia sebagai env), tidak pernah di browser.
//
//  POST JSON, header Authorization: Bearer <access token>, verify_jwt AKTIF.
//    { action: 'create', username, displayName, password }   → khusus owner CMS
//    { action: 'reset',  id, password }                       → khusus owner CMS
//    { action: 'delete', id }                                 → khusus owner CMS
//    { action: 'change', currentPassword, username, password }→ partner sendiri
//
//  Error: { error: KODE, message } — NOT_AUTHENTICATED 401, FORBIDDEN 403,
//  BAD_REQUEST 400, CONFLICT 409, TOO_MANY 429, UPSTREAM_ERROR 502.
//  Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (otomatis);
//  opsional PARTNER_ADMIN_ALLOWED_ORIGINS (koma).
// ════════════════════════════════════════════════════════════════════════════

import {
  allowedOrigin,
  bearerToken,
  createAttemptLimiter,
  emailFor,
  parseAction,
} from './logic.ts';

const URL_BASE = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ORIGINS = (Deno.env.get('PARTNER_ADMIN_ALLOWED_ORIGINS') ??
  'https://vanillate.id,https://www.vanillate.id,http://localhost:4321,http://127.0.0.1:4321')
  .split(',').map((s) => s.trim()).filter(Boolean);

const limiter = createAttemptLimiter(8, 10 * 60_000);

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

function json(status: number, body: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      Vary: 'Origin',
      ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
    },
  });
}

const svc = (extra: Record<string, string> = {}) => ({
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  'Content-Type': 'application/json',
  ...extra,
});

async function userOf(token: string): Promise<{ id: string } | null> {
  const res = await fetch(`${URL_BASE}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const u = (await res.json()) as { id?: string };
  return u?.id ? { id: u.id } : null;
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  return await fetch(`${URL_BASE}/rest/v1/${path}`, { ...init, headers: { ...svc(), ...(init.headers as object) } });
}

async function isOwner(uid: string): Promise<boolean> {
  const res = await rest(`admin_users?select=role&id=eq.${uid}&limit=1`);
  if (!res.ok) throw new HttpError(502, 'UPSTREAM_ERROR', 'Gagal memeriksa peran.');
  const rows = (await res.json()) as { role?: string }[];
  return rows?.[0]?.role === 'owner';
}

async function partnerRow(id: string): Promise<{ id: string; username: string; must_change_credentials: boolean; contact_email: string | null } | null> {
  const res = await rest(`partner_accounts?select=id,username,must_change_credentials,contact_email&id=eq.${id}&limit=1`);
  if (!res.ok) throw new HttpError(502, 'UPSTREAM_ERROR', 'Gagal membaca akun.');
  return ((await res.json()) as any[])[0] ?? null;
}

async function authAdmin(method: string, path: string, body?: unknown): Promise<Response> {
  return await fetch(`${URL_BASE}/auth/v1/admin/users${path}`, {
    method,
    headers: svc(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function run(token: string, input: ReturnType<typeof parseAction> & { ok: true }): Promise<unknown> {
  const user = await userOf(token);
  if (!user) throw new HttpError(401, 'NOT_AUTHENTICATED', 'Sesi login tidak valid.');
  const a = input.value;

  if (a.action === 'change') {
    const me = await partnerRow(user.id);
    if (!me) throw new HttpError(403, 'FORBIDDEN', 'Akun ini bukan akun partner.');
    if (!limiter.hit(user.id)) throw new HttpError(429, 'TOO_MANY', 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.');
    // Verifikasi password saat ini.
    const chk = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailFor(me.username), password: a.currentPassword }),
    });
    if (!chk.ok) throw new HttpError(403, 'FORBIDDEN', 'Password saat ini salah.');
    if (me.must_change_credentials && a.username === me.username) {
      throw new HttpError(400, 'BAD_REQUEST', 'Pilih username baru yang berbeda dari username bawaan.');
    }
    // Ganti pertama kali wajib mengisi email kontak (untuk pengingat layanan).
    if (me.must_change_credentials && !a.email && !me.contact_email) {
      throw new HttpError(400, 'BAD_REQUEST', 'Isi email aktif untuk pengingat masa layanan.');
    }
    if (a.username !== me.username) {
      const dup = await rest(`partner_accounts?select=id&username=eq.${a.username}&limit=1`);
      if (((await dup.json()) as unknown[]).length) throw new HttpError(409, 'CONFLICT', 'Username sudah dipakai.');
    }
    const up = await authAdmin('PUT', `/${user.id}`, { email: emailFor(a.username), password: a.password, email_confirm: true });
    if (!up.ok) throw new HttpError(502, 'UPSTREAM_ERROR', 'Gagal menyimpan kredensial baru.');
    const pr = await rest(`partner_accounts?id=eq.${user.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ username: a.username, must_change_credentials: false, ...(a.email ? { contact_email: a.email } : {}) }),
    });
    if (!pr.ok) throw new HttpError(502, 'UPSTREAM_ERROR', 'Gagal memperbarui profil.');
    return { username: a.username };
  }

  if (a.action === 'email') {
    const me = await partnerRow(user.id);
    if (!me) throw new HttpError(403, 'FORBIDDEN', 'Akun ini bukan akun partner.');
    if (!limiter.hit(user.id)) throw new HttpError(429, 'TOO_MANY', 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.');
    const pr = await rest(`partner_accounts?id=eq.${user.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ contact_email: a.email }),
    });
    if (!pr.ok) throw new HttpError(502, 'UPSTREAM_ERROR', 'Gagal menyimpan email.');
    return { email: a.email };
  }

  // Selebihnya khusus owner CMS.
  if (!(await isOwner(user.id))) throw new HttpError(403, 'FORBIDDEN', 'Khusus owner.');

  if (a.action === 'create') {
    const dup = await rest(`partner_accounts?select=id&username=eq.${a.username}&limit=1`);
    if (((await dup.json()) as unknown[]).length) throw new HttpError(409, 'CONFLICT', 'Username sudah dipakai.');
    const cr = await authAdmin('POST', '', { email: emailFor(a.username), password: a.password, email_confirm: true });
    if (!cr.ok) throw new HttpError(cr.status === 422 ? 409 : 502, cr.status === 422 ? 'CONFLICT' : 'UPSTREAM_ERROR', 'Gagal membuat akun.');
    const created = (await cr.json()) as { id: string };
    const ins = await rest('partner_accounts', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ id: created.id, username: a.username, display_name: a.displayName, created_by: user.id }),
    });
    if (!ins.ok) {
      await authAdmin('DELETE', `/${created.id}`); // batalkan agar tidak ada akun yatim
      throw new HttpError(502, 'UPSTREAM_ERROR', 'Gagal menyimpan profil partner.');
    }
    return { id: created.id, username: a.username };
  }

  const target = await partnerRow(a.id);
  if (!target) throw new HttpError(400, 'BAD_REQUEST', 'Akun partner tidak ditemukan.');

  if (a.action === 'reset') {
    const up = await authAdmin('PUT', `/${a.id}`, { password: a.password });
    if (!up.ok) throw new HttpError(502, 'UPSTREAM_ERROR', 'Gagal mereset password.');
    await rest(`partner_accounts?id=eq.${a.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ must_change_credentials: true }),
    });
    return { id: a.id };
  }

  const del = await authAdmin('DELETE', `/${a.id}`);
  if (!del.ok) throw new HttpError(502, 'UPSTREAM_ERROR', 'Gagal menghapus akun.');
  return { id: a.id };
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = allowedOrigin(req.headers.get('Origin'), ORIGINS);
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
        'Access-Control-Max-Age': '600',
        Vary: 'Origin',
      },
    });
  }
  if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' }, origin);
  const token = bearerToken(req.headers.get('Authorization'));
  if (!token) return json(401, { error: 'NOT_AUTHENTICATED', message: 'Belum login.' }, origin);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'BAD_REQUEST', message: 'Permintaan tidak valid.' }, origin);
  }
  const parsed = parseAction(body);
  if (!parsed.ok) return json(400, { error: 'BAD_REQUEST', message: parsed.error }, origin);

  try {
    const data = await run(token, parsed);
    return json(200, { ok: true, data }, origin);
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.code, message: err.message }, origin);
    console.error(`[partner-admin] ${parsed.value.action}: ${err instanceof Error ? err.message : String(err)}`);
    return json(502, { error: 'UPSTREAM_ERROR', message: 'Terjadi gangguan. Coba lagi.' }, origin);
  }
});
