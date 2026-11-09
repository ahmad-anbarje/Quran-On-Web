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

let http, base, inbox;
const received = [];

test.before(async () => {
  // A stand-in for the feedback service: takes two reports, then says too many
  inbox = require('http').createServer((req, res) => {
    let b = '';
    req.on('data', (c) => { b += c; });
    req.on('end', () => {
      received.push(JSON.parse(b));
      res.writeHead(received.length <= 2 ? 201 : 429, { 'Content-Type': 'application/json' });
      res.end('{}');
    });
  });
  await new Promise((ok) => inbox.listen(0, '127.0.0.1', ok));
  http = createServer({ perMinute: 1000, feedbackUrl: `http://127.0.0.1:${inbox.address().port}/api/feedback` });
  await new Promise((ok) => http.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${http.address().port}`;
});

test.after(() => Promise.all([new Promise((ok) => http.close(ok)), new Promise((ok) => inbox.close(ok))]));

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
  assert.deepStrictEqual(tools, ['get_ayah', 'get_ayah_image', 'get_file', 'get_recitation', 'get_tafsir', 'list_reciters',
    'list_surahs', 'list_translations', 'search', 'send_feedback', 'word_by_word']);
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
  assert.strictEqual(a.link, 'https://readqurantoday.com/surah/2/255/');
  assert.strictEqual(a.read, 'https://readqurantoday.com/surah/2/ayah/255');
});

test('get_ayah: the Arabic with every mark the mushaf prints, closed by its number', async () => {
  const pause = (await call('get_ayah', { surah: 2, ayah: 2, translation: 'none' })).value;
  assert.strictEqual(pause.ayahs[0].arabic.split('ۛ').length - 1, 2);   // لَا رَيْبَ ۛ فِيهِ ۛ
  assert.ok(pause.ayahs[0].arabic.endsWith(' ﴿٢﴾'));
  const sajdah = (await call('get_ayah', { surah: 96, ayah: 19, translation: 'none' })).value;
  assert.match(sajdah.ayahs[0].arabic, /۩ ﴿١٩﴾$/);
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
  assert.strictEqual(t.value.ayahs[0].link, 'https://readqurantoday.com/surah/1/2/');
  const w = await call('word_by_word', { surah: 1, ayah: 1 });
  assert.deepStrictEqual(w.value.words.map((x) => x.transliteration), ["bis'mi", 'l-lahi', 'l-raḥmāni', 'l-raḥīmi']);
  assert.strictEqual(w.value.words[0].meaning, 'In (the) name');
  assert.strictEqual(w.value.read, 'https://readqurantoday.com/surah/1/ayah/1');
  const ur = await call('word_by_word', { surah: 1, ayah: 1, language: 'ur' });
  assert.match(ur.value.words[1].meaning, /[؀-ۿ]/);
  // Turkish lacks some words of 2:255: each still has a meaning, in English and said so
  const tr = await call('word_by_word', { surah: 2, ayah: 255, language: 'tr' });
  assert.ok(tr.value.words.every((x) => x.meaning));
  assert.ok(tr.value.words.some((x) => x.meaningLanguage === 'en'));
});

test('get_recitation opens the player: one self-contained page, fed the timings and the glyphs of the mushaf', async () => {
  const client = await connect();
  try {
    const tool = (await client.listTools()).tools.find((t) => t.name === 'get_recitation');
    assert.strictEqual(tool._meta.ui.resourceUri, 'ui://readqurantoday/player');
    const page = (await client.readResource({ uri: 'ui://readqurantoday/player' })).contents[0];
    assert.strictEqual(page.mimeType, 'text/html;profile=mcp-app');
    assert.doesNotMatch(page.text, /@@(CLIENT|FONT)@@/);
    assert.match(page.text, /font\/woff2;base64,d09GMg/);   // the face itself, "wOF2"
    assert.deepStrictEqual(page._meta.ui.csp.resourceDomains, ['https://audio.readqurantoday.com', 'https://readqurantoday.com']);
    const r = await client.callTool({ name: 'get_recitation', arguments: { surah: 112 } });
    assert.strictEqual(r.structuredContent.ayahs.length, 4);
    // The mushaf's own glyphs, a word each, by page: Al-Ikhlas is all on page 604
    const mushaf = r._meta['com.readqurantoday/mushaf'];
    assert.strictEqual(mushaf.fonts, 'https://readqurantoday.com/fonts/v4/');
    assert.strictEqual(mushaf.ayahs.length, 4);
    assert.ok(mushaf.ayahs.every((pieces) => pieces.length === 1 && pieces[0][0] === 604 && pieces[0][1].length > 1));
  } finally {
    await client.close();
  }
});

test('get_ayah opens the ayah card, fed the mushaf lines that hold the ayahs asked for', async () => {
  const client = await connect();
  try {
    const tool = (await client.listTools()).tools.find((t) => t.name === 'get_ayah');
    assert.strictEqual(tool._meta.ui.resourceUri, 'ui://readqurantoday/ayah');
    const page = (await client.readResource({ uri: 'ui://readqurantoday/ayah' })).contents[0];
    assert.strictEqual(page.mimeType, 'text/html;profile=mcp-app');
    assert.doesNotMatch(page.text, /@@(CLIENT|FONT)@@/);
    const r = await client.callTool({ name: 'get_ayah', arguments: { surah: 2, ayah: 255, to: 256, translation: 'sahih' } });
    assert.strictEqual(r.structuredContent.ayahs.length, 2);
    const mushaf = r._meta['com.readqurantoday/mushaf'];
    // Page 42's own lines: from the one where 2:255 begins, after the end of 2:254, to the last of 2:256
    assert.ok(mushaf.lines.every((line) => line.page === 42));
    assert.strictEqual(mushaf.lines[0].words[0][1], 254);
    assert.ok(mushaf.lines.some((line) => line.words.some(([, a]) => a === 256)));
  } finally {
    await client.close();
  }
});

test('get_ayah_image: a PNG of the mushaf lines, drawn once and refused past one page', async () => {
  const client = await connect();
  try {
    const r = await client.callTool({ name: 'get_ayah_image', arguments: { surah: 112, ayah: 1, to: 4 } });
    const png = Buffer.from(r.content[0].data, 'base64');
    assert.strictEqual(r.content[0].mimeType, 'image/png');
    assert.strictEqual(png.subarray(1, 4).toString(), 'PNG');
    assert.strictEqual(JSON.parse(r.content[1].text).read, 'https://readqurantoday.com/surah/112/ayah/1');
    const again = await client.callTool({ name: 'get_ayah_image', arguments: { surah: 112, ayah: 1, to: 4 } });
    assert.strictEqual(again.content[0].data, r.content[0].data);
    assert.ok((await client.callTool({ name: 'get_ayah_image', arguments: { surah: 2, ayah: 1, to: 40 } })).isError);
  } finally {
    await client.close();
  }
});

test('get_recitation: a run of ayahs plays by its link alone, and stops at its end', async () => {
  const { value } = await call('get_recitation', { surah: 1, ayah: 1, to: 5 });
  assert.strictEqual(value.startAyah, 1);
  assert.strictEqual(value.endAyah, 5);
  const [from, until] = value.playRange.split('#t=')[1].split(',').map(Number);
  assert.strictEqual(from, value.ayahs[0].start);
  assert.strictEqual(until, value.ayahs[4].end);
  assert.ok((await call('get_recitation', { surah: 1, to: 5 })).error);          // "to" needs "ayah"
  assert.ok((await call('get_recitation', { surah: 1, ayah: 5, to: 2 })).error);  // backwards
  assert.ok((await call('get_recitation', { surah: 1, ayah: 1, to: 8 })).error);  // past the end
});

test('get_recitation: a link to the recording, and to an ayah in it', async () => {
  const { value } = await call('get_recitation', { surah: 18, ayah: 10 });
  assert.match(value.audio, /^https:\/\/audio\.readqurantoday\.com\/.+\/018\.mp3$/);
  assert.match(value.startAt, /#t=\d+(\.\d+)?$/);
  assert.strictEqual(value.ayahs.length, 110);
  assert.ok(value.ayahs[9].start < value.ayahs[9].end);
  assert.strictEqual(value.read, 'https://readqurantoday.com/surah/18/ayah/10');
});

test('get_file: a surah as text, a link the server answers with the file', async () => {
  const { value } = await call('get_file', { kind: 'text', surah: 112, translation: 'hilali', tafsir: true });
  assert.strictEqual(value.file, 'surah-112-al-ikhlas-hilali-tafsir.txt');
  assert.strictEqual(value.download, 'https://readqurantoday.com/mcp/files/surah-112.txt?translation=hilali&tafsir=1');
  // The same path and query, asked of this server
  const res = await fetch(base + new URL(value.download).pathname + new URL(value.download).search);
  assert.strictEqual(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/plain; charset=utf-8/);
  assert.strictEqual(res.headers.get('content-disposition'), 'attachment; filename="surah-112-al-ikhlas-hilali-tafsir.txt"');
  const text = await res.text();
  assert.match(text, /Surah Al-Ikhlas \(112\), 4 ayahs/);
  for (const a of [1, 2, 3, 4]) assert.match(text, new RegExp(`^112:${a}  `, 'm'));
  assert.match(text, /^Say \(O Muhammad/m);
  assert.strictEqual((text.match(/^التفسير: /gm) || []).length, 4);
  // The Arabic alone, and what is not there
  const plain = await (await fetch(base + '/mcp/files/surah-1.txt')).text();
  assert.strictEqual((plain.match(/^1:\d+ {2}/gm) || []).length, 7);
  assert.strictEqual((await fetch(base + '/mcp/files/surah-115.txt')).status, 404);
  assert.strictEqual((await fetch(base + '/mcp/files/surah-1.txt?translation=nope')).status, 404);
  assert.ok((await call('get_file', { kind: 'text' })).error);
});

test('get_file: the MP3 of a surah, or all of a reciter\'s', async () => {
  const one = (await call('get_file', { kind: 'audio', surah: 36, reciter: 'mishari-rashid-al-afasy' })).value;
  assert.strictEqual(one.files.length, 1);
  assert.strictEqual(one.files[0].download, 'https://audio.readqurantoday.com/mishari-rashid-al-afasy/036.mp3?dl=1');
  assert.strictEqual(one.files[0].play, 'https://audio.readqurantoday.com/mishari-rashid-al-afasy/036.mp3');
  const all = (await call('get_file', { kind: 'audio' })).value;
  assert.strictEqual(all.files.length, 114);
  assert.ok((await call('get_file', { kind: 'audio', reciter: 'nobody' })).error);
});

test('get_file: a recording\'s timing file, and the mushaf\'s fonts for a surah with its glyphs', async () => {
  const t = (await call('get_file', { kind: 'timing', surah: 1, reciter: 'mishari-rashid-al-afasy' })).value;
  // A download link that saves the file (Cloudflare's ?dl=1), and the plain one beside it
  assert.strictEqual(t.download, 'https://readqurantoday.com/surah/1/001.mishari-rashid-al-afasy.timing.json?dl=1');
  assert.strictEqual(t.open, 'https://readqurantoday.com/surah/1/001.mishari-rashid-al-afasy.timing.json');
  const f = (await call('get_file', { kind: 'font', surah: 2 })).value;
  assert.deepStrictEqual(f.surah.pages, [2, 49]);
  assert.strictEqual(f.fonts.length, 48);
  assert.strictEqual(f.fonts[0].font, 'https://readqurantoday.com/fonts/v4/p2.woff2');
  assert.strictEqual(f.fonts[0].download, 'https://readqurantoday.com/fonts/v4/p2.woff2?dl=1');
  assert.strictEqual(f.ayahs.length, 286);
  assert.ok(f.ayahs.every((a) => a.glyphs.every((g) => g.page >= 2 && g.page <= 49 && g.text)));
  assert.ok((await call('get_file', { kind: 'font' })).error);
});

test('get_file: the data sets, and only the files it names', async () => {
  const d = (await call('get_file', { kind: 'data', translation: 'sahih' })).value;
  assert.strictEqual(d.download, 'https://readqurantoday.com/mcp/files/translation-sahih.json');
  assert.ok(['quran-uthmani', 'mushaf', 'translation', 'tafsir', 'words'].every((id) => d.datasets.some((x) => x.id === id)));
  // Each whole file has a link that saves it; the server's own are attachments already
  const ds = Object.fromEntries(d.datasets.map((x) => [x.id, x]));
  assert.strictEqual(ds.mushaf.download, 'https://readqurantoday.com/data/mushaf-v4.json?dl=1');
  assert.strictEqual(ds['quran-uthmani'].download, 'https://readqurantoday.com/mcp/files/quran-uthmani.txt');
  assert.strictEqual(ds.timing.download, undefined);
  const uthmani = await (await fetch(base + '/mcp/files/quran-uthmani.txt')).text();
  assert.strictEqual(uthmani.split('\n').filter((l) => l.trim() && !l.startsWith('#')).length, 6236);
  assert.match(uthmani, /Tanzil/);
  const tr = await (await fetch(base + '/mcp/files/translation-sahih.json')).json();
  assert.strictEqual(tr.surahs.length, 114);
  assert.strictEqual(tr.surahs[1].length, 286);
  const tf = await (await fetch(base + '/mcp/files/tafsir-muyassar.json')).json();
  assert.strictEqual(tf.surahs[113].length, 6);
  // Nothing else: an unknown id, a path that climbs out, a file of the server's own
  for (const p of ['/mcp/files/translation-nope.json', '/mcp/files/..%2f..%2fpackage.json', '/mcp/files/../src/server.js',
    '/mcp/files/translation-..%2f..%2fdata.json', '/mcp/files/quran-uthmani.txt/x', '/mcp/files/']) {
    assert.strictEqual((await fetch(base + p)).status, 404, p);
  }
  assert.ok((await call('get_file', { kind: 'data', translation: 'nope' })).error);
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

test('send_feedback: the reader\'s report reaches the inbox, marked as from an assistant, and says it is not read-only', async () => {
  const client = await connect();
  const tool = (await client.listTools()).tools.find((t) => t.name === 'send_feedback');
  assert.strictEqual(tool.annotations.readOnlyHint, false);
  await client.close();
  const r = await call('send_feedback', { kind: 'bug', message: 'The translation of this ayah has a typo', surah: 2, ayah: 255, reciter: 'mishari-rashid-al-afasy' });
  assert.ok(r.value.sent);
  const got = received[received.length - 1];
  assert.strictEqual(got.source, 'mcp');
  assert.match(got.message, /typo\n\nAbout: 2:255 \(Al-Baqarah\), mishari-rashid-al-afasy$/);
  assert.strictEqual(got.app.page, 42);
  assert.ok((await call('send_feedback', { kind: 'bug', message: 'too short' })).error);   // under 10
  assert.ok((await call('send_feedback', { kind: 'bug', message: 'Something is wrong here', reciter: 'nobody' })).error);
  assert.ok(!(await call('send_feedback', { kind: 'other', message: 'A second report, accepted' })).error);
  const busy = await call('send_feedback', { kind: 'other', message: 'A third, over the budget' });
  assert.ok(busy.error && /Too many/.test(busy.text));
});

test('without a feedback service, send_feedback is not offered', async () => {
  const bare = createServer({ perMinute: 1000, feedbackUrl: '' });
  await new Promise((ok) => bare.listen(0, '127.0.0.1', ok));
  const client = new Client({ name: 'test', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${bare.address().port}/mcp`)));
  assert.ok(!(await client.listTools()).tools.some((t) => t.name === 'send_feedback'));
  await client.close();
  await new Promise((ok) => bare.close(ok));
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

test('all callers together are held to a ceiling, whatever their addresses', async () => {
  const capped = createServer({ perMinute: 100, totalPerMinute: 3 });
  await new Promise((ok) => capped.listen(0, '127.0.0.1', ok));
  const url = `http://127.0.0.1:${capped.address().port}/mcp`;
  const ping = (ip) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'X-Real-IP': ip },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
  }).then((r) => r.status);
  assert.deepStrictEqual([await ping('10.0.0.1'), await ping('10.0.0.2'), await ping('10.0.0.3'), await ping('10.0.0.4')], [200, 200, 200, 429]);
  await new Promise((ok) => capped.close(ok));
});

test('usage is counted for the admin page: calls by tool, connections by app, the last calls in memory only', async () => {
  const counted = createServer({ perMinute: 100, statsFile: null });
  await new Promise((ok) => counted.listen(0, '127.0.0.1', ok));
  const at = `http://127.0.0.1:${counted.address().port}`;
  const client = new Client({ name: 'claude-ai', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(at + '/mcp')));
  await client.callTool({ name: 'get_ayah', arguments: { surah: 1, ayah: 1 } });
  await client.callTool({ name: 'get_ayah', arguments: { surah: 1, ayah: 2 } });
  await client.callTool({ name: 'list_surahs', arguments: {} });
  await client.close();
  await fetch(at + '/mcp/files/surah-112.txt');
  const s = await (await fetch(at + '/stats')).json();
  const day = s.days[new Date().toISOString().slice(0, 10)];
  assert.strictEqual(day.calls, 3);
  assert.deepStrictEqual(day.tools, { get_ayah: 2, list_surahs: 1 });
  assert.deepStrictEqual(day.clients, { 'claude-ai': 1 });
  assert.strictEqual(day.files, 1);
  // A named app on the reader's own machine; its calls' choices kept, for replay
  assert.deepStrictEqual(day.callKinds, { app: 3 });
  assert.deepStrictEqual(day.health.get_ayah.calls, 2);
  assert.deepStrictEqual(s.recent.map((c) => [c.kind, c.tool, c.args, c.ok]),
    [['app', 'list_surahs', {}, true], ['app', 'get_ayah', { surah: 1, ayah: 2 }, true], ['app', 'get_ayah', { surah: 1, ayah: 1 }, true]]);
  assert.doesNotMatch(JSON.stringify(s), /127\.0\.0\.1/);   // no addresses
  // A replay answers the same call again, and is not counted
  const again = await fetch(at + '/replay', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ tool: 'get_ayah', args: { surah: 1, ayah: 1, query: 'never passed on' } }),
  });
  const answer = await again.json();
  assert.match(answer.result.content[0].text, /1:1/);
  const after = await (await fetch(at + '/stats')).json();
  assert.strictEqual(after.days[new Date().toISOString().slice(0, 10)].calls, 3);
  assert.strictEqual(after.recent.length, 3);
  await new Promise((ok) => counted.close(ok));
});

test('callers are told apart: Claude.ai and ChatGPT by their published addresses, apps and scanners by name', () => {
  const { createStats } = require('../src/stats');
  const { createOrigin } = require('../src/origin');
  const origin = createOrigin({ fetch: false });
  origin.ranges(['23.98.142.176/28']);
  const s = createStats(null, { origin });
  const init = (name) => ({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { clientInfo: { name } } });
  const call = { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_ayah', arguments: {} } };
  s.message(call, { ip: '160.79.106.9' });                     // Claude.ai, whatever it calls itself
  s.message(call, { ip: '::ffff:23.98.142.180' });             // ChatGPT
  s.message(init('claude-code'), { ip: '203.0.113.7' });
  s.message(call, { ip: '203.0.113.7' });
  s.message(init('mcpbeat'), { ip: '198.51.100.2' });
  s.message(call, { ip: '198.51.100.2' });
  s.message(call, { ip: '192.0.2.9' });                        // never said who it is
  const day = s.snapshot().days[new Date().toISOString().slice(0, 10)];
  assert.deepStrictEqual(day.callKinds, { claude: 1, chatgpt: 1, app: 1, scanner: 1, unknown: 1 });
  assert.deepStrictEqual(day.userKinds, { claude: 1, chatgpt: 1, app: 1, scanner: 1, unknown: 1 });
});

test('users are counted once a day by a keyed hash, by country and app, and no address is kept', () => {
  const { createStats } = require('../src/stats');
  const s = createStats(null);
  const init = (name) => ({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { clientInfo: { name } } });
  const call = { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_ayah' } };
  s.message(init('claude-code'), { ip: '203.0.113.7', country: 'SA' });
  s.message(call, { ip: '203.0.113.7', country: 'SA' });
  s.message(init('claude-code'), { ip: '203.0.113.7', country: 'SA' });   // the same caller again
  s.message(init('cursor'), { ip: '203.0.113.7', country: 'SA' });        // and in another app
  s.message(init('claude-ai'), { ip: '198.51.100.2', country: 'US' });
  s.message(call, { ip: '192.0.2.9', country: 'T1' });
  const snap = s.snapshot();
  const day = snap.days[new Date().toISOString().slice(0, 10)];
  assert.strictEqual(day.users, 3);
  assert.deepStrictEqual(day.countries, { SA: 1, US: 1, '??': 1 });
  assert.deepStrictEqual(day.userClients, { 'claude-code': 1, cursor: 1, 'claude-ai': 1 });
  assert.doesNotMatch(JSON.stringify(snap), /203\.0|198\.51|192\.0/);
});

test('what readers ask is counted as totals of fixed choices; scanners, free text and quotes are not', () => {
  const { createStats } = require('../src/stats');
  const s = createStats(null);
  const init = (name) => ({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { clientInfo: { name } } });
  const call = (name, args) => ({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name, arguments: args } });
  const reader = { ip: '203.0.113.7', country: 'SA' }, scanner = { ip: '198.51.100.2', country: 'US' };
  // As the server does: the message is counted, then the tool answers within its caller
  const ask = (who, name, args, r = { content: [{ type: 'text', text: 'ok' }] }) => {
    s.message(call(name, args), who);
    s.within(who, () => s.outcome(name, args, r, 12));
  };
  s.message(init('claude-ai'), reader);
  ask(reader, 'get_ayah', { surah: 2, ayah: 255, translation: 'sahih' });
  ask(reader, 'search', { query: 'my name is Ahmad', translation: 'sahih' });
  s.message(init('agentrank-probe'), scanner);
  ask(scanner, 'get_ayah', { surah: 1, ayah: 1 });
  // An assistant's call from another of its addresses, never introduced, is a reader's all the same
  ask({ ip: '192.0.2.44', country: 'US' }, 'get_tafsir', { surah: 36, ayah: 1 });
  s.failed('get_recitation', 'No reciter "afasy"; list_reciters gives the ids.');
  const day = s.snapshot().days[new Date().toISOString().slice(0, 10)];
  assert.deepStrictEqual(day.asked.get_ayah, { surah: { 2: 1 }, translation: { sahih: 1 } });
  assert.deepStrictEqual(day.asked.search, { translation: { sahih: 1 } });
  assert.deepStrictEqual(day.asked.get_tafsir, { surah: { 36: 1 } });
  assert.deepStrictEqual(day.failed.get_recitation, { 'No reciter "…"; list_reciters gives the ids.': 1 });
  assert.doesNotMatch(JSON.stringify(day), /Ahmad|afasy|"1":|203\.0/);
  // The last calls keep the choices, never the words of a search
  assert.doesNotMatch(JSON.stringify(s.snapshot().recent), /Ahmad|203\.0/);
  assert.deepStrictEqual(day.health.get_ayah, { calls: 1, errors: 0, speed: [1, 0, 0, 0, 0] });
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
