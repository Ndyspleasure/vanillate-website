// ════════════════════════════════════════════════════════════════════════════
//  Vanillate Dashboard — klien browser (login Discord + RPC + Edge Function).
//
//  Keamanan (lihat docs/DASHBOARD-SERVER.md):
//    • Hanya anon key di browser. Semua data lewat RPC security definer yang
//      memeriksa akses guild di server, atau Edge Function dashboard-discord.
//    • Token OAuth Discord dari login dikirim SEKALI ke Edge Function (aksi
//      `link`), lalu sesi di-refresh supaya token itu tidak tertinggal di
//      localStorage.
//    • Sesi memakai storageKey sendiri — tidak bercampur dengan sesi admin
//      (/admin) atau Live Chat (/chat).
// ════════════════════════════════════════════════════════════════════════════

import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { AuditRow, GuildData } from './model';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

export const BOT_SLUG = 'sambung-kata';
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

export function getGuild(guildId: string): Promise<GuildData> {
  return rpc<GuildData>('guild_dashboard_get', { p_guild_id: guildId, p_bot_slug: BOT_SLUG });
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

export function auditList(guildId: string, beforeId: number | null = null, limit = 20): Promise<AuditRow[]> {
  return rpc<AuditRow[]>('guild_config_audit_list', {
    p_guild_id: guildId,
    p_bot_slug: BOT_SLUG,
    p_limit: limit,
    p_before_id: beforeId,
  });
}
