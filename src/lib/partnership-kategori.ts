// ════════════════════════════════════════════════════════════════════════════
// PARTNERSHIP — KATEGORI (hierarki Kategori → Item di panel admin)
//
// Sebelumnya partner & produk dirender sebagai SATU daftar panjang: menumpuk
// ke bawah, tanpa struktur. Modul ini memberi keduanya perlakuan yang sama
// dengan /admin/kontrol (bagian 9 schema): metadata kategori datang dari DB
// (`partnership_categories`), frontend hanya merender section-nya.
//
// Kategori yang SAMA dipakai bot untuk mengelompokkan Dashboard Partnership,
// jadi urutan yang dilihat admin di sini = urutan yang dilihat pemain.
//
// Berjalan di browser (dipakai halaman admin), murni tanpa Supabase.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from './admin-ui';

/** Kategori penampung untuk item yang belum/tidak dikategorikan. */
export const KATEGORI_LAINNYA = 'lainnya';

export interface Kategori {
  key: string;
  label: string;
  description?: string | null;
  icon?: string | null;
  emoji?: string | null;
  scope?: string | null;
  enabled?: boolean | null;
  sort?: number | null;
}

// Registry ikon Lucide (NAMA → path SVG). DB menyimpan NAMA ikon, bukan markup
// — persis seperti /admin/kontrol — supaya tidak ada HTML mentah dari database
// yang bisa masuk ke halaman admin. Nama tak dikenal jatuh ke `handshake`.
const IC: Record<string, string> = {
  users:     '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  sparkles:  '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',
  tag:       '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
  calendar:  '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 2v4"/><path d="M16 2v4"/>',
  megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  layout:    '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>',
  store:     '<path d="m2 7 1.5-4h17L22 7"/><path d="M4 7v13a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7"/><path d="M2 7a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
  star:      '<path d="M11.5 2.5a.6.6 0 0 1 1 0l2.4 5 5.5.8a.6.6 0 0 1 .3 1l-4 3.8.9 5.5a.6.6 0 0 1-.9.6L12 16.6l-4.9 2.6a.6.6 0 0 1-.9-.6l1-5.5-4-3.8a.6.6 0 0 1 .3-1l5.5-.8z"/>',
  gift:      '<rect width="20" height="5" x="2" y="7" rx="1"/><path d="M12 22V7"/><path d="M4 12v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9"/><path d="M7.5 7a2.5 2.5 0 0 1 0-5C10 2 12 5 12 7c0-2 2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  settings:  '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  handshake: '<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>',
};

/** Path SVG ikon kategori. Nama tak dikenal → ikon handshake (netral). */
export function ikonSvg(nama: string | null | undefined): string {
  return IC[String(nama ?? '')] ?? IC.handshake;
}

/** Ikon kategori siap tempel (bulat, seragam dengan /admin/kontrol). */
export function ikonKategori(cat: Kategori): string {
  return `<span class="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
    <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ikonSvg(cat.icon)}</svg>
  </span>`;
}

/** Kategori bawaan untuk item yang key kategorinya tidak dikenal. */
export function kategoriLainnya(key = KATEGORI_LAINNYA): Kategori {
  return {
    key,
    label: key === KATEGORI_LAINNYA ? 'Lainnya' : key,
    description: 'Belum dikategorikan. Pilih kategori pada item di bawah agar tidak menumpuk di sini.',
    icon: 'settings',
    emoji: '🤝',
  };
}

/** Kategori yang boleh dipakai `scope` tertentu ('partner' | 'produk'). */
export function untukScope(kategori: Kategori[], scope: 'partner' | 'produk'): Kategori[] {
  return kategori.filter((c) => c.enabled !== false && (!c.scope || c.scope === 'semua' || c.scope === scope));
}

export interface Kelompok<T> {
  kategori: Kategori;
  items: T[];
}

/**
 * Kelompokkan item ke dalam section per kategori.
 *
 * Urutan section mengikuti tabel kategori (DB). Kategori yang punya item tapi
 * belum ada metadata-nya tetap tampil di akhir sebagai fallback — jadi
 * menambah kategori lewat DB langsung terorganisir, dan tidak ada item yang
 * hilang dari layar hanya karena kategorinya belum terdaftar.
 */
export function kelompokkan<T extends { category?: string | null }>(
  items: T[],
  kategori: Kategori[],
): Array<Kelompok<T>> {
  const perKategori = new Map<string, T[]>();
  for (const item of items) {
    const k = String(item.category ?? '').trim() || KATEGORI_LAINNYA;
    if (!perKategori.has(k)) perKategori.set(k, []);
    perKategori.get(k)!.push(item);
  }

  const dikenal = new Set(kategori.map((c) => c.key));
  return [
    ...kategori.filter((c) => perKategori.has(c.key)).map((c) => ({ kategori: c, items: perKategori.get(c.key)! })),
    ...[...perKategori.keys()]
      .filter((k) => !dikenal.has(k))
      .map((k) => ({ kategori: kategoriLainnya(k), items: perKategori.get(k)! })),
  ];
}

/** Header section kategori: ikon + label + jumlah item + deskripsi. */
export function headerKategori(cat: Kategori, jumlah: number): string {
  const desc = cat.description
    ? `<p class="mt-0.5 text-sm text-ink-500 dark:text-cream-300/60">${esc(cat.description)}</p>`
    : '';
  return `
    <div class="flex items-start gap-3">
      ${ikonKategori(cat)}
      <div class="min-w-0">
        <h3 class="font-display text-lg font-semibold tracking-tightest flex items-center">
          ${esc(cat.label)}
          <span class="ml-2 rounded-full bg-ink-900/5 dark:bg-cream-100/10 px-2 py-0.5 text-xs font-medium text-ink-500 dark:text-cream-300/60">${jumlah}</span>
        </h3>
        ${desc}
      </div>
    </div>`;
}

/** <option> untuk dropdown kategori pada form item. */
export function opsiKategori(kategori: Kategori[], terpilih: string | null | undefined): string {
  const nilai = String(terpilih ?? '').trim() || KATEGORI_LAINNYA;
  const daftar = kategori.some((c) => c.key === nilai) ? kategori : [...kategori, kategoriLainnya(nilai)];
  return daftar
    .map((c) => `<option value="${esc(c.key)}" ${c.key === nilai ? 'selected' : ''}>${esc(c.label)}</option>`)
    .join('');
}
