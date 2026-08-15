// Helper autentikasi untuk area admin. SEMUA fungsi di sini berjalan di browser
// (dipanggil dari <script> halaman admin), bukan saat build.
//
// Alur singkat:
//   1. login() menukar username/email + password ke Supabase Auth -> dapat JWT.
//   2. JWT disimpan di localStorage oleh supabase-js.
//   3. Tiap query berikutnya membawa JWT itu; RLS di Supabase yang memutuskan
//      baris mana yang boleh terbaca. Halaman ini tidak pernah memegang data
//      yang tidak berhak dilihat user.

import { getSupabase } from './supabase';

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

  const id = identifier.trim();
  if (!id || !password) {
    return { ok: false, error: 'Username dan password wajib diisi.' };
  }

  let email = id;

  // Bukan email -> anggap username, resolve ke email lewat RPC.
  if (!id.includes('@')) {
    const { data, error } = await supabase.rpc('resolve_admin_login', { p_username: id });
    if (error || !data) {
      // Sengaja pakai pesan yang sama dengan password salah, supaya tidak
      // bisa dipakai menebak username mana yang terdaftar.
      return { ok: false, error: 'Username atau password salah.' };
    }
    email = data as string;
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    return { ok: false, error: 'Username atau password salah.' };
  }

  // Pastikan akun ini memang terdaftar sebagai admin. User Supabase yang ada
  // tapi tidak punya baris di admin_users tidak boleh masuk.
  const profile = await getAdminProfile();
  if (!profile) {
    await supabase.auth.signOut();
    return { ok: false, error: 'Akun ini tidak punya akses admin.' };
  }

  await touchLastLogin();
  return { ok: true };
}

/** Ambil profil admin milik sesi aktif. null bila tidak login / bukan admin. */
export async function getAdminProfile(): Promise<AdminProfile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return null;

  // RLS membatasi baris admin_users hanya ke milik sendiri, jadi single() aman.
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, username, display_name, role, last_login_at')
    .eq('id', sessionData.session.user.id)
    .maybeSingle();

  if (error || !data) return null;
  return data as AdminProfile;
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
  const profile = await getAdminProfile();
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
