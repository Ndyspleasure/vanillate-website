// ════════════════════════════════════════════════════════════════════════════
//  Edge Function: dashboard-discord
//
//  Satu-satunya bagian Vanillate Dashboard yang berbicara dengan Discord API
//  atas nama user. Tugasnya memverifikasi DI SISI SERVER server Discord mana
//  yang boleh dikelola user (owner / Administrator / Manage Server), lalu
//  mencatatnya di public.guild_dashboard_access. Semua RPC konfigurasi
//  (guild_config_*) hanya mempercayai tabel itu — bukan daftar dari browser.
//
//  Aksi (POST JSON, header Authorization: Bearer <JWT Supabase user>):
//    { "action": "link", "provider_token": "...", "provider_refresh_token"?: "..." }
//        Dipanggil sekali tepat setelah login Discord. Token dicocokkan ke
//        identitas Discord akun Supabase (GET /users/@me), disimpan di
//        guild_dashboard_tokens (tak pernah dikirim balik ke browser), lalu
//        daftar server disegarkan.
//    { "action": "servers", "force"?: true }
//        Daftar server yang boleh dikelola + status bot & konfigurasi.
//        Di-cache 30 detik per user (rate limit Discord).
//    { "action": "logout" }
//        Hapus token Discord & daftar akses server milik user (dipanggil
//        sebelum keluar; lihat Kebijakan Privasi).
//
//  Error: { error: KODE } — NOT_AUTHENTICATED, NO_DISCORD_IDENTITY,
//  TOKEN_MISMATCH, DISCORD_RELOGIN (token hilang/kedaluwarsa → login ulang),
//  RATE_LIMITED, DISCORD_UNAVAILABLE, BAD_REQUEST.
//
//  Env: SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY otomatis tersedia.
//  Opsional: DASHBOARD_BOT_SLUG (default sambung-kata),
//            DASHBOARD_ALLOWED_ORIGINS (koma; default vanillate.id + localhost).
//  Deploy dengan verify_jwt = true. Acuan: docs/DASHBOARD-SERVER.md.
// ════════════════════════════════════════════════════════════════════════════

import {
  allowedOrigin,
  buildServerList,
  discordIdentity,
  DISCORD_TOKEN_TTL_MS,
  GUILD_SYNC_TTL_MS,
  isFresh,
  manageableGuilds,
  type ManageableGuild,
} from './logic.ts';

const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const BOT_SLUG = Deno.env.get('DASHBOARD_BOT_SLUG') ?? 'sambung-kata';
const ORIGINS = (Deno.env.get('DASHBOARD_ALLOWED_ORIGINS') ??
  'https://vanillate.id,https://www.vanillate.id,http://localhost:4321,http://127.0.0.1:4321')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const DISCORD_API = 'https://discord.com/api/v10';

class HttpError extends Error {
  status: number;
  extra: Record<string, unknown>;
  constructor(status: number, code: string, extra: Record<string, unknown> = {}) {
    super(code);
    this.status = status;
    this.extra = extra;
  }
}

// ─── PostgREST (service_role) ────────────────────────────────────────────────

async function rest(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    console.error(`[dashboard-discord] PostgREST ${init.method ?? 'GET'} ${path.split('?')[0]} → ${res.status}`);
    throw new HttpError(500, 'DATABASE_ERROR');
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const inList = (ids: string[]) => `(${ids.map((id) => `"${id}"`).join(',')})`;

// ─── Auth ────────────────────────────────────────────────────────────────────

async function currentUser(req: Request) {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) throw new HttpError(401, 'NOT_AUTHENTICATED');
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) throw new HttpError(401, 'NOT_AUTHENTICATED');
  const user = await res.json();
  const discord = discordIdentity(user);
  if (!user?.id) throw new HttpError(401, 'NOT_AUTHENTICATED');
  if (!discord) throw new HttpError(403, 'NO_DISCORD_IDENTITY');
  return { userId: String(user.id), discord };
}

// ─── Discord ─────────────────────────────────────────────────────────────────

async function discordGet(path: string, token: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${DISCORD_API}${path}`, {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'VanillateDashboard (https://vanillate.id, 1)' },
    });
  } catch {
    throw new HttpError(502, 'DISCORD_UNAVAILABLE');
  }
  if (res.status === 401) throw new HttpError(401, 'DISCORD_RELOGIN');
  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    throw new HttpError(429, 'RATE_LIMITED', { retry_after: Number(body?.retry_after ?? 1) });
  }
  if (!res.ok) throw new HttpError(502, 'DISCORD_UNAVAILABLE');
  return res.json();
}

// ─── Aksi ────────────────────────────────────────────────────────────────────

interface TokenRow {
  user_id: string;
  discord_user_id: string;
  access_token: string;
  expires_at: string | null;
  last_guilds_sync_at: string | null;
}

async function link(userId: string, discordId: string, body: Record<string, unknown>) {
  const token = typeof body.provider_token === 'string' ? body.provider_token.trim() : '';
  if (!token || token.length > 512) throw new HttpError(400, 'BAD_REQUEST');
  const refresh = typeof body.provider_refresh_token === 'string' ? body.provider_refresh_token.slice(0, 512) : null;

  // Token harus milik akun Discord yang sama dengan identitas login Supabase.
  const me = (await discordGet('/users/@me', token)) as { id?: string; username?: string; global_name?: string };
  if (me?.id !== discordId) throw new HttpError(403, 'TOKEN_MISMATCH');

  await rest('guild_dashboard_tokens?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      user_id: userId,
      discord_user_id: discordId,
      discord_username: me.global_name || me.username || null,
      access_token: token,
      refresh_token: refresh,
      expires_at: new Date(Date.now() + DISCORD_TOKEN_TTL_MS).toISOString(),
      last_guilds_sync_at: null,
      updated_at: new Date().toISOString(),
    }),
  });
}

async function loadToken(userId: string, discordId: string): Promise<TokenRow> {
  const rows = (await rest(
    `guild_dashboard_tokens?user_id=eq.${userId}&select=user_id,discord_user_id,access_token,expires_at,last_guilds_sync_at`,
  )) as TokenRow[];
  const row = rows?.[0];
  if (!row || row.discord_user_id !== discordId || (row.expires_at && Date.parse(row.expires_at) < Date.now())) {
    if (row) await forgetToken(userId);
    throw new HttpError(401, 'DISCORD_RELOGIN');
  }
  return row;
}

async function forgetToken(userId: string) {
  await rest(`guild_dashboard_tokens?user_id=eq.${userId}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  }).catch(() => {});
}

async function cachedAccess(userId: string): Promise<ManageableGuild[]> {
  const rows = (await rest(
    `guild_dashboard_access?user_id=eq.${userId}&select=guild_id,guild_name,guild_icon,is_owner,permissions`,
  )) as ManageableGuild[];
  return rows ?? [];
}

async function syncAccess(userId: string, discordId: string, guilds: ManageableGuild[]) {
  const now = new Date().toISOString();
  if (guilds.length) {
    await rest('guild_dashboard_access?on_conflict=user_id,guild_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(guilds.map((g) => ({ ...g, user_id: userId, discord_user_id: discordId, verified_at: now }))),
    });
  }
  // Server yang tidak lagi boleh dikelola langsung kehilangan akses.
  const keep = guilds.map((g) => g.guild_id);
  await rest(
    `guild_dashboard_access?user_id=eq.${userId}${keep.length ? `&guild_id=not.in.${inList(keep)}` : ''}`,
    { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
  );
  await rest(`guild_dashboard_tokens?user_id=eq.${userId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ last_guilds_sync_at: now }),
  });
}

async function servers(userId: string, discordId: string, force: boolean) {
  const token = await loadToken(userId, discordId);
  let guilds: ManageableGuild[];
  let cached = false;

  if (!force && isFresh(token.last_guilds_sync_at, GUILD_SYNC_TTL_MS)) {
    guilds = await cachedAccess(userId);
    cached = true;
  } else {
    try {
      const raw = await discordGet('/users/@me/guilds?limit=200', token.access_token);
      guilds = manageableGuilds(raw);
      await syncAccess(userId, discordId, guilds);
    } catch (err) {
      if (err instanceof HttpError && err.message === 'DISCORD_RELOGIN') await forgetToken(userId);
      // Rate limit sesaat: pakai hasil verifikasi terakhir bila ada.
      if (err instanceof HttpError && err.message === 'RATE_LIMITED') {
        guilds = await cachedAccess(userId);
        if (!guilds.length) throw err;
        cached = true;
      } else {
        throw err;
      }
    }
  }

  const ids = guilds.map((g) => g.guild_id);
  const installed = new Set<string>();
  const configs = new Map<string, { sync_status: string; current_revision: number }>();
  if (ids.length) {
    const bg = (await rest(
      `bot_guilds?bot_slug=eq.${encodeURIComponent(BOT_SLUG)}&is_active=is.true&guild_id=in.${inList(ids)}&select=guild_id`,
    )) as { guild_id: string }[];
    for (const r of bg ?? []) installed.add(r.guild_id);
    const cfg = (await rest(
      `guild_config?bot_slug=eq.${encodeURIComponent(BOT_SLUG)}&guild_id=in.${inList(ids)}&select=guild_id,sync_status,current_revision`,
    )) as { guild_id: string; sync_status: string; current_revision: number }[];
    for (const r of cfg ?? []) configs.set(r.guild_id, r);
  }

  return { servers: buildServerList(guilds, installed, configs), cached, synced_at: new Date().toISOString() };
}

// ─── HTTP ────────────────────────────────────────────────────────────────────

function corsHeaders(req: Request): Record<string, string> {
  const allowed = allowedOrigin(req.headers.get('origin'), ORIGINS);
  return {
    ...(allowed ? { 'Access-Control-Allow-Origin': allowed } : {}),
    // Ikuti header yang diminta preflight (supabase-js bisa menambah header baru).
    'Access-Control-Allow-Headers':
      req.headers.get('access-control-request-headers') ?? 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'BAD_REQUEST' }, 405, cors);

  try {
    const { userId, discord } = await currentUser(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const user = { id: discord.id, name: discord.name, avatar: discord.avatar };

    if (body.action === 'link') {
      await link(userId, discord.id, body);
      return json({ user, ...(await servers(userId, discord.id, true)) }, 200, cors);
    }
    if (body.action === 'logout') {
      await forgetToken(userId);
      await rest(`guild_dashboard_access?user_id=eq.${userId}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      return json({ ok: true }, 200, cors);
    }
    if (body.action === 'servers') {
      return json({ user, ...(await servers(userId, discord.id, body.force === true)) }, 200, cors);
    }
    return json({ error: 'BAD_REQUEST' }, 400, cors);
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message, ...err.extra }, err.status, cors);
    console.error('[dashboard-discord] Error tak terduga:', (err as Error)?.message);
    return json({ error: 'INTERNAL' }, 500, cors);
  }
});
