// ════════════════════════════════════════════════════════════════════════════
//  Vanillate Dashboard — model murni untuk fitur tinjau dan riwayat.
//
//  Semuanya dihitung di browser dari data yang SUDAH dimuat (guild_dashboard_get
//  dan guild_config_audit_list). Tidak ada permintaan jaringan tambahan dan
//  tidak ada yang ditulis ke database dari sini:
//    • describeChange  : satu baris perubahan draft untuk "Tinjau perubahan".
//    • revertChanges   : muat nilai LAMA dari satu baris Riwayat ke draft
//                        (admin tetap harus menekan Simpan).
//    • filterAudit     : saring dan cari Riwayat yang sudah dimuat.
//    • auditToCsv      : ekspor Riwayat yang sudah dimuat.
//    • setupSteps      : langkah awal untuk server baru.
//  Tes: tests/dashboard-review.test.ts.
// ════════════════════════════════════════════════════════════════════════════

import {
  AUDIT_ACTION,
  channelLabel,
  cloneState,
  formatAuditChange,
  formatWib,
  isNotUsed,
  isSnowflake,
  normalizeState,
  NOT_USED,
  roleLabel,
  supportsNotUsed,
  diffStates,
  featureLock,
  typedSettings,
  type AuditRow,
  type Change,
  type ConfigState,
  type Feature,
  type GuildData,
  type SettingProp,
  type TextContext,
} from './model.ts';

// ─── Tinjau perubahan (draft vs tersimpan) ───────────────────────────────────

function clip(text: string, max = 60): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Nilai satu setelan dalam bahasa admin (bukan JSON mentah). */
export function formatSettingValue(prop: SettingProp | undefined, value: unknown, ctx: TextContext): string {
  if (value === null || value === undefined || value === '') return 'kosong';
  if (typeof value === 'boolean') return value ? 'ON' : 'OFF';
  if (Array.isArray(value)) {
    if (!value.length) return 'kosong';
    if (prop?.type === 'role_list' && value.length <= 3) return value.map((id) => roleLabel(ctx, String(id))).join(', ');
    if (prop?.type === 'channel_list' && value.length <= 3) return value.map((id) => channelLabel(ctx, String(id))).join(', ');
    const noun = prop?.type === 'role_list' ? 'role' : prop?.type === 'channel_list' ? 'channel' : prop?.type === 'reward_list' ? 'reward' : 'baris';
    return `${value.length} ${noun}`;
  }
  if (prop?.type === 'role' && typeof value === 'string') return roleLabel(ctx, value);
  if (prop?.type === 'enum' && typeof value === 'string') return prop.labels?.[value] ?? value;
  if (typeof value === 'string') return `"${clip(value)}"`;
  if (typeof value === 'number') return String(value);
  return clip(JSON.stringify(value));
}

export interface ChangeLine {
  feature: string;
  featureName: string;
  label: string;
  from: string;
  to: string;
}

/** Satu baris "Fitur, apa yang berubah, dari, menjadi" untuk daftar tinjau. */
export function describeChange(c: Change, ctx: TextContext): ChangeLine {
  const f = ctx.registry.find((x) => x.key === c.feature);
  const featureName = f?.name ?? c.feature;
  if (c.field === 'enabled') {
    return { feature: c.feature, featureName, label: 'Status', from: c.from ? 'ON' : 'OFF', to: c.to ? 'ON' : 'OFF' };
  }
  if (c.field === 'channel') {
    const label = f?.purposes.find((p) => p.key === c.key)?.label ?? c.key ?? 'Channel';
    return {
      feature: c.feature,
      featureName,
      label,
      from: channelLabel(ctx, typeof c.from === 'string' ? c.from : null),
      to: channelLabel(ctx, typeof c.to === 'string' ? c.to : null),
    };
  }
  if (c.key === NOT_USED) {
    return { feature: c.feature, featureName, label: 'Tidak dipakai', from: c.from === true ? 'ya' : 'tidak', to: c.to === true ? 'ya' : 'tidak' };
  }
  const prop = f ? typedSettings(f).find((p) => p.key === c.key) : undefined;
  return {
    feature: c.feature,
    featureName,
    label: prop?.title ?? c.key ?? 'Setelan',
    from: formatSettingValue(prop, c.from, ctx),
    to: formatSettingValue(prop, c.to, ctx),
  };
}

// ─── Kembalikan dari Riwayat (ke draft, tidak langsung disimpan) ─────────────

interface AuditChange {
  path?: unknown;
  from?: unknown;
  to?: unknown;
}

/** Baris Riwayat yang berisi perubahan konfigurasi (punya `path` dan nilai lama). */
export function revertible(row: Pick<AuditRow, 'action' | 'changed_fields'>): boolean {
  if (!row.action.startsWith('config.')) return false;
  const items = Array.isArray(row.changed_fields) ? (row.changed_fields as AuditChange[]) : [];
  return items.some((c) => typeof c?.path === 'string' && 'from' in c);
}

/**
 * Salin nilai LAMA (`from`) setiap perubahan pada satu baris Riwayat ke draft.
 * Tidak menyentuh database: hasilnya draft baru yang masih harus disimpan admin
 * (dan tetap divalidasi klien, RPC, dan bot seperti perubahan biasa).
 *
 * Dilewati (`skipped`): fitur atau tujuan channel yang sudah tidak ada di
 * registry, nilai yang bentuknya tidak dikenal, dan nilai yang sudah sama.
 */
export function revertChanges(
  draft: ConfigState,
  changedFields: unknown,
  registry: Feature[],
): { draft: ConfigState; applied: number; skipped: number } {
  const next = cloneState(draft);
  let applied = 0;
  let skipped = 0;
  const items = Array.isArray(changedFields) ? (changedFields as AuditChange[]) : [];
  for (const c of items) {
    if (typeof c?.path !== 'string' || !('from' in c)) continue;
    const [fk, field, ...rest] = c.path.split('.');
    const sub = rest.join('.');
    const f = registry.find((x) => x.key === fk);
    const s = next[fk];
    if (!f || !s) {
      skipped += 1;
      continue;
    }
    const before = JSON.stringify(s);
    if (field === 'enabled' && typeof c.from === 'boolean') {
      s.enabled = c.from;
      // Sama dengan sakelar di kartu fitur: diaktifkan = "Tidak dipakai" batal.
      if (s.enabled && s.settings[NOT_USED] === true) s.settings[NOT_USED] = false;
    } else if (field === 'channels' && sub && f.purposes.some((p) => p.key === sub)) {
      if (isSnowflake(c.from)) s.channels[sub] = c.from;
      else if (c.from === null || c.from === undefined) delete s.channels[sub];
      else {
        skipped += 1;
        continue;
      }
    } else if (field === 'settings' && sub) {
      if (c.from === null || c.from === undefined) delete s.settings[sub];
      else s.settings[sub] = JSON.parse(JSON.stringify(c.from));
    } else {
      skipped += 1;
      continue;
    }
    if (JSON.stringify(s) === before) skipped += 1;
    else applied += 1;
  }
  return { draft: next, applied, skipped };
}

/**
 * Pulihkan draft ke isi pengaturan utuh sebuah revisi (dari Riwayat, migration
 * 0030 bot). Hanya fitur yang ada di revisi itu DAN masih terdaftar yang diganti;
 * fitur baru sesudah revisi itu dibiarkan. Hasilnya draft, belum disimpan.
 */
export function restoreState(
  draft: ConfigState,
  stored: ConfigState | null | undefined,
  registry: Feature[],
): { draft: ConfigState; applied: number } {
  const next = cloneState(draft);
  if (!stored || typeof stored !== 'object') return { draft: next, applied: 0 };
  const known = registry.filter((f) => stored[f.key] && next[f.key]);
  const clean = normalizeState(stored, known);
  for (const f of known) next[f.key] = clean[f.key];
  return { draft: next, applied: diffStates(draft, next, registry).length };
}

// ─── Salin pengaturan dari server lain ───────────────────────────────────────

/** Jenis setelan yang nilainya berlaku di server mana pun (bukan ID channel atau role). */
const PORTABLE = new Set(['boolean', 'integer', 'string', 'enum', 'color']);

/**
 * Salin pengaturan server lain ke draft: status aktif tiap fitur dan setelan yang
 * tidak merujuk channel atau role. Channel, role, daftar role atau channel, reward,
 * dan panduan channel TIDAK disalin karena ID-nya hanya berlaku di server asal.
 * Fitur yang seluruhnya terkunci tidak diaktifkan. Hasilnya draft, belum disimpan.
 */
export function copyFromServer(
  draft: ConfigState,
  source: ConfigState | null | undefined,
  registry: Feature[],
): { draft: ConfigState; applied: number; skipped: number } {
  const next = cloneState(draft);
  let skipped = 0;
  if (!source || typeof source !== 'object') return { draft: next, applied: 0, skipped };
  for (const f of registry) {
    const from = source[f.key];
    const to = next[f.key];
    if (!from || !to) continue;
    if (typeof from.enabled === 'boolean' && !(from.enabled && featureLock(f).full)) to.enabled = from.enabled;
    const settings = from.settings && typeof from.settings === 'object' ? from.settings : {};
    for (const p of typedSettings(f)) {
      const has = settings[p.key] !== undefined && settings[p.key] !== null;
      if (!PORTABLE.has(p.type)) {
        if (has) skipped += 1;
        continue;
      }
      if (has) to.settings[p.key] = JSON.parse(JSON.stringify(settings[p.key]));
      else delete to.settings[p.key];
    }
    if (supportsNotUsed(f)) {
      if (!to.enabled && settings[NOT_USED] === true) to.settings[NOT_USED] = true;
      else if (to.settings[NOT_USED] === true) to.settings[NOT_USED] = false;
    }
    skipped += Object.keys(from.channels ?? {}).length;
  }
  return { draft: next, applied: diffStates(draft, next, registry).length, skipped };
}

/** Draft tersimpan sementara di browser hanya dipakai lagi bila revisinya masih sama. */
export function recoverDraft(
  stored: unknown,
  base: ConfigState,
  baseRevision: number,
  registry: Feature[],
): ConfigState | null {
  const s = stored as { rev?: unknown; draft?: unknown } | null;
  if (!s || s.rev !== baseRevision || !s.draft || typeof s.draft !== 'object') return null;
  const draft = normalizeState(s.draft as ConfigState, registry);
  // Fitur yang tidak ada di simpanan memakai nilai tersimpan di server.
  for (const f of registry) if (!(s.draft as ConfigState)[f.key]) draft[f.key] = cloneState({ [f.key]: base[f.key] })[f.key];
  return diffStates(base, draft, registry).length ? draft : null;
}

// ─── Saring, cari, ekspor Riwayat ────────────────────────────────────────────

export type AuditKind = 'all' | 'config' | 'sync';

export const AUDIT_KIND_LABEL: Record<AuditKind, string> = {
  all: 'Semua',
  config: 'Perubahan pengaturan',
  sync: 'Sinkronisasi bot',
};

function auditLines(row: AuditRow, ctx: TextContext): string[] {
  const items = Array.isArray(row.changed_fields) ? (row.changed_fields as unknown[]) : [];
  return items.map((c) => formatAuditChange(c, ctx));
}

/** Saring Riwayat yang sudah dimuat (tanpa permintaan baru). */
export function filterAudit(rows: AuditRow[], opts: { kind: AuditKind; query: string }, ctx: TextContext): AuditRow[] {
  const q = opts.query.trim().toLowerCase();
  return rows.filter((r) => {
    if (opts.kind === 'config' && !r.action.startsWith('config.')) return false;
    if (opts.kind === 'sync' && !r.action.startsWith('sync.')) return false;
    if (!q) return true;
    const hay = [r.actor_name ?? r.actor_id, AUDIT_ACTION[r.action] ?? r.action, `revisi ${r.revision}`, ...auditLines(r, ctx)].join('\n').toLowerCase();
    return hay.includes(q);
  });
}

const SOURCE_LABEL: Record<string, string> = { web: 'Website', discord: 'Discord', import: 'Impor', bot: 'Bot' };
export const auditSourceLabel = (source: string): string => SOURCE_LABEL[source] ?? source;

function csvCell(value: string): string {
  // Awalan = + - @ dinetralkan supaya tidak dijalankan sebagai rumus di spreadsheet.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Riwayat yang sudah dimuat sebagai CSV (dibuka di spreadsheet). */
export function auditToCsv(rows: AuditRow[], ctx: TextContext): string {
  const head = ['Waktu (WIB)', 'Revisi', 'Pelaku', 'Sumber', 'Aksi', 'Perubahan'];
  const lines = rows.map((r) =>
    [formatWib(r.created_at), String(r.revision), r.actor_name ?? r.actor_id, auditSourceLabel(r.source), AUDIT_ACTION[r.action] ?? r.action, auditLines(r, ctx).join(' | ')]
      .map(csvCell)
      .join(','),
  );
  return [head.map(csvCell).join(','), ...lines].join('\r\n');
}

// ─── Langkah awal (server baru) ──────────────────────────────────────────────

export interface SetupStep {
  id: 'bot' | 'snapshot' | 'social' | 'sync';
  label: string;
  hint: string;
  done: boolean;
  /** Aksi yang ditawarkan saat belum selesai. */
  action?: { label: string; tab?: string; do?: 'invite' | 'discord-refresh' };
}

/**
 * Langkah awal dihitung dari data halaman yang sudah ada. Fitur sosial dianggap
 * diputuskan bila aktif atau ditandai "Tidak dipakai" (sama dengan onboarding bot).
 */
export function setupSteps(data: Pick<GuildData, 'bot' | 'config' | 'registry' | 'snapshot'>, base: ConfigState): SetupStep[] {
  const steps: SetupStep[] = [
    {
      id: 'bot',
      label: 'Bot Vanillate ada di server',
      hint: 'Tanpa bot, pengaturan tidak bisa disimpan atau diterapkan.',
      done: data.bot.installed,
      action: { label: 'Undang bot', do: 'invite' },
    },
    {
      id: 'snapshot',
      label: 'Daftar channel dan role dari Discord dimuat',
      hint: 'Dipakai untuk pilihan channel, role, dan pemeriksaan izin bot.',
      done: Boolean(data.snapshot?.refreshed_at),
      action: { label: 'Refresh Discord Data', do: 'discord-refresh' },
    },
  ];
  const social = data.registry.filter((f) => f.section === 'social' && supportsNotUsed(f));
  if (social.length) {
    const undecided = social.filter((f) => !base[f.key]?.enabled && !isNotUsed(base[f.key]));
    steps.push({
      id: 'social',
      label: 'Fitur sosial diputuskan',
      hint: undecided.length
        ? `Belum diputuskan: ${undecided.map((f) => f.name).join(', ')}. Aktifkan dengan channel khusus, atau centang Tidak dipakai.`
        : 'Setiap fitur sosial sudah aktif atau ditandai tidak dipakai.',
      done: undecided.length === 0,
      action: { label: 'Buka Social Hub', tab: 'social-hub' },
    });
  }
  const c = data.config;
  steps.push({
    id: 'sync',
    label: 'Bot sudah menerapkan pengaturan terbaru',
    hint: 'Status Aktif berarti yang tersimpan di sini sama dengan yang dijalankan bot.',
    done: data.bot.installed && (!c || (c.applied_revision >= c.revision && c.sync_status === 'ACTIVE')),
  });
  return steps;
}
