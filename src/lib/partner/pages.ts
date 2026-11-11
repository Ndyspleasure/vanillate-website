// ════════════════════════════════════════════════════════════════════════════
//  Portal Partner: tampilan /partnership/masuk dan /partnership/dashboard.
//  Semua teks dari pengguna lewat esc() sebelum masuk innerHTML.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from '../admin-ui';
import { discordMarkdownHtml } from '../dev-panel/discord-md';
import { adPreviewHtml } from './render';
import { BTN_PRIMARY, BTN_SECONDARY, CARD, loadingBlock, pill, toast } from '../dashboard/ui';
import {
  changeCredentials, getPartnerSupabase, isPartnerConfigured, listOrderCampaigns, listOrders, loadProfile,
  signIn, signOut, submitOrder, type PartnerOrderRow, type PartnerProfile,
} from './api';
import {
  buildReportPreview, campaignStatusMeta, cleanButtons, MAX_BTN_LABEL, MAX_FOOTER, MAX_TITLE, campaignSummary, formatDateId, hasErrors, isRiwayatSaja, loginError, MAX_AD, MAX_NOTE, passwordProblem,
  statusMeta, todayWib, totalText, usernameProblem, validateOrder,
  type CampaignReport, type CatalogProduct, type OrderInput,
} from './model';

const INPUT =
  'w-full rounded-xl border border-ink-900/15 bg-cream-100/40 px-4 py-2.5 text-sm outline-none transition-colors focus:border-amber-500 dark:border-cream-100/15 dark:bg-ink-900/40';
const LABEL = 'mb-1.5 block text-sm font-medium';
const HINT = 'mt-1 text-xs text-ink-500 dark:text-cream-300/60';
const ERR = 'mt-1 text-xs text-red-600 dark:text-red-400';

export interface PageOpts {
  root: HTMLElement;
  whatsappUrl: string;
  loginUrl: string;
  dashboardUrl: string;
  partnershipUrl: string;
  products?: CatalogProduct[];
}

function notConfigured(root: HTMLElement): void {
  root.innerHTML = `<p class="${CARD} p-6 text-sm">Portal belum dikonfigurasi. Hubungi tim kami lewat WhatsApp official.</p>`;
}

function forgotBox(whatsappUrl: string): string {
  return `<div class="mt-6 rounded-xl bg-amber-500/10 p-4 text-sm ring-1 ring-inset ring-amber-500/25">
    Lupa username atau password? Silakan
    <a class="font-semibold text-amber-700 underline dark:text-amber-300" href="${esc(whatsappUrl)}" target="_blank" rel="noopener noreferrer">hubungi WhatsApp official kami</a>.
  </div>`;
}

// ═══ Halaman masuk ═════════════════════════════════════════════════════════

export async function mountLogin(o: PageOpts): Promise<void> {
  const { root } = o;
  if (!isPartnerConfigured) return notConfigured(root);
  root.innerHTML = loadingBlock('Memeriksa sesi…');

  const sudah = await loadProfile();
  if (sudah) {
    location.replace(o.dashboardUrl);
    return;
  }

  root.innerHTML = `
    <div class="mx-auto max-w-md">
      <div class="${CARD} p-6 sm:p-8">
        <h1 class="font-display text-2xl font-semibold tracking-tightest">Masuk Partner</h1>
        <p class="mt-2 text-sm text-ink-600 dark:text-cream-300/80">
          Khusus partner yang sudah terdaftar. Akun dibuat oleh tim kami setelah pesananmu dikonfirmasi lewat WhatsApp.
        </p>
        <form id="pl-form" class="mt-6 space-y-4" novalidate>
          <div>
            <label class="${LABEL}" for="pl-user">Username</label>
            <input id="pl-user" class="${INPUT}" autocomplete="username" autocapitalize="none" spellcheck="false" required />
          </div>
          <div>
            <label class="${LABEL}" for="pl-pass">Password</label>
            <input id="pl-pass" type="password" class="${INPUT}" autocomplete="current-password" required />
          </div>
          <p id="pl-err" class="${ERR} hidden" role="alert"></p>
          <button id="pl-submit" class="${BTN_PRIMARY} w-full" type="submit">Masuk</button>
        </form>
        ${forgotBox(o.whatsappUrl)}
        <p class="mt-6 text-center text-sm text-ink-500 dark:text-cream-300/60">
          Belum jadi partner? <a class="underline" href="${esc(o.partnershipUrl)}">Lihat paket Partnership</a>.
        </p>
      </div>
    </div>`;

  const form = root.querySelector<HTMLFormElement>('#pl-form')!;
  const err = root.querySelector<HTMLElement>('#pl-err')!;
  const btn = root.querySelector<HTMLButtonElement>('#pl-submit')!;
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const u = (root.querySelector<HTMLInputElement>('#pl-user')!).value;
    const p = (root.querySelector<HTMLInputElement>('#pl-pass')!).value;
    err.classList.add('hidden');
    if (!u.trim() || !p) {
      err.textContent = 'Isi username dan password.';
      err.classList.remove('hidden');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Memeriksa…';
    const r = await signIn(u, p);
    if (!r.ok) {
      err.textContent = loginError(r.error);
      err.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Masuk';
      return;
    }
    const profil = await loadProfile();
    if (!profil) {
      await signOut();
      err.textContent = 'Akun ini bukan akun partner.';
      err.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Masuk';
      return;
    }
    location.replace(o.dashboardUrl);
  });
}

// ═══ Dashboard ═════════════════════════════════════════════════════════════

function credentialsForm(profile: PartnerProfile, forced: boolean): string {
  return `<form id="pc-form" class="space-y-4" novalidate>
    ${forced
      ? `<div class="rounded-xl bg-amber-500/10 p-4 text-sm ring-1 ring-inset ring-amber-500/25">
           Demi keamanan, ganti <strong>username</strong> dan <strong>password</strong> bawaan dari tim kami sebelum memakai dashboard.
         </div>`
      : ''}
    <div>
      <label class="${LABEL}" for="pc-cur">Password saat ini</label>
      <input id="pc-cur" type="password" class="${INPUT}" autocomplete="current-password" required />
    </div>
    <div>
      <label class="${LABEL}" for="pc-user">Username baru</label>
      <input id="pc-user" class="${INPUT}" autocomplete="username" autocapitalize="none" spellcheck="false" value="${forced ? '' : esc(profile.username)}" required />
      <p class="${HINT}">Huruf kecil, angka, titik, garis bawah, atau strip. 3 sampai 32 karakter.</p>
    </div>
    <div>
      <label class="${LABEL}" for="pc-new">Password baru</label>
      <input id="pc-new" type="password" class="${INPUT}" autocomplete="new-password" required />
      <p class="${HINT}">Minimal 8 karakter, tidak hanya angka.</p>
    </div>
    <div>
      <label class="${LABEL}" for="pc-new2">Ulangi password baru</label>
      <input id="pc-new2" type="password" class="${INPUT}" autocomplete="new-password" required />
    </div>
    <p id="pc-err" class="${ERR} hidden" role="alert"></p>
    <button id="pc-submit" class="${BTN_PRIMARY}" type="submit">Simpan</button>
  </form>`;
}

function wireCredentials(root: HTMLElement, onDone: () => void): void {
  const form = root.querySelector<HTMLFormElement>('#pc-form');
  if (!form) return;
  const err = root.querySelector<HTMLElement>('#pc-err')!;
  const btn = root.querySelector<HTMLButtonElement>('#pc-submit')!;
  const show = (m: string) => { err.textContent = m; err.classList.remove('hidden'); };
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    err.classList.add('hidden');
    const cur = (root.querySelector<HTMLInputElement>('#pc-cur')!).value;
    const user = (root.querySelector<HTMLInputElement>('#pc-user')!).value.trim().toLowerCase();
    const pw = (root.querySelector<HTMLInputElement>('#pc-new')!).value;
    const pw2 = (root.querySelector<HTMLInputElement>('#pc-new2')!).value;
    if (!cur) return show('Isi password saat ini.');
    const up = usernameProblem(user);
    if (up) return show(up);
    const pp = passwordProblem(pw, user);
    if (pp) return show(pp);
    if (pw !== pw2) return show('Ulangi password baru dengan sama persis.');
    if (pw === cur) return show('Password baru harus berbeda dari yang lama.');
    btn.disabled = true;
    btn.textContent = 'Menyimpan…';
    const r = await changeCredentials({ currentPassword: cur, username: user, password: pw });
    btn.disabled = false;
    btn.textContent = 'Simpan';
    if (!r.ok) return show(r.error ?? 'Gagal menyimpan.');
    toast('Username dan password berhasil diganti.', 'success');
    onDone();
  });
}

function campaignBlock(o: PartnerOrderRow, list: CampaignReport[]): string {
  if (isRiwayatSaja(o.product_key)) {
    return `<p class="mt-3 text-xs text-ink-500 dark:text-cream-300/60">Paket Lobby dicatat sebagai riwayat pemesanan. Statusnya diperbarui oleh tim kami.</p>`;
  }
  if (list.length === 0) return '';
  return `<div class="mt-3 rounded-xl bg-ink-900/5 p-3 dark:bg-cream-100/5">
    <p class="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-cream-300/60">Laporan campaign</p>
    <ul class="mt-2 space-y-2 text-sm">
      ${list.map((c) => {
        const m = campaignStatusMeta(c.status);
        const waktu = c.completed_at ?? c.started_at ?? c.created_at;
        return `<li class="flex flex-wrap items-center justify-between gap-2">
          <span><span class="font-mono text-xs">${esc(c.broadcast_id)}</span> · ${esc(campaignSummary(c))}</span>
          <span class="flex items-center gap-2">${pill(m.label, m.tone)}<span class="text-xs text-ink-500 dark:text-cream-300/60">${esc(new Date(waktu).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }))}</span></span>
        </li>`;
      }).join('')}
    </ul>
  </div>`;
}

function orderCard(o: PartnerOrderRow, kampanye: CampaignReport[] = []): string {
  const m = statusMeta(o.status);
  const jadwal = o.scheduled_for ? `Tayang ${formatDateId(o.scheduled_for)}` : 'Tanggal tayang belum diatur';
  const dibuat = new Date(o.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  return `<article class="${CARD} p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-xs text-ink-500 dark:text-cream-300/60">Pesanan #${o.id} · ${esc(dibuat)}</p>
        <h3 class="mt-0.5 font-semibold">${esc(o.brand_name)}</h3>
      </div>
      ${pill(m.label, m.tone)}
    </div>
    <dl class="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
      <div><dt class="inline text-ink-500 dark:text-cream-300/60">Paket: </dt><dd class="inline">${esc(o.product_name)}</dd></div>
      <div><dt class="inline text-ink-500 dark:text-cream-300/60">Jumlah: </dt><dd class="inline">${o.quantity.toLocaleString('id-ID')}${o.unit ? ' ' + esc(o.unit.toLowerCase()) : ''}</dd></div>
      <div><dt class="inline text-ink-500 dark:text-cream-300/60">Harga satuan: </dt><dd class="inline">${esc(o.price_text)}</dd></div>
      <div><dt class="inline text-ink-500 dark:text-cream-300/60">Total: </dt><dd class="inline font-semibold">${esc(o.total_text)}</dd></div>
      <div class="sm:col-span-2"><dt class="inline text-ink-500 dark:text-cream-300/60">Jadwal: </dt><dd class="inline">${esc(jadwal)}</dd></div>
    </dl>
    <p class="mt-3 text-sm text-ink-600 dark:text-cream-300/80">${esc(m.hint)}${o.status_note ? ' Catatan tim: ' + esc(o.status_note) : ''}</p>
    ${campaignBlock(o, kampanye)}
    ${o.ad_text || o.ad_title || o.ad_footer || o.ad_image_url || (o.ad_buttons ?? []).length
      ? `<details class="mt-3"><summary class="cursor-pointer text-sm underline">Lihat iklan</summary>
      <div class="mt-2 rounded-lg bg-[#313338] p-3 text-sm text-[#dbdee1] break-words">${adPreviewHtml({ title: o.ad_title, text: o.ad_text, footer: o.ad_footer, imageUrl: o.ad_image_url, buttons: o.ad_buttons })}</div></details>` : ''}
  </article>`;
}

export async function mountDashboard(o: PageOpts): Promise<void> {
  const { root } = o;
  if (!isPartnerConfigured) return notConfigured(root);
  root.innerHTML = loadingBlock('Memuat dashboard…');

  const profile = await loadProfile();
  if (!profile) {
    location.replace(o.loginUrl);
    return;
  }
  const products = (o.products ?? []).filter((p) => p.key);

  const logout = async () => { await signOut(); location.replace(o.loginUrl); };

  if (profile.must_change_credentials) {
    root.innerHTML = `<div class="mx-auto max-w-md"><div class="${CARD} p-6 sm:p-8">
      <h1 class="font-display text-2xl font-semibold tracking-tightest">Halo, ${esc(profile.display_name)}</h1>
      <div class="mt-5">${credentialsForm(profile, true)}</div>
      <button id="p-out" type="button" class="mt-4 text-sm underline">Keluar</button>
    </div></div>`;
    wireCredentials(root, () => { void mountDashboard(o); });
    root.querySelector('#p-out')?.addEventListener('click', logout);
    return;
  }

  const hariIni = todayWib();
  root.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-xs uppercase tracking-wider text-ink-500 dark:text-cream-300/60">Dashboard Partner</p>
        <h1 class="font-display text-2xl font-semibold tracking-tightest">${esc(profile.display_name)}</h1>
        <p class="text-xs text-ink-500 dark:text-cream-300/60">Masuk sebagai ${esc(profile.username)}</p>
      </div>
      <div class="flex gap-2">
        <button id="p-akun" type="button" class="${BTN_SECONDARY}">Ganti username/password</button>
        <button id="p-out" type="button" class="${BTN_SECONDARY}">Keluar</button>
      </div>
    </div>

    <div class="mt-6 rounded-xl bg-sky-500/10 p-4 text-sm ring-1 ring-inset ring-sky-500/25">
      Form ini <strong>mencatat</strong> pesananmu supaya tim kami menyiapkan dan melaporkannya. Pemesanan dan pembayaran tetap lewat
      <a class="underline" href="${esc(o.whatsappUrl)}" target="_blank" rel="noopener noreferrer">WhatsApp official</a>.
    </div>

    <section id="p-akun-box" class="${CARD} mt-6 hidden max-w-md p-6">${credentialsForm(profile, false)}</section>

    <div class="mt-8 flex gap-2" role="tablist">
      <button id="tab-baru" role="tab" class="${BTN_PRIMARY}" type="button">Catat pesanan</button>
      <button id="tab-riwayat" role="tab" class="${BTN_SECONDARY}" type="button">Riwayat pesanan</button>
    </div>

    <section id="panel-baru" class="mt-6 grid gap-8 lg:grid-cols-2">
      <form id="po-form" class="space-y-4" novalidate>
        <div>
          <label class="${LABEL}" for="po-produk">Paket</label>
          <select id="po-produk" class="${INPUT}">
            ${products.length
              ? products.map((p) => `<option value="${esc(p.key)}">${esc(p.name)}</option>`).join('')
              : '<option value="">Paket belum tersedia</option>'}
          </select>
          <p id="po-harga" class="${HINT}"></p>
        </div>
        <div>
          <label class="${LABEL}" for="po-qty">Jumlah</label>
          <input id="po-qty" type="number" inputmode="numeric" step="1" class="${INPUT}" />
          <p id="po-total" class="${HINT}"></p>
          <p data-err="quantity" class="${ERR} hidden"></p>
        </div>
        <div>
          <label class="${LABEL}" for="po-brand">Nama server atau brand</label>
          <input id="po-brand" maxlength="80" class="${INPUT}" />
          <p data-err="brandName" class="${ERR} hidden"></p>
        </div>
        <div>
          <label class="${LABEL}" for="po-date">Tanggal tayang (opsional)</label>
          <input id="po-date" type="date" min="${hariIni}" class="${INPUT}" />
          <p data-err="scheduledFor" class="${ERR} hidden"></p>
        </div>
        <div>
          <label class="${LABEL}" for="po-url">Link undangan atau tujuan (opsional)</label>
          <input id="po-url" type="url" inputmode="url" placeholder="https://discord.gg/..." class="${INPUT}" />
          <p data-err="inviteUrl" class="${ERR} hidden"></p>
        </div>
        <fieldset class="space-y-4 rounded-2xl border border-ink-900/10 p-4 dark:border-cream-100/10">
          <legend class="px-2 text-sm font-semibold">Isi iklan (opsional)</legend>
          <div>
            <label class="${LABEL}" for="po-title">Judul iklan</label>
            <input id="po-title" maxlength="${MAX_TITLE}" class="${INPUT}" placeholder="mis. Open Recruitment Staff" />
            <p data-err="adTitle" class="${ERR} hidden"></p>
          </div>
          <div>
            <label class="${LABEL}" for="po-ad">Isi pesan</label>
            <textarea id="po-ad" rows="7" class="${INPUT} font-mono" placeholder="Tulis dengan format Discord: **tebal**, *miring*, ~~coret~~, > kutipan, [teks](https://...)"></textarea>
            <p class="${HINT}"><span id="po-ad-n">0</span>/${MAX_AD} karakter. Mendukung format Discord.</p>
            <p data-err="adText" class="${ERR} hidden"></p>
          </div>
          <div>
            <label class="${LABEL}" for="po-image">Gambar (link, opsional)</label>
            <input id="po-image" type="url" inputmode="url" placeholder="https://..." class="${INPUT}" />
            <p data-err="imageUrl" class="${ERR} hidden"></p>
          </div>
          <div>
            <label class="${LABEL}" for="po-footer">Footer</label>
            <input id="po-footer" maxlength="${MAX_FOOTER}" class="${INPUT}" placeholder="mis. Pendaftaran ditutup 30 November" />
            <p data-err="adFooter" class="${ERR} hidden"></p>
          </div>
          <div>
            <p class="${LABEL}">Tombol (maksimal 3)</p>
            ${[1, 2, 3].map((n) => `<div class="mb-2 grid gap-2 sm:grid-cols-2">
              <input data-btn-label="${n}" maxlength="${MAX_BTN_LABEL}" class="${INPUT}" placeholder="Nama tombol ${n}" aria-label="Nama tombol ${n}" />
              <input data-btn-url="${n}" type="url" inputmode="url" class="${INPUT}" placeholder="https://link-tombol-${n}" aria-label="Link tombol ${n}" />
            </div>`).join('')}
            <p class="${HINT}">Kosongkan baris yang tidak dipakai. Link harus https.</p>
            <p data-err="buttons" class="${ERR} hidden"></p>
          </div>
        </fieldset>
        <div>
          <label class="${LABEL}" for="po-note">Catatan untuk tim (opsional)</label>
          <textarea id="po-note" rows="3" class="${INPUT}"></textarea>
          <p class="${HINT}"><span id="po-note-n">0</span>/${MAX_NOTE} karakter.</p>
          <p data-err="note" class="${ERR} hidden"></p>
        </div>
        <p id="po-err" class="${ERR} hidden" role="alert"></p>
        <button id="po-submit" class="${BTN_PRIMARY}" type="submit">Catat pesanan</button>
      </form>

      <div class="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <div>
          <h2 class="mb-2 text-sm font-semibold">Pratinjau teks iklan</h2>
          <div id="pv-ad" class="min-h-[4rem] rounded-xl bg-[#313338] p-4 text-sm leading-relaxed text-[#dbdee1] break-words"></div>
          <p class="${HINT}">Tampilan perkiraan di Discord. Hasil akhir bisa sedikit berbeda.</p>
        </div>
        <div>
          <h2 class="mb-2 text-sm font-semibold">Pratinjau laporan ke tim</h2>
          <div id="pv-card" class="rounded-xl bg-[#2b2d31] p-4 text-sm text-[#dbdee1] border-l-4 border-amber-500"></div>
          <p class="${HINT}">Kartu seperti ini dikirim bot ke channel laporan tim kami setelah pesanan dicatat.</p>
        </div>
      </div>
    </section>

    <section id="panel-riwayat" class="mt-6 hidden">
      <div id="rw-list" class="space-y-4"></div>
      <div class="mt-4"><button id="rw-more" type="button" class="${BTN_SECONDARY} hidden">Muat lebih banyak</button></div>
    </section>`;

  root.querySelector('#p-out')?.addEventListener('click', logout);
  const akunBox = root.querySelector<HTMLElement>('#p-akun-box')!;
  root.querySelector('#p-akun')?.addEventListener('click', () => akunBox.classList.toggle('hidden'));
  wireCredentials(akunBox, () => { void mountDashboard(o); });

  // ── Tab ──
  const panelBaru = root.querySelector<HTMLElement>('#panel-baru')!;
  const panelRiwayat = root.querySelector<HTMLElement>('#panel-riwayat')!;
  const tabBaru = root.querySelector<HTMLElement>('#tab-baru')!;
  const tabRiwayat = root.querySelector<HTMLElement>('#tab-riwayat')!;
  const aktif = BTN_PRIMARY;
  const pasif = BTN_SECONDARY;
  const pilihTab = (nama: 'baru' | 'riwayat') => {
    panelBaru.classList.toggle('hidden', nama !== 'baru');
    panelRiwayat.classList.toggle('hidden', nama !== 'riwayat');
    tabBaru.className = nama === 'baru' ? aktif : pasif;
    tabRiwayat.className = nama === 'riwayat' ? aktif : pasif;
    if (nama === 'riwayat') void muatRiwayat(true);
  };
  tabBaru.addEventListener('click', () => pilihTab('baru'));
  tabRiwayat.addEventListener('click', () => pilihTab('riwayat'));

  // ── Form + pratinjau ──
  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>(id)!;
  const selProduk = $<HTMLSelectElement>('#po-produk');
  const inQty = $<HTMLInputElement>('#po-qty');
  const inBrand = $<HTMLInputElement>('#po-brand');
  const inDate = $<HTMLInputElement>('#po-date');
  const inUrl = $<HTMLInputElement>('#po-url');
  const inAd = $<HTMLTextAreaElement>('#po-ad');
  const inTitle = $<HTMLInputElement>('#po-title');
  const inFooter = $<HTMLInputElement>('#po-footer');
  const inImage = $<HTMLInputElement>('#po-image');
  const inNote = $<HTMLTextAreaElement>('#po-note');
  const produkAktif = (): CatalogProduct | null => products.find((p) => p.key === selProduk.value) ?? null;
  const baca = (): OrderInput => ({
    productKey: selProduk.value, quantity: inQty.value, brandName: inBrand.value,
    inviteUrl: inUrl.value, scheduledFor: inDate.value, adText: inAd.value, note: inNote.value,
    adTitle: inTitle.value, adFooter: inFooter.value, imageUrl: inImage.value,
    buttons: [1, 2, 3].map((n) => ({
      label: root.querySelector<HTMLInputElement>(`[data-btn-label="${n}"]`)!.value,
      url: root.querySelector<HTMLInputElement>(`[data-btn-url="${n}"]`)!.value,
    })),
  });

  const render = () => {
    const p = produkAktif();
    const input = baca();
    $('#po-ad-n').textContent = String(inAd.value.length);
    $('#po-note-n').textContent = String(inNote.value.length);
    const qty = Number(input.quantity);
    $('#po-harga').textContent = p
      ? `Harga satuan ${p.price === null ? 'belum ditentukan' : totalText(p.price, 1)}${p.priceUnit ? ' ' + p.priceUnit : ''}. Minimal ${p.minQuantity.toLocaleString('id-ID')} ${p.unit.toLowerCase()}.`
      : '';
    $('#po-total').textContent = p && Number.isInteger(qty) && qty > 0 ? `Perkiraan total ${totalText(p.price, qty)}` : '';
    $('#pv-ad').innerHTML = adPreviewHtml({
      title: input.adTitle, text: input.adText, footer: input.adFooter, imageUrl: input.imageUrl, buttons: input.buttons,
    });
    const pv = buildReportPreview({ partnerName: profile.display_name, product: p, input });
    $('#pv-card').innerHTML = `
      <p class="font-semibold text-white">${esc(pv.title)}</p>
      <dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
        ${pv.fields.map((f) => `<div><dt class="text-xs text-[#949ba4]">${esc(f.name)}</dt><dd>${esc(f.value)}</dd></div>`).join('')}
      </dl>
      ${pv.adTitle ? `<p class="mt-3 font-semibold text-white">${esc(pv.adTitle)}</p>` : ''}
      ${pv.ad ? `<blockquote class="mt-3 border-l-4 border-[#4e5058] pl-3 text-sm">${discordMarkdownHtml(pv.ad)}</blockquote>` : ''}
      ${pv.adFooter ? `<p class="mt-2 text-xs text-[#949ba4]">Footer iklan: ${esc(pv.adFooter)}</p>` : ''}
      ${pv.imageUrl ? `<p class="mt-2 text-xs text-[#949ba4]">Gambar: ${esc(pv.imageUrl)}</p>` : ''}
      ${pv.buttons.length ? `<p class="mt-2 text-xs text-[#949ba4]">Tombol</p><ul>${pv.buttons.map((b) => `<li>${esc(b.label)} <span class="text-xs text-[#949ba4]">${esc(b.url)}</span></li>`).join('')}</ul>` : ''}
      ${pv.note ? `<p class="mt-3 text-xs text-[#949ba4]">Catatan</p><p>${esc(pv.note)}</p>` : ''}
      ${pv.inviteUrl ? `<p class="mt-3"><span class="inline-block rounded bg-[#4e5058] px-3 py-1 text-xs text-white">Buka link</span> <span class="text-xs text-[#949ba4]">${esc(pv.inviteUrl)}</span></p>` : ''}
      <p class="mt-3 text-xs text-[#949ba4]">${esc(pv.footer)}</p>`;
  };

  const setMin = () => {
    const p = produkAktif();
    if (p) {
      inQty.min = String(p.minQuantity);
      if (!inQty.value || Number(inQty.value) < p.minQuantity) inQty.value = String(p.minQuantity);
    }
    render();
  };
  selProduk.addEventListener('change', setMin);
  [inQty, inBrand, inDate, inUrl, inAd, inNote, inTitle, inFooter, inImage].forEach((el) => el.addEventListener('input', render));
  root.querySelectorAll<HTMLInputElement>('[data-btn-label],[data-btn-url]').forEach((el) => el.addEventListener('input', render));
  setMin();

  const tampilGalat = (errors: Record<string, string>) => {
    root.querySelectorAll<HTMLElement>('[data-err]').forEach((el) => {
      const m = errors[el.dataset.err ?? ''];
      el.textContent = m ?? '';
      el.classList.toggle('hidden', !m);
    });
  };

  const formEl = $<HTMLFormElement>('#po-form');
  const poErr = $('#po-err');
  const poBtn = $<HTMLButtonElement>('#po-submit');
  formEl.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    poErr.classList.add('hidden');
    const input = baca();
    const errors = validateOrder(input, produkAktif());
    tampilGalat(errors as Record<string, string>);
    if (hasErrors(errors)) {
      poErr.textContent = 'Periksa isian yang bertanda merah.';
      poErr.classList.remove('hidden');
      return;
    }
    poBtn.disabled = true;
    poBtn.textContent = 'Menyimpan…';
    const r = await submitOrder({
      productKey: input.productKey, quantity: Number(input.quantity), brandName: input.brandName.trim(),
      inviteUrl: input.inviteUrl.trim(), scheduledFor: input.scheduledFor.trim(),
      adText: input.adText.trim(), note: input.note.trim(),
      adTitle: input.adTitle.trim(), adFooter: input.adFooter.trim(), imageUrl: input.imageUrl.trim(),
      buttons: cleanButtons(input.buttons),
    });
    poBtn.disabled = false;
    poBtn.textContent = 'Catat pesanan';
    if (!r.ok) {
      poErr.textContent = r.error ?? 'Gagal menyimpan pesanan.';
      poErr.classList.remove('hidden');
      return;
    }
    toast(`Pesanan #${r.id} tercatat dan dilaporkan ke tim.`, 'success');
    formEl.reset();
    setMin();
    pilihTab('riwayat');
  });

  // ── Riwayat ──
  const rwList = $('#rw-list');
  const rwMore = $<HTMLButtonElement>('#rw-more');
  let terakhirId: number | null = null;
  async function muatRiwayat(ulang: boolean): Promise<void> {
    if (ulang) { rwList.innerHTML = loadingBlock('Memuat riwayat…'); terakhirId = null; }
    try {
      const rows = await listOrders(terakhirId ?? undefined, 20);
      if (ulang) rwList.innerHTML = '';
      if (ulang && rows.length === 0) {
        rwList.innerHTML = `<p class="${CARD} p-6 text-sm">Belum ada pesanan tercatat.</p>`;
      }
      const laporan = await listOrderCampaigns(rows.filter((r) => !isRiwayatSaja(r.product_key)).map((r) => r.id));
      rwList.insertAdjacentHTML('beforeend', rows.map((r) => orderCard(r, laporan.filter((c) => c.order_id === r.id))).join(''));
      terakhirId = rows.length ? rows[rows.length - 1].id : terakhirId;
      rwMore.classList.toggle('hidden', rows.length < 20);
    } catch (e) {
      rwList.innerHTML = `<p class="${CARD} p-6 text-sm text-red-600">${esc((e as Error).message)}</p>`;
    }
  }
  rwMore.addEventListener('click', () => { void muatRiwayat(false); });

  // Sesi berakhir di tab lain / token dicabut → kembali ke halaman masuk.
  getPartnerSupabase()?.auth.onAuthStateChange((evt) => {
    if (evt === 'SIGNED_OUT') location.replace(o.loginUrl);
  });
}
