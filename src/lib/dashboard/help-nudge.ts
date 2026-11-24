// Gelembung bantuan Vani: bila admin gagal berkali-kali mengatur server,
// arahkan ke tombol "Hubungi kami" (src/components/mascot/VaniContact.astro).
// Murni di browser, tanpa permintaan ke database.

/** Jumlah kegagalan berbeda sebelum gelembung muncul. */
export const HELP_NUDGE_AFTER = 2;

export const HELP_NUDGE_TEXT = 'Ada kendala atau masalah? Hubungi tim kami, tim kami siap membantu!';

/** Nama event yang didengar VaniContact. */
export const HELP_EVENT = 'vani:help';

/**
 * Penghitung kegagalan. `record(id)` mengembalikan true tepat sekali, saat
 * jumlah kegagalan berbeda mencapai ambang. id yang sama tidak dihitung dua
 * kali (mis. penolakan bot untuk revisi yang sama terbaca di setiap render).
 */
export function failureTracker(threshold = HELP_NUDGE_AFTER): { record(id: string): boolean; count(): number } {
  const seen = new Set<string>();
  let fired = false;
  return {
    record(id: string): boolean {
      if (seen.has(id)) return false;
      seen.add(id);
      if (fired || seen.size < threshold) return false;
      fired = true;
      return true;
    },
    count: () => seen.size,
  };
}

/** Minta VaniContact menampilkan gelembung bantuan. */
export function showVaniHelp(text = HELP_NUDGE_TEXT): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(HELP_EVENT, { detail: { text } }));
}
