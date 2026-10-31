// Helper autentikasi untuk area admin. SEMUA fungsi di sini berjalan di browser
// (dipanggil dari <script> halaman admin), bukan saat build.
//
// Alur singkat:
//   1. login() menukar username/email + password ke Supabase Auth -> dapat JWT.
//      Alternatif: kirimKodeLogin() + masukDenganKode() (kode sekali pakai di
//      email), atau kirimKodeReset() + verifikasiKodeReset() + gantiPassword()
//      untuk lupa password. Semua berakhir di cek admin_users yang sama.
//   2. JWT disimpan di localStorage oleh supabase-js.
//   3. Tiap query berikutnya membawa JWT itu; RLS di Supabase yang memutuskan
//      baris mana yang boleh terbaca. Halaman ini tidak pernah memegang data
//      yang tidak berhak dilihat user.

import { getSupabase } from './supabase';
import { pesanError } from './admin-ui';
import { normalisasiKode, pesanKirimKode, validasiPasswordBaru } from './admin-auth-model';

export interface AdminProfile {
  id: string;
  username: string;
  display_name: string | null;
  role: 'owner' | 'admin' | 'viewer';
  last_login_at: string | null;
}

export interface LoginResult {
  ok: boolean;
  /** Pesan siap tampil ke user (bahasa Indonesia, tidak membocorkan detail). */
  error?: string;
}

/**
 * Login dengan username ATAU email.
 *
 * Supabase Auth sendiri hanya mengenal email. Supaya admin tetap bisa memakai
 * username seperti yang diminta, identifier tanpa "@" ditukar dulu jadi email
 * lewat RPC `resolve_admin_login` (SECURITY DEFINER) di database.
 */
export async function login(identifier: string, password: string): Promise<LoginResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: 'Koneksi ke Supabase belum dikonfigurasi.' };
  }

  if (!identifier.trim() || !password) {
    return { ok: false, error: 'Username dan password wajib diisi.' };
  }

  const email = await resolveEmail(identifier);
  if (!email) {
    // Sengaja pakai pesan yang sama dengan password salah, supaya tidak
    // bisa dipakai menebak username mana yang terdaftar.
    return { ok: false, error: 'Username atau password salah.' };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    return { ok: false, error: 'Username atau password salah.' };
  }

  return selesaikanLogin();
}

/**
 * Ubah username/email jadi email. Supabase Auth sendiri hanya mengenal email,
 * jadi identifier tanpa "@" ditukar lewat RPC `resolve_admin_login`
 * (SECURITY DEFINER). Null bila username tidak dikenal.
 */
async function resolveEmail(identifier: string): Promise<string | null> {
  const supabase = getSupabase();
  const id = identifier.trim();
  if (!supabase || !id) return null;
  if (id.includes('@')) return id;
  const { data, error } = await supabase.rpc('resolve_admin_login', { p_username: id });
  if (error || !data) return null;
  return data as string;
}

/**
 * Langkah akhir semua cara masuk (password, kode, reset): akun wajib punya
 * baris di admin_users. User Supabase tanpa baris itu langsung dikeluarkan.
 */
async function selesaikanLogin(): Promise<LoginResult> {
  const supabase = getSupabase();
  const { profile, dbError } = await getAdminProfile();
  if (!profile) {
    await supabase?.auth.signOut();
    return { ok: false, error: dbError ?? 'Akun ini tidak punya akses admin.' };
  }
  await touchLastLogin();
  return { ok: true };
}

export interface KirimKodeResult extends LoginResult {
  /**
   * Email tujuan untuk langkah verifikasi. Tidak pernah ditampilkan; untuk
   * username yang tidak dikenal berisi identifier apa adanya supaya alurnya
   * tetap terlihat sama (verifikasi nanti gagal dengan pesan umum).
   */
  email?: string;
}

/**
 * Kirim kode sekali pakai untuk masuk tanpa password. `shouldCreateUser:
 * false` mencegah email asing membuat akun baru lewat form ini.
 */
export async function kirimKodeLogin(identifier: string): Promise<KirimKodeResult> {
  return kirimKode(identifier, (email) =>
    getSupabase()!.auth.signInWithOtp({ email, options: { shouldCreateUser: false } }),
  );
}

/** Kirim kode untuk mengganti password yang lupa. */
export async function kirimKodeReset(identifier: string): Promise<KirimKodeResult> {
  return kirimKode(identifier, (email) => getSupabase()!.auth.resetPasswordForEmail(email));
}

async function kirimKode(
  identifier: string,
  kirim: (email: string) => Promise<{ error: { status?: number; code?: string; message?: string } | null }>,
): Promise<KirimKodeResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Koneksi ke Supabase belum dikonfigurasi.' };
  const id = identifier.trim();
  if (!id) return { ok: false, error: 'Isi username atau email dulu.' };

  const email = await resolveEmail(id);
  // Username tak dikenal tetap dianggap "terkirim" (lihat pesanKirimKode).
  if (!email) return { ok: true, email: id };

  const hasil = pesanKirimKode((await kirim(email)).error);
  return hasil.ok ? { ok: true, email } : hasil;
}

/** Masuk dengan kode dari email "Kode masuk". */
export async function masukDenganKode(email: string, kodeInput: string): Promise<LoginResult> {
  return verifikasiKode(email, kodeInput, 'email');
}

/**
 * Cek kode dari email reset password. Bila benar, sesi admin langsung aktif
 * dan langkah berikutnya adalah gantiPassword().
 */
export async function verifikasiKodeReset(email: string, kodeInput: string): Promise<LoginResult> {
  return verifikasiKode(email, kodeInput, 'recovery');
}

async function verifikasiKode(email: string, kodeInput: string, type: 'email' | 'recovery'): Promise<LoginResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Koneksi ke Supabase belum dikonfigurasi.' };
  const token = normalisasiKode(kodeInput);
  if (!token) return { ok: false, error: 'Kode berupa 6 digit angka dari email.' };

  const { error } = await supabase.auth.verifyOtp({ email, token, type });
  if (error) return { ok: false, error: 'Kode salah atau sudah kedaluwarsa. Minta kode baru bila perlu.' };
  return selesaikanLogin();
}

/** Simpan password baru untuk sesi yang sedang aktif (setelah kode reset benar). */
export async function gantiPassword(password: string, ulang: string): Promise<LoginResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Koneksi ke Supabase belum dikonfigurasi.' };
  const invalid = validasiPasswordBaru(password, ulang);
  if (invalid) return { ok: false, error: invalid };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const msg = (error.message ?? '').toLowerCase();
    if (msg.includes('different from the old')) {
      return { ok: false, error: 'Password baru harus berbeda dari password lama.' };
    }
    if (msg.includes('weak') || msg.includes('password should')) {
      return { ok: false, error: 'Password terlalu lemah. Pakai kombinasi huruf dan angka yang lebih panjang.' };
    }
    return { ok: false, error: pesanError(error) };
  }
  return { ok: true };
}

export interface ProfilResult {
  profile: AdminProfile | null;
  /**
   * Terisi hanya bila query-nya sendiri gagal — bukan saat query berhasil tapi
   * tidak menemukan baris.
   *
   * Perbedaan ini penting. Keduanya sama-sama menghasilkan profil null, tapi
   * artinya jauh berbeda: yang satu "akun ini memang bukan admin", yang lain
   * "database belum benar". Menyamakan keduanya membuat kesalahan konfigurasi
   * tersamar sebagai penolakan akses, dan itu menyesatkan saat setup.
   */
  dbError: string | null;
}

/** Ambil profil admin milik sesi aktif. */
export async function getAdminProfile(): Promise<ProfilResult> {
  const supabase = getSupabase();
  if (!supabase) return { profile: null, dbError: null };

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return { profile: null, dbError: null };

  // RLS membatasi baris admin_users hanya ke milik sendiri.
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, username, display_name, role, last_login_at')
    .eq('id', sessionData.session.user.id)
    .maybeSingle();

  if (error) return { profile: null, dbError: pesanError(error) };
  if (!data) return { profile: null, dbError: null };
  return { profile: data as AdminProfile, dbError: null };
}

/** Catat waktu login terakhir. Gagal di sini tidak boleh membatalkan login. */
async function touchLastLogin(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  await supabase
    .from('admin_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', data.session.user.id);
}

export async function logout(): Promise<void> {
  const supabase = getSupabase();
  if (supabase) await supabase.auth.signOut();
}

/**
 * Penjaga halaman dashboard. Dipanggil paling awal di tiap halaman admin
 * selain halaman login.
 *
 * Catatan jujur soal batasnya: di situs statis, redirect ini terjadi di browser
 * setelah HTML terkirim. Jadi ini kenyamanan UX, BUKAN benteng keamanan —
 * benteng sesungguhnya ada di RLS Supabase yang menolak mengirim data apa pun
 * tanpa JWT admin yang valid. Kerangka HTML halaman admin memang publik, tapi
 * isinya kosong sampai login berhasil.
 */
export async function requireAdmin(loginUrl: string): Promise<AdminProfile | null> {
  const { profile } = await getAdminProfile();
  if (!profile) {
    const next = encodeURIComponent(window.location.pathname);
    window.location.replace(`${loginUrl}?next=${next}`);
    return null;
  }
  return profile;
}

/** Format tanggal ISO ke waktu Jakarta yang enak dibaca. */
export function fmtWaktu(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(iso)) + ' WIB';
  } catch {
    return String(iso);
  }
}

/** Format angka ke gaya Indonesia (1.234). */
export function fmtAngka(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('id-ID').format(n);
}
