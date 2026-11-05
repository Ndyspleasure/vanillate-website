import test from 'node:test';
import assert from 'node:assert/strict';
import { discordMarkdownHtml as md } from '../src/lib/dev-panel/discord-md.ts';

test('judul # ## ### dirender, #### tidak', () => {
  assert.match(md('## testing'), /<p class="mt-1 text-lg font-bold">testing<\/p>/);
  assert.match(md('# a'), /text-xl/);
  assert.match(md('#### a'), /<p>#### a<\/p>/);
});

test('tebal, miring, coret, garis bawah, kode inline', () => {
  assert.match(md('**t** *m* ~~c~~ __u__ `k`'), /<strong>t<\/strong> <em>m<\/em> <s>c<\/s> <u>u<\/u> <code[^>]*>k<\/code>/);
  assert.doesNotMatch(md('`**x**`'), /<strong>/);
});

test('daftar, kutipan, blok kode, teks kecil', () => {
  assert.match(md('- a\n- b'), /<ul[^>]*><li>a<\/li><li>b<\/li><\/ul>/);
  assert.match(md('1. a\n2. b'), /<ol[^>]*><li>a<\/li><li>b<\/li><\/ol>/);
  assert.match(md('> q'), /<blockquote[^>]*>q<\/blockquote>/);
  assert.match(md('```\n**x**\n```'), /<pre[^>]*>\*\*x\*\*<\/pre>/);
  assert.match(md('-# kecil'), /opacity-70">kecil/);
});

test('tabel dan --- tampil apa adanya (seperti Discord)', () => {
  assert.match(md('| a | b |'), /<p>\| a \| b \|<\/p>/);
  assert.match(md('---'), /<p>---<\/p>/);
});

test('tautan hanya http(s) dan HTML di-escape', () => {
  assert.match(md('[x](https://vanillate.id)'), /<a href="https:\/\/vanillate.id"/);
  assert.doesNotMatch(md('[x](javascript:alert(1))'), /<a /);
  assert.equal(md('<img src=x onerror=1>').includes('<img'), false);
  assert.match(md('"><script>'), /&quot;&gt;&lt;script&gt;/);
});
