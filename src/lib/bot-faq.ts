// ════════════════════════════════════════════════════════════════════════════
//  FAQ Bot (/admin/faq/bot) — logika murni: validasi isi & pengurutan.
//
//  Batas mengikuti bot (sambung-kata-bot src/support/supportFaq.js) dan CHECK
//  di tabel bot_faqs. Validasi ini hanya umpan balik cepat; bot tetap
//  menormalkan ulang isi yang ditariknya.
// ════════════════════════════════════════════════════════════════════════════

/** Jumlah FAQ aktif yang muat di menu Discord (2 menu × 25 opsi). */
export const BOT_FAQ_LIMIT = 50;
export const MAX_QUESTION = 256;
export const MAX_ANSWER = 4000;

export interface BotFaqInput {
  question: string;
  answer: string;
}

/** Galat (menolak simpan) & peringatan (boleh simpan) untuk satu FAQ. */
export function validateBotFaq({ question, answer }: BotFaqInput): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const q = question.trim();
  const a = answer.trim();
  if (!q) errors.push('Pertanyaan wajib diisi.');
  if (q.length > MAX_QUESTION) errors.push(`Pertanyaan maksimal ${MAX_QUESTION} karakter.`);
  if (!a) errors.push('Jawaban wajib diisi.');
  if (a.length > MAX_ANSWER) errors.push(`Jawaban maksimal ${MAX_ANSWER} karakter.`);
  if (/^\s*\|.*\|\s*$/m.test(a) && /^\s*\|?\s*:?-{3,}/m.test(a)) {
    warnings.push('Discord tidak menampilkan tabel; ubah jadi daftar.');
  }
  if (/\]\(\//.test(a)) warnings.push('Tautan relatif (/faq/…) tidak bisa dibuka dari Discord; pakai https://vanillate.id/….');
  return { errors, warnings };
}

export interface Urutan {
  id: string | null;
  sort: number;
}

/**
 * Geser satu FAQ satu langkah (arah −1 = naik, +1 = turun). Daftar dianggap
 * sudah terurut seperti di layar. Urutan dinomori ulang 10, 20, 30, … supaya
 * nilai `sort` yang kembar tidak membuat geseran diam; hanya baris yang
 * nilainya berubah yang dikembalikan untuk disimpan.
 */
export function reorder<T extends Urutan>(list: T[], id: string, arah: -1 | 1): { id: string; sort: number }[] {
  const i = list.findIndex((f) => f.id === id);
  const j = i + arah;
  if (i < 0 || j < 0 || j >= list.length) return [];
  const ids = list.map((f) => f.id);
  [ids[i], ids[j]] = [ids[j], ids[i]];
  const lama = new Map(list.map((f) => [f.id, f.sort]));
  return ids
    .map((fid, k) => ({ id: fid as string, sort: (k + 1) * 10 }))
    .filter((u) => u.id && lama.get(u.id) !== u.sort);
}
