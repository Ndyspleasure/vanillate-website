// ═════════════════════════════════════════════════
//  Klien browser untuk tampilan CMS yang dibaca SESUAI PERMINTAAN dari bot.
//
//  Sejak HO-037 data game ada di PostgreSQL di VPS bot, bukan lagi di Supabase. Halaman
//  CMS meminta ringkasannya lewat antrean `bot_commands` (tipe `read.*`, baca-saja,
//  agregat), dan bot menjawabnya di kolom `result`. Tidak ada snapshot dorong dan tidak
//  ada polling terus-menerus: permintaan hanya dikirim saat halaman dibuka, hasil yang
//  masih segar (60 detik, sama dengan cache bot) dipakai ulang tanpa permintaan baru.
//  Viewer boleh meminta tipe `read.*` saja (policy RLS supabase/bot-commands-viewer-read.sql).
//  Acuan: docs/CMS-BACA-DATABASE-BOT.md.
// ═════════════════════════════════════════════════

import { kirimPerintah, riwayatPerintah } from '../dev-panel/client';
import { READ_TYPE, bersihkanHasil, hasilSegar, type CmsView } from './reuse';

export type { CmsView } from './reuse';

export type CmsReadResult<T> =
  | { ok: true; data: T; cached: boolean }
  | { ok: false; error: string };

/** Batas tunggu jawaban bot (ms). Bot memeriksa antrean tiap beberapa detik saat sepi. */
const TIMEOUT_MS = 40_000;

export async function bacaCms<T = unknown>(view: CmsView): Promise<CmsReadResult<T>> {
  const type = READ_TYPE[view];
  if (!type) return { ok: false, error: 'Permintaan tidak dikenali.' };

  // 1) Hasil segar yang sudah ada dipakai ulang (hemat: nol tulis, nol pekerjaan bot).
  const { rows } = await riwayatPerintah([type], 5);
  const segar = hasilSegar(rows, Date.now());
  if (segar) return { ok: true, data: bersihkanHasil(segar) as T, cached: true };

  // 2) Minta ke bot dan tunggu jawabannya.
  const r = await kirimPerintah(type, {}, { wait: true, timeoutMs: TIMEOUT_MS });
  if (!r.ok || !r.result || typeof r.result !== 'object') {
    return { ok: false, error: r.error ?? 'Bot belum menjawab. Coba lagi sebentar lagi.' };
  }
  return { ok: true, data: bersihkanHasil(r.result as Record<string, unknown>) as T, cached: Boolean((r.result as { cached?: unknown }).cached) };
}
