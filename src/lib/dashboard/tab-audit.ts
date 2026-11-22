// Halaman server › Riwayat (#audit-log). Dimuat malas oleh server-page.ts.
//
// Hemat sumber daya: Riwayat hanya diminta saat tab ini dibuka (20 baris per
// halaman, RPC guild_config_audit_list). Saring, cari, ekspor, dan "Kembalikan"
// bekerja pada baris yang SUDAH dimuat, tanpa permintaan tambahan.

import { auditList, auditState, auditV2Supported, DashboardError } from './api';
import { AUDIT_ACTION, describeError, formatAuditChange, formatWib, type AuditRow, type Tone } from './model';
import { AUDIT_KIND_LABEL, auditSourceLabel, auditToCsv, filterAudit, restoreState, revertChanges, revertible, type AuditKind } from './review-model';
import type { PageCtx } from './server-shared';
import { BTN_SECONDARY, CARD, esc, icon, loadingBlock, pill, toast } from './ui';

const PAGE = 20;
const INPUT = 'min-h-[44px] w-full rounded-xl border border-ink-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500 dark:border-cream-100/15 dark:bg-ink-800';

const INTRO = `<p class="max-w-3xl text-sm text-ink-600 dark:text-cream-300">Catatan setiap perubahan pengaturan server ini: siapa yang mengubah, dari mana (website, Discord, atau bot), apa saja yang berubah, dan apakah bot sudah menerapkannya.</p>`;

export interface AuditController {
  /** `version` berubah saat revisi atau percobaan sinkron berubah, lalu Riwayat dimuat ulang. */
  html(c: PageCtx, version: string): string;
  onClick(c: PageCtx, target: HTMLElement): boolean;
  onInput(c: PageCtx, target: HTMLElement): boolean;
  onChange(c: PageCtx, target: HTMLElement): boolean;
}

export function createAuditController(guildId: string, root: HTMLElement): AuditController {
  let rows: AuditRow[] | null = null;
  let loadedVersion: string | null = null;
  let done = false;
  let loading = false;
  let error = false;
  let kind: AuditKind = 'all';
  let query = '';
  let restoring = false;

  async function load(c: PageCtx, version: string, more = false): Promise<void> {
    if (loading) return;
    loading = true;
    try {
      const before = more && rows?.length ? rows[rows.length - 1].id : null;
      // Saringan jenis dijalankan di server bila database mendukung (migration 0030 bot).
      const page = await auditList(guildId, before, PAGE, kind === 'config' ? 'config.' : kind === 'sync' ? 'sync.' : null);
      rows = more && rows ? [...rows, ...page] : page;
      done = page.length < PAGE;
      error = false;
      loadedVersion = version;
    } catch (err) {
      // Gagal memuat halaman pertama: tampilkan error dan Coba lagi (bukan
      // "belum ada riwayat"). Gagal "muat lebih banyak": daftar lama tetap.
      if (!more || rows === null) error = true;
      toast(describeError(err instanceof DashboardError ? err.code : 'NETWORK'), 'danger');
    } finally {
      loading = false;
      c.render();
    }
  }

  function listHtml(c: PageCtx): string {
    const all = rows ?? [];
    const list = filterAudit(all, { kind, query }, c.text);
    if (!list.length) {
      return `<p class="mt-4 text-sm text-ink-500 dark:text-cream-300/70">Tidak ada riwayat yang cocok di ${all.length} catatan yang sudah dimuat.${done ? '' : ' Muat lebih banyak untuk mencari di catatan yang lebih lama.'}</p>`;
    }
    return `<ol class="mt-4 space-y-3">
      ${list
        .map((a) => {
          const items = Array.isArray(a.changed_fields) ? (a.changed_fields as unknown[]) : [];
          const tone: Tone = a.action === 'sync.failed' ? 'danger' : a.action === 'sync.applied' ? 'success' : 'info';
          return `<li class="${CARD} p-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="min-w-0 text-sm"><strong class="break-words">${esc(a.actor_name ?? a.actor_id)}</strong>
                <span class="text-ink-500 dark:text-cream-300/70">· ${esc(AUDIT_ACTION[a.action] ?? a.action)}</span></p>
              <div class="flex flex-wrap items-center gap-2">${pill(auditSourceLabel(a.source), 'neutral')}${pill(`Revisi ${a.revision}`, tone)}</div>
            </div>
            ${
              items.length
                ? `<ul class="mt-2 space-y-1 text-sm text-ink-700 dark:text-cream-200">${items
                    .slice(0, 20)
                    .map((ch) => `<li class="flex gap-2"><span class="text-ink-400" aria-hidden="true">•</span><span class="min-w-0 break-words">${esc(formatAuditChange(ch, c.text))}</span></li>`)
                    .join('')}</ul>${items.length > 20 ? `<p class="mt-1 text-xs text-ink-500 dark:text-cream-300/60">dan ${items.length - 20} perubahan lain.</p>` : ''}`
                : ''
            }
            <div class="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <p class="text-xs text-ink-500 dark:text-cream-300/60">${esc(formatWib(a.created_at))}</p>
              <div class="flex flex-wrap items-center gap-x-4">
              ${
                c.editable && a.has_state
                  ? `<button type="button" data-audit-restore="${a.id}" data-focus="audit-restore-${a.id}" ${c.saving || restoring ? 'disabled' : ''}
                      class="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-medium text-amber-700 hover:underline disabled:opacity-50 sm:min-h-0 dark:text-amber-300"
                      title="Memuat seluruh pengaturan seperti pada revisi ini ke draft. Belum disimpan sampai kamu menekan Simpan Perubahan.">${icon('refresh-cw', 'h-3.5 w-3.5')} Pulihkan ke revisi ini</button>`
                  : ''
              }
              ${
                c.editable && revertible(a)
                  ? `<button type="button" data-audit-revert="${a.id}" data-focus="audit-revert-${a.id}" ${c.saving ? 'disabled' : ''}
                      class="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-medium text-amber-700 hover:underline disabled:opacity-50 sm:min-h-0 dark:text-amber-300"
                      title="Memuat nilai sebelum perubahan ini ke draft. Belum disimpan sampai kamu menekan Simpan Perubahan.">${icon('history', 'h-3.5 w-3.5')} Kembalikan ke sebelum ini</button>`
                  : ''
              }
              </div>
            </div>
          </li>`;
        })
        .join('')}
    </ol>`;
  }

  function html(c: PageCtx, version: string): string {
    if (rows !== null && loadedVersion !== version && !loading && !error) {
      rows = null;
      done = false;
    }
    if (rows === null && error) {
      return `${INTRO}<div class="${CARD} mt-4 p-5 text-sm text-ink-600 dark:text-cream-300">Gagal memuat riwayat.
        <button type="button" data-audit-action="retry" class="ml-1 font-medium text-amber-700 underline dark:text-amber-300">Coba lagi</button></div>`;
    }
    if (rows === null) {
      if (!loading) void load(c, version);
      return loadingBlock('Memuat riwayat…');
    }
    if (!rows.length && kind === 'all') {
      return `${INTRO}<div class="${CARD} mt-4 p-5 text-sm text-ink-600 dark:text-cream-300">
        <p class="font-medium">Belum ada riwayat perubahan untuk server ini.</p>
        <p class="mt-1 text-ink-500 dark:text-cream-300/70">Catatan pertama muncul setelah ada pengaturan yang disimpan dari dashboard ini.</p></div>`;
    }
    return `${INTRO}
      <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label class="min-w-0 flex-1"><span class="sr-only">Cari di riwayat</span>
          <input type="search" data-audit-query data-focus="audit-query" value="${esc(query)}" placeholder="Cari nama, fitur, atau revisi" class="${INPUT}" /></label>
        <label class="sm:w-56"><span class="sr-only">Jenis catatan</span>
          <select data-audit-kind data-focus="audit-kind" class="${INPUT}">
            ${(Object.keys(AUDIT_KIND_LABEL) as AuditKind[]).map((k) => `<option value="${k}" ${k === kind ? 'selected' : ''}>${AUDIT_KIND_LABEL[k]}</option>`).join('')}
          </select></label>
        <button type="button" data-audit-action="export" class="${BTN_SECONDARY} min-h-[44px]" title="Unduh catatan yang tampil sebagai berkas CSV">Ekspor CSV</button>
      </div>
      <p class="mt-2 text-xs text-ink-500 dark:text-cream-300/60">Pencarian dan ekspor memakai ${rows.length} catatan yang sudah dimuat${done ? ' (semua catatan)' : ''}.${auditV2Supported() ? ' Isi revisi disimpan untuk 20 perubahan pengaturan terakhir.' : ''}</p>
      <div data-audit-list>${listHtml(c)}</div>
      ${done ? '' : `<div class="mt-4 text-center"><button type="button" data-audit-action="more" data-focus="audit-more" class="${BTN_SECONDARY} min-h-[44px]" ${loading ? 'disabled' : ''}>Muat lebih banyak</button></div>`}`;
  }

  /** Satu permintaan baca: isi pengaturan pada revisi itu, lalu dimuat ke draft. */
  async function restoreRevision(c: PageCtx, id: number): Promise<void> {
    restoring = true;
    c.render();
    try {
      const r = await auditState(guildId, id);
      if (!r?.state) {
        toast('Isi revisi ini sudah tidak disimpan. Hanya 20 perubahan pengaturan terakhir yang bisa dipulihkan utuh.', 'warning', 7000);
        return;
      }
      const res = restoreState(c.draft, r.state, c.data.registry);
      if (!res.applied) {
        toast(`Pengaturan sekarang sudah sama dengan revisi ${r.revision}.`, 'info', 6000);
        return;
      }
      restoring = false;
      c.replaceDraft(res.draft);
      toast(`Pengaturan revisi ${r.revision} dimuat ke draft (${res.applied} perubahan). Periksa lewat Tinjau, lalu tekan Simpan Perubahan.`, 'success', 7000);
    } catch (err) {
      toast(describeError(err instanceof DashboardError ? err.code : 'NETWORK'), 'danger');
    } finally {
      if (restoring) {
        restoring = false;
        c.render();
      }
    }
  }

  function download(c: PageCtx): void {
    const list = filterAudit(rows ?? [], { kind, query }, c.text);
    if (!list.length) return toast('Tidak ada catatan untuk diekspor.', 'info');
    // BOM supaya spreadsheet membaca UTF-8 dengan benar.
    const blob = new Blob(['﻿', auditToCsv(list, c.text)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `riwayat-dashboard-${guildId}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`${list.length} catatan diekspor.`, 'success');
  }

  return {
    html,
    onClick(c, target) {
      const revert = target.closest<HTMLButtonElement>('[data-audit-revert]');
      if (revert && !revert.disabled) {
        const row = rows?.find((r) => String(r.id) === revert.dataset.auditRevert);
        if (!row) return true;
        const r = revertChanges(c.draft, row.changed_fields, c.data.registry);
        if (!r.applied) {
          toast('Tidak ada yang perlu dikembalikan. Nilai di catatan ini sudah sama dengan pengaturan sekarang.', 'info', 6000);
          return true;
        }
        c.replaceDraft(r.draft);
        toast(`${r.applied} perubahan dimuat ke draft${r.skipped ? `, ${r.skipped} dilewati` : ''}. Periksa lewat Tinjau, lalu tekan Simpan Perubahan.`, 'success', 7000);
        return true;
      }
      const restore = target.closest<HTMLButtonElement>('[data-audit-restore]');
      if (restore && !restore.disabled) {
        void restoreRevision(c, Number(restore.dataset.auditRestore));
        return true;
      }
      const btn = target.closest<HTMLButtonElement>('[data-audit-action]');
      if (!btn || btn.disabled) return false;
      const action = btn.dataset.auditAction;
      if (action === 'more') void load(c, loadedVersion ?? '', true);
      else if (action === 'retry') {
        error = false;
        c.render();
      } else if (action === 'export') download(c);
      return true;
    },
    onInput(c, target) {
      const input = target.closest<HTMLInputElement>('[data-audit-query]');
      if (!input) return false;
      query = input.value;
      // Hanya daftar yang digambar ulang, jadi kursor di kotak cari tidak terganggu.
      const box = root.querySelector<HTMLElement>('[data-audit-list]');
      if (box) box.innerHTML = listHtml(c);
      return true;
    },
    onChange(c, target) {
      const sel = target.closest<HTMLSelectElement>('[data-audit-kind]');
      if (!sel) return false;
      kind = (sel.value in AUDIT_KIND_LABEL ? sel.value : 'all') as AuditKind;
      // Didukung server: muat ulang halaman pertama dengan saringan (satu permintaan).
      if (auditV2Supported()) {
        rows = null;
        done = false;
      }
      c.render();
      return true;
    },
  };
}
