// ════════════════════════════════════════════════════════════════════════════
//  Portal Partner: klien browser. Hanya anon key + JWT partner.
//  Sesi memakai storageKey sendiri supaya TIDAK bentrok dengan sesi admin CMS
//  maupun sesi customer Live Chat. Data dijaga RLS (docs/PARTNER-PORTAL.md).
// ════════════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { rpcError, type OrderStatus } from './model';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

export const isPartnerConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const EMAIL_DOMAIN = 'partner.vanillate.id';

let client: SupabaseClient | null = null;

export function getPartnerSupabase(): SupabaseClient | null {
  if (!isPartnerConfigured) return null;
  if (!client) {
    client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'vanillate-partner-auth',
      },
    });
  }
  return client;
}

export interface PartnerProfile {
  id: string;
  username: string;
  display_name: string;
  must_change_credentials: boolean;
}

export interface PartnerOrderRow {
  id: number;
  product_name: string;
  price_text: string;
  quantity: number;
  unit: string | null;
  total_text: string;
  brand_name: string;
  invite_url: string | null;
  scheduled_for: string | null;
  ad_text: string | null;
  note: string | null;
  status: OrderStatus;
  status_note: string | null;
  created_at: string;
}

export async function signIn(username: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getPartnerSupabase();
  if (!sb) return { ok: false, error: 'Koneksi belum dikonfigurasi.' };
  const { error } = await sb.auth.signInWithPassword({
    email: `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`,
    password,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function signOut(): Promise<void> {
  await getPartnerSupabase()?.auth.signOut();
}

/** Profil partner untuk sesi saat ini, atau null bila belum login / bukan akun partner. */
export async function loadProfile(): Promise<PartnerProfile | null> {
  const sb = getPartnerSupabase();
  if (!sb) return null;
  const { data: sesi } = await sb.auth.getSession();
  const uid = sesi.session?.user.id;
  if (!uid) return null;
  const { data, error } = await sb
    .from('partner_accounts')
    .select('id,username,display_name,must_change_credentials')
    .eq('id', uid)
    .maybeSingle();
  if (error || !data) return null;
  return data as PartnerProfile;
}

const ORDER_COLS =
  'id,product_name,price_text,quantity,unit,total_text,brand_name,invite_url,scheduled_for,ad_text,note,status,status_note,created_at';

/** Riwayat pesanan milik sendiri (RLS), satu query terpaginasi. */
export async function listOrders(before?: number, limit = 20): Promise<PartnerOrderRow[]> {
  const sb = getPartnerSupabase();
  if (!sb) return [];
  let q = sb.from('partner_orders').select(ORDER_COLS).order('id', { ascending: false }).limit(limit);
  if (before) q = q.lt('id', before);
  const { data, error } = await q;
  if (error) throw new Error('Gagal memuat riwayat pesanan.');
  return (data ?? []) as PartnerOrderRow[];
}

export async function submitOrder(a: {
  productKey: string;
  quantity: number;
  brandName: string;
  inviteUrl: string;
  scheduledFor: string;
  adText: string;
  note: string;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const sb = getPartnerSupabase();
  if (!sb) return { ok: false, error: 'Koneksi belum dikonfigurasi.' };
  const { data, error } = await sb.rpc('partner_order_submit', {
    p_product_key: a.productKey,
    p_quantity: a.quantity,
    p_brand_name: a.brandName,
    p_invite_url: a.inviteUrl || null,
    p_scheduled_for: a.scheduledFor || null,
    p_ad_text: a.adText || null,
    p_note: a.note || null,
  });
  if (error) return { ok: false, error: rpcError(error.message) };
  return { ok: true, id: Number(data) };
}

/** Ganti username + password sendiri lewat Edge Function partner-admin. */
export async function changeCredentials(a: {
  currentPassword: string;
  username: string;
  password: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = getPartnerSupabase();
  if (!sb) return { ok: false, error: 'Koneksi belum dikonfigurasi.' };
  const { data, error } = await sb.functions.invoke('partner-admin', { body: { action: 'change', ...a } });
  if (error) {
    // FunctionsHttpError membawa Response; ambil pesan ramah dari badan.
    try {
      const body = await (error as any).context?.json?.();
      if (body?.message) return { ok: false, error: String(body.message) };
    } catch { /* abaikan */ }
    return { ok: false, error: 'Gagal menyimpan. Coba lagi.' };
  }
  if (!(data as any)?.ok) return { ok: false, error: String((data as any)?.message ?? 'Gagal menyimpan.') };
  // Email berubah: sesi lama tetap sah sampai token diperbarui; segarkan.
  await sb.auth.refreshSession();
  return { ok: true };
}
