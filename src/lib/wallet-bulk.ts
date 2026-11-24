// 💜 Vanillate Wallet › Hadiah Massal: aturan pratinjau di browser.
// Sama dengan `parseUserIds` dan batas `giftBulk` di bot (src/wallet/admin.js).
// Ini hanya umpan balik; validasi akhir selalu di bot.

export const MAX_BULK_USERS = 200;
export const MAX_BULK_TOTAL = 1_000_000;
export const MAX_AMOUNT = 10_000_000;

/** Setiap deret 15 sampai 22 digit di teks (daftar, CSV), urutan tetap, tanpa ganda. */
export function parseUserIds(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of String(text ?? '').matchAll(/(?<![0-9])[0-9]{15,22}(?![0-9])/g)) {
    if (!seen.has(m[0])) { seen.add(m[0]); out.push(m[0]); }
  }
  return out;
}

/** Hitung berapa kali ID muncul lebih dari sekali (untuk info pratinjau). */
export function countDuplicates(text: string): number {
  const all = [...String(text ?? '').matchAll(/(?<![0-9])[0-9]{15,22}(?![0-9])/g)].length;
  return all - parseUserIds(text).length;
}

export interface BulkCheck {
  ok: boolean;
  count: number;
  total: number;
  error: string | null;
}

export function checkBulk(ids: string[], amount: number, reason: string): BulkCheck {
  const count = ids.length;
  const total = Number.isSafeInteger(amount) ? amount * count : 0;
  const err = (error: string): BulkCheck => ({ ok: false, count, total, error });
  if (!count) return err('Belum ada Discord ID.');
  if (count > MAX_BULK_USERS) return err(`Maksimal ${MAX_BULK_USERS} pemain per Hadiah Massal (daftar ini ${count}).`);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > MAX_AMOUNT) return err('Jumlah VP harus bilangan bulat, minimal 1.');
  if (total > MAX_BULK_TOTAL) return err(`Total ${total.toLocaleString('id-ID')} VP melebihi batas ${MAX_BULK_TOTAL.toLocaleString('id-ID')} VP per Hadiah Massal.`);
  const r = String(reason ?? '').trim();
  if (r.length < 3 || r.length > 200) return err('Alasan wajib, 3 sampai 200 karakter.');
  return { ok: true, count, total, error: null };
}
