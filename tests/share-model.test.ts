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
