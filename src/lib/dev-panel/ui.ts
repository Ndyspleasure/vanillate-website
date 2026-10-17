// ════════════════════════════════════════════════════════════════════════════
//  Panel Developer — potongan tampilan & pengikat form (browser).
//
//  Semua teks dari bot/Discord (nama server, pemain, isi pesan, error) WAJIB
//  lewat esc() sebelum masuk innerHTML — lihat src/lib/admin-ui.ts.
//  `pasangAksi()` adalah satu-satunya jalur form → perintah: konfirmasi aksi
//  berbahaya, loading state, lalu hasil/error dari bot ditampilkan.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from '../admin-ui';
import { kirimPerintah, type CommandOutcome, type SendOptions } from './client';
import { ageSeconds, fmtDuration, isStale, progressPct, type Progress } from './model';

export type Tone = 'ok' | 'warn' | 'bad' | 'muted' | 'info';

const TONE: Record<Tone, string> = {
  ok: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
  warn: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  bad: 'bg-red-500/15 text-red-600 dark:text-red-400',
  muted: 'bg-ink-500/15 text-ink-500 dark:text-cream-300/60',
  info: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
};

export const KELAS = {
  input: 'w-full rounded-lg border border-ink-900/15 dark:border-cream-100/15 bg-cream-100/40 dark:bg-ink-900/40 px-3 py-2 text-sm outline-none focus:border-amber-500 transition-colors',
  label: 'block text-xs font-medium mb-1',
  kartu: 'rounded-2xl border border-ink-900/10 dark:border-cream-100/10 p-5',
  tombol: 'rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-colors bg-amber-500 text-ink-950 hover:bg-amber-400',
  tombolBahaya: 'rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-colors bg-red-500 text-white hover:bg-red-400',
  tombolNetral: 'rounded-lg border border-ink-900/10 dark:border-cream-100/10 px-3 py-1.5 text-xs font-medium text-ink-600 dark:text-cream-200/70 hover:bg-ink-900/5 dark:hover:bg-cream-100/5 transition-colors disabled:opacity-60',
  muted: 'text-ink-500 dark:text-cream-300/60',
};

export function pill(text: string, tone: Tone = 'muted'): string {
  return `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium ${TONE[tone]}">${esc(text)}</span>`;
}

export function statusTone(status: string): Tone {
  return ({ done: 'ok', error: 'bad', processing: 'warn', pending: 'muted' } as Record<string, Tone>)[status] ?? 'muted';
}

/** Kartu angka ringkas. */
export function stat(label: string, value: unknown, hint = ''): string {
  return `<div class="${KELAS.kartu}">
    <p class="text-xs ${KELAS.muted}">${esc(label)}</p>
    <p class="mt-1 font-display text-2xl font-semibold tracking-tightest">${esc(value ?? '—')}</p>
    ${hint ? `<p class="mt-1 text-xs ${KELAS.muted}">${esc(hint)}</p>` : ''}
  </div>`;
}

/** Bagian berjudul. `body` HARUS sudah aman (hasil helper lain / esc). */
export function section(title: string, body: string, desc = ''): string {
  return `<section class="space-y-4">
    <div>
      <h2 class="font-display text-lg font-semibold tracking-tightest">${esc(title)}</h2>
      ${desc ? `<p class="mt-0.5 text-sm ${KELAS.muted}">${esc(desc)}</p>` : ''}
    </div>
    ${body}
  </section>`;
}

/** Tabel sederhana. Sel sudah HTML aman. */
export function table(headers: string[], rows: string[][], empty = 'Belum ada data.'): string {
  if (!rows.length) return `<p class="py-8 text-center text-sm ${KELAS.muted}">${esc(empty)}</p>`;
  return `<div class="overflow-x-auto rounded-2xl border border-ink-900/10 dark:border-cream-100/10">
    <table class="w-full text-left text-sm">
      <thead><tr class="text-[0.7rem] uppercase tracking-wider text-ink-400 dark:text-cream-300/40">
        ${headers.map((h) => `<th class="px-4 py-3 font-medium">${esc(h)}</th>`).join('')}
      </tr></thead>
      <tbody>${rows.map((r) => `<tr class="border-t border-ink-900/5 dark:border-cream-100/5">${r.map((c) => `<td class="px-4 py-3 align-top">${c}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  </div>`;
}

/** Keterangan kesegaran snapshot + peringatan bila bot tampak offline. */
export function freshness(updatedAt: string | null | undefined): string {
  const age = ageSeconds(updatedAt);
  if (age === null) return `<span class="text-xs ${KELAS.muted}">Belum ada data dari bot.</span>`;
  const teks = `Data bot ${fmtDuration(age)} lalu`;
  return isStale(updatedAt)
    ? `<span class="text-xs text-amber-700 dark:text-amber-400">⚠ ${esc(teks)} — bot mungkin offline atau belum v3.</span>`
    : `<span class="text-xs ${KELAS.muted}">${esc(teks)}</span>`;
}

export function progressBar(p: Progress | null | undefined): string {
  const pct = progressPct(p);
  if (pct === null) return '';
  const rinci = [p?.sent !== undefined ? `terkirim ${p.sent}` : '', p?.failed ? `gagal ${p.failed}` : '', p?.skipped ? `dilewati ${p.skipped}` : '']
    .filter(Boolean).join(' · ');
  return `<div class="space-y-1">
    <div class="h-2 rounded-full bg-ink-900/10 dark:bg-cream-100/10 overflow-hidden"><div class="h-full bg-amber-500" style="width:${pct}%"></div></div>
    <p class="text-xs ${KELAS.muted}">${esc(`${p?.done ?? 0}/${p?.total ?? 0} (${pct}%)${rinci ? ` · ${rinci}` : ''}`)}</p>
  </div>`;
}

/** Blok pesan status (sukses / gagal / info). */
export function notice(kind: 'ok' | 'error' | 'info' | 'warn', message: string): string {
  const warna = {
    ok: 'border-teal-500/30 bg-teal-500/10 text-teal-800 dark:text-teal-200',
    error: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
    warn: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200',
    info: 'border-ink-900/10 dark:border-cream-100/10 text-ink-600 dark:text-cream-200/80',
  }[kind];
  return `<div class="rounded-xl border px-4 py-3 text-sm ${warna}">${esc(message)}</div>`;
}

/** Field form standar. */
export interface Field {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'textarea' | 'datetime-local' | 'select' | 'checkbox' | 'url';
  required?: boolean;
  placeholder?: string;
  help?: string;
  value?: string;
  options?: { value: string; label: string }[];
  step?: string;
  rows?: number;
}

export function fieldHtml(f: Field, prefix = ''): string {
  const id = `${prefix}${f.name}`.replace(/[^a-z0-9_-]/gi, '-');
  const req = f.required ? ' required' : '';
  const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : '';
  const val = f.value !== undefined ? ` value="${esc(f.value)}"` : '';
  const help = f.help ? `<p class="mt-1 text-xs ${KELAS.muted}">${esc(f.help)}</p>` : '';
  let input: string;
  if (f.type === 'textarea') {
    input = `<textarea id="${esc(id)}" name="${esc(f.name)}" rows="${f.rows ?? 3}"${req}${ph} class="${KELAS.input}">${esc(f.value ?? '')}</textarea>`;
  } else if (f.type === 'select') {
    input = `<select id="${esc(id)}" name="${esc(f.name)}"${req} class="${KELAS.input}">${(f.options ?? [])
      .map((o) => `<option value="${esc(o.value)}"${o.value === f.value ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
  } else if (f.type === 'checkbox') {
    return `<label class="flex items-center gap-2 text-sm"><input type="checkbox" name="${esc(f.name)}" class="h-4 w-4 accent-amber-500"${f.value === 'true' ? ' checked' : ''} /> ${esc(f.label)}</label>${help}`;
  } else {
    const step = f.step ? ` step="${esc(f.step)}"` : (f.type === 'number' ? ' step="any"' : '');
    input = `<input id="${esc(id)}" name="${esc(f.name)}" type="${esc(f.type ?? 'text')}"${req}${ph}${val}${step} class="${KELAS.input}" />`;
  }
  return `<div><label for="${esc(id)}" class="${KELAS.label}">${esc(f.label)}</label>${input}${help}</div>`;
}

/** Nilai form → payload (string trim; checkbox → boolean; kosong dilewati). */
export function formPayload(form: HTMLFormElement): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input[name], textarea[name], select[name]').forEach((el) => {
    if (el instanceof HTMLInputElement && el.type === 'checkbox') { out[el.name] = el.checked; return; }
    const v = String(el.value ?? '').trim();
    if (v !== '') out[el.name] = v;
  });
  return out;
}

export interface AksiOptions {
  type: string | (() => string);
  /** Payload tambahan / pengganti dari form. */
  payload?: (form: HTMLFormElement) => Record<string, unknown> | null;
  /** Konfirmasi sederhana (window.confirm). */
  confirm?: string | ((payload: Record<string, unknown>) => string | null);
  /** Konfirmasi ketik kata (aksi sangat berbahaya), mis. 'BROADCAST'. */
  typed?: string;
  /** Elemen status (default [data-status] di dalam form). */
  status?: HTMLElement | null;
  send?: SendOptions;
  /** Teks hasil sukses; default "Selesai.". */
  success?: (outcome: CommandOutcome) => string | void;
  onDone?: (outcome: CommandOutcome, form: HTMLFormElement) => void;
  resetOnSuccess?: boolean;
}

function tulisStatus(el: HTMLElement | null, kind: 'ok' | 'error' | 'info', teks: string) {
  if (!el) return;
  el.textContent = teks;
  el.className = `text-xs ${kind === 'ok' ? 'text-teal-700 dark:text-teal-300' : kind === 'error' ? 'text-red-600 dark:text-red-400' : KELAS.muted}`;
}

/** Ikat satu form ke satu perintah bot (loading, konfirmasi, hasil/error). */
export function pasangAksi(form: HTMLFormElement, opt: AksiOptions): void {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = opt.status ?? form.querySelector<HTMLElement>('[data-status]');
    const type = typeof opt.type === 'function' ? opt.type() : opt.type;
    const payload = opt.payload ? opt.payload(form) : formPayload(form);
    if (!payload) return; // payload() menolak (sudah menampilkan alasannya)

    const tanya = typeof opt.confirm === 'function' ? opt.confirm(payload) : opt.confirm;
    if (tanya && !window.confirm(tanya)) { tulisStatus(status, 'info', 'Dibatalkan.'); return; }
    if (opt.typed) {
      const jawab = window.prompt(`Aksi ini tidak bisa dibatalkan. Ketik ${opt.typed} untuk melanjutkan:`);
      if (jawab !== opt.typed) { tulisStatus(status, 'info', 'Dibatalkan — konfirmasi tidak cocok.'); return; }
    }

    const tombol = form.querySelectorAll<HTMLButtonElement>('button[type=submit]');
    tombol.forEach((b) => { b.disabled = true; });
    tulisStatus(status, 'info', 'Menunggu bot…');
    const outcome = await kirimPerintah(type, payload, {
      ...opt.send,
      onUpdate: (row) => {
        tulisStatus(status, 'info', row.status === 'processing' ? 'Bot sedang memproses…' : 'Menunggu bot…');
        opt.send?.onUpdate?.(row);
      },
    });
    tombol.forEach((b) => { b.disabled = false; });

    if (outcome.ok) {
      tulisStatus(status, 'ok', opt.success?.(outcome) || 'Selesai.');
      if (opt.resetOnSuccess) form.reset();
    } else {
      tulisStatus(status, outcome.timedOut ? 'info' : 'error', outcome.error ?? 'Gagal.');
    }
    opt.onDone?.(outcome, form);
  });
}

/** Form kartu siap pakai: judul, field, tombol, baris status. */
export function formCard({ id, title, fields, submit = 'Kirim', danger = false, desc = '', ownerOnly = false, prefix = '' }: {
  id: string; title: string; fields: Field[]; submit?: string; danger?: boolean; desc?: string; ownerOnly?: boolean; prefix?: string;
}): string {
  return `<form id="${esc(id)}" class="${KELAS.kartu} space-y-3">
    <div class="flex items-center justify-between gap-2">
      <h3 class="text-sm font-semibold">${esc(title)}</h3>
      ${ownerOnly ? pill('khusus owner', 'warn') : ''}
    </div>
    ${desc ? `<p class="text-xs ${KELAS.muted}">${esc(desc)}</p>` : ''}
    ${fields.map((f) => fieldHtml(f, prefix || `${id}-`)).join('')}
    <div class="flex items-center gap-3 pt-1">
      <button type="submit" class="${danger ? KELAS.tombolBahaya : KELAS.tombol}">${esc(submit)}</button>
      <p class="text-xs" role="status" aria-live="polite" data-status></p>
    </div>
  </form>`;
}

/** Unduh teks sebagai berkas (hasil export dari bot). */
export function unduhTeks(nama: string, isi: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([isi], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nama;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export const fmtJam = (ms: number | null | undefined): string => {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
};
