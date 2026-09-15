// ════════════════════════════════════════════════════════════════════════════
//  Pembaca KATALOG kapabilitas dari Supabase (`workspace_catalog`).
//  Bot menerbitkan katalog; CMS membacanya agar TIDAK meng-hardcode daftar
//  (Permission, scope, trigger/action, status staff, jenis notifikasi, fitur).
//  Bila katalog belum tersedia (bot belum menerbitkan), pemanggil memakai
//  fallback konstanta di workspace-admin.ts supaya panel tetap berfungsi.
// ════════════════════════════════════════════════════════════════════════════

import { getSupabase } from './supabase';

export interface CatalogRow {
  kind: string;
  value: string;
  label: string | null;
  meta: Record<string, any> | null;
  sort: number;
}

let cache: CatalogRow[] | null = null;

/** Muat seluruh katalog sekali (cache per halaman). Kosong bila belum ada. */
export async function loadCatalog(): Promise<CatalogRow[]> {
  if (cache) return cache;
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('workspace_catalog')
    .select('kind, value, label, meta, sort')
    .order('sort', { ascending: true });
  cache = error ? [] : ((data as CatalogRow[]) ?? []);
  return cache;
}

/** Baris katalog untuk sebuah kind, terurut. */
export function ofKind(rows: CatalogRow[], kind: string): CatalogRow[] {
  return rows.filter((r) => r.kind === kind);
}

/** Bentuk {value,label} untuk dropdown sederhana; fallback bila katalog kosong. */
export function options(
  rows: CatalogRow[],
  kind: string,
  fallback: { value: string; label: string }[],
): { value: string; label: string }[] {
  const k = ofKind(rows, kind);
  return k.length ? k.map((r) => ({ value: r.value, label: r.label ?? r.value })) : fallback;
}
