import test from 'node:test';
import assert from 'node:assert/strict';
import {networkOrigin,parseStats} from '../src/lib/member-network/model.ts';
import {adminMenu,semuaHalaman} from '../src/lib/admin-menu.ts';
test('Member Network accepts only a configured HTTPS origin without credentials/path',()=>{
 assert.equal(networkOrigin('https://network.example.test/'),'https://network.example.test');
 for(const value of ['',null,'javascript:alert(1)','http://example.test','https://u:p@example.test','https://example.test/path','https://example.test/?token=bad'])assert.equal(networkOrigin(value),null);
});
test('Member Network aggregate response validates counts and never renders upstream strings as numbers',()=>{
 const stats={members:3,communities:2,campaigns:1,auto_join_enabled:false,joins:[{status:'added',count:2}]};
 assert.deepEqual(parseStats(stats),{members:3,communities:2,campaigns:1,added:2,enabled:false});
 for(const members of [-1,'<script>',Infinity])assert.equal(parseStats({...stats,members}),null);
 assert.equal(parseStats({...stats,joins:[{status:'added',count:'unsafe'}]}),null);
 assert.equal(semuaHalaman(adminMenu).find(n=>n.key==='member-network')?.href,'/admin/member-network');
});
