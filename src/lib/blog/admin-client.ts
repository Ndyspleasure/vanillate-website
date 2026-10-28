// Klien browser untuk Edge Function `blog-admin` (dipakai halaman /admin/blog/*).
// Browser hanya membawa JWT admin; token tulis Sanity hidup di Edge Function.

import { getSupabase } from '../supabase';

export interface BlogCallError {
  code: string;
  message: string;
}

export type CallResult<T> = { ok: true; data: T } | { ok: false; error: BlogCallError };

const PESAN: Record<string, string> = {
  NOT_AUTHENTICATED: 'Sesi login habis. Muat ulang halaman lalu login lagi.',
  FORBIDDEN: 'Peran kamu hanya bisa melihat blog, tidak bisa mengubahnya.',
  NOT_FOUND: 'Artikel tidak ditemukan — mungkin sudah dihapus.',
  IN_USE: 'Masih dipakai artikel lain. Lepaskan dulu dari artikel yang memakainya.',
  TOO_LARGE: 'Gambar terlalu besar (maksimal 10 MB).',
  NOT_CONFIGURED: 'Blog belum terhubung ke Sanity: secret SANITY_WRITE_TOKEN di Edge Function blog-admin belum diisi (lihat docs/BLOG.md).',
  SANITY_ERROR: 'Sanity sedang bermasalah. Coba lagi sebentar lagi.',
  BAD_REQUEST: 'Permintaan tidak valid.',
  FUNCTION_MISSING: 'Edge Function blog-admin belum di-deploy ke Supabase (lihat docs/BLOG.md).',
  NETWORK: 'Tidak bisa menghubungi server. Periksa koneksi internet.',
};

function toError(code: string, body: any): BlogCallError {
  if (code === 'VALIDATION' && Array.isArray(body?.details)) {
    return { code, message: body.details.join(' ') };
  }
  if (code === 'SLUG_TAKEN') {
    return { code, message: `Slug "${body?.slug ?? ''}" sudah dipakai artikel lain (atau pernah dipakai dan kini dialihkan). Ganti slug.` };
  }
  if (Array.isArray(body?.details) && body.details.length) return { code, message: body.details.join(' ') };
  return { code, message: PESAN[code] ?? 'Terjadi kesalahan tak dikenal.' };
}

async function invoke<T>(body: unknown, headers?: Record<string, string>): Promise<CallResult<T>> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: { code: 'NOT_CONFIGURED', message: 'Koneksi ke Supabase belum dikonfigurasi.' } };
  const { data, error } = await supabase.functions.invoke('blog-admin', { body: body as any, headers });
  if (!error) return { ok: true, data: data as T };

  const res: Response | undefined = (error as any)?.context;
  if (res && typeof res.json === 'function') {
    if (res.status === 404 && !res.headers.get('content-type')?.includes('json')) {
      return { ok: false, error: toError('FUNCTION_MISSING', null) };
    }
    const json = await res.json().catch(() => null);
    if (json?.error) return { ok: false, error: toError(String(json.error), json) };
    if (res.status === 404) return { ok: false, error: toError('FUNCTION_MISSING', null) };
  }
  return { ok: false, error: toError((error as any)?.name === 'FunctionsFetchError' ? 'NETWORK' : 'UNKNOWN', null) };
}

export function blogCall<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<CallResult<T>> {
  return invoke<T>({ action, ...payload });
}

export interface UploadedImage {
  assetId: string;
  url: string;
  width: number | null;
  height: number | null;
}

const MAKS_SISI = 2000;

/**
 * Perkecil gambar di browser sebelum upload: sisi terpanjang maks 2000 px,
 * WebP kualitas 0,85. Foto HP 4–8 MB biasanya jadi 200–600 KB — hemat kuota
 * penyimpanan Sanity tanpa terlihat bedanya di layar. GIF (animasi) & gambar
 * yang sudah kecil dikirim apa adanya.
 */
export async function compressImage(file: File): Promise<Blob> {
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  try {
    const bmp = await createImageBitmap(file);
    const skala = Math.min(1, MAKS_SISI / Math.max(bmp.width, bmp.height));
    if (skala === 1 && file.size < 400_000) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * skala);
    canvas.height = Math.round(bmp.height * skala);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.85));
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file;
    return blob;
  } catch {
    return file;
  }
}

export async function uploadImage(file: File): Promise<CallResult<UploadedImage>> {
  if (!file.type.startsWith('image/')) return { ok: false, error: { code: 'BAD_REQUEST', message: 'Pilih berkas gambar (JPG, PNG, WebP, GIF, AVIF).' } };
  const blob = await compressImage(file);
  if (blob.size > 10 * 1024 * 1024) return { ok: false, error: toError('TOO_LARGE', null) };
  const nama = file.name.replace(/\.[a-z0-9]+$/i, '') + (blob.type === 'image/webp' && file.type !== 'image/webp' ? '.webp' : '');
  return invoke<UploadedImage>(blob, {
    'x-blog-action': 'upload',
    'Content-Type': blob.type || file.type,
    'x-blog-filename': nama.slice(0, 80),
  });
}

/** Ukuran berkas yang enak dibaca. */
export function fmtUkuran(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
