// ════════════════════════════════════════════════════════════════════════════
//  Klien browser untuk Edge Function `cms-read` (proyek Database Bot).
//
//  Halaman CMS membaca data hub SESUAI PERMINTAAN (saat dibuka), bukan dari
//  snapshot yang didorong bot terus-menerus. Yang dikirim hanya JWT sesi admin
//  CMS; fungsi memeriksanya di sisi server. URL proyek Database Bot adalah nilai
//  publik yang sama dengan Vanillate Dashboard. `service_role` tidak ada di sini.
//  Acuan: docs/CMS-BACA-DATABASE-BOT.md.
// ════════════════════════════════════════════════════════════════════════════

import { getSupabase } from '../supabase';

const BOT_URL = (import.meta.env.PUBLIC_BOT_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '');

export type CmsView = 'serverhub';

export type CmsReadResult<T> =
  | { ok: true; data: T; cached: boolean }
  | { ok: false; error: string };

const PESAN: Record<string, string> = {
  NOT_AUTHENTICATED: 'Sesi admin tidak ditemukan. Masuk ulang lalu coba lagi.',
  FORBIDDEN: 'Akun ini tidak punya izin membaca data ini.',
  UPSTREAM_ERROR: 'Database Bot tidak menjawab. Coba lagi sebentar lagi.',
  BAD_REQUEST: 'Permintaan tidak dikenali.',
};

export async function bacaCms<T = unknown>(view: CmsView): Promise<CmsReadResult<T>> {
  if (!BOT_URL) return { ok: false, error: 'Alamat Database Bot belum dikonfigurasi.' };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Supabase belum dikonfigurasi.' };
  const { data: sesi } = await supabase.auth.getSession();
  const token = sesi.session?.access_token;
  if (!token) return { ok: false, error: PESAN.NOT_AUTHENTICATED };

  let res: Response;
  try {
    res = await fetch(`${BOT_URL}/functions/v1/cms-read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ view }),
    });
  } catch {
    return { ok: false, error: 'Tidak bisa menghubungi Database Bot. Periksa koneksi lalu coba lagi.' };
  }
  const body = (await res.json().catch(() => null)) as { ok?: boolean; data?: T; cached?: boolean; error?: string } | null;
  if (!res.ok || !body?.ok) {
    return { ok: false, error: PESAN[body?.error ?? ''] ?? 'Gagal membaca data. Coba lagi.' };
  }
  return { ok: true, data: body.data as T, cached: Boolean(body.cached) };
}
