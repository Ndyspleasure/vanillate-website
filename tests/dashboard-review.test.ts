// Tes fitur tinjau, Riwayat, langkah awal, dan navigasi Vanillate Dashboard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cloneState, diffStates, normalizeState, type AuditRow, type Feature, type GuildData, type Snapshot } from '../src/lib/dashboard/model.ts';
import {
  auditToCsv,
  describeChange,
  filterAudit,
  formatSettingValue,
  copyFromServer,
  recoverDraft,
  restoreState,
  revertChanges,
  revertible,
  setupSteps,
} from '../src/lib/dashboard/review-model.ts';
import { hubOf, parseTabHash, SERVER_GROUPS, SERVER_TABS, TAB_IDS, tabOfFeature, REMOVED_SECTIONS, withoutRemoved } from '../src/lib/dashboard/nav-model.ts';

const CH_A = '910000000000000001';
const CH_B = '910000000000000002';
const ROLE = '920000000000000001';

const registry: Feature[] = [
  { key: 'GAME', section: 'game', name: 'Sambung Kata', sort: 1, default_enabled: true, purposes: [{ key: 'main', label: 'Channel khusus' }] },
  {
    key: 'SOC', section: 'social', name: 'Counting', sort: 2, default_enabled: false, purposes: [{ key: 'main', label: 'Channel khusus', required: true }],
    settings_schema: { properties: { not_used: { type: 'boolean', title: 'Tidak dipakai' } } },
  },
  {
    key: 'VER', section: 'verification', name: 'Verification', sort: 3, default_enabled: false, purposes: [],
    settings_schema: { properties: {
      verified_role: { type: 'role', title: 'Verified Role' },
      steps: { type: 'integer', title: 'Jumlah langkah' },
      mode: { type: 'enum', title: 'Mode', values: ['a', 'b'], labels: { a: 'Mode A', b: 'Mode B' } },
      roles: { type: 'role_list', title: 'Role' },
      text: { type: 'string', title: 'Judul panel' },
    } },
  },
];
const snapshot: Snapshot = {
  refreshed_at: '2026-11-17T00:00:00Z', requested_at: null,
  channels: [{ id: CH_A, name: 'umum', type: 0 }, { id: CH_B, name: 'game', type: 0 }],
  roles: [{ id: ROLE, name: 'Terverifikasi', position: 1 }],
};
const ctx = { registry, snapshot };
const base = () => normalizeState({ GAME: { enabled: true, settings: {}, channels: { main: CH_A } }, VER: { enabled: true, settings: { steps: 5 }, channels: {} } }, registry);

test('describeChange: bahasa admin, bukan kunci atau JSON mentah', () => {
  const a = base();
  const b = cloneState(a);
  b.GAME.enabled = false;
  b.GAME.channels.main = CH_B;
  b.VER.settings.verified_role = ROLE;
  b.VER.settings.mode = 'b';
  b.SOC.settings.not_used = true;
  const lines = diffStates(a, b, registry).map((c) => describeChange(c, ctx));
  assert.deepEqual(lines.map((l) => `${l.featureName}|${l.label}|${l.from}|${l.to}`), [
    'Sambung Kata|Status|ON|OFF',
    'Sambung Kata|Channel khusus|#umum|#game',
    'Counting|Tidak dipakai|tidak|ya',
    'Verification|Mode|kosong|Mode B',
    'Verification|Verified Role|kosong|@Terverifikasi',
  ]);
});

test('formatSettingValue: daftar, teks panjang, dan nilai kosong', () => {
  const p = (type: string) => ({ key: 'k', type, title: 'T', required: false }) as never;
  assert.equal(formatSettingValue(p('role_list'), [ROLE], ctx), '@Terverifikasi');
  assert.equal(formatSettingValue(p('role_list'), ['1', '2', '3', '4'], ctx), '4 role');
  assert.equal(formatSettingValue(p('reward_list'), [{}, {}], ctx), '2 reward');
  assert.equal(formatSettingValue(p('string'), '', ctx), 'kosong');
  assert.equal(formatSettingValue(p('string'), 'x'.repeat(200), ctx).length, 62);
  assert.equal(formatSettingValue(undefined, false, ctx), 'OFF');
});

test('revertChanges: memuat nilai lama ke draft tanpa mengubah draft asal', () => {
  const draft = base();
  draft.GAME.channels.main = CH_B;
  const before = JSON.stringify(draft);
  const r = revertChanges(draft, [
    { path: 'GAME.channels.main', from: CH_A, to: CH_B },
    { path: 'GAME.enabled', from: false, to: true },
    { path: 'VER.settings.steps', from: null, to: 5 },
    { path: 'VER.settings.roles', from: [ROLE], to: null },
  ], registry);
  assert.equal(JSON.stringify(draft), before, 'draft asal tidak disentuh');
  assert.equal(r.applied, 4);
  assert.equal(r.skipped, 0);
  assert.equal(r.draft.GAME.channels.main, CH_A);
  assert.equal(r.draft.GAME.enabled, false);
  assert.equal('steps' in r.draft.VER.settings, false);
  assert.deepEqual(r.draft.VER.settings.roles, [ROLE]);
});

test('revertChanges: melewati yang tidak dikenal, tidak sah, atau sudah sama', () => {
  const draft = base();
  const r = revertChanges(draft, [
    { path: 'HILANG.enabled', from: true, to: false },
    { path: 'GAME.channels.tidak_ada', from: CH_A, to: null },
    { path: 'GAME.channels.main', from: 'bukan-id', to: CH_A },
    { path: 'GAME.enabled', from: 'ya', to: true },
    { path: 'GAME.enabled', from: true, to: false },
    { code: 'MISSING_PERMISSIONS', feature: 'GAME' },
    { previous_actor_id: '1' },
  ], registry);
  assert.equal(r.applied, 0);
  assert.equal(r.skipped, 5);
  assert.deepEqual(r.draft, draft);
  assert.equal(revertChanges(draft, null, registry).applied, 0);
});

test('revertChanges: mengaktifkan lagi membatalkan "Tidak dipakai"', () => {
  const draft = normalizeState({ SOC: { enabled: false, settings: { not_used: true }, channels: {} } }, registry);
  const r = revertChanges(draft, [{ path: 'SOC.enabled', from: true, to: false }], registry);
  assert.equal(r.draft.SOC.enabled, true);
  assert.equal(r.draft.SOC.settings.not_used, false);
});

const rows: AuditRow[] = [
  { id: 3, actor_id: '1', actor_name: 'Budi', source: 'web', revision: 7, action: 'config.save', changed_fields: [{ path: 'GAME.channels.main', from: CH_A, to: CH_B }], created_at: '2026-11-16T10:00:00Z' },
  { id: 2, actor_id: '2', actor_name: null, source: 'bot', revision: 7, action: 'sync.applied', changed_fields: [], created_at: '2026-11-16T10:00:05Z' },
  { id: 1, actor_id: '3', actor_name: '=HYPERLINK("x")', source: 'discord', revision: 6, action: 'config.discord', changed_fields: [{ path: 'VER.enabled', from: false, to: true }], created_at: '2026-11-15T10:00:00Z' },
];

test('filterAudit: jenis dan pencarian pada baris yang sudah dimuat', () => {
  assert.deepEqual(filterAudit(rows, { kind: 'config', query: '' }, ctx).map((r) => r.id), [3, 1]);
  assert.deepEqual(filterAudit(rows, { kind: 'sync', query: '' }, ctx).map((r) => r.id), [2]);
  assert.deepEqual(filterAudit(rows, { kind: 'all', query: ' #GAME ' }, ctx).map((r) => r.id), [3]);
  assert.deepEqual(filterAudit(rows, { kind: 'all', query: 'revisi 6' }, ctx).map((r) => r.id), [1]);
  assert.deepEqual(filterAudit(rows, { kind: 'sync', query: 'budi' }, ctx), []);
});

test('revertible: hanya perubahan konfigurasi yang punya nilai lama', () => {
  assert.equal(revertible(rows[0]), true);
  assert.equal(revertible(rows[1]), false);
  assert.equal(revertible({ action: 'config.save', changed_fields: [{ previous_actor_id: '1' }] }), false);
  assert.equal(revertible({ action: 'sync.failed', changed_fields: [{ path: 'GAME.enabled', from: true, to: false }] }), false);
});

test('auditToCsv: kutip aman dan rumus spreadsheet dinetralkan', () => {
  const csv = auditToCsv(rows, ctx).split('\r\n');
  assert.equal(csv.length, 4);
  assert.match(csv[0], /^"Waktu \(WIB\)","Revisi"/);
  assert.match(csv[1], /"Budi","Website","Mengubah konfigurasi","Sambung Kata · Channel khusus: #umum → #game"$/);
  assert.match(csv[3], /"'=HYPERLINK\(""x""\)"/);
});

test('setupSteps: langkah awal dari data yang sudah dimuat', () => {
  const data = (over: Partial<GuildData> = {}) => ({
    bot: { installed: true, online: true, last_heartbeat_at: null, version: null },
    config: null, registry, snapshot, ...over,
  }) as Pick<GuildData, 'bot' | 'config' | 'registry' | 'snapshot'>;
  let steps = setupSteps(data(), base());
  assert.deepEqual(steps.map((s) => [s.id, s.done]), [['bot', true], ['snapshot', true], ['social', false], ['sync', true]]);
  assert.match(steps[2].hint, /Counting/);

  const decided = normalizeState({ SOC: { enabled: false, settings: { not_used: true }, channels: {} } }, registry);
  assert.equal(setupSteps(data(), decided).every((s) => s.done), true);

  steps = setupSteps(data({ bot: { installed: false, online: false, last_heartbeat_at: null, version: null }, snapshot: null }), base());
  assert.deepEqual(steps.filter((s) => !s.done).map((s) => s.id), ['bot', 'snapshot', 'social', 'sync']);

  const cfg = { revision: 3, applied_revision: 2, sync_status: 'SYNCING' } as GuildData['config'];
  assert.equal(setupSteps(data({ config: cfg }), decided).find((s) => s.id === 'sync')!.done, false);
  // Tanpa fitur sosial berpilihan "Tidak dipakai", langkahnya tidak ada.
  assert.equal(setupSteps(data({ registry: [registry[0]] }), base()).some((s) => s.id === 'social'), false);
});

test('navigasi: hash lama tetap berlaku dan setiap tab punya tempat', () => {
  for (const h of ['overview', 'game-hub', 'social-hub', 'verification', 'leveling', 'share-server', 'channels', 'audit-log', 'autorole', 'welcome', 'security', 'copy']) {
    assert.equal(parseTabHash(`#${h}`, 'verification'), h);
  }
  assert.equal(parseTabHash('#server-hub', 'leveling'), 'leveling');
  assert.equal(parseTabHash('#tidak-ada', 'leveling'), 'overview');
  assert.equal(parseTabHash('', 'leveling'), 'overview');
  assert.equal(hubOf('share-server'), 'server-hub');
  assert.equal(hubOf('game-hub'), 'game-hub');
  assert.equal(new Set(TAB_IDS).size, TAB_IDS.length);
  assert.equal(SERVER_TABS.length, SERVER_GROUPS.reduce((n, g) => n + g.tabs.length, 0));
  assert.equal(tabOfFeature({ section: 'security' }), 'security');
  assert.equal(tabOfFeature({ section: 'baru' }), 'game-hub');
});

test('Sapa Voice dicabut dari dashboard: tab hilang dan baris registry lama disaring', () => {
  assert.ok(!TAB_IDS.includes('voice-sapa' as never), 'tidak ada tab Sapa Voice');
  assert.equal(parseTabHash('#voice-sapa', 'leveling'), 'overview', 'tautan lama jatuh ke ringkasan');
  // Baris lama tetap ada di database (RPC publikasi tidak menghapus) dan bagian tak dikenal
  // jatuh ke Game Hub: disaring supaya tidak pernah muncul di sana.
  assert.equal(tabOfFeature({ section: 'voice_sapa' }), 'game-hub');
  const registry = [{ section: 'game', key: 'GAME_X' }, { section: 'voice_sapa', key: 'VOICE_SAPA' }, { section: 'security', key: 'SECURITY' }];
  assert.deepEqual(withoutRemoved(registry).map((f) => f.key), ['GAME_X', 'SECURITY']);
  assert.ok(REMOVED_SECTIONS.includes('voice_sapa'));
});

test('restoreState: memulihkan isi revisi utuh, fitur yang tidak ada di revisi itu dibiarkan', () => {
  const draft = base();
  draft.SOC.enabled = true;
  const stored = { GAME: { enabled: false, settings: {}, channels: { main: CH_B } }, VER: { enabled: true, settings: { steps: 3, mode: 'a' }, channels: {} }, HILANG: { enabled: true, settings: {}, channels: {} } };
  const r = restoreState(draft, stored as never, registry);
  assert.equal(r.draft.GAME.enabled, false);
  assert.equal(r.draft.GAME.channels.main, CH_B);
  assert.deepEqual(r.draft.VER.settings, { steps: 3, mode: 'a' });
  assert.equal(r.draft.SOC.enabled, true, 'fitur yang tidak ada di revisi tidak disentuh');
  assert.equal('HILANG' in r.draft, false);
  assert.equal(r.applied, 4);
  assert.equal(draft.GAME.enabled, true, 'draft asal tidak disentuh');
  assert.equal(restoreState(draft, null, registry).applied, 0);
  assert.equal(restoreState(r.draft, stored as never, registry).applied, 0);
});

test('copyFromServer: menyalin status dan setelan umum, bukan channel atau role', () => {
  const draft = base();
  const source = {
    GAME: { enabled: false, settings: {}, channels: { main: '999999999999999999' } },
    SOC: { enabled: false, settings: { not_used: true }, channels: {} },
    VER: { enabled: true, settings: { steps: 8, mode: 'b', text: 'Halo', verified_role: '888888888888888888', roles: ['777777777777777777'] }, channels: {} },
  };
  const r = copyFromServer(draft, source as never, registry);
  assert.equal(r.draft.GAME.enabled, false);
  assert.equal(r.draft.GAME.channels.main, CH_A, 'channel server ini dipertahankan');
  assert.equal(r.draft.SOC.settings.not_used, true);
  assert.deepEqual(r.draft.VER.settings, { steps: 8, mode: 'b', text: 'Halo' });
  assert.equal(r.skipped, 3); // satu channel, satu role, satu daftar role
  assert.equal(r.applied, 5);
  assert.equal(copyFromServer(draft, undefined, registry).applied, 0);
});

test('copyFromServer: fitur yang seluruhnya terkunci tidak diaktifkan', () => {
  const locked: Feature[] = [{ key: 'AR', section: 'autorole', name: 'Auto Role', sort: 1, default_enabled: false, purposes: [], settings_schema: { properties: { roles: { type: 'role_list', title: 'Role', available: false } } } }];
  const draft = normalizeState({}, locked);
  const r = copyFromServer(draft, { AR: { enabled: true, settings: {}, channels: {} } }, locked);
  assert.equal(r.draft.AR.enabled, false);
  assert.equal(r.applied, 0);
});

test('recoverDraft: hanya bila revisinya sama dan memang ada perubahan', () => {
  const b = base();
  const edited = cloneState(b);
  edited.GAME.enabled = false;
  assert.equal(recoverDraft({ rev: 5, draft: edited }, b, 5, registry)!.GAME.enabled, false);
  assert.equal(recoverDraft({ rev: 4, draft: edited }, b, 5, registry), null, 'revisi berubah: simpanan dibuang');
  assert.equal(recoverDraft({ rev: 5, draft: b }, b, 5, registry), null, 'tidak ada perubahan');
  assert.equal(recoverDraft(null, b, 5, registry), null);
  assert.equal(recoverDraft({ rev: 5, draft: 'rusak' }, b, 5, registry), null);
  // Fitur baru di registry yang belum ada di simpanan memakai nilai server.
  const partial = { rev: 5, draft: { GAME: edited.GAME } };
  assert.deepEqual(recoverDraft(partial, b, 5, registry)!.VER, b.VER);
});
