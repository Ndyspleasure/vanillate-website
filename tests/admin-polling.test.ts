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

function idleEnv() {
  const st = { hidden: false, now: 0, timer: null as (() => void) | null, interact: () => {}, fire() { const f = st.timer; st.timer = null; f?.(); } };
  const env: PollEnvironment = {
    isHidden: () => st.hidden,
    setTimer: (fn) => { st.timer = fn; return 1; },
    clearTimer: () => { st.timer = null; },
    onVisibility: () => () => {},
    onPageHide: () => () => {},
    onPageShow: () => () => {},
    onInteraction: (fn) => { st.interact = fn; return () => {}; },
    now: () => st.now,
  };
  return { st, env };
}
const tick = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

test('polling berhenti setelah idle dan lanjut (refresh sekali) saat ada interaksi', async () => {
  const { st, env } = idleEnv();
  let calls = 0;
  startAdminPolling(async () => { calls++; }, 1000, { environment: env, idleMs: 5000 });
  await tick(); assert.equal(calls, 1); assert.ok(st.timer);
  st.now = 3000; st.fire(); await tick(); assert.equal(calls, 2); assert.ok(st.timer);
  st.now = 6000; st.fire(); await tick();
  assert.equal(calls, 2); assert.equal(st.timer, null);
  st.interact(); await tick();
  assert.equal(calls, 3); assert.ok(st.timer);
});

test('interaksi menunda idle', async () => {
  const { st, env } = idleEnv();
  let calls = 0;
  startAdminPolling(async () => { calls++; }, 1000, { environment: env, idleMs: 5000 });
  await tick();
  st.now = 4000; st.interact();
  st.now = 8000; st.fire(); await tick();
  assert.equal(calls, 2); assert.ok(st.timer);
});

test('idleMs 0 tidak pernah berhenti', async () => {
  const { st, env } = idleEnv();
  let calls = 0;
  startAdminPolling(async () => { calls++; }, 1000, { environment: env, idleMs: 0 });
  await tick();
  st.now = 10 * 60 * 60 * 1000; st.fire(); await tick();
  assert.equal(calls, 2); assert.ok(st.timer);
});

test('tab tersembunyi tetap menghentikan polling walau idleMs 0', async () => {
  const { st, env } = idleEnv();
  let calls = 0;
  startAdminPolling(async () => { calls++; }, 1000, { environment: env, idleMs: 0 });
  await tick(); assert.equal(calls, 1);
  st.hidden = true; st.fire(); await tick();
  assert.equal(calls, 1); assert.equal(st.timer, null);
});
