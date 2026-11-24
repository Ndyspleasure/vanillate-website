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

// Tiap halaman punya satu kategori; tab tetap memakai URL lama agar deep link
// dan bookmark tetap bekerja. Data lokal ini tidak memicu query tambahan.
export const adminMenu: MenuNode[] = [
  { key: "ringkasan", label: "Dashboard", href: "/admin/dashboard", icon: "<rect x=\"3\" y=\"3\" width=\"7\" height=\"9\" rx=\"1\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"5\" rx=\"1\"/><rect x=\"14\" y=\"12\" width=\"7\" height=\"9\" rx=\"1\"/><rect x=\"3\" y=\"16\" width=\"7\" height=\"5\" rx=\"1\"/>" },
  {
    key: "grup-bot", label: "Bot",
    icon: "<path d=\"M20 7h-9\"/><path d=\"M14 17H5\"/><circle cx=\"17\" cy=\"17\" r=\"3\"/><circle cx=\"7\" cy=\"7\" r=\"3\"/>",
    items: [
      { key: "bot-registry", label: "Semua Bot & Konfigurasi", href: "/admin/bots" },
      {
        key: "bot-vanillate", label: "Vanillate.ID",
        items: [
          tabHalaman("dev-home", "Info, Status & Versi", "/admin/developer", [
            ["ringkasan","Ringkasan"],
            ["kesehatan-proses","Kesehatan proses"],
            ["status","Status"],
            ["versi-changelog","Versi & changelog"],
            ["database-ekonomi","Database & ekonomi"]
          ]),
          { key: "kontrol", label: "Konfigurasi Bot", href: "/admin/kontrol", dinamis: true },
          { key: "games", label: "Monitor Game", href: "/admin/games" },
          tabHalaman("kata", "Kamus Sambung Kata", "/admin/kata", [
            ["statistik","Statistik"],
            ["antrean-pending","Antrean pending"],
            ["cari-kata","Cari kata"],
            ["review-ulang-antrean-cepat","Review ulang"],
            ["export-daftar-kata","Export daftar kata"],
            ["review-massal","Review massal"]
          ]),
          tabHalaman("dev-tahu", "Tahu Bulat", "/admin/developer/tahu-bulat", [
            ["ringkasan","Ringkasan"],
            ["kolam-donasi","Kolam donasi"],
            ["10-besar-total-coin-dihasilkan","10 besar coin"],
            ["aktivitas-terbaru","Aktivitas terbaru"],
            ["alat-bantu","Alat bantu"]
          ]),
          {
            key: "wallet", label: "Vanillate Wallet",
            items: [
              { key: "wallet-ringkasan", label: "Ringkasan", href: "/admin/wallet" },
              { key: "wallet-pencairan", label: "Pencairan", href: "/admin/wallet/pencairan" },
              { key: "wallet-member", label: "Member", href: "/admin/wallet/member", match: "wallet-pemain" },
              { key: "wallet-laporan", label: "Laporan", href: "/admin/wallet/laporan" },
              { key: "wallet-konfigurasi", label: "Konfigurasi", href: "/admin/wallet/konfigurasi" },
              { key: "wallet-audit", label: "Riwayat moderasi", href: "/admin/wallet/audit" },
            ],
          },
          tabHalaman("dev-story", "Vanillate Story", "/admin/developer/story", [
            ["ringkasan","Ringkasan"],
            ["aktivitas-terbaru","Aktivitas terbaru"],
            ["tingkat-kekalahan-per-minggu","Tingkat kekalahan"],
            ["aturan-kesulitan","Aturan kesulitan"],
            ["alat-bantu","Alat bantu"]
          ]),
          tabHalaman("dev-event", "Aturan Event", "/admin/developer/event", [
            ["peluang-pemicu","Peluang & pemicu"],
            ["penjajah-target","Penjajah target"],
            ["pengaturan","Pengaturan"]
          ]),
          { key: "dev-tutorial", label: "Tutorial", href: "/admin/developer/tutorial" },
          { key: "dev-sosial", label: "Monitor Sosial", href: "/admin/developer/sosial" },
          { key: "dev-share", label: "Berbagi Server", href: "/admin/developer/share-server" },
          tabHalaman("hub-server", "Fitur Server", "/admin/server-hub", [
            ["perlu-diperhatikan","Perlu diperhatikan"],
            ["verification","Verification"],
            ["leveling","Leveling"],
            ["auto-role","Auto Role"],
            ["welcome-dan-goodbye","Welcome dan Goodbye"],
            ["security-center","Security Center"]
          ]),
          tabHalaman("dev-server", "Kontrol Server", "/admin/developer/kontrol-server", [
            ["bot","Kontrol Bot"],
            ["command","Slash Command"],
            ["backup","Backup & Log"],
            ["konsol","Konsol"]
          ]),
          { key: "showcase", label: "Showcase Server", href: "/admin/showcase" }
        ],
      },
      {
        key: "grup-workspace", label: "Vanillate Workspace",
        items: [
          { key: "ws-home", label: "Ringkasan", href: "/admin/workspace" },
          { key: "ws-status", label: "Status Sistem", href: "/admin/workspace/status" },
          { key: "ws-tasks", label: "Tugas", href: "/admin/workspace/tasks" },
          { key: "ws-routines", label: "Tugas Berulang", href: "/admin/workspace/routines" },
          tabHalaman("ws-okr", "Target & OKR", "/admin/workspace/okr", [
            ["buat","Buat OKR"],
            ["daftar","Daftar OKR"],
            ["berulang","OKR berulang"],
            ["riwayat","Riwayat perintah"]
          ]),
          { key: "ws-automation", label: "Otomatisasi", href: "/admin/workspace/automation" },
          { key: "ws-teams", label: "Tim Workspace", href: "/admin/workspace/teams" },
          { key: "ws-roles", label: "Peran & Izin", href: "/admin/workspace/roles" },
          { key: "ws-schedules", label: "Jadwal Kerja", href: "/admin/workspace/schedules" },
          { key: "ws-welcome", label: "Penyambutan Anggota", href: "/admin/workspace/welcome" },
          { key: "ws-features", label: "Sakelar Fitur", href: "/admin/workspace/features" },
          { key: "ws-settings", label: "Konfigurasi Sistem", href: "/admin/workspace/settings" }
        ],
      },
      { key: "after-dark", label: "After Dark (18+)", href: "/admin/after-dark", icon: "<path d=\"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z\"/>" }
    ],
  },
  {
    key: "grup-konten", label: "Konten Website",
    icon: "<path d=\"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7\"/><path d=\"M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z\"/>",
    items: [
      {
        key: "grup-halaman", label: "Halaman Publik",
        items: [
          { key: "halaman-home", label: "Beranda", href: "/admin/halaman/home" },
          { key: "halaman-products", label: "Game & Bot", href: "/admin/halaman/products" },
          { key: "halaman-about", label: "Tentang", href: "/admin/halaman/about" },
          { key: "halaman-support", label: "Bantuan", href: "/admin/halaman/support" },
          { key: "halaman-global", label: "Global", href: "/admin/halaman/global" }
        ],
      },
      { key: "produk", label: "Katalog Produk", href: "/admin/produk" },
      { key: "konten", label: "Pengumuman Website", href: "/admin/konten" },
      {
        key: "grup-blog", label: "Blog",
        items: [
          { key: "blog", label: "Semua Artikel", href: "/admin/blog" },
          tabHalaman("blog-review", "Peninjauan Tulisan", "/admin/blog/peninjauan", [
            ["antrean","Antrean"],
            ["ditolak","Ditolak"],
            ["riwayat","Riwayat"],
            ["penulis","Penulis"]
          ]),
          tabHalaman("blog-pengaturan", "Kategori & Penulis", "/admin/blog/pengaturan", [
            ["kategori","Kategori"],
            ["penulis","Penulis"]
          ])
        ],
      },
      {
        key: "grup-faq", label: "FAQ & Panduan",
        items: [
          { key: "faq", label: "Panduan Website", href: "/admin/faq" },
          { key: "faq-kategori", label: "Kategori Panduan", href: "/admin/faq/categories" },
          { key: "faq-bot", label: "FAQ Bot Discord", href: "/admin/faq/bot" }
        ],
      }
    ],
  },
  {
    key: "grup-pengguna", label: "Pengguna & Tim",
    icon: "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M22 21v-2a4 4 0 0 0-3-3.87\"/><path d=\"M16 3.13a4 4 0 0 1 0 7.75\"/>",
    items: [
      tabHalaman("pemain", "Pemain", "/admin/pemain", [
        ["cermin","Cermin website"],
        ["kelola","Kelola pemain"],
        ["ranking","Ranking live"],
        ["banned","Banned"]
      ]),
      { key: "pemain-teraktif", label: "Pemain Teraktif", href: "/admin/pemain-teraktif" },
      { key: "server", label: "Server Discord", href: "/admin/server" },
      { key: "team", label: "Tim Studio", href: "/admin/team", icon: "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M22 21v-2a4 4 0 0 0-3-3.87\"/><path d=\"M16 3.13a4 4 0 0 1 0 7.75\"/>" }
    ],
  },
  {
    key: "grup-komunikasi", label: "Komunikasi",
    icon: "<path d=\"m21 3-6.5 18-4-7.5L3 9.5 21 3Z\"/><path d=\"m21 3-10.5 10.5\"/>",
    items: [
      { key: "dev-broadcast", label: "Pesan Massal Bot", href: "/admin/developer/broadcast" },
      { key: "dev-campaign", label: "Kampanye Bot", href: "/admin/developer/campaign" },
      { key: "dev-polling", label: "Jajak Pendapat", href: "/admin/developer/polling" },
      { key: "promo", label: "Promo", href: "/admin/promo" },
      { key: "partnership-broadcast", label: "Kampanye Partner", href: "/admin/partnership/broadcast" },
      { key: "partnership-templates", label: "Template Partner", href: "/admin/partnership/templates" },
      { key: "partnership-history", label: "Riwayat Kampanye Partner", href: "/admin/partnership/history" }
    ],
  },
  {
    key: "grup-partnership", label: "Partnership",
    icon: "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"m17 11 2 2 4-4\"/>",
    items: [
      { key: "partnership-overview", label: "Ringkasan", href: "/admin/partnership" },
      { key: "partnership-orders", label: "Pesanan", href: "/admin/partnership/orders" },
      { key: "partnership-layanan", label: "Layanan & Masa Aktif", href: "/admin/partnership/layanan" },
      { key: "partnership-partners", label: "Akun Partner", href: "/admin/partnership/partners" },
      { key: "partnership-active-players", label: "Audiens Pemain Aktif", href: "/admin/partnership/active-players" },
      { key: "partnership-products", label: "Paket Kampanye", href: "/admin/partnership/products" },
      { key: "partnership-jasa", label: "Halaman Jasa", href: "/admin/partnership/jasa" },
      { key: "partnership-categories", label: "Kategori", href: "/admin/partnership/categories" },
      { key: "partnership-lobby", label: "Lobby Bot", href: "/admin/partnership/lobby" },
      tabHalaman("partnership-settings", "Pengaturan", "/admin/partnership/settings", [
        ["url","URL"],
        ["custom-links","Custom Links"],
        ["konten","Konten halaman publik"]
      ])
    ],
  },
  {
    key: "grup-sistem", label: "Sistem & Operasi",
    icon: "<path d=\"M12 8v4l3 3\"/><circle cx=\"12\" cy=\"12\" r=\"9\"/>",
    items: [
      tabHalaman("operasi", "Operasi & Riwayat Perintah", "/admin/operasi", [
        ["pemain","Pemain"],
        ["progression","Progression"],
        ["boost","Boost"],
        ["promo","Promo"],
        ["quest","Quest"],
        ["tutorial","Tutorial"],
        ["dm-campaign","DM Campaign"],
        ["database","Database"],
        ["riwayat","Riwayat perintah"]
      ]),
      tabHalaman("dev-autoheal", "Pemulihan Otomatis", "/admin/developer/autoheal", [
        ["status","Status"],
        ["permintaan-izin","Permintaan izin"],
        ["kontrol","Kontrol"],
        ["incident-terbaru","Incident terbaru"],
        ["izin-aktif","Izin aktif"]
      ])
    ],
  },
  {
    key: "grup-data", label: "Log & Statistik",
    icon: "<path d=\"M3 3v18h18\"/><path d=\"m7 15 3-4 3 3 5-7\"/>",
    items: [
      { key: "bot-diagnostics", label: "Diagnostik Bot", href: "/admin/diagnostik" },
      { key: "logs", label: "Log Aktivitas", href: "/admin/logs" },
      tabHalaman("dev-error", "Diagnosis Error", "/admin/developer/error", [
        ["ringkasan","Ringkasan"],
        ["error-terbaru","Error terbaru"],
        ["fingerprint-teratas","Fingerprint teratas"],
        ["auto-recovery-per-metode","Auto-recovery"]
      ]),
      { key: "statistik", label: "Statistik", href: "/admin/statistik" }
    ],
  }
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
