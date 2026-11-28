import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueFix, PERMISSION_BITS, permissionFix, type Snapshot } from '../src/lib/dashboard/model.ts';
import { describeIssue } from '../src/lib/dashboard/issue-guide.ts';
import { botRegistry } from '../src/data/bot-registry.ts';

const INVITE = '2252747126074611';
const all = (names: string[]) => names.reduce((v, n) => v | PERMISSION_BITS[n], 0n).toString();
const snap = (perms: string | null): Snapshot => ({ refreshed_at: '2026-11-24T00:00:00Z', requested_at: null, channels: [], bot_permissions: perms }) as Snapshot;

test('izin yang belum ada di role bot: undang ulang', () => {
  assert.equal(permissionFix(snap(all(['View Channel'])), ['Send Messages'], INVITE), 'reinvite');
  assert.equal(permissionFix(snap(all(['View Channel'])), ['View Audit Log'], INVITE), 'reinvite');
});

test('role bot sudah punya izin tetapi channel menolak: bukan undang ulang', () => {
  assert.equal(permissionFix(snap(all(['View Channel', 'Send Messages'])), ['Send Messages'], INVITE), 'channel');
});

test('bot Administrator tidak bisa ditolak channel: data lama, bukan saran ubah channel', () => {
  assert.equal(permissionFix(snap(all(['Administrator'])), ['Send Messages'], INVITE), 'stale');
});

test('tautan undangan tidak meminta izin itu: undang ulang tidak ditawarkan', () => {
  assert.equal(permissionFix(snap('0'), ['Send Messages'], '0'), 'channel');
});

test('izin server belum terbaca atau label asing: saran ganda', () => {
  assert.equal(permissionFix(snap(null), ['Send Messages'], INVITE), 'unknown');
  assert.equal(permissionFix(snap(all(['Send Messages'])), ['Izin Baru'], INVITE), 'unknown');
});

test('tautan undangan Vanillate.ID memuat semua izin yang dikenal dashboard (kecuali Administrator)', () => {
  const bot = botRegistry.find((b) => b.discord.clientId === '1513806760622817320');
  const invite = BigInt(bot!.discord.permissions!);
  const lacking = Object.entries(PERMISSION_BITS).filter(([n, b]) => n !== 'Administrator' && (invite & b) !== b).map(([n]) => n);
  assert.deepEqual(lacking, []);
});

test('teks issue menyebut cara perbaikan yang tepat tanpa tanda pisah', () => {
  const issue = { code: 'MISSING_PERMISSIONS', feature: 'X', channel_id: '123456789012345678', channel_name: 'umum', missing: ['Send Messages'] };
  const base = { registry: [], invitePermissions: INVITE };
  const re = describeIssue(issue, { ...base, snapshot: snap(all(['View Channel'])) });
  assert.match(re, /Undang ulang dengan izin lengkap/);
  const ch = describeIssue(issue, { ...base, snapshot: snap(all(['View Channel', 'Send Messages'])) });
  assert.match(ch, /Edit Channel › Permissions/);
  assert.doesNotMatch(ch, /Undang ulang/);
  for (const t of [re, ch]) assert.doesNotMatch(t, /—|–| - /);
  assert.equal(issueFix({ code: 'CHANNEL_REQUIRED' }, { ...base, snapshot: null }), null);
});
