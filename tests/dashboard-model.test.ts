// Tes model Vanillate Dashboard (src/lib/dashboard/model.ts).
// Jalankan: npm test  (node --experimental-strip-types --test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSavePayload,
  describeError,
  describeIssue,
  diffStates,
  displayStatus,
  formatAuditChange,
  formatWib,
  inviteUrl,
  isDirty,
  isNotUsed,
  NOT_USED,
  supportsNotUsed,
  typedSettings,
  validateSettingValues,
  settingValue,
  roleGrantProblem,
  roleOptions,
  missingPermissions,
  normalizeState,
  permissionWarnings,
  serverIssues,
  channelOptions,
  validateDraft,
  cloneState,
  type ConfigInfo,
  type Feature,
  type Snapshot,
} from '../src/lib/dashboard/model.ts';

const VIEW = { bit: '1024', name: 'View Channel' };
const SEND = { bit: '2048', name: 'Send Messages' };
const THREAD = { bit: '34359738368', name: 'Create Public Threads' };

const registry: Feature[] = [
  {
    key: 'SOCIAL_COUNT', section: 'social', name: 'Counting', sort: 50, default_enabled: false,
    purposes: [{ key: 'activity_channel', label: 'Channel fitur', required: true, unique_scope: 'social', channel_types: [0], permissions: [VIEW, SEND] }],
  },
  {
    key: 'SAMBUNG_KATA', section: 'game', name: 'Sambung Kata', sort: 10, default_enabled: true,
    purposes: [{ key: 'game_channel', label: 'Channel khusus', required: false, channel_types: [0], permissions: [VIEW, SEND, THREAD] }],
  },
  {
    key: 'SOCIAL_STREAK', section: 'social', name: 'Streak Harian', sort: 51, default_enabled: false,
    purposes: [{ key: 'activity_channel', label: 'Channel fitur', required: true, unique_scope: 'social', channel_types: [0], permissions: [VIEW] }],
  },
];

const C1 = '800000000000000001';
const C2 = '800000000000000002';
const VOICE = '800000000000000003';
const CAT = '800000000000000010';

const snapshot: Snapshot = {
  refreshed_at: '2026-10-03T10:00:00Z',
  requested_at: null,
  channels: [
    { id: CAT, name: 'GAME', type: 4, position: 1 },
    { id: C2, name: 'umum', type: 0, position: 0, perms: '1024' },
    { id: C1, name: 'sambung-kata', type: 0, parent_id: CAT, position: 0, perms: String(1024 + 2048) },
    { id: VOICE, name: 'Suara', type: 2, position: 2, perms: '3072' },
  ],
};

const ctx = { registry, snapshot };

test('normalizeState mengisi default registry & membuang channel tak dikenal', () => {
  const s = normalizeState({ SAMBUNG_KATA: { enabled: false, settings: {}, channels: { game_channel: C1, palsu: C2 } } }, registry);
  assert.equal(s.SAMBUNG_KATA.enabled, false);
  assert.deepEqual(s.SAMBUNG_KATA.channels, { game_channel: C1 });
  assert.equal(s.SOCIAL_COUNT.enabled, false);
  assert.deepEqual(s.SOCIAL_STREAK.channels, {});
});

test('diffStates & isDirty mendeteksi perubahan draft', () => {
  const base = normalizeState({}, registry);
  const draft = cloneState(base);
  assert.equal(isDirty(base, draft, registry), false);
  draft.SAMBUNG_KATA.channels.game_channel = C1;
  draft.SOCIAL_COUNT.enabled = true;
  const changes = diffStates(base, draft, registry);
  assert.equal(changes.length, 2);
  assert.deepEqual(changes[0], { feature: 'SAMBUNG_KATA', field: 'channel', key: 'game_channel', from: null, to: C1 });
  assert.deepEqual(changes[1], { feature: 'SOCIAL_COUNT', field: 'enabled', from: false, to: true });
  assert.equal(isDirty(base, draft, registry), true);
});

test('buildSavePayload mengirim seluruh fitur secara deklaratif', () => {
  const s = normalizeState({ SAMBUNG_KATA: { enabled: true, settings: {}, channels: { game_channel: C1 } } }, registry);
  const p = buildSavePayload(s, registry);
  assert.deepEqual(Object.keys(p.features), ['SAMBUNG_KATA', 'SOCIAL_COUNT', 'SOCIAL_STREAK']);
  assert.deepEqual(p.channels, [{ featureKey: 'SAMBUNG_KATA', purpose: 'game_channel', channelId: C1 }]);
});

test('validateDraft mencerminkan aturan server', () => {
  const base = normalizeState({}, registry);
  const d = cloneState(base);
  d.SOCIAL_COUNT.enabled = true;
  assert.deepEqual(validateDraft(d, base, registry, snapshot).map((i) => i.code), ['CHANNEL_REQUIRED']);

  d.SOCIAL_COUNT.channels.activity_channel = C2;
  d.SOCIAL_STREAK.enabled = true;
  d.SOCIAL_STREAK.channels.activity_channel = C2;
  assert.deepEqual(validateDraft(d, base, registry, snapshot).map((i) => i.code), ['CHANNEL_CONFLICT']);

  d.SOCIAL_STREAK.enabled = false; // fitur mati tidak bentrok
  assert.deepEqual(validateDraft(d, base, registry, snapshot), []);

  d.SAMBUNG_KATA.channels.game_channel = VOICE;
  assert.deepEqual(validateDraft(d, base, registry, snapshot).map((i) => i.code), ['CHANNEL_TYPE_INVALID']);
  d.SAMBUNG_KATA.channels.game_channel = '800000000000000099';
  assert.deepEqual(validateDraft(d, base, registry, snapshot).map((i) => i.code), ['CHANNEL_NOT_FOUND']);
  assert.deepEqual(validateDraft(d, base, registry, null).map((i) => i.code), ['NO_DISCORD_DATA']);
});

test('channel tersimpan yang hilang tidak memblokir simpan', () => {
  const base = normalizeState({ SAMBUNG_KATA: { enabled: true, settings: {}, channels: { game_channel: '800000000000000099' } } }, registry);
  const d = cloneState(base);
  d.SOCIAL_COUNT.enabled = false;
  assert.deepEqual(validateDraft(d, base, registry, snapshot), []);
});

test('izin bot yang kurang dihitung dari bitfield', () => {
  const p = registry[1].purposes[0];
  assert.deepEqual(missingPermissions(snapshot.channels[2], p), ['Create Public Threads']);
  assert.deepEqual(missingPermissions({ id: C1, name: 'x', type: 0 }, p), []);
  const s = normalizeState({ SOCIAL_COUNT: { enabled: true, settings: {}, channels: { activity_channel: C2 } } }, registry);
  const w = permissionWarnings(s, registry, snapshot);
  // Sambung Kata aktif tanpa channel → tidak dinilai; Counting di #umum kurang Send Messages.
  assert.equal(w.length, 1);
  assert.deepEqual(w[0].missing, ['Send Messages']);
  assert.match(describeIssue(w[0], ctx), /Bot tidak memiliki permission Send Messages di #umum/);
});

test('channelOptions hanya channel teks, berurutan per kategori', () => {
  const opts = channelOptions(snapshot, registry[1].purposes[0]);
  assert.deepEqual(opts.map((o) => o.id), [C2, C1]);
  assert.equal(opts[1].category, 'GAME');
});

const cfg = (over: Partial<ConfigInfo> = {}): ConfigInfo => ({
  revision: 2, applied_revision: 2, sync_status: 'ACTIVE', attempted_revision: 2, attempted_at: null,
  applied_at: null, last_error: null, health: [], health_checked_at: null, resync_requested_at: null,
  updated_at: '2026-10-03T10:00:00Z', updated_by: null, updated_by_name: null, updated_source: 'web', ...over,
});
const bot = { installed: true, online: true, last_heartbeat_at: null, version: null };

test('displayStatus: Active hanya bila bot sudah menerapkan', () => {
  assert.equal(displayStatus({ bot, config: cfg() }), 'ACTIVE');
  assert.equal(displayStatus({ bot, config: cfg({ revision: 3, sync_status: 'SYNCING' }) }), 'SYNCING');
  assert.equal(displayStatus({ bot, config: cfg({ revision: 3, sync_status: 'SYNCING' }), justSaved: true }), 'SAVED');
  assert.equal(displayStatus({ bot, config: cfg({ sync_status: 'NEEDS_ATTENTION' }) }), 'NEEDS_ATTENTION');
  assert.equal(displayStatus({ bot: { ...bot, online: false }, config: cfg() }), 'BOT_OFFLINE');
  assert.equal(displayStatus({ bot: { ...bot, installed: false }, config: cfg(), dirty: true }), 'NOT_INSTALLED');
  assert.equal(displayStatus({ bot, config: cfg(), dirty: true }), 'DRAFT');
  assert.equal(displayStatus({ bot, config: cfg(), saving: true }), 'SAVING');
  assert.equal(displayStatus({ bot, config: cfg(), dirty: true, saving: true }), 'SAVING', 'menyimpan mengalahkan draft');
  assert.equal(displayStatus({ bot, config: null }), 'ACTIVE');
});

test('serverIssues: error apply hanya untuk revisi terbaru, health untuk revisi berlaku', () => {
  const err = [{ code: 'CHANNEL_NOT_FOUND', feature: 'SAMBUNG_KATA' }];
  assert.equal(serverIssues(cfg({ revision: 3, attempted_revision: 3, last_error: err })).length, 1);
  assert.equal(serverIssues(cfg({ revision: 4, attempted_revision: 3, last_error: err })).length, 0);
  assert.equal(serverIssues(cfg({ health: err })).length, 1);
});

test('pesan error jelas & bisa ditindaklanjuti', () => {
  assert.match(describeError('STALE_REVISION', { current_revision: 7 }), /revisi 7/);
  assert.match(describeError('ACCESS_DENIED'), /Manage Server/);
  assert.match(describeError('apa-ini'), /Coba lagi/);
  assert.match(describeIssue({ code: 'CHANNEL_REQUIRED', feature: 'SOCIAL_STREAK' }, ctx), /Streak Harian butuh channel/);
  assert.match(describeIssue({ code: 'CHANNEL_CONFLICT', feature: 'SOCIAL_STREAK', other_feature: 'SOCIAL_COUNT', channel_id: C2 }, ctx), /Streak Harian dan Counting/);
  assert.match(describeIssue({ code: 'CHANNEL_NOT_FOUND', feature: 'SAMBUNG_KATA', channel_id: '800000000000000099' }, ctx), /channel-terhapus/);
});

test('audit & waktu ditampilkan dalam bahasa manusia (WIB)', () => {
  assert.equal(
    formatAuditChange({ path: 'SAMBUNG_KATA.channels.game_channel', from: null, to: C1 }, ctx),
    'Sambung Kata · Channel khusus: tidak diatur → #sambung-kata',
  );
  assert.equal(formatAuditChange({ path: 'SOCIAL_COUNT.enabled', from: false, to: true }, ctx), 'Counting · Status: OFF → ON');
  assert.equal(formatAuditChange({ previous_actor_id: '100000000000000002', previous_actor_name: 'budi' }, ctx), 'Sebelumnya atas nama budi');
  assert.match(formatWib('2026-10-03T17:30:00Z'), /4 Okt 2026.*00[.:]30 WIB/);
});

test('inviteUrl mengunci ke server yang dipilih', () => {
  const u = new URL(inviteUrl('1513806760622817320', '876173413440', '900000000000000001')!);
  assert.equal(u.searchParams.get('guild_id'), '900000000000000001');
  assert.equal(u.searchParams.get('disable_guild_select'), 'true');
  assert.equal(u.searchParams.get('scope'), 'bot applications.commands');
  assert.equal(inviteUrl('', '0', '900000000000000001'), null);
});

test('🚫 Tidak dipakai: hanya fitur dengan setelan not_used dari bot, hanya saat OFF', () => {
  const social: Feature = { ...registry[0], settings_schema: { properties: { [NOT_USED]: { type: 'boolean' } } } };
  assert.equal(supportsNotUsed(social), true);
  assert.equal(supportsNotUsed(registry[1]), false);
  assert.equal(supportsNotUsed(registry[0]), false);

  assert.equal(isNotUsed({ enabled: false, settings: { not_used: true }, channels: {} }), true);
  assert.equal(isNotUsed({ enabled: false, settings: { not_used: false }, channels: {} }), false);
  assert.equal(isNotUsed({ enabled: true, settings: { not_used: true }, channels: {} }), false);
  assert.equal(isNotUsed(undefined), false);

  // Ikut payload simpan & tercatat rapi di audit.
  const st = normalizeState({ SOCIAL_COUNT: { enabled: false, settings: { not_used: true }, channels: {} } }, [social]);
  assert.deepEqual(buildSavePayload(st, [social]).features.SOCIAL_COUNT, { enabled: false, settings: { not_used: true } });
  assert.equal(
    formatAuditChange({ path: 'SOCIAL_COUNT.settings.not_used', from: null, to: true }, { registry: [social], snapshot }),
    'Counting · Tidak dipakai: ya',
  );
});

// ─── Setelan bertipe + role (Verification) ──────────────────────────────────
const ROLE_A = '700000000000000001';
const ROLE_B = '700000000000000002';
const verification: Feature = {
  key: 'VERIFICATION', section: 'verification', name: 'Verification', sort: 5, default_enabled: false,
  purposes: [{ key: 'verify_channel', label: 'Channel verifikasi', required: true, channel_types: [0], permissions: [VIEW] }],
  settings_schema: {
    properties: {
      verified_role: { type: 'role', required: true, title: 'Verified Role' },
      steps: { type: 'integer', min: 1, max: 5, default: 3, title: 'Jumlah langkah' },
      panel_title: { type: 'string', max_length: 80, title: 'Judul panel' },
    },
  },
};
const roleSnapshot: Snapshot = {
  ...snapshot,
  bot_top_position: 5,
  roles: [
    { id: ROLE_A, name: 'Verified', position: 3 },
    { id: ROLE_B, name: 'Admin', position: 8 },
    { id: '700000000000000003', name: 'Bot-Integrasi', position: 1, managed: true },
  ],
};
const vState = (settings: Record<string, unknown>, enabled = true) =>
  normalizeState({ VERIFICATION: { enabled, settings, channels: { verify_channel: C1 } } }, [verification]);

test('typedSettings membaca schema; settingValue jatuh ke default', () => {
  assert.deepEqual(typedSettings(verification).map((p) => p.key), ['verified_role', 'steps', 'panel_title']);
  assert.equal(typedSettings(registry[0]).length, 0);
  assert.equal(settingValue(verification, vState({}).VERIFICATION, 'steps'), 3);
  assert.equal(settingValue(verification, vState({ steps: 5 }).VERIFICATION, 'steps'), 5);
});

test('validateDraft: rentang, wajib, tipe, role tak dikenal (cermin RPC)', () => {
  const codes = (settings: Record<string, unknown>, enabled = true) =>
    validateDraft(vState(settings, enabled), vState({}, false), [verification], roleSnapshot).map((i) => `${i.code}:${i.key ?? ''}`);
  assert.deepEqual(codes({ verified_role: ROLE_A, steps: 3 }), []);
  assert.deepEqual(codes({ verified_role: ROLE_A, steps: 6 }), ['SETTING_OUT_OF_RANGE:steps']);
  assert.deepEqual(codes({ verified_role: ROLE_A, steps: 0 }), ['SETTING_OUT_OF_RANGE:steps']);
  assert.deepEqual(codes({ verified_role: ROLE_A, steps: 2.5 }), ['SETTING_INVALID:steps']);
  assert.deepEqual(codes({ steps: 3 }), ['SETTING_REQUIRED:verified_role']);
  assert.deepEqual(codes({}, false), []); // wajib hanya bila aktif
  assert.deepEqual(codes({ verified_role: '700000000000000099' }), ['ROLE_NOT_FOUND:verified_role']);
  assert.deepEqual(codes({ verified_role: ROLE_A, panel_title: 'x'.repeat(81) }), ['SETTING_INVALID:panel_title']);
});

test('role yang sudah tersimpan tidak diperiksa ulang terhadap snapshot', () => {
  const base = vState({ verified_role: '700000000000000099' });
  const issues = validateDraft(vState({ verified_role: '700000000000000099' }), base, [verification], roleSnapshot);
  assert.equal(issues.some((i) => i.code === 'ROLE_NOT_FOUND'), false);
});

test('roleGrantProblem & peringatan: managed / posisi >= role bot', () => {
  assert.equal(roleGrantProblem(roleSnapshot, ROLE_A), null);
  assert.match(roleGrantProblem(roleSnapshot, ROLE_B) ?? '', /sejajar atau di atas/);
  assert.match(roleGrantProblem(roleSnapshot, '700000000000000003') ?? '', /integrasi/);
  assert.equal(roleGrantProblem(roleSnapshot, null), null);
  const w = permissionWarnings(vState({ verified_role: ROLE_B }), [verification], roleSnapshot);
  assert.deepEqual(w.map((i) => i.code), ['ROLE_UNUSABLE']);
  assert.match(describeIssue(w[0], { registry: [verification], snapshot: roleSnapshot }), /@Admin tidak bisa diberikan bot/);
  assert.deepEqual(permissionWarnings(vState({ verified_role: ROLE_A }), [verification], roleSnapshot), []);
});

test('roleOptions: posisi tertinggi dulu; describeIssue memberi kalimat untuk kode setelan', () => {
  assert.deepEqual(roleOptions(roleSnapshot).map((r) => r.name), ['Admin', 'Verified', 'Bot-Integrasi']);
  const ctx = { registry: [verification], snapshot: roleSnapshot };
  assert.match(describeIssue({ code: 'SETTING_OUT_OF_RANGE', feature: 'VERIFICATION', key: 'steps', min: 1, max: 5 }, ctx), /Jumlah langkah harus antara 1 dan 5/);
  assert.match(describeIssue({ code: 'SETTING_REQUIRED', feature: 'VERIFICATION', key: 'verified_role' }, ctx), /Verified Role wajib diisi/);
  assert.match(describeIssue({ code: 'ROLE_NOT_FOUND', feature: 'VERIFICATION', key: 'verified_role' }, ctx), /Refresh Discord Data/);
});

test('buildSavePayload membawa setelan bertipe apa adanya', () => {
  const st = vState({ verified_role: ROLE_A, steps: 4 });
  assert.deepEqual(buildSavePayload(st, [verification]).features.VERIFICATION, {
    enabled: true,
    settings: { verified_role: ROLE_A, steps: 4 },
  });
});

test('setelan Leveling: daftar channel/role, help, rentang XP & cooldown', () => {
  const leveling: Feature = {
    key: 'LEVELING', section: 'leveling', name: 'Leveling', sort: 6, default_enabled: false,
    purposes: [{ key: 'levelup_channel', label: 'Channel naik level', required: false, channel_types: [0] }],
    settings_schema: {
      properties: {
        chat_xp: { type: 'integer', min: 1, max: 100, default: 10, title: 'XP per pesan' },
        chat_cooldown: { type: 'integer', min: 30, max: 3600, default: 60, title: 'Cooldown XP chat (detik)' },
        blacklist_channels: { type: 'channel_list', max_items: 2, title: 'Channel tanpa XP' },
        levelup_message: { type: 'string', max_length: 500, title: 'Pesan naik level', help: 'Variabel: {tag} {level}' },
      },
    },
  };
  assert.equal(typedSettings(leveling).find((p) => p.key === 'levelup_message')?.help, 'Variabel: {tag} {level}');
  const st = (settings: Record<string, unknown>) => normalizeState({ LEVELING: { enabled: true, settings, channels: {} } }, [leveling]).LEVELING;
  const codes = (settings: Record<string, unknown>) => validateSettingValues(leveling, st(settings)).map((i) => `${i.code}:${i.key}`);
  assert.deepEqual(codes({ chat_xp: 100, chat_cooldown: 30 }), []);
  assert.deepEqual(codes({ chat_xp: 101 }), ['SETTING_OUT_OF_RANGE:chat_xp']);
  assert.deepEqual(codes({ chat_xp: 0 }), ['SETTING_OUT_OF_RANGE:chat_xp']);
  assert.deepEqual(codes({ chat_cooldown: 29 }), ['SETTING_OUT_OF_RANGE:chat_cooldown']);
  assert.deepEqual(codes({ blacklist_channels: [C1, C2, VOICE] }), ['SETTING_INVALID:blacklist_channels']);
  assert.deepEqual(codes({ blacklist_channels: [C1, 'abc'] }), ['SETTING_INVALID:blacklist_channels']);
  assert.deepEqual(codes({ blacklist_channels: [C1, C2] }), []);
  assert.deepEqual(codes({ levelup_message: 'x'.repeat(501) }), ['SETTING_INVALID:levelup_message']);
});

test('reward_list: batas per kategori, level unik, role konflik Verified Role, role tak bisa diberikan', () => {
  const lev: Feature = {
    key: 'LEVELING', section: 'leveling', name: 'Leveling', sort: 6, default_enabled: false, purposes: [],
    settings_schema: { properties: { rewards: { type: 'reward_list', title: 'Role reward', limits: { chat: 2, voice: 1, combined: 1 }, max_level: 1000 } } },
  };
  const both = [verification, lev];
  const mk = (rewards: unknown, verified = ROLE_A) =>
    normalizeState({
      VERIFICATION: { enabled: true, settings: { verified_role: verified }, channels: { verify_channel: C1 } },
      LEVELING: { enabled: true, settings: { rewards }, channels: {} },
    }, both);
  const codes = (rewards: unknown, verified = ROLE_A) =>
    validateDraft(mk(rewards, verified), mk([], verified), both, roleSnapshot).map((i) => i.code).filter((c) => c !== 'ROLE_NOT_FOUND' || true);
  const r = (category: string, level: number, role_id = ROLE_B) => ({ category, level, role_id });
  assert.deepEqual(codes([r('chat', 5), r('chat', 10), r('voice', 3), r('combined', 10)]), []);
  assert.ok(codes([r('chat', 1), r('chat', 2), r('chat', 3)]).includes('REWARD_LIMIT'));
  assert.ok(codes([r('voice', 1), r('voice', 2)]).includes('REWARD_LIMIT'));
  assert.ok(codes([r('chat', 5), r('chat', 5)]).includes('REWARD_DUPLICATE'));
  assert.ok(codes([{ category: 'chat', level: 0, role_id: ROLE_B }]).includes('SETTING_INVALID'));
  assert.ok(codes([{ category: 'chat', level: null, role_id: '' }]).includes('SETTING_INVALID'));
  assert.ok(codes([r('chat', 5, '700000000000000099')]).includes('ROLE_NOT_FOUND'));
  assert.ok(codes([r('chat', 5, ROLE_A)]).includes('ROLE_CONFLICT'));
  const w = permissionWarnings(mk([r('chat', 5, ROLE_B)]), both, roleSnapshot).filter((i) => i.feature === 'LEVELING');
  assert.deepEqual(w.map((i) => i.code), ['ROLE_UNUSABLE']);
  assert.match(describeIssue({ code: 'REWARD_LIMIT', feature: 'LEVELING', category: 'combined', max: 5 }, { registry: both, snapshot: roleSnapshot }), /Combined melebihi batas \(maks\. 5\)/);
  assert.match(describeIssue({ code: 'ROLE_CONFLICT', feature: 'LEVELING', role_id: ROLE_A }, { registry: both, snapshot: roleSnapshot }), /Verified Role/);
});
