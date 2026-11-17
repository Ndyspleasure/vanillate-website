import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotLabel,queueConcern,ageMinutes,diagnosticModules} from '../src/lib/bot-diagnostics.ts';
test('unknown/future metadata is never asserted offline',()=>{
 assert.equal(ageMinutes(null),null);assert.equal(ageMinutes('bad'),null);
 assert.equal(ageMinutes('2030-01-01',0),null);
 assert.match(snapshotLabel(null),/Belum/);
});
test('queue age uses heartbeat and only pending/processing',()=>{
 const now=Date.parse('2026-11-17T12:00:00Z');
 assert.equal(queueConcern({status:'pending',created_at:'2026-11-17T11:40:00Z'},now),true);
 assert.equal(queueConcern({status:'processing',created_at:'2026-11-17T11:40:00Z',heartbeat_at:'2026-11-17T11:59:00Z'},now),false);
 assert.equal(queueConcern({status:'done',created_at:'2026-11-17T11:40:00Z'},now),false);
 assert.equal(new Set(diagnosticModules.map(m=>m[0])).size,diagnosticModules.length);
});
