import { test } from 'node:test';
import assert from 'node:assert/strict';
import { failureTracker, HELP_NUDGE_AFTER, HELP_NUDGE_TEXT, HELP_WELCOME_TEXT, helpDetail } from '../src/lib/dashboard/help-nudge.ts';

test('gelembung muncul tepat sekali setelah kegagalan berbeda mencapai ambang', () => {
  const t = failureTracker();
  assert.equal(HELP_NUDGE_AFTER, 2);
  assert.equal(t.record('save-1'), false);
  assert.equal(t.record('save-1'), false, 'id sama tidak dihitung dua kali');
  assert.equal(t.record('bot-12'), true);
  assert.equal(t.record('bot-13'), false, 'tidak muncul berulang');
  assert.equal(t.count(), 3);
});

test('penolakan bot untuk revisi yang sama di setiap render tidak memicu gelembung', () => {
  const t = failureTracker();
  for (let i = 0; i < 10; i++) assert.equal(t.record('bot-7'), false);
});

test('teks gelembung tanpa tanda pisah', () => {
  for (const t of [HELP_NUDGE_TEXT, HELP_WELCOME_TEXT]) assert.doesNotMatch(t, /—|–| - /);
});

test('dua kesempatan: sapaan sekali per browser, kegagalan sekali per tab', () => {
  assert.equal(helpDetail('welcome').scope, 'local');
  assert.ok(helpDetail('welcome').autoHideSec > 0, 'sapaan hilang sendiri');
  assert.equal(helpDetail('failure').scope, 'session');
  assert.equal(helpDetail('failure').autoHideSec, 0, 'pesan kegagalan tetap sampai ditutup');
  assert.notEqual(helpDetail('welcome').reason, helpDetail('failure').reason);
});
