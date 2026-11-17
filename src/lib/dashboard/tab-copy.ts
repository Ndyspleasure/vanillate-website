// Halaman server › Salin Pengaturan (#copy). Dimuat malas oleh server-page.ts.
//
// Hemat sumber daya: daftar server diminta sekali saat tab ini dibuka (Edge
// Function dashboard-discord, hasilnya di-cache server), dan pengaturan server
// sumber dibaca SATU kali saat tombol ditekan. Tidak ada yang ditulis: hasilnya
// masuk draft dan baru tersimpan bila admin menekan Simpan Perubahan.

import { DashboardError, fetchServers, getGuild, type ServerListItem } from './api';
import { describeError } from './model';
import { copyFromServer } from './review-model';
import type { PageCtx } from './server-shared';
import { BTN_PRIMARY, CARD, esc, loadingBlock, spinner, toast } from './ui';

export interface CopyController {
  html(c: PageCtx): string;
  onClick(c: PageCtx, target: HTMLElement): boolean;
  onChange(c: PageCtx, target: HTMLElement): boolean;
}

export function createCopyController(guildId: string): CopyController {
  let servers: ServerListItem[] | null = null;
  let loading = false;
  let error: string | null = null;
  let selected = '';
  let busy = false;

  async function load(c: PageCtx): Promise<void> {
    if (loading) return;
    loading = true;
    try {
      const res = await fetchServers(false);
      servers = res.servers.filter((s) => s.botInstalled && s.guildId !== guildId);
      error = null;
    } catch (err) {
      error = describeError(err instanceof DashboardError ? err.code : 'NETWORK');
    } finally {
      loading = false;
      c.render();
    }
  }

  async function copy(c: PageCtx): Promise<void> {
    if (busy || !selected) return;
    const name = servers?.find((s) => s.guildId === selected)?.name ?? 'server lain';
    busy = true;
    c.render();
    try {
      const source = await getGuild(selected);
      const r = copyFromServer(c.draft, source.state, c.data.registry);
      busy = false;
      if (!r.applied) {
        toast(`Tidak ada yang berbeda untuk disalin dari ${name}.`, 'info', 6000);
        c.render();
        return;
      }
      c.replaceDraft(r.draft);
      toast(`${r.applied} pengaturan dari ${name} dimuat ke draft${r.skipped ? `, ${r.skipped} pilihan channel atau role tidak disalin` : ''}. Periksa lewat Tinjau, lalu tekan Simpan Perubahan.`, 'success', 8000);
    } catch (err) {
      busy = false;
      toast(describeError(err instanceof DashboardError ? err.code : 'NETWORK'), 'danger');
      c.render();
    }
  }

  const INTRO = `<p class="max-w-3xl text-sm text-ink-600 dark:text-cream-300">Pakai pengaturan dari server lain yang kamu kelola sebagai titik awal. Yang disalin: fitur mana yang aktif, serta aturan dan teks pesan. Pilihan channel dan role tidak disalin karena hanya berlaku di server asalnya, jadi perlu kamu pilih ulang di sini.</p>`;

  return {
    html(c) {
      if (error && !servers) {
        return `${INTRO}<div class="${CARD} mt-4 p-5 text-sm text-ink-600 dark:text-cream-300">${esc(error)}
          <button type="button" data-copy-action="retry" class="ml-1 font-medium text-amber-700 underline dark:text-amber-300">Coba lagi</button></div>`;
      }
      if (!servers) {
        if (!loading) void load(c);
        return loadingBlock('Memuat daftar server…');
      }
      if (!servers.length) {
        return `${INTRO}<div class="${CARD} mt-4 p-5 text-sm text-ink-600 dark:text-cream-300">
          <p class="font-medium">Belum ada server lain untuk disalin.</p>
          <p class="mt-1 text-ink-500 dark:text-cream-300/70">Fitur ini muncul bila kamu mengelola server lain yang sudah memakai bot Vanillate.</p></div>`;
      }
      const dis = !c.editable || c.saving || busy;
      return `${INTRO}
        <div class="${CARD} mt-4 space-y-3 p-4 sm:p-5">
          <label class="block text-sm font-medium" for="copy-source">Salin dari server</label>
          <div class="flex flex-col gap-2 sm:flex-row">
            <select id="copy-source" data-copy-source data-focus="copy-source" ${dis ? 'disabled' : ''}
              class="min-h-[44px] w-full min-w-0 flex-1 rounded-xl border border-ink-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500 disabled:opacity-60 dark:border-cream-100/15 dark:bg-ink-800">
              <option value="">Pilih server</option>
              ${servers.map((s) => `<option value="${esc(s.guildId)}" ${s.guildId === selected ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
            </select>
            <button type="button" data-copy-action="copy" data-focus="copy-run" class="${BTN_PRIMARY}" ${dis || !selected ? 'disabled' : ''}>${busy ? spinner() : ''} Muat ke draft</button>
          </div>
          <p class="text-xs text-ink-500 dark:text-cream-300/60">Belum ada yang tersimpan saat tombol ditekan. Perubahan masuk ke draft server ini, bisa ditinjau, dibatalkan, atau disimpan seperti perubahan biasa.${c.editable ? '' : ' Bot belum terpasang di server ini, jadi pengaturan belum bisa diubah.'}</p>
        </div>`;
    },
    onClick(c, target) {
      const btn = target.closest<HTMLButtonElement>('[data-copy-action]');
      if (!btn || btn.disabled) return false;
      if (btn.dataset.copyAction === 'retry') {
        error = null;
        c.render();
      } else void copy(c);
      return true;
    },
    onChange(c, target) {
      const sel = target.closest<HTMLSelectElement>('[data-copy-source]');
      if (!sel) return false;
      selected = sel.value;
      c.render();
      return true;
    },
  };
}
