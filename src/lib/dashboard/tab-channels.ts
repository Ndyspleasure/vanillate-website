// Halaman server › Peta Channel (#channels). Dimuat malas oleh server-page.ts.
// Hanya membaca data yang sudah dimuat halaman (tanpa permintaan tambahan).

import { channelById, channelLabel, missingPermissions, permissionFix } from './model';
import { CHECK_LABEL, permissionLabel } from './issue-guide';
import { featureLabel, reinviteLinkHtml, tabOfFeature, type PageCtx } from './server-shared';
import { BTN_SECONDARY, CARD, esc, pill } from './ui';

export function panelHtml(c: PageCtx): string {
  const d = c.data;
  let problems = 0;
  let reinvite = false;
  let channelDenied = false;
  let stale = false;
  const rows = c.registry.flatMap((f) =>
    f.purposes.map((p) => {
      const s = c.base[f.key];
      const id = s.channels[p.key];
      const ch = channelById(d.snapshot, id);
      let status: string;
      if (!s.enabled) status = pill('Fitur nonaktif', 'neutral');
      else if (!id) {
        status = p.required ? pill('Belum diatur', 'danger') : pill('Semua channel', 'neutral');
        if (p.required) problems += 1;
      } else if (!d.snapshot?.refreshed_at) status = pill('Belum dicek', 'neutral');
      else if (!ch) {
        status = pill('Channel hilang', 'danger');
        problems += 1;
      } else {
        const missing = missingPermissions(ch, p);
        status = missing.length ? pill(`Izin kurang: ${missing.map(permissionLabel).join(', ')}`, 'warning') : pill('OK', 'success');
        if (missing.length) {
          problems += 1;
          const fix = permissionFix(d.snapshot, missing, c.text.invitePermissions ?? '0');
          if (fix === 'channel') channelDenied = true;
          else if (fix === 'stale') stale = true;
          else reinvite = true;
        }
      }
      // Satu struktur untuk semua lebar layar: kartu bertumpuk di HP, baris tabel di desktop.
      return `<li class="grid gap-x-4 gap-y-1.5 px-4 py-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.1fr)_auto] md:items-center sm:px-5">
        <span class="min-w-0 font-medium md:font-normal">${featureLabel(f)}</span>
        <span class="min-w-0 text-sm text-ink-600 dark:text-cream-300/80"><span class="md:hidden">Tujuan: </span>${esc(p.label)}</span>
        <span class="min-w-0 break-words font-mono text-xs">${id ? esc(channelLabel(c.text, id)) : 'Tidak diatur'}</span>
        <span class="min-w-0">${status}</span>
        <span class="md:text-right"><button type="button" data-tab="${tabOfFeature(f)}" data-focus="edit-${esc(f.key)}-${esc(p.key)}"
          class="inline-flex min-h-[44px] items-center text-sm font-medium text-amber-700 hover:underline md:min-h-0 md:text-xs dark:text-amber-300">Ubah</button></span>
      </li>`;
    }),
  );
  const summary = !rows.length
    ? ''
    : problems
      ? `${problems} dari ${rows.length} tujuan channel perlu diperiksa.`
      : `${rows.length} tujuan channel, tidak ada masalah yang terdeteksi.`;
  return `
    <p class="max-w-3xl text-sm text-ink-600 dark:text-cream-300">Peta lengkap channel yang dipakai setiap fitur bot di server ini, dicek dengan data Discord terakhir yang dikirim bot. Channel yang hilang atau izin bot yang kurang langsung kelihatan di sini. Ubah lewat Game Hub, Social Hub, atau submenu fiturnya di Server Hub.</p>
    ${summary ? `<p class="mt-2 text-xs text-ink-500 dark:text-cream-300/60">${esc(summary)}</p>` : ''}
    ${
      reinvite || channelDenied || stale
        ? `<div class="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-4 text-sm sm:p-5">
            <p class="font-medium text-amber-900 dark:text-amber-200">Cara memperbaiki izin bot</p>
            <ol class="mt-2 list-decimal space-y-1.5 pl-5 text-ink-700 dark:text-cream-200">
              ${reinvite ? `<li>Role bot belum punya sebagian izin. Undang ulang bot memakai tautan berizin lengkap, pilih server ini, lalu tekan Authorize (Otorisasi). Pengaturan bot yang sudah ada tidak hilang.</li>` : ''}
              ${channelDenied ? `<li>Bila role bot sudah punya izinnya tetapi channel menolak, buka channel itu di Discord, pilih Edit Channel › Permissions (Izin), tambahkan role bot, lalu beri centang hijau pada izin yang tertulis di kolom Status.</li>` : ''}
              ${stale ? `<li>Bot memegang izin Administrator, jadi izin yang tercatat kurang berarti data Discord sudah lama. Cukup tekan ${CHECK_LABEL}.</li>` : ''}
              <li>Kembali ke sini dan tekan ${CHECK_LABEL} supaya status di tabel ini diperbarui.</li>
            </ol>
            <div class="mt-3 flex flex-wrap gap-2">
              ${reinvite && c.inviteUrl ? reinviteLinkHtml(c, `${BTN_SECONDARY} min-h-[44px]`) : ''}
              <button type="button" data-action="discord-refresh" class="${BTN_SECONDARY} min-h-[44px]">${CHECK_LABEL}</button>
            </div>
          </div>`
        : ''
    }
    ${
      rows.length
        ? `<div class="${CARD} mt-4 overflow-hidden">
            <div class="hidden gap-x-4 border-b border-ink-900/10 px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-500 md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.1fr)_auto] dark:border-cream-100/10 dark:text-cream-300/60" aria-hidden="true">
              <span>Fitur</span><span>Tujuan</span><span>Channel</span><span>Status</span><span class="w-9"></span>
            </div>
            <ul class="divide-y divide-ink-900/5 dark:divide-cream-100/5">${rows.join('')}</ul>
          </div>`
        : `<div class="${CARD} mt-4 p-5 text-sm text-ink-600 dark:text-cream-300">Belum ada fitur yang memakai channel. Daftar ini terisi dari fitur yang diterbitkan bot.</div>`
    }`;
}
