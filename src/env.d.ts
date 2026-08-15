/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  /**
   * Nomor WhatsApp Business support (format internasional, boleh pakai "+"
   * atau spasi — akan dinormalisasi di @data/support).
   * Opsional: bila kosong, dipakai nilai fallback di src/data/support.ts.
   */
  readonly PUBLIC_SUPPORT_WHATSAPP?: string;

  /**
   * Alamat email support — kanal alternatif dari WhatsApp.
   * Opsional: bila kosong, dipakai nilai fallback di src/data/support.ts.
   */
  readonly PUBLIC_SUPPORT_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
