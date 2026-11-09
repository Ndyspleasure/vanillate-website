// Tes logika Edge Function cms-read (supabase/functions/cms-read/logic.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allowedOrigin,
  bearerToken,
  CACHE_TTL_MS,
  createTtlCache,
  isView,
  jwtSub,
  roleAllowed,
  RPC_BY_VIEW,
} from '../supabase/functions/cms-read/logic.ts';

const SUB = '3f2b8c1e-9d4a-4e6b-8a1c-0d5e7f9a2b34';
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (payload: unknown) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.c2lnbmF0dXJl`;

test('isView hanya menerima tampilan yang terdaftar', () => {
  assert.equal(isView('serverhub'), true);
  assert.equal(isView('players'), false);
  assert.equal(isView('__proto__'), false);
  assert.equal(isView('toString'), false);
  assert.equal(isView(undefined), false);
  assert.equal(isView(42), false);
});

test('setiap tampilan punya fungsi baca dan TTL cache', () => {
  for (const v of Object.keys(RPC_BY_VIEW)) {
    assert.match(RPC_BY_VIEW[v as keyof typeof RPC_BY_VIEW], /^cms_read_[a-z]+$/);
    assert.ok(CACHE_TTL_MS[v as keyof typeof CACHE_TTL_MS] >= 30_000, `TTL ${v} terlalu pendek`);
  }
});

test('roleAllowed: owner, admin, viewer', () => {
  assert.equal(roleAllowed('owner'), true);
  assert.equal(roleAllowed('admin'), true);
  assert.equal(roleAllowed('viewer'), true);
  assert.equal(roleAllowed('editor'), false);
  assert.equal(roleAllowed(null), false);
  assert.equal(roleAllowed(undefined), false);
});

test('bearerToken mengambil token dan menolak bentuk salah', () => {
  const t = jwt({ sub: SUB });
  assert.equal(bearerToken(`Bearer ${t}`), t);
  assert.equal(bearerToken(`bearer ${t}`), null);
  assert.equal(bearerToken(t), null);
  assert.equal(bearerToken('Bearer pendek'), null);
  assert.equal(bearerToken(null), null);
  assert.equal(bearerToken(`Bearer ${t} ekstra`), null);
});

test('jwtSub membaca sub UUID, menolak yang lain', () => {
  assert.equal(jwtSub(jwt({ sub: SUB })), SUB);
  assert.equal(jwtSub(jwt({ sub: 'bukan-uuid' })), null);
  assert.equal(jwtSub(jwt({ sub: `${SUB}&role=eq.owner` })), null);
  assert.equal(jwtSub(jwt({})), null);
  assert.equal(jwtSub('a.b'), null);
  assert.equal(jwtSub('a.%%%.c'), null);
});

test('allowedOrigin hanya origin daftar', () => {
  const list = ['https://vanillate.id', 'http://localhost:4321'];
  assert.equal(allowedOrigin('https://vanillate.id', list), 'https://vanillate.id');
  assert.equal(allowedOrigin('https://jahat.example', list), null);
  assert.equal(allowedOrigin(null, list), null);
});

test('cache TTL: kedaluwarsa, timpa, dan batas jumlah', () => {
  let t = 1000;
  const c = createTtlCache<number>({ max: 2, now: () => t });
  c.set('a', 1, 100);
  assert.equal(c.get('a'), 1);
  t += 99;
  assert.equal(c.get('a'), 1);
  t += 2;
  assert.equal(c.get('a'), null);
  assert.equal(c.size(), 0);
  c.set('a', 1, 1000);
  c.set('b', 2, 1000);
  c.set('c', 3, 1000);
  assert.equal(c.get('a'), null, 'entri tertua dibuang');
  assert.equal(c.get('b'), 2);
  assert.equal(c.get('c'), 3);
  c.set('b', 9, 1000);
  assert.equal(c.get('b'), 9);
});
