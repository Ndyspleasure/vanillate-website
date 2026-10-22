// ════════════════════════════════════════════════════════════════════════════
//  Logika murni Edge Function topgg-webhook (diuji tests/topgg-webhook.test.ts).
//  Hanya Web Crypto & JSON — berjalan sama di Deno (Supabase) dan Node (tes).
//
//  Top.gg webhook v1 (docs.top.gg/webhooks): header
//    x-topgg-signature: t=<unix detik>,v1=<HMAC-SHA256(secret, "<t>.<raw body>")>
//  event `vote.create` { data: { id, created_at, expires_at, weight, query,
//  user: { id, platform_id (= Discord ID) } } } dan `webhook.test`.
//  Webhook lama (legacy) juga diterima: header Authorization = secret,
//  body { bot, user, type: 'upvote'|'test', query }.
// ════════════════════════════════════════════════════════════════════════════

export const TOLERANCE_SEC = 5 * 60;
const SNOWFLAKE = /^[0-9]{15,22}$/;

export function parseSignatureHeader(header: string | null | undefined): { t: number; v1: string } | null {
  if (!header || header.length > 512) return null;
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const i = p.indexOf('=');
      return i > 0 ? [p.slice(0, i).trim(), p.slice(i + 1).trim()] : ['', ''];
    }),
  );
  const t = Number(parts.t);
  if (!Number.isInteger(t) || t <= 0 || !parts.v1) return null;
  return { t, v1: parts.v1 };
}

/** Bandingkan dua string tanpa bocor waktu (panjang beda → false). */
export function safeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function toBase64(buf: ArrayBuffer): string {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s);
}

export async function hmacSha256(secret: string, message: string): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', key, enc.encode(message));
}

/** Verifikasi x-topgg-signature (+ jendela waktu anti-replay). */
export async function verifySignature(
  secret: string, header: string | null, rawBody: string, nowSec = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!secret) return false;
  const sig = parseSignatureHeader(header);
  if (!sig) return false;
  if (Math.abs(nowSec - sig.t) > TOLERANCE_SEC) return false;
  const mac = await hmacSha256(secret, `${sig.t}.${rawBody}`);
  return safeEqual(sig.v1.toLowerCase(), toHex(mac)) || safeEqual(sig.v1, toBase64(mac));
}

/** Webhook lama: header Authorization berisi secret apa adanya. */
export function verifyLegacy(secret: string, authorization: string | null): boolean {
  if (!secret || !authorization) return false;
  return safeEqual(authorization.trim(), secret);
}

export type ParsedEvent =
  | { kind: 'vote'; eventKey: string; discordUserId: string; votedAt: string; weight: number | null; query: unknown }
  | { kind: 'test' }
  | { kind: 'ignore'; reason: string };

function queryOf(q: unknown): unknown {
  if (q && typeof q === 'object') return q;
  if (typeof q === 'string' && q) {
    const s = q.startsWith('?') ? q.slice(1) : q;
    return Object.fromEntries(new URLSearchParams(s));
  }
  return null;
}

/** Baca body webhook (v1 atau legacy). */
export function parseEvent(body: unknown, receivedAt = new Date()): ParsedEvent {
  const b = (body ?? {}) as Record<string, any>;
  if (b.type === 'webhook.test' || b.type === 'test') return { kind: 'test' };
  if (b.type === 'vote.create') {
    const d = (b.data ?? {}) as Record<string, any>;
    const uid = String(d.user?.platform_id ?? '');
    if (!SNOWFLAKE.test(uid)) return { kind: 'ignore', reason: 'no_discord_id' };
    const at = Date.parse(d.created_at ?? '');
    const votedAt = Number.isFinite(at) ? new Date(at).toISOString() : receivedAt.toISOString();
    const id = d.id != null ? String(d.id) : null;
    return {
      kind: 'vote',
      eventKey: id ? `topgg:${id}` : `webhook:${uid}:${Math.floor(Date.parse(votedAt) / 60000)}`,
      discordUserId: uid,
      votedAt,
      weight: Number.isFinite(Number(d.weight)) ? Number(d.weight) : null,
      query: queryOf(d.query),
    };
  }
  if (b.type === 'upvote') {
    const uid = String(b.user ?? '');
    if (!SNOWFLAKE.test(uid)) return { kind: 'ignore', reason: 'no_discord_id' };
    return {
      kind: 'vote',
      eventKey: `legacy:${uid}:${Math.floor(receivedAt.getTime() / 60000)}`,
      discordUserId: uid,
      votedAt: receivedAt.toISOString(),
      weight: b.isWeekend ? 2 : 1,
      query: queryOf(b.query),
    };
  }
  return { kind: 'ignore', reason: 'unknown_type' };
}
