// Tes buku panduan kendala Vanillate Dashboard (src/lib/dashboard/issue-guide.ts).
// Acuan teks: docs/DASHBOARD-PANDUAN-KENDALA.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  badgeGuides,
  buildGuides,
  contactMessage,
  describeIssue,
  hasUnseen,
  issueGuide,
  pageGuides,
  PERMISSION_ID,
  permissionLabel,
  popupGuides,
  roleReason,
  sortGuides,
  type Guide,
  type IssueSource,
} from '../src/lib/dashboard/issue-guide.ts';
import { PERMISSION_BITS, roleGrantIssue, type Feature, type Issue, type Snapshot, type TextContext } from '../src/lib/dashboard/model.ts';

const INVITE = '2252747126074611';
const all = (names: string[]) => names.reduce((v, n) => v | PERMISSION_BITS[n], 0n).toString();
const CH1 = '800000000000000001';
const CH2 = '800000000000000002';
const CH3 = '800000000000000003';
const ROLE = '700000000000000001';

const snap = (perms: string | null, extra: Partial<Snapshot> = {}): Snapshot =>
  ({
    refreshed_at: '2026-11-28T00:00:00Z',
    requested_at: null,
    channels: [
      { id: CH1, name: 'game', type: 0 },
      { id: CH2, name: 'uno', type: 0 },
      { id: CH3, name: 'werewolf', type: 0 },
    ],
    roles: [{ id: ROLE, name: 'Member', position: 5 }],
    bot_permissions: perms,
    ...extra,
  }) as Snapshot;

const feat = (key: string, name: string): Feature => ({ key, name, section: 'game', sort: 0, purposes: [], meta: {} }) as unknown as Feature;
const registry = [feat('SAMBUNG_KATA', 'Sambung Kata'), feat('UNO', 'UNO'), feat('WEREWOLF', 'Werewolf'), feat('VERIFICATION', 'Verification')];
const ctx = (s: Snapshot | null): TextContext => ({ registry, snapshot: s, invitePermissions: INVITE });

/** Semua kode yang dikenal buku panduan, beserta cabangnya. */
const SAMPLES: Issue[] = [
  { code: 'MISSING_PERMISSIONS', feature: 'UNO', channel_id: CH1, missing: ['Send Messages'] },
  { code: 'MISSING_GUILD_PERMISSIONS', feature: 'UNO', missing: ['View Audit Log'] },
  { code: 'MISSING_GUILD_PERMISSIONS', feature: 'UNO', missing: ['Izin Baru'] },
  { code: 'CHANNEL_NOT_FOUND', feature: 'UNO', channel_id: '800000000000000099' },
  { code: 'CHANNEL_TYPE_INVALID', feature: 'UNO', channel_id: CH1 },
  { code: 'CHANNEL_REQUIRED', feature: 'UNO' },
  { code: 'CHANNEL_CONFLICT', feature: 'UNO', other_feature: 'WEREWOLF', channel_id: CH1 },
  { code: 'ROLE_NOT_FOUND', feature: 'VERIFICATION', key: 'verified_role' },
  { code: 'ROLE_UNUSABLE', feature: 'VERIFICATION', key: 'verified_role', role_id: ROLE, reason_code: 'MANAGE_ROLES_MISSING' },
  { code: 'ROLE_UNUSABLE', feature: 'VERIFICATION', key: 'verified_role', role_id: ROLE, reason_code: 'ROLE_TOO_LOW' },
  { code: 'ROLE_UNUSABLE', feature: 'VERIFICATION', key: 'verified_role', role_id: ROLE, reason_code: 'ROLE_MANAGED' },
  { code: 'ROLE_UNUSABLE', feature: 'VERIFICATION', key: 'notify_roles', role_id: ROLE, reason_code: 'EVERYONE' },
  { code: 'ROLE_UNUSABLE', feature: 'VERIFICATION', key: 'notify_roles', role_id: ROLE, reason_code: 'NOT_MENTIONABLE' },
  { code: 'ROLE_UNUSABLE', feature: 'VERIFICATION', key: 'verified_role', role_id: ROLE, reason: 'alasan baru dari bot' },
  { code: 'ROLE_CONFLICT', feature: 'VERIFICATION', key: 'unverified_role', role_id: ROLE },
  { code: 'ROLE_CONFLICT', feature: 'VERIFICATION', key: 'member_roles', role_id: ROLE },
  { code: 'ROLE_CONFLICT', feature: 'VERIFICATION', key: 'rewards', role_id: ROLE },
  { code: 'SETTING_REQUIRED', feature: 'VERIFICATION', key: 'verified_role' },
  { code: 'SETTING_OUT_OF_RANGE', feature: 'VERIFICATION', key: 'steps', min: 1, max: 5 },
  { code: 'SETTING_INVALID', feature: 'VERIFICATION', key: 'steps' },
  { code: 'REWARD_LIMIT', feature: 'VERIFICATION', category: 'chat', max: 5 },
  { code: 'REWARD_DUPLICATE', feature: 'VERIFICATION', category: 'voice', level: 10 },
  { code: 'NO_DISCORD_DATA' },
  { code: 'BOT_NOT_IN_GUILD' },
  { code: 'ACTOR_FORBIDDEN' },
  { code: 'APPLY_FAILED' },
  { code: 'UNKNOWN_FEATURE', feature: 'BARU' },
  { code: 'UNKNOWN_PURPOSE', feature: 'UNO' },
  { code: 'INVALID_PAYLOAD', feature: 'UNO' },
  { code: 'KODE_MASA_DEPAN', feature: 'UNO' },
];
const SNAPS = [snap(all(['View Channel'])), snap(all(['View Channel', 'Send Messages', 'View Audit Log'])), snap(all(['Administrator'])), snap(null), null];
const DASH = /—|–| - /;

function allGuides(): Guide[] {
  const out: Guide[] = [];
  for (const s of SNAPS) for (const i of SAMPLES) for (const src of ['bot', 'live', 'draft'] as IssueSource[]) out.push(issueGuide(i, ctx(s), src));
  return out;
}

test('setiap kendala punya judul, penyebab, langkah, dan tanpa tanda pisah', () => {
  for (const g of allGuides()) {
    assert.ok(g.title.trim(), `judul kosong: ${g.code}`);
    assert.ok(g.cause.trim(), `penyebab kosong: ${g.code}`);
    assert.ok(g.steps.length >= 1 && g.steps.length <= 4, `langkah ${g.code}: ${g.steps.length}`);
    for (const t of [g.title, g.cause, ...g.steps]) assert.doesNotMatch(t, DASH, `${g.code}: ${t}`);
    // Kartu merah selalu punya tombol (dan halaman menambah Hubungi tim).
    if (g.level === 'red') assert.ok(g.actions.length >= 1, `kartu merah tanpa tombol: ${g.code}`);
  }
});

test('kendala halaman juga mengikuti aturan teks', () => {
  const list = [
    ...pageGuides({ botInstalled: false, botOnline: false, remoteChanged: false, revision: 3, syncTimedOut: false, noDiscordData: true, loadError: null }),
    ...pageGuides({ botInstalled: true, botOnline: false, remoteChanged: true, revision: 3, syncTimedOut: true, noDiscordData: true, loadError: 'Gagal terhubung.' }),
  ];
  assert.deepEqual(list.map((g) => g.code), ['BOT_NOT_IN_GUILD', 'LOAD_FAILED', 'REMOTE_CHANGED|3', 'SYNC_TIMEOUT|3', 'NO_DISCORD_DATA', 'BOT_OFFLINE']);
  for (const g of list) for (const t of [g.title, g.cause, ...g.steps]) assert.doesNotMatch(t, DASH);
  // Keputusan pemilik: diubah admin lain = 🔴 (pop up).
  assert.equal(list.find((g) => g.code.startsWith('REMOTE_CHANGED'))!.level, 'red');
  assert.equal(list.find((g) => g.code === 'BOT_OFFLINE')!.level, 'yellow');
});

test('bot Administrator: tidak pernah disuruh mengubah channel atau undang ulang', () => {
  const g = issueGuide(SAMPLES[0], ctx(snap(all(['Administrator']))));
  assert.equal(g.title, 'Data izin bot perlu diperbarui');
  assert.equal(g.level, 'yellow');
  assert.doesNotMatch([g.cause, ...g.steps].join(' '), /Edit Channel|Undang ulang/);
  assert.deepEqual(g.actions.map((a) => a.kind), ['check', 'contact']);
});

test('izin channel: undang ulang hanya bila role bot memang belum punya izinnya', () => {
  const re = issueGuide(SAMPLES[0], ctx(snap(all(['View Channel']))));
  assert.deepEqual(re.actions.map((a) => a.kind), ['reinvite', 'check']);
  const ch = issueGuide(SAMPLES[0], ctx(snap(all(['View Channel', 'Send Messages']))));
  assert.match(ch.title, /menolak izin bot/);
  assert.ok(!ch.actions.some((a) => a.kind === 'reinvite'));
  assert.ok(ch.actions.some((a) => a.kind === 'open-channel'));
  // Belum pasti: satu jalur bertahap (undang ulang lalu cek), bukan dua saran sekaligus.
  const unk = issueGuide(SAMPLES[0], ctx(snap(null)));
  assert.doesNotMatch([unk.cause, ...unk.steps].join(' '), /Edit Channel/);
  assert.match(unk.cause, /belum bisa memastikan/);
});

test('role dikelola integrasi tidak pernah disarankan menaikkan role bot', () => {
  const g = issueGuide(SAMPLES[10], ctx(snap('0')));
  assert.doesNotMatch([g.cause, ...g.steps].join(' '), /Seret role bot|naikkan role bot/i);
  assert.deepEqual(g.actions.map((a) => a.kind), ['goto']);
  const m = issueGuide(SAMPLES[8], ctx(snap('0')));
  assert.doesNotMatch([m.cause, ...m.steps].join(' '), /Seret role bot/);
  assert.match(m.cause, /Manage Roles \(Kelola Peran\)/);
});

test('roleReason mengenali kode baru dan kalimat bot lama', () => {
  // Kalimat persis dari src/verification/service.js dan src/dashboard/validator.js repo bot.
  assert.equal(roleReason({ reason: 'Bot tidak punya izin Manage Roles' }), 'MANAGE_ROLES_MISSING');
  assert.equal(roleReason({ reason: 'Verified Role dikelola integrasi (tidak bisa diberikan bot)' }), 'ROLE_MANAGED');
  assert.equal(roleReason({ reason: 'Posisi role bot harus lebih tinggi dari role Auto Role' }), 'ROLE_TOO_LOW');
  assert.equal(roleReason({ reason: 'Role @everyone tidak boleh dipakai sebagai penerima notifikasi.' }), 'EVERYONE');
  assert.equal(roleReason({ reason: 'Role ini tidak bisa di-mention bot. Aktifkan izin "Izinkan siapa saja @mention role ini" pada role tersebut.' }), 'NOT_MENTIONABLE');
  // Kalimat website sendiri (roleGrantIssue).
  assert.equal(roleReason({ reason: 'posisinya sejajar atau di atas role tertinggi bot' }), 'ROLE_TOO_LOW');
  assert.equal(roleReason({ reason: 'sesuatu yang baru' }), 'UNKNOWN');
  assert.equal(roleReason({ reason: 'Bot tidak punya izin Manage Roles', reason_code: 'ROLE_MANAGED' }), 'ROLE_MANAGED');
});

test('roleGrantIssue: Manage Roles kurang dikenali dari izin bot', () => {
  const s = snap(all(['View Channel']), { bot_top_position: 9 } as Partial<Snapshot>);
  assert.equal(roleGrantIssue(s, ROLE)?.reason_code, 'MANAGE_ROLES_MISSING');
  assert.equal(roleGrantIssue(snap(all(['Manage Roles']), { bot_top_position: 9 } as Partial<Snapshot>), ROLE), null);
  assert.equal(roleGrantIssue(snap(all(['Administrator']), { bot_top_position: 2 } as Partial<Snapshot>), ROLE)?.reason_code, 'ROLE_TOO_LOW');
});

test('izin sama di beberapa channel digabung jadi satu kartu', () => {
  const s = snap(all(['View Channel']));
  const items = [
    { issue: { code: 'MISSING_PERMISSIONS', feature: 'SAMBUNG_KATA', channel_id: CH1, missing: ['Send Messages'] }, source: 'live' as const },
    { issue: { code: 'MISSING_PERMISSIONS', feature: 'UNO', channel_id: CH2, missing: ['Send Messages'] }, source: 'live' as const },
    { issue: { code: 'MISSING_PERMISSIONS', feature: 'WEREWOLF', channel_id: CH3, missing: ['Send Messages'] }, source: 'live' as const },
    // Kembar persis: dibuang.
    { issue: { code: 'MISSING_PERMISSIONS', feature: 'WEREWOLF', channel_id: CH3, missing: ['Send Messages'] }, source: 'bot' as const },
  ];
  const list = buildGuides(items, ctx(s));
  assert.equal(list.length, 1);
  assert.equal(list[0].title, 'Bot kurang izin Send Messages (Kirim Pesan) di 3 channel');
  assert.match(list[0].cause, /#game, #uno dan #werewolf/);
  assert.match(list[0].cause, /Sambung Kata, UNO dan Werewolf/);
  assert.deepEqual(list[0].features, ['SAMBUNG_KATA', 'UNO', 'WEREWOLF']);
});

test('urutan: merah dulu, gagal diterapkan sebelum izin', () => {
  const s = snap(all(['View Channel']));
  const list = buildGuides(
    [
      { issue: { code: 'CHANNEL_REQUIRED', feature: 'UNO' }, source: 'draft' },
      { issue: { code: 'CHANNEL_NOT_FOUND', feature: 'UNO', channel_id: '1' }, source: 'live' },
      { issue: SAMPLES[0], source: 'live' },
      { issue: { code: 'APPLY_FAILED' }, source: 'bot' },
    ],
    ctx(s),
  );
  assert.deepEqual(list.map((g) => g.code), ['APPLY_FAILED', 'MISSING_PERMISSIONS', 'CHANNEL_NOT_FOUND', 'CHANNEL_REQUIRED']);
  assert.deepEqual(popupGuides(list).map((g) => g.code), ['APPLY_FAILED', 'MISSING_PERMISSIONS']);
  assert.equal(badgeGuides(list).length, 3);
  assert.deepEqual(sortGuides([...list].reverse()).map((g) => g.code), list.map((g) => g.code));
});

test('channel hilang: merah bila ditolak bot, kuning bila terlihat dari data Discord', () => {
  const i: Issue = { code: 'CHANNEL_NOT_FOUND', feature: 'UNO', channel_id: '1' };
  assert.equal(issueGuide(i, ctx(null), 'bot').level, 'red');
  assert.equal(issueGuide(i, ctx(null), 'live').level, 'yellow');
});

test('pop up terbuka lagi hanya untuk kendala merah yang belum dilihat', () => {
  const list = buildGuides([{ issue: { code: 'APPLY_FAILED' }, source: 'bot' }, { issue: { code: 'NO_DISCORD_DATA' }, source: 'live' }], ctx(null));
  assert.equal(hasUnseen(list, new Set()), true);
  const seen = new Set(popupGuides(list).map((g) => g.id));
  assert.equal(hasUnseen(list, seen), false);
  // Kendala kuning baru tidak membuka pop up.
  const more = buildGuides([{ issue: { code: 'APPLY_FAILED' }, source: 'bot' }, { issue: { code: 'UNKNOWN_FEATURE' }, source: 'bot' }], ctx(null));
  assert.equal(hasUnseen(more, seen), false);
});

test('semua izin yang dikenal dashboard punya nama Indonesia', () => {
  for (const name of Object.keys(PERMISSION_BITS)) assert.ok(PERMISSION_ID[name], `belum ada terjemahan: ${name}`);
  assert.equal(permissionLabel('Send Messages'), 'Send Messages (Kirim Pesan)');
  assert.equal(permissionLabel('Administrator'), 'Administrator');
  assert.equal(permissionLabel('Izin Baru'), 'Izin Baru');
});

test('pesan Hubungi tim membawa kode kendala tanpa data pemain', () => {
  const g = issueGuide(SAMPLES[0], ctx(snap(all(['View Channel']))));
  const msg = contactMessage('123456789012345678', g, ctx(null));
  assert.match(msg, /Server ID: 123456789012345678/);
  assert.match(msg, /kode MISSING_PERMISSIONS/);
  assert.match(msg, /Fitur: UNO/);
});

test('describeIssue (kartu fitur, Riwayat) memakai teks yang sama', () => {
  const t = describeIssue({ code: 'CHANNEL_REQUIRED', feature: 'UNO' }, ctx(null));
  assert.equal(t, 'UNO belum punya channel. Fitur ini butuh channel selama aktif. Pilih channel, atau matikan fitur ini.');
});
