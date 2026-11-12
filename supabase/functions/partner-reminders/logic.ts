// ════════════════════════════════════════════════════════════════════════════
//  partner-reminders: logika murni (tanpa Deno/jaringan) supaya bisa diuji Node:
//  `node --experimental-strip-types --test tests/partner-reminders.test.ts`.
// ════════════════════════════════════════════════════════════════════════════

export const MAX_ATTEMPTS = 3;
export type NoticeKind = 'h5' | 'habis';

export interface NoticeRow {
  id: number;
  kind: NoticeKind;
  to_email: string | null;
  ends_on: string; // YYYY-MM-DD
  attempts: number;
  service: { label: string; kind: string; partner_name: string; starts_on: string; ends_on: string } | null;
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** "2026-11-17" → "17 November 2026". Masukan tidak sah dikembalikan apa adanya. */
export function tanggalId(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const bln = BULAN[Number(m[2]) - 1];
  return bln ? `${Number(m[3])} ${bln} ${m[1]}` : iso;
}

export function namaJenis(kind: string): string {
  if (kind === 'lobby') return 'Broadcast Lobby';
  if (kind === 'hosting_bot') return 'Hosting Bot';
  return 'Layanan';
}

export interface Mail { subject: string; html: string; text: string }

/**
 * Susun email. Teks untuk pengguna tanpa tanda pisah (aturan proyek) dan semua
 * nilai dari database di-escape. `dashboardUrl` dan `waUrl` berasal dari env.
 */
export function buildMail(n: NoticeRow, dashboardUrl: string, waUrl: string): Mail | null {
  const s = n.service;
  if (!s) return null;
  const nama = esc(s.partner_name || 'Partner');
  const label = esc(s.label);
  const akhir = tanggalId(n.ends_on);
  const jenis = namaJenis(s.kind);

  const judul = n.kind === 'h5' ? `${jenis} kamu berakhir dalam 5 hari` : `${jenis} kamu sudah berakhir`;
  const isi = n.kind === 'h5'
    ? `Masa layanan <strong>${label}</strong> akan berakhir pada <strong>${esc(akhir)}</strong>. Hubungi kami lewat WhatsApp sebelum tanggal itu bila ingin memperpanjang supaya layananmu tidak terputus.`
    : `Masa layanan <strong>${label}</strong> sudah berakhir pada <strong>${esc(akhir)}</strong>. Hubungi kami lewat WhatsApp bila ingin mengaktifkannya lagi.`;
  const teks = n.kind === 'h5'
    ? `Halo ${s.partner_name || 'Partner'}, masa layanan ${s.label} akan berakhir pada ${akhir}. Hubungi kami lewat WhatsApp sebelum tanggal itu bila ingin memperpanjang.`
    : `Halo ${s.partner_name || 'Partner'}, masa layanan ${s.label} sudah berakhir pada ${akhir}. Hubungi kami lewat WhatsApp bila ingin mengaktifkannya lagi.`;

  const tombol = (href: string, teksTombol: string, utama: boolean) =>
    /^https:\/\//.test(href)
      ? `<a href="${esc(href)}" style="display:inline-block;margin:6px 8px 0 0;padding:10px 18px;border-radius:999px;font-weight:600;text-decoration:none;${utama ? 'background:#111015;color:#fff' : 'background:#f1ece0;color:#111015'}">${esc(teksTombol)}</a>`
      : '';

  const html = `<!doctype html><html><body style="margin:0;background:#f5f3ee;font-family:Inter,Arial,sans-serif;color:#111015">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="background:#fff;border-radius:16px;padding:28px;border:1px solid #eee">
      <h1 style="margin:0 0 12px;font-size:20px">${esc(judul)}</h1>
      <p style="margin:0 0 12px;line-height:1.6">Halo ${nama},</p>
      <p style="margin:0 0 16px;line-height:1.6">${isi}</p>
      <div>${tombol(waUrl, 'Hubungi via WhatsApp', true)}${tombol(dashboardUrl, 'Buka dashboard partner', false)}</div>
    </div>
    <p style="text-align:center;color:#8a8577;font-size:12px;margin-top:16px">Vanillate Studio. Email ini dikirim otomatis, mohon tidak membalas ke alamat ini.</p>
  </div></body></html>`;

  return { subject: judul, html, text: teks };
}

/** Hasil kirim → pembaruan baris. Gagal 3 kali menjadi 'failed'; sisanya tetap 'pending'. */
export function nextState(
  attempts: number,
  ok: boolean,
  error: string,
  nowIso: string,
): { status: 'sent' | 'pending' | 'failed'; attempts: number; error: string | null; sent_at: string | null } {
  if (ok) return { status: 'sent', attempts: attempts + 1, error: null, sent_at: nowIso };
  const n = attempts + 1;
  return { status: n >= MAX_ATTEMPTS ? 'failed' : 'pending', attempts: n, error: error.slice(0, 300), sent_at: null };
}

/** Pembanding rahasia bebas dari timing. Kosong di sisi server = tidak diwajibkan. */
export function secretOk(expected: string, given: string | null): boolean {
  if (!expected) return true;
  if (!given || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}
