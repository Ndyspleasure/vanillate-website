// Tab kategori untuk halaman admin yang isinya banyak bagian (Kontrol Bot,
// Kontrol Server). Setiap bagian berupa elemen anak dengan atribut
// `data-tab` (id) dan `data-tab-label` (judul tab); hanya satu yang tampil.
// Bagian yang disembunyikan tetap ada di DOM, jadi form yang membungkusnya
// tetap menyimpan semua perubahan lintas tab.

/** Pilih id tab aktif dari hash URL ("#maintenance"); jatuh ke tab pertama. */
export function pilihTab(ids: string[], hash: string, awal?: string): string {
  const dariHash = decodeURIComponent((hash || '').replace(/^#/, ''));
  if (dariHash && ids.includes(dariHash)) return dariHash;
  if (awal && ids.includes(awal)) return awal;
  return ids[0] ?? '';
}

// ── Tab di sidebar ──────────────────────────────────────────────────────────
// Bila sidebar admin memuat sub-menu untuk tab halaman ini (`data-sidebar-tab`,
// dari src/lib/admin-menu.ts), bar tab di dalam halaman disembunyikan dan
// sidebar yang berganti tab lewat hash URL (#id). Tanpa sub-menu, bar tab
// tetap tampil seperti biasa.

const KELAS_AKTIF = ['bg-amber-500/10', 'text-amber-700', 'dark:text-amber-400', 'font-medium'];

function samaAlamat(a: HTMLAnchorElement): boolean {
  const rapikan = (p: string) => p.replace(/\/+$/, '') || '/';
  return rapikan(a.pathname) === rapikan(location.pathname);
}

/** Tautan sub-menu sidebar milik halaman yang sedang dibuka. */
export function tautanTabSidebar(): HTMLAnchorElement[] {
  return Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-sidebar-tab]')).filter(samaAlamat);
}

/** Sorot tab aktif di sidebar; sembunyikan tab yang tidak ada di halaman (mis. khusus owner). */
export function tandaiTabSidebar(ids: string[], aktif: string): void {
  for (const a of tautanTabSidebar()) {
    const id = a.dataset.sidebarTab!;
    const ada = ids.includes(id);
    (a.closest('li') ?? a).classList.toggle('hidden', !ada);
    const ini = ada && id === aktif;
    a.toggleAttribute('aria-current', ini);
    if (ini) a.setAttribute('aria-current', 'page');
    KELAS_AKTIF.forEach((k) => a.classList.toggle(k, ini));
  }
}

/** Halaman yang tab-nya dibentuk dari data: isi sub-menu sidebar setelah data tampil. */
function isiTabSidebarDinamis(panel: HTMLElement[]): void {
  const wadah = document.querySelector<HTMLElement>('[data-sidebar-tabs-dinamis]');
  const induk = document.querySelector<HTMLAnchorElement>('[data-sidebar-dinamis]');
  if (!wadah || !induk || !samaAlamat(induk)) return;
  wadah.innerHTML = panel.map((p) => `<li><a href="${esc(induk.pathname)}#${esc(encodeURIComponent(p.dataset.tab!))}" data-sidebar-tab="${esc(p.dataset.tab!)}"
    class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors text-ink-600 dark:text-cream-200/70 hover:bg-ink-900/5 dark:hover:bg-cream-100/5">${esc(p.dataset.tabLabel ?? p.dataset.tab!)}</a></li>`).join('');
}

let hashDipasang = false;
/** Klik sub-menu sidebar di halaman yang sama hanya mengganti hash: ikuti. */
function pasangHash(): void {
  if (hashDipasang) return;
  hashDipasang = true;
  window.addEventListener('hashchange', () => {
    const id = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (id) document.querySelector<HTMLElement>(`[data-tab-btn="${CSS.escape(id)}"]`)?.click();
  });
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Ubah anak-anak `wadah` ber-`data-tab` menjadi tab. Bar tab disisipkan tepat
 * sebelum `wadah`. Aman dipanggil ulang setelah isi wadah dirender ulang.
 */
export function pasangTab(wadah: HTMLElement, opsi: { hash?: boolean } = {}): void {
  const panel = Array.from(wadah.querySelectorAll<HTMLElement>(':scope > [data-tab]'));
  wadah.previousElementSibling?.matches('[data-tabbar]') && wadah.previousElementSibling.remove();
  if (panel.length < 2) { panel.forEach((p) => p.classList.remove('hidden')); return; }

  const ids = panel.map((p) => p.dataset.tab!);
  const nav = document.createElement('nav');
  nav.setAttribute('data-tabbar', '1');
  nav.setAttribute('aria-label', 'Kategori');
  nav.className = 'overflow-x-auto border-b border-ink-900/10 dark:border-cream-100/10 -mx-1 px-1';
  nav.innerHTML = `<ul class="flex gap-1 -mb-px" role="tablist">${panel.map((p) => `
    <li role="presentation">
      <button type="button" role="tab" data-tab-btn="${esc(p.dataset.tab!)}"
        class="inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors">
        ${esc(p.dataset.tabLabel ?? p.dataset.tab!)}
        ${p.dataset.tabBadge ? `<span class="rounded-full bg-ink-900/5 dark:bg-cream-100/10 px-2 py-0.5 text-xs text-ink-500 dark:text-cream-300/60">${esc(p.dataset.tabBadge)}</span>` : ''}
      </button>
    </li>`).join('')}</ul>`;
  wadah.before(nav);
  isiTabSidebarDinamis(panel);
  const disidebar = tautanTabSidebar().length > 0;
  if (disidebar) { nav.hidden = true; pasangHash(); }

  const tampil = (id: string, simpanHash: boolean) => {
    panel.forEach((p) => p.classList.toggle('hidden', p.dataset.tab !== id));
    nav.querySelectorAll<HTMLButtonElement>('[data-tab-btn]').forEach((b) => {
      const aktif = b.dataset.tabBtn === id;
      b.setAttribute('aria-selected', String(aktif));
      b.className = `inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
        aktif
          ? 'border-amber-500 text-amber-700 dark:text-amber-400'
          : 'border-transparent text-ink-600 dark:text-cream-200/70 hover:text-ink-900 dark:hover:text-cream-100'
      }`;
    });
    if (disidebar) tandaiTabSidebar(ids, id);
    if (simpanHash && opsi.hash !== false) history.replaceState(null, '', `#${encodeURIComponent(id)}`);
  };

  nav.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tab-btn]');
    if (b) tampil(b.dataset.tabBtn!, true);
  });
  tampil(pilihTab(ids, opsi.hash === false ? '' : location.hash), false);
}
