import test from 'node:test';
import assert from 'node:assert/strict';
import { saveVersioned, draftTracker } from '../src/lib/editor-save.ts';
test('stale or missing rows fail; current rows return the new version', async () => {
  const filters: unknown[]=[];
  let row: any = null;
  const query:any={ update:()=>query,eq:(...args:any[])=>{filters.push(args);return query;},select:()=>query,maybeSingle:async()=>({data:row,error:null})};
  const client={from:()=>query};
  assert.ok((await saveVersioned(client,'page_content','key','home',{},'old')).error);
  assert.deepEqual(filters,[['key','home'],['updated_at','old']]);
  row={updated_at:'new'};
  assert.equal((await saveVersioned(client,'page_content','key','home',{},'old')).version,'new');
  assert.ok((await saveVersioned(client,'page_content','key','home',{},undefined)).error);
});
test('draft resets only after successful save',()=>{
  let value='a'; const d=draftTracker(()=>value);
  assert.equal(d.dirty(),false);value='b';assert.equal(d.dirty(),true);
  d.reset();assert.equal(d.dirty(),false);
});
