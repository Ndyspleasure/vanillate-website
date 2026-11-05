// ════════════════════════════════════════════════════════════════════════════
//  🌐 Showcase Server: model murni daftar server pemakai bot di website.
//
//  Daftar DITERBITKAN bot (sambung-kata-bot: src/showcase/) ke tabel CMS
//  `showcase_snapshot` dan disaring RPC publik `showcase_public_list()`
//  (server yang ditinjau tim Vanillate tidak ikut). Website hanya MEMBACA saat
//  build. Semua data dianggap tidak tepercaya (nama server diketik orang luar):
//  di sini divalidasi ulang ketat, lalu di komponen selalu di-escape.
//
//  Sengaja tanpa import dan tanpa import.meta supaya bisa diuji langsung
//  (tests/showcase-model.test.ts). Acuan: docs/SHOWCASE-SERVER.md.
// ════════════════════════════════════════════════════════════════════════════

export interface ShowcaseServer {
  /** ID server Discord. */
  i: string;
  /** Nama server (sudah dibersihkan). */
  n: string;
  /** Hash ikon, null bila tanpa ikon. */
  h: string | null;
  /** Jumlah member, dikasarkan bot. */
  m: number;
  /** Kode undangan permanen terverifikasi (opsional). */
  v?: string;
}

export interface ShowcaseList {
  servers: ShowcaseServer[];
  updatedAt: string | null;
}

export const NAME_MAX = 100;
/** Daftar yang lebih tua dari ini dianggap basi (bot lama mati): seksi disembunyikan. */
export const STALE_MS = 7 * 24 * 60 * 60 * 1000;

const SNOWFLAKE = /^[0-9]{15,22}$/;
const ICON_HASH = /^[a-z0-9_]{1,64}$/i;
const INVITE_CODE = /^[A-Za-z0-9-]{2,32}$/;
// Karakter kontrol, lebar nol, dan penukar arah teks (mirror bot: src/showcase/rules.js).
const UNSAFE_CHARS = /[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

export function sanitizeName(name: unknown): string {
  const s = String(name ?? '').replace(UNSAFE_CHARS, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s.length > NAME_MAX ? `${s.slice(0, NAME_MAX - 1).trimEnd()}…` : s;
}

/** Validasi ketat satu entri; null bila tidak layak. */
export function normalizeServer(raw: unknown): ShowcaseServer | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const i = typeof r.i === 'string' ? r.i : '';
  if (!SNOWFLAKE.test(i)) return null;
  const n = sanitizeName(r.n);
  if (!n) return null;
  const h = typeof r.h === 'string' && ICON_HASH.test(r.h) ? r.h : null;
  const m = Number.isFinite(Number(r.m)) && Number(r.m) > 0 ? Math.floor(Number(r.m)) : 0;
  const out: ShowcaseServer = { i, n, h, m };
  if (typeof r.v === 'string' && INVITE_CODE.test(r.v)) out.v = r.v;
  return out;
}

/** Hasil RPC `showcase_public_list`: { updated_at, servers[] }. Duplikat ID dibuang. */
export function parseList(raw: unknown): ShowcaseList {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const seen = new Set<string>();
  const servers: ShowcaseServer[] = [];
  for (const e of Array.isArray(r.servers) ? r.servers : []) {
    const s = normalizeServer(e);
    if (!s || seen.has(s.i)) continue;
    seen.add(s.i);
    servers.push(s);
  }
  return { servers, updatedAt: typeof r.updated_at === 'string' ? r.updated_at : null };
}

export function isStale(updatedAt: string | null, now = Date.now()): boolean {
  const t = Date.parse(updatedAt ?? '');
  return !Number.isFinite(t) || now - t > STALE_MS;
}

/** URL ikon statis dari CDN Discord (webp, ukuran kecil). Null bila tanpa ikon. */
export function iconUrl(s: Pick<ShowcaseServer, 'i' | 'h'>, size = 64): string | null {
  if (!s.h || !SNOWFLAKE.test(s.i) || !ICON_HASH.test(s.h)) return null;
  const px = [16, 32, 64, 128, 256].includes(size) ? size : 64;
  return `https://cdn.discordapp.com/icons/${s.i}/${s.h}.webp?size=${px}`;
}

export function inviteUrl(s: Pick<ShowcaseServer, 'v'>): string | null {
  return s.v && INVITE_CODE.test(s.v) ? `https://discord.gg/${s.v}` : null;
}

/** Inisial untuk server tanpa ikon: maksimal 2 huruf/angka dari dua kata pertama. */
export function initials(name: string): string {
  const words = sanitizeName(name).split(' ').filter(Boolean);
  const pick = (w: string): string => {
    const ch = Array.from(w).find((c) => /[\p{L}\p{N}]/u.test(c));
    return ch ? ch.toUpperCase() : '';
  };
  const out = words.slice(0, 2).map(pick).join('');
  return out || '?';
}

/** Warna latar fallback dari ID, stabil antar build (hue 0 sampai 359). */
export function hueOf(id: string): number {
  return Number(String(id).slice(-6)) % 360 || 0;
}

/** "120+" / "1,2 rb+" / "2 jt+". Kosong bila tidak diketahui. */
export function formatMembers(m: number): string {
  const n = Math.floor(Number(m));
  if (!Number.isFinite(n) || n <= 0) return '';
  const fmt = (v: number): string => (Math.round(v * 10) / 10).toString().replace('.', ',');
  if (n < 1000) return `${n}+`;
  if (n < 1_000_000) return `${fmt(n / 1000)} rb+`;
  return `${fmt(n / 1_000_000)} jt+`;
}

/** Penghitung "dipakai di N+ server": dibulatkan ke bawah supaya tidak melebih-lebihkan. */
export function countLabel(total: number): string {
  const n = Math.floor(Number(total));
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n < 50) return String(n);
  const step = n >= 1000 ? 100 : 10;
  return `${new Intl.NumberFormat('id-ID').format(Math.floor(n / step) * step)}+`;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (const c of String(seed)) { h ^= c.codePointAt(0)!; h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * Skor prioritas tampil: link Gabung terverifikasi paling berharga (pengunjung
 * bisa langsung bergabung), lalu jumlah member (skala log, maksimal 3 poin untuk
 * 1000 ke atas), lalu ikon (kartu berikon lebih menarik).
 */
export function priorityOf(s: Pick<ShowcaseServer, 'v' | 'm' | 'h'>): number {
  return (s.v ? 3 : 0) + Math.min(3, Math.log10(Math.max(0, s.m) + 1)) + (s.h ? 0.5 : 0);
}

/** Porsi slot sampel yang diisi menurut prioritas; sisanya bergilir untuk server kecil. */
export const PRIORITY_SHARE = 0.7;

/**
 * Sampel untuk HTML hasil build. Sebagian besar slot (PRIORITY_SHARE) diisi server
 * berprioritas tinggi (link Gabung valid, member besar). Sisanya digilir dari
 * seluruh server lain berdasarkan `seed` (mis. tanggal build), jadi server kecil
 * pun bergantian tampil dari hari ke hari. Hasil tetap untuk seed yang sama,
 * sehingga crawler tidak melihat halaman yang berubah tiap kunjungan
 * (pengacakan urutan tampilan dilakukan di browser).
 */
export function pickSample(servers: readonly ShowcaseServer[], n: number, seed: string): ShowcaseServer[] {
  const want = Math.max(0, Math.floor(n));
  const rnd = mulberry32(hashSeed(seed));
  const ranked = [...servers]
    .sort((a, b) => (a.i < b.i ? -1 : a.i > b.i ? 1 : 0))
    .map((s) => ({ s, score: priorityOf(s) + rnd() * 0.6 }))
    .sort((a, b) => b.score - a.score)
    .map((e) => e.s);
  const head = Math.min(ranked.length, Math.ceil(want * PRIORITY_SHARE));
  const rest = ranked.slice(head);
  for (let k = rest.length - 1; k > 0; k -= 1) {
    const j = Math.floor(rnd() * (k + 1));
    [rest[k], rest[j]] = [rest[j], rest[k]];
  }
  return [...ranked.slice(0, head), ...rest.slice(0, Math.max(0, want - head))];
}

export type Layout = 'hidden' | 'static' | 'marquee';

/**
 * Terlalu sedikit server = seksi disembunyikan (terlihat kosong); sedikit =
 * baris statis; cukup = marquee yang bergerak.
 */
export function layoutFor(count: number): Layout {
  if (count < 3) return 'hidden';
  if (count < 8) return 'static';
  return 'marquee';
}

/** Bagi sampel ke beberapa baris bergantian (untuk dinding dua baris). */
export function splitRows<T>(list: readonly T[], rows: number): T[][] {
  const r = Math.max(1, Math.floor(rows));
  const out: T[][] = Array.from({ length: r }, () => []);
  list.forEach((item, idx) => out[idx % r].push(item));
  return out;
}

/** Cari nama (tanpa memperhatikan huruf besar dan aksen), untuk daftar lengkap. */
export function matchesQuery(name: string, query: string): boolean {
  const norm = (v: string): string => v.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
  const q = norm(query).trim();
  return !q || norm(name).includes(q);
}

// ─── Ambil data (build time) ────────────────────────────────────────────────

export interface FetchOptions {
  url?: string;
  anonKey?: string;
  slug: string;
  fetchImpl?: (input: string, init?: Record<string, unknown>) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
  timeoutMs?: number;
  retries?: number;
  onWarn?: (msg: string) => void;
}

/**
 * Panggil RPC publik. Gagal apa pun = daftar kosong (seksi tersembunyi), bukan
 * build gagal: daftar server hanya pelengkap, bukan konten inti.
 */
export async function fetchShowcase(opts: FetchOptions): Promise<ShowcaseList> {
  const empty: ShowcaseList = { servers: [], updatedAt: null };
  const warn = opts.onWarn ?? (() => {});
  if (!opts.url || !opts.anonKey) { warn('Showcase: PUBLIC_SUPABASE_URL/ANON_KEY belum diisi, seksi server dilewati.'); return empty; }
  const f = opts.fetchImpl ?? (globalThis.fetch as unknown as NonNullable<FetchOptions['fetchImpl']>);
  const endpoint = `${opts.url.replace(/\/+$/, '')}/rest/v1/rpc/showcase_public_list`;
  const attempts = 1 + Math.max(0, opts.retries ?? 2);
  for (let k = 0; k < attempts; k += 1) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), opts.timeoutMs ?? 15000) : null;
    try {
      const res = await f(endpoint, {
        method: 'POST',
        headers: { apikey: opts.anonKey, Authorization: `Bearer ${opts.anonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_bot_slug: opts.slug }),
        signal: ctl?.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const list = parseList(await res.json());
      if (isStale(list.updatedAt)) { warn('Showcase: daftar server sudah basi atau belum pernah diterbitkan bot, seksi dilewati.'); return empty; }
      return list;
    } catch (err) {
      warn(`Showcase: percobaan ${k + 1}/${attempts} gagal (${err instanceof Error ? err.message : String(err)}).`);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return empty;
}
