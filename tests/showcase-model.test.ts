// Tes model 🌐 Showcase Server (src/lib/showcase-model.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  countLabel, fetchShowcase, formatMembers, hueOf, iconUrl, initials, inviteUrl, isStale, layoutFor, matchesQuery,
  normalizeServer, parseList, pickSample, PRIORITY_SHARE, priorityOf, sanitizeName, splitRows, STALE_MS, type ShowcaseServer,
} from '../src/lib/showcase-model.ts';

const ID = '811111111111111111';
const mk = (n: number, icon = true): ShowcaseServer[] =>
  Array.from({ length: n }, (_, k) => ({ i: `8${String(k + 1).padStart(17, '0')}`, n: `Server ${k + 1}`, h: icon && k % 2 === 0 ? 'abc' : null, m: 10 * (k + 1) }));

test('sanitizeName: buang karakter kontrol dan penukar arah teks', () => {
  assert.equal(sanitizeName('  A‮B​   C  '), 'A B C');
  assert.equal(sanitizeName('​'), '');
  assert.equal(sanitizeName('x'.repeat(300)).length, 100);
});

test('normalizeServer: validasi ketat, data asing dibuang', () => {
  assert.deepEqual(normalizeServer({ i: ID, n: 'Komunitas', h: 'a_1b', m: 120.7, v: 'kode-1' }), { i: ID, n: 'Komunitas', h: 'a_1b', m: 120, v: 'kode-1' });
  assert.equal(normalizeServer({ i: 'abc', n: 'X' }), null);
  assert.equal(normalizeServer({ i: ID, n: '​' }), null);
  assert.equal(normalizeServer(null), null);
  const s = normalizeServer({ i: ID, n: 'X', h: '../../etc', m: -5, v: 'javascript:alert(1)' })!;
  assert.deepEqual(s, { i: ID, n: 'X', h: null, m: 0 });
  assert.equal(inviteUrl({ v: 'a b' }), null);
});

test('parseList: buang duplikat dan entri rusak, tahan data aneh', () => {
  const l = parseList({ updated_at: '2026-11-05T00:00:00Z', servers: [{ i: ID, n: 'A' }, { i: ID, n: 'B' }, 5, { i: 'x', n: 'C' }] });
  assert.deepEqual(l.servers.map((s) => s.n), ['A']);
  assert.deepEqual(parseList(null), { servers: [], updatedAt: null });
  assert.deepEqual(parseList({ servers: 'x' }).servers, []);
});

test('iconUrl hanya dari CDN Discord, ukuran dibatasi; inviteUrl dari kode sah', () => {
  assert.equal(iconUrl({ i: ID, h: 'abc' }, 64), `https://cdn.discordapp.com/icons/${ID}/abc.webp?size=64`);
  assert.equal(iconUrl({ i: ID, h: 'abc' }, 9999), `https://cdn.discordapp.com/icons/${ID}/abc.webp?size=64`);
  assert.equal(iconUrl({ i: ID, h: null }), null);
  assert.equal(iconUrl({ i: ID, h: 'a/../b' }), null);
  assert.equal(inviteUrl({ v: 'kode-ok' }), 'https://discord.gg/kode-ok');
  assert.equal(inviteUrl({}), null);
});

test('initials dan hueOf stabil', () => {
  assert.equal(initials('Komunitas Santai'), 'KS');
  assert.equal(initials('✨ Warung Kopi'), 'W');
  assert.equal(initials('🎮🎮'), '?');
  assert.equal(initials('ünicode ångström'), 'ÜÅ');
  assert.equal(hueOf(ID), hueOf(ID));
  assert.ok(hueOf(ID) >= 0 && hueOf(ID) < 360);
});

test('formatMembers dan countLabel', () => {
  assert.equal(formatMembers(0), '');
  assert.equal(formatMembers(120), '120+');
  assert.equal(formatMembers(1200), '1,2 rb+');
  assert.equal(formatMembers(25000), '25 rb+');
  assert.equal(formatMembers(2_500_000), '2,5 jt+');
  assert.equal(countLabel(0), '0');
  assert.equal(countLabel(37), '37');
  assert.equal(countLabel(789), '780+');
  assert.match(countLabel(1234), /^1\.200\+$/);
});

test('pickSample: link Gabung valid dan member besar didahulukan', () => {
  const small = mk(40, false).map((x) => ({ ...x, m: 5 }));
  const big = Array.from({ length: 10 }, (_, k) => ({ i: `7${String(k + 1).padStart(17, '0')}`, n: `Besar ${k}`, h: null, m: 5000, v: 'kode' }));
  const picked = pickSample([...small, ...big], 10, 'x');
  assert.ok(picked.filter((s) => s.v).length >= Math.ceil(10 * PRIORITY_SHARE), 'mayoritas slot untuk yang berlink dan besar');
  const bigNoLink = { i: '600000000000000001', n: 'Besar tanpa link', h: null, m: 9000 };
  const smallLink = { i: '600000000000000002', n: 'Kecil berlink', h: null, m: 5, v: 'k' };
  const mid = { i: '600000000000000003', n: 'Kecil', h: null, m: 5 };
  const order = pickSample([mid, smallLink, bigNoLink], 3, 'y').map((s) => s.n);
  assert.equal(order[2], 'Kecil', 'tanpa link dan kecil paling akhir');
  assert.ok(priorityOf(smallLink) > priorityOf(bigNoLink) - 3.01);
});

test('pickSample: server kecil tetap bergilir muncul dan semua slot terisi', () => {
  const small = Array.from({ length: 60 }, (_, k) => ({ i: `5${String(k + 1).padStart(17, '0')}`, n: `Kecil ${k}`, h: null, m: 5 }));
  const big = Array.from({ length: 10 }, (_, k) => ({ i: `7${String(k + 1).padStart(17, '0')}`, n: `Besar ${k}`, h: 'a', m: 5000, v: 'kode' }));
  const all = [...small, ...big];
  const seen = new Set<string>();
  for (let d = 1; d <= 10; d += 1) {
    const p = pickSample(all, 20, `2026-11-${String(d).padStart(2, '0')}`);
    assert.equal(p.length, 20);
    assert.equal(p.filter((s) => s.v).length, 10, 'semua yang besar selalu ikut');
    p.filter((s) => !s.v).forEach((s) => seen.add(s.i));
  }
  assert.ok(seen.size > 20, `server kecil bergilir antar hari (terlihat ${seen.size})`);
});

test('pickSample: tetap untuk seed sama, bergilir antar seed untuk yang sepadan', () => {
  const all = mk(100).map((x) => ({ ...x, m: 300, h: 'abc' }));
  const a = pickSample(all, 20, '2026-11-05');
  const b = pickSample(all, 20, '2026-11-05');
  const c = pickSample(all, 20, '2026-11-06');
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.map((s) => s.i), c.map((s) => s.i));
  assert.equal(a.length, 20);
  assert.equal(new Set(a.map((s) => s.i)).size, 20);
  assert.equal(pickSample(all, 500, 'x').length, 100);
  assert.deepEqual(pickSample([], 5, 'x'), []);
  assert.equal(all.length, 100, 'input tidak diubah');
});

test('pickSample: urutan input tidak memengaruhi hasil', () => {
  const all = mk(60);
  const rev = [...all].reverse();
  assert.deepEqual(pickSample(all, 15, 's').map((x) => x.i), pickSample(rev, 15, 's').map((x) => x.i));
});

test('priorityOf: member dibatasi 3 poin, link 3 poin, ikon 0,5 poin', () => {
  assert.equal(priorityOf({ m: 0 }), 0);
  assert.equal(priorityOf({ m: 10_000_000 }), 3);
  assert.equal(priorityOf({ m: 0, v: 'a' }), 3);
  assert.equal(priorityOf({ m: 0, h: 'x' }), 0.5);
});

test('layoutFor dan splitRows', () => {
  assert.deepEqual([0, 2, 3, 7, 8, 800].map(layoutFor), ['hidden', 'hidden', 'static', 'static', 'marquee', 'marquee']);
  assert.deepEqual(splitRows([1, 2, 3, 4, 5], 2), [[1, 3, 5], [2, 4]]);
  assert.deepEqual(splitRows([1], 0), [[1]]);
});

test('matchesQuery tidak peka huruf besar dan aksen', () => {
  assert.ok(matchesQuery('Kafé Santai', 'KAFE'));
  assert.ok(matchesQuery('Kafé Santai', ''));
  assert.ok(!matchesQuery('Kafé Santai', 'zzz'));
});

test('isStale: daftar lama atau tanpa tanggal dianggap basi', () => {
  const now = Date.parse('2026-11-05T00:00:00Z');
  assert.equal(isStale(new Date(now - STALE_MS + 1000).toISOString(), now), false);
  assert.equal(isStale(new Date(now - STALE_MS - 1000).toISOString(), now), true);
  assert.equal(isStale(null, now), true);
});

const okRes = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

test('fetchShowcase: sukses memanggil RPC publik dengan anon key', async () => {
  const calls: { url: string; init: Record<string, unknown> }[] = [];
  const fresh = new Date().toISOString();
  const r = await fetchShowcase({
    url: 'https://x.supabase.co/', anonKey: 'anon', slug: 'vanillateID',
    fetchImpl: async (url, init) => { calls.push({ url, init: init ?? {} }); return okRes({ updated_at: fresh, servers: [{ i: ID, n: 'A' }] }); },
  });
  assert.equal(r.servers.length, 1);
  assert.equal(calls[0].url, 'https://x.supabase.co/rest/v1/rpc/showcase_public_list');
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { p_bot_slug: 'vanillateID' });
  assert.equal((calls[0].init.headers as Record<string, string>).apikey, 'anon');
});

test('fetchShowcase: gagal, basi, atau tanpa env = kosong tanpa melempar; mencoba ulang', async () => {
  const warns: string[] = [];
  let tries = 0;
  const bad = await fetchShowcase({
    url: 'https://x.supabase.co', anonKey: 'k', slug: 's', retries: 2, onWarn: (m) => warns.push(m),
    fetchImpl: async () => { tries += 1; return { ok: false, status: 500, json: async () => ({}) }; },
  });
  assert.deepEqual(bad.servers, []);
  assert.equal(tries, 3);
  assert.ok(warns.length >= 3);
  const stale = await fetchShowcase({
    url: 'https://x.supabase.co', anonKey: 'k', slug: 's', onWarn: () => {},
    fetchImpl: async () => okRes({ updated_at: '2020-01-01T00:00:00Z', servers: [{ i: ID, n: 'A' }] }),
  });
  assert.deepEqual(stale.servers, []);
  assert.deepEqual((await fetchShowcase({ slug: 's', onWarn: () => {} })).servers, []);
  const thrown = await fetchShowcase({ url: 'https://x', anonKey: 'k', slug: 's', retries: 0, onWarn: () => {}, fetchImpl: async () => { throw new Error('net'); } });
  assert.deepEqual(thrown.servers, []);
});
