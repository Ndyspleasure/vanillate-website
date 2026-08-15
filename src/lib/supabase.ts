// Klien Supabase untuk area admin.
//
// PENTING soal keamanan:
// Website ini di-deploy sebagai situs statis ke GitHub Pages, jadi TIDAK ADA
// server milik kita yang bisa menyimpan rahasia. Karena itu satu-satunya kunci
// yang boleh ada di sini adalah `anon key` — kunci publik yang memang dirancang
// untuk ikut terkirim ke browser.
//
// Yang menjaga data BUKAN halaman ini, melainkan Row Level Security (RLS) di
// Supabase: tanpa JWT milik admin yang valid, query apa pun mengembalikan nol
// baris. Lihat supabase/schema.sql.
//
// JANGAN PERNAH menaruh `service_role key` di file ini atau di file mana pun
// dalam repo website. Kunci itu mem-bypass RLS dan hanya boleh dipakai di sisi
// bot/server. Lihat docs/ADMIN-CMS.md.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

/** True bila env sudah diisi. Dipakai UI untuk menampilkan panduan setup. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let client: SupabaseClient | null = null;

/**
 * Ambil klien Supabase (singleton).
 * Mengembalikan null bila env belum diisi, supaya halaman admin bisa
 * menampilkan pesan setup alih-alih crash saat build/preview.
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'vanillate-admin-auth',
      },
    });
  }
  return client;
}
