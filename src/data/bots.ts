// Registry produk Vanillate Studio (dulu "bots").
//
// SUMBER DATA: src/data/synced/products.json — ditarik dari Supabase saat build
// (scripts/sync-content.mjs). Jadi katalog dikelola dari /admin/produk, bukan
// ditulis di sini. Modul ini tetap bernama `bots` dan mempertahankan API lama
// (Bot, buildInviteUrl, getFeaturedBot, dst) supaya seluruh halaman yang sudah
// ada tidak perlu diubah — sekaligus menambah dukungan produk non-Discord
// (aplikasi Android dengan unduhan APK).

import botInfo from './synced/bot-info.json';
import productsData from './synced/products.json';
import type { IconName } from './icons';

export type Platform = 'discord' | 'android' | 'web';

export type ProductMedia = {
  kind: 'icon' | 'screenshot' | 'video' | 'banner';
  url: string;
  alt: string;
};

export type ProductRelease = {
  version: string;
  url: string;               // URL unduh publik (Supabase Storage)
  fileSize: number | null;   // byte
  sha256: string | null;     // checksum integritas
  minAndroid: string;
  releaseNotes: string;
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
  platform: Platform;           // menentukan pola CTA (Undang vs Download)
  // Discord
  clientId?: string;
  permissions: string;
  scopes: string[];
  integrationType?: string;
  inviteUrlOverride?: string;
  // Android
  packageName?: string;
  minAndroid?: string;
  androidInstallNote?: string;
  release?: ProductRelease | null;   // rilis APK terbaru
  media: ProductMedia[];             // screenshot / video / banner
  // Umum
  color: string;
  icon: IconName;
  thumbnail?: string;
  features: string[];
  commands?: { name: string; description: string }[];
  docsSlug?: string;
  longIntro?: string[];
  ctaLabel?: string;
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
  android?: { packageName?: string; minAndroid?: string; installNote?: string } | null;
  ctaLabel?: string;
  ctaUrl?: string;
  docsSlug?: string;
  seoTitle?: string;
  seoDescription?: string;
  media?: ProductMedia[];
  release?: ProductRelease | null;
};

const STATUSES = ['live', 'beta', 'preorder', 'coming-soon'] as const;
const PLATFORMS = ['discord', 'android', 'web'] as const;

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
    packageName: p.android?.packageName || undefined,
    minAndroid: p.android?.minAndroid || undefined,
    androidInstallNote: p.android?.installNote || undefined,
    release: p.release ?? null,
    media: Array.isArray(p.media) ? p.media : [],
    color: p.color || '#E8B84A',
    icon: (p.icon || 'sparkles') as IconName,
    thumbnail: p.thumbnail || undefined,
    features,
    commands,
    docsSlug: p.docsSlug || undefined,
    longIntro: p.longIntro || [],
    ctaLabel: p.ctaLabel || undefined,
    ctaUrl: p.ctaUrl || undefined,
    seoTitle: p.seoTitle || undefined,
    seoDescription: p.seoDescription || undefined,
  };
}

const allBots: Bot[] = ((productsData.products ?? []) as RawProduct[])
  .filter((p) => p && p.slug && p.name)
  .map(toBot);

// Daftar publik. Sudah difilter `enabled` di sisi sync, jadi tinggal urut.
export const bots: Bot[] = allBots.sort((a, b) => {
  const sa = (productsData.products.find((x: any) => x.slug === a.slug)?.sort ?? 100) as number;
  const sb = (productsData.products.find((x: any) => x.slug === b.slug)?.sort ?? 100) as number;
  return sa - sb;
});

// ─────────────────────────────────────────────────────────────────────────────
// Label CTA standar. Satu sumber kebenaran supaya tombol konsisten di seluruh
// situs (kartu, halaman detail, docs, footer).
// ─────────────────────────────────────────────────────────────────────────────
export const CTA = {
  invite: 'Undang ke Server',
  download: 'Download APK',
  preorder: 'Amankan Tempat',
  notify: 'Ikuti Kabarnya',
  docs: 'Lihat Panduan',
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

/** Rilis APK terbaru sebuah produk Android (atau null). */
export function latestRelease(bot: Bot): ProductRelease | null {
  return bot.platform === 'android' ? (bot.release ?? null) : null;
}

/** URL unduh langsung (APK terbaru) untuk produk Android, atau null. */
export function downloadUrl(bot: Bot): string | null {
  const rel = latestRelease(bot);
  return rel?.url || null;
}

/** Label tombol invite/CTA utama sesuai status & platform bot. */
export function inviteCtaLabel(bot: Bot): string {
  if (bot.platform === 'android') return CTA.download;
  if (bot.status === 'preorder') return CTA.preorder;
  if (bot.status === 'coming-soon') return CTA.notify;
  return CTA.invite;
}

/**
 * CTA utama produk untuk kartu & hero: label + href + apakah tautan eksternal.
 * Discord → invite; Android → unduh APK; selain itu / belum siap → halaman detail.
 */
export function productPrimaryCta(bot: Bot): { label: string; href: string; external: boolean } {
  const invite = buildInviteUrl(bot);
  if (invite) return { label: inviteCtaLabel(bot), href: invite, external: true };
  const dl = downloadUrl(bot);
  if (dl) return { label: `${CTA.download}${latestRelease(bot)?.version ? ` v${latestRelease(bot)!.version}` : ''}`, href: dl, external: true };
  return { label: bot.status === 'coming-soon' ? CTA.notify : `Lihat ${bot.shortName}`, href: `/products/${bot.slug}`, external: false };
}

/** Format ukuran byte ke bentuk ringkas (mis. 24 MB). */
export function formatBytes(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

export function getFeaturedBot(): Bot {
  return bots.find((b) => b.featured) ?? bots[0];
}

/** Produk lain selain `slug`, untuk section cross-link di halaman detail & docs. */
export function getOtherBots(slug: string, limit = 3): Bot[] {
  return bots.filter((b) => b.slug !== slug).slice(0, limit);
}
