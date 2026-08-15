// Grafik tren sederhana untuk halaman statistik admin.
//
// Sengaja satu seri saja per grafik. Dua ukuran dengan skala berbeda TIDAK
// pernah ditumpuk di satu sumbu ganda — itu bikin salah baca. Kalau perlu
// membandingkan dua metrik, tampilkan dua grafik terpisah.
//
// Warna garis memakai token brand yang sudah dicek kontrasnya terhadap
// permukaan terang maupun gelap: amber-700 (#9E7418) di mode terang dan
// amber-500 (#E8B84A) di mode gelap, diterapkan lewat `currentColor`.

import { esc } from './admin-ui';

export interface TitikData {
  /** Waktu dalam milidetik epoch. */
  t: number;
  v: number;
}

const L = 52;   // ruang kiri untuk label sumbu Y
const R = 16;
const A = 16;   // atas
const B = 28;   // bawah untuk label waktu
const W = 800;
const H = 260;

/** Angka "bulat" terdekat untuk batas atas sumbu, supaya labelnya enak dibaca. */
function batasAtas(max: number): number {
  if (max <= 0) return 1;
  const pangkat = Math.pow(10, Math.floor(Math.log10(max)));
  return Math.ceil(max / (pangkat / 2)) * (pangkat / 2);
}

function fmtSingkat(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'jt';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1).replace('.0', '') + 'rb';
  return new Intl.NumberFormat('id-ID').format(n);
}

function fmtTanggal(ms: number): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta',
  }).format(new Date(ms));
}

function fmtWaktuPenuh(ms: number): string {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta',
  }).format(new Date(ms)) + ' WIB';
}

/**
 * Gambar grafik garis ke dalam `wadah`.
 * `label` dipakai di tooltip dan pembacaan screen reader.
 */
export function gambarGrafik(wadah: HTMLElement, titik: TitikData[], label: string): void {
  if (titik.length === 0) {
    wadah.innerHTML = `<p class="py-16 text-center text-sm text-ink-500 dark:text-cream-300/60">Belum ada data untuk ditampilkan.</p>`;
    return;
  }

  // Satu titik tidak membentuk tren — tampilkan angkanya saja.
  if (titik.length === 1) {
    wadah.innerHTML = `<p class="py-16 text-center text-sm text-ink-500 dark:text-cream-300/60">
      Baru ada satu pengukuran: <strong>${esc(fmtSingkat(titik[0].v))}</strong> pada ${esc(fmtWaktuPenuh(titik[0].t))}.
    </p>`;
    return;
  }

  const data = [...titik].sort((a, b) => a.t - b.t);
  const tMin = data[0].t;
  const tMax = data[data.length - 1].t;
  const rentangT = Math.max(1, tMax - tMin);
  const vMax = batasAtas(Math.max(...data.map((d) => d.v)));

  const x = (t: number) => L + ((t - tMin) / rentangT) * (W - L - R);
  const y = (v: number) => A + (1 - v / vMax) * (H - A - B);

  const garis = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(d.t).toFixed(1)},${y(d.v).toFixed(1)}`).join(' ');
  const area = `${garis} L${x(tMax).toFixed(1)},${y(0).toFixed(1)} L${x(tMin).toFixed(1)},${y(0).toFixed(1)} Z`;

  // Grid horizontal yang sengaja dibuat samar — konteks, bukan tokoh utama.
  const gridY = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const nilai = vMax * f;
    return `<line x1="${L}" y1="${y(nilai).toFixed(1)}" x2="${W - R}" y2="${y(nilai).toFixed(1)}" stroke="currentColor" stroke-width="1" class="text-ink-900/10 dark:text-cream-100/10"/>
            <text x="${L - 8}" y="${(y(nilai) + 4).toFixed(1)}" text-anchor="end" class="fill-current text-ink-500 dark:text-cream-300/60" font-size="11" font-family="JetBrains Mono, monospace">${fmtSingkat(nilai)}</text>`;
  }).join('');

  // Label waktu: hanya awal dan akhir. Menomori tiap titik justru bikin ramai.
  const labelX = `
    <text x="${L}" y="${H - 8}" text-anchor="start" class="fill-current text-ink-500 dark:text-cream-300/60" font-size="11" font-family="JetBrains Mono, monospace">${fmtTanggal(tMin)}</text>
    <text x="${W - R}" y="${H - 8}" text-anchor="end" class="fill-current text-ink-500 dark:text-cream-300/60" font-size="11" font-family="JetBrains Mono, monospace">${fmtTanggal(tMax)}</text>`;

  wadah.innerHTML = `
    <figure class="text-amber-700 dark:text-amber-500">
      <svg viewBox="0 0 ${W} ${H}" class="w-full h-auto touch-none" role="img"
           aria-label="Grafik tren ${esc(label)} dari ${esc(fmtWaktuPenuh(tMin))} sampai ${esc(fmtWaktuPenuh(tMax))}">
        <defs>
          <linearGradient id="isi-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="currentColor" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="currentColor" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${gridY}
        ${labelX}
        <path d="${area}" fill="url(#isi-area)"/>
        <path d="${garis}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        <g data-lapisan-hover></g>
        <rect x="${L}" y="${A}" width="${W - L - R}" height="${H - A - B}" fill="transparent" data-area-hover/>
      </svg>
      <figcaption class="sr-only">Tren ${esc(label)}. Nilai terakhir ${esc(fmtSingkat(data[data.length - 1].v))}.</figcaption>
    </figure>
    <div data-tooltip class="pointer-events-none absolute hidden rounded-lg border border-ink-900/10 dark:border-cream-100/10 bg-cream-50 dark:bg-ink-900 px-3 py-2 text-xs shadow-lg"></div>`;

  pasangHover(wadah, data, label, x, y);
}

/** Crosshair + tooltip mengikuti titik terdekat dari posisi kursor. */
function pasangHover(
  wadah: HTMLElement,
  data: TitikData[],
  label: string,
  x: (t: number) => number,
  y: (v: number) => number,
): void {
  const svg = wadah.querySelector('svg') as SVGSVGElement | null;
  const lapisan = wadah.querySelector('[data-lapisan-hover]') as SVGGElement | null;
  const tooltip = wadah.querySelector('[data-tooltip]') as HTMLElement | null;
  if (!svg || !lapisan || !tooltip) return;

  wadah.classList.add('relative');

  function sembunyikan() {
    lapisan!.innerHTML = '';
    tooltip!.classList.add('hidden');
  }

  function tampilkan(e: PointerEvent) {
    const kotak = svg!.getBoundingClientRect();
    // Ubah posisi kursor di layar ke koordinat internal viewBox.
    const svgX = ((e.clientX - kotak.left) / kotak.width) * W;

    let terdekat = data[0];
    let jarakMin = Infinity;
    for (const d of data) {
      const jarak = Math.abs(x(d.t) - svgX);
      if (jarak < jarakMin) { jarakMin = jarak; terdekat = d; }
    }

    const px = x(terdekat.t);
    const py = y(terdekat.v);

    // Cincin seukuran permukaan di sekeliling titik supaya tetap terbaca
    // saat menempel pada garis.
    lapisan!.innerHTML = `
      <line x1="${px.toFixed(1)}" y1="${A}" x2="${px.toFixed(1)}" y2="${H - B}" stroke="currentColor" stroke-width="1" class="text-ink-900/20 dark:text-cream-100/20"/>
      <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="6" fill="currentColor" stroke="currentColor" stroke-width="2" class="text-cream-50 dark:text-ink-950"/>
      <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4" fill="currentColor"/>`;

    tooltip!.innerHTML = `
      <p class="font-mono text-[0.65rem] text-ink-500 dark:text-cream-300/60">${esc(fmtWaktuPenuh(terdekat.t))}</p>
      <p class="mt-0.5"><span class="font-semibold">${esc(fmtSingkat(terdekat.v))}</span>
      <span class="text-ink-500 dark:text-cream-300/60">${esc(label)}</span></p>`;
    tooltip!.classList.remove('hidden');

    // Jaga tooltip tetap di dalam wadah.
    const lebarWadah = wadah.clientWidth;
    const kiri = (px / W) * lebarWadah;
    const lebarTooltip = tooltip!.offsetWidth;
    tooltip!.style.left = `${Math.min(Math.max(kiri - lebarTooltip / 2, 0), lebarWadah - lebarTooltip)}px`;
    tooltip!.style.top = `${(py / H) * svg!.getBoundingClientRect().height + 12}px`;
  }

  svg.addEventListener('pointermove', tampilkan);
  svg.addEventListener('pointerleave', sembunyikan);
}
