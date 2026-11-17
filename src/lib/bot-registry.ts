/** Safe, uniform operational metadata. Never accept arbitrary runtime config. */
export interface RegistryCommand {
  name: string; description: string; category: string; permissions: string[];
  options: { name: string; type: string; description: string; required: boolean }[];
  cooldownSeconds: number | null;
}
export interface BotRegistryEntry {
  slug: string; name: string; aliases: string[]; kind: 'bot' | 'feature'; parentSlug: string | null;
  identity: { tagline: string | null; description: string; category: string; status: string | null; version: string | null; releasedAt: string | null };
  links: { invite: string | null; support: string | null; repository: string | null; website: string | null; topgg: string | null; admin: string };
  visual: { logo: string | null; thumbnail: string | null; banner: string | null; color: string | null };
  discord: { clientId: string | null; permissions: string | null; permissionNames: string[]; intents: string[]; conditionalIntents: string[]; install: string | null };
  commands: RegistryCommand[];
  features: string[];
  runtime: { locale: string | null; defaults: Record<string, string | number | boolean>; featureFlags: string[]; defaultChannel: string | null; defaultRole: string | null; rateLimit: string | null };
  releases: { version: string; date: string; title: string }[];
  seo: { title: string | null; description: string | null; ogImage: string | null };
  operations: { process: string | null; hosting: string | null; telemetry: 'system' | 'workspace' | null; notes: string[] };
  sources: string[];
  todos: string[];
}

export function matchesBot(bot: BotRegistryEntry, query: string, onlyTodos = false): boolean {
  const text = [bot.name, bot.slug, ...bot.aliases, bot.identity.category, ...bot.features].join(' ').toLocaleLowerCase('id');
  return (!onlyTodos || bot.todos.length > 0) && query.toLocaleLowerCase('id').trim().split(/\s+/).every(word => text.includes(word));
}

/** Missing values must remain unknown: Number(null) must never become a fake zero. */
export function metric(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function snapshotHealth(updatedAt: unknown, now = Date.now(), maxAgeMs = 15 * 60_000): 'unknown' | 'fresh' | 'stale' {
  if (typeof updatedAt !== 'string') return 'unknown';
  const time = Date.parse(updatedAt);
  if (!Number.isFinite(time) || time > now + 60_000) return 'unknown';
  return now - time <= maxAgeMs ? 'fresh' : 'stale';
}

export interface Telemetry {
  observedAt: string | null; freshness: 'unknown' | 'fresh' | 'stale';
  servers: number | null; memberReach: number | null; activePlayers: number | null;
  uptimeSeconds: number | null; latencyMs: number | null; rssMb: number | null;
  version: string | null;
}
/** Deliberately allowlisted: no arbitrary snapshot, env, IDs or secrets in exports. */
export function normalizeTelemetry(row: Record<string, unknown> | null, now = Date.now(), maxAgeMs?: number): Telemetry {
  const r = row ?? {};
  return {
    observedAt: typeof r.updated_at === 'string' ? r.updated_at : null,
    freshness: snapshotHealth(r.updated_at, now, maxAgeMs),
    servers: metric(r.servers), memberReach: metric(r.memberReach), activePlayers: metric(r.activePlayers),
    uptimeSeconds: metric(r.uptimeSeconds), latencyMs: metric(r.latencyMs), rssMb: metric(r.rssMb),
    version: typeof r.version === 'string' ? r.version.slice(0, 60) : null,
  };
}

/** Public-only catalog is audited at build time; live additions are normalized. */
export function exportRegistry(entries: BotRegistryEntry[], live: Record<string, Telemetry>) {
  return JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), bots: entries.map(bot => ({ ...bot, statistics: live[bot.slug] ?? null })) }, null, 2);
}
