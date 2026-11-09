// ════════════════════════════════════════════════════════════════════════════
//  Server Hub (CMS): model murni untuk hasil Edge Function `cms-read`
//  (view `serverhub`, fungsi `cms_read_serverhub()` di Database Bot).
//
//  Hanya angka agregat. Parser defensif: bentuk tak dikenal tidak pernah
//  melempar, angka yang tidak sah menjadi 0. Dites di tests/cms-read-model.test.ts.
// ════════════════════════════════════════════════════════════════════════════

export interface FeatureCount {
  servers_configured: number;
  servers_on: number;
}

export interface ServerHub {
  generatedAt: number;
  verification: FeatureCount & { servers_incomplete: number; members_verified: number };
  leveling: FeatureCount & {
    chat_on: number;
    voice_on: number;
    combined_on: number;
    without_levelup_channel: number;
    users_tracked: number;
    rewards_total: number;
  };
  autorole: FeatureCount;
  welcome: FeatureCount & { with_welcome_channel: number; with_goodbye_channel: number };
  security: FeatureCount & {
    rejoin_alert_on: number;
    actions_total: number;
    by_action: Record<string, number>;
    by_status: Record<string, number>;
  };
}

export interface Perhatian {
  tone: 'warn' | 'info';
  text: string;
}

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Angka tak negatif; selain itu 0. Hasil `count(*)` bisa datang sebagai string. */
export function num(v: unknown): number {
  const n = typeof v === 'string' && /^\d{1,15}$/.test(v) ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function peta(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(obj(v))) {
    if (/^[a-z_]{1,40}$/.test(k)) out[k] = num(val);
  }
  return out;
}

function dasar(raw: Record<string, unknown>): FeatureCount {
  return { servers_configured: num(raw.servers_configured), servers_on: num(raw.servers_on) };
}

/** Hasil mentah dari cms-read → bentuk bersih; null bila bukan objek sama sekali. */
export function parseServerHub(raw: unknown): ServerHub | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = obj(raw);
  const v = obj(r.verification);
  const l = obj(r.leveling);
  const w = obj(r.welcome);
  const s = obj(r.security);
  return {
    generatedAt: num(r.generated_at),
    verification: { ...dasar(v), servers_incomplete: num(v.servers_incomplete), members_verified: num(v.members_verified) },
    leveling: {
      ...dasar(l),
      chat_on: num(l.chat_on),
      voice_on: num(l.voice_on),
      combined_on: num(l.combined_on),
      without_levelup_channel: num(l.without_levelup_channel),
      users_tracked: num(l.users_tracked),
      rewards_total: num(l.rewards_total),
    },
    autorole: dasar(obj(r.autorole)),
    welcome: { ...dasar(w), with_welcome_channel: num(w.with_welcome_channel), with_goodbye_channel: num(w.with_goodbye_channel) },
    security: {
      ...dasar(s),
      rejoin_alert_on: num(s.rejoin_alert_on),
      actions_total: num(s.actions_total),
      by_action: peta(s.by_action),
      by_status: peta(s.by_status),
    },
  };
}

/** Hal yang perlu dilihat admin. Teks tanpa tanda pisah, tanpa alasan karangan. */
export function perhatian(h: ServerHub): Perhatian[] {
  const out: Perhatian[] = [];
  if (h.verification.servers_incomplete > 0) {
    out.push({
      tone: 'warn',
      text: `${h.verification.servers_incomplete} server memakai Verification tetapi channel atau role verifikasinya belum lengkap.`,
    });
  }
  if (h.leveling.without_levelup_channel > 0) {
    out.push({
      tone: 'info',
      text: `${h.leveling.without_levelup_channel} server Leveling aktif tanpa channel pesan naik level. XP tetap dihitung, hanya pengumumannya tidak dikirim.`,
    });
  }
  if (h.welcome.servers_on > 0 && h.welcome.with_welcome_channel === 0 && h.welcome.with_goodbye_channel === 0) {
    out.push({ tone: 'warn', text: 'Welcome aktif di sebagian server tetapi belum ada channel welcome atau goodbye yang dipilih.' });
  }
  const kosong = [
    h.verification.servers_on === 0 && 'Verification',
    h.leveling.servers_on === 0 && 'Leveling',
    h.autorole.servers_on === 0 && 'Auto Role',
    h.welcome.servers_on === 0 && 'Welcome',
    h.security.servers_on === 0 && 'Security Center',
  ].filter(Boolean) as string[];
  if (kosong.length) {
    out.push({ tone: 'info', text: `Belum dipakai server mana pun: ${kosong.join(', ')}.` });
  }
  return out;
}

/** Persen dua angka (0 bila pembagi 0), dibulatkan. */
export function persen(bagian: number, total: number): number {
  return total > 0 ? Math.round((bagian / total) * 100) : 0;
}
