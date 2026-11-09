// ════════════════════════════════════════════════════════════════════════════
//  cms-read — logika murni (tanpa Deno/jaringan) supaya bisa diuji dengan Node:
//  `node --experimental-strip-types --test tests/cms-read.test.ts`.
//  Hanya sintaks TypeScript yang bisa di-strip (tanpa enum/namespace).
// ════════════════════════════════════════════════════════════════════════════

/** Tampilan yang boleh diminta. Tiap tampilan dipetakan ke satu fungsi baca agregat. */
export const RPC_BY_VIEW = {
  serverhub: 'cms_read_serverhub',
} as const;

export type View = keyof typeof RPC_BY_VIEW;

/** Umur cache hasil per tampilan (ms). Hemat query: satu panggilan melayani semua admin. */
export const CACHE_TTL_MS: Record<View, number> = {
  serverhub: 60_000,
};

/** Peran CMS yang boleh membaca (viewer memang hanya baca). */
export const READ_ROLES = ['owner', 'admin', 'viewer'] as const;

export function isView(value: unknown): value is View {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(RPC_BY_VIEW, value);
}

export function roleAllowed(role: unknown): boolean {
  return typeof role === 'string' && (READ_ROLES as readonly string[]).includes(role);
}

/** Token dari header `Authorization: Bearer ...`, atau null. */
export function bearerToken(header: string | null | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+([A-Za-z0-9._~+/=-]{20,4096})$/.exec(header.trim());
  return m ? m[1] : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Klaim `sub` dari payload JWT, TANPA memverifikasi tanda tangan. Aman hanya
 * karena token tetap dikirim ke PostgREST proyek CMS yang memverifikasinya
 * (token palsu ditolak di sana); `sub` dipakai hanya untuk menyaring baris.
 */
export function jwtSub(token: string): string | null {
  const bagian = token.split('.');
  if (bagian.length !== 3) return null;
  try {
    const b64 = bagian[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='));
    const sub = (JSON.parse(json) as { sub?: unknown }).sub;
    return typeof sub === 'string' && UUID.test(sub) ? sub : null;
  } catch {
    return null;
  }
}

/** Origin yang boleh memanggil dari browser, atau null. */
export function allowedOrigin(origin: string | null | undefined, list: string[]): string | null {
  return origin && list.includes(origin) ? origin : null;
}

export interface TtlCache<T> {
  get(key: string): T | null;
  set(key: string, value: T, ttlMs: number): void;
  size(): number;
}

/** Cache memori sederhana dengan TTL dan batas jumlah entri (entri tertua dibuang). */
export function createTtlCache<T>(opts: { max?: number; now?: () => number } = {}): TtlCache<T> {
  const max = opts.max ?? 200;
  const now = opts.now ?? Date.now;
  const map = new Map<string, { value: T; until: number }>();
  return {
    get(key) {
      const e = map.get(key);
      if (!e) return null;
      if (e.until <= now()) {
        map.delete(key);
        return null;
      }
      return e.value;
    },
    set(key, value, ttlMs) {
      map.delete(key);
      map.set(key, { value, until: now() + ttlMs });
      while (map.size > max) {
        const tertua = map.keys().next().value;
        if (tertua === undefined) break;
        map.delete(tertua);
      }
    },
    size: () => map.size,
  };
}
