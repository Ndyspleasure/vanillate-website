import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
test('strict sync without credentials fails without replacing existing snapshots',()=>{
 const root=mkdtempSync(join(tmpdir(),'cms-sync-'));
 try {
 mkdirSync(join(root,'scripts'));mkdirSync(join(root,'src/data/synced'),{recursive:true});
 copyFileSync('scripts/sync-content.mjs',join(root,'scripts/sync-content.mjs'));
 const target=join(root,'src/data/synced/pages.json');writeFileSync(target,'{"existing":true}');
 const summary=join(root,'summary.txt');
 const r=spawnSync(process.execPath,['scripts/sync-content.mjs'],{cwd:root,encoding:'utf8',env:{...process.env,SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',SYNC_STRICT:'1',GITHUB_STEP_SUMMARY:summary}});
 assert.equal(r.status,1);assert.equal(readFileSync(target,'utf8'),'{"existing":true}');assert.match(readFileSync(summary,'utf8'),/GAGAL/);
 } finally {rmSync(root,{recursive:true,force:true});}
});
