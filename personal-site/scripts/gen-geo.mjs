// ═══════════════════════════════════════════════════════════════════════════
// GEO GENERATOR — one-time, dev-only. Projects REAL geographic data into
// pre-computed SVG path strings for the cinematic space→Bekasi sequence.
// Output: src/data/geo.ts (committed). The site build does NOT run this and
// does NOT depend on any geo library — only the plain path strings ship.
//
// Sources (public domain / open data):
//   • World coastlines   → npm "world-atlas" (Natural Earth 50m land)
//   • Indonesia provinces → npm "indonesia-geodata" (BPS-derived, © stoikal, MIT)
//   • Bekasi + neighbours → geoBoundaries IDN ADM2 (open data, geoBoundaries.org)
//       https://www.geoboundaries.org  (ADM2 = kabupaten / kota)
//
// Re-run (dev only):
//   npm i --no-save world-atlas indonesia-geodata d3-geo topojson-client
//   ADM2_GEOJSON=/path/to/geoBoundaries-IDN-ADM2.geojson node scripts/gen-geo.mjs
// If ADM2_GEOJSON is unset the script fetches it from geoBoundaries media CDN.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as d3 from 'd3-geo';
import { feature } from 'topojson-client';

// Some geoBoundaries features carry a stray ring far outside the country (e.g.
// a point near lon 180 / lat 85) that projects to infinity and floods the
// frame. Drop any ring that leaves Indonesia's real bounds.
const inID = (pt) => pt[0] >= 94 && pt[0] <= 142 && pt[1] >= -12 && pt[1] <= 7;
const ringOk = (ring) => ring.every(inID);
function cleanGeom(g) {
  if (g.type === 'Polygon') {
    const r = g.coordinates.filter(ringOk);
    return r.length ? { type: 'Polygon', coordinates: r } : null;
  }
  if (g.type === 'MultiPolygon') {
    const p = g.coordinates.map((poly) => poly.filter(ringOk)).filter((poly) => poly.length);
    return p.length ? { type: 'MultiPolygon', coordinates: p } : null;
  }
  return g;
}
// geoBoundaries rings are wound opposite to d3's spherical convention, so
// geoPath would render the COMPLEMENT (a full-frame box with the region as a
// hole). If a feature's spherical area exceeds a hemisphere, reverse its rings.
function fixWinding(f) {
  if (d3.geoArea(f) > 2 * Math.PI) {
    const g = f.geometry;
    if (g.type === 'Polygon') g.coordinates.forEach((r) => r.reverse());
    else if (g.type === 'MultiPolygon') g.coordinates.forEach((p) => p.forEach((r) => r.reverse()));
  }
  return f;
}
const sanitize = (features) =>
  features
    .map((f) => { const g = cleanGeom(f.geometry); return g ? { ...f, geometry: g } : null; })
    .filter(Boolean)
    .map(fixWinding);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const req = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));

// ─── round numbers inside a path string to keep the payload small ───────────
const round = (d, dp = 1) =>
  d.replace(/-?\d+\.?\d*(e-?\d+)?/g, (n) => {
    const v = +n;
    return Number.isFinite(v) ? String(+v.toFixed(dp)) : n;
  });

// ─── load sources ───────────────────────────────────────────────────────────
// Higher-detail coastlines: Natural Earth 50m (was 110m) for a crisper globe.
const landTopo = req('node_modules/world-atlas/land-50m.json');
const land = feature(landTopo, landTopo.objects.land);
// Indonesia: medium-resolution provinces (was low) for more island detail.
const idnProv = req('node_modules/indonesia-geodata/json/indonesiaMedium.json');
const idnProvMed = idnProv;

async function loadAdm2() {
  const local = process.env.ADM2_GEOJSON;
  if (local && existsSync(local)) return JSON.parse(readFileSync(local, 'utf8'));
  const url =
    'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/gbOpen/IDN/ADM2/geoBoundaries-IDN-ADM2_simplified.geojson';
  const res = await fetch(url);
  if (!res.ok) throw new Error('ADM2 fetch failed: ' + res.status);
  return res.json();
}
const adm2 = await loadAdm2();
const byName = (re) => adm2.features.filter((f) => re.test(f.properties.shapeName || ''));
const pick = (names) =>
  adm2.features.filter((f) => names.includes(f.properties.shapeName));

// ─── helpers ─────────────────────────────────────────────────────────────────
const VB = 1000;
const fc = (features) => ({ type: 'FeatureCollection', features });
// Fit target as a MultiPoint of the bbox corners — points carry no ring-winding
// ambiguity, so geoBounds is exactly the rectangle (a Polygon ring can be read
// as the sphere's complement and blow the fit up to the whole world).
const bboxPts = (w, s, e, n) => ({
  type: 'MultiPoint',
  coordinates: [[w, s], [e, s], [e, n], [w, n]],
});
const px = (xy) => xy.map((v) => +v.toFixed(1));

// ════════════════════ SCENE 1 — EARTH (orthographic globe) ══════════════════
function buildEarth() {
  const R = 476;
  const center = [110, -2]; // lon,lat the globe faces (SE Asia / Indonesia)
  const proj = d3
    .geoOrthographic()
    .scale(R)
    .translate([VB / 2, VB / 2])
    .rotate([-center[0], -center[1]])
    .clipAngle(90);
  const path = d3.geoPath(proj);
  const graticule = d3.geoGraticule().step([15, 15]);

  const visible = (lonlat) => d3.geoDistance(lonlat, center) < Math.PI / 2 - 0.02;
  const cityDefs = [
    // Indonesia (home region gets the most lights)
    ['Jakarta', 106.83, -6.2], ['Bandung', 107.6, -6.9], ['Surabaya', 112.75, -7.25],
    ['Medan', 98.67, 3.59], ['Semarang', 110.42, -6.97], ['Makassar', 119.42, -5.15],
    ['Palembang', 104.76, -2.99], ['Denpasar', 115.22, -8.65], ['Balikpapan', 116.83, -1.24],
    ['Yogyakarta', 110.37, -7.8], ['Pontianak', 109.34, -0.02], ['Manado', 124.85, 1.49],
    ['Jayapura', 140.72, -2.53],
    // Regional context
    ['Singapore', 103.8, 1.35], ['Kuala Lumpur', 101.7, 3.14], ['Bangkok', 100.5, 13.75],
    ['Manila', 121.0, 14.6], ['Tokyo', 139.7, 35.68], ['Beijing', 116.4, 39.9],
    ['New Delhi', 77.2, 28.6], ['Sydney', 151.2, -33.87], ['Perth', 115.86, -31.95],
    ['Seoul', 126.98, 37.57], ['Ho Chi Minh', 106.7, 10.78], ['Dhaka', 90.4, 23.8],
    ['Hong Kong', 114.16, 22.3], ['Darwin', 130.84, -12.46],
  ];
  const lights = cityDefs
    .filter((c) => visible([c[1], c[2]]))
    .map((c) => px(proj([c[1], c[2]])));

  return {
    r: R,
    cx: VB / 2,
    cy: VB / 2,
    land: round(path(land), 0),
    graticule: round(path(graticule()), 1),
    target: px(proj([107.0, -6.24])), // Bekasi on the disc → zoom aim
    lights,
  };
}

// ════════════════════ SCENE 2 — INDONESIA (archipelago) ═════════════════════
function buildIndonesia() {
  const pad = 46;
  const proj = d3.geoMercator();
  proj.fitExtent([[pad, pad], [VB - pad, VB - pad]], fc(idnProv.features));
  const path = d3.geoPath(proj);

  const westCluster = idnProvMed.features.filter((f) =>
    ['Jawa Barat', 'Jakarta Raya', 'Banten'].includes(f.properties.name)
  );

  const labelDefs = [
    ['Sumatra', 101.5, -0.5], ['Kalimantan', 114, 0.5], ['Jawa', 110, -7.4],
    ['Sulawesi', 121, -2], ['Papua', 138, -4.5], ['Bali', 115.1, -8.4],
  ];
  const labels = labelDefs.map(([t, lon, lat]) => ({ t, p: px(proj([lon, lat])) }));

  return {
    land: round(path(fc(idnProv.features)), 1),
    west: round(path(fc(westCluster)), 1),
    target: px(proj([107.0, -6.24])),
    labels,
  };
}

// ════════════════════ SCENE 3 — WEST JAVA (regencies) ═══════════════════════
function buildWestJava() {
  const view = bboxPts(106.28, -6.9, 107.66, -5.78);
  const pad = 28;
  const proj = d3.geoMercator();
  proj.fitExtent([[pad, pad], [VB - pad, VB - pad]], view);
  const path = d3.geoPath(proj);

  const jakarta = byName(/^(Kepulauan Seribu|Jakarta (Pusat|Utara|Barat|Selatan|Timur))$/);
  const neighbors = pick([
    'Bogor', 'Kota Bogor', 'Kota Depok', 'Karawang', 'Kota Bekasi', 'Bekasi',
    'Tangerang', 'Kota Tangerang', 'Subang',
  ]);
  const bekasi = pick(['Bekasi', 'Kota Bekasi']);
  const context = [...neighbors, ...jakarta].filter(
    (f, i, a) => a.indexOf(f) === i && !/^(Bekasi|Kota Bekasi)$/.test(f.properties.shapeName)
  );

  const labelDefs = [
    ['JAKARTA', 106.83, -6.22], ['BEKASI', 107.05, -6.15], ['BOGOR', 106.8, -6.6],
    ['KARAWANG', 107.4, -6.24], ['DEPOK', 106.82, -6.41],
  ];
  const labels = labelDefs.map(([t, lon, lat]) => ({ t, p: px(proj([lon, lat])) }));

  return {
    context: round(path(fc(sanitize(context))), 0),
    bekasi: round(path(fc(sanitize(bekasi))), 1),
    target: px(proj([107.0, -6.24])),
    labels,
  };
}

// ════════════════════ SCENE 4 — BEKASI (close geospatial) ═══════════════════
function buildBekasi() {
  const view = bboxPts(106.82, -6.62, 107.42, -5.85);
  const pad = 40;
  const proj = d3.geoMercator();
  proj.fitExtent([[pad, pad], [VB - pad, VB - pad]], view);
  const path = d3.geoPath(proj);

  const kab = pick(['Bekasi']);
  const kota = pick(['Kota Bekasi']);
  const neighbors = pick([
    'Karawang', 'Bogor', 'Kota Depok', 'Jakarta Timur', 'Jakarta Utara',
  ]);

  // fine grid (every 0.1°) for a map / geospatial feel
  const grid = { type: 'MultiLineString', coordinates: [] };
  for (let lon = 106.9; lon <= 107.4; lon += 0.1) grid.coordinates.push([[lon, -6.62], [lon, -5.85]]);
  for (let lat = -6.6; lat <= -5.85; lat += 0.1) grid.coordinates.push([[106.82, lat], [107.42, lat]]);

  const labelDefs = [
    ['KAB. BEKASI', 107.16, -6.18], ['KOTA BEKASI', 106.98, -6.28],
    ['KARAWANG', 107.34, -6.2], ['JAKARTA', 106.86, -6.24], ['LAUT JAWA', 107.05, -5.93],
  ];
  const labels = labelDefs.map(([t, lon, lat]) => ({ t, p: px(proj([lon, lat])) }));

  return {
    neighbors: round(path(fc(sanitize(neighbors))), 0),
    kabupaten: round(path(fc(sanitize(kab))), 1),
    kota: round(path(fc(sanitize(kota))), 1),
    grid: round(path(grid), 1),
    marker: px(proj([106.9896, -6.2383])), // Kota Bekasi centre
    labels,
  };
}

// ─── emit ────────────────────────────────────────────────────────────────────
const out = {
  earth: buildEarth(),
  indonesia: buildIndonesia(),
  westJava: buildWestJava(),
  bekasi: buildBekasi(),
};

const banner = `// ═══════════════════════════════════════════════════════════════════════════
// AUTO-GENERATED by scripts/gen-geo.mjs — DO NOT EDIT BY HAND.
// Real geographic data projected to SVG paths (viewBox 0 0 1000 1000).
// Sources: Natural Earth 50m (world-atlas), indonesia-geodata (BPS, MIT),
// geoBoundaries IDN ADM2 (open data). No geo library ships to the browser.
// ═══════════════════════════════════════════════════════════════════════════
`;
const ts = banner + 'export const geo = ' + JSON.stringify(out) + ' as const;\n';
writeFileSync(resolve(ROOT, 'src/data/geo.ts'), ts);

// report
const sz = (o) => (JSON.stringify(o).length / 1024).toFixed(1) + 'KB';
console.log('WROTE src/data/geo.ts  total', sz(out));
for (const k of Object.keys(out)) console.log('  ', k, sz(out[k]));
console.log('earth lights:', out.earth.lights.length, '| bekasi marker:', out.bekasi.marker);
