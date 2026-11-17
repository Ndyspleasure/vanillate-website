import test from 'node:test';
import assert from 'node:assert/strict';
import { startAdminPolling, type PollEnvironment } from '../src/lib/admin-polling.ts';
test('hidden pages stop requests and slow polls never overlap',async()=>{
 let hidden=false, timer:(()=>void)|null=null, visibility=()=>{}, pagehide=()=>{}, pageshow=()=>{};
 let calls=0,finish=()=>{};
 const env:PollEnvironment={isHidden:()=>hidden,setTimer:fn=>{timer=fn;return 1;},clearTimer:()=>{timer=null;},onVisibility:fn=>{visibility=fn;return ()=>{};},onPageHide:fn=>{pagehide=fn;return ()=>{};},onPageShow:fn=>{pageshow=fn;return ()=>{};}};
 const poll=startAdminPolling(()=>{calls++;return new Promise<void>(resolve=>{finish=resolve;});},30000,{environment:env});
 await Promise.resolve(); const pending=poll.refresh();assert.equal(calls,1);
 hidden=true;visibility();finish();await pending;assert.equal(timer,null);
 await poll.refresh();assert.equal(calls,1);
 hidden=false;visibility();await Promise.resolve();assert.equal(calls,2);
 const second=poll.refresh();finish();await second;assert.ok(timer);
 pagehide();assert.equal(timer,null);pageshow();await Promise.resolve();assert.equal(calls,3);
 const third=poll.refresh();poll.stop();finish();await third;assert.equal(timer,null);
});
