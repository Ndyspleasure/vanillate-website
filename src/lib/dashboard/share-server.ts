// /dashboard/server/?id=<guildId>#share-server — tab 📣 Share Server.
//
// Website TIDAK menyimpan konfigurasi Share Server. Status & riwayat dibaca
// dari share_guild_state (diterbitkan bot) lewat RPC share_dashboard_get;
// setiap aksi dikirim sebagai permintaan (RPC share_request_submit) yang
// dijalankan bot dengan aturan yang sama dengan /pengaturan di Discord, setelah
// izin Manage Server user diperiksa ulang di Discord. Hasilnya tampil di sini.
// Acuan: docs/DASHBOARD-SERVER.md › Share Server.

import { DashboardError, getShare, submitShareRequest } from './api';
import { channelOptions, describeError, CHANNEL_TYPE, type Snapshot } from './model';
import {
  AUDIT_LABEL,
  buildSavePayload,
  formatDuration,
  INCIDENT_LABEL,
  isStale,
  pendingRequest,
  REQUEST_LABEL,
  STATUS_META,
  type ShareDashboard,
  type ShareDraft,
  type ShareState,
} from './share-model';
import { BTN_PRIMARY, BTN_SECONDARY, CARD, esc, icon, pill, spinner, toast } from './ui';

const FAST_MS = 3000;
const SLOW_MS = 20000;

const SELECT =
  'mt-1 w-full rounded-xl border border-ink-900/15 bg-white px-3 py-2 text-sm dark:border-cream-100/15 dark:bg-ink-900';

function fmtTime(ms: number | string | null | undefined): string {
  const t = typeof ms === 'string' ? Date.parse(ms) : Number(ms);
  if (!Number.isFinite(t) || !t) return '—';
  return new Date(t).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }) + ' WIB';
}

export interface ShareController {
  html(snapshot: Snapshot | null): string;
  activate(): void;
  deactivate(): void;
  onClick(btn: HTMLElement): boolean;
  onInput(el: HTMLElement): boolean;
  onSubmit(form: HTMLFormElement): boolean;
  /** Gambar ulang yang tertunda selama user mengetik di formulir. */
  flush(): void;
}

export function createShareController(guildId: string, rerender: () => void, root: HTMLElement): ShareController {
  let dash: ShareDashboard | null = null;
  let error: string | null = null;
  let loading = false;
  let active = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let draft: ShareDraft = {};
  let busy = false;
  let lastSig = '';
  let deferred = false;
  let watched: number | null = null; // id permintaan yang ditunggu hasilnya

  const st = (): ShareState | null => dash?.state ?? null;

  function sig(): string {
    return JSON.stringify({ dash, error });
  }

  function editing(): boolean {
    const a = document.activeElement as HTMLElement | null;
    return Boolean(a && root.contains(a) && a.closest('[data-share-form]') && /INPUT|TEXTAREA|SELECT/.test(a.tagName));
  }

  function maybeRender(): void {
    const s = sig();
    if (s === lastSig) return;
    lastSig = s;
    if (editing()) { deferred = true; return; }
    rerender();
  }

  async function load(): Promise<void> {
    if (loading) return;
    loading = true;
    try {
      dash = await getShare(guildId);
      error = null;
      const w = watched !== null ? dash.requests.find((r) => r.id === watched) : null;
      if (w && (w.status === 'done' || w.status === 'error')) {
        watched = null;
        const msg = w.result?.message ?? w.error ?? (w.status === 'done' ? 'Selesai.' : 'Gagal.');
        toast(msg.replace(/\*\*/g, '').split('\n')[0].slice(0, 200), w.status === 'done' ? 'success' : 'danger', 7000);
        if (w.status === 'done') draft = {};
      }
    } catch (err) {
      error = describeError(err instanceof DashboardError ? err.code : 'NETWORK');
    } finally {
      loading = false;
    }
    maybeRender();
  }

  function schedule(): void {
    if (timer) clearTimeout(timer);
    if (!active) return;
    const fast = Boolean(pendingRequest(dash?.requests) || st()?.test);
    timer = setTimeout(async () => { await load(); schedule(); }, fast ? FAST_MS : SLOW_MS);
  }

  async function send(type: string, payload: Record<string, unknown> = {}): Promise<void> {
    if (busy) return;
    busy = true;
    rerender();
    try {
      const r = await submitShareRequest(guildId, type, payload);
      watched = r.id;
      toast(type === 'activate' || type === 'test'
        ? 'Permintaan dikirim. Bot menjalankan Pesan Uji (±1 menit)…'
        : 'Permintaan dikirim ke bot…', 'info');
      await load();
    } catch (err) {
      const code = err instanceof DashboardError ? err.code : 'NETWORK';
      toast(code === 'TOO_MANY_REQUESTS' ? 'Masih ada permintaan yang diproses. Tunggu sebentar.' : describeError(code), 'danger');
    } finally {
      busy = false;
      rerender();
      schedule();
    }
  }

  // ─── HTML ────────────────────────────────────────────────────────────────

  function channelSelect(name: string, snapshot: Snapshot | null, current: string | null | undefined, placeholder: string): string {
    const opts = channelOptions(snapshot, { key: name, label: name, channel_types: [CHANNEL_TYPE.TEXT, CHANNEL_TYPE.ANNOUNCEMENT] });
    const val = (draft as Record<string, string | undefined>)[name] ?? current ?? '';
    return `<select data-share-field="${name}" data-focus="share-${name}" class="${SELECT}">
      <option value="">${esc(placeholder)}</option>
      ${opts.map((o) => `<option value="${esc(o.id)}" ${o.id === val ? 'selected' : ''}>#${esc(o.name)}${o.category ? ` — ${esc(o.category)}` : ''}</option>`).join('')}
    </select>`;
  }

  function statusCard(s: ShareState): string {
    const meta = STATUS_META[s.status] ?? STATUS_META.OFF;
    const now = Date.now();
    const q: string[] = [];
    if (s.enabled) {
      q.push(`<li>Vote terbuka: <strong>${s.votes}</strong>${s.reductionMs ? ` · potongan masa tunggu ${esc(formatDuration(s.reductionMs))}` : ''}</li>`);
      if (s.cooldownEndsAt > now) q.push(`<li>Bisa antre lagi: ${esc(fmtTime(s.cooldownEndsAt))}</li>`);
      if (s.queue) q.push(`<li>Posisi antrean <strong>#${s.queue.position}</strong> dari ${s.queue.total} · perkiraan tayang ${esc(fmtTime(s.queue.estimateAt))}</li>`);
      if (s.lastBroadcastAt) q.push(`<li>Tayang terakhir: ${esc(fmtTime(s.lastBroadcastAt))}</li>`);
      q.push(`<li>Iklan diterima yang terhapus &lt; ${s.rules.GUARD_HOURS ?? 24} jam minggu ini: <strong>${s.violations.count}/${s.violations.quota}</strong> (reset ${esc(fmtTime(s.violations.resetAt))})</li>`);
    }
    const incidents = s.incidents.map((i) => `<li>${pill(INCIDENT_LABEL[i.type] ?? i.type, i.type === 'hold' ? 'danger' : 'warning')}
      <span class="ml-2 text-xs text-ink-500">${esc(fmtTime(i.firstAt))}${i.respondedAt ? ' · dikonfirmasi' : ''}</span>
      ${i.alertError ? `<p class="mt-1 text-xs text-red-600 dark:text-red-300">${esc(i.alertError)}</p>` : ''}</li>`);
    return `
      <div class="${CARD} p-5">
        <div class="flex flex-wrap items-center gap-3">
          <h2 class="font-display text-lg font-semibold">📣 Share Server</h2>
          ${pill(meta.label, meta.tone)}
          ${s.test ? `<span class="inline-flex items-center gap-2 text-xs text-ink-500">${spinner()} Pesan Uji berjalan…</span>` : ''}
        </div>
        <p class="mt-2 text-sm text-ink-700 dark:text-cream-200">${esc(s.statusLabel)}</p>
        ${s.hold ? `<p class="mt-2 text-sm text-red-700 dark:text-red-300">${s.hold.reason === 'cms'
          ? `Ditahan Tim Sambung Kata${s.hold.note ? `: ${esc(s.hold.note)}` : ''}. Hubungi Tim Support untuk banding.`
          : `Terlalu banyak iklan terhapus minggu ini. Perbaiki bot anti-link / AutoMod lalu kirim Pesan Uji (${s.recover.used}/${s.recover.max} minggu ini), atau hubungi Tim Support.`}</p>` : ''}
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h3 class="text-xs font-semibold uppercase tracking-wide text-ink-500">Syarat aktivasi</h3>
            <ul class="mt-2 space-y-1 text-sm">${s.checklist.map((c) => `<li>${c.ok ? '✅' : '⬜'} ${esc(c.label)}</li>`).join('')}</ul>
          </div>
          ${q.length ? `<div><h3 class="text-xs font-semibold uppercase tracking-wide text-ink-500">Antrean & masa jaga</h3><ul class="mt-2 space-y-1 text-sm">${q.join('')}</ul></div>` : ''}
        </div>
        ${incidents.length ? `<div class="mt-4"><h3 class="text-xs font-semibold uppercase tracking-wide text-ink-500">Insiden terbuka</h3><ul class="mt-2 space-y-2 text-sm">${incidents.join('')}</ul></div>` : ''}
        ${s.lastTest ? `<p class="mt-3 text-xs text-ink-500">Pesan Uji terakhir: ${esc(s.lastTest.status === 'PASSED' ? 'lolos' : s.lastTest.status === 'RUNNING' ? 'berjalan' : 'gagal')} · ${esc(fmtTime(s.lastTest.at))}</p>` : ''}
        <div class="mt-5 flex flex-wrap gap-2">${actionsHtml(s)}</div>
      </div>`;
  }

  function actionsHtml(s: ShareState): string {
    const dis = busy || Boolean(pendingRequest(dash?.requests)) || Boolean(s.test) || !dash?.bot_online;
    const b: string[] = [];
    if (s.enabled) b.push(`<button type="button" data-share-action="deactivate" class="${BTN_SECONDARY}" ${dis ? 'disabled' : ''}>Nonaktifkan</button>`);
    else b.push(`<button type="button" data-share-action="activate" class="${BTN_PRIMARY}" ${dis || !s.feature ? 'disabled' : ''}>${icon('circle-check')} Aktifkan</button>`);
    if (s.hold?.reason === 'violations') b.push(`<button type="button" data-share-action="test" class="${BTN_PRIMARY}" ${dis ? 'disabled' : ''}>Kirim Pesan Uji</button>`);
    if (s.config?.inviteUrl) b.push(`<button type="button" data-share-action="recheck_invite" class="${BTN_SECONDARY}" ${dis ? 'disabled' : ''}>${icon('refresh-cw')} Cek Ulang Link</button>`);
    if (s.incidents.some((i) => !i.respondedAt)) b.push(`<button type="button" data-share-action="ack" class="${BTN_SECONDARY}" ${dis ? 'disabled' : ''}>Konfirmasi Alert</button>`);
    return b.join('');
  }

  function formHtml(s: ShareState, snapshot: Snapshot | null): string {
    const c = s.config;
    const max = s.rules.DESCRIPTION_MAX ?? 200;
    const desc = draft.description ?? c?.description ?? '';
    const mode = draft.inviteMode ?? (c?.inviteMethod === 'auto' ? 'auto' : 'manual');
    const dis = busy || Boolean(pendingRequest(dash?.requests)) || !dash?.bot_online;
    return `
      <form data-share-form class="${CARD} mt-6 space-y-5 p-5" novalidate>
        <h2 class="font-display text-lg font-semibold">Pengaturan</h2>
        <p class="text-sm text-ink-600 dark:text-cream-300">Channel wajib <strong>publik</strong> (@everyone bisa melihat). Bot memeriksa izin & keadaan channel di Discord sebelum menyimpan. Saat aktif, channel penerima baru harus lolos Pesan Uji.</p>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="block text-sm font-medium">Channel dashboard vote
            ${channelSelect('voteChannelId', snapshot, c?.voteChannelId, 'Pilih channel…')}
            <span class="mt-1 block text-xs font-normal text-ink-500">Panel vote di-pin bot untuk semua member.</span></label>
          <label class="block text-sm font-medium">Channel penerima promosi (wajib)
            ${channelSelect('promoChannelId', snapshot, c?.promoChannelId, 'Pilih channel…')}
            <span class="mt-1 block text-xs font-normal text-ink-500">Iklan server peserta lain masuk ke sini. Boleh sama dengan channel vote.</span></label>
          <label class="block text-sm font-medium">Kategori komunitas
            <select data-share-field="category" data-focus="share-category" class="${SELECT}">
              <option value="">Pilih kategori…</option>
              ${s.categories.map((k) => `<option value="${esc(k.key)}" ${(draft.category ?? c?.category) === k.key ? 'selected' : ''}>${esc(`${k.emoji} ${k.label}`)}</option>`).join('')}
            </select></label>
          <label class="block text-sm font-medium md:col-span-2">Deskripsi singkat
            <textarea data-share-field="description" data-focus="share-description" rows="3" maxlength="${max}" class="${SELECT}">${esc(desc)}</textarea>
            <span class="mt-1 block text-xs font-normal text-ink-500">${desc.length}/${max} karakter · tanpa tautan, mention, atau @everyone/@here.</span></label>
        </div>
        <fieldset class="space-y-2">
          <legend class="text-sm font-medium">Link undangan ${c?.inviteUrl ? `— sekarang ${esc(c.inviteUrl)} ${pill(c.inviteStatus === 'ACTIVE' ? 'Terverifikasi' : 'Perlu diperbarui', c.inviteStatus === 'ACTIVE' ? 'success' : 'warning')}` : ''}</legend>
          <label class="mr-4 text-sm"><input type="radio" name="inviteMode" value="manual" data-share-field="inviteMode" ${mode === 'manual' ? 'checked' : ''}/> Manual</label>
          <label class="text-sm"><input type="radio" name="inviteMode" value="auto" data-share-field="inviteMode" ${mode === 'auto' ? 'checked' : ''}/> Buat otomatis</label>
          ${mode === 'manual'
            ? `<input type="url" data-share-field="inviteUrl" data-focus="share-inviteUrl" placeholder="https://discord.gg/kodekamu" value="${esc(draft.inviteUrl ?? '')}" class="${SELECT}" />
               <span class="block text-xs text-ink-500">Hanya https://discord.gg/… atau https://discord.com/invite/…, permanen, mengarah ke server ini.</span>`
            : `${channelSelect('inviteAutoChannelId', snapshot, null, 'Channel tujuan undangan…')}
               <span class="block text-xs text-ink-500">Bot membuat undangan tanpa batas pakai & tanpa kedaluwarsa (butuh izin Create Invite).</span>`}
        </fieldset>
        <div class="flex justify-end"><button type="submit" class="${BTN_PRIMARY}" ${dis ? 'disabled' : ''}>${busy ? spinner() : ''} Simpan</button></div>
      </form>`;
  }

  function historyHtml(s: ShareState): string {
    const reqs = (dash?.requests ?? []).slice(0, 8).map((r) => `<li class="flex flex-wrap gap-2">
      ${pill(REQUEST_LABEL[r.type] ?? r.type, r.status === 'done' ? 'success' : r.status === 'error' ? 'danger' : 'info')}
      <span class="text-xs text-ink-500">${esc(fmtTime(r.created_at))}${r.actor_name ? ` · ${esc(r.actor_name)}` : ''}</span>
      ${r.result?.message || r.error ? `<span class="w-full text-xs text-ink-600 dark:text-cream-300">${esc((r.result?.message ?? r.error ?? '').replace(/\*\*/g, ''))}</span>` : ''}</li>`);
    const bc = s.broadcasts.map((b) => `<li>${esc(fmtTime(b.createdAt))} — ${b.sent} terkirim · ${b.failed + b.skipped + b.blocked} gagal/dilewati · ${b.removed} dihapus${b.pending ? ` · ${b.pending} antre` : ''}</li>`);
    const audit = s.audit.slice(0, 10).map((a) => `<li>${esc(fmtTime(a.at))} — ${esc(AUDIT_LABEL[a.action] ?? a.action)}${a.detail ? ` <span class="text-ink-500">(${esc(a.detail)})</span>` : ''}</li>`);
    const block = (title: string, items: string[], empty: string) => `<div><h3 class="text-xs font-semibold uppercase tracking-wide text-ink-500">${title}</h3>
      <ul class="mt-2 space-y-1 text-sm">${items.length ? items.join('') : `<li class="text-ink-500">${empty}</li>`}</ul></div>`;
    return `<div class="${CARD} mt-6 grid gap-5 p-5 md:grid-cols-2">
      ${block('Permintaan dari dashboard', reqs, 'Belum ada.')}
      ${block('Broadcast server ini', bc, 'Belum pernah tayang.')}
      ${block('Riwayat', audit, 'Belum ada.')}
    </div>`;
  }

  function html(snapshot: Snapshot | null): string {
    if (!dash && !error) {
      if (!loading) void load();
      return `<div class="py-10 text-center text-sm text-ink-500">${spinner()} Memuat Share Server…</div>`;
    }
    if (error && !dash) return `<div class="${CARD} p-6 text-sm">${esc(error)}</div>`;
    const s = st();
    const offline = !dash?.bot_online;
    const intro = `<p class="max-w-3xl text-sm text-ink-600 dark:text-cream-300">Promosikan server ini ke server peserta lain lewat broadcast global. Member vote Sambung Kata di Top.gg lewat panel vote → server naik antrean. Wajib timbal balik: server peserta juga menerima promosi, dan iklan yang diterima wajib bertahan 24 jam.</p>`;
    const warn = [
      offline ? 'Bot sedang offline — perubahan baru diproses saat bot kembali.' : null,
      dash && isStale(dash.updated_at) && dash.state ? 'Status dari bot belum diperbarui beberapa saat.' : null,
      s && !s.feature ? 'Share Server belum dibuka oleh Tim Sambung Kata. Pengaturan bisa disiapkan lebih dulu.' : null,
    ].filter(Boolean).map((w) => `<p class="mt-3 rounded-xl bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-300">${esc(w!)}</p>`).join('');
    if (!s) {
      return `${intro}${warn}<div class="${CARD} mt-6 p-6 text-sm">Server ini belum pernah mengatur Share Server. ${dash?.bot_online ? 'Isi pengaturan di bawah untuk memulai.' : ''}</div>
        ${emptyForm(snapshot)}`;
    }
    return `${intro}${warn}<div class="mt-6">${statusCard(s)}</div>${formHtml(s, snapshot)}${historyHtml(s)}`;
  }

  function emptyForm(snapshot: Snapshot | null): string {
    const blank: ShareState = {
      guildId, feature: true, configured: false, enabled: false, status: 'OFF', statusLabel: 'Nonaktif', receiving: false,
      botPresent: true, config: null, checklist: [], votes: 0, reductionMs: 0, cooldownEndsAt: 0, lastBroadcastAt: null,
      queue: null, hold: null, disabled: null, violations: { week: '', count: 0, quota: 5, resetAt: 0 }, recover: { used: 0, max: 3 },
      incidents: [], test: null, lastTest: null, rules: {}, categories: DEFAULT_CATEGORIES, broadcasts: [], received: [], history: [], audit: [],
    };
    return formHtml(blank, snapshot);
  }

  return {
    html,
    activate() {
      if (active) return;
      active = true;
      void load().then(schedule);
    },
    deactivate() {
      active = false;
      if (timer) clearTimeout(timer);
    },
    onClick(btn) {
      const a = btn.dataset.shareAction;
      if (!a) return false;
      if (a === 'deactivate' && !confirm('Nonaktifkan Share Server? Server ini berhenti menerima iklan & keluar dari antrean. Profil & link tetap tersimpan.')) return true;
      void send(a);
      return true;
    },
    onInput(el) {
      const f = el.dataset.shareField as keyof ShareDraft | undefined;
      if (!f) return false;
      const v = (el as HTMLInputElement).value;
      (draft as Record<string, string>)[f] = v;
      if (f === 'inviteMode') rerender();
      if (f === 'description') {
        const hint = el.parentElement?.querySelector('span');
        if (hint) hint.textContent = `${v.length}/${st()?.rules.DESCRIPTION_MAX ?? 200} karakter · tanpa tautan, mention, atau @everyone/@here.`;
      }
      return true;
    },
    onSubmit(form) {
      if (!form.matches('[data-share-form]')) return false;
      const { payload, errors } = buildSavePayload(draft, st()?.config ?? null, st()?.rules.DESCRIPTION_MAX ?? 200);
      if (errors.length) { toast(errors[0], 'danger'); return true; }
      if (!Object.keys(payload).length) { toast('Tidak ada yang berubah.', 'info'); return true; }
      void send('save', payload);
      return true;
    },
    flush() {
      if (deferred && !editing()) {
        deferred = false;
        rerender();
      }
    },
  };
}

const DEFAULT_CATEGORIES = [
  { key: 'gaming', label: 'Gaming', emoji: '🎮' },
  { key: 'anime', label: 'Anime & Manga', emoji: '🌸' },
  { key: 'musik', label: 'Musik', emoji: '🎵' },
  { key: 'nongkrong', label: 'Nongkrong / Chill', emoji: '☕' },
  { key: 'edukasi', label: 'Edukasi', emoji: '📚' },
  { key: 'kreatif', label: 'Kreatif & Seni', emoji: '🎨' },
  { key: 'teknologi', label: 'Teknologi', emoji: '💻' },
  { key: 'roleplay', label: 'Roleplay', emoji: '🎭' },
  { key: 'lainnya', label: 'Lainnya', emoji: '✨' },
];
