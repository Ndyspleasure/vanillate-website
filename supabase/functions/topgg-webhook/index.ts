// ════════════════════════════════════════════════════════════════════════════
//  Edge Function: topgg-webhook — penerima webhook vote Top.gg untuk
//  📣 Share Server (Sosial Hub Sambung Kata).
//
//  Bot berjalan di PC lokal tanpa server HTTP, jadi Top.gg mengirim webhook ke
//  sini. Fungsi ini HANYA: verifikasi tanda tangan → simpan vote ke
//  public.share_topgg_votes (event_key unik = webhook ulang tidak dobel) →
//  balas 200. Menghitung vote, menentukan server tujuan, dan menyaring akun
//  palsu dilakukan bot (sambung-kata-bot: src/social/share/votes.js).
//
//  Tanpa TOPGG_WEBHOOK_SECRET → semua permintaan ditolak (fail closed).
//  Deploy dengan verify_jwt = false (Top.gg tidak mengirim JWT Supabase);
//  autentikasinya tanda tangan HMAC x-topgg-signature (atau header
//  Authorization = secret untuk webhook lama).
//  Env: TOPGG_WEBHOOK_SECRET (wajib), SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY
//  (otomatis). Acuan: docs/DASHBOARD-SERVER.md › Share Server.
// ════════════════════════════════════════════════════════════════════════════

import { parseEvent, verifyLegacy, verifySignature } from './logic.ts';

const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
// Spasi / baris baru / tanda kutip yang ikut tertempel saat mengisi secret dibuang.
const SECRET = (Deno.env.get('TOPGG_WEBHOOK_SECRET') ?? '').trim().replace(/^["']+|["']+$/g, '').trim();
const MAX_BODY = 64 * 1024;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });
  if (!SECRET || !SUPABASE_URL || !SERVICE_KEY) return json(503, { error: 'NOT_CONFIGURED' });

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json(413, { error: 'TOO_LARGE' });

  const signature = req.headers.get('x-topgg-signature');
  const ok = signature
    ? await verifySignature(SECRET, signature, raw)
    : verifyLegacy(SECRET, req.headers.get('authorization'));
  if (!ok) return json(401, { error: 'INVALID_SIGNATURE' });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: 'BAD_JSON' });
  }

  const ev = parseEvent(body);
  if (ev.kind === 'test') return json(200, { ok: true, test: true });
  if (ev.kind === 'ignore') return json(200, { ok: true, ignored: ev.reason });

  const res = await fetch(`${SUPABASE_URL}/rest/v1/share_topgg_votes?on_conflict=event_key`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify({
      event_key: ev.eventKey,
      discord_user_id: ev.discordUserId,
      voted_at: ev.votedAt,
      weight: ev.weight,
      query: ev.query,
      source: signature ? 'webhook' : 'legacy',
    }),
  });
  if (!res.ok) {
    console.error(`[topgg-webhook] Gagal menyimpan vote → ${res.status}`);
    // 5xx → Top.gg mencoba lagi; event_key unik mencegah dobel.
    return json(500, { error: 'DATABASE_ERROR' });
  }
  return json(200, { ok: true });
});
