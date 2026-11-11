// ════════════════════════════════════════════════════════════════════════════
//  partner-admin — logika murni (tanpa Deno/jaringan) supaya bisa diuji Node:
//  `node --experimental-strip-types --test tests/partner-admin.test.ts`.
//  Hanya sintaks TypeScript yang bisa di-strip (tanpa enum/namespace).
// ════════════════════════════════════════════════════════════════════════════

export const EMAIL_DOMAIN = 'partner.vanillate.id';

const USERNAME = /^[a-z0-9][a-z0-9_.-]{2,31}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Email sintetis (tidak pernah dikirimi surat) untuk Supabase Auth. */
export function emailFor(username: string): string {
  return `${username}@${EMAIL_DOMAIN}`;
}

export function normalizeUsername(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

export function validUsername(username: string): boolean {
  return USERNAME.test(username) && !/[._-]{2}/.test(username) && !/[._-]$/.test(username);
}

/** Pesan galat password, atau null bila sah. */
export function passwordProblem(password: unknown, username: string): string | null {
  if (typeof password !== 'string') return 'Password wajib diisi.';
  if (password.length < 8) return 'Password minimal 8 karakter.';
  if (password.length > 72) return 'Password maksimal 72 karakter.';
  if (/^\d+$/.test(password)) return 'Password tidak boleh hanya angka.';
  if (password.toLowerCase().includes(username) && username.length >= 3) {
    return 'Password tidak boleh memuat username.';
  }
  return null;
}

export function validDisplayName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.replace(/\s+/g, ' ').trim();
  return s.length >= 1 && s.length <= 80 ? s : null;
}

export type Action =
  | { action: 'create'; username: string; displayName: string; password: string }
  | { action: 'reset'; id: string; password: string }
  | { action: 'delete'; id: string }
  | { action: 'change'; currentPassword: string; username: string; password: string };

export type Parsed = { ok: true; value: Action } | { ok: false; error: string };

/** Validasi bentuk permintaan. Aturan peran/kepemilikan diperiksa di index.ts. */
export function parseAction(body: unknown): Parsed {
  const b = (body ?? {}) as Record<string, unknown>;
  switch (b.action) {
    case 'create': {
      const username = normalizeUsername(b.username);
      if (!validUsername(username)) {
        return { ok: false, error: 'Username 3 sampai 32 karakter: huruf kecil, angka, titik, garis bawah, atau strip.' };
      }
      const displayName = validDisplayName(b.displayName);
      if (!displayName) return { ok: false, error: 'Nama partner wajib diisi (maks. 80 karakter).' };
      const problem = passwordProblem(b.password, username);
      if (problem) return { ok: false, error: problem };
      return { ok: true, value: { action: 'create', username, displayName, password: b.password as string } };
    }
    case 'reset': {
      if (typeof b.id !== 'string' || !UUID.test(b.id)) return { ok: false, error: 'ID akun tidak valid.' };
      const problem = passwordProblem(b.password, '');
      if (problem) return { ok: false, error: problem };
      return { ok: true, value: { action: 'reset', id: b.id, password: b.password as string } };
    }
    case 'delete': {
      if (typeof b.id !== 'string' || !UUID.test(b.id)) return { ok: false, error: 'ID akun tidak valid.' };
      return { ok: true, value: { action: 'delete', id: b.id } };
    }
    case 'change': {
      const username = normalizeUsername(b.username);
      if (!validUsername(username)) {
        return { ok: false, error: 'Username 3 sampai 32 karakter: huruf kecil, angka, titik, garis bawah, atau strip.' };
      }
      if (typeof b.currentPassword !== 'string' || !b.currentPassword) {
        return { ok: false, error: 'Password saat ini wajib diisi.' };
      }
      const problem = passwordProblem(b.password, username);
      if (problem) return { ok: false, error: problem };
      if (b.password === b.currentPassword) return { ok: false, error: 'Password baru harus berbeda dari yang lama.' };
      return {
        ok: true,
        value: { action: 'change', currentPassword: b.currentPassword, username, password: b.password as string },
      };
    }
    default:
      return { ok: false, error: 'Aksi tidak dikenal.' };
  }
}

/** Token dari header `Authorization: Bearer ...`, atau null. */
export function bearerToken(header: string | null | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+([A-Za-z0-9._~+/=-]{20,4096})$/.exec(header.trim());
  return m ? m[1] : null;
}

/** Origin yang boleh memanggil dari browser, atau null. */
export function allowedOrigin(origin: string | null | undefined, list: string[]): string | null {
  return origin && list.includes(origin) ? origin : null;
}

/** Batas percobaan ganti kredensial per akun (anti tebak password lama). */
export function createAttemptLimiter(max: number, windowMs: number, now: () => number = Date.now) {
  const map = new Map<string, number[]>();
  return {
    /** Catat satu percobaan; false bila sudah melewati batas. */
    hit(key: string): boolean {
      const t = now();
      const list = (map.get(key) ?? []).filter((x) => t - x < windowMs);
      if (list.length >= max) {
        map.set(key, list);
        return false;
      }
      list.push(t);
      map.set(key, list);
      if (map.size > 500) map.delete(map.keys().next().value as string);
      return true;
    },
  };
}
