// Logika murni tampilan Portal Penulis Blog (teruji, tanpa DOM).

import { slugify, wordCount } from './markdown.ts';

export type SubmissionStatus = 'draf' | 'menunggu' | 'ditolak' | 'terbit';

export const STATUS_META: Record<SubmissionStatus, { label: string; tone: 'neutral' | 'warning' | 'danger' | 'success'; hint: string }> = {
  draf: { label: 'Draf', tone: 'neutral', hint: 'Belum diajukan. Hanya kamu yang bisa melihatnya.' },
  menunggu: { label: 'Menunggu persetujuan', tone: 'warning', hint: 'Sedang ditinjau tim Vanillate. Kamu akan menerima email.' },
  ditolak: { label: 'Perlu revisi', tone: 'danger', hint: 'Baca alasannya, perbaiki, lalu ajukan lagi.' },
  terbit: { label: 'Terbit', tone: 'success', hint: 'Sudah tayang di blog.' },
};

export function statusMeta(status: string) {
  return STATUS_META[status as SubmissionStatus] ?? STATUS_META.draf;
}

/** "satu, dua\n tiga" → ['satu','dua','tiga'] tanpa duplikat (abaikan huruf besar). */
export function tagsFromText(text: string, max = 12): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of String(text ?? '').split(/[,\n]/)) {
    const t = raw.trim().slice(0, 40);
    const k = slugify(t);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/** Satu poin per baris, maks 6. */
export function tldrFromText(text: string, max = 6): string[] {
  return String(text ?? '').split('\n').map((l) => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean).slice(0, max);
}

/** Ganti `blogimg:<path>` dengan URL sementara (pratinjau). */
export function previewBody(body: string, urls: Record<string, string>): string {
  return String(body ?? '').replace(/\(blogimg:([^)\s]+)((?:\s+"[^"]*")?)\)/g, (m, path: string, cap: string) =>
    urls[path] ? `(${urls[path]}${cap})` : m);
}

export interface Hint {
  ok: boolean;
  text: string;
}

/** Petunjuk cepat sebelum mengajukan. Validasi akhir ada di server. */
export function quickChecks(d: { title: string; body: string; excerpt: string; mainImagePath: string | null; mainImageAlt: string; categories: string[] }): Hint[] {
  const kata = wordCount(d.body);
  return [
    { ok: d.title.trim().length >= 5, text: 'Judul minimal 5 karakter' },
    { ok: kata >= 50, text: `Isi minimal 50 kata (sekarang ${kata})` },
    { ok: d.excerpt.trim().length > 0, text: 'Ringkasan terisi' },
    { ok: Boolean(d.mainImagePath), text: 'Gambar utama diunggah' },
    { ok: Boolean(d.mainImagePath) && d.mainImageAlt.trim().length > 0, text: 'Alt text gambar utama terisi' },
    { ok: d.categories.length > 0, text: 'Pilih minimal satu kategori' },
  ];
}
