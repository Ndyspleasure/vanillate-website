// ════════════════════════════════════════════════════════════════════════════
//  Edge Function: live-chat-email
//
//  Mengirim email ke CUSTOMER pada dua kejadian (transcript TIDAK dikirim via
//  email — itu hanya diarsipkan ke Discord oleh bot):
//    1) Admin membalas tiket   → "Tim kami membalas tiketmu"  (di-throttle).
//    2) Tiket ditutup          → "Tiketmu telah ditutup".
//
//  Dipicu oleh Supabase Database Webhooks:
//    • INSERT public.live_chat_messages  → cek sender_type='admin' & !is_internal
//    • UPDATE public.live_chat_tickets   → cek status open→closed
//
//  Secrets (supabase secrets set …):
//    RESEND_API_KEY        API key Resend (https://resend.com).
//    LIVE_CHAT_FROM_EMAIL  Pengirim terverifikasi, mis. "Vanillate <support@vanillate.id>".
//    LIVE_CHAT_REPLY_TO    (opsional) balasan diarahkan ke, mis. vanillatestudio@gmail.com.
//    LIVE_CHAT_SITE_URL    (opsional) URL untuk tombol "Buka Chat", default https://vanillate.id/chat.
//    LIVE_CHAT_WEBHOOK_SECRET (opsional) bila diisi, header x-webhook-secret wajib cocok.
//  SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY tersedia otomatis di Edge Function.
//
//  Deploy: supabase functions deploy live-chat-email --no-verify-jwt
//  (webhook memanggil tanpa JWT; keamanan lewat LIVE_CHAT_WEBHOOK_SECRET.)
// ════════════════════════════════════════════════════════════════════════════

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM = Deno.env.get('LIVE_CHAT_FROM_EMAIL') ?? 'Vanillate <support@vanillate.id>';
const REPLY_TO = Deno.env.get('LIVE_CHAT_REPLY_TO') ?? '';
const SITE_URL = Deno.env.get('LIVE_CHAT_SITE_URL') ?? 'https://vanillate.id/chat';
const WEBHOOK_SECRET = Deno.env.get('LIVE_CHAT_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Jangan kirim >1 email "dibalas" per tiket dalam jendela ini (customer yang
// sedang aktif menerima balasan via realtime, jadi email cukup sesekali).
const REPLY_THROTTLE_MS = 5 * 60 * 1000;

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f5f3ee;font-family:Inter,Arial,sans-serif;color:#111015">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="background:#fff;border-radius:16px;padding:28px;border:1px solid #eee">
      <h1 style="margin:0 0 12px;font-size:20px">${esc(title)}</h1>
      ${bodyHtml}
    </div>
    <p style="text-align:center;color:#8a8577;font-size:12px;margin-top:16px">
      Vanillate Studio • Email ini dikirim otomatis, mohon tidak membalas ke alamat ini.
    </p>
  </div></body></html>`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error('[live-chat-email] RESEND_API_KEY belum di-set.');
    return false;
  }
  const body: Record<string, unknown> = { from: FROM, to, subject, html };
  if (REPLY_TO) body.reply_to = REPLY_TO;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`[live-chat-email] Resend gagal: HTTP ${res.status} ${await res.text()}`);
    return false;
  }
  return true;
}

async function restPatch(path: string, patch: Record<string, unknown>): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  });
}

async function fetchTicket(ticketId: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/live_chat_tickets?id=eq.${ticketId}&limit=1` +
      `&select=id,customer_email,customer_name,subject,status,last_reply_email_at`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as Record<string, unknown>[];
  return rows[0] ?? null;
}

async function handleAdminReply(record: Record<string, unknown>): Promise<Response> {
  if (record.sender_type !== 'admin' || record.is_internal === true) {
    return new Response('skip', { status: 200 });
  }
  const ticket = await fetchTicket(String(record.ticket_id));
  if (!ticket || ticket.status !== 'open') return new Response('skip', { status: 200 });

  const last = ticket.last_reply_email_at ? new Date(String(ticket.last_reply_email_at)).getTime() : 0;
  if (Date.now() - last < REPLY_THROTTLE_MS) return new Response('throttled', { status: 200 });

  const name = String(ticket.customer_name || 'Customer');
  const subject = ticket.subject ? ` (${esc(String(ticket.subject))})` : '';
  const html = shell(
    'Tim kami membalas tiketmu',
    `<p style="font-size:14px;line-height:1.6">Halo <strong>${esc(name)}</strong>,</p>
     <p style="font-size:14px;line-height:1.6">Tim support Vanillate baru saja membalas percakapan live chat-mu${subject}.
     Buka kembali chat untuk melihat balasan dan melanjutkan percakapan.</p>
     <p style="margin:24px 0"><a href="${esc(SITE_URL)}" style="background:#e8b84a;color:#111015;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;font-size:14px">Buka Live Chat</a></p>`,
  );
  const ok = await sendEmail(String(ticket.customer_email), 'Tim kami membalas tiketmu — Vanillate', html);
  if (ok) await restPatch(`live_chat_tickets?id=eq.${ticket.id}`, { last_reply_email_at: new Date().toISOString() });
  return new Response(ok ? 'sent' : 'send-failed', { status: 200 });
}

async function handleTicketClosed(
  record: Record<string, unknown>,
  oldRecord: Record<string, unknown> | null,
): Promise<Response> {
  if (record.status !== 'closed' || oldRecord?.status === 'closed') {
    return new Response('skip', { status: 200 });
  }
  const name = String(record.customer_name || 'Customer');
  const subject = record.subject ? ` (${esc(String(record.subject))})` : '';
  const html = shell(
    'Tiketmu telah ditutup',
    `<p style="font-size:14px;line-height:1.6">Halo <strong>${esc(name)}</strong>,</p>
     <p style="font-size:14px;line-height:1.6">Sesi live chat-mu${subject} telah ditutup oleh tim support kami.
     Terima kasih telah menghubungi Vanillate. Jika masih ada yang perlu dibantu, kamu bisa memulai chat baru kapan saja.</p>
     <p style="margin:24px 0"><a href="${esc(SITE_URL)}" style="background:#e8b84a;color:#111015;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;font-size:14px">Mulai Chat Baru</a></p>`,
  );
  const ok = await sendEmail(String(record.customer_email), 'Tiketmu telah ditutup — Vanillate', html);
  return new Response(ok ? 'sent' : 'send-failed', { status: 200 });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  if (WEBHOOK_SECRET && req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return new Response('Bad Request', { status: 400 });
  }
  if (!payload.record) return new Response('no record', { status: 200 });

  try {
    if (payload.table === 'live_chat_messages' && payload.type === 'INSERT') {
      return await handleAdminReply(payload.record);
    }
    if (payload.table === 'live_chat_tickets' && payload.type === 'UPDATE') {
      return await handleTicketClosed(payload.record, payload.old_record);
    }
    return new Response('ignored', { status: 200 });
  } catch (err) {
    console.error('[live-chat-email] error:', err);
    return new Response('error', { status: 500 });
  }
});
