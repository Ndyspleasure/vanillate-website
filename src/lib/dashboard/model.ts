// ════════════════════════════════════════════════════════════════════════════
//  Vanillate Dashboard — model murni (tanpa DOM, tanpa jaringan).
//
//  Semua aturan tampilan yang bisa salah ada di sini supaya teruji
//  (tests/dashboard-model.test.ts): draft vs tersimpan, payload simpan,
//  validasi sisi klien (cermin RPC guild_config_save), izin bot per channel,
//  status sinkronisasi, dan pesan error yang bisa ditindaklanjuti.
//
//  Validasi di sini HANYA untuk umpan balik cepat. Penentu tetap server
//  (RPC) dan bot (saat menerapkan) — lihat docs/DASHBOARD-SERVER.md.
//  Berkas ini sengaja tanpa import supaya bisa dijalankan langsung oleh Node.
// ════════════════════════════════════════════════════════════════════════════

export interface Permission {
  bit: string;
  name: string;
}

export interface Purpose {
  key: string;
  label: string;
  required?: boolean;
  channel_types?: number[];
  unique_scope?: string | null;
  empty_label?: string;
  help?: string;
  permissions?: Permission[];
}

export interface Feature {
  key: string;
  section: 'game' | 'social' | 'other' | string;
  name: string;
  emoji?: string | null;
  description?: string | null;
  sort: number;
  default_enabled: boolean;
  purposes: Purpose[];
  settings_schema?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface FeatureState {
  enabled: boolean;
  settings: Record<string, unknown>;
  channels: Record<string, string>;
}

export type ConfigState = Record<string, FeatureState>;

// ─── 🚫 Tidak dipakai (fitur sosial) ─────────────────────────────────────────
// Bot menerbitkan setelan `not_used` di settings_schema fitur sosial. Dicentang
// saat fitur OFF = admin sengaja tidak memakai fitur itu: 🧭 onboarding bot
// berhenti menanyakannya (dulu tombol "🚫 Tidak Dipakai" di /pengaturan).
// `false` eksplisit = keputusan dibatalkan; tanpa key = belum pernah diubah.
export const NOT_USED = 'not_used';

/** Apakah fitur ini punya pilihan "Tidak dipakai" (diterbitkan bot). */
export function supportsNotUsed(f: Feature): boolean {
  const props = (f.settings_schema as { properties?: Record<string, unknown> } | undefined)?.properties;
  return Boolean(props && typeof props === 'object' && NOT_USED in props);
}

/** Fitur OFF yang ditandai "Tidak dipakai". */
export function isNotUsed(s: FeatureState | undefined): boolean {
  return Boolean(s && !s.enabled && s.settings[NOT_USED] === true);
}

// ─── Setelan bertipe (settings_schema.properties) ────────────────────────────
// Aturan yang sama diulang di RPC guild_config_validate (final) dan bot
// (src/dashboard/typed.js); di sini hanya umpan balik sebelum menyimpan.

export type SettingType = 'boolean' | 'integer' | 'string' | 'enum' | 'role' | 'role_list' | 'channel_list' | 'reward_list';

export interface SettingProp {
  key: string;
  type: SettingType;
  title: string;
  required: boolean;
  min?: number;
  max?: number;
  max_length?: number;
  max_items?: number;
  values?: string[];
  default?: unknown;
  help?: string;
  /** reward_list: batas jumlah per kategori & level tertinggi. */
  limits?: Record<string, number>;
  max_level?: number;
}

export interface RewardRow {
  category: string;
  level: number | null;
  role_id: string;
}

const SETTING_TYPES = new Set<string>(['boolean', 'integer', 'string', 'enum', 'role', 'role_list', 'channel_list', 'reward_list']);

/** Properti bertipe sebuah fitur (urutan seperti diterbitkan bot). */
export function typedSettings(f: Feature): SettingProp[] {
  const props = (f.settings_schema as { properties?: Record<string, Record<string, unknown>> } | undefined)?.properties;
  if (!props || typeof props !== 'object') return [];
  const out: SettingProp[] = [];
  for (const [key, p] of Object.entries(props)) {
    if (!p || typeof p.type !== 'string' || !SETTING_TYPES.has(p.type)) continue;
    out.push({
      key,
      type: p.type as SettingType,
      title: typeof p.title === 'string' ? p.title : key,
      required: p.required === true,
      min: typeof p.min === 'number' ? p.min : undefined,
      max: typeof p.max === 'number' ? p.max : undefined,
      max_length: typeof p.max_length === 'number' ? p.max_length : undefined,
      max_items: typeof p.max_items === 'number' ? p.max_items : undefined,
      values: Array.isArray(p.values) ? (p.values as string[]) : undefined,
      default: p.default,
      help: typeof p.help === 'string' ? p.help : undefined,
      limits: p.limits && typeof p.limits === 'object' ? (p.limits as Record<string, number>) : undefined,
      max_level: typeof p.max_level === 'number' ? p.max_level : undefined,
    });
  }
  return out;
}

/** Nilai efektif sebuah setelan: tersimpan, atau default schema. */
export function settingValue(f: Feature, s: FeatureState | undefined, key: string): unknown {
  const v = s?.settings?.[key];
  if (v !== undefined && v !== null && v !== '') return v;
  return typedSettings(f).find((p) => p.key === key)?.default;
}

/** Semua id role yang dirujuk sebuah setelan (role, daftar role, atau reward). */
export function settingRoleIds(value: unknown, type: SettingType): string[] {
  if (type === 'reward_list') {
    return Array.isArray(value) ? [...new Set((value as RewardRow[]).map((r) => String(r?.role_id ?? '')).filter(Boolean))] : [];
  }
  if (Array.isArray(value)) return value as string[];
  return value ? [String(value)] : [];
}

/** Masalah satu fitur dari setelan bertipenya (tanpa konteks Discord). */
export function validateSettingValues(f: Feature, s: FeatureState): Issue[] {
  const issues: Issue[] = [];
  const snowflake = /^[0-9]{15,22}$/;
  for (const p of typedSettings(f)) {
    const v = s.settings[p.key];
    if (v === undefined || v === null || v === '') {
      if (p.required && s.enabled) issues.push({ code: 'SETTING_REQUIRED', feature: f.key, key: p.key });
      continue;
    }
    const bad = () => issues.push({ code: 'SETTING_INVALID', feature: f.key, key: p.key });
    switch (p.type) {
      case 'boolean':
        if (typeof v !== 'boolean') bad();
        break;
      case 'integer':
        if (typeof v !== 'number' || !Number.isInteger(v)) bad();
        else if ((p.min != null && v < p.min) || (p.max != null && v > p.max)) {
          issues.push({ code: 'SETTING_OUT_OF_RANGE', feature: f.key, key: p.key, min: p.min ?? null, max: p.max ?? null });
        }
        break;
      case 'string':
        if (typeof v !== 'string' || (p.max_length != null && v.length > p.max_length)) bad();
        break;
      case 'enum':
        if (!p.values?.includes(v as string)) bad();
        break;
      case 'role':
        if (typeof v !== 'string' || !snowflake.test(v)) bad();
        break;
      case 'reward_list': {
        const limits = p.limits ?? {};
        const counts: Record<string, number> = {};
        const seen = new Set<string>();
        let malformed = !Array.isArray(v);
        for (const r of malformed ? [] : (v as RewardRow[])) {
          if (!r || typeof r !== 'object' || !(r.category in limits) || !Number.isInteger(r.level) || (r.level as number) < 1
            || (r.level as number) > (p.max_level ?? 1000) || !snowflake.test(String(r.role_id ?? ''))) {
            malformed = true;
            break;
          }
          counts[r.category] = (counts[r.category] ?? 0) + 1;
          const id = `${r.category}|${r.level}`;
          if (seen.has(id)) issues.push({ code: 'REWARD_DUPLICATE', feature: f.key, key: p.key, category: r.category, level: r.level as number });
          seen.add(id);
        }
        if (malformed) bad();
        else {
          for (const [category, max] of Object.entries(limits)) {
            if ((counts[category] ?? 0) > max) issues.push({ code: 'REWARD_LIMIT', feature: f.key, key: p.key, category, max });
          }
        }
        break;
      }
      default:
        if (!Array.isArray(v) || (p.max_items != null && v.length > p.max_items) || v.some((x) => typeof x !== 'string' || !snowflake.test(x))) bad();
    }
  }
  return issues;
}

export function roleById(snapshot: Snapshot | null | undefined, id: string | null | undefined): SnapshotRole | null {
  if (!id) return null;
  return snapshot?.roles?.find((r) => r.id === id) ?? null;
}

/** Role untuk dropdown: posisi tertinggi di atas (seperti urutan di Discord). */
export function roleOptions(snapshot: Snapshot | null | undefined): SnapshotRole[] {
  return [...(snapshot?.roles ?? [])].sort((a, b) => b.position - a.position || a.name.localeCompare(b.name));
}

/**
 * Role yang akan diberikan bot tapi tidak bisa: dikelola integrasi, atau
 * posisinya tidak di bawah role tertinggi bot. Peringatan (bot memvalidasi ulang).
 */
export function roleGrantProblem(snapshot: Snapshot | null | undefined, roleId: string | null | undefined): string | null {
  const role = roleById(snapshot, roleId);
  if (!role) return null;
  if (role.managed) return 'dikelola integrasi (bot tidak bisa memberikannya)';
  const top = snapshot?.bot_top_position;
  if (typeof top === 'number' && role.position >= top) return 'posisinya sejajar atau di atas role tertinggi bot';
  return null;
}

export interface SnapshotChannel {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
  position?: number;
  perms?: string;
}

export interface SnapshotRole {
  id: string;
  name: string;
  position: number;
  managed?: boolean;
  color?: number;
}

export interface Snapshot {
  refreshed_at: string | null;
  requested_at: string | null;
  bot_present?: boolean;
  bot_permissions?: string | null;
  channels: SnapshotChannel[];
  roles?: SnapshotRole[];
  bot_top_position?: number | null;
}

export interface Issue {
  code: string;
  feature?: string;
  purpose?: string;
  channel_id?: string;
  channel_name?: string;
  missing?: string[];
  other_feature?: string;
  detail?: string;
  key?: string;
  role_id?: string;
  min?: number | null;
  max?: number | null;
  reason?: string;
  category?: string;
  level?: number;
}

export interface ConfigInfo {
  revision: number;
  applied_revision: number;
  sync_status: 'SYNCING' | 'ACTIVE' | 'NEEDS_ATTENTION';
  attempted_revision: number | null;
  attempted_at: string | null;
  applied_at: string | null;
  last_error: Issue[] | null;
  health: Issue[] | null;
  health_checked_at: string | null;
  resync_requested_at: string | null;
  updated_at: string;
  updated_by: string | null;
  updated_by_name: string | null;
  updated_source: 'web' | 'discord' | 'import';
}

export interface BotInfo {
  installed: boolean;
  online: boolean;
  last_heartbeat_at: string | null;
  version: string | null;
}

export interface GuildData {
  guild: { id: string; name: string | null; icon: string | null; member_count: number | null };
  bot: BotInfo;
  config: ConfigInfo | null;
  registry: Feature[];
  state: ConfigState;
  snapshot: Snapshot | null;
  viewer: { discord_id: string; name: string; is_owner: boolean; access_verified_at: string | null };
  server_time: string;
}

// ─── Discord ────────────────────────────────────────────────────────────────

export const CHANNEL_TYPE = { TEXT: 0, VOICE: 2, CATEGORY: 4, ANNOUNCEMENT: 5, STAGE: 13, FORUM: 15 } as const;

const SNOWFLAKE = /^[0-9]{15,22}$/;

export function isSnowflake(value: unknown): value is string {
  return typeof value === 'string' && SNOWFLAKE.test(value);
}

export function guildIconUrl(guildId: string, icon: string | null | undefined, size = 128): string | null {
  if (!icon || !/^(a_)?[0-9a-f]{32}$/.test(icon)) return null;
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.${icon.startsWith('a_') ? 'gif' : 'png'}?size=${size}`;
}

/** Inisial nama server untuk avatar pengganti ikon. */
export function guildInitials(name: string | null | undefined): string {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return words.slice(0, 2).map((w) => Array.from(w)[0]).join('').toUpperCase();
}

/** Tautan undang bot langsung ke server tertentu. */
export function inviteUrl(clientId: string, permissions: string, guildId: string): string | null {
  if (!isSnowflake(clientId)) return null;
  const params = new URLSearchParams({
    client_id: clientId,
    permissions: /^[0-9]+$/.test(permissions) ? permissions : '0',
    scope: 'bot applications.commands',
    integration_type: '0',
  });
  if (isSnowflake(guildId)) {
    params.set('guild_id', guildId);
    params.set('disable_guild_select', 'true');
  }
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

function bits(value: unknown): bigint | null {
  if (typeof value !== 'string' || !/^[0-9]{1,30}$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

/** Nama izin yang belum dimiliki bot di channel (kosong bila tak bisa dinilai). */
export function missingPermissions(channel: SnapshotChannel | null | undefined, purpose: Purpose): string[] {
  const have = bits(channel?.perms);
  if (have === null) return [];
  return (purpose.permissions ?? [])
    .filter((p) => {
      const need = bits(p.bit);
      return need !== null && (have & need) === 0n;
    })
    .map((p) => p.name);
}

export function channelById(snapshot: Snapshot | null | undefined, id: string | null | undefined): SnapshotChannel | null {
  if (!snapshot || !id) return null;
  return snapshot.channels.find((c) => c.id === id) ?? null;
}

export interface ChannelOption {
  id: string;
  name: string;
  category: string | null;
}

/** Channel yang boleh dipilih untuk sebuah tujuan, berurutan seperti di Discord. */
export function channelOptions(snapshot: Snapshot | null | undefined, purpose: Purpose): ChannelOption[] {
  if (!snapshot) return [];
  const types = purpose.channel_types?.length ? purpose.channel_types : [CHANNEL_TYPE.TEXT];
  const categories = new Map(
    snapshot.channels.filter((c) => c.type === CHANNEL_TYPE.CATEGORY).map((c) => [c.id, c]),
  );
  const catPos = (c: SnapshotChannel) => (c.parent_id ? categories.get(c.parent_id)?.position ?? 0 : -1);
  return snapshot.channels
    .filter((c) => types.includes(c.type))
    .sort((a, b) => catPos(a) - catPos(b) || (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name))
    .map((c) => ({
      id: c.id,
      name: c.name,
      category: c.parent_id ? categories.get(c.parent_id)?.name ?? null : null,
    }));
}

// ─── State ──────────────────────────────────────────────────────────────────

export function sortedRegistry(registry: Feature[]): Feature[] {
  return [...registry].sort((a, b) => a.sort - b.sort || a.key.localeCompare(b.key));
}

/** Lengkapi state dari server: setiap fitur registry punya entri yang utuh. */
export function normalizeState(state: ConfigState | null | undefined, registry: Feature[]): ConfigState {
  const out: ConfigState = {};
  for (const f of registry) {
    const s = state?.[f.key];
    const channels: Record<string, string> = {};
    for (const p of f.purposes) {
      const id = s?.channels?.[p.key];
      if (isSnowflake(id)) channels[p.key] = id;
    }
    out[f.key] = {
      enabled: typeof s?.enabled === 'boolean' ? s.enabled : f.default_enabled,
      settings: s?.settings && typeof s.settings === 'object' ? { ...s.settings } : {},
      channels,
    };
  }
  return out;
}

export function cloneState(state: ConfigState): ConfigState {
  return JSON.parse(JSON.stringify(state)) as ConfigState;
}

export interface Change {
  feature: string;
  field: 'enabled' | 'channel' | 'setting';
  key?: string;
  from: unknown;
  to: unknown;
}

/** Perubahan dari `base` ke `draft` (urut sesuai registry). */
export function diffStates(base: ConfigState, draft: ConfigState, registry: Feature[]): Change[] {
  const out: Change[] = [];
  for (const f of sortedRegistry(registry)) {
    const a = base[f.key];
    const b = draft[f.key];
    if (!a || !b) continue;
    if (a.enabled !== b.enabled) out.push({ feature: f.key, field: 'enabled', from: a.enabled, to: b.enabled });
    for (const p of f.purposes) {
      const x = a.channels[p.key] ?? null;
      const y = b.channels[p.key] ?? null;
      if (x !== y) out.push({ feature: f.key, field: 'channel', key: p.key, from: x, to: y });
    }
    const keys = new Set([...Object.keys(a.settings), ...Object.keys(b.settings)]);
    for (const k of [...keys].sort()) {
      if (JSON.stringify(a.settings[k]) !== JSON.stringify(b.settings[k])) {
        out.push({ feature: f.key, field: 'setting', key: k, from: a.settings[k] ?? null, to: b.settings[k] ?? null });
      }
    }
  }
  return out;
}

export function isDirty(base: ConfigState, draft: ConfigState, registry: Feature[]): boolean {
  return diffStates(base, draft, registry).length > 0;
}

/** Payload deklaratif untuk RPC guild_config_save (semua fitur registry). */
export function buildSavePayload(draft: ConfigState, registry: Feature[]) {
  const features: Record<string, { enabled: boolean; settings: Record<string, unknown> }> = {};
  const channels: { featureKey: string; purpose: string; channelId: string }[] = [];
  for (const f of sortedRegistry(registry)) {
    const s = draft[f.key];
    if (!s) continue;
    features[f.key] = { enabled: s.enabled, settings: s.settings };
    for (const p of f.purposes) {
      const id = s.channels[p.key];
      if (isSnowflake(id)) channels.push({ featureKey: f.key, purpose: p.key, channelId: id });
    }
  }
  return { features, channels };
}

export function featureSummary(state: ConfigState, registry: Feature[]) {
  let active = 0;
  let channels = 0;
  for (const f of registry) {
    const s = state[f.key];
    if (!s) continue;
    if (s.enabled) active += 1;
    channels += Object.keys(s.channels).length;
  }
  return { active, total: registry.length, channels };
}

// ─── Validasi sisi klien (cermin RPC) ───────────────────────────────────────

/**
 * Masalah yang pasti ditolak server. Channel dicek terhadap snapshot hanya bila
 * berbeda dari yang tersimpan (sama seperti RPC).
 */
export function validateDraft(
  draft: ConfigState,
  base: ConfigState,
  registry: Feature[],
  snapshot: Snapshot | null,
): Issue[] {
  const issues: Issue[] = [];
  const seen = new Map<string, string>();
  let noData = false;

  for (const f of sortedRegistry(registry)) {
    const s = draft[f.key];
    if (!s) continue;
    for (const p of f.purposes) {
      const id = s.channels[p.key];
      if (id && id !== base[f.key]?.channels[p.key]) {
        if (!snapshot?.refreshed_at) {
          noData = true;
        } else {
          const ch = channelById(snapshot, id);
          const types = p.channel_types?.length ? p.channel_types : [CHANNEL_TYPE.TEXT];
          if (!ch) issues.push({ code: 'CHANNEL_NOT_FOUND', feature: f.key, purpose: p.key, channel_id: id });
          else if (!types.includes(ch.type)) {
            issues.push({ code: 'CHANNEL_TYPE_INVALID', feature: f.key, purpose: p.key, channel_id: id, channel_name: ch.name });
          }
        }
      }
      if (!s.enabled) continue;
      if (p.required && !id) issues.push({ code: 'CHANNEL_REQUIRED', feature: f.key, purpose: p.key });
      if (id && p.unique_scope) {
        const k = `${p.unique_scope}|${id}`;
        const other = seen.get(k);
        if (other) issues.push({ code: 'CHANNEL_CONFLICT', feature: f.key, purpose: p.key, channel_id: id, other_feature: other });
        else seen.set(k, f.key);
      }
    }
  }
  for (const f of sortedRegistry(registry)) {
    const s = draft[f.key];
    if (!s) continue;
    issues.push(...validateSettingValues(f, s));
    // Role yang baru/berubah wajib ada di data Discord terbaru.
    for (const p of typedSettings(f)) {
      if (p.type !== 'role' && p.type !== 'role_list' && p.type !== 'reward_list') continue;
      const ids = settingRoleIds(s.settings[p.key], p.type);
      const oldIds = settingRoleIds(base[f.key]?.settings[p.key], p.type);
      for (const id of ids.filter((x) => !oldIds.includes(x))) {
        if (!snapshot?.refreshed_at) noData = true;
        else if (!roleById(snapshot, id)) issues.push({ code: 'ROLE_NOT_FOUND', feature: f.key, key: p.key, role_id: id });
      }
    }
  }
  // Verified Role terpisah dari Level Rewards.
  const verified = new Set<string>();
  for (const f of registry) for (const p of typedSettings(f)) {
    if (p.key === 'verified_role' && typeof draft[f.key]?.settings[p.key] === 'string') verified.add(draft[f.key].settings[p.key] as string);
  }
  for (const f of sortedRegistry(registry)) {
    const s = draft[f.key];
    for (const p of typedSettings(f)) {
      if (p.type !== 'reward_list' || !s) continue;
      for (const id of settingRoleIds(s.settings[p.key], p.type)) {
        if (verified.has(id)) issues.push({ code: 'ROLE_CONFLICT', feature: f.key, key: p.key, role_id: id });
      }
    }
  }
  if (noData) issues.push({ code: 'NO_DISCORD_DATA' });
  return issues;
}

/** Peringatan izin bot untuk fitur aktif (tidak memblokir simpan). */
export function permissionWarnings(state: ConfigState, registry: Feature[], snapshot: Snapshot | null): Issue[] {
  const out: Issue[] = [];
  if (!snapshot?.refreshed_at) return out;
  for (const f of sortedRegistry(registry)) {
    const s = state[f.key];
    if (!s?.enabled) continue;
    for (const p of f.purposes) {
      const id = s.channels[p.key];
      const ch = channelById(snapshot, id);
      if (!id || !ch) continue;
      const missing = missingPermissions(ch, p);
      if (missing.length) {
        out.push({ code: 'MISSING_PERMISSIONS', feature: f.key, purpose: p.key, channel_id: id, channel_name: ch.name, missing });
      }
    }
    // Role yang akan diberikan bot (Verified Role) harus bisa diberikan.
    for (const p of typedSettings(f)) {
      if (p.type !== 'role' && p.type !== 'reward_list') continue;
      for (const id of settingRoleIds(s.settings[p.key], p.type)) {
        const reason = roleGrantProblem(snapshot, id);
        if (reason) out.push({ code: 'ROLE_UNUSABLE', feature: f.key, key: p.key, role_id: id, reason });
      }
    }
  }
  return out;
}

// ─── Status ─────────────────────────────────────────────────────────────────

export type SyncStatus =
  | 'DRAFT'
  | 'SAVING'
  | 'SAVED'
  | 'SYNCING'
  | 'ACTIVE'
  | 'NEEDS_ATTENTION'
  | 'BOT_OFFLINE'
  | 'NOT_INSTALLED';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const STATUS_META: Record<SyncStatus, { label: string; tone: Tone; hint: string }> = {
  DRAFT: { label: 'Belum disimpan', tone: 'warning', hint: 'Ada perubahan di halaman ini yang belum disimpan.' },
  SAVING: { label: 'Menyimpan…', tone: 'info', hint: 'Perubahan sedang disimpan.' },
  SAVED: { label: 'Tersimpan', tone: 'info', hint: 'Tersimpan di database. Menunggu bot menerapkannya.' },
  SYNCING: { label: 'Menyinkronkan', tone: 'info', hint: 'Bot sedang membaca & menerapkan revisi terbaru.' },
  ACTIVE: { label: 'Aktif', tone: 'success', hint: 'Bot sudah menerapkan konfigurasi terbaru.' },
  NEEDS_ATTENTION: { label: 'Perlu perhatian', tone: 'danger', hint: 'Bot gagal menerapkan konfigurasi atau menemukan masalah.' },
  BOT_OFFLINE: { label: 'Bot offline', tone: 'neutral', hint: 'Bot sedang tidak bisa menerapkan perubahan. Konfigurasi tetap tersimpan.' },
  NOT_INSTALLED: { label: 'Bot belum terpasang', tone: 'neutral', hint: 'Undang bot ke server ini sebelum mengatur fiturnya.' },
};

/**
 * Status yang ditampilkan. Urutan prioritas: bot tidak ada → sedang
 * menyimpan → draft lokal → bot offline → status dari database. Status "Aktif"
 * hanya muncul bila bot SUDAH menerapkan revisi tersimpan.
 */
export function displayStatus(input: {
  bot: BotInfo;
  config: ConfigInfo | null;
  dirty?: boolean;
  saving?: boolean;
  justSaved?: boolean;
}): SyncStatus {
  const { bot, config } = input;
  if (!bot.installed) return 'NOT_INSTALLED';
  // Selama menyimpan, draft masih berbeda dari base sampai data baru dimuat.
  if (input.saving) return 'SAVING';
  if (input.dirty) return 'DRAFT';
  if (!bot.online) return 'BOT_OFFLINE';
  if (!config) return 'ACTIVE';
  if (config.sync_status === 'NEEDS_ATTENTION') return 'NEEDS_ATTENTION';
  if (config.revision > config.applied_revision) return input.justSaved ? 'SAVED' : 'SYNCING';
  return 'ACTIVE';
}

/** Masalah aktif dari bot: kegagalan apply (bila relevan) + laporan kesehatan. */
export function serverIssues(config: ConfigInfo | null): Issue[] {
  if (!config) return [];
  const out: Issue[] = [];
  if (config.last_error?.length && config.attempted_revision === config.revision && config.revision > config.applied_revision) {
    out.push(...config.last_error);
  }
  if (config.revision === config.applied_revision && config.health?.length) out.push(...config.health);
  return out;
}

// ─── Teks ───────────────────────────────────────────────────────────────────

export interface TextContext {
  registry: Feature[];
  snapshot: Snapshot | null;
}

function featureName(ctx: TextContext, key: string | undefined): string {
  if (!key) return 'Fitur';
  return ctx.registry.find((f) => f.key === key)?.name ?? key;
}

export function channelLabel(ctx: TextContext, id: string | null | undefined, fallbackName?: string | null): string {
  if (!id) return '—';
  const ch = channelById(ctx.snapshot, id);
  if (ch) return `#${ch.name}`;
  if (fallbackName) return `#${fallbackName}`;
  return `#channel-terhapus (${id})`;
}

function settingTitle(ctx: TextContext, issue: Issue): string {
  const f = ctx.registry.find((x) => x.key === issue.feature);
  return (f && typedSettings(f).find((p) => p.key === issue.key)?.title) || issue.key || 'setelan';
}

export function roleLabel(ctx: TextContext, id: string | null | undefined): string {
  if (!id) return '—';
  const r = roleById(ctx.snapshot, id);
  return r ? `@${r.name}` : `@role-terhapus (${id})`;
}

export function categoryLabel(category: string | undefined): string {
  return category === 'chat' ? 'Chat' : category === 'voice' ? 'Voice' : category === 'combined' ? 'Combined' : category ?? '';
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} & ${items[items.length - 1]}`;
}

/** Kalimat yang menjelaskan sebuah masalah + cara memperbaikinya. */
export function describeIssue(issue: Issue, ctx: TextContext): string {
  const name = featureName(ctx, issue.feature);
  const ch = channelLabel(ctx, issue.channel_id, issue.channel_name);
  switch (issue.code) {
    case 'MISSING_PERMISSIONS':
      return `${name} belum dapat diterapkan. Bot tidak memiliki permission ${listJoin(issue.missing ?? [])} di ${ch}. Perbarui permission bot di channel itu atau pilih channel lain.`;
    case 'CHANNEL_NOT_FOUND':
      return `${name}: channel ${ch} tidak ditemukan di server (mungkin sudah dihapus). Tekan Refresh Discord Data lalu pilih channel lain.`;
    case 'CHANNEL_TYPE_INVALID':
      return `${name}: ${ch} bukan channel teks biasa. Pilih channel teks (bukan voice, forum, atau kategori).`;
    case 'CHANNEL_REQUIRED':
      return `${name} butuh channel selama aktif. Pilih channel atau matikan fitur ini.`;
    case 'CHANNEL_CONFLICT':
      return `${name} dan ${featureName(ctx, issue.other_feature)} tidak boleh memakai channel yang sama (${ch}).`;
    case 'SETTING_REQUIRED':
      return `${name}: ${settingTitle(ctx, issue)} wajib diisi selama fitur aktif.`;
    case 'SETTING_OUT_OF_RANGE':
      return `${name}: ${settingTitle(ctx, issue)} harus antara ${issue.min ?? '…'} dan ${issue.max ?? '…'}.`;
    case 'SETTING_INVALID':
      return `${name}: nilai ${settingTitle(ctx, issue)} tidak valid.`;
    case 'ROLE_NOT_FOUND':
      return `${name}: role untuk ${settingTitle(ctx, issue)} tidak ditemukan di server (mungkin sudah dihapus). Tekan Refresh Discord Data lalu pilih role lain.`;
    case 'ROLE_UNUSABLE':
      return `${name}: role ${roleLabel(ctx, issue.role_id)} tidak bisa diberikan bot — ${issue.reason ?? 'periksa izin Manage Roles dan posisi role bot'}. Naikkan role bot di atas role ini di Pengaturan Server › Role.`;
    case 'REWARD_LIMIT':
      return `${name}: reward ${categoryLabel(issue.category)} melebihi batas (maks. ${issue.max ?? '…'}). Hapus sebagian baris.`;
    case 'REWARD_DUPLICATE':
      return `${name}: ada dua reward ${categoryLabel(issue.category)} dengan level yang sama${issue.level ? ` (level ${issue.level})` : ''}. Satu level hanya boleh punya satu reward per kategori.`;
    case 'ROLE_CONFLICT':
      return `${name}: role ${roleLabel(ctx, issue.role_id)} adalah Verified Role, jadi tidak boleh dipakai sebagai reward level.`;
    case 'NO_DISCORD_DATA':
      return 'Daftar channel dari Discord belum tersedia. Tekan Refresh Discord Data dan tunggu beberapa detik.';
    case 'BOT_NOT_IN_GUILD':
      return 'Bot sudah tidak berada di server ini. Undang bot lagi untuk menerapkan konfigurasi.';
    case 'ACTOR_FORBIDDEN':
      return 'Bot menolak perubahan ini karena penyimpannya tidak lagi punya izin Manage Server di server ini. Admin lain bisa menekan Retry Sync untuk menyetujui & menerapkannya, atau mengubah lalu menyimpan ulang.';
    case 'APPLY_FAILED':
      return 'Bot gagal menerapkan konfigurasi ini. Konfigurasi lama tetap berlaku — coba Retry Sync sebentar lagi.';
    case 'UNKNOWN_FEATURE':
      return `Fitur ${issue.feature ?? ''} tidak dikenal oleh bot versi ini.`.replace(/\s+/g, ' ');
    case 'UNKNOWN_PURPOSE':
    case 'INVALID_CHANNEL':
    case 'INVALID_PAYLOAD':
    case 'SETTINGS_INVALID':
      return `${name}: data pengaturan tidak valid. Muat ulang halaman lalu coba lagi.`;
    default:
      return issue.detail ? `${name}: ${issue.detail}` : `${name}: terjadi masalah (${issue.code}).`;
  }
}

/** Pesan untuk error RPC / Edge Function. */
export function describeError(code: string | null | undefined, detail?: Record<string, unknown> | null): string {
  switch (code) {
    case 'NOT_AUTHENTICATED':
      return 'Sesi login berakhir. Masuk lagi dengan Discord.';
    case 'NO_DISCORD_IDENTITY':
      return 'Akun ini belum terhubung dengan Discord. Keluar lalu masuk dengan Discord.';
    case 'DISCORD_RELOGIN':
      return 'Izin Discord perlu disegarkan. Hubungkan ulang akun Discord-mu.';
    case 'TOKEN_MISMATCH':
      return 'Akun Discord yang terhubung berbeda dengan akun login. Keluar lalu masuk lagi.';
    case 'ACCESS_DENIED':
      return 'Kamu tidak punya akses untuk mengelola server ini (butuh pemilik server, Administrator, atau Manage Server).';
    case 'ACCESS_STALE':
      return 'Verifikasi akses server sudah kedaluwarsa. Muat ulang halaman.';
    case 'INVALID_GUILD':
      return 'Server tidak valid. Kembali ke daftar server.';
    case 'BOT_NOT_INSTALLED':
      return 'Bot belum ada di server ini. Undang bot terlebih dahulu.';
    case 'BOT_NOT_READY':
      return 'Bot Vanillate sedang diperbarui untuk mendukung dashboard. Simpan bisa dilakukan setelah bot versi terbaru aktif — pengaturan lama dari Discord akan ikut terbawa.';
    case 'STALE_REVISION': {
      const rev = detail?.current_revision;
      return `Konfigurasi server ini baru saja diubah di tempat lain${rev != null ? ` (revisi ${rev})` : ''}. Muat ulang untuk melihat versi terbaru, lalu ulangi perubahanmu.`;
    }
    case 'VALIDATION_FAILED':
      return 'Ada pengaturan yang belum valid. Periksa pesan di setiap fitur.';
    case 'NO_CONFIG':
      return 'Server ini belum punya konfigurasi tersimpan.';
    case 'RATE_LIMITED':
      return 'Terlalu banyak permintaan ke Discord. Tunggu sebentar lalu coba lagi.';
    case 'DISCORD_UNAVAILABLE':
      return 'Discord sedang tidak bisa dihubungi. Coba lagi beberapa saat lagi.';
    case 'SYNC_TIMEOUT':
      return 'Bot belum menerapkan perubahan dalam waktu yang wajar. Coba Retry Sync, atau periksa apakah bot online.';
    case 'NETWORK':
      return 'Gagal terhubung ke server. Periksa koneksi internet lalu coba lagi.';
    case 'DATABASE_ERROR':
    default:
      return 'Terjadi kesalahan pada server. Coba lagi beberapa saat lagi.';
  }
}

// ─── Waktu ──────────────────────────────────────────────────────────────────

const WIB = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Timestamp UTC dari backend → teks WIB, mis. "4 Okt 2026, 00.30 WIB". */
export function formatWib(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  return `${WIB.format(new Date(t))} WIB`;
}

export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'belum pernah';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 10) return 'baru saja';
  if (s < 60) return `${s} detik lalu`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} menit lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.round(h / 24)} hari lalu`;
}

// ─── Audit ──────────────────────────────────────────────────────────────────

export interface AuditRow {
  id: number;
  actor_id: string;
  actor_name: string | null;
  source: 'web' | 'discord' | 'import' | 'bot';
  revision: number;
  action: string;
  changed_fields: unknown;
  created_at: string;
}

export const AUDIT_ACTION: Record<string, string> = {
  'config.save': 'Mengubah konfigurasi',
  'config.discord': 'Mengubah dari Discord',
  'config.import': 'Mengimpor pengaturan lama',
  'sync.applied': 'Bot menerapkan revisi',
  'sync.failed': 'Bot gagal menerapkan revisi',
  'sync.resync_requested': 'Meminta Retry Sync',
  'sync.reauthorized': 'Menyetujui revisi tertunda (Retry Sync)',
};

function show(value: unknown, isChannel: boolean, ctx: TextContext): string {
  if (value === null || value === undefined) return isChannel ? 'tidak diatur' : '—';
  if (typeof value === 'boolean') return value ? 'ON' : 'OFF';
  if (isChannel && typeof value === 'string') return channelLabel(ctx, value);
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/** Satu baris perubahan audit, mis. "Sambung Kata · Channel khusus: #a → #b". */
export function formatAuditChange(change: unknown, ctx: TextContext): string {
  const c = change as { path?: string; from?: unknown; to?: unknown; previous_actor_id?: string; previous_actor_name?: string | null };
  if (c?.previous_actor_id !== undefined) {
    return `Sebelumnya atas nama ${c.previous_actor_name ?? c.previous_actor_id ?? '—'}`;
  }
  if (!c?.path) return describeIssue(change as Issue, ctx);
  const [fk, field, sub] = c.path.split('.');
  const f = ctx.registry.find((x) => x.key === fk);
  const name = f?.name ?? fk;
  if (field === 'enabled') return `${name} · Status: ${show(c.from, false, ctx)} → ${show(c.to, false, ctx)}`;
  if (field === 'channels') {
    const label = f?.purposes.find((p) => p.key === sub)?.label ?? sub;
    return `${name} · ${label}: ${show(c.from, true, ctx)} → ${show(c.to, true, ctx)}`;
  }
  if (field === 'settings' && sub === NOT_USED) {
    return `${name} · Tidak dipakai: ${c.to === true ? 'ya' : 'tidak'}`;
  }
  return `${name} · ${sub ?? field}: ${show(c.from, false, ctx)} → ${show(c.to, false, ctx)}`;
}
