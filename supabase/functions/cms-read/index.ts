// ════════════════════════════════════════════════════════════════════════════
//  Edge Function: cms-read  (proyek Supabase "Database Bot")
//
//  Jalur BACA SESUAI PERMINTAAN untuk halaman CMS admin (keputusan pemilik
//  2026-11-09, CLAUDE.md "Pengecualian kedua"). Menggantikan snapshot yang
//  didorong bot terus-menerus: data hanya dihitung saat admin membuka halaman.
//
//  Alur (POST JSON, header Authorization: Bearer <access token admin CMS>):
//    1. Token diperiksa di proyek CMS: PostgREST CMS memverifikasi tanda
//       tangannya, dan baris `admin_users` milik pemilik token harus ada
//       (peran owner, admin, atau viewer). Hasil peran di-cache 60 detik.
//    2. { "view": "serverhub" } → fungsi baca agregat `cms_read_<view>()`
//       dipanggil dengan service_role (hanya di fungsi ini, tidak pernah di
//       browser). Hasil di-cache 60 detik, satu panggilan melayani semua admin.
//
//  Hanya baca, hanya angka agregat. Aksi tetap lewat bot_commands.
//  Error: { error: KODE } — NOT_AUTHENTICATED (401), FORBIDDEN (403),
//  BAD_REQUEST (400), METHOD_NOT_ALLOWED (405), UPSTREAM_ERROR (502).
//
//  Env: SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY otomatis tersedia (proyek
//  Database Bot). Opsional: CMS_SUPABASE_URL, CMS_SUPABASE_ANON_KEY (bawaan
//  nilai publik proyek CMS), CMS_READ_ALLOWED_ORIGINS (koma).
//  Deploy dengan verify_jwt = FALSE: token CMS ditandatangani proyek lain, jadi
//  gerbang JWT proyek ini tidak berlaku; verifikasi dilakukan di langkah 1.
//  Acuan: docs/CMS-BACA-DATABASE-BOT.md.
// ════════════════════════════════════════════════════════════════════════════

import {
  allowedOrigin,
  bearerToken,
  CACHE_TTL_MS,
  createTtlCache,
  isView,
  jwtSub,
  roleAllowed,
  RPC_BY_VIEW,
} from './logic.ts';

const DB_URL = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
// URL dan kunci publishable proyek CMS adalah nilai PUBLIK (sudah ada di bundle
// website), jadi boleh jadi bawaan di sini; env hanya untuk menimpa.
const CMS_URL = (Deno.env.get('CMS_SUPABASE_URL') ?? 'https://lvfwopnvvqncopvathop.supabase.co').replace(/\/+$/, '');
const CMS_ANON = Deno.env.get('CMS_SUPABASE_ANON_KEY') ?? 'sb_publishable_WwkZl-Bl7xR8-i0ZfS59aw_Z-N1BoLM';
const ORIGINS = (Deno.env.get('CMS_READ_ALLOWED_ORIGINS') ??
  'https://vanillate.id,https://www.vanillate.id,http://localhost:4321,http://127.0.0.1:4321')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const ROLE_TTL_MS = 60_000;
const roleCache = createTtlCache<string>({ max: 100 });
const dataCache = createTtlCache<unknown>({ max: 20 });

function json(status: number, body: unknown, origin: string | null, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, max-age=30',
      Vary: 'Origin',
      ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
      ...extra,
    },
  });
}

/** Peran admin CMS pemilik token, atau null (token palsu/kedaluwarsa atau bukan admin). */
async function cmsRole(token: string): Promise<string | null> {
  const hit = roleCache.get(token);
  if (hit) return hit;
  const sub = jwtSub(token);
  if (!sub) return null;
  // PostgREST CMS memverifikasi token; RLS membatasi baris ke milik sendiri
  // (owner bisa melihat semua, karena itu difilter id = sub).
  const res = await fetch(`${CMS_URL}/rest/v1/admin_users?select=role&id=eq.${sub}&limit=1`, {
    headers: { apikey: CMS_ANON, Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new Error(`CMS ${res.status}`);
  const rows = (await res.json()) as { role?: string }[];
  const role = rows?.[0]?.role;
  if (!roleAllowed(role)) return null;
  roleCache.set(token, role as string, ROLE_TTL_MS);
  return role as string;
}

async function callRpc(fn: string): Promise<unknown> {
  const res = await fetch(`${DB_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) throw new Error(`RPC ${fn} ${res.status}`);
  return res.json();
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
  if (!token) return json(401, { error: 'NOT_AUTHENTICATED' }, origin);

  let body: { view?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'BAD_REQUEST' }, origin);
  }
  if (!isView(body?.view)) return json(400, { error: 'BAD_REQUEST' }, origin);
  const view = body.view;

  try {
    const role = await cmsRole(token);
    if (!role) return json(403, { error: 'FORBIDDEN' }, origin);

    const cached = dataCache.get(view);
    if (cached) return json(200, { ok: true, view, data: cached, cached: true }, origin, { 'X-Cache': 'HIT' });

    const data = await callRpc(RPC_BY_VIEW[view]);
    dataCache.set(view, data, CACHE_TTL_MS[view]);
    return json(200, { ok: true, view, data, cached: false }, origin, { 'X-Cache': 'MISS' });
  } catch (err) {
    console.error(`[cms-read] ${view}: ${err instanceof Error ? err.message : String(err)}`);
    return json(502, { error: 'UPSTREAM_ERROR' }, origin);
  }
});
