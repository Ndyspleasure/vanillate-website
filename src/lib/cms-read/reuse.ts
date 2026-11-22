// ═════════════════════════════════════════════════
//  Pemakaian ulang hasil perintah baca-saja `read.*` (HO-037).
//
//  Halaman CMS meminta ringkasan ke bot lewat antrean `bot_commands`. Bila admin lain
//  (atau admin yang sama) baru saja meminta tipe yang sama dan hasilnya masih segar,
//  hasil itu dipakai ulang: tidak ada INSERT baru, tidak ada pekerjaan bot, tidak ada
//  query database. Fungsi murni supaya mudah diuji:
//  `node --experimental-strip-types --test tests/cms-read-reuse.test.ts`.
// ═════════════════════════════════════════════════

export type CmsView = 'serverhub';

/** Tipe perintah bot per tampilan (SSoT sisi website; harus sama dengan registry bot). */
export const READ_TYPE: Record<CmsView, string> = {
  serverhub: 'read.serverhub',
};

/** Umur maksimum hasil yang boleh dipakai ulang (ms). Sama dengan cache di bot. */
export const REUSE_MS = 60_000;

export interface CommandRow {
  status?: string | null;
  result?: unknown;
  processed_at?: string | null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Hasil perintah terbaru yang selesai dan masih segar, atau null. `rows` diurutkan
 * terbaru dulu (seperti `riwayatPerintah`). Baris terbaru yang belum selesai atau gagal
 * tidak menghalangi pemakaian hasil selesai yang lebih lama, selama masih segar.
 */
export function hasilSegar(rows: CommandRow[], now: number, maxAgeMs: number = REUSE_MS): Record<string, unknown> | null {
  for (const row of rows) {
    if (row?.status !== 'done' || !isRecord(row.result) || !row.processed_at) continue;
    const at = Date.parse(row.processed_at);
    if (!Number.isFinite(at)) continue;
    const umur = now - at;
    // Jam perangkat bisa sedikit lebih lambat dari server: toleransi 5 detik ke depan.
    if (umur >= -5_000 && umur < maxAgeMs) return row.result;
  }
  return null;
}

/** Buang kunci yang hanya bermakna di sisi bot (`cached`) sebelum diberikan ke model. */
export function bersihkanHasil(result: Record<string, unknown>): Record<string, unknown> {
  const { cached: _cached, ...sisa } = result;
  return sisa;
}
