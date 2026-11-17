/** Optimistic locking: unchanged versions update once; stale/deleted rows never report success. */
export const CONFLICT_MESSAGE = 'Konten berubah di sesi lain, dihapus, atau akses berubah. Salin perubahanmu lalu muat ulang sebelum menyimpan lagi.';

export async function saveVersioned(
  client: any,
  table: string,
  key: string,
  id: string,
  values: Record<string, unknown>,
  version: string | null | undefined,
): Promise<{ version?: string; error?: unknown }> {
  if (!version) return { error: { message: CONFLICT_MESSAGE } };
  const { data, error } = await client.from(table).update(values)
    .eq(key, id).eq('updated_at', version).select('updated_at').maybeSingle();
  if (error) return { error };
  if (!data?.updated_at) return { error: { message: CONFLICT_MESSAGE } };
  return { version: data.updated_at };
}

/** Snapshot comparison costs nothing between user actions; no storage of sensitive drafts. */
export function draftTracker(read: () => string) {
  let saved = read();
  return { dirty: () => read() !== saved, reset: () => { saved = read(); } };
}

export function protectDraft(read: () => string) {
  const tracker = draftTracker(read);
  window.addEventListener('beforeunload', (event) => {
    if (!tracker.dirty()) return;
    event.preventDefault();
    event.returnValue = '';
  });
  return {
    ...tracker,
    discard: () => !tracker.dirty() || window.confirm('Ada perubahan yang belum disimpan. Tinggalkan perubahan ini?'),
  };
}

/** SQL LIKE syntax is escaped; passed as a single PostgREST filter value, never raw OR syntax. */
export function searchPattern(input: string): string {
  return `%${input.trim().slice(0, 200).replace(/[\\%_]/g, '\\$&')}%`;
}
