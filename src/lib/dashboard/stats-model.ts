// ════════════════════════════════════════════════════════════════════════════
// Dashboard › Ringkasan Statistik (model murni, tanpa DOM)
//
// Bot menerbitkan `snapshot.stats_summary` (angka agregat, tanpa ID/nama
// pemain) hanya saat refresh diminta. Website membacanya lewat
// guild_dashboard_get yang sudah ada (tanpa RPC baru). Bentuk & aturan bot:
// docs/dashboard-sync.md §5a di repo sambung-kata-bot.
//
// Parser sengaja defensif: bot bisa lebih baru atau lebih lama dari website.
// Bentuk yang salah → null (tampil "belum tersedia"), angka dipaksa bilangan
// bulat >= 0, teks penjelasan dipotong. Teks dari bot WAJIB lewat esc() saat
// dirender. Alasan terkunci berasal dari bot, bukan karangan website.
// ════════════════════════════════════════════════════════════════════════════

export interface StatsDay {
  day: string; // YYYY-MM-DD (WIB)
  n: number;
}

export interface StatsSummary {
  updated_at: string | null;
  members: { total: number | null; history: StatsDay[] | null; history_note: string | null };
  join_leave: { available: boolean; locked_note: string | null };
  /** null = Leveling belum aktif. */
  activity: {
    ever: number;
    active_1d: number;
    active_7d: number;
    active_30d: number;
    chat_xp: number;
    voice_xp: number;
    chat_pct: number | null;
  } | null;
  /** null = Verification belum aktif. */
  verification: { days: StatsDay[]; total7: number } | null;
  community: {
    /** null = channel Streak Harian belum diatur. */
    streak: { today: number; best: number } | null;
    /** null = channel Counting belum diatur. */
    counting: { record: number } | null;
  };
}

/** Ringkasan lebih tua dari ini → Ringkasan meminta bot menghitung ulang saat dibuka. */
export const STATS_STALE_MS = 15 * 60 * 1000;
const NOTE_MAX = 400;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const note = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, NOTE_MAX) : null);

function parseDays(v: unknown, max: number): StatsDay[] | null {
  if (!Array.isArray(v)) return null;
  const out: StatsDay[] = [];
  for (const e of v) {
    // Riwayat member: [hari, n]; verifikasi: {day, n}.
    if (Array.isArray(e) && typeof e[0] === 'string' && DAY_RE.test(e[0])) out.push({ day: e[0], n: num(e[1]) });
    else if (isObj(e) && typeof e.day === 'string' && DAY_RE.test(e.day)) out.push({ day: e.day, n: num(e.n) });
  }
  return out.slice(-max);
}

/** Baca ringkasan dari bot dengan aman. null/absen/versi tak dikenal → null. */
export function parseStatsSummary(raw: unknown): StatsSummary | null {
  if (!isObj(raw) || raw.v !== 1) return null;
  const m = isObj(raw.members) ? raw.members : {};
  const jl = isObj(raw.join_leave) ? raw.join_leave : {};
  const a = isObj(raw.activity) ? raw.activity : null;
  const v = isObj(raw.verification) ? raw.verification : null;
  const c = isObj(raw.community) ? raw.community : {};
  const st = isObj(c.streak) ? c.streak : null;
  const co = isObj(c.counting) ? c.counting : null;
  const history = parseDays(m.history, 90);
  const days = v ? parseDays(v.days, 7) : null;
  return {
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : null,
    members: {
      total: typeof m.total === 'number' && Number.isFinite(m.total) && m.total >= 0 ? Math.floor(m.total) : null,
      history: history && history.length >= 2 ? history : null,
      history_note: note(m.history_note),
    },
    join_leave: { available: jl.available === true, locked_note: note(jl.locked_note) },
    activity: a
      ? {
          ever: num(a.ever),
          active_1d: num(a.active_1d),
          active_7d: num(a.active_7d),
          active_30d: num(a.active_30d),
          chat_xp: num(a.chat_xp),
          voice_xp: num(a.voice_xp),
          chat_pct: typeof a.chat_pct === 'number' && Number.isFinite(a.chat_pct) ? Math.min(100, Math.max(0, Math.round(a.chat_pct))) : null,
        }
      : null,
    verification: v && days ? { days, total7: num(v.total7) } : null,
    community: {
      streak: st ? { today: num(st.today), best: num(st.best) } : null,
      counting: co ? { record: num(co.record) } : null,
    },
  };
}

/** Ringkasan kosong/basi? (dipakai untuk meminta bot menghitung ulang, jam server). */
export function isStatsStale(stats: StatsSummary | null, now = Date.now()): boolean {
  if (!stats?.updated_at) return true;
  const t = Date.parse(stats.updated_at);
  return !Number.isFinite(t) || now - t > STATS_STALE_MS;
}

/** Persentase 0..100 (dibulatkan); pembagi tak dikenal → null. */
export function percentOf(part: number, whole: number | null): number | null {
  if (whole == null || whole <= 0) return null;
  return Math.min(100, Math.round((part / whole) * 100));
}

export interface Growth {
  first: number;
  last: number;
  delta: number;
  /** Perubahan relatif dalam persen, satu desimal; null bila awal 0. */
  pct: number | null;
  line: string;
  area: string;
}

/** Path SVG (viewBox 0 0 600 150) untuk grafik pertumbuhan, atau null bila titik kurang. */
export function growthOf(history: StatsDay[] | null): Growth | null {
  if (!history || history.length < 2) return null;
  const vals = history.map((h) => h.n);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const xy = vals.map((v, i) => [Math.round(((i * 600) / (vals.length - 1)) * 10) / 10, Math.round((135 - ((v - min) / span) * 115) * 10) / 10]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  const first = vals[0];
  const last = vals[vals.length - 1];
  return {
    first,
    last,
    delta: last - first,
    pct: first > 0 ? Math.round(((last - first) / first) * 1000) / 10 : null,
    line,
    area: `${line} L600 150 L0 150 Z`,
  };
}

const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/** Singkatan hari dari kunci hari WIB (YYYY-MM-DD), mis. "Sen". */
export function dayLabel(day: string): string {
  if (!DAY_RE.test(day)) return '';
  return HARI[new Date(`${day}T00:00:00Z`).getUTCDay()];
}

const ID = new Intl.NumberFormat('id-ID');
export const formatCount = (n: number): string => ID.format(n);
export const formatPercent = (p: number): string => `${String(p).replace('.', ',')}%`;
