// ════════════════════════════════════════════════════════════════════════════
//  Edge Function: partner-reminders
//
//  Mengirim email pengingat masa layanan partner (H-5 dan habis) yang sudah
//  diantre pemeriksa harian `partner_services_tick()` di tabel
//  `partner_service_notices`. Hanya memproses baris 'pending' (maks. 50 per
//  panggilan, maks. 3 percobaan), jadi memanggilnya berulang aman.
//
//  Dipanggil pg_net oleh pemeriksa harian, hanya bila ada email menunggu.
//
//  Secrets (supabase secrets set ...):
//    RESEND_API_KEY            API key Resend (sama dengan live-chat-email dan blog-admin).
//    PARTNER_FROM_EMAIL        Pengirim terverifikasi, bawaan "Vanillate Partner <partner@vanillate.id>".
//    PARTNER_SITE_URL          (opsional) bawaan https://vanillate.id
//    PARTNER_WHATSAPP_URL      (opsional) tautan WhatsApp official untuk tombol.
//    PARTNER_REMINDER_SECRET   (opsional) bila diisi, header x-cron-secret wajib cocok
//                              (pemeriksa membacanya dari Vault `partner_reminder_secret`).
//  SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY tersedia otomatis.
//
//  Deploy dengan verify_jwt = false (pemanggil adalah pg_net).
//  Kunci service_role hanya hidup di sini, tidak pernah di browser.
// ════════════════════════════════════════════════════════════════════════════

import { buildMail, nextState, secretOk, type NoticeRow } from './logic.ts';

const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM = Deno.env.get('PARTNER_FROM_EMAIL') ?? 'Vanillate Partner <partner@vanillate.id>';
const SITE_URL = (Deno.env.get('PARTNER_SITE_URL') ?? 'https://vanillate.id').replace(/\/+$/, '');
const WA_URL = Deno.env.get('PARTNER_WHATSAPP_URL') ?? '';
const SECRET = Deno.env.get('PARTNER_REMINDER_SECRET') ?? '';

const HEAD = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function send(to: string, mail: { subject: string; html: string; text: string }): Promise<{ ok: boolean; error: string }> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject: mail.subject, html: mail.html, text: mail.text }),
    });
    return res.ok ? { ok: true, error: '' } : { ok: false, error: `Resend ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'gagal terhubung' };
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });
  if (!secretOk(SECRET, req.headers.get('x-cron-secret'))) return json(401, { error: 'UNAUTHORIZED' });
  if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { error: 'NOT_CONFIGURED' });
  // Tanpa kunci Resend baris dibiarkan 'pending' (tidak menghabiskan percobaan).
  if (!RESEND_API_KEY) return json(200, { sent: 0, failed: 0, reason: 'no_resend_key' });

  const q = 'partner_service_notices?select=id,kind,to_email,ends_on,attempts,service:partner_services(label,kind,partner_name,starts_on,ends_on)'
    + '&status=eq.pending&attempts=lt.3&order=id.asc&limit=50';
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: HEAD });
  if (!res.ok) return json(502, { error: 'UPSTREAM_ERROR' });
  const rows = (await res.json()) as NoticeRow[];

  let sent = 0;
  let failed = 0;
  for (const n of rows) {
    const mail = n.to_email ? buildMail(n, `${SITE_URL}/partnership/dashboard/`, WA_URL) : null;
    const hasil = mail && n.to_email ? await send(n.to_email, mail) : { ok: false, error: 'Email atau layanan tidak tersedia.' };
    const st = nextState(n.attempts, hasil.ok, hasil.error, new Date().toISOString());
    await fetch(`${SUPABASE_URL}/rest/v1/partner_service_notices?id=eq.${n.id}`, {
      method: 'PATCH',
      headers: { ...HEAD, Prefer: 'return=minimal' },
      body: JSON.stringify(st),
    });
    if (hasil.ok) sent++; else failed++;
  }
  return json(200, { sent, failed });
});
