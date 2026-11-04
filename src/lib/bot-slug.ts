// ════════════════════════════════════════════════════════════════════════════
//  Kunci internal bot (`bot_slug`) di tabel CMS bot_* dan Database Bot.
//
//  Slug lama `sambung-kata` diganti `vanillateID`. Bot membaca slug dari env
//  WEBSITE_BOT_SLUG, jadi peralihan dilakukan bertahap supaya perintah CMS
//  (Update & Restart, dst.) tidak putus:
//
//   1. Website menulis slug lama dan membaca KEDUA slug.
//   2. Bot di-update, migration Database Bot dan SQL CMS diterapkan.
//   3. Website menulis slug BARU (bawaan sekarang); membaca tetap kedua slug.
//
//  Urutan lengkap: docs/ADMIN-CMS.md bagian "Peralihan bot_slug".
// ════════════════════════════════════════════════════════════════════════════

export const BOT_SLUG_LEGACY = 'sambung-kata';
export const BOT_SLUG_NEW = 'vanillateID';
export const BOT_SLUGS_READ: readonly string[] = [BOT_SLUG_LEGACY, BOT_SLUG_NEW];

/**
 * Slug yang dipakai website saat MENULIS. Peralihan sudah selesai (bot, Database
 * Bot, dan CMS memakai `vanillateID`), jadi bawaannya slug baru. Penanda
 * PUBLIC_BOT_SLUG_WRITE=sambung-kata hanya tersisa untuk rollback darurat.
 */
export function resolveWriteSlug(raw: unknown): string {
  return raw === BOT_SLUG_LEGACY ? BOT_SLUG_LEGACY : BOT_SLUG_NEW;
}

export const BOT_SLUG_WRITE = resolveWriteSlug(import.meta.env?.PUBLIC_BOT_SLUG_WRITE);

/**
 * Dari beberapa baris dengan `key` yang sama (satu per slug), pilih yang paling
 * baru diperbarui. Dipakai untuk bot_panel_snapshots yang kuncinya (bot_slug, key).
 */
export function newestPerKey<T extends { key: string; updated_at?: string | null }>(rows: T[]): T[] {
  const best = new Map<string, T>();
  for (const r of rows) {
    const cur = best.get(r.key);
    if (!cur || String(r.updated_at ?? '') > String(cur.updated_at ?? '')) best.set(r.key, r);
  }
  return [...best.values()];
}
