// Struktur menu sidebar admin. Murni data + fungsi kecil, tanpa Astro/DOM,
// supaya bisa dites (tests/admin-menu.test.ts).
//
// Menu berbentuk pohon dengan kedalaman bebas: sebuah simpul boleh langsung
// menjadi halaman (`href`), atau menjadi kategori yang berisi simpul lain
// (`items`). Tidak ada batas tingkat, cukup menyarangkan `items` lagi.
// `key` tiap halaman sama dengan prop `active` di AdminLayout.

export interface MenuNode {
  key: string;
  label: string;
  /** Ada = halaman. Tidak ada = kategori yang berisi `items`. */
  href?: string;
  /** Path SVG; hanya dipakai simpul tingkat teratas. */
  icon?: string;
  items?: MenuNode[];
  /** Kunci `active` tambahan yang dianggap bagian dari simpul ini. */
  match?: string;
}

export const adminMenu: MenuNode[] = [
  {
    key: 'ringkasan', label: 'Ringkasan', href: '/admin/dashboard',
    icon: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  },
  {
    key: 'grup-konten', label: 'Konten',
    icon: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    items: [
      { key: 'halaman', label: 'Konten Halaman', href: '/admin/halaman' },
      { key: 'konten', label: 'Pengumuman', href: '/admin/konten' },
    ],
  },
  {
    // Blog /blog: ditulis & diterbitkan di sini, disimpan di Sanity (docs/BLOG.md).
    key: 'grup-blog', label: 'Blog',
    icon: '<path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M2 15h10"/><path d="M5 12v6"/><path d="M2 19h7"/>',
    items: [
      { key: 'blog', label: 'Semua Artikel', href: '/admin/blog' },
      { key: 'blog-tulis', label: 'Tulis Artikel', href: '/admin/blog/tulis' },
      { key: 'blog-pengaturan', label: 'Kategori & Penulis', href: '/admin/blog/pengaturan' },
    ],
  },
  {
    key: 'team', label: 'Team Management', href: '/admin/team',
    icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  },
  {
    key: 'grup-faq', label: 'FAQ & Panduan',
    icon: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    items: [
      { key: 'faq', label: 'Pertanyaan', href: '/admin/faq' },
      { key: 'faq-kategori', label: 'Kategori', href: '/admin/faq/categories' },
      { key: 'faq-bot', label: 'FAQ Bot Discord', href: '/admin/faq/bot' },
    ],
  },
  {
    key: 'grup-produk', label: 'Produk',
    icon: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    items: [
      { key: 'produk', label: 'Katalog Produk', href: '/admin/produk' },
    ],
  },
  {
    // Bot Discord Vanillate.ID (dulu "Vanillate Sambung Kata"). Satu grup untuk
    // pengaturan bot (bot_settings) dan Panel Developer pengganti slash command
    // /developer (V3): aksi lewat bot_commands, keadaan dari bot_panel_snapshots.
    key: 'grup-bot', label: 'Discord Bot',
    icon: '<path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
    items: [
      {
        key: 'bot-kontrol', label: 'Ringkasan & Kontrol',
        items: [
          { key: 'dev-home', label: 'Ringkasan & Sistem', href: '/admin/developer' },
          { key: 'kontrol', label: 'Kontrol Bot', href: '/admin/kontrol' },
          { key: 'operasi', label: 'Operasi & Riwayat', href: '/admin/operasi' },
        ],
      },
      {
        // Semua game setara di hub /game: tidak ada game utama atau sampingan.
        // Fitur (data & aksi per game) dipisah dari konfigurasi (aturan global).
        key: 'bot-game-hub', label: 'Game Hub',
        items: [
          {
            key: 'bot-game-fitur', label: 'Fitur',
            items: [
              { key: 'games', label: 'Monitor Game', href: '/admin/games' },
              { key: 'kata', label: 'Word Collection', href: '/admin/kata' },
              { key: 'lagu', label: 'Tebak Lagu', href: '/admin/lagu' },
              { key: 'dev-tahu', label: 'Tahu Bulat', href: '/admin/developer/tahu-bulat' },
              { key: 'dev-story', label: 'Vanillate Story', href: '/admin/developer/story' },
            ],
          },
          {
            key: 'bot-game-konfigurasi', label: 'Konfigurasi',
            items: [
              { key: 'dev-event', label: 'Event System', href: '/admin/developer/event' },
            ],
          },
        ],
      },
      {
        key: 'bot-sosial-hub', label: 'Sosial Hub',
        items: [
          {
            key: 'bot-sosial-fitur', label: 'Fitur',
            items: [
              { key: 'dev-sosial', label: 'Social Monitor', href: '/admin/developer/sosial' },
              { key: 'dev-share', label: 'Share Server', href: '/admin/developer/share-server' },
            ],
          },
        ],
      },
      {
        key: 'bot-server-hub', label: 'Server Hub',
        items: [
          {
            key: 'bot-server-fitur', label: 'Fitur',
            items: [
              { key: 'showcase', label: 'Showcase Server', href: '/admin/showcase' },
            ],
          },
          {
            key: 'bot-server-konfigurasi', label: 'Konfigurasi',
            items: [
              { key: 'dev-server', label: 'Kontrol Server', href: '/admin/developer/kontrol-server' },
            ],
          },
        ],
      },
      {
        key: 'bot-pemain', label: 'Pemain & Promosi',
        items: [
          { key: 'pemain', label: 'Pemain', href: '/admin/pemain' },
          { key: 'promo', label: 'Promo', href: '/admin/promo' },
          { key: 'dev-tutorial', label: 'Tutorial', href: '/admin/developer/tutorial' },
        ],
      },
      {
        key: 'bot-komunikasi', label: 'Komunikasi',
        items: [
          { key: 'dev-broadcast', label: 'Broadcast DM', href: '/admin/developer/broadcast' },
          { key: 'dev-polling', label: 'Polling', href: '/admin/developer/polling' },
          { key: 'dev-campaign', label: 'DM Campaign', href: '/admin/developer/campaign' },
        ],
      },
      {
        key: 'bot-perawatan', label: 'Perawatan',
        items: [
          { key: 'dev-error', label: 'Error KB', href: '/admin/developer/error' },
          { key: 'dev-autoheal', label: 'Auto-Heal', href: '/admin/developer/autoheal' },
        ],
      },
    ],
  },
  {
    // Produk kedua: konfigurasi bot Vanillate Workspace (tabel workspace_*).
    // Sengaja terpisah dari bot Vanillate.ID (bot_*) supaya setting antar-produk
    // tidak pernah tercampur.
    key: 'grup-workspace', label: 'Vanillate Workspace',
    icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M9 4v16"/>',
    items: [
      {
        key: 'ws-grup-ringkasan', label: 'Ringkasan',
        items: [
          { key: 'ws-home', label: 'Ringkasan', href: '/admin/workspace' },
          { key: 'ws-status', label: 'Status Sistem', href: '/admin/workspace/status' },
        ],
      },
      {
        key: 'ws-grup-pekerjaan', label: 'Pekerjaan',
        items: [
          { key: 'ws-tasks', label: 'Tugas', href: '/admin/workspace/tasks' },
          { key: 'ws-routines', label: 'Tugas Berulang', href: '/admin/workspace/routines' },
          { key: 'ws-okr', label: 'Target / OKR', href: '/admin/workspace/okr' },
          { key: 'ws-automation', label: 'Automation', href: '/admin/workspace/automation' },
        ],
      },
      {
        key: 'ws-grup-tim', label: 'Tim',
        items: [
          { key: 'ws-teams', label: 'Tim', href: '/admin/workspace/teams' },
          { key: 'ws-roles', label: 'Role & Izin', href: '/admin/workspace/roles' },
          { key: 'ws-schedules', label: 'Jadwal Kerja', href: '/admin/workspace/schedules' },
          { key: 'ws-welcome', label: 'Welcome & Onboarding', href: '/admin/workspace/welcome' },
        ],
      },
      {
        key: 'ws-grup-sistem', label: 'Sistem',
        items: [
          { key: 'ws-features', label: 'Feature Toggle', href: '/admin/workspace/features' },
          { key: 'ws-settings', label: 'Konfigurasi Sistem', href: '/admin/workspace/settings' },
        ],
      },
    ],
  },
  {
    // Game 18+ After Dark (repo terpisah). Tantangannya dikelola di sini,
    // game hanya membaca yang sudah terbit (tabel after_dark_challenges).
    key: 'after-dark', label: 'After Dark (18+)', href: '/admin/after-dark',
    icon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  },
  {
    key: 'grup-partnership', label: 'Partnership', href: '/admin/partnership',
    icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m17 11 2 2 4-4"/>',
    match: 'partnership',
  },
  {
    key: 'grup-data', label: 'Data & Laporan',
    icon: '<path d="M3 3v18h18"/><path d="m7 15 3-4 3 3 5-7"/>',
    items: [
      { key: 'statistik', label: 'Statistik', href: '/admin/statistik' },
      { key: 'logs', label: 'Log Aktivitas', href: '/admin/logs' },
      { key: 'server', label: 'Server', href: '/admin/server' },
    ],
  },
];

/** Simpul dianggap aktif bila dirinya atau salah satu turunannya sedang dibuka. */
export function simpulAktif(node: MenuNode, aktif?: string): boolean {
  if (!aktif) return false;
  if (node.key === aktif || node.match === aktif) return true;
  return !!node.items?.some((anak) => simpulAktif(anak, aktif));
}

/**
 * Jalur dari tingkat teratas sampai halaman `aktif` (untuk breadcrumb).
 * Kosong bila kuncinya tidak ada di menu.
 */
export function jejak(menu: MenuNode[], aktif?: string): MenuNode[] {
  if (!aktif) return [];
  for (const node of menu) {
    if (node.key === aktif || node.match === aktif) return [node];
    if (node.items) {
      const anak = jejak(node.items, aktif);
      if (anak.length) return [node, ...anak];
    }
  }
  return [];
}

/** Semua kunci halaman (simpul ber-href) di pohon, urut kemunculan. */
export function semuaHalaman(menu: MenuNode[]): MenuNode[] {
  return menu.flatMap((n) => [...(n.href ? [n] : []), ...semuaHalaman(n.items ?? [])]);
}
