// Operasi data Live Chat untuk customer (browser). Semua query tunduk RLS:
// customer hanya bisa mengakses tiket miliknya sendiri (dicocokkan lewat email
// pada JWT). Bot (service_role) yang membuat channel Discord & membalas.

import type { RealtimeChannel } from '@supabase/supabase-js';
import { getChatSupabase } from './customer-auth';

export type TicketStatus = 'open' | 'closed';

export interface LiveChatTicket {
  id: string;
  customer_email: string;
  customer_name: string;
  subject: string | null;
  status: TicketStatus;
  created_at: string;
  closed_at: string | null;
}

export interface LiveChatMessage {
  id: string;
  ticket_id: string;
  sender_type: 'customer' | 'admin' | 'system';
  sender_name: string;
  content: string;
  created_at: string;
}

const TICKET_COLS = 'id,customer_email,customer_name,subject,status,created_at,closed_at';
const MESSAGE_COLS = 'id,ticket_id,sender_type,sender_name,content,created_at';

/** Tiket 'open' milik customer (bila ada) — untuk melanjutkan sesi. */
export async function getOpenTicket(): Promise<LiveChatTicket | null> {
  const supabase = getChatSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('live_chat_tickets')
    .select(TICKET_COLS)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as LiveChatTicket) ?? null;
}

/** Buat tiket baru. RLS memaksa customer_email = email JWT. */
export async function createTicket(
  customerName: string,
  customerEmail: string,
  subject: string,
  firstMessage: string,
): Promise<{ ticket?: LiveChatTicket; error?: string }> {
  const supabase = getChatSupabase();
  if (!supabase) return { error: 'Koneksi belum dikonfigurasi.' };

  const { data, error } = await supabase
    .from('live_chat_tickets')
    .insert({ customer_name: customerName, customer_email: customerEmail, subject, status: 'open' })
    .select(TICKET_COLS)
    .single();
  if (error || !data) return { error: error?.message ?? 'Gagal membuat tiket.' };

  const ticket = data as LiveChatTicket;
  const send = await sendMessage(ticket.id, customerName, firstMessage);
  if (send.error) return { error: send.error };
  return { ticket };
}

/** Ambil seluruh pesan tiket (non-internal — dijamin RLS), urut terlama→terbaru. */
export async function getMessages(ticketId: string): Promise<LiveChatMessage[]> {
  const supabase = getChatSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('live_chat_messages')
    .select(MESSAGE_COLS)
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data as LiveChatMessage[]) ?? [];
}

/** Kirim pesan customer ke tiket. RLS menolak bila bukan tiket sendiri/tertutup. */
export async function sendMessage(
  ticketId: string,
  senderName: string,
  content: string,
): Promise<{ error?: string }> {
  const supabase = getChatSupabase();
  if (!supabase) return { error: 'Koneksi belum dikonfigurasi.' };
  const { error } = await supabase.from('live_chat_messages').insert({
    ticket_id: ticketId,
    sender_type: 'customer',
    sender_name: senderName,
    content,
    is_internal: false,
  });
  if (error) return { error: error.message };
  return {};
}

/**
 * Berlangganan realtime pesan baru & perubahan status tiket. RLS berlaku pada
 * realtime, jadi hanya pesan non-internal milik tiket customer yang diterima.
 * @returns fungsi untuk berhenti berlangganan.
 */
export function subscribeTicket(
  ticketId: string,
  onMessage: (msg: LiveChatMessage) => void,
  onStatus: (status: TicketStatus) => void,
): () => void {
  const supabase = getChatSupabase();
  if (!supabase) return () => {};

  const channel: RealtimeChannel = supabase
    .channel(`live_chat:${ticketId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'live_chat_messages', filter: `ticket_id=eq.${ticketId}` },
      (payload) => onMessage(payload.new as LiveChatMessage),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'live_chat_tickets', filter: `id=eq.${ticketId}` },
      (payload) => onStatus((payload.new as LiveChatTicket).status),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
