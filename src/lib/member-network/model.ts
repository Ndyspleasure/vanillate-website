export function networkOrigin(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    return url.origin;
  } catch { return null; }
}
export interface NetworkStats { members: number; communities: number; campaigns: number; added: number; enabled: boolean; }
export function parseStats(value: unknown): NetworkStats | null {
  if (!value || typeof value !== 'object') return null;
  const x = value as Record<string, unknown>;
  const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
  if (!count(x.members) || !count(x.communities) || !count(x.campaigns) || typeof x.auto_join_enabled !== 'boolean' || !Array.isArray(x.joins)) return null;
  const added = x.joins.find((v: unknown) => v && typeof v === 'object' && (v as Record<string, unknown>).status === 'added');
  if (added && !count(added.count)) return null;
  return { members: x.members, communities: x.communities, campaigns: x.campaigns, added: added?.count ?? 0, enabled: x.auto_join_enabled };
}
