// Klien browser Portal Penulis Blog (/blog/masuk, /blog/dashboard).
//
// Sesi login memakai storageKey sendiri ('vanillate-blog-auth') supaya tidak
// bentrok dengan sesi admin, Live Chat, atau Portal Partner. Browser hanya
// membawa anon key + JWT penulis; semua data tulisan lewat Edge Function
// `blog-writer` (tabel blog_* tertutup untuk browser). Lihat docs/BLOG-PENULIS.md.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { compressImage } from './admin-client';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

export const isWriterConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let client: SupabaseClient | null = null;

export function getWriterSupabase(): SupabaseClient | null {
  if (!isWriterConfigured) return null;
  if (!client) {
    client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'vanillate-blog-auth',
      },
    });
  }
  return client;
}

/**
 * Supabase hanya menerima alamat kembali berupa URL penuh yang terdaftar di
 * Redirect URLs. Alamat relatif (mis. "/blog/dashboard/") diabaikan dan
 * pengguna dikembalikan ke Site URL, yaitu beranda.
 */
export function absoluteUrl(path: string): string {
  return new URL(path, location.origin).href;
}

export async function signInGoogle(redirectTo: string): Promise<string | null> {
  const sb = getWriterSupabase();
  if (!sb) return 'Koneksi ke Supabase belum dikonfigurasi.';
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: absoluteUrl(redirectTo) } });
  return error ? error.message : null;
}

/** Tautkan Discord ke akun yang sedang login (verifikasi penulis). */
export async function linkDiscord(redirectTo: string): Promise<string | null> {
  const sb = getWriterSupabase();
  if (!sb) return 'Koneksi ke Supabase belum dikonfigurasi.';
  const { error } = await sb.auth.linkIdentity({ provider: 'discord', options: { redirectTo: absoluteUrl(redirectTo) } });
  return error ? error.message : null;
}

export async function signOutWriter(): Promise<void> {
  await getWriterSupabase()?.auth.signOut();
}

export async function currentSession() {
  const sb = getWriterSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session ?? null;
}

// ─── Panggilan Edge Function ────────────────────────────────────────────────

export interface WriterError {
  code: string;
  message: string;
}
export type WriterResult<T> = { ok: true; data: T } | { ok: false; error: WriterError };

const PESAN: Record<string, string> = {
  NOT_AUTHENTICATED: 'Sesi login habis. Muat ulang halaman lalu masuk lagi.',
  BLOCKED: 'Akun penulismu sedang diblokir. Hubungi tim Vanillate.',
  NO_PROFILE: 'Lengkapi profil penulis dulu.',
  DISCORD_REQUIRED: 'Tautkan akun Discord dulu sebelum mengajukan tulisan.',
  NOT_FOUND: 'Tulisan tidak ditemukan. Mungkin sudah dihapus.',
  SLUG_TAKEN: 'Slug ini sudah dipakai. Ganti slug.',
  LIMIT: 'Batas tercapai. Coba lagi nanti.',
  TOO_LARGE: 'Gambar terlalu besar (maksimal 2 MB).',
  BAD_REQUEST: 'Permintaan tidak valid.',
  FUNCTION_MISSING: 'Layanan penulis belum aktif. Coba lagi nanti.',
  NETWORK: 'Tidak bisa menghubungi server. Periksa koneksi internet.',
};

function toError(code: string, body: any): WriterError {
  const detail = Array.isArray(body?.details) && body.details.length ? body.details.join(' ') : '';
  return { code, message: detail || PESAN[code] || 'Terjadi kesalahan. Coba lagi.' };
}

async function invoke<T>(body: unknown, headers?: Record<string, string>): Promise<WriterResult<T>> {
  const sb = getWriterSupabase();
  if (!sb) return { ok: false, error: { code: 'NOT_CONFIGURED', message: 'Koneksi ke Supabase belum dikonfigurasi.' } };
  const { data, error } = await sb.functions.invoke('blog-writer', { body: body as any, headers });
  if (!error) return { ok: true, data: data as T };
  const res: Response | undefined = (error as any)?.context;
  if (res && typeof res.json === 'function') {
    if (res.status === 404 && !res.headers.get('content-type')?.includes('json')) {
      return { ok: false, error: toError('FUNCTION_MISSING', null) };
    }
    const json = await res.json().catch(() => null);
    if (json?.error) return { ok: false, error: toError(String(json.error), json) };
  }
  return { ok: false, error: toError((error as any)?.name === 'FunctionsFetchError' ? 'NETWORK' : 'UNKNOWN', null) };
}

export const writerCall = <T = any>(action: string, payload: Record<string, unknown> = {}) =>
  invoke<T>({ action, ...payload });

export interface WriterImage {
  path: string;
  url: string | null;
}

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Kompres di browser (maks 2000 px, WebP) lalu unggah ke penyimpanan sementara. */
export async function uploadWriterImage(file: File): Promise<WriterResult<WriterImage>> {
  if (!/^image\/(webp|jpeg|png|gif|avif)$/.test(file.type)) {
    return { ok: false, error: { code: 'BAD_REQUEST', message: 'Pilih gambar JPG, PNG, atau WebP.' } };
  }
  const blob = await compressImage(file);
  if (!/^image\/(webp|jpeg|png)$/.test(blob.type)) {
    return { ok: false, error: { code: 'BAD_REQUEST', message: 'Format gambar tidak didukung. Pakai JPG, PNG, atau WebP.' } };
  }
  if (blob.size > MAX_IMAGE_BYTES) return { ok: false, error: toError('TOO_LARGE', null) };
  return invoke<WriterImage>(blob, { 'x-blog-action': 'upload', 'Content-Type': blob.type });
}
