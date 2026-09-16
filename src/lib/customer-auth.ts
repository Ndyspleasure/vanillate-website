// Autentikasi customer untuk Live Chat (/chat). Berjalan di browser.
//
// Terpisah dari admin-auth.ts: memakai instance Supabase sendiri dengan
// storageKey berbeda ('vanillate-chat-auth') supaya sesi login Google customer
// TIDAK bentrok dengan sesi admin. detectSessionInUrl aktif agar redirect OAuth
// Google otomatis diproses. Hanya anon key yang dipakai — data dijaga RLS.

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

export const isChatConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let client: SupabaseClient | null = null;

/** Klien Supabase khusus customer chat (singleton). Null bila env kosong. */
export function getChatSupabase(): SupabaseClient | null {
  if (!isChatConfigured) return null;
  if (!client) {
    client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'vanillate-chat-auth',
      },
    });
  }
  return client;
}

/** Mulai login Google. Setelah sukses, Google mengarahkan kembali ke redirectTo. */
export async function signInWithGoogle(redirectTo: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getChatSupabase();
  if (!supabase) return { ok: false, error: 'Koneksi ke Supabase belum dikonfigurasi.' };
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** User customer yang sedang login, atau null. */
export async function getCustomer(): Promise<User | null> {
  const supabase = getChatSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

export async function signOut(): Promise<void> {
  const supabase = getChatSupabase();
  if (supabase) await supabase.auth.signOut();
}
