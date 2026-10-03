// Tes logika Edge Function dashboard-discord (supabase/functions/dashboard-discord/logic.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allowedOrigin,
  buildServerList,
  canManage,
  discordIdentity,
  isFresh,
  manageableGuilds,
} from '../supabase/functions/dashboard-discord/logic.ts';

const G = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: `Server ${id.slice(-1)}`, icon: null, ...extra });

test('canManage: owner, Administrator, atau Manage Server', () => {
  assert.equal(canManage(G('900000000000000001', { owner: true, permissions: '0' })), true);
  assert.equal(canManage(G('900000000000000001', { permissions: '8' })), true);
  assert.equal(canManage(G('900000000000000001', { permissions: '32' })), true);
  assert.equal(canManage(G('900000000000000001', { permissions: '2048' })), false);
  assert.equal(canManage(G('900000000000000001', { permissions: 'abc' })), false);
  // bitfield besar (melebihi 2^53) tetap dibaca benar
  assert.equal(canManage(G('900000000000000001', { permissions: '2251799813685280' })), true);
});

test('manageableGuilds menyaring, membuang duplikat & ID palsu', () => {
  const out = manageableGuilds([
    G('900000000000000001', { permissions: '32', icon: 'a'.repeat(32) }),
    G('900000000000000001', { permissions: '32' }),
    G('900000000000000002', { permissions: '0' }),
    G('bukan-id', { owner: true }),
    null,
  ]);
  assert.deepEqual(out.map((g) => g.guild_id), ['900000000000000001']);
  assert.equal(manageableGuilds('bukan array').length, 0);
});

test('discordIdentity dari identity_data (bukan user_metadata)', () => {
  const user = {
    id: 'u1',
    user_metadata: { provider_id: '999999999999999999' },
    identities: [
      { provider: 'google', identity_data: { sub: '123' } },
      { provider: 'discord', id: '100000000000000001', identity_data: { sub: '100000000000000001', name: 'andi', custom_claims: { global_name: 'Andi' }, avatar_url: 'https://cdn.discordapp.com/x.png' } },
    ],
  };
  assert.deepEqual(discordIdentity(user), { id: '100000000000000001', name: 'Andi', avatar: 'https://cdn.discordapp.com/x.png' });
  assert.equal(discordIdentity({ identities: [{ provider: 'google' }] }), null);
});

test('buildServerList: server dengan bot di atas, lalu alfabet', () => {
  const list = buildServerList(
    manageableGuilds([
      { id: '900000000000000003', name: 'Zeta', icon: null, permissions: '8' },
      { id: '900000000000000001', name: 'alpha', icon: null, permissions: '8' },
      { id: '900000000000000002', name: 'Beta', icon: null, owner: true },
    ]),
    new Set(['900000000000000003']),
    new Map([['900000000000000003', { sync_status: 'ACTIVE', current_revision: 4 }]]),
  );
  assert.deepEqual(list.map((s) => s.name), ['Zeta', 'alpha', 'Beta']);
  assert.equal(list[0].configured, true);
  assert.equal(list[0].revision, 4);
  assert.equal(list[2].isOwner, true);
});

test('CORS hanya untuk origin yang diizinkan', () => {
  const allow = ['https://vanillate.id', 'http://localhost:4321'];
  assert.equal(allowedOrigin('https://vanillate.id', allow), 'https://vanillate.id');
  assert.equal(allowedOrigin('https://evil.example', allow), null);
  assert.equal(allowedOrigin(null, allow), null);
});

test('cache daftar server 30 detik', () => {
  const now = Date.parse('2026-10-03T10:00:30Z');
  assert.equal(isFresh('2026-10-03T10:00:10Z', 30_000, now), true);
  assert.equal(isFresh('2026-10-03T09:59:00Z', 30_000, now), false);
  assert.equal(isFresh(null, 30_000, now), false);
});
