// Tes logika Edge Function topgg-webhook (supabase/functions/topgg-webhook/logic.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  parseEvent,
  parseSignatureHeader,
  safeEqual,
  verifyLegacy,
  verifySignature,
} from '../supabase/functions/topgg-webhook/logic.ts';

const SECRET = 'whs_rahasia_uji';
const sign = (t: number, body: string, secret = SECRET) =>
  `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;

test('tanda tangan v1 yang benar diterima; body/secret/waktu salah ditolak', async () => {
  const body = JSON.stringify({ type: 'vote.create', data: { id: '1' } });
  const now = 1_800_000_000;
  assert.equal(await verifySignature(SECRET, sign(now, body), body, now), true);
  assert.equal(await verifySignature(SECRET, sign(now, body), body + ' ', now), false, 'body diubah');
  assert.equal(await verifySignature(SECRET, sign(now, body, 'lain'), body, now), false, 'secret lain');
  assert.equal(await verifySignature(SECRET, sign(now - 3600, body), body, now), false, 'replay lama');
  assert.equal(await verifySignature('', sign(now, body), body, now), false, 'tanpa secret = tolak');
  assert.equal(await verifySignature(SECRET, 't=abc,v1=00', body, now), false);
  assert.equal(await verifySignature(SECRET, null, body, now), false);
});

test('header tanda tangan & perbandingan aman', () => {
  assert.deepEqual(parseSignatureHeader('t=12,v1=abc'), { t: 12, v1: 'abc' });
  assert.equal(parseSignatureHeader('v1=abc'), null);
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'ab'), false);
  assert.equal(verifyLegacy(SECRET, SECRET), true);
  assert.equal(verifyLegacy(SECRET, 'salah'), false);
  assert.equal(verifyLegacy('', ''), false);
});

test('vote.create dibaca: Discord ID dari user.platform_id, kunci dari id vote', () => {
  const ev = parseEvent({
    type: 'vote.create',
    data: { id: '808', created_at: '2026-10-22T01:00:00Z', weight: 2, query: { server: '700000000000000701' },
      user: { id: '1', platform_id: '300000000000000001' } },
  });
  assert.equal(ev.kind, 'vote');
  if (ev.kind !== 'vote') return;
  assert.equal(ev.eventKey, 'topgg:808');
  assert.equal(ev.discordUserId, '300000000000000001');
  assert.equal(ev.votedAt, '2026-10-22T01:00:00.000Z');
  assert.deepEqual(ev.query, { server: '700000000000000701' });
});

test('webhook.test, legacy upvote, dan payload tanpa Discord ID', () => {
  assert.equal(parseEvent({ type: 'webhook.test' }).kind, 'test');
  const at = new Date('2026-10-22T02:00:30Z');
  const legacy = parseEvent({ type: 'upvote', user: '300000000000000002', isWeekend: true, query: '?server=1' }, at);
  assert.equal(legacy.kind, 'vote');
  if (legacy.kind === 'vote') {
    assert.equal(legacy.weight, 2);
    assert.equal(legacy.eventKey, `legacy:300000000000000002:${Math.floor(at.getTime() / 60000)}`);
  }
  assert.equal(parseEvent({ type: 'vote.create', data: { user: { platform_id: 'x' } } }).kind, 'ignore');
  assert.equal(parseEvent({ type: 'lain' }).kind, 'ignore');
});
