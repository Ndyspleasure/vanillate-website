// Google AdSense — HANYA di halaman artikel /blog/<slug>. Halaman daftar
// (/blog, kategori, tag, penulis) sengaja tidak memuat skrip AdSense sama
// sekali, jadi Auto ads pun tidak bisa muncul di sana.
//
// Mati selama `client` kosong. Mengisi ID cukup di sini; ads.txt ikut
// dibangun dari nilai yang sama (src/pages/ads.txt.ts). ID publisher & slot
// bukan rahasia — keduanya memang tampil di HTML publik.
//
// Murni (tanpa alias impor) supaya bisa diuji `node --test`.

export const ADSENSE = {
  /** ID publisher, bentuk `ca-pub-1234567890123456`. Kosong = iklan mati. */
  client: 'ca-pub-7666352445473199',
  /** ID unit iklan (angka) dari AdSense › Iklan › Menurut unit iklan. */
  slots: {
    /** Iklan di tengah isi artikel (format In-article). */
    inArticle: '3958782997',
    /** Iklan setelah isi artikel, sebelum FAQ (format Display responsif). */
    afterArticle: '2370369154',
  },
  /** Iklan tengah disisipkan sebelum subjudul H2 ke-N (butuh minimal N subjudul). */
  inArticleBeforeH2: 3,
};

const CLIENT_OK = /^ca-pub-\d{10,20}$/;
const SLOT_OK = /^\d{6,20}$/;

export type AdSlotName = keyof typeof ADSENSE.slots;

export function adsenseClient(cfg = ADSENSE): string | null {
  return CLIENT_OK.test(cfg.client) ? cfg.client : null;
}

export function adSlot(name: AdSlotName, cfg = ADSENSE): string | null {
  return adsenseClient(cfg) && SLOT_OK.test(cfg.slots[name]) ? cfg.slots[name] : null;
}

/** Baris ads.txt (https://support.google.com/adsense/answer/12171612). */
export function adsTxt(cfg = ADSENSE): string {
  const client = adsenseClient(cfg);
  if (!client) return '# AdSense belum dipasang (src/lib/blog/ads.ts).\n';
  return `google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`;
}

/** Elemen <ins> AdSense, diberi label "Iklan" supaya jelas bukan isi artikel. */
export function adHtml(name: AdSlotName, cfg = ADSENSE): string {
  const client = adsenseClient(cfg);
  const slot = adSlot(name, cfg);
  if (!client || !slot) return '';
  const format =
    name === 'inArticle'
      ? 'data-ad-layout="in-article" data-ad-format="fluid"'
      : 'data-ad-format="auto" data-full-width-responsive="true"';
  return (
    `<aside class="my-10 min-h-[120px] border-y border-ink-900/10 dark:border-cream-100/10 py-4" aria-label="Iklan">` +
    `<span class="mb-2 block text-center font-mono text-[0.65rem] uppercase tracking-[0.2em] text-ink-500 dark:text-cream-300/60">Iklan</span>` +
    `<ins class="adsbygoogle" style="display:block;text-align:center" data-ad-client="${client}" data-ad-slot="${slot}" ${format}></ins>` +
    `</aside>`
  );
}

/**
 * Sisipkan iklan tengah ke HTML isi artikel tepat sebelum subjudul H2 ke-N.
 * Artikel pendek (subjudul kurang dari N) dibiarkan tanpa iklan tengah.
 */
export function withInArticleAd(html: string, cfg = ADSENSE): string {
  const ad = adHtml('inArticle', cfg);
  if (!ad) return html;
  const re = /<h2[\s>]/g;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(html))) {
    if (++n === cfg.inArticleBeforeH2) return html.slice(0, m.index) + ad + html.slice(m.index);
  }
  return html;
}
