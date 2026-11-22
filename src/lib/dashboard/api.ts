// ════════════════════════════════════════════════════════════════════════════
//  Vanillate Dashboard — klien browser (login Discord + RPC + Edge Function).
//
//  Keamanan (lihat docs/DASHBOARD-SERVER.md):
//    • Hanya anon key proyek Database Bot di browser. Semua data lewat RPC security definer yang
//      memeriksa akses guild di server, atau Edge Function dashboard-discord.
//    • Token OAuth Discord dari login dikirim SEKALI ke Edge Function (aksi
//      `link`), lalu sesi di-refresh supaya token itu tidak tertinggal di
//      localStorage.
//    • Sesi memakai storageKey sendiri — tidak bercampur dengan sesi admin
//      (/admin) atau Live Chat (/chat).
// ════════════════════════════════════════════════════════════════════════════

import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { AuditRow, GuildData } from './model';
import { withoutRemoved } from './nav-model';
import { BOT_SLUG_WRITE } from '../bot-slug';

// Sejak PLAN-001 /dashboard memakai proyek Supabase "Database Bot" (login
// Discord, RPC guild_* & share_*, Edge Function), BUKAN proyek CMS. Hanya URL +
// anon key (publik); service_role Database Bot tidak pernah ke website.
const SUPABASE_URL = import.meta.env.PUBLIC_BOT_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_BOT_SUPABASE_ANON_KEY as string | undefined;

// Kunci internal bot di Database Bot (guild_*, share_*). Data sudah dimigrasi
// ke `vanillateID`; nilainya mengikuti src/lib/bot-slug.ts.
export const BOT_SLUG = BOT_SLUG_WRITE;
export const isDashboardConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let client: SupabaseClient | null = null;

export function getDashboardSupabase(): SupabaseClient | null {
  if (!isDashboardConfigured) return null;
  client ??= createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: 'vanillate-dashboard-auth',
    },
  });
  return client;
}

/** Error terstruktur: `code` stabil (dipetakan ke teks oleh describeError). */
export class DashboardError extends Error {
  code: string;
  detail: Record<string, unknown> | null;
  constructor(code: string, detail: Record<string, unknown> | null = null) {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}

function parseDetail(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'string' || !raw.trim().startsWith('{')) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function fromPostgrest(error: { message?: string; details?: string; code?: string } | null): DashboardError {
  const message = error?.message ?? '';
  if (/^[A-Z_]{3,40}$/.test(message)) return new DashboardError(message, parseDetail(error?.details));
  // Fungsi atau susunan argumennya belum ada di database (migration belum diterapkan).
  if (error?.code === 'PGRST202') return new DashboardError('RPC_NOT_FOUND');
  if (/fetch|network/i.test(message)) return new DashboardError('NETWORK');
  if (error?.code === 'PGRST301' || /JWT/i.test(message)) return new DashboardError('NOT_AUTHENTICATED');
  return new DashboardError('DATABASE_ERROR');
}

// ─── Login ───────────────────────────────────────────────────────────────────

/** Apakah provider Discord sudah diaktifkan di Supabase Auth. null = tak bisa dicek. */
export async function discordLoginEnabled(): Promise<boolean | null> {
  if (!isDashboardConfigured) return false;
  try {
    const res = await fetch(`${SUPABASE_URL!.replace(/\/+$/, '')}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_ANON_KEY! },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { external?: Record<string, boolean> };
    return Boolean(body.external?.discord);
  } catch {
    return null;
  }
}

/**
 * Mulai login Discord. Scope `guilds` dipakai Edge Function untuk membaca
 * server mana yang boleh dikelola. `silent` meminta Discord melewati layar
 * persetujuan bila user sudah pernah mengizinkan (dipakai saat token habis).
 */
export async function signInWithDiscord(redirectTo: string, silent = false): Promise<void> {
  const supabase = getDashboardSupabase();
  if (!supabase) throw new DashboardError('NOT_CONFIGURED');
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo,
      scopes: 'identify guilds',
      ...(silent ? { queryParams: { prompt: 'none' } } : {}),
    },
  });
  if (error) throw new DashboardError('NETWORK');
}

/** Keluar: hapus token Discord & daftar akses di server dulu, lalu sesi lokal. */
export async function signOut(): Promise<void> {
  const supabase = getDashboardSupabase();
  if (!supabase) return;
  await supabase.functions.invoke('dashboard-discord', { body: { action: 'logout' } }).catch(() => {});
  await supabase.auth.signOut().catch(() => {});
}

export async function getSession(): Promise<Session | null> {
  const supabase = getDashboardSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

// ─── Edge Function: dashboard-discord ────────────────────────────────────────

export interface ServerListItem {
  guildId: string;
  name: string;
  iconUrl: string | null;
  isOwner: boolean;
  manageable: true;
  botInstalled: boolean;
  configured: boolean;
  syncStatus: string | null;
  revision: number | null;
}

export interface ServersResponse {
  user: { id: string; name: string; avatar: string | null };
  servers: ServerListItem[];
  cached: boolean;
  synced_at: string;
}

async function callDiscordFunction(body: Record<string, unknown>): Promise<ServersResponse> {
  const supabase = getDashboardSupabase();
  if (!supabase) throw new DashboardError('NOT_CONFIGURED');
  const { data, error } = await supabase.functions.invoke('dashboard-discord', { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    let payload: Record<string, unknown> | null = null;
    try {
      payload = ctx && typeof ctx.json === 'function' ? await ctx.json() : null;
    } catch {
      payload = null;
    }
    const code = typeof payload?.error === 'string' ? payload.error : ctx ? 'DATABASE_ERROR' : 'NETWORK';
    throw new DashboardError(code, payload);
  }
  return data as ServersResponse;
}

/**
 * Bila sesi baru saja dibuat lewat login Discord, serahkan token OAuth-nya ke
 * Edge Function (sekali), lalu segarkan sesi agar token itu hilang dari
 * penyimpanan browser. Mengembalikan daftar server bila link terjadi.
 */
export async function linkDiscordIfNeeded(session: Session | null): Promise<ServersResponse | null> {
  if (!session?.provider_token) return null;
  const res = await callDiscordFunction({
    action: 'link',
    provider_token: session.provider_token,
    provider_refresh_token: session.provider_refresh_token ?? undefined,
  });
  await getDashboardSupabase()?.auth.refreshSession().catch(() => {});
  return res;
}

export function fetchServers(force = false): Promise<ServersResponse> {
  return callDiscordFunction({ action: 'servers', force });
}

// ─── RPC (dengan verifikasi ulang akses otomatis) ────────────────────────────

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const supabase = getDashboardSupabase();
  if (!supabase) throw new DashboardError('NOT_CONFIGURED');

  const run = async () => {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw fromPostgrest(error);
    return data as T;
  };

  try {
    return await run();
  } catch (err) {
    // Verifikasi akses berumur 15 menit: segarkan dari Discord lalu ulangi sekali.
    if (err instanceof DashboardError && (err.code === 'ACCESS_STALE' || err.code === 'ACCESS_DENIED')) {
      await fetchServers(true);
      return run();
    }
    throw err;
  }
}

// ─── guild_dashboard_get: mode hemat (migration 0029 di repo bot) ────────────
// Overload empat argumen mengembalikan `version` dan `registry_version`:
//   • registry (sekitar 47 KB) tidak dikirim ulang bila versinya sama;
//   • p_fields 'status' hanya mengembalikan penanda perubahan (sekitar 150 byte).
// Database yang belum punya overload itu menjawab PGRST202; klien lalu memakai
// fungsi dua argumen seperti dulu dan mengingatnya selama LIGHT_RETRY_MS.

const LIGHT_KEY = 'vn-dash-light-off';
const LIGHT_RETRY_MS = 6 * 60 * 60 * 1000;

type LightGuildData = Omit<GuildData, 'registry'> & { registry: GuildData['registry'] | null; version?: string; registry_version?: string };

function lightDisabled(): boolean {
  try {
    return Date.now() - Number(sessionStorage.getItem(LIGHT_KEY) ?? 0) < LIGHT_RETRY_MS;
  } catch {
    return false;
  }
}

function disableLight(): void {
  lightOff = true;
  try {
    sessionStorage.setItem(LIGHT_KEY, String(Date.now()));
  } catch {
    /* penyimpanan diblokir: hanya berlaku sampai halaman ditutup */
  }
}

let lightOff: boolean | null = null;
// Registry sama untuk semua server, jadi disimpan sekali; `version` per server.
let registryCache: { version: string; registry: GuildData['registry'] } | null = null;
const guildVersion = new Map<string, string>();

/** Hasil penuh. Registry diambil dari memori halaman bila versinya masih sama. */
export async function getGuild(guildId: string): Promise<GuildData> {
  return bersihkan(await getGuildMentah(guildId));
}

/** Buang bagian registry yang sudah dicabut dari dashboard (lihat REMOVED_SECTIONS). */
function bersihkan(g: GuildData): GuildData {
  return Array.isArray(g.registry) ? { ...g, registry: withoutRemoved(g.registry) } : g;
}

async function getGuildMentah(guildId: string): Promise<GuildData> {
  lightOff ??= lightDisabled();
  if (!lightOff) {
    try {
      const r = await rpc<LightGuildData>('guild_dashboard_get', {
        p_guild_id: guildId,
        p_bot_slug: BOT_SLUG,
        p_registry_version: registryCache?.version ?? null,
        p_fields: 'full',
      });
      const registry = r.registry ?? (registryCache && registryCache.version === r.registry_version ? registryCache.registry : null);
      if (registry && r.version && r.registry_version) {
        registryCache = { version: r.registry_version, registry };
        guildVersion.set(guildId, r.version);
        return { ...r, registry };
      }
      // Bentuk tak terduga (mis. registry null tanpa salinan lokal): pakai cara lama.
      registryCache = null;
      guildVersion.delete(guildId);
    } catch (err) {
      if (!(err instanceof DashboardError) || err.code !== 'RPC_NOT_FOUND') throw err;
      disableLight();
    }
  }
  return rpc<GuildData>('guild_dashboard_get', { p_guild_id: guildId, p_bot_slug: BOT_SLUG });
}

/**
 * Untuk poll: null bila tidak ada yang berubah sejak hasil penuh terakhir
 * (hanya penanda kecil yang diunduh), selain itu hasil penuh terbaru.
 */
export async function getGuildIfChanged(guildId: string): Promise<GuildData | null> {
  const g = await getGuildIfChangedMentah(guildId);
  return g ? bersihkan(g) : null;
}

async function getGuildIfChangedMentah(guildId: string): Promise<GuildData | null> {
  const known = guildVersion.get(guildId);
  if (lightOff || !known || !registryCache) return getGuildMentah(guildId);
  try {
    const s = await rpc<{ version?: string }>('guild_dashboard_get', {
      p_guild_id: guildId,
      p_bot_slug: BOT_SLUG,
      p_registry_version: registryCache.version,
      p_fields: 'status',
    });
    if (s.version && s.version === known) return null;
  } catch (err) {
    if (!(err instanceof DashboardError) || err.code !== 'RPC_NOT_FOUND') throw err;
    disableLight();
  }
  return getGuildMentah(guildId);
}

export interface SaveResult {
  ok: boolean;
  changed: boolean;
  revision: number;
  sync_status: string;
  warnings: unknown[];
}

export function saveConfig(
  guildId: string,
  revision: number,
  payload: { features: Record<string, unknown>; channels: unknown[] },
): Promise<SaveResult> {
  return rpc<SaveResult>('guild_config_save', {
    p_guild_id: guildId,
    p_revision: revision,
    p_features: payload.features,
    p_channels: payload.channels,
    p_bot_slug: BOT_SLUG,
  });
}

export function requestResync(guildId: string): Promise<{ ok: boolean; bot_online: boolean }> {
  return rpc('guild_config_request_resync', { p_guild_id: guildId, p_bot_slug: BOT_SLUG });
}

export function requestDiscordRefresh(guildId: string): Promise<{ ok: boolean; bot_online: boolean }> {
  return rpc('guild_dashboard_request_refresh', { p_guild_id: guildId, p_bot_slug: BOT_SLUG });
}

// Riwayat (migration 0030 di repo bot): overload enam argumen menyaring jenis
// aksi di server dan menandai catatan yang menyimpan isi revisi (`has_state`).
// Database lama menjawab PGRST202; klien lalu memakai fungsi empat argumen.
let auditV2: boolean | null = null;

/** Saringan jenis dan "Pulihkan ke revisi ini" tersedia? null = belum diketahui. */
export const auditV2Supported = (): boolean | null => auditV2;

export async function auditList(guildId: string, beforeId: number | null = null, limit = 20, prefix: 'config.' | 'sync.' | null = null): Promise<AuditRow[]> {
  if (auditV2 !== false) {
    try {
      const rows = await rpc<AuditRow[]>('guild_config_audit_list', {
        p_guild_id: guildId,
        p_bot_slug: BOT_SLUG,
        p_limit: limit,
        p_before_id: beforeId,
        p_action_prefix: prefix,
        p_state_id: null,
      });
      auditV2 = true;
      return rows;
    } catch (err) {
      if (!(err instanceof DashboardError) || err.code !== 'RPC_NOT_FOUND') throw err;
      auditV2 = false;
    }
  }
  return rpc<AuditRow[]>('guild_config_audit_list', {
    p_guild_id: guildId,
    p_bot_slug: BOT_SLUG,
    p_limit: limit,
    p_before_id: beforeId,
  });
}

/** Isi pengaturan sesudah satu catatan Riwayat (null bila tidak disimpan lagi). */
export async function auditState(guildId: string, auditId: number): Promise<{ revision: number; state: GuildData['state'] | null } | null> {
  return rpc('guild_config_audit_list', {
    p_guild_id: guildId,
    p_bot_slug: BOT_SLUG,
    p_limit: 1,
    p_before_id: null,
    p_action_prefix: null,
    p_state_id: auditId,
  });
}

// ─── 📣 Share Server (status dari bot + antrean permintaan) ──────────────────

export function getShare(guildId: string): Promise<import('./share-model').ShareDashboard> {
  return rpc('share_dashboard_get', { p_guild_id: guildId, p_bot_slug: BOT_SLUG });
}

export function submitShareRequest(
  guildId: string,
  type: string,
  payload: Record<string, unknown> = {},
): Promise<{ ok: boolean; id: number }> {
  return rpc('share_request_submit', { p_guild_id: guildId, p_bot_slug: BOT_SLUG, p_type: type, p_payload: payload });
}
