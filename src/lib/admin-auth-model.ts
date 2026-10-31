// Aturan murni untuk login admin lewat kode email (tanpa Supabase/DOM),
// supaya bisa dites dengan node --test. Dipakai src/lib/admin-auth.ts dan
// halaman /admin.

/** Panjang kode OTP Supabase bisa diatur 6 sampai 10 digit (bawaan 6). */
export const KODE_MIN = 6;
export const KODE_MAKS = 10;

/** Jeda minimal Supabase antar pengiriman email ke alamat yang sama. */
export const JEDA_KIRIM_ULANG_DETIK = 60;

export const PASSWORD_MIN = 8;

/**
 * Bersihkan kode yang diketik/ditempel: buang spasi dan tanda hubung
 * (mis. "123 456" atau "123-456"). Mengembalikan null bila hasilnya bukan
 * deretan angka dengan panjang yang wajar.
 */
export function normalisasiKode(input: string): string | null {
  const kode = (input ?? '').replace(/[\s-]/g, '');
  if (!/^\d+$/.test(kode)) return null;
  if (kode.length < KODE_MIN || kode.length > KODE_MAKS) return null;
  return kode;
}

/** Validasi password baru. Mengembalikan pesan error atau null bila valid. */
export function validasiPasswordBaru(password: string, ulang: string): string | null {
  if (!password || password.length < PASSWORD_MIN) {
    return `Password minimal ${PASSWORD_MIN} karakter.`;
  }
  if (password.trim() !== password) return 'Password tidak boleh diawali atau diakhiri spasi.';
  if (password !== ulang) return 'Ulangi password belum sama.';
  return null;
}

/**
 * Terjemahkan error Supabase Auth saat mengirim kode. Batas kirim (429)
 * diberi tahu apa adanya; error lain (mis. email bukan akun terdaftar)
 * disamarkan jadi "terkirim" supaya tidak bisa dipakai menebak akun.
 */
export function pesanKirimKode(err: { status?: number; code?: string; message?: string } | null): {
  ok: boolean;
  error?: string;
} {
  if (!err) return { ok: true };
  const pesan = (err.message ?? '').toLowerCase();
  if (err.status === 429 || err.code === 'over_email_send_rate_limit' || pesan.includes('rate limit')) {
    return { ok: false, error: 'Terlalu sering meminta kode. Tunggu sebentar lalu coba lagi.' };
  }
  if (pesan.includes('error sending') || pesan.includes('smtp')) {
    return { ok: false, error: 'Email gagal dikirim. Cek pengaturan email di Supabase.' };
  }
  return { ok: true };
}
