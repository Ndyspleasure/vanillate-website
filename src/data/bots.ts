// Registry bot Vanillate Studio.
// Tambah bot baru? Cukup tambahkan objek di array `bots` dan buat halaman docs jika perlu.
// Halaman /bots dan /bots/[slug] akan otomatis menampilkannya.

import botInfo from './synced/bot-info.json';
import type { IconName } from './icons';

export type Bot = {
  slug: string;                 // URL segment: /bots/<slug>
  name: string;                 // Nama lengkap
  shortName: string;            // Nama pendek untuk tombol/badge
  tagline: string;              // Kalimat singkat 1 baris
  description: string;          // Paragraf pendek untuk halaman detail
  status: 'live' | 'beta' | 'preorder' | 'coming-soon';
  featured: boolean;            // Highlight utama di beranda
  hidden?: boolean;             // Sembunyikan dari seluruh tampilan situs (data tetap ada)
  category: string;             // ex: "Word Game", "Idle Simulation"
  clientId?: string;            // Discord Application/Client ID (kosongkan jika belum rilis)
  permissions: string;          // Bitwise permission integer
  scopes: string[];             // OAuth2 scopes
  integrationType?: string;     // Discord integration_type ('0' = guild install, '1' = user install). Kosongkan untuk memakai default Discord.
  color: string;                // Aksen warna bot (hex)
  icon: IconName;               // Nama ikon SVG (registry @data/icons) — fallback saat tak ada thumbnail
  thumbnail?: string;           // Path thumbnail PNG persegi di /public
  features: string[];           // 3-6 poin fitur utama
  commands?: { name: string; description: string }[]; // sample command untuk halaman detail
  docsSlug?: string;            // slug dokumentasi /docs/<docsSlug> (kosongkan jika belum ada)
  longIntro?: string[];         // Paragraf narasi panjang untuk halaman detail (opsional)
  ctaNote?: string;             // Catatan kecil di bawah tombol invite (mis. status preorder)
  seoTitle?: string;            // <title> khusus SEO (fallback: name). Tanpa suffix brand.
  seoDescription?: string;      // meta description khusus SEO (fallback: description)
  founding?: {                  // Program Founding Members / early access (opsional)
    title: string;
    intro: string;
    perks: string[];
    requirements?: string[];
    footnote?: string;
  };
};

/**
 * Bangun invite URL Discord dari clientId + permissions + scopes.
 */
export function buildInviteUrl(bot: Bot): string | null {
  if (!bot.clientId || bot.status === 'coming-soon') return null; // preorder tetap boleh diundang
  const params = new URLSearchParams({
    client_id: bot.clientId,
    permissions: bot.permissions,
  });
  if (bot.integrationType) params.set('integration_type', bot.integrationType);
  params.set('scope', bot.scopes.join(' '));
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Label CTA standar. Satu sumber kebenaran supaya tombol konsisten di seluruh
// situs (kartu, halaman detail, docs, footer). Ubah di sini = berubah di mana pun.
// ─────────────────────────────────────────────────────────────────────────────
export const CTA = {
  invite: 'Undang ke Server',   // bot live: implikasi langsung dipakai
  preorder: 'Amankan Tempat',   // bot preorder: implikasi keuntungan eksklusif
  notify: 'Ikuti Kabarnya',     // coming soon: implikasi menunggu rilis
  docs: 'Lihat Panduan',        // dokumentasi
  discord: 'Gabung Komunitas',  // server Discord
} as const;

/** Label tombol invite/CTA utama sesuai status bot. */
export function inviteCtaLabel(bot: Bot): string {
  if (bot.status === 'preorder') return CTA.preorder;
  if (bot.status === 'coming-soon') return CTA.notify;
  return CTA.invite;
}

const allBots: Bot[] = [
  {
    slug: 'sambung-kata',
    thumbnail: '/bots/sambung-kata.png',
    name: 'Vanillate Sambung Kata',
    shortName: 'Vanillate Sambung Kata',
    tagline: 'Game sambung kata yang kamu kenal sejak kecil, dengan kedalaman yang belum pernah kamu mainkan.',
    description:
      'Permainan kata klasik Indonesia yang dibangun ulang untuk Discord. Sambung kata bareng teman di mode PvP, tantang bot AI di empat tingkat kesulitan, atau turun sendirian ke Dungeon sambil menaikkan Class, menyelesaikan Quest, dan meracik strategi Boost. Kamus 25.000+ kata memastikan setiap jawaban dinilai adil. Karena semua pemain ikut mengetik jawaban, satu ronde saja sudah cukup untuk membangunkan obrolan server yang mulai sepi.',
    status: 'live',
    featured: true,
    category: 'Word Game',
    seoTitle: 'Vanillate Sambung Kata, Bot Game Kata Berantai untuk Discord',
    seoDescription:
      'Main Vanillate Sambung Kata di Discord dengan mode PvP hingga 10 pemain, lawan bot AI 4 tingkat, dan Dungeon solo. Ada 9 Class, Quest harian, dan kamus 25.000+ kata. Gratis tanpa langganan, cocok untuk menghidupkan obrolan komunitas.',
    clientId: '1513806760622817320',
    permissions: '876173413440',
    scopes: ['bot', 'applications.commands'],
    integrationType: '0',
    color: '#E8B84A',
    icon: 'sparkles',
    // Fitur & command ditarik dari data tersinkron (src/data/synced/bot-info.json)
    // yang diambil otomatis dari repo bot. Satu sumber kebenaran — ubah di repo
    // bot, website ikut berubah pada sinkronisasi berikutnya.
    features: botInfo.features,
    commands: botInfo.commands,
    docsSlug: 'sambung-kata',
  },
];

// Daftar publik: bot dengan `hidden: true` disaring dari seluruh tampilan
// (footer, beranda, /bots, dan halaman detail).
// Datanya tetap utuh di atas, jadi cukup ubah flag untuk menampilkannya lagi.
export const bots: Bot[] = allBots.filter((b) => !b.hidden);

export function getFeaturedBot(): Bot {
  return bots.find((b) => b.featured) ?? bots[0];
}

/**
 * Bot lain selain `slug` yang diberikan, untuk section cross-link
 * "bot lainnya" di halaman detail & dokumentasi.
 */
export function getOtherBots(slug: string, limit = 3): Bot[] {
  return bots.filter((b) => b.slug !== slug).slice(0, limit);
}
