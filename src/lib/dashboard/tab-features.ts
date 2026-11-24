// Halaman server › tab fitur (Game Hub, Social Hub, dan submenu fitur Server Hub).
// Dimuat malas oleh server-page.ts saat salah satu tab itu dibuka.
//
// Kartu fitur, setelan bertipe (settings_schema), preview pesan, dan penangan
// isian. Semua mengubah DRAFT saja; tidak ada yang ditulis sebelum Simpan.

import {
  categoryLabel,
  channelById,
  channelLabel,
  channelOptions,
  featureLock,
  isNotUsed,
  isSnowflake,
  LOCK_FALLBACK_NOTE,
  missingPermissions,
  permissionFix,
  NOT_USED,
  parseSecuritySummary,
  relativeTime,
  roleLabel,
  roleOptions,
  settingValue,
  supportsNotUsed,
  typedSettings,
  guildIconUrl,
  type Feature,
  type GuideRow,
  type Purpose,
  type RewardRow,
  type SettingProp,
} from './model';
import { previewHtml, previewKind, type PreviewContext } from './message-preview';
import { featureIcon, featureIssues, reinviteLinkHtml, SECTION_OF_TAB, SPAN_LAST, type PageCtx, type Tab } from './server-shared';
import { CARD, esc, icon, pill } from './ui';

/** Isi tab fitur: pengantar bagian lalu kartu tiap fitur dari registry bot. */
export function panelHtml(c: PageCtx, tab: Tab): string {
    const section = SECTION_OF_TAB[tab]!;
    const feats = c.registry.filter((f) => f.section === section);
    // Pengantar bagian; sinopsis tiap fitur ada di kartunya (description registry bot).
    const intro =
      section === 'game'
        ? 'Kumpulan game yang bisa dimainkan member lewat /game. Matikan game yang tidak ingin dimainkan di server ini, atau kunci game ke satu channel khusus. Game tanpa channel khusus bisa dibuka di channel mana pun.'
        : section === 'verification'
          ? 'Syarat: bot butuh izin Manage Roles dan role bot harus berada di atas Verified Role. Jumlah langkah bisa diatur; batas lulus 80% benar ditetapkan sistem.'
          : section === 'leveling'
            ? 'Batas XP dan cooldown ditetapkan sistem Vanillate. Vote bot di Top.gg memberi +100% XP selama 12 jam (otomatis, semua server).'
            : section === 'autorole'
              ? 'Syarat: bot butuh izin Manage Roles dan role bot harus berada di atas role yang diberikan. Bila Verification aktif, role member diberikan setelah member lulus verifikasi. Verified Role tidak boleh dipakai di sini.'
              : section === 'welcome'
                ? 'Kosongkan channel untuk mematikan salah satu pesan: welcome saat member masuk, goodbye saat member keluar. Akun bot tidak disambut. Syarat: bot butuh izin mengirim pesan di channel yang dipilih.'
                : section === 'security'
                  ? 'Syarat: bot butuh izin View Audit Log di server, serta View Channel dan Send Messages di channel log. Pilih minimal satu role admin atau moderator. Kategori alasan dipilih lewat tombol tanpa input teks bebas, dan catatan hanya tersimpan di server ini.'
                  : 'Kegiatan harian yang bikin member rajin mampir ke server. Setiap fitur berjalan di channel khusus pilihanmu; fitur yang belum diberi channel tidak aktif, dan satu channel hanya untuk satu fitur sosial.';
    if (!feats.length) {
      return `<div class="${CARD} p-5 text-sm text-ink-600 dark:text-cream-300">
        <p class="font-medium">Belum ada fitur di bagian ini.</p>
        <p class="mt-1 text-ink-500 dark:text-cream-300/70">Daftar fitur diterbitkan bot. Bagian ini terisi otomatis setelah bot versi terbaru berjalan di server ini.</p>
      </div>`;
    }
    const summaryBlock = section === 'security' ? securitySummaryHtml(c) : '';
    return `
      <p class="max-w-3xl text-sm text-ink-600 dark:text-cream-300">${intro}</p>
      ${c.data.snapshot?.refreshed_at ? `<p class="mt-2 text-xs text-ink-500 dark:text-cream-300/60">Daftar channel dari Discord: ${esc(relativeTime(c.data.snapshot.refreshed_at))}.</p>` : ''}
      ${
        feats.length === 1
          ? `<div class="mt-4 sm:mt-5">${featureSectionHtml(c, feats[0])}</div>`
          : `<div class="${SPAN_LAST} mt-4 grid gap-3 sm:mt-5 sm:gap-4 lg:grid-cols-2">${feats.map((f) => featureCardHtml(c, f)).join('')}</div>`
      }${summaryBlock}`;
  }

  /** Ringkasan data lokal Security Center: hanya angka agregat dari bot, tanpa nama atau ID. */
  function securitySummaryHtml(c: PageCtx): string {
    const s = parseSecuritySummary(c.data.snapshot?.security_summary);
    if (!s) {
      return `<div class="${CARD} mt-4 p-4 sm:mt-5 sm:p-5">
        <h3 class="font-display text-base font-semibold">Ringkasan data server</h3>
        <p class="mt-1 text-sm text-ink-500 dark:text-cream-300/70">Belum ada ringkasan. Ringkasan muncul setelah Security Center diaktifkan dan bot menerbitkannya (kurang dari semenit). Tekan Refresh Discord Data bila belum muncul.</p>
      </div>`;
    }
    const tile = (label: string, value: number, hint = '') => `
      <div class="rounded-xl border border-ink-900/10 p-3 dark:border-cream-100/10">
        <p class="text-xs text-ink-500 dark:text-cream-300/60">${esc(label)}</p>
        <p class="mt-1 font-display text-xl font-semibold sm:text-2xl">${value}</p>
        ${hint ? `<p class="mt-0.5 text-xs text-ink-500 dark:text-cream-300/60">${esc(hint)}</p>` : ''}
      </div>`;
    const max = Math.max(1, ...s.by_reason.map((c) => c.count));
    const bars = s.by_reason.length
      ? s.by_reason.map((c) => `
        <li class="flex items-center gap-3 text-sm">
          <span class="w-40 shrink-0 truncate sm:w-52">${esc(c.label)}</span>
          <span class="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-ink-900/10 dark:bg-cream-100/10"><span class="block h-full rounded-full bg-amber-500" style="width:${Math.round((c.count / max) * 100)}%"></span></span>
          <span class="w-8 shrink-0 text-right tabular-nums">${c.count}</span>
        </li>`).join('')
      : `<li class="text-sm text-ink-500 dark:text-cream-300/70">Belum ada catatan dengan kategori alasan.</li>`;
    return `<div class="${CARD} mt-4 p-4 sm:mt-5 sm:p-5">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h3 class="font-display text-base font-semibold">Ringkasan data server</h3>
        <p class="text-xs text-ink-500 dark:text-cream-300/60">${s.updated_at ? `Diperbarui ${esc(relativeTime(s.updated_at))}` : ''}</p>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        ${tile('Kick aktif', s.kick_active)}
        ${tile('Ban aktif', s.ban_active)}
        ${tile('Menunggu kategori', s.pending, 'belum dipilih moderator')}
        ${tile('Alasan tidak jelas', s.not_provided, 'lewat 24 jam')}
        ${tile('Dicabut', s.revoked, 'dihapus dalam 7 hari')}
        ${tile('7 hari terakhir', s.last7_kick + s.last7_ban, `${s.last7_kick} kick dan ${s.last7_ban} ban`)}
      </div>
      <h4 class="mt-4 text-sm font-semibold">Kategori alasan (catatan aktif)</h4>
      <ul class="mt-2 grid gap-2">${bars}</ul>
      <p class="mt-4 text-xs text-ink-500 dark:text-cream-300/60">${s.last_at ? `Kejadian terakhir ${esc(relativeTime(s.last_at))}. ` : ''}Hanya angka gabungan untuk server ini. Tidak ada nama atau ID di halaman ini, dan catatan tidak dibagikan ke server lain. Catatan aktif disimpan maksimal 90 hari.</p>
    </div>`;
  }

  function selectHtml(c: PageCtx, f: Feature, p: Purpose): string {
    const d = c.data;
    const current = c.draft[f.key].channels[p.key] ?? '';
    const options = channelOptions(d.snapshot, p);
    const groups = new Map<string, typeof options>();
    for (const o of options) {
      const g = o.category ?? '';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(o);
    }
    const known = options.some((o) => o.id === current);
    const optHtml = (o: { id: string; name: string }) => `<option value="${esc(o.id)}" ${o.id === current ? 'selected' : ''}>#${esc(o.name)}</option>`;
    const missingCurrent = current && !known ? `<option value="${esc(current)}" selected>${esc(channelLabel(c.text, current))}</option>` : '';
    const empty = p.required ? 'Pilih channel' : p.empty_label ?? 'Tidak diatur';
    const disabled = !c.editable || c.saving;

    const ch = channelById(d.snapshot, current);
    const missing = ch ? missingPermissions(ch, p) : [];
    return `
      <label class="block">
        <span class="text-xs font-medium text-ink-600 dark:text-cream-300">${esc(p.label)}${p.required ? ' <span class="text-red-600">*</span>' : ''}</span>
        <select data-channel="${esc(f.key)}|${esc(p.key)}" data-focus="ch-${esc(f.key)}-${esc(p.key)}" ${disabled ? 'disabled' : ''}
          class="mt-1.5 min-h-[44px] w-full rounded-xl border border-ink-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500 disabled:opacity-60 dark:border-cream-100/15 dark:bg-ink-800">
          <option value="" ${current ? '' : 'selected'}>${esc(empty)}</option>
          ${missingCurrent}
          ${[...groups.entries()]
            .map(([g, list]) => (g ? `<optgroup label="${esc(g)}">${list.map(optHtml).join('')}</optgroup>` : list.map(optHtml).join('')))
            .join('')}
        </select>
      </label>
      ${p.help ? `<p class="mt-1.5 text-xs text-ink-500 dark:text-cream-300/60">${esc(p.help)}</p>` : ''}
      ${!d.snapshot?.refreshed_at ? `<p class="mt-1.5 text-xs text-amber-800 dark:text-amber-300">Daftar channel belum dimuat. Tekan Refresh Discord Data.</p>` : ''}
      ${missing.length ? `<p class="mt-1.5 text-xs text-amber-800 dark:text-amber-300">Izin bot kurang di #${esc(ch!.name)}: ${esc(missing.join(', '))}.${
        permissionFix(d.snapshot, missing, c.text.invitePermissions ?? '0') === 'channel'
          ? ' Role bot sudah punya izin itu, jadi ubah izin di Edit Channel › Permissions atau pilih channel lain.'
          : c.inviteUrl ? ` ${reinviteLinkHtml(c)}` : ''
      }</p>` : ''}`;
  }

  /** Centang "Tidak dipakai" untuk fitur sosial yang OFF. */
  function notUsedHtml(c: PageCtx, f: Feature, checked: boolean, disabled: boolean): string {
    return `
      <div>
        <label class="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input type="checkbox" class="h-4 w-4 rounded accent-amber-600" data-not-used="${esc(f.key)}" data-focus="nu-${esc(f.key)}"
            ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} />
          Tidak dipakai di server ini
        </label>
        <p class="mt-1 text-xs text-ink-500 dark:text-cream-300/60">Centang bila server ini sengaja tidak memakai fitur ini, supaya pengingat setup dari bot berhenti menanyakannya. Bisa diaktifkan kapan saja.</p>
      </div>`;
  }

  /** Kontrol setelan bertipe (settings_schema) per kelompok (`group`) untuk fitur aktif. */
  function settingsBlocks(c: PageCtx, f: Feature): { group?: string; text: boolean; html: string; props: SettingProp[] }[] {
    const props = typedSettings(f);
    if (!props.length) return [];
    const disabled = !c.editable || c.saving;
    const d = c.data;
    const s = c.draft[f.key];
    const cls = 'mt-1.5 min-h-[44px] w-full rounded-xl border border-ink-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500 disabled:opacity-60 dark:border-cream-100/15 dark:bg-ink-800';
    const field = (p: SettingProp): string => {
      const id = `${esc(f.key)}|${esc(p.key)}`;
      const base = `data-setting="${id}" data-type="${p.type}" data-focus="st-${esc(f.key)}-${esc(p.key)}" ${disabled ? 'disabled' : ''}`;
      const cur = settingValue(f, s, p.key);
      switch (p.type) {
        case 'integer':
          return `<input type="number" step="1" ${p.min != null ? `min="${p.min}"` : ''} ${p.max != null ? `max="${p.max}"` : ''} ${base} value="${cur ?? ''}" class="${cls}" />`;
        case 'string': {
          const long = (p.max_length ?? 0) > 120;
          const v = typeof s.settings[p.key] === 'string' ? (s.settings[p.key] as string) : '';
          return long
            ? `<textarea rows="4" ${p.max_length ? `maxlength="${p.max_length}"` : ''} ${p.placeholder ? `placeholder="${esc(p.placeholder)}"` : ''} ${base} class="${cls}">${esc(v)}</textarea>`
            : `<input type="text" ${p.max_length ? `maxlength="${p.max_length}"` : ''} ${p.placeholder ? `placeholder="${esc(p.placeholder)}"` : ''} ${base} value="${esc(v)}" class="${cls}" />`;
        }
        case 'boolean':
          return `<label class="inline-flex cursor-pointer items-center gap-2 text-sm font-medium"><input type="checkbox" class="h-4 w-4 shrink-0 rounded accent-amber-600" ${base} ${cur === true ? 'checked' : ''} /> ${esc(p.title)}</label>`;
        case 'enum':
          return `<select ${base} class="${cls}">${(p.values ?? []).map((v) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(p.labels?.[v] ?? v)}</option>`).join('')}</select>`;
        case 'role': {
          const roles = roleOptions(d.snapshot);
          const known = roles.some((r) => r.id === cur);
          return `<select ${base} class="${cls}">
            <option value="" ${cur ? '' : 'selected'}>Pilih role</option>
            ${cur && !known ? `<option value="${esc(String(cur))}" selected>${esc(roleLabel(c.text, String(cur)))}</option>` : ''}
            ${roles.map((r) => `<option value="${esc(r.id)}" ${r.id === cur ? 'selected' : ''}>@${esc(r.name)}${r.managed ? ' (integrasi)' : ''}</option>`).join('')}
          </select>`;
        }
        case 'role_list':
          return checkList(f, p, cur, roleOptions(d.snapshot).filter((r) => r.id !== c.guildId && r.name !== '@everyone').map((r) => ({ id: r.id, label: `@${r.name}` })), (id) => roleLabel(c.text, id), 'role');
        case 'reward_list': {
          const rows = (Array.isArray(s.settings[p.key]) ? s.settings[p.key] : []) as RewardRow[];
          const cats = Object.keys(p.limits ?? {});
          const roles = roleOptions(d.snapshot);
          const count = (c: string) => rows.filter((r) => r.category === c).length;
          const rowCls = 'min-h-[44px] rounded-xl border border-ink-900/15 bg-white px-2.5 py-2 text-sm outline-none focus:border-amber-500 disabled:opacity-60 dark:border-cream-100/15 dark:bg-ink-800';
          const rowHtml = rows
            .map((r, i) => `
              <div class="flex flex-wrap items-center gap-2" data-reward-row="${esc(f.key)}|${esc(p.key)}|${i}">
                <select data-reward-field="category" aria-label="Kategori" ${disabled ? 'disabled' : ''} class="${rowCls}">
                  ${cats.map((c) => `<option value="${esc(c)}" ${r.category === c ? 'selected' : ''}>${esc(categoryLabel(c))}</option>`).join('')}
                </select>
                <label class="inline-flex items-center gap-1.5 text-xs">Level
                  <input type="number" min="1" max="${p.max_level ?? 1000}" step="1" data-reward-field="level" ${disabled ? 'disabled' : ''}
                    value="${r.level ?? ''}" class="${rowCls} w-24" />
                </label>
                <select data-reward-field="role_id" aria-label="Role" ${disabled ? 'disabled' : ''} class="${rowCls} min-w-[10rem] flex-1">
                  <option value="" ${r.role_id ? '' : 'selected'}>Pilih role</option>
                  ${r.role_id && !roles.some((x) => x.id === r.role_id) ? `<option value="${esc(r.role_id)}" selected>${esc(roleLabel(c.text, r.role_id))}</option>` : ''}
                  ${roles.map((x) => `<option value="${esc(x.id)}" ${x.id === r.role_id ? 'selected' : ''}>@${esc(x.name)}${x.managed ? ' (integrasi)' : ''}</option>`).join('')}
                </select>
                <button type="button" data-reward-del="${esc(f.key)}|${esc(p.key)}|${i}" ${disabled ? 'disabled' : ''}
                  class="min-h-[44px] rounded-lg px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-950/30" aria-label="Hapus reward">Hapus</button>
              </div>`)
            .join('');
          const full = cats.every((c) => count(c) >= (p.limits?.[c] ?? 0));
          return `
            <div class="mt-1.5 space-y-2" data-focus="st-${esc(f.key)}-${esc(p.key)}">
              ${rowHtml || '<p class="text-xs text-ink-500 dark:text-cream-300/60">Belum ada reward.</p>'}
              <div class="flex flex-wrap items-center gap-3">
                <button type="button" data-reward-add="${esc(f.key)}|${esc(p.key)}" ${disabled || full ? 'disabled' : ''}
                  class="min-h-[44px] rounded-lg border border-ink-900/15 px-3 py-1.5 text-xs font-medium hover:bg-ink-900/5 disabled:opacity-50 dark:border-cream-100/15 dark:hover:bg-cream-100/5">+ Tambah reward</button>
                <span class="text-xs text-ink-500 dark:text-cream-300/60">${cats.map((c) => `${esc(categoryLabel(c))} ${count(c)}/${p.limits?.[c] ?? 0}`).join(' · ')}</span>
              </div>
            </div>`;
        }
        case 'color': {
          const v = typeof s.settings[p.key] === 'string' ? (s.settings[p.key] as string) : '';
          const ok = /^#[0-9a-fA-F]{6}$/.test(v);
          return `<div class="mt-1.5 flex items-center gap-2">
            <input type="color" aria-label="Pilih warna" ${base.replace(/data-focus="[^"]*"/, '')} value="${ok ? esc(v) : '#5865f2'}"
              class="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-ink-900/15 bg-white p-1 disabled:opacity-60 dark:border-cream-100/15 dark:bg-ink-800" />
            <input type="text" inputmode="text" maxlength="7" placeholder="${esc(p.placeholder ?? '#RRGGBB')} (kosong = bawaan)" ${base} value="${esc(v)}" class="${cls} !mt-0 font-mono" />
          </div>`;
        }
        case 'guide_list': {
          const rows = (Array.isArray(s.settings[p.key]) ? s.settings[p.key] : []) as GuideRow[];
          const chans = (d.snapshot?.channels ?? [])
            .filter((c) => c.type === 0 || c.type === 5 || c.type === 2)
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
          const rowCls = 'min-h-[44px] rounded-xl border border-ink-900/15 bg-white px-2.5 py-2 text-sm outline-none focus:border-amber-500 disabled:opacity-60 dark:border-cream-100/15 dark:bg-ink-800';
          const rowHtml = rows
            .map((r, i) => `
              <div class="flex flex-wrap items-center gap-2" data-guide-row="${esc(f.key)}|${esc(p.key)}|${i}">
                <select data-guide-field="channel_id" aria-label="Channel" ${disabled ? 'disabled' : ''} class="${rowCls} min-w-[9rem] flex-1">
                  <option value="" ${r.channel_id ? '' : 'selected'}>Pilih channel</option>
                  ${r.channel_id && !chans.some((c) => c.id === r.channel_id) ? `<option value="${esc(r.channel_id)}" selected>${esc(channelLabel(c.text, r.channel_id))}</option>` : ''}
                  ${chans.map((c) => `<option value="${esc(c.id)}" ${c.id === r.channel_id ? 'selected' : ''}>${c.type === 2 ? 'Voice: ' : '#'}${esc(c.name)}</option>`).join('')}
                </select>
                <input type="text" data-guide-field="text" aria-label="Keterangan" placeholder="Keterangan, mis. baca rules" ${p.max_text ? `maxlength="${p.max_text}"` : ''}
                  ${disabled ? 'disabled' : ''} value="${esc(r.text ?? '')}" class="${rowCls} min-w-[9rem] flex-[2]" />
                <button type="button" data-guide-del="${esc(f.key)}|${esc(p.key)}|${i}" ${disabled ? 'disabled' : ''}
                  class="min-h-[44px] rounded-lg px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-950/30" aria-label="Hapus baris">Hapus</button>
              </div>`)
            .join('');
          const full = p.max_items != null && rows.length >= p.max_items;
          return `
            <div class="mt-1.5 space-y-2" data-focus="st-${esc(f.key)}-${esc(p.key)}">
              ${rowHtml || '<p class="text-xs text-ink-500 dark:text-cream-300/60">Belum ada baris.</p>'}
              <div class="flex flex-wrap items-center gap-3">
                <button type="button" data-guide-add="${esc(f.key)}|${esc(p.key)}" ${disabled || full ? 'disabled' : ''}
                  class="min-h-[44px] rounded-lg border border-ink-900/15 px-3 py-1.5 text-xs font-medium hover:bg-ink-900/5 disabled:opacity-50 dark:border-cream-100/15 dark:hover:bg-cream-100/5">+ Tambah channel</button>
                <span class="text-xs text-ink-500 dark:text-cream-300/60">${rows.length}${p.max_items != null ? ` dari maksimal ${p.max_items}` : ''} baris</span>
              </div>
            </div>`;
        }
        case 'channel_list': {
          const opts = (d.snapshot?.channels ?? [])
            .filter((c) => c.type === 0 || c.type === 5 || c.type === 2 || c.type === 4)
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            .map((c) => ({ id: c.id, label: c.type === 4 ? `Kategori: ${c.name}` : c.type === 2 ? `Voice: ${c.name}` : `#${c.name}` }));
          return checkList(f, p, cur, opts, (id) => channelLabel(c.text, id), 'channel');
        }
        default:
          return '';
      }
    };
    /** Daftar centang untuk role_list/channel_list (pengganti select multiple). */
    const checkList = (
      f: Feature,
      p: SettingProp,
      cur: unknown,
      options: { id: string; label: string }[],
      missingLabel: (id: string) => string,
      noun: string,
    ): string => {
      const chosen = Array.isArray(cur) ? (cur as string[]) : [];
      const set = new Set(chosen);
      const known = new Set(options.map((o) => o.id));
      // Pilihan tersimpan yang sudah tidak ada di Discord tetap tampil agar bisa dilepas.
      const all = [...chosen.filter((id) => !known.has(id)).map((id) => ({ id, label: missingLabel(id) })), ...options];
      const full = p.max_items != null && chosen.length >= p.max_items;
      const key = `${f.key}|${p.key}`;
      const rows = all
        .map((o) => {
          const on = set.has(o.id);
          return `<label class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-ink-900/5 dark:hover:bg-cream-100/5 ${on ? 'font-medium' : ''}">
            <input type="checkbox" class="h-4 w-4 shrink-0 rounded accent-amber-600" data-list="${esc(key)}" value="${esc(o.id)}"
              data-focus="ls-${esc(f.key)}-${esc(p.key)}-${esc(o.id)}" ${on ? 'checked' : ''} ${disabled || (full && !on) ? 'disabled' : ''} />
            <span class="min-w-0 truncate">${esc(o.label)}</span>
          </label>`;
        })
        .join('');
      return `
        <div class="mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-ink-900/15 bg-white p-1 dark:border-cream-100/15 dark:bg-ink-800" data-scroll-keep="${esc(key)}">
          ${rows || `<p class="px-2 py-1.5 text-xs text-ink-500 dark:text-cream-300/60">Belum ada ${noun} yang bisa dipilih. Tekan Refresh Discord Data.</p>`}
        </div>
        <p class="mt-1 text-xs text-ink-500 dark:text-cream-300/60">${chosen.length} dipilih${p.max_items != null ? ` dari maksimal ${p.max_items}` : ''}.</p>`;
    };
    const hint = (p: SettingProp) => {
      const note = (t: string) => `<p class="mt-1 text-xs text-ink-500 dark:text-cream-300/60">${esc(t)}</p>`;
      const parts: string[] = [];
      if (p.help) parts.push(note(p.help));
      if (p.type === 'integer' && (p.min != null || p.max != null)) {
        parts.push(note(`Rentang ${p.min ?? '…'} sampai ${p.max ?? '…'}${p.default != null ? `, bawaan ${p.default}` : ''}.`));
      } else if (p.type === 'string' && p.max_length) {
        parts.push(note(`Maksimal ${p.max_length} karakter.${p.help?.includes('Kosongkan') ? '' : ' Kosongkan untuk teks bawaan.'}`));
      }
      return parts.join('');
    };
    const item = (p: SettingProp) =>
      p.type === 'boolean'
        ? `<div>${field(p)}${hint(p)}</div>`
        : `<div><span class="block text-xs font-medium text-ink-600 dark:text-cream-300">${esc(p.title)}${p.required ? ' <span class="text-red-600">*</span>' : ''}</span>${field(p)}${hint(p)}</div>`;
    // Setelan berurutan dengan `group` sama dikumpulkan di bawah satu judul.
    const blocks: { group?: string; items: SettingProp[] }[] = [];
    for (const p of props) {
      const last = blocks[blocks.length - 1];
      if (last && p.group && last.group === p.group) last.items.push(p);
      else blocks.push({ group: p.group, items: [p] });
    }
    return blocks.map((b) => ({
      group: b.group,
      // Kelompok yang isinya hanya teks (judul, isi pesan, tombol) = kategori "Pesan teks".
      text: b.items.some((p) => p.category === 'message') || b.items.every((p) => p.type === 'string'),
      html: b.items.map(item).join(''),
      props: b.items,
    }));
  }

  /** Setelan bertipe dalam satu kolom (fitur di daftar dua kolom, mis. Game/Social Hub). */
  function settingsHtml(c: PageCtx, f: Feature): string {
    return settingsBlocks(c, f)
      .map((b) =>
        b.group
          ? `<fieldset class="space-y-4 border-t border-ink-900/10 pt-4 dark:border-cream-100/10">
              <legend class="pr-2 text-sm font-semibold text-ink-900 dark:text-cream-50">${esc(b.group)}</legend>
              ${b.html}
            </fieldset>`
          : b.html,
      )
      .join('');
  }

  /** Preview kartu dari draft setelan (belum disimpan) untuk satu kelompok pesan. */
  function previewFor(c: PageCtx, f: Feature, props: SettingProp[]): string {
    const d = c.data;
    const ctxPreview: PreviewContext = {
      guildName: d.guild.name ?? `Server ${c.guildId}`,
      guildIconUrl: guildIconUrl(c.guildId, d.guild.icon),
      viewerName: d.viewer.name || 'Member',
      channelName: (id) => channelById(d.snapshot, id)?.name ?? null,
    };
    return previewHtml(props, c.draft[f.key]?.settings ?? {}, ctxPreview);
  }

  /**
   * Bagian dengan satu fitur besar (Verification, Leveling): kartu utama penuh,
   * lalu konfigurasi dan pesan teks dipisah per kategori, tiap kelompok satu kartu.
   */
  function featureSectionHtml(c: PageCtx, f: Feature): string {
    const s = c.draft[f.key];
    const blocks = s.enabled ? settingsBlocks(c, f) : [];
    const groupCard = (b: { group?: string; html: string; props: SettingProp[] }) => {
      const kind = previewKind(b.props);
      const head = `<h4 class="text-sm font-semibold text-ink-900 dark:text-cream-50">${esc(b.group ?? 'Umum')}</h4>`;
      if (!kind) {
        return `<section class="${CARD} min-w-0 space-y-4 p-4 sm:p-5">${head}${b.html}</section>`;
      }
      // Kelompok pesan: kolom isian di kiri, preview kartu menempel di kanan.
      return `<section class="${CARD} min-w-0 p-4 sm:p-5">
        ${head}
        <div class="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div class="min-w-0 space-y-4">${b.html}</div>
          <div class="min-w-0"><div class="lg:sticky lg:top-24" data-preview="${esc(f.key)}|${esc(kind)}">${previewFor(c, f, b.props)}</div></div>
        </div>
      </section>`;
    };
    const category = (title: string, hint: string, list: typeof blocks) =>
      list.length
        ? `<div class="mt-6">
            <h3 class="font-display text-base font-semibold">${title}</h3>
            <p class="mt-0.5 text-xs text-ink-500 dark:text-cream-300/60">${hint}</p>
            <div class="${list.some((b) => previewKind(b.props)) ? 'grid gap-3 sm:gap-4' : `${SPAN_LAST} grid gap-3 sm:gap-4 lg:grid-cols-2`} mt-3">${list.map(groupCard).join('')}</div>
          </div>`
        : '';
    return `${featureCardHtml(c, f, false)}
      ${category('Konfigurasi', 'Aturan, batas, dan role yang dipakai fitur ini.', blocks.filter((b) => !b.text))}
      ${category('Pesan teks', 'Teks yang dilihat member di Discord. Kosongkan kolom untuk memakai teks bawaan.', blocks.filter((b) => b.text))}`;
  }

  /** Kotak penjelasan untuk setelan yang dikunci bot, supaya admin tidak mengira itu bug. */
  function lockNoticeHtml(c: PageCtx, f: Feature): string {
    const lock = featureLock(f);
    if (!lock.items.length) return '';
    const box = 'rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200';
    if (lock.full) {
      const note = lock.items[0].note ?? LOCK_FALLBACK_NOTE;
      return `<div class="${box}" role="note">
        <p class="flex items-center gap-2 font-semibold">${icon('lock', 'h-4 w-4 shrink-0')} Belum tersedia</p>
        <p class="mt-1">${esc(note)}</p>
      </div>`;
    }
    return `<div class="${box}" role="note">
      <p class="flex items-center gap-2 font-semibold">${icon('lock', 'h-4 w-4 shrink-0')} Sebagian opsi belum tersedia</p>
      <ul class="mt-1 space-y-1.5">${lock.items.map((i) => `<li><span class="font-medium">${esc(i.title)}:</span> ${esc(i.note ?? LOCK_FALLBACK_NOTE)}</li>`).join('')}</ul>
    </div>`;
  }

  function featureCardHtml(c: PageCtx, f: Feature, withSettings = true): string {
    const s = c.draft[f.key];
    const lockFull = featureLock(f).full;
    const status = featureIssues(c, f);
    const notUsed = isNotUsed(s);
    const statusPill =
      lockFull && !s.enabled
        ? pill('Belum tersedia', 'neutral')
        : status.level === 'off'
        ? pill(notUsed ? 'Tidak dipakai' : 'Nonaktif', 'neutral')
        : status.level === 'error'
          ? pill('Perlu perhatian', 'danger')
          : status.level === 'warn'
            ? pill('Perlu perhatian', 'warning')
            : status.level === 'dirty'
              ? pill('Belum disimpan', 'warning')
              : pill('Valid', 'success');
    const savedChannels = f.purposes
      .map((p) => (s.channels[p.key] ? `${p.label}: ${channelLabel(c.text, s.channels[p.key])}` : ''))
      .filter(Boolean);
    const command = typeof f.meta?.command === 'string' ? f.meta.command : null;
    const disabled = !c.editable || c.saving;
    // Fitur yang seluruh setelannya terkunci tidak bisa dinyalakan (tidak akan berfungsi).
    const toggleOff = disabled || (lockFull && !s.enabled);

    return `
      <article class="${CARD} p-4 sm:p-5 ${s.enabled ? '' : 'opacity-90'}" aria-labelledby="feat-${esc(f.key)}">
        <div class="flex items-center justify-between gap-4">
          <div class="flex min-w-0 items-center gap-3">
            <span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">${icon(featureIcon(f), 'h-5 w-5')}</span>
            <div class="min-w-0">
              <h3 id="feat-${esc(f.key)}" class="font-display text-lg font-semibold leading-tight">${esc(f.name)}</h3>
              ${command ? `<p class="mt-0.5 font-mono text-xs text-ink-500 dark:text-cream-300/60">${esc(command)}</p>` : ''}
            </div>
          </div>
          <button type="button" role="switch" aria-checked="${s.enabled}" aria-label="${esc(f.name)}: ${s.enabled ? 'aktif' : 'nonaktif'}"
            data-toggle="${esc(f.key)}" data-focus="tg-${esc(f.key)}" ${toggleOff ? 'disabled' : ''} ${lockFull && !s.enabled ? 'title="Belum tersedia, lihat penjelasan di bawah"' : ''}
            class="group inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full text-xs font-semibold disabled:opacity-60">
            <span class="relative inline-flex h-6 w-11 items-center rounded-full transition ${s.enabled ? 'bg-emerald-500' : 'bg-ink-400/40 dark:bg-ink-600'}">
              <span class="inline-block h-5 w-5 rounded-full bg-white shadow transition ${s.enabled ? 'translate-x-5' : 'translate-x-0.5'}"></span>
            </span>
            <span class="w-7 text-left">${s.enabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
        ${f.description ? `<p class="mt-3 text-sm text-ink-600 dark:text-cream-300/80">${esc(f.description)}</p>` : ''}
        ${lockFull ? `<div class="mt-3">${lockNoticeHtml(c, f)}</div>` : ''}
        <div class="mt-4 space-y-4">
          ${
            s.enabled
              ? f.purposes.map((p) => `<div>${selectHtml(c, f, p)}</div>`).join('') + (withSettings ? settingsHtml(c, f) : '')
              : savedChannels.length
                ? `<p class="text-xs text-ink-500 dark:text-cream-300/60">Tersimpan: ${esc(savedChannels.join(' · '))}, dipakai lagi saat fitur diaktifkan.</p>`
                : ''
          }
          ${!s.enabled && supportsNotUsed(f) ? notUsedHtml(c, f, notUsed, disabled) : ''}
          ${lockFull ? '' : lockNoticeHtml(c, f)}
        </div>
        <div class="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-900/5 pt-4 dark:border-cream-100/5">
          <span class="text-xs text-ink-500 dark:text-cream-300/60">Status:</span> ${statusPill}
        </div>
        ${
          status.messages.length
            ? `<ul class="mt-3 space-y-1.5 text-xs ${status.level === 'error' ? 'text-red-700 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'}">
                ${status.messages.map((m) => `<li>${esc(m)}</li>`).join('')}
                ${status.reinvite && c.inviteUrl ? `<li>${reinviteLinkHtml(c, 'inline-flex min-h-[44px] items-center font-medium underline sm:min-h-0')}</li>` : ''}</ul>`
            : ''
        }
      </article>`;
  }

// ─── Penangan isian (dipanggil server-page.ts lewat delegasi event) ──────────

/** Klik di kartu fitur. Mengembalikan true bila ditangani. */
export function onClick(c: PageCtx, target: HTMLElement): boolean {
    const toggle = target.closest<HTMLButtonElement>('[data-toggle]');
    if (toggle && !toggle.disabled) {
      const key = toggle.dataset.toggle!;
      c.draft[key].enabled = !c.draft[key].enabled;
      // Diaktifkan = keputusan "Tidak dipakai" batal.
      if (c.draft[key].enabled && c.draft[key].settings[NOT_USED] === true) c.draft[key].settings[NOT_USED] = false;
      c.clearAttempt(key);
      c.render();
      return true;
    }

    const rwAdd = target.closest<HTMLButtonElement>('[data-reward-add]');
    if (rwAdd && !rwAdd.disabled) {
      const [fKey, pKey] = rwAdd.dataset.rewardAdd!.split('|');
      const prop = typedSettings(c.registry.find((x) => x.key === fKey)!).find((x) => x.key === pKey);
      if (!c.draft[fKey] || !prop) return true;
      const rows = (Array.isArray(c.draft[fKey].settings[pKey]) ? c.draft[fKey].settings[pKey] : []) as RewardRow[];
      const category = Object.keys(prop.limits ?? {}).find((c) => rows.filter((r) => r.category === c).length < (prop.limits?.[c] ?? 0));
      if (!category) return true;
      const used = rows.filter((r) => r.category === category).map((r) => Number(r.level) || 0);
      c.draft[fKey].settings[pKey] = [...rows, { category, level: (used.length ? Math.max(...used) : 0) + 5, role_id: '' }];
      c.clearAttempt(fKey);
      c.render();
      return true;
    }
    const rwDel = target.closest<HTMLButtonElement>('[data-reward-del]');
    if (rwDel && !rwDel.disabled) {
      const [fKey, pKey, idx] = rwDel.dataset.rewardDel!.split('|');
      const rows = (Array.isArray(c.draft[fKey]?.settings[pKey]) ? c.draft[fKey].settings[pKey] : []) as RewardRow[];
      const next = rows.filter((_, i) => i !== Number(idx));
      if (next.length) c.draft[fKey].settings[pKey] = next;
      else delete c.draft[fKey].settings[pKey];
      c.clearAttempt(fKey);
      c.render();
      return true;
    }

    const gAdd = target.closest<HTMLButtonElement>('[data-guide-add]');
    if (gAdd && !gAdd.disabled) {
      const [fKey, pKey] = gAdd.dataset.guideAdd!.split('|');
      const prop = typedSettings(c.registry.find((x) => x.key === fKey)!).find((x) => x.key === pKey);
      if (!c.draft[fKey] || !prop) return true;
      const rows = (Array.isArray(c.draft[fKey].settings[pKey]) ? c.draft[fKey].settings[pKey] : []) as GuideRow[];
      if (prop.max_items != null && rows.length >= prop.max_items) return true;
      c.draft[fKey].settings[pKey] = [...rows, { channel_id: '', text: '' }];
      c.clearAttempt(fKey);
      c.render();
      return true;
    }
    const gDel = target.closest<HTMLButtonElement>('[data-guide-del]');
    if (gDel && !gDel.disabled) {
      const [fKey, pKey, idx] = gDel.dataset.guideDel!.split('|');
      const rows = (Array.isArray(c.draft[fKey]?.settings[pKey]) ? c.draft[fKey].settings[pKey] : []) as GuideRow[];
      const next = rows.filter((_, i) => i !== Number(idx));
      if (next.length) c.draft[fKey].settings[pKey] = next;
      else delete c.draft[fKey].settings[pKey];
      c.clearAttempt(fKey);
      c.render();
      return true;
    }

    const notUsed = target.closest<HTMLInputElement>('input[data-not-used]');
    if (notUsed && !notUsed.disabled) {
      const key = notUsed.dataset.notUsed!;
      c.draft[key].settings[NOT_USED] = notUsed.checked;
      c.render();
      return true;
    }
    return false;
}

/** Preview kartu ikut berubah saat mengetik (draft diperbarui tanpa menggambar ulang halaman). */
export function onInput(c: PageCtx, target: HTMLElement): boolean {
    const el = target.closest<HTMLInputElement | HTMLTextAreaElement>('[data-setting]');
    if (!el || (el.dataset.type !== 'string' && el.dataset.type !== 'color')) return false;
    const [fKey, pKey] = el.dataset.setting!.split('|');
    if (!c.draft[fKey]) return true;
    if (el.value === '') delete c.draft[fKey].settings[pKey];
    else c.draft[fKey].settings[pKey] = el.value;
    const feat = c.registry.find((x) => x.key === fKey);
    const box = el.closest('section')?.querySelector<HTMLElement>('[data-preview]');
    if (!feat || !box) return true;
    const kind = box.dataset.preview!.split('|')[1];
    const props = typedSettings(feat).filter((p) => p.key.startsWith(`${kind}_`) || (kind === 'levelup' && p.key.startsWith('levelup')));
    box.innerHTML = previewFor(c, feat, props.length ? props : typedSettings(feat));
    return true;
}

/** Perubahan nilai isian. Mengembalikan true bila ditangani. */
export function onChange(c: PageCtx, target: HTMLElement): boolean {
    const rwField = target.closest<HTMLInputElement | HTMLSelectElement>('[data-reward-field]');
    if (rwField) {
      const rowEl = rwField.closest<HTMLElement>('[data-reward-row]');
      const [fKey, pKey, idx] = (rowEl?.dataset.rewardRow ?? '').split('|');
      const rows = (Array.isArray(c.draft[fKey]?.settings[pKey]) ? c.draft[fKey].settings[pKey] : []) as RewardRow[];
      const row = rows[Number(idx)];
      if (!row) return true;
      const field = rwField.dataset.rewardField;
      if (field === 'level') row.level = rwField.value.trim() === '' ? null : Number(rwField.value);
      else if (field === 'category') row.category = rwField.value;
      else if (field === 'role_id') row.role_id = rwField.value;
      c.clearAttempt(fKey);
      c.render();
      return true;
    }
    const gField = target.closest<HTMLInputElement | HTMLSelectElement>('[data-guide-field]');
    if (gField) {
      const rowEl = gField.closest<HTMLElement>('[data-guide-row]');
      const [fKey, pKey, idx] = (rowEl?.dataset.guideRow ?? '').split('|');
      const rows = (Array.isArray(c.draft[fKey]?.settings[pKey]) ? c.draft[fKey].settings[pKey] : []) as GuideRow[];
      const row = rows[Number(idx)];
      if (!row) return true;
      if (gField.dataset.guideField === 'text') row.text = gField.value;
      else row.channel_id = gField.value;
      c.clearAttempt(fKey);
      c.render();
      return true;
    }
    const listBox = target.closest<HTMLInputElement>('input[data-list]');
    if (listBox) {
      const [fKey, pKey] = listBox.dataset.list!.split('|');
      if (!c.draft[fKey]) return true;
      const st = c.draft[fKey].settings;
      const cur = Array.isArray(st[pKey]) ? (st[pKey] as string[]) : [];
      const next = cur.filter((id) => id !== listBox.value);
      if (listBox.checked) next.push(listBox.value);
      if (next.length) st[pKey] = next;
      else delete st[pKey];
      c.clearAttempt(fKey);
      c.render();
      return true;
    }
    const setting = target.closest<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-setting]');
    if (setting) {
      const [fKey, pKey] = setting.dataset.setting!.split('|');
      if (!c.draft[fKey]) return true;
      const t = setting.dataset.type;
      const st = c.draft[fKey].settings;
      if (t === 'boolean') st[pKey] = (setting as HTMLInputElement).checked;
      else if (t === 'integer') {
        if (setting.value.trim() === '') delete st[pKey];
        else st[pKey] = Number(setting.value);
      } else if (setting.value === '') delete st[pKey];
      else st[pKey] = setting.value;
      c.clearAttempt(fKey);
      c.render();
      return true;
    }
    const sel = target.closest<HTMLSelectElement>('select[data-channel]');
    if (!sel) return false;
    const [key, purpose] = sel.dataset.channel!.split('|');
    if (!c.draft[key]) return true;
    if (isSnowflake(sel.value)) c.draft[key].channels[purpose] = sel.value;
    else delete c.draft[key].channels[purpose];
    c.clearAttempt(key);
    c.render();
    return true;
}
