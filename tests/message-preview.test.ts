// Tes preview kartu pesan (src/lib/dashboard/message-preview.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewHtml, previewKind, type PreviewContext } from '../src/lib/dashboard/message-preview.ts';
import type { SettingProp } from '../src/lib/dashboard/model.ts';

const p = (key: string, extra: Partial<SettingProp> = {}): SettingProp => ({ key, type: 'string', title: key, required: false, ...extra });
const props: SettingProp[] = [
  p('levelup_title'),
  p('levelup_message', { placeholder: '🎉 {tag} naik ke **level {level}** ({kategori})!' }),
  p('levelup_greeting'),
  p('levelup_thumb', { type: 'enum', default: 'none', values: ['none', 'member', 'server'] }),
  p('levelup_color', { type: 'color', placeholder: '#f1c40f' }),
  p('levelup_guide', { type: 'guide_list' }),
  p('levelup_footer', { placeholder: 'Catatan bawaan {server}' }),
];
const ctx: PreviewContext = {
  guildName: 'Castle <b>', guildIconUrl: 'https://cdn.example/icon.png', viewerName: 'Minami',
  channelName: (id) => (id === '1' ? 'rules' : null),
};

test('previewKind: jenis dari kunci _thumb; null bila bukan kelompok pesan', () => {
  assert.equal(previewKind(props), 'levelup');
  assert.equal(previewKind([p('chat_xp')]), null);
});

test('tanpa isian: memakai teks, warna, dan catatan bawaan dengan data contoh', () => {
  const html = previewHtml(props, {}, ctx);
  assert.match(html, /@Minami naik ke <strong>level 5<\/strong> \(Chat\)!/);
  assert.match(html, /border-left:4px solid #f1c40f/);
  assert.match(html, /Catatan bawaan Castle &lt;b&gt;/);
  assert.match(html, /Made by Vanillate \| https:\/\/vanillate\.id\/dashboard/);
  assert.doesNotMatch(html, /<img /);
});

test('draft: sapaan, warna, daftar channel, dan gambar server tampil; teks di-escape', () => {
  const html = previewHtml(props, {
    levelup_greeting: 'Hi {user} <script>', levelup_color: '#112233', levelup_thumb: 'server', levelup_footer: 'Footer saya',
    levelup_guide: [{ channel_id: '1', text: 'baca rules' }, { channel_id: '2', text: '' }],
  }, ctx);
  assert.match(html, /Hi Minami &lt;script&gt;/);
  assert.match(html, /border-left:4px solid #112233/);
  assert.match(html, /<img src="https:\/\/cdn\.example\/icon\.png"/);
  assert.match(html, /#rules<\/span> · baca rules/);
  assert.match(html, /#channel<\/span>/);
  assert.match(html, /Footer saya/);
  assert.doesNotMatch(html, /<script>/);
});

test('warna tidak valid jatuh ke bawaan (tidak pernah masuk atribut style mentah)', () => {
  const html = previewHtml(props, { levelup_color: 'red;background:url(x)' }, ctx);
  assert.match(html, /border-left:4px solid #f1c40f/);
  assert.doesNotMatch(html, /url\(x\)/);
});
