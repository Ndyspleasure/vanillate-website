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
  const href = new Map(semuaHalaman(adminMenu).map((n) => [n.key, n.href]));
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
    server: '/admin/server', team: '/admin/team', halaman: '/admin/halaman',
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
  assert.deepEqual(hub.items!.filter((n) => n.href).map((n) => n.key),
    ['games', 'lagu', 'dev-tahu', 'dev-story']);
  assert.deepEqual(hub.items!.find((n) => n.items)!.items!.map((n) => n.key), ['kata', 'dev-event']);
  assert.deepEqual(jejak(adminMenu, 'dev-event').map((n) => n.label),
    ['Discord Bot', 'Game Hub', 'Konfigurasi', 'Event System']);
  assert.deepEqual(jejak(adminMenu, 'ringkasan').map((n) => n.label), ['Ringkasan']);
  assert.deepEqual(jejak(adminMenu, 'partnership').map((n) => n.key), ['grup-partnership']);
  assert.deepEqual(jejak(adminMenu, 'tidak-ada'), []);
  assert.deepEqual(jejak(adminMenu, undefined), []);
});

test('simpulAktif menandai seluruh leluhur', () => {
  const bot = adminMenu.find((n) => n.key === 'grup-bot')!;
  assert.ok(simpulAktif(bot, 'lagu'));
  assert.ok(simpulAktif(bot.items!.find((n) => n.key === 'bot-game-hub')!, 'lagu'));
  assert.ok(!simpulAktif(bot.items![0], 'lagu'));
});
