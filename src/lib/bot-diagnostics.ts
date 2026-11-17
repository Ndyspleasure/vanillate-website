/** Source: Vanillate.ID/src/cms/handlers and snapshots.js. No secrets or payloads. */
export const diagnosticModules = [
 ['system','Sistem','/admin/developer'], ['games','Game','/admin/games'],
 ['words','Kamus','/admin/kata'], ['polls','Polling','/admin/developer/polling'],
 ['broadcast','Broadcast','/admin/developer/broadcast'], ['campaign','Campaign','/admin/developer/campaign'],
 ['errors','Error','/admin/developer/error'], ['events','Event','/admin/developer/event'],
 ['share','Share Server','/admin/developer/share-server'], ['social','Sosial','/admin/developer/sosial'],
 ['story','Story','/admin/developer/story'], ['tahu','Tahu Bulat','/admin/developer/tahu-bulat'],
 ['tutorial','Tutorial','/admin/developer/tutorial'], ['autoheal','Auto-Heal','/admin/developer/autoheal'],
] as const;
export function ageMinutes(value: unknown, now = Date.now()): number | null {
 if(typeof value !== 'string') return null;
 const t=Date.parse(value);return Number.isFinite(t) && t<=now ? Math.floor((now-t)/60000) : null;
}
export function snapshotLabel(time: unknown, now=Date.now()): string {
 const age=ageMinutes(time,now);
 return age===null ? 'Belum ada waktu valid' : age>=5 ? `Perlu diperiksa · ${age} menit` : `Terkini · ${age} menit`;
}
export function queueConcern(row: {status:string;created_at?:string;heartbeat_at?:string|null},now=Date.now()): boolean {
 const age=ageMinutes(row.status==='processing' ? row.heartbeat_at ?? row.created_at : row.created_at,now);
 return age!==null && age>=10 && ['pending','processing'].includes(row.status);
}
