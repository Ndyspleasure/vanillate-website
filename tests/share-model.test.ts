// Tes model 📣 Share Server dashboard (src/lib/dashboard/share-model.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSavePayload,
  formatDuration,
  isStale,
  pendingRequest,
  validateDescription,
  validateInviteUrl,
  type ShareConfig,
} from '../src/lib/dashboard/share-model.ts';

const CFG: ShareConfig = {
  promoChannelId: '700000000000000001', voteChannelId: '700000000000000002', voteMessageId: null, alertsChannelId: null,
  category: 'gaming', description: 'Server main bareng tiap malam.', inviteUrl: 'https://discord.gg/abc', inviteMethod: 'manual',
  inviteChannelId: null, inviteStatus: 'ACTIVE', inviteCheckedAt: null, inviteValidatedAt: null, guildName: 'X',
};

test('validasi link undangan sama dengan bot (hostname tepat)', () => {
  assert.equal(validateInviteUrl('https://discord.gg/abc'), null);
  assert.equal(validateInviteUrl('https://discord.com/invite/abc'), null);
  for (const bad of ['http://discord.gg/abc', 'https://discord.gg.evil.com/abc', 'https://bit.ly/x', 'https://discord.gg/abc?x=1', 'abc']) {
    assert.notEqual(validateInviteUrl(bad), null, bad);
  }
});

test('validasi deskripsi', () => {
  assert.equal(validateDescription('Komunitas santai yang ramah.'), null);
  assert.notEqual(validateDescription('gabung discord.gg/abc sekarang'), null);
  assert.notEqual(validateDescription('@here ayo semuanya gabung'), null);
  assert.notEqual(validateDescription('pendek'), null);
});

test('payload simpan hanya berisi yang berubah', () => {
  assert.deepEqual(buildSavePayload({ category: 'gaming', description: CFG.description! }, CFG).payload, {});
  const r = buildSavePayload({ promoChannelId: '700000000000000009', category: 'anime', inviteMode: 'manual', inviteUrl: 'https://discord.gg/baru' }, CFG);
  assert.deepEqual(r.payload, { promoChannelId: '700000000000000009', category: 'anime', inviteUrl: 'https://discord.gg/baru' });
  assert.deepEqual(buildSavePayload({ inviteMode: 'auto', inviteAutoChannelId: '700000000000000003' }, CFG).payload, { inviteAutoChannelId: '700000000000000003' });
  assert.equal(buildSavePayload({ description: 'link https://x.y ya' }, CFG).errors.length, 1);
});

test('status basi, permintaan berjalan, durasi', () => {
  assert.equal(isStale(null), true);
  assert.equal(isStale(new Date().toISOString()), false);
  assert.equal(pendingRequest([{ id: 1, type: 'save', status: 'done' } as never, { id: 2, type: 'test', status: 'running' } as never])?.id, 2);
  assert.equal(formatDuration(90 * 60000), '1 jam 30 menit');
  assert.equal(formatDuration(30 * 60000), '30 menit');
});

// ─── 🌐 Showcase Server (tampil di website) ─────────────────────────────────
import {
  buildShowcasePayload, SHOWCASE_STATUS_META, showcaseDefaults, showcaseLocked, showcaseOf, type ShareState,
} from '../src/lib/dashboard/share-model.ts';

const asState = (showcase: unknown): ShareState => ({ showcase } as unknown as ShareState);

test('showcaseOf: tanpa status dari bot = bawaan tampil, ditandai belum diketahui', () => {
  for (const s of [null, undefined, asState(undefined), asState({ status: 'ASING' }), asState('x')]) {
    const r = showcaseOf(s as ShareState | null);
    assert.equal(r.known, false);
    assert.equal(r.sc.enabled, true);
    assert.equal(r.sc.status, 'LISTED');
  }
});

test('showcaseOf: status dari bot dipakai, bagian yang hilang dilengkapi bawaan', () => {
  const r = showcaseOf(asState({ enabled: false, status: 'OFF', statusText: 'Dimatikan.', listed: false, invite: { url: 'https://discord.gg/abc', status: 'ACTIVE' } }));
  assert.equal(r.known, true);
  assert.equal(r.sc.status, 'OFF');
  assert.equal(r.sc.invite.url, 'https://discord.gg/abc');
  assert.equal(r.sc.invite.note, null);
  assert.equal(r.sc.autoInvite.possible, true);
});

test('setelan terkunci: NSFW dan ditinjau mematikan toggle, tampil dan dimatikan tidak', () => {
  assert.equal(showcaseLocked({ status: 'NSFW' }), true);
  assert.equal(showcaseLocked({ status: 'REVIEW' }), true);
  assert.equal(showcaseLocked({ status: 'LISTED' }), false);
  assert.equal(showcaseLocked({ status: 'OFF' }), false);
});

test('setiap status punya label dan tidak memakai tanda pisah', () => {
  for (const [k, v] of Object.entries(SHOWCASE_STATUS_META)) {
    assert.ok(v.label.length > 2, k);
    assert.ok(!/[—–]| - /.test(v.label), k);
  }
  assert.ok(!/[—–]| - /.test(showcaseDefaults().statusText));
});

test('payload Showcase: toggle membalik, link divalidasi, aksi lain tanpa isian', () => {
  assert.deepEqual(buildShowcasePayload('toggle', { enabled: true }, {}), { payload: { showcaseEnabled: false }, error: null });
  assert.deepEqual(buildShowcasePayload('toggle', { enabled: false }, {}).payload, { showcaseEnabled: true });
  assert.deepEqual(buildShowcasePayload('invite_save', { enabled: true }, { showcaseInviteUrl: ' https://discord.gg/abc ' }).payload, { showcaseInviteUrl: 'https://discord.gg/abc' });
  assert.notEqual(buildShowcasePayload('invite_save', { enabled: true }, { showcaseInviteUrl: 'https://bit.ly/x' }).error, null);
  assert.notEqual(buildShowcasePayload('invite_save', { enabled: true }, {}).error, null);
  assert.deepEqual(buildShowcasePayload('invite_auto', { enabled: true }, {}).payload, { showcaseInviteAuto: true });
  assert.deepEqual(buildShowcasePayload('invite_clear', { enabled: true }, {}).payload, { showcaseInviteClear: true });
  assert.deepEqual(buildShowcasePayload('recheck', { enabled: true }, {}).payload, { showcaseRecheck: true });
});

test('payload Showcase cocok dengan kunci yang diterima bot', () => {
  const botKeys = ['showcaseEnabled', 'showcaseInviteUrl', 'showcaseInviteAuto', 'showcaseInviteClear', 'showcaseRecheck'];
  const all = (['toggle', 'invite_save', 'invite_auto', 'invite_clear', 'recheck'] as const)
    .flatMap((a) => Object.keys(buildShowcasePayload(a, { enabled: true }, { showcaseInviteUrl: 'https://discord.gg/abc' }).payload));
  for (const k of all) assert.ok(botKeys.includes(k), k);
});

test('Showcase: keterangan asal link (admin, bot, vanity) dan penanda jeda atau opt-out tanpa tanda pisah', async () => {
  const { INVITE_SOURCE_LABEL } = await import('../src/lib/dashboard/share-model.ts');
  assert.deepEqual(Object.keys(INVITE_SOURCE_LABEL).sort(), ['auto', 'manual', 'vanity']);
  for (const v of Object.values(INVITE_SOURCE_LABEL)) assert.ok(!/[—–]| - /.test(v));
  const r = showcaseOf(asState({ enabled: true, status: 'LISTED', statusText: 'Tampil.', listed: true, invite: { url: 'https://discord.gg/kita', method: 'vanity', status: 'ACTIVE', paused: true, optedOut: false } }));
  assert.equal(r.sc.invite.method, 'vanity');
  assert.equal(r.sc.invite.paused, true);
  assert.equal(showcaseDefaults().invite.optedOut, false);
});
