// Tes logika FAQ Bot (src/lib/bot-faq.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reorder, validateBotFaq } from '../src/lib/bot-faq.ts';

test('validateBotFaq: wajib isi & batas panjang', () => {
  assert.deepEqual(validateBotFaq({ question: 'Tanya?', answer: 'Jawab.' }), { errors: [], warnings: [] });
  assert.equal(validateBotFaq({ question: '  ', answer: 'x' }).errors.length, 1);
  assert.equal(validateBotFaq({ question: 'x', answer: '' }).errors.length, 1);
  assert.equal(validateBotFaq({ question: 'x'.repeat(257), answer: 'y' }).errors.length, 1);
  assert.equal(validateBotFaq({ question: 'x', answer: 'y'.repeat(4001) }).errors.length, 1);
});

test('validateBotFaq: peringatkan tabel & tautan relatif (tidak tampil di Discord)', () => {
  const tabel = validateBotFaq({ question: 'x', answer: '| A | B |\n| --- | --- |\n| 1 | 2 |' });
  assert.equal(tabel.errors.length, 0);
  assert.match(tabel.warnings.join(' '), /tabel/);
  assert.match(validateBotFaq({ question: 'x', answer: 'Lihat [panduan](/faq/sambung-kata)' }).warnings.join(' '), /relatif/);
  assert.equal(validateBotFaq({ question: 'x', answer: 'Lihat [panduan](https://vanillate.id/faq)' }).warnings.length, 0);
});

test('reorder: tukar posisi, nomori ulang, hanya baris berubah', () => {
  const list = [{ id: 'a', sort: 10 }, { id: 'b', sort: 20 }, { id: 'c', sort: 30 }];
  assert.deepEqual(reorder(list, 'c', -1), [{ id: 'c', sort: 20 }, { id: 'b', sort: 30 }]);
  assert.deepEqual(reorder(list, 'a', 1), [{ id: 'b', sort: 10 }, { id: 'a', sort: 20 }]);
  assert.deepEqual(reorder(list, 'a', -1), [], 'yang teratas tidak bisa naik');
  assert.deepEqual(reorder(list, 'zz', 1), []);
});

test('reorder: nilai sort kembar tetap bisa digeser', () => {
  const list = [{ id: 'a', sort: 100 }, { id: 'b', sort: 100 }];
  assert.deepEqual(reorder(list, 'b', -1), [{ id: 'b', sort: 10 }, { id: 'a', sort: 20 }]);
});
