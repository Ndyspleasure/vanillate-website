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
