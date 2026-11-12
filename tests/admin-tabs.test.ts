import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pilihTab } from '../src/lib/admin-tabs.ts';

const ids = ['maintenance', 'pengumuman', 'mode'];

test('pilihTab memakai hash yang valid', () => {
  assert.equal(pilihTab(ids, '#mode'), 'mode');
});
test('pilihTab jatuh ke awal lalu tab pertama bila hash tak dikenal', () => {
  assert.equal(pilihTab(ids, '#xx', 'pengumuman'), 'pengumuman');
  assert.equal(pilihTab(ids, ''), 'maintenance');
  assert.equal(pilihTab([], '#mode'), '');
});
