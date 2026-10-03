// Autentikasi customer untuk Live Chat (/chat). Berjalan di browser.
//
// Terpisah dari admin-auth.ts: memakai instance Supabase sendiri dengan
// storageKey berbeda ('vanillate-chat-auth') supaya sesi login Google customer
// TIDAK bentrok dengan sesi admin. detectSessionInUrl aktif agar redirect OAuth
// Google otomatis diproses. Hanya anon key yang dipakai — data dijaga RLS.
//
// Login Google punya dua jalur:
//   1. Tombol resmi Google (Google Identity Services) bila PUBLIC_GOOGLE_CLIENT_ID
//      diisi. Popup berjalan dari domain situs ini, jadi layar "Pilih akun" Google
//      menampilkan vanillate.id (atau "Vanillate Studio" setelah verifikasi brand),
//      bukan <project>.supabase.co. ID token lalu ditukar lewat signInWithIdToken.
//   2. Redirect OAuth Supabase (signInWithOAuth) sebagai fallback.

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
const GOOGLE_CLIENT_ID = import.meta.env.PUBLIC_GOOGLE_CLIENT_ID as string | undefined;

export const isChatConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
/** Tombol resmi Google dipakai bila client ID-nya diisi. */
export const hasGoogleButton = Boolean(GOOGLE_CLIENT_ID);

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

// ─── Tombol resmi "Sign in with Google" (Google Identity Services) ──────────

const GSI_SRC = 'https://accounts.google.com/gsi/client';

interface GsiApi {
  initialize(config: {
    client_id: string;
    callback: (res: { credential?: string }) => void;
    nonce?: string;
    ux_mode?: 'popup' | 'redirect';
    auto_select?: boolean;
    itp_support?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
}

function gsi(): GsiApi | undefined {
  return (window as unknown as { google?: { accounts?: { id?: GsiApi } } }).google?.accounts?.id;
}

let gsiLoading: Promise<GsiApi | null> | null = null;

/**
 * Muat skrip Google Identity Services sekali saja. Null bila gagal dimuat atau
 * tidak selesai dalam 8 detik (mis. diblokir ekstensi / jaringan lambat).
 */
function loadGsi(): Promise<GsiApi | null> {
  if (gsi()) return Promise.resolve(gsi()!);
  gsiLoading ??= new Promise((resolve) => {
    const fail = () => {
      gsiLoading = null;
      resolve(null);
    };
    const timer = setTimeout(fail, 8000);
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () => {
      clearTimeout(timer);
      resolve(gsi() ?? null);
    };
    script.onerror = () => {
      clearTimeout(timer);
      fail();
    };
    document.head.appendChild(script);
  });
  return gsiLoading;
}

/**
 * Nonce acak: versi mentah untuk Supabase, hash SHA-256 (hex) untuk Google.
 * Supabase meng-hash nonce mentah lalu mencocokkannya dengan klaim di ID token.
 */
async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return { raw, hashed };
}

/**
 * Render tombol resmi "Sign in with Google" ke `container`. Setelah user memilih
 * akun, ID token ditukar menjadi sesi Supabase lalu `onResult` dipanggil.
 * @returns false bila client ID kosong atau skrip Google gagal dimuat — pemanggil
 *   sebaiknya menampilkan tombol fallback (signInWithGoogle).
 */
export async function renderGoogleButton(
  container: HTMLElement,
  onResult: (res: { ok: boolean; error?: string }) => void,
): Promise<boolean> {
  const supabase = getChatSupabase();
  if (!supabase || !GOOGLE_CLIENT_ID) return false;
  const google = await loadGsi();
  if (!google) return false;

  // Nonce sekali pakai: tiap percobaan login memakai nonce & tombol yang baru.
  const setup = async () => {
    const nonce = await makeNonce();
    google.initialize({
      client_id: GOOGLE_CLIENT_ID,
      nonce: nonce.hashed,
      ux_mode: 'popup',
      auto_select: false,
      itp_support: true,
      callback: async ({ credential }) => {
        if (!credential) {
          onResult({ ok: false, error: 'Login Google dibatalkan. Coba lagi.' });
          return;
        }
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: credential,
          nonce: nonce.raw,
        });
        if (error) await setup();
        onResult(error ? { ok: false, error: error.message } : { ok: true });
      },
    });
    container.innerHTML = '';
    google.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'signin_with',
      logo_alignment: 'left',
      locale: 'id',
    });
  };
  try {
    await setup();
    return true;
  } catch {
    // Mis. crypto.subtle tidak tersedia (halaman non-HTTPS) → pakai fallback.
    container.innerHTML = '';
    return false;
  }
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
