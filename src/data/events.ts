// ─────────────────────────────────────────────────────────────────────────────
// Sumber TUNGGAL data event in-game Sambung Kata.
// Dipakai di dua tempat sekaligus:
//   - Beranda (src/pages/index.astro)      → highlight beranimasi
//   - Dokumentasi (src/data/docs.ts)        → section "Event Spesial PvP"
// Ubah di sini = otomatis berubah di kedua tempat. Jangan duplikat data event.
// ─────────────────────────────────────────────────────────────────────────────

export type EventStat = { label: string; value: string };

export type GameEvent = {
  icon: string;        // Emoji ikon event
  name: string;        // Nama event (mis. "AI Challenger")
  tagline: string;     // Satu kalimat penjelas
  accent: string;      // Warna aksen kartu (hex), tema per event
  stats: EventStat[];  // Chip meta: peluang, kesulitan/durasi, tim
  reward: string;      // Ringkasan reward jika sukses
  fail: string;        // Ringkasan konsekuensi jika gagal
  href: string;        // Deep-link ke detail di dokumentasi
};

const DOCS_ANCHOR = '/docs/sambung-kata#event-spesial';

export const sambungKataEvents: GameEvent[] = [
  {
    icon: '🤖',
    name: 'AI Challenger',
    tagline: 'Boss AI menantang seisi room. Kerja sama menumbangkannya sebelum match usai.',
    accent: '#4FA89D',
    stats: [
      { label: 'Peluang', value: 'Sering' },
      { label: 'Kesulitan', value: 'Sedang' },
      { label: 'Tim', value: 'Co-op' },
    ],
    reward: '×2 Coin & EXP untuk semua pemain',
    fail: 'Tidak ada reward, game lanjut normal',
    href: DOCS_ANCHOR,
  },
  {
    icon: '📡',
    name: 'Lost Signal',
    tagline: 'Sistem bahasa pecah jadi 5 fragmen. Kumpulkan semua sebelum match berakhir.',
    accent: '#5B8DEF',
    stats: [
      { label: 'Peluang', value: 'Cukup' },
      { label: 'Kesulitan', value: 'Mudah–Sedang' },
      { label: 'Tim', value: 'Co-op' },
    ],
    reward: '×2 Coin & EXP untuk semua pemain',
    fail: 'Tidak ada reward (progress akhir ditampilkan)',
    href: DOCS_ANCHOR,
  },
  {
    icon: '🧳',
    name: 'Traveling Merchant',
    tagline: 'Toko dadakan berisi item langka & diskon. Aktif hanya 5 menit lalu pergi.',
    accent: '#E8B84A',
    stats: [
      { label: 'Peluang', value: 'Sering' },
      { label: 'Durasi', value: '5 menit' },
      { label: 'Tim', value: 'Individu' },
    ],
    reward: 'Item boost / Contract multiplier',
    fail: 'Zonk (Package) atau Contract gagal',
    href: DOCS_ANCHOR,
  },
  {
    icon: '🗡️',
    name: 'Penjajah (Invader)',
    tagline: 'Event spesial Hari Kemerdekaan RI (17 Agustus). Tahan Steal, Block, & Challenge sampai boss terusir.',
    accent: '#E5484D',
    stats: [
      { label: 'Peluang', value: 'Jarang–Cukup' },
      { label: 'Kesulitan', value: 'Sulit' },
      { label: 'Tim', value: 'vs Boss' },
    ],
    reward: '×2 Coin & EXP + lore spesial',
    fail: 'Hard-fail: ×0 reward (match berakhir)',
    href: DOCS_ANCHOR,
  },
];
