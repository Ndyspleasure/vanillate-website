import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveWriteSlug, newestPerKey, BOT_SLUGS_READ } from '../src/lib/bot-slug.ts';

test('slug tulis bawaan adalah slug baru, slug lama hanya untuk rollback eksplisit', () => {
  assert.equal(resolveWriteSlug(undefined), 'vanillateID');
  assert.equal(resolveWriteSlug(''), 'vanillateID');
  assert.equal(resolveWriteSlug('apa-saja'), 'vanillateID');
  assert.equal(resolveWriteSlug('vanillateID'), 'vanillateID');
  assert.equal(resolveWriteSlug('sambung-kata'), 'sambung-kata');
});

test('pembacaan menerima kedua slug', () => {
  assert.deepEqual([...BOT_SLUGS_READ].sort(), ['sambung-kata', 'vanillateID']);
});

test('newestPerKey memilih baris terbaru per key', () => {
  const rows = [
    { key: 'system', updated_at: '2026-11-04T10:00:00Z', v: 'lama' },
    { key: 'system', updated_at: '2026-11-04T10:05:00Z', v: 'baru' },
    { key: 'games', updated_at: '2026-11-04T09:00:00Z', v: 'g' },
  ];
  const out = newestPerKey(rows);
  assert.equal(out.length, 2);
  assert.equal(out.find((r) => r.key === 'system')!.v, 'baru');
});
