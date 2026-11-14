import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminMenu, jejak, semuaHalaman, simpulAktif } from '../src/lib/admin-menu.ts';

test('kunci menu unik dan semua halaman punya href', () => {
  const kunci: string[] = [];
  const kumpul = (daftar: typeof adminMenu) => {
    for (const n of daftar) {
      kunci.push(n.key);
      if (n.items) {
        assert.ok(n.items.length > 0, `kategori ${n.key} kosong`);
        kumpul(n.items);
      } else {
        assert.ok(n.href, `halaman ${n.key} tanpa href`);
      }
    }
  };
  kumpul(adminMenu);
  assert.equal(new Set(kunci).size, kunci.length);
});

test('semua halaman lama tetap ada dengan href yang sama', () => {
  // Halaman ber-tab: kategori dengan `page`; halaman biasa: `href`.
  const semua = (d: typeof adminMenu): typeof adminMenu => d.flatMap((n) => [n, ...semua(n.items ?? [])]);
  const href = new Map(semua(adminMenu).map((n) => [n.key, n.href ?? n.page]));
  const lama: Record<string, string> = {
    'dev-home': '/admin/developer', kontrol: '/admin/kontrol',
    'dev-server': '/admin/developer/kontrol-server', games: '/admin/games',
    pemain: '/admin/pemain', kata: '/admin/kata', lagu: '/admin/lagu',
    promo: '/admin/promo', 'dev-broadcast': '/admin/developer/broadcast',
    'dev-polling': '/admin/developer/polling', 'dev-event': '/admin/developer/event',
    'dev-tutorial': '/admin/developer/tutorial', 'dev-campaign': '/admin/developer/campaign',
    'dev-sosial': '/admin/developer/sosial', 'dev-share': '/admin/developer/share-server',
    showcase: '/admin/showcase', 'dev-tahu': '/admin/developer/tahu-bulat',
    'dev-story': '/admin/developer/story', 'dev-error': '/admin/developer/error',
    'dev-autoheal': '/admin/developer/autoheal', operasi: '/admin/operasi',
    'ws-home': '/admin/workspace', 'ws-status': '/admin/workspace/status',
    'ws-tasks': '/admin/workspace/tasks', 'ws-routines': '/admin/workspace/routines',
    'ws-okr': '/admin/workspace/okr', 'ws-roles': '/admin/workspace/roles',
    'ws-teams': '/admin/workspace/teams', 'ws-schedules': '/admin/workspace/schedules',
    'ws-welcome': '/admin/workspace/welcome', 'ws-features': '/admin/workspace/features',
    'ws-automation': '/admin/workspace/automation', 'ws-settings': '/admin/workspace/settings',
    ringkasan: '/admin/dashboard', blog: '/admin/blog', faq: '/admin/faq',
    produk: '/admin/produk', statistik: '/admin/statistik', logs: '/admin/logs',
    server: '/admin/server', team: '/admin/team', 'halaman-home': '/admin/halaman/home', 'partnership-overview': '/admin/partnership',
    'partnership-settings': '/admin/partnership/settings', 'blog-review': '/admin/blog/peninjauan',
    'ws-okr': '/admin/workspace/okr', 'hub-server': '/admin/server-hub',
    konten: '/admin/konten', 'after-dark': '/admin/after-dark',
  };
  for (const [key, h] of Object.entries(lama)) assert.equal(href.get(key), h, key);
});

test('jejak memberi jalur bertingkat sampai halaman aktif', () => {
  assert.deepEqual(jejak(adminMenu, 'kata').map((n) => n.label),
    ['Discord Bot', 'Game Hub', 'Konfigurasi', 'Word Collection']);
  assert.deepEqual(jejak(adminMenu, 'dev-server').map((n) => n.label),
    ['Discord Bot', 'Server Hub', 'Konfigurasi', 'Kontrol Server']);
  assert.deepEqual(jejak(adminMenu, 'dev-tutorial').map((n) => n.label),
    ['Discord Bot', 'Pemain & Promosi', 'Tutorial']);
  assert.deepEqual(jejak(adminMenu, 'kontrol').map((n) => n.label),
    ['Discord Bot', 'Ringkasan & Kontrol', 'Kontrol Bot']);
  // Semua game setara di Game Hub, tanpa kategori utama atau sampingan.
  const hub = adminMenu.find((n) => n.key === 'grup-bot')!.items!.find((n) => n.key === 'bot-game-hub')!;
  assert.deepEqual(hub.items!.filter((n) => n.href || n.page).map((n) => n.key),
    ['games', 'lagu', 'dev-tahu', 'dev-story']);
  assert.deepEqual(hub.items!.find((n) => n.key === 'bot-game-konfigurasi')!.items!.map((n) => n.key), ['kata', 'dev-event']);
  assert.deepEqual(jejak(adminMenu, 'dev-event').map((n) => n.label),
    ['Discord Bot', 'Game Hub', 'Konfigurasi', 'Event System']);
  assert.deepEqual(jejak(adminMenu, 'ringkasan').map((n) => n.label), ['Ringkasan']);
  assert.deepEqual(jejak(adminMenu, 'partnership-orders').map((n) => n.key), ['grup-partnership', 'partnership-orders']);
  assert.deepEqual(jejak(adminMenu, 'tidak-ada'), []);
  assert.deepEqual(jejak(adminMenu, undefined), []);
});

test('simpulAktif menandai seluruh leluhur', () => {
  const bot = adminMenu.find((n) => n.key === 'grup-bot')!;
  assert.ok(simpulAktif(bot, 'lagu'));
  assert.ok(simpulAktif(bot.items!.find((n) => n.key === 'bot-game-hub')!, 'lagu'));
  assert.ok(!simpulAktif(bot.items![0], 'lagu'));
});

test('pencarian: indeks memuat semua halaman dengan jalur lengkap', async () => {
  const { indeksPencarian } = await import('../src/lib/admin-menu.ts');
  const indeks = indeksPencarian(adminMenu);
  const kategoriTab = (d: typeof adminMenu): number => d.reduce((n, x) => n + (x.page ? 1 : 0) + kategoriTab(x.items ?? []), 0);
  assert.equal(indeks.length, semuaHalaman(adminMenu).length + kategoriTab(adminMenu));
  const lagu = indeks.find((e) => e.node.key === 'lagu')!;
  assert.deepEqual(lagu.jalur, ['Discord Bot', 'Game Hub', 'Tebak Lagu']);
});

test('pencarian: semua kata harus cocok, urutan bebas, tanpa beda huruf besar', async () => {
  const { indeksPencarian, cocokPencarian } = await import('../src/lib/admin-menu.ts');
  const cari = (q: string) => indeksPencarian(adminMenu).filter((e) => cocokPencarian(e.teks, q)).map((e) => e.node.key);
  assert.ok(cari('TEBAK').includes('lagu'));
  assert.ok(cari('game tebak').includes('lagu'));
  assert.ok(cari('tebak game').includes('lagu'));
  assert.ok(cari('workspace tugas').includes('ws-tasks'));
  assert.ok(cari('/admin/pemain').includes('pemain'));
  assert.deepEqual(cari('zzzxxx'), []);
  assert.deepEqual(cari('   '), []);
});

test('sub-menu tab: id sama dengan data-tab / tabSection di sumber halaman', async () => {
  const { readFileSync } = await import('node:fs');
  const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const halaman: Record<string, string> = {
    'dev-home': 'developer/index', 'dev-tahu': 'developer/tahu-bulat', 'dev-story': 'developer/story',
    'dev-event': 'developer/event', 'hub-server': 'server-hub', 'dev-server': 'developer/kontrol-server',
    'dev-error': 'developer/error', 'dev-autoheal': 'developer/autoheal', 'blog-review': 'blog/peninjauan',
    'blog-pengaturan': 'blog/pengaturan', 'ws-okr': 'workspace/okr', pemain: 'pemain', kata: 'kata', operasi: 'operasi',
    'partnership-settings': 'partnership/settings', operasi: 'operasi',
  };
  const semua = (d: typeof adminMenu): typeof adminMenu => d.flatMap((n) => [n, ...semua(n.items ?? [])]);
  for (const [key, berkas] of Object.entries(halaman)) {
    const node = semua(adminMenu).find((n) => n.key === key)!;
    assert.ok(node?.page, `${key} bukan kategori tab`);
    const src = readFileSync(new URL(`../src/pages/admin/${berkas}.astro`, import.meta.url), 'utf8');
    const ada = new Set<string>([
      ...[...src.matchAll(/tabSection\('([^']+)'/g)].map((m) => slug(m[1])),
      ...[...src.matchAll(/data-tab="([a-z0-9-]+)"/g)].map((m) => m[1]),
      ...[...src.matchAll(/\btab\('([a-z0-9-]+)',/g)].map((m) => m[1]),
      ...[...src.matchAll(/bagian\('([a-z0-9-]+)',/g)].map((m) => m[1]),
    ]);
    // Operasi: tab per kategori dibentuk dari registry aksi (label kategori jadi id).
    if (key === 'operasi') {
      const reg = readFileSync(new URL('../src/lib/dev-panel/actions.ts', import.meta.url), 'utf8');
      for (const m of reg.matchAll(/key: '[a-z]+', label: '([^']+)', icon:/g)) ada.add(slug(m[1]));
    }
    for (const anak of node.items!) assert.ok(ada.has(anak.tab!), `${key}: tab "${anak.tab}" tidak ada di ${berkas}`);
  }
});
