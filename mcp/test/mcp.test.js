/**
 * The server as a client meets it: started on a spare port, and asked
 * through the SDK's own client over HTTP, as an assistant or an app would.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { createServer } = require('../src/server');
const { fold } = require('../src/shared');

let http, base;

test.before(async () => {
  http = createServer({ perMinute: 1000 });
  await new Promise((ok) => http.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${http.address().port}`;
});

test.after(() => new Promise((ok) => http.close(ok)));

async function connect() {
  const client = new Client({ name: 'test', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(base + '/mcp')));
  return client;
}

async function call(name, args) {
  const client = await connect();
  try {
    const r = await client.callTool({ name, arguments: args });
    return { error: !!r.isError, text: r.content[0].text, value: r.isError ? null : JSON.parse(r.content[0].text) };
  } finally {
    await client.close();
  }
}

test('offers its tools and file addresses', async () => {
  const client = await connect();
  const tools = (await client.listTools()).tools.map((t) => t.name).sort();
  assert.deepStrictEqual(tools, ['get_ayah', 'get_recitation', 'get_tafsir', 'list_reciters',
    'list_surahs', 'list_translations', 'search', 'word_by_word']);
  const templates = (await client.listResourceTemplates()).resourceTemplates.map((t) => t.uriTemplate).sort();
  assert.deepStrictEqual(templates, ['quran://recitation/{reciter}/{surah}', 'quran://surah/{surah}',
    'quran://tafsir/{surah}', 'quran://translation/{id}/{surah}']);
  await client.close();
});

test('get_ayah: Ayat al-Kursi, in the Complex English by default, with its page and link', async () => {
  const { value } = await call('get_ayah', { surah: 2, ayah: 255 });
  const a = value.ayahs[0];
  assert.strictEqual(a.ref, '2:255');
  assert.ok(fold(a.arabic).startsWith(fold('الله لا اله الا هو الحي القيوم')), a.arabic);
  assert.match(a.translation, /^All[âa]h! L[âa] il[âa]ha/);
  assert.strictEqual(a.page, 42);
  assert.strictEqual(value.link, 'https://readqurantoday.com/surah/2/');
});

test('get_ayah: a run, another translation, and the Arabic alone', async () => {
  const run = await call('get_ayah', { surah: 1, ayah: 1, to: 7, translation: 'sahih' });
  assert.strictEqual(run.value.ayahs.length, 7);
  assert.match(run.value.ayahs[0].translation, /In the name of Allah/);
  const bare = await call('get_ayah', { surah: 112, ayah: 1, translation: 'none' });
  assert.strictEqual(bare.value.ayahs[0].translation, undefined);
});

test('get_ayah: refuses what is not there, and more than 50 at once', async () => {
  assert.match((await call('get_ayah', { surah: 1, ayah: 8 })).text, /has 7 ayahs/);
  assert.match((await call('get_ayah', { surah: 2, ayah: 1, to: 80 })).text, /At most 50/);
  assert.match((await call('get_ayah', { surah: 2, ayah: 1, translation: 'nope' })).text, /No translation/);
});

test('search: Arabic without diacritics, and a translation', async () => {
  const ar = await call('search', { query: 'الله لا إله إلا هو الحي القيوم' });
  assert.ok(ar.value.results.some((r) => r.ref === '2:255'));
  const en = await call('search', { query: 'companions of the cave', translation: 'sahih', limit: 5 });
  assert.ok(en.value.results.some((r) => r.ref.startsWith('18:')));
  assert.ok(en.value.results.length <= 5);
});

test('get_tafsir and word_by_word', async () => {
  const t = await call('get_tafsir', { surah: 1, ayah: 2 });
  assert.match(t.value.ayahs[0].tafsir, /[؀-ۿ]/);
  const w = await call('word_by_word', { surah: 1, ayah: 1 });
  assert.deepStrictEqual(w.value.words.map((x) => x.transliteration), ["bis'mi", 'l-lahi', 'l-raḥmāni', 'l-raḥīmi']);
  assert.strictEqual(w.value.words[0].meaning, 'In (the) name');
  const ur = await call('word_by_word', { surah: 1, ayah: 1, language: 'ur' });
  assert.match(ur.value.words[1].meaning, /[؀-ۿ]/);
});

test('get_recitation: a link to the recording, and to an ayah in it', async () => {
  const { value } = await call('get_recitation', { surah: 18, ayah: 10 });
  assert.match(value.audio, /^https:\/\/audio\.readqurantoday\.com\/.+\/018\.mp3$/);
  assert.match(value.startAt, /#t=\d+(\.\d+)?$/);
  assert.strictEqual(value.ayahs.length, 110);
  assert.ok(value.ayahs[9].start < value.ayahs[9].end);
});

test('the lists: surahs, translations narrowed by language, reciters', async () => {
  assert.strictEqual((await call('list_surahs', {})).value.length, 114);
  const urdu = (await call('list_translations', { language: 'urdu' })).value.translations;
  assert.ok(urdu.length >= 1 && urdu.every((t) => t.code === 'ur'));
  const r = (await call('list_reciters', {})).value;
  assert.ok(r.reciters.some((x) => x.id === r.default));
});

test('files by address', async () => {
  const client = await connect();
  const surah = JSON.parse((await client.readResource({ uri: 'quran://surah/112' })).contents[0].text);
  assert.strictEqual(surah.ayahs.length, 4);
  const tr = JSON.parse((await client.readResource({ uri: 'quran://translation/hilali/112' })).contents[0].text);
  assert.strictEqual(tr.ayahs.length, 4);
  const rec = JSON.parse((await client.readResource({ uri: 'quran://recitation/maher-al-muaiqly-qul/1' })).contents[0].text);
  assert.match(rec.audio, /001\.mp3$/);
  await client.close();
});

test('a caller over its budget is told to wait', async () => {
  const tight = createServer({ perMinute: 2 });
  await new Promise((ok) => tight.listen(0, '127.0.0.1', ok));
  const url = `http://127.0.0.1:${tight.address().port}/mcp`;
  const ping = () => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
  }).then((r) => r.status);
  assert.deepStrictEqual([await ping(), await ping(), await ping()], [200, 200, 429]);
  await new Promise((ok) => tight.close(ok));
});

test('health, wrong paths and methods', async () => {
  assert.strictEqual((await fetch(base + '/health')).status, 200);
  assert.strictEqual((await fetch(base + '/elsewhere')).status, 404);
  assert.strictEqual((await fetch(base + '/mcp')).status, 405);
});

test('callable from a page on another site', async () => {
  const pre = await fetch(base + '/mcp', { method: 'OPTIONS' });
  assert.strictEqual(pre.status, 204);
  assert.strictEqual(pre.headers.get('access-control-allow-origin'), '*');
});
