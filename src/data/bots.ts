// Registry produk Vanillate Studio (dulu "bots").
//
// SUMBER DATA: src/data/synced/products.json — ditarik dari Supabase saat build
// (scripts/sync-content.mjs). Jadi katalog dikelola dari /admin/produk, bukan
// ditulis di sini. Modul ini tetap bernama `bots` dan mempertahankan API lama
// (Bot, buildInviteUrl, getFeaturedBot, dst) supaya seluruh halaman yang sudah
// ada tidak perlu diubah — sekaligus menambah dukungan produk non-Discord
// (aplikasi web yang dibuka lewat tautan).

import botInfo from './synced/bot-info.json';
import productsData from './synced/products.json';
import type { IconName } from './icons';
import { url } from '@utils/url';

export type Platform = 'discord' | 'web';

export type BadgeTone = 'accent' | 'info' | 'success' | 'warn' | 'neutral';

export type ProductFaq = { q: string; a: string };

export type ProductMedia = {
  kind: 'icon' | 'screenshot' | 'video' | 'banner';
  url: string;
  alt: string;
};

export type Bot = {
  slug: string;                 // URL segment: /products/<slug> (redirect /bots/<slug>)
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  status: 'live' | 'beta' | 'preorder' | 'coming-soon';
  featured: boolean;
  verified?: boolean;
  category: string;
  platform: Platform;           // menentukan pola CTA (Undang vs Buka aplikasi)
  // Discord
  clientId?: string;
  permissions: string;
  scopes: string[];
  integrationType?: string;
  inviteUrlOverride?: string;
  media: ProductMedia[];             // screenshot / video / banner
  // Umum
  color: string;
  icon: IconName;
  /** Logo/cover. OPSIONAL — kosong berarti situs memakai ikon aksen. */
  thumbnail?: string;
  badge?: string;
  badgeTone: BadgeTone;
  faq: ProductFaq[];
  ctaHeading?: string;
  ctaText?: string;
  features: string[];
  commands?: { name: string; description: string }[];
  /** Slug kategori FAQ produk ini (pengganti dokumentasi per produk). */
  faqCategory?: string;
  longIntro?: string[];
  /** Produk web: label tombol utama (opsional; default "Buka Aplikasi"). */
  ctaLabel?: string;
  /** Produk web: tautan aplikasi/website (mis. domain Netlify/Vercel). */
  ctaUrl?: string;
  ctaNote?: string;
  seoTitle?: string;
  seoDescription?: string;
  founding?: {
    title: string;
    intro: string;
    perks: string[];
    requirements?: string[];
    footnote?: string;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Bentuk baris products.json (keluaran sync). Dipisah dari tipe `Bot` supaya
// perubahan sumber tidak diam-diam mengubah kontrak yang dipakai komponen.
// ─────────────────────────────────────────────────────────────────────────────
type RawProduct = {
  slug: string;
  name: string;
  shortName?: string;
  tagline?: string;
  description?: string;
  platform?: string;
  status?: string;
  category?: string;
  color?: string;
  icon?: string;
  thumbnail?: string;
  featured?: boolean;
  verified?: boolean;
  sort?: number;
  features?: string[];
  longIntro?: string[];
  commands?: { name: string; description: string }[];
  discord?: { clientId?: string; permissions?: string; scopes?: string[]; integrationType?: string; inviteUrl?: string };
  ctaLabel?: string;
  ctaUrl?: string;
  faqCategory?: string;
  seoTitle?: string;
  seoDescription?: string;
  media?: ProductMedia[];
  badge?: string;
  badgeTone?: string;
  faq?: ProductFaq[];
  ctaHeading?: string;
  ctaText?: string;
  ctaNote?: string;
};

const STATUSES = ['live', 'beta', 'preorder', 'coming-soon'] as const;
const PLATFORMS = ['discord', 'web'] as const;
const TONES = ['accent', 'info', 'success', 'warn', 'neutral'] as const;

function toBot(p: RawProduct): Bot {
  const isSambungKata = p.slug === 'sambung-kata';
  // Untuk Sambung Kata, fitur & command tetap satu sumber kebenaran di repo bot
  // (bot-info.json). Produk lain memakai nilai dari CMS.
  const features = p.features && p.features.length ? p.features : (isSambungKata ? botInfo.features : []);
  const commands = p.commands && p.commands.length ? p.commands : (isSambungKata ? botInfo.commands : []);

  const status = (STATUSES as readonly string[]).includes(p.status ?? '') ? (p.status as Bot['status']) : 'live';
  const platform = (PLATFORMS as readonly string[]).includes(p.platform ?? '') ? (p.platform as Platform) : 'discord';

  return {
    slug: p.slug,
    name: p.name,
    shortName: p.shortName || p.name,
    tagline: p.tagline || '',
    description: p.description || '',
    status,
    featured: Boolean(p.featured),
    verified: p.verified,
    category: p.category || '',
    platform,
    clientId: p.discord?.clientId || undefined,
    permissions: p.discord?.permissions || '0',
    scopes: p.discord?.scopes && p.discord.scopes.length ? p.discord.scopes : ['bot', 'applications.commands'],
    integrationType: p.discord?.integrationType || undefined,
    inviteUrlOverride: p.discord?.inviteUrl || undefined,
    // Media tanpa URL disaring di sini. Bila lolos, section galeri tetap
    // dianggap berisi lalu merender <img> kosong — judul muncul di atas
    // ruang yang tidak berisi apa-apa.
    media: Array.isArray(p.media) ? p.media.filter((m) => m && m.url) : [],
    color: p.color || '#E8B84A',
    icon: (p.icon || 'sparkles') as IconName,
    // Kosong → undefined, supaya pemeriksaan `bot.thumbnail ?` di komponen
    // langsung jatuh ke ikon aksen alih-alih mencoba memuat string kosong.
    thumbnail: p.thumbnail || undefined,
    badge: p.badge || undefined,
    badgeTone: (TONES as readonly string[]).includes(p.badgeTone ?? '') ? (p.badgeTone as BadgeTone) : 'accent',
    faq: Array.isArray(p.faq) ? p.faq.filter((f) => f && f.q && f.a) : [],
    ctaHeading: p.ctaHeading || undefined,
    ctaText: p.ctaText || undefined,
    ctaNote: p.ctaNote || undefined,
    features,
    commands,
    faqCategory: p.faqCategory || undefined,
    longIntro: p.longIntro || [],
    ctaLabel: p.ctaLabel || undefined,
    ctaUrl: p.ctaUrl || undefined,
    seoTitle: p.seoTitle || undefined,
    seoDescription: p.seoDescription || undefined,
  };
}

const mentah = (productsData.products ?? []) as RawProduct[];

// Urutan dibaca sekali ke dalam Map. Comparator yang memanggil find() akan
// memindai ulang seluruh daftar pada setiap perbandingan.
const urutan = new Map<string, number>(
  mentah.map((p) => [p.slug, Number.isFinite(Number(p.sort)) ? Number(p.sort) : 100]),
);

const allBots: Bot[] = mentah.filter((p) => p && p.slug && p.name).map(toBot);

// Daftar publik. Sudah difilter `enabled` di sisi sync, jadi tinggal urut.
export const bots: Bot[] = allBots.sort(
  (a, b) => (urutan.get(a.slug) ?? 100) - (urutan.get(b.slug) ?? 100),
);

// ─────────────────────────────────────────────────────────────────────────────
// Label CTA standar. Satu sumber kebenaran supaya tombol konsisten di seluruh
// situs (kartu, halaman detail, FAQ, footer).
// ─────────────────────────────────────────────────────────────────────────────
export const CTA = {
  invite: 'Undang ke Server',
  open: 'Buka Aplikasi',
  preorder: 'Amankan Tempat',
  notify: 'Ikuti Kabarnya',
  guide: 'Lihat Panduan',
  discord: 'Gabung Komunitas',
} as const;

/**
 * Bangun invite URL Discord dari clientId + permissions + scopes.
 * Menghormati inviteUrlOverride bila diisi dari CMS. Hanya untuk platform Discord.
 */
export function buildInviteUrl(bot: Bot): string | null {
  if (bot.platform !== 'discord') return null;
  if (bot.inviteUrlOverride) return bot.inviteUrlOverride;
  if (!bot.clientId || bot.status === 'coming-soon') return null; // preorder tetap boleh diundang
  const params = new URLSearchParams({ client_id: bot.clientId, permissions: bot.permissions });
  if (bot.integrationType) params.set('integration_type', bot.integrationType);
  params.set('scope', bot.scopes.join(' '));
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

/** Tautan aplikasi web sebuah produk (platform 'web'), atau null. */
export function webAppUrl(bot: Bot): string | null {
  return bot.platform === 'web' ? (bot.ctaUrl || null) : null;
}

/** Label tombol utama aplikasi web (dari CMS bila diisi, selain itu bawaan). */
export function webCtaLabel(bot: Bot): string {
  return bot.ctaLabel || CTA.open;
}

/** Label tombol invite/CTA utama Discord sesuai status bot. */
export function inviteCtaLabel(bot: Bot): string {
  if (bot.status === 'preorder') return CTA.preorder;
  if (bot.status === 'coming-soon') return CTA.notify;
  return CTA.invite;
}

/**
 * CTA utama produk untuk kartu & hero: label + href + apakah tautan eksternal.
 * Discord → invite; Web → buka aplikasi; selain itu / belum siap → halaman detail.
 */
export function productPrimaryCta(bot: Bot): { label: string; href: string; external: boolean } {
  const invite = buildInviteUrl(bot);
  if (invite) return { label: inviteCtaLabel(bot), href: invite, external: true };
  const web = webAppUrl(bot);
  if (web) return { label: webCtaLabel(bot), href: web, external: true };
  return { label: bot.status === 'coming-soon' ? CTA.notify : `Lihat ${bot.shortName}`, href: `/products/${bot.slug}`, external: false };
}

/**
 * Sumber gambar produk yang aman dipakai di <img src>.
 *
 * Ada dua jenis sumber dan keduanya TIDAK boleh diperlakukan sama:
 *   • URL absolut (Supabase Storage / CDN) → dipakai apa adanya. Menempelkan
 *     base atau menukar akhiran akan menghasilkan URL yang tidak pernah ada.
 *   • Path lokal di /public → boleh memakai varian "-256" karena varian itu
 *     memang kita sediakan sendiri di repo.
 *
 * Mengembalikan null bila produk tidak punya gambar, sehingga pemanggil
 * merender ikon aksen alih-alih <img> kosong.
 */
export function productImage(src: string | undefined | null, small = false): string | null {
  const s = String(src ?? '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return url(small ? s.replace(/\.png$/, '-256.png') : s);
}

// Avatar animasi (PNG "profil hidup") per produk. Sengaja ditaruh di kode, bukan
// di data tersinkron (products.json ditimpa tiap sync), supaya penetapan ini
// tidak hilang. Kosong → produk memakai avatar statis biasa. Dipakai bersama
// fallback <picture> yang menghormati prefers-reduced-motion (statis saat
// reduced motion, animasi saat tidak).
const LOCAL_ANIMATED: Record<string, string> = {
  'sambung-kata': '/bots/sambung-kata.webp',
};

/** URL avatar animasi (WebP) produk bila tersedia, atau null. */
export function productAnimated(slug: string): string | null {
  const p = LOCAL_ANIMATED[slug];
  return p ? url(p) : null;
}

/** Kelas Tailwind untuk badge produk. Nada dipetakan di sini, bukan disimpan di DB. */
export function badgeClass(tone: BadgeTone): string {
  switch (tone) {
    case 'info':    return 'bg-teal-500/15 text-teal-700 dark:text-teal-300';
    case 'success': return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
    case 'warn':    return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
    case 'neutral': return 'bg-ink-900/10 dark:bg-cream-100/10 text-ink-600 dark:text-cream-200';
    default:        return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
  }
}

export function getFeaturedBot(): Bot {
  return bots.find((b) => b.featured) ?? bots[0];
}

/** Produk lain selain `slug`, untuk section cross-link di halaman detail & FAQ. */
export function getOtherBots(slug: string, limit = 3): Bot[] {
  return bots.filter((b) => b.slug !== slug).slice(0, limit);
}
