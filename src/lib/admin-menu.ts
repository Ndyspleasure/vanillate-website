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
  /** Alamat halaman untuk kategori yang isinya tab halaman itu (tidak punya `href`). */
  page?: string;
  /** Id tab di halaman (`href` = alamat halaman + `#tab`); disorot lewat script. */
  tab?: string;
  /**
   * Halaman yang tab-nya dibentuk dari data saat dimuat (kategori dari database).
   * Sidebar mengisi sub-itemnya lewat `pasangTab` setelah data tampil.
   */
  dinamis?: boolean;
}

/**
 * Kategori sidebar dari tab sebuah halaman. `key` = kunci `active` halaman itu;
 * tiap tab menjadi sub-menu `alamat#id`. Id harus sama dengan `data-tab` di
 * halaman (dijaga tests/admin-menu.test.ts).
 */
function tabHalaman(key: string, label: string, page: string, tabs: [id: string, label: string][]): MenuNode {
  return {
    key, label, page,
    items: tabs.map(([id, nama]) => ({ key: `${key}:${id}`, label: nama, href: `${page}#${id}`, tab: id })),
  };
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
      {
        // Satu sub-menu per halaman publik (sumber: pageSchemas di src/data/pages.ts).
        key: 'grup-halaman', label: 'Konten Halaman',
        items: [
          { key: 'halaman-home', label: 'Beranda', href: '/admin/halaman/home' },
          { key: 'halaman-products', label: 'Game & Bot', href: '/admin/halaman/products' },
          { key: 'halaman-about', label: 'Tentang', href: '/admin/halaman/about' },
          { key: 'halaman-support', label: 'Bantuan', href: '/admin/halaman/support' },
          { key: 'halaman-global', label: 'Global', href: '/admin/halaman/global' },
        ],
      },
      { key: 'konten', label: 'Pengumuman', href: '/admin/konten' },
    ],
  },
  {
    // Blog /blog: penulis menulis lewat portal /blog/masuk, tim meninjau di sini;
    // tulisan terbit disimpan di Sanity (docs/BLOG.md, docs/BLOG-PENULIS.md).
    key: 'grup-blog', label: 'Blog',
    icon: '<path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M2 15h10"/><path d="M5 12v6"/><path d="M2 19h7"/>',
    items: [
      { key: 'blog', label: 'Semua Artikel', href: '/admin/blog' },
      tabHalaman('blog-review', 'Peninjauan Tulisan', '/admin/blog/peninjauan', [
          ['antrean', 'Antrean'], ['ditolak', 'Ditolak'], ['riwayat', 'Riwayat'], ['penulis', 'Penulis'],
        ]),
      tabHalaman('blog-pengaturan', 'Kategori & Penulis', '/admin/blog/pengaturan', [
          ['kategori', 'Kategori'], ['penulis', 'Penulis'],
        ]),
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
          tabHalaman('dev-home', 'Ringkasan & Sistem', '/admin/developer', [
          ['ringkasan', 'Ringkasan'], ['kesehatan-proses', 'Kesehatan proses'], ['status', 'Status'], ['versi-changelog', 'Versi & changelog'], ['database-ekonomi', 'Database & ekonomi'],
        ]),
          { key: 'kontrol', label: 'Kontrol Bot', href: '/admin/kontrol', dinamis: true },
          { key: 'operasi', label: 'Operasi & Riwayat', href: '/admin/operasi', dinamis: true },
        ],
      },
      {
        // Semua game setara di hub /game: tidak ada game utama atau sampingan.
        // Halaman tiap game memuat fitur sekaligus konfigurasinya, jadi langsung
        // di bawah Game Hub. Konfigurasi terpisah untuk yang murni pengaturan
        // (kamus kata dan aturan event).
        key: 'bot-game-hub', label: 'Game Hub',
        items: [
          { key: 'games', label: 'Monitor Game', href: '/admin/games' },
          { key: 'lagu', label: 'Tebak Lagu', href: '/admin/lagu' },
          tabHalaman('dev-tahu', 'Tahu Bulat', '/admin/developer/tahu-bulat', [
          ['ringkasan', 'Ringkasan'], ['kolam-donasi', 'Kolam donasi'], ['10-besar-total-coin-dihasilkan', '10 besar coin'], ['aktivitas-terbaru', 'Aktivitas terbaru'], ['alat-bantu', 'Alat bantu'],
        ]),
          tabHalaman('dev-story', 'Vanillate Story', '/admin/developer/story', [
          ['ringkasan', 'Ringkasan'], ['aktivitas-terbaru', 'Aktivitas terbaru'], ['tingkat-kekalahan-per-minggu', 'Tingkat kekalahan'], ['aturan-kesulitan', 'Aturan kesulitan'], ['alat-bantu', 'Alat bantu'],
        ]),
          {
            key: 'bot-game-konfigurasi', label: 'Konfigurasi',
            items: [
              { key: 'kata', label: 'Word Collection', href: '/admin/kata' },
              tabHalaman('dev-event', 'Event System', '/admin/developer/event', [
          ['peluang-pemicu', 'Peluang & pemicu'], ['penjajah-target', 'Penjajah target'], ['pengaturan', 'Pengaturan'],
        ]),
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
              tabHalaman('hub-server', 'Ringkasan Server Hub', '/admin/server-hub', [
          ['perlu-diperhatikan', 'Perlu diperhatikan'], ['verification', 'Verification'], ['leveling', 'Leveling'], ['auto-role', 'Auto Role'], ['welcome-dan-goodbye', 'Welcome dan Goodbye'], ['security-center', 'Security Center'],
        ]),
              { key: 'showcase', label: 'Showcase Server', href: '/admin/showcase' },
            ],
          },
          {
            key: 'bot-server-konfigurasi', label: 'Konfigurasi',
            items: [
              tabHalaman('dev-server', 'Kontrol Server', '/admin/developer/kontrol-server', [
          ['bot', 'Kontrol Bot'], ['command', 'Slash Command'], ['backup', 'Backup & Log'], ['konsol', 'Konsol'],
        ]),
            ],
          },
        ],
      },
      {
        key: 'bot-pemain', label: 'Pemain & Promosi',
        items: [
          tabHalaman('pemain', 'Pemain', '/admin/pemain', [
          ['cermin', 'Cermin website'], ['kelola', 'Kelola pemain'], ['ranking', 'Ranking live'], ['banned', 'Banned'],
        ]),
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
          tabHalaman('dev-error', 'Error KB', '/admin/developer/error', [
          ['ringkasan', 'Ringkasan'], ['error-terbaru', 'Error terbaru'], ['fingerprint-teratas', 'Fingerprint teratas'], ['auto-recovery-per-metode', 'Auto-recovery'],
        ]),
          tabHalaman('dev-autoheal', 'Auto-Heal', '/admin/developer/autoheal', [
          ['status', 'Status'], ['permintaan-izin', 'Permintaan izin'], ['kontrol', 'Kontrol'], ['incident-terbaru', 'Incident terbaru'], ['izin-aktif', 'Izin aktif'],
        ]),
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
          tabHalaman('ws-okr', 'Target / OKR', '/admin/workspace/okr', [
          ['buat', 'Buat OKR'], ['daftar', 'Daftar OKR'], ['berulang', 'OKR berulang'], ['riwayat', 'Riwayat perintah'],
        ]),
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
    // Satu sub-menu per halaman Partnership (dulu tab PartnershipTabs di tiap halaman).
    key: 'grup-partnership', label: 'Partnership',
    icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m17 11 2 2 4-4"/>',
    items: [
      { key: 'partnership-overview', label: 'Overview', href: '/admin/partnership' },
      { key: 'partnership-broadcast', label: 'Broadcast DM', href: '/admin/partnership/broadcast' },
      { key: 'partnership-active-players', label: 'Active Players', href: '/admin/partnership/active-players' },
      { key: 'partnership-history', label: 'Campaign History', href: '/admin/partnership/history' },
      { key: 'partnership-products', label: 'Paket Campaign', href: '/admin/partnership/products' },
      { key: 'partnership-jasa', label: 'Halaman Jasa', href: '/admin/partnership/jasa' },
      { key: 'partnership-layanan', label: 'Layanan & Masa Aktif', href: '/admin/partnership/layanan' },
      { key: 'partnership-orders', label: 'Pesanan Partner', href: '/admin/partnership/orders' },
      { key: 'partnership-partners', label: 'Akun Partner', href: '/admin/partnership/partners' },
      { key: 'partnership-categories', label: 'Kategori', href: '/admin/partnership/categories' },
      { key: 'partnership-lobby', label: 'Lobby Bot', href: '/admin/partnership/lobby' },
      { key: 'partnership-templates', label: 'Templates', href: '/admin/partnership/templates' },
      tabHalaman('partnership-settings', 'Settings', '/admin/partnership/settings', [
        ['url', 'URL'], ['custom-links', 'Custom Links'], ['konten', 'Konten halaman publik'],
      ]),
    ],
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

export interface EntriPencarian {
  node: MenuNode;
  /** Label dari kategori teratas sampai halaman, mis. ["Discord Bot", "Game Hub", "Tebak Lagu"]. */
  jalur: string[];
  /** Teks yang dicocokkan: jalur lengkap + href, sudah dinormalkan. */
  teks: string;
}

/** Huruf kecil, tanpa aksen, spasi tunggal. */
export function normalisasi(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Daftar datar semua halaman beserta jalurnya, untuk kotak cari sidebar. */
export function indeksPencarian(menu: MenuNode[], induk: string[] = []): EntriPencarian[] {
  return menu.flatMap((n) => {
    const jalur = [...induk, n.label];
    // Kategori tab halaman (`page`) tetap bisa dicari sebagai halamannya.
    const alamat = n.href ?? n.page;
    const sendiri: EntriPencarian[] = alamat
      ? [{ node: n.href ? n : { ...n, href: alamat }, jalur, teks: normalisasi(`${jalur.join(' ')} ${alamat}`) }]
      : [];
    return [...sendiri, ...indeksPencarian(n.items ?? [], jalur)];
  });
}

/**
 * Cocok bila SEMUA kata di `kueri` ada di `teks` (urutan bebas), jadi
 * "game tebak" menemukan Discord Bot › Game Hub › Tebak Lagu.
 * Kueri kosong tidak cocok dengan apa pun.
 */
export function cocokPencarian(teks: string, kueri: string): boolean {
  const kata = normalisasi(kueri).split(' ').filter(Boolean);
  return kata.length > 0 && kata.every((k) => teks.includes(k));
}
