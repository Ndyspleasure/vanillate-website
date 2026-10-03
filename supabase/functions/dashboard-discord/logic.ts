// ════════════════════════════════════════════════════════════════════════════
//  dashboard-discord — logika murni (tanpa Deno/jaringan) supaya bisa diuji
//  dengan Node: `node --experimental-strip-types --test tests/`.
//  Hanya sintaks TypeScript yang bisa di-strip (tanpa enum/namespace).
// ════════════════════════════════════════════════════════════════════════════

/** Izin Discord yang membuat seseorang boleh mengelola server. */
export const PERM_ADMINISTRATOR = 1n << 3n;
export const PERM_MANAGE_GUILD = 1n << 5n;

/** Satu guild dari GET /users/@me/guilds. */
export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner?: boolean;
  permissions?: string;
}

export interface ManageableGuild {
  guild_id: string;
  guild_name: string;
  guild_icon: string | null;
  is_owner: boolean;
  permissions: string;
}

/** Bitfield desimal → BigInt; nilai tidak valid dianggap 0 (tanpa izin). */
export function toBits(value: unknown): bigint {
  if (typeof value !== 'string' || !/^[0-9]{1,30}$/.test(value)) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

/** Owner, Administrator, atau Manage Server = boleh mengelola. */
export function canManage(guild: DiscordGuild): boolean {
  if (guild.owner === true) return true;
  const bits = toBits(guild.permissions);
  return (bits & PERM_ADMINISTRATOR) !== 0n || (bits & PERM_MANAGE_GUILD) !== 0n;
}

const SNOWFLAKE = /^[0-9]{15,22}$/;

/** Saring daftar guild Discord → hanya yang boleh dikelola (dan ID-nya valid). */
export function manageableGuilds(guilds: unknown): ManageableGuild[] {
  if (!Array.isArray(guilds)) return [];
  const out: ManageableGuild[] = [];
  const seen = new Set<string>();
  for (const g of guilds as DiscordGuild[]) {
    if (!g || typeof g.id !== 'string' || !SNOWFLAKE.test(g.id) || seen.has(g.id)) continue;
    if (!canManage(g)) continue;
    seen.add(g.id);
    out.push({
      guild_id: g.id,
      guild_name: String(g.name ?? '').slice(0, 200),
      guild_icon: typeof g.icon === 'string' ? g.icon : null,
      is_owner: g.owner === true,
      permissions: typeof g.permissions === 'string' ? g.permissions : '0',
    });
  }
  return out;
}

/** Identitas Discord dari objek user Supabase Auth (identity_data diisi provider, bukan user). */
export function discordIdentity(user: unknown): { id: string; name: string; avatar: string | null } | null {
  const identities = (user as { identities?: unknown[] } | null)?.identities;
  if (!Array.isArray(identities)) return null;
  for (const raw of identities) {
    const i = raw as { provider?: string; id?: string; identity_data?: Record<string, unknown> };
    if (i?.provider !== 'discord') continue;
    const data = i.identity_data ?? {};
    const id = [data.provider_id, data.sub, i.id].find((v) => typeof v === 'string' && SNOWFLAKE.test(v)) as
      | string
      | undefined;
    if (!id) continue;
    const claims = (data.custom_claims ?? {}) as Record<string, unknown>;
    const name = [claims.global_name, data.full_name, data.name].find((v) => typeof v === 'string' && v) as
      | string
      | undefined;
    return {
      id,
      name: name ?? id,
      avatar: typeof data.avatar_url === 'string' ? data.avatar_url : null,
    };
  }
  return null;
}

/** URL ikon server di CDN Discord, atau null. */
export function guildIconUrl(guildId: string, icon: string | null): string | null {
  if (!icon || !/^(a_)?[0-9a-f]{32}$/.test(icon)) return null;
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.${icon.startsWith('a_') ? 'gif' : 'png'}?size=128`;
}

export interface ServerRow {
  guildId: string;
  name: string;
  iconUrl: string | null;
  isOwner: boolean;
  manageable: true;
  botInstalled: boolean;
  configured: boolean;
  syncStatus: string | null;
  revision: number | null;
}

/**
 * Gabungkan daftar guild yang boleh dikelola dengan data bot & konfigurasi.
 * Urutan: server yang sudah ada bot → nama (alfabet, bahasa Indonesia).
 */
export function buildServerList(
  guilds: ManageableGuild[],
  installed: Set<string>,
  configs: Map<string, { sync_status: string; current_revision: number }>,
): ServerRow[] {
  return guilds
    .map((g) => {
      const cfg = configs.get(g.guild_id);
      return {
        guildId: g.guild_id,
        name: g.guild_name,
        iconUrl: guildIconUrl(g.guild_id, g.guild_icon),
        isOwner: g.is_owner,
        manageable: true as const,
        botInstalled: installed.has(g.guild_id),
        configured: Boolean(cfg),
        syncStatus: cfg?.sync_status ?? null,
        revision: cfg ? Number(cfg.current_revision) : null,
      };
    })
    .sort((a, b) => {
      if (a.botInstalled !== b.botInstalled) return a.botInstalled ? -1 : 1;
      return a.name.localeCompare(b.name, 'id', { sensitivity: 'base' });
    });
}

/** Origin yang boleh memanggil function ini dari browser. */
export function allowedOrigin(origin: string | null, allowList: string[]): string | null {
  if (!origin) return null;
  const normalized = origin.replace(/\/+$/, '');
  return allowList.some((o) => o.replace(/\/+$/, '') === normalized) ? normalized : null;
}

/** Token Discord berlaku 7 hari sejak diterbitkan. */
export const DISCORD_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Daftar guild di-cache sebentar supaya tidak menabrak rate limit Discord. */
export const GUILD_SYNC_TTL_MS = 30 * 1000;

export function isFresh(iso: string | null | undefined, ttlMs: number, now = Date.now()): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && now - t < ttlMs;
}
