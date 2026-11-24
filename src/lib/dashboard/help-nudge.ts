// Gelembung bantuan Vani: bila admin gagal berkali-kali mengatur server,
// arahkan ke tombol "Hubungi kami" (src/components/mascot/VaniContact.astro).
// Murni di browser, tanpa permintaan ke database.

/** Jumlah kegagalan berbeda sebelum gelembung muncul. */
export const HELP_NUDGE_AFTER = 2;

export const HELP_NUDGE_TEXT = 'Ada kendala atau masalah? Hubungi tim kami, tim kami siap membantu!';

/** Teks sapaan saat admin pertama kali membuka dashboard. */
export const HELP_WELCOME_TEXT = 'Halo! Ada kendala atau masalah saat mengatur bot? Hubungi tim kami, tim kami siap membantu!';

/**
 * Gelembung muncul di dua kesempatan saja:
 * - `welcome`: pertama kali membuka dashboard di browser ini (localStorage).
 * - `failure`: setelah kegagalan berulang, sekali per tab (sessionStorage).
 */
export type HelpReason = 'welcome' | 'failure';
export interface HelpDetail {
  text: string;
  reason: HelpReason;
  /** Tempat mengingat bahwa gelembung ini sudah tampil. */
  scope: 'local' | 'session';
  /** Detik sebelum gelembung hilang sendiri (0 = tetap sampai ditutup). */
  autoHideSec: number;
}

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

const DETAILS: Record<HelpReason, HelpDetail> = {
  welcome: { text: HELP_WELCOME_TEXT, reason: 'welcome', scope: 'local', autoHideSec: 15 },
  failure: { text: HELP_NUDGE_TEXT, reason: 'failure', scope: 'session', autoHideSec: 0 },
};

export function helpDetail(reason: HelpReason): HelpDetail {
  return DETAILS[reason];
}

/**
 * Minta VaniContact menampilkan gelembung bantuan. Dikirim sedikit tertunda
 * supaya skrip VaniContact pasti sudah memasang pendengarnya dan gelembung
 * tidak bersaing dengan halaman yang baru dimuat.
 */
export function showVaniHelp(reason: HelpReason, delayMs = 0): void {
  if (typeof window === 'undefined') return;
  const fire = () => window.dispatchEvent(new CustomEvent(HELP_EVENT, { detail: DETAILS[reason] }));
  if (delayMs > 0) window.setTimeout(fire, delayMs);
  else fire();
}
