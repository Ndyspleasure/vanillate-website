// ════════════════════════════════════════════════════════════════════════════
//  Portal Penulis Blog: tampilan /blog/masuk dan /blog/dashboard.
//  Semua teks dari pengguna lewat esc() sebelum masuk innerHTML.
//  Acuan: docs/BLOG-PENULIS.md.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from '../admin-ui';
import { BTN_PRIMARY, BTN_SECONDARY, CARD, loadingBlock, pill, toast } from '../dashboard/ui';
import { renderBlogMarkdown, slugify, wordCount } from './markdown';
import {
  currentSession, getWriterSupabase, isWriterConfigured, linkDiscord, signInGoogle, signOutWriter,
  uploadWriterImage, writerCall,
} from './writer-client';
import { previewBody, quickChecks, statusMeta, tagsFromText, tldrFromText } from './writer-model';

const INPUT =
  'w-full rounded-xl border border-ink-900/15 bg-cream-100/40 px-4 py-2.5 text-sm outline-none transition-colors focus:border-amber-500 dark:border-cream-100/15 dark:bg-ink-900/40';
const LABEL = 'mb-1.5 block text-sm font-medium';
const HINT = 'mt-1 text-xs text-ink-500 dark:text-cream-300/60';
const TOOL =
  'rounded-lg border border-ink-900/10 px-2.5 py-1 text-xs font-medium hover:bg-ink-900/5 dark:border-cream-100/10 dark:hover:bg-cream-100/5';

export interface PageOpts {
  root: HTMLElement;
  loginUrl: string;
  dashboardUrl: string;
  blogUrl: string;
}

function notConfigured(root: HTMLElement) {
  root.innerHTML = `<p class="${CARD} p-6 text-sm">Portal penulis belum dikonfigurasi. Coba lagi nanti.</p>`;
}

// ─── Masuk ──────────────────────────────────────────────────────────────────

export async function mountLogin(o: PageOpts): Promise<void> {
  if (!isWriterConfigured) return notConfigured(o.root);
  if (await currentSession()) { location.replace(o.dashboardUrl); return; }
  o.root.innerHTML = `
    <div class="mx-auto max-w-lg space-y-6">
      <header>
        <p class="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">Blog Vanillate</p>
        <h1 class="mt-2 font-display text-3xl font-semibold tracking-tightest">Jadi penulis Vanillate</h1>
        <p class="mt-3 text-sm leading-relaxed text-ink-600 dark:text-cream-200/80">
          Siapa saja boleh mendaftar dan menulis. Tulisanmu ditinjau tim Vanillate dulu sebelum tayang.
          Kalau perlu direvisi, kamu akan menerima email berisi alasannya dan bisa memperbaikinya.
        </p>
      </header>
      <div class="${CARD} space-y-4 p-6">
        <ol class="list-decimal space-y-1.5 pl-5 text-sm">
          <li>Masuk dengan akun Google (email dipakai untuk pemberitahuan).</li>
          <li>Lengkapi profil penulis.</li>
          <li>Tautkan akun Discord untuk verifikasi, lalu ajukan tulisanmu.</li>
        </ol>
        <button type="button" id="w-google" class="${BTN_PRIMARY} w-full justify-center">Masuk dengan Google</button>
        <p id="w-err" class="text-sm text-red-600 dark:text-red-400" role="alert"></p>
      </div>
      <p class="text-xs text-ink-500 dark:text-cream-300/60">
        Dengan masuk, kamu setuju tulisan yang disetujui tayang di blog Vanillate dengan namamu sebagai penulis.
        <a class="underline" href="${esc(o.blogUrl)}">Kembali ke blog</a>
      </p>
    </div>`;
  const err = o.root.querySelector<HTMLElement>('#w-err')!;
  o.root.querySelector('#w-google')!.addEventListener('click', async (e) => {
    const b = e.currentTarget as HTMLButtonElement;
    b.disabled = true;
    const msg = await signInGoogle(o.dashboardUrl);
    if (msg) { err.textContent = msg; b.disabled = false; }
  });
}

// ─── Dasbor ─────────────────────────────────────────────────────────────────

interface Me {
  email: string;
  writer: { displayName: string; slug: string; bio: string; links: string[]; status: string; discordUsername: string | null } | null;
  discord: { linked: boolean; username: string | null };
  isTeam: boolean;
  limits: { imageBytes: number; bodyImages: number };
}
interface Row { [k: string]: any }

export async function mountDashboard(o: PageOpts): Promise<void> {
  if (!isWriterConfigured) return notConfigured(o.root);
  const sb = getWriterSupabase()!;
  if (!(await currentSession())) { location.replace(o.loginUrl); return; }
  o.root.innerHTML = loadingBlock('Memuat dasbor penulis…');

  const meR = await writerCall<Me>('me');
  if (!meR.ok) {
    o.root.innerHTML = `<div class="${CARD} space-y-3 p-6 text-sm"><p role="alert">${esc(meR.error.message)}</p><button id="w-out" class="${BTN_SECONDARY}">Keluar</button></div>`;
    o.root.querySelector('#w-out')?.addEventListener('click', async () => { await signOutWriter(); location.replace(o.loginUrl); });
    return;
  }
  let me = meR.data;
  let categories: { id: string; title: string }[] = [];
  void writerCall<{ categories: { id: string; title: string }[] }>('meta').then((r) => { if (r.ok) categories = r.data.categories; });

  const out = async () => { await signOutWriter(); location.replace(o.loginUrl); };

  // ── Profil ────────────────────────────────────────────────────────────────
  function renderProfile() {
    const w = me.writer;
    o.root.innerHTML = `
      <div class="mx-auto max-w-xl space-y-5">
        <h1 class="font-display text-2xl font-semibold tracking-tightest">${w ? 'Profil penulis' : 'Lengkapi profil penulis'}</h1>
        <form id="w-prof" class="${CARD} space-y-4 p-6" novalidate>
          <div><label class="${LABEL}" for="p-name">Nama tampil</label>
            <input id="p-name" class="${INPUT}" maxlength="80" value="${esc(w?.displayName ?? '')}" required />
            <p class="${HINT}">Nama ini tampil sebagai penulis di setiap tulisanmu.</p></div>
          <div><label class="${LABEL}" for="p-slug">Slug profil</label>
            <input id="p-slug" class="${INPUT} font-mono" maxlength="40" value="${esc(w?.slug ?? '')}" placeholder="otomatis dari nama" />
            <p class="${HINT}">Alamat halaman profilmu: /blog/penulis/<em>slug</em>/. Huruf kecil, angka, tanda hubung.</p></div>
          <div><label class="${LABEL}" for="p-bio">Bio singkat</label>
            <textarea id="p-bio" rows="3" maxlength="500" class="${INPUT}">${esc(w?.bio ?? '')}</textarea></div>
          <div><label class="${LABEL}" for="p-links">Tautan profil (satu per baris, https://)</label>
            <textarea id="p-links" rows="3" class="${INPUT} font-mono">${esc((w?.links ?? []).join('\n'))}</textarea>
            <p class="${HINT}">Mis. LinkedIn atau X. Membantu Google mengenali penulis.</p></div>
          <p class="text-xs text-ink-500 dark:text-cream-300/60">Email: ${esc(me.email)}</p>
          <div class="flex flex-wrap items-center gap-3">
            <button class="${BTN_PRIMARY}" type="submit">Simpan profil</button>
            ${w ? `<button class="${BTN_SECONDARY}" type="button" id="p-back">Kembali</button>` : `<button class="${BTN_SECONDARY}" type="button" id="p-out">Keluar</button>`}
            <span id="p-msg" class="text-sm" role="status" aria-live="polite"></span>
          </div>
        </form>
      </div>`;
    const f = o.root.querySelector<HTMLFormElement>('#w-prof')!;
    o.root.querySelector('#p-back')?.addEventListener('click', () => void renderList());
    o.root.querySelector('#p-out')?.addEventListener('click', out);
    const val = (id: string) => (o.root.querySelector<HTMLInputElement>(id)!).value;
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = o.root.querySelector<HTMLElement>('#p-msg')!;
      msg.textContent = 'Menyimpan…';
      const r = await writerCall('saveProfile', {
        profile: { displayName: val('#p-name'), slug: val('#p-slug'), bio: val('#p-bio'), links: val('#p-links').split('\n') },
      });
      if (!r.ok) { msg.textContent = r.error.message; msg.className = 'text-sm text-red-600 dark:text-red-400'; return; }
      const again = await writerCall<Me>('me');
      if (again.ok) me = again.data;
      toast('Profil tersimpan.', 'success');
      void renderList();
    });
  }

  // ── Daftar tulisan ────────────────────────────────────────────────────────
  async function renderList() {
    if (!me.writer) return renderProfile();
    o.root.innerHTML = loadingBlock('Memuat tulisanmu…');
    const r = await writerCall<{ submissions: Row[]; log: Row[] }>('list');
    if (!r.ok) { o.root.innerHTML = `<p class="${CARD} p-6 text-sm" role="alert">${esc(r.error.message)}</p>`; return; }
    const { submissions, log } = r.data;
    const discord = me.discord.linked
      ? `<p class="text-sm">${pill('Discord tertaut', 'success')} <span class="ml-1 text-ink-500 dark:text-cream-300/60">${esc(me.discord.username ?? '')}</span></p>`
      : `<div class="rounded-xl bg-amber-500/10 p-4 text-sm ring-1 ring-inset ring-amber-500/25">
           <p class="font-medium">Tautkan Discord untuk mengajukan tulisan</p>
           <p class="mt-1 text-ink-600 dark:text-cream-200/80">Verifikasi satu kali. Kamu tetap bisa menulis dan menyimpan draf tanpa Discord.</p>
           <button id="w-discord" class="${BTN_SECONDARY} mt-3">Tautkan Discord</button>
           <p id="w-derr" class="mt-2 text-red-600 dark:text-red-400"></p></div>`;

    const kartu = submissions.map((s) => {
      const m = statusMeta(s.status);
      const alasan = s.status === 'ditolak' && s.reject_reason
        ? `<p class="mt-2 rounded-lg bg-red-500/10 p-3 text-sm"><strong>Alasan:</strong> ${esc(s.reject_reason)}</p>` : '';
      const aksi = [
        ['draf', 'ditolak'].includes(s.status) ? `<button data-edit="${esc(s.id)}" class="${BTN_SECONDARY}">${s.status === 'ditolak' ? 'Revisi' : 'Edit'}</button>` : '',
        s.status === 'menunggu' ? `<button data-withdraw="${esc(s.id)}" class="${BTN_SECONDARY}">Tarik pengajuan</button>` : '',
        s.status === 'terbit' && !s.revision_of ? `<button data-revise="${esc(s.id)}" class="${BTN_SECONDARY}">Buat revisi</button>` : '',
        s.status === 'terbit' && s.slug ? `<a class="${BTN_SECONDARY}" href="${esc(o.blogUrl)}${esc(s.slug)}/">Lihat</a>` : '',
        ['draf', 'ditolak'].includes(s.status) ? `<button data-del="${esc(s.id)}" class="${BTN_SECONDARY}">Hapus</button>` : '',
      ].join('');
      return `<article class="${CARD} p-5">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="font-medium">${esc(s.title || 'Tanpa judul')}</h3>
          ${pill(s.revision_of && s.status === 'draf' ? 'Revisi (draf)' : s.revision_of && s.status === 'menunggu' ? 'Revisi menunggu' : m.label, m.tone)}
        </div>
        <p class="mt-1 text-xs text-ink-500 dark:text-cream-300/60">${esc(m.hint)}</p>${alasan}
        <div class="mt-3 flex flex-wrap gap-2">${aksi}</div></article>`;
    }).join('') || `<p class="${CARD} p-6 text-sm text-ink-500">Belum ada tulisan. Mulai dengan tombol Tulis baru.</p>`;

    const riwayat = log.length
      ? `<ul class="divide-y divide-ink-900/5 dark:divide-cream-100/5">${log.map((l) => `
          <li class="py-2.5 text-sm"><span class="font-medium">${esc(l.title)}</span>
            ${pill(l.action === 'tolak' ? 'Ditolak' : l.action === 'setujui' ? 'Disetujui' : 'Diajukan', l.action === 'tolak' ? 'danger' : l.action === 'setujui' ? 'success' : 'neutral')}
            <span class="text-xs text-ink-500 dark:text-cream-300/60">${esc(new Date(l.at).toLocaleString('id-ID'))}</span>
            ${l.reason ? `<div class="mt-1 text-ink-600 dark:text-cream-200/80">Alasan: ${esc(l.reason)}</div>` : ''}</li>`).join('')}</ul>`
      : '<p class="text-sm text-ink-500">Belum ada riwayat.</p>';

    o.root.innerHTML = `
      <div class="mx-auto max-w-3xl space-y-8">
        <header class="flex flex-wrap items-start justify-between gap-4">
          <div><p class="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">Dasbor penulis</p>
            <h1 class="mt-1 font-display text-2xl font-semibold tracking-tightest">Halo, ${esc(me.writer!.displayName)}</h1>
            <p class="mt-1 text-xs text-ink-500 dark:text-cream-300/60">${me.isTeam ? 'Tim Vanillate: tulisanmu terbit langsung setelah diajukan. ' : ''}${esc(me.email)}</p></div>
          <div class="flex gap-2"><button id="w-prof-btn" class="${BTN_SECONDARY}">Profil</button><button id="w-out" class="${BTN_SECONDARY}">Keluar</button></div>
        </header>
        ${discord}
        <section class="space-y-4">
          <div class="flex items-center justify-between"><h2 class="font-display text-lg font-semibold tracking-tightest">Tulisanmu</h2>
            <button id="w-new" class="${BTN_PRIMARY}">Tulis baru</button></div>
          <div class="space-y-3">${kartu}</div>
        </section>
        <section class="space-y-3"><h2 class="font-display text-lg font-semibold tracking-tightest">Riwayat tinjauan</h2>
          <div class="${CARD} px-5 py-2">${riwayat}</div></section>
      </div>`;

    const q = <T extends Element>(s: string) => o.root.querySelector<T>(s);
    q('#w-out')!.addEventListener('click', out);
    q('#w-prof-btn')!.addEventListener('click', renderProfile);
    q('#w-new')!.addEventListener('click', () => void openEditor(null));
    q('#w-discord')?.addEventListener('click', async () => {
      const msg = await linkDiscord(o.dashboardUrl);
      if (msg) q<HTMLElement>('#w-derr')!.textContent = msg;
    });
    o.root.querySelectorAll<HTMLElement>('[data-edit]').forEach((b) => b.addEventListener('click', () => void openEditor(b.dataset.edit!)));
    o.root.querySelectorAll<HTMLElement>('[data-withdraw]').forEach((b) => b.addEventListener('click', async () => {
      const x = await writerCall('withdraw', { id: b.dataset.withdraw });
      toast(x.ok ? 'Pengajuan ditarik. Tulisan kembali jadi draf.' : x.error.message, x.ok ? 'success' : 'danger');
      void renderList();
    }));
    o.root.querySelectorAll<HTMLElement>('[data-revise]').forEach((b) => b.addEventListener('click', async () => {
      const x = await writerCall<{ id: string }>('revise', { id: b.dataset.revise });
      if (!x.ok) return toast(x.error.message, 'danger');
      void openEditor(x.data.id);
    }));
    o.root.querySelectorAll<HTMLElement>('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Hapus tulisan ini? Tindakan ini tidak bisa dibatalkan.')) return;
      const x = await writerCall('remove', { id: b.dataset.del });
      toast(x.ok ? 'Tulisan dihapus.' : x.error.message, x.ok ? 'success' : 'danger');
      void renderList();
    }));
  }

  // ── Editor ────────────────────────────────────────────────────────────────
  async function openEditor(id: string | null) {
    let row: Row = { title: '', slug: '', excerpt: '', tldr: [], body: '', categories: [], tags: [], main_image_path: null, main_image_alt: '', ai_image: false, status: 'draf' };
    let urls: Record<string, string> = {};
    if (id) {
      o.root.innerHTML = loadingBlock('Membuka tulisan…');
      const r = await writerCall<{ submission: Row; imageUrls: Record<string, string> }>('get', { id });
      if (!r.ok) { toast(r.error.message, 'danger'); return void renderList(); }
      row = r.data.submission;
      urls = r.data.imageUrls;
    }
    let curId: string | null = id;
    let mainPath: string | null = row.main_image_path ?? null;
    let dirty = false;
    let slugTouched = Boolean(row.slug);

    const cats = categories.length
      ? categories.map((c) => `<label class="flex items-center gap-2 text-sm"><input type="checkbox" name="cat" value="${esc(c.id)}" ${row.categories?.includes(c.id) ? 'checked' : ''} /> ${esc(c.title)}</label>`).join('')
      : '<p class="text-sm text-ink-500">Kategori belum tersedia.</p>';
    const alasan = row.status !== 'terbit' && row.reject_reason
      ? `<div class="rounded-xl bg-red-500/10 p-4 text-sm ring-1 ring-inset ring-red-500/25"><strong>Alasan penolakan sebelumnya:</strong> ${esc(row.reject_reason)}</div>` : '';

    o.root.innerHTML = `
      <div class="mx-auto max-w-4xl space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h1 class="font-display text-2xl font-semibold tracking-tightest">${row.revision_of ? 'Revisi tulisan' : id ? 'Edit tulisan' : 'Tulisan baru'}</h1>
          <button id="e-back" class="${BTN_SECONDARY}">Kembali</button>
        </div>
        ${alasan}
        <div class="rounded-xl bg-sky-500/10 p-4 text-sm ring-1 ring-inset ring-sky-500/25">
          <p class="font-medium">Tentang gambar</p>
          <p class="mt-1 text-ink-600 dark:text-cream-200/80">Kamu boleh membuat gambar dengan AI, dan boleh meminta AI membantu menulis alt text. Centang kotak "dibuat dengan AI" agar pembaca tahu. Alt text wajib diisi: satu kalimat singkat yang menjelaskan isi gambar. Gambar harus diunggah lewat editor (alamat gambar dari situs lain tidak diizinkan), maksimal 2 MB per gambar.</p>
        </div>
        <form id="e-form" class="space-y-5" novalidate>
          <div class="${CARD} space-y-4 p-5">
            <div><label class="${LABEL}" for="e-title">Judul</label><input id="e-title" class="${INPUT}" maxlength="120" value="${esc(row.title)}" /></div>
            <div><label class="${LABEL}" for="e-slug">Slug URL</label><input id="e-slug" class="${INPUT} font-mono" maxlength="80" value="${esc(row.slug ?? '')}" placeholder="otomatis dari judul" /></div>
            <div><label class="${LABEL}" for="e-excerpt">Ringkasan (dipakai Google dan kartu share)</label><textarea id="e-excerpt" rows="2" maxlength="300" class="${INPUT}">${esc(row.excerpt)}</textarea></div>
            <div><label class="${LABEL}" for="e-tldr">Poin penting (opsional, satu per baris, maks. 6)</label><textarea id="e-tldr" rows="3" class="${INPUT}">${esc((row.tldr ?? []).join('\n'))}</textarea></div>
            <div><span class="${LABEL}">Kategori</span><div class="grid gap-2 sm:grid-cols-2">${cats}</div></div>
            <div><label class="${LABEL}" for="e-tags">Tag (pisahkan koma)</label><input id="e-tags" class="${INPUT}" value="${esc((row.tags ?? []).join(', '))}" /></div>
          </div>
          <div class="${CARD} space-y-3 p-5">
            <span class="${LABEL}">Gambar utama</span>
            <div id="e-main" class="text-sm"></div>
            <input id="e-main-file" type="file" accept="image/png,image/jpeg,image/webp" class="text-sm" />
            <div><label class="${LABEL}" for="e-alt">Alt text gambar utama</label><input id="e-alt" class="${INPUT}" maxlength="200" value="${esc(row.main_image_alt)}" /></div>
            <label class="flex items-center gap-2 text-sm"><input id="e-ai" type="checkbox" ${row.ai_image ? 'checked' : ''} /> Gambar utama dibuat dengan AI</label>
          </div>
          <div class="${CARD} space-y-3 p-5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-sm font-medium">Isi tulisan (Markdown)</span>
              <span id="e-count" class="text-xs text-ink-500"></span></div>
            <div class="flex flex-wrap gap-1.5" id="e-tools">
              <button type="button" class="${TOOL}" data-md="## |">H2</button>
              <button type="button" class="${TOOL}" data-md="### |">H3</button>
              <button type="button" class="${TOOL}" data-wrap="**">Tebal</button>
              <button type="button" class="${TOOL}" data-wrap="*">Miring</button>
              <button type="button" class="${TOOL}" data-link="1">Tautan</button>
              <button type="button" class="${TOOL}" data-md="- |">Daftar</button>
              <button type="button" class="${TOOL}" data-md="> |">Kutipan</button>
              <button type="button" class="${TOOL}" data-img="1">Gambar</button>
              <button type="button" class="${TOOL}" data-prev="1">Pratinjau</button>
            </div>
            <input id="e-img-file" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" />
            <textarea id="e-body" rows="18" class="${INPUT} font-mono leading-relaxed">${esc(row.body)}</textarea>
            <div id="e-preview" class="hidden space-y-4 rounded-xl border border-ink-900/10 p-4 dark:border-cream-100/10"></div>
          </div>
          <ul id="e-hints" class="grid gap-1 text-xs sm:grid-cols-2"></ul>
          <div class="flex flex-wrap items-center gap-3">
            <button type="button" id="e-save" class="${BTN_SECONDARY}">Simpan draf</button>
            <button type="button" id="e-submit" class="${BTN_PRIMARY}">${me.isTeam ? 'Ajukan dan terbitkan' : 'Ajukan untuk ditinjau'}</button>
            <span id="e-msg" class="text-sm" role="status" aria-live="polite"></span>
          </div>
        </form>
      </div>`;

    const $ = <T extends HTMLElement>(s: string) => o.root.querySelector<T>(s)!;
    const body = $<HTMLTextAreaElement>('#e-body');
    const say = (t: string, bad = false) => { const m = $('#e-msg'); m.textContent = t; m.className = `text-sm ${bad ? 'text-red-600 dark:text-red-400' : ''}`; };

    const read = () => ({
      title: $<HTMLInputElement>('#e-title').value,
      slug: $<HTMLInputElement>('#e-slug').value,
      excerpt: $<HTMLTextAreaElement>('#e-excerpt').value,
      tldr: tldrFromText($<HTMLTextAreaElement>('#e-tldr').value),
      body: body.value,
      categories: [...o.root.querySelectorAll<HTMLInputElement>('input[name=cat]:checked')].map((c) => c.value),
      tags: tagsFromText($<HTMLInputElement>('#e-tags').value),
      mainImagePath: mainPath,
      mainImageAlt: $<HTMLInputElement>('#e-alt').value,
      aiImage: $<HTMLInputElement>('#e-ai').checked,
    });

    const refresh = () => {
      const d = read();
      $('#e-count').textContent = `${wordCount(d.body)} kata`;
      $('#e-hints').innerHTML = quickChecks(d).map((h) => `<li class="${h.ok ? 'text-teal-700 dark:text-teal-300' : 'text-ink-500 dark:text-cream-300/60'}">${h.ok ? '✓' : '○'} ${esc(h.text)}</li>`).join('');
      const m = $('#e-main');
      m.innerHTML = mainPath && urls[mainPath] ? `<img src="${esc(urls[mainPath])}" alt="" class="max-h-40 rounded-xl" />` : mainPath ? 'Gambar terunggah.' : '<span class="text-ink-500">Belum ada gambar utama.</span>';
      if (!$('#e-preview').classList.contains('hidden')) {
        $('#e-preview').innerHTML = renderBlogMarkdown(previewBody(d.body, urls)).html || '<p class="text-sm text-ink-500">Belum ada isi.</p>';
      }
    };
    refresh();

    o.root.querySelector('#e-form')!.addEventListener('input', (e) => {
      dirty = true;
      if ((e.target as HTMLElement).id === 'e-slug') slugTouched = true;
      if ((e.target as HTMLElement).id === 'e-title' && !slugTouched) $<HTMLInputElement>('#e-slug').value = slugify($<HTMLInputElement>('#e-title').value);
      refresh();
    });

    const insert = (before: string, after = '', block = false) => {
      const s = body.selectionStart, e = body.selectionEnd;
      const sel = body.value.slice(s, e);
      const pre = block && s > 0 && body.value[s - 1] !== '\n' ? '\n' : '';
      body.setRangeText(`${pre}${before}${sel}${after}`, s, e, 'end');
      body.focus(); dirty = true; refresh();
    };
    $('#e-tools').addEventListener('click', (ev) => {
      const b = (ev.target as HTMLElement).closest<HTMLElement>('button');
      if (!b) return;
      if (b.dataset.md) { const [a, z] = b.dataset.md.split('|'); insert(a, z ?? '', true); }
      else if (b.dataset.wrap) insert(b.dataset.wrap, b.dataset.wrap);
      else if (b.dataset.link) {
        const href = prompt('Alamat tautan (https://…)');
        if (href && /^https:\/\//.test(href)) insert('[', `](${href})`);
      } else if (b.dataset.img) $<HTMLInputElement>('#e-img-file').click();
      else if (b.dataset.prev) { $('#e-preview').classList.toggle('hidden'); refresh(); }
    });

    const upload = async (file: File | undefined) => {
      if (!file) return null;
      say('Mengunggah gambar…');
      const r = await uploadWriterImage(file);
      if (!r.ok) { say(r.error.message, true); return null; }
      if (r.data.url) urls[r.data.path] = r.data.url;
      say('');
      return r.data.path;
    };
    $<HTMLInputElement>('#e-main-file').addEventListener('change', async (e) => {
      const p = await upload((e.target as HTMLInputElement).files?.[0]);
      if (p) { mainPath = p; dirty = true; refresh(); }
    });
    $<HTMLInputElement>('#e-img-file').addEventListener('change', async (e) => {
      const inp = e.target as HTMLInputElement;
      const p = await upload(inp.files?.[0]);
      inp.value = '';
      if (!p) return;
      const alt = (prompt('Alt text gambar (satu kalimat yang menjelaskan isi gambar)') ?? '').replace(/[\[\]\n]/g, ' ').trim();
      if (!alt) { say('Alt text wajib diisi. Gambar tidak dimasukkan.', true); return; }
      insert(`\n\n![${alt}](blogimg:${p})\n\n`);
    });

    const save = async (): Promise<string | null> => {
      say('Menyimpan…');
      const r = await writerCall<{ id: string }>('save', { id: curId, data: read() });
      if (!r.ok) { say(r.error.message, true); return null; }
      curId = r.data.id; dirty = false;
      say('Draf tersimpan.');
      return curId;
    };
    $('#e-save').addEventListener('click', () => void save());
    body.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); void save(); } });

    $('#e-submit').addEventListener('click', async (ev) => {
      const btn = ev.currentTarget as HTMLButtonElement;
      btn.disabled = true;
      const sid = await save();
      if (sid) {
        say('Mengajukan…');
        const r = await writerCall<{ id: string; isTeam: boolean }>('submit', { id: sid });
        if (!r.ok) say(r.error.message, true);
        else if (r.data.isTeam) {
          const a = await sb.functions.invoke('blog-admin', { body: { action: 'approve', id: sid } });
          toast(a.error ? 'Diajukan, tetapi belum terbit. Setujui dari antrean di CMS.' : 'Tulisan diterbitkan. Situs sedang dibangun ulang.', a.error ? 'warning' : 'success');
          dirty = false; return void renderList();
        } else {
          toast('Tulisan diajukan. Kamu akan menerima email setelah ditinjau.', 'success');
          dirty = false; return void renderList();
        }
      }
      btn.disabled = false;
    });

    $('#e-back').addEventListener('click', () => {
      if (dirty && !confirm('Ada perubahan yang belum disimpan. Tetap keluar?')) return;
      dirty = false; void renderList();
    });
    window.onbeforeunload = () => (dirty ? 'Ada perubahan yang belum disimpan.' : null);
  }

  if (!me.writer) renderProfile(); else void renderList();
}
