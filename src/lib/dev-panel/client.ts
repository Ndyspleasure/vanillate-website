// ════════════════════════════════════════════════════════════════════════════
//  Panel Developer — klien browser: perintah ke bot & snapshot keadaan bot.
//
//  Arah website → bot: INSERT ke `bot_commands` (status pending, created_by =
//  diri sendiri — dipaksa RLS). Bot menarik antrean, memverifikasi peran
//  pembuat dari admin_users, mengeksekusi, lalu menulis status + hasil.
//  Arah bot → website: `bot_panel_snapshots` (dibaca admin login saja).
//
//  Hanya anon key + JWT admin yang dipakai di sini. Token bot & service_role
//  key TIDAK PERNAH ada di website.
// ════════════════════════════════════════════════════════════════════════════

import { getSupabase } from '../supabase';
import { isFinal, type Progress } from './model';

export interface CommandOutcome<T = any> {
  id: number | null;
  ok: boolean;
  status: string;
  result: T | null;
  error: string | null;
  progress: Progress | null;
  timedOut: boolean;
}

export interface SendOptions {
  /** Tunggu sampai bot selesai (default true). */
  wait?: boolean;
  /** Batas tunggu (ms). Restart/update butuh lebih lama. */
  timeoutMs?: number;
  /** Dipanggil setiap kali status/progress berubah selama menunggu. */
  onUpdate?: (row: { status: string; progress: Progress | null }) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function gagal(error: string, id: number | null = null): CommandOutcome {
  return { id, ok: false, status: 'error', result: null, error, progress: null, timedOut: false };
}

/** Pesan error Supabase → bahasa manusia (RLS, trigger owner, jaringan). */
function pesanInsert(error: { message?: string; code?: string }): string {
  if (/hanya boleh dikirim owner/i.test(error.message ?? '')) return 'Perintah ini khusus owner.';
  if (error.code === '42501' || /row-level security|permission denied/i.test(error.message ?? '')) {
    return 'Akun ini tidak punya izin mengirim perintah (peran viewer hanya bisa melihat).';
  }
  return 'Gagal mengirim perintah ke antrean. Coba lagi.';
}

/** Kirim satu perintah ke bot; secara default menunggu hasilnya. */
export async function kirimPerintah<T = any>(
  type: string,
  payload: Record<string, unknown> = {},
  { wait = true, timeoutMs = 45_000, onUpdate }: SendOptions = {},
): Promise<CommandOutcome<T>> {
  const supabase = getSupabase();
  if (!supabase) return gagal('Supabase belum dikonfigurasi.');
  const { data: sesi } = await supabase.auth.getSession();
  const uid = sesi.session?.user.id;
  if (!uid) return gagal('Sesi login berakhir. Muat ulang halaman.');

  const { data, error } = await supabase
    .from('bot_commands')
    .insert({ type, payload, status: 'pending', created_by: uid })
    .select('id')
    .single();
  if (error || !data) return gagal(pesanInsert(error ?? {}));
  const id = Number(data.id);
  if (!wait) return { id, ok: true, status: 'pending', result: null, error: null, progress: null, timedOut: false };

  const batas = Date.now() + timeoutMs;
  let jeda = 1000;
  let terakhir = '';
  while (Date.now() < batas) {
    await sleep(jeda);
    jeda = Math.min(3000, jeda + 250);
    const { data: row } = await supabase
      .from('bot_commands')
      .select('status, result, error, progress')
      .eq('id', id)
      .maybeSingle();
    if (!row) continue;
    const sidik = `${row.status}|${JSON.stringify(row.progress ?? null)}`;
    if (sidik !== terakhir) {
      terakhir = sidik;
      onUpdate?.({ status: row.status, progress: row.progress ?? null });
    }
    if (isFinal(row.status)) {
      return {
        id, ok: row.status === 'done', status: row.status,
        result: (row.result ?? null) as T | null, error: row.error ?? null,
        progress: row.progress ?? null, timedOut: false,
      };
    }
  }
  return {
    id, ok: false, status: 'pending', result: null,
    error: 'Bot belum menjawab. Perintah tetap di antrean — cek riwayat sebentar lagi (bot mungkin offline).',
    progress: null, timedOut: true,
  };
}

/** Status terkini satu perintah (mis. melanjutkan pantauan broadcast). */
export async function bacaPerintah(id: number) {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from('bot_commands')
    .select('id, type, payload, status, result, error, progress, created_at, processed_at, heartbeat_at')
    .eq('id', id)
    .maybeSingle();
  return data;
}

/** Riwayat perintah (opsional difilter tipe/prefiks). */
export async function riwayatPerintah(types: string[] = [], limit = 20) {
  const supabase = getSupabase();
  if (!supabase) return { rows: [], error: 'Supabase belum dikonfigurasi.' };
  let q = supabase
    .from('bot_commands')
    .select('id, type, payload, status, result, error, progress, created_at, processed_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (types.length) q = q.in('type', types);
  const { data, error } = await q;
  return { rows: data ?? [], error: error ? 'Gagal memuat riwayat perintah.' : null };
}

export interface Snapshot<T = any> {
  key: string;
  data: T | null;
  updatedAt: string | null;
  error: string | null;
}

/** Baca beberapa snapshot sekaligus. */
export async function bacaSnapshots<T = any>(keys: string[]): Promise<Record<string, Snapshot<T>>> {
  const out: Record<string, Snapshot<T>> = {};
  for (const k of keys) out[k] = { key: k, data: null, updatedAt: null, error: null };
  const supabase = getSupabase();
  if (!supabase) {
    for (const k of keys) out[k].error = 'Supabase belum dikonfigurasi.';
    return out;
  }
  const { data, error } = await supabase
    .from('bot_panel_snapshots')
    .select('key, data, updated_at')
    .in('key', keys);
  if (error) {
    const pesan = /does not exist|42P01/.test(`${error.code} ${error.message}`)
      ? 'Tabel bot_panel_snapshots belum ada. Jalankan supabase/developer-panel-schema.sql.'
      : 'Gagal memuat data bot.';
    for (const k of keys) out[k].error = pesan;
    return out;
  }
  for (const row of data ?? []) {
    out[row.key] = { key: row.key, data: row.data as T, updatedAt: row.updated_at, error: null };
  }
  for (const k of keys) {
    if (!out[k].data && !out[k].error) out[k].error = 'Bot belum pernah mengirim data ini. Pastikan bot v3 sudah berjalan.';
  }
  return out;
}

export async function bacaSnapshot<T = any>(key: string): Promise<Snapshot<T>> {
  return (await bacaSnapshots<T>([key]))[key];
}

/** Minta bot menerbitkan ulang snapshot SEKARANG, lalu baca hasilnya. */
export async function muatUlangDariBot<T = any>(keys: string[]): Promise<{ outcome: CommandOutcome; snapshots: Record<string, Snapshot<T>> }> {
  const outcome = await kirimPerintah('panel.refresh', { keys }, { timeoutMs: 30_000 });
  return { outcome, snapshots: await bacaSnapshots<T>(keys) };
}
