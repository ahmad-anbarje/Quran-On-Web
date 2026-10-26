/**
 * Files to save: a surah as plain text, made when its link is opened, and
 * the data sets a developer builds on.
 *
 *   /mcp/files/surah-18.txt                         the Arabic
 *   /mcp/files/surah-18.txt?translation=hilali      each ayah with its translation
 *   /mcp/files/surah-18.txt?tafsir=1                and the Tafsir al-Muyassar
 *   /mcp/files/quran-uthmani.txt                    Tanzil's Uthmani text, as kept in data/
 *   /mcp/files/translation-hilali.json              a translation, all 114 surahs in one
 *   /mcp/files/tafsir-muyassar.json                 the tafsir, all 114 in one
 *
 * Only these: each path is matched whole against a pattern here and an id
 * against the catalogue, and the file read is one this module names, so no
 * request can name a file on the server. The rest of the data sets are
 * already on the site under /data/, and DATASETS points there.
 *
 * get_file hands an assistant the link rather than the text itself: a surah
 * with its translation is tens of thousands of words, which belong in the
 * reader's downloads, not in the conversation. The recordings need nothing
 * here; their MP3s are on the audio host already.
 */
'use strict';

const { translationName, saveLink } = require('./shared');

const PATH = /^\/mcp\/files\/surah-(\d{1,3})\.txt$/;
const UTHMANI = '/mcp/files/quran-uthmani.txt';
const TAFSIR = '/mcp/files/tafsir-muyassar.json';
const TRANSLATION = /^\/mcp\/files\/translation-([a-z0-9_-]{1,40})\.json$/;

/* The data sets, each with where it is, what it holds and whose it is */
function datasets(q) {
  const D = `${q.SITE}/data`, F = `${q.SITE}/mcp/files`;
  return [
    { id: 'quran-uthmani', url: `${F}/quran-uthmani.txt`, format: 'text, one ayah a line, surah by surah',
      holds: 'The Quran in the Uthmani script with full diacritics', source: 'Tanzil (tanzil.net); verbatim, with its notice' },
    { id: 'quran-simple', url: `${D}/quran-simple.txt`, format: 'text, "surah|ayah|text" a line',
      holds: 'The Quran in simple script, no diacritics, as the site searches it', source: 'Tanzil (tanzil.net)' },
    { id: 'mushaf', url: `${D}/mushaf.json`, format: 'JSON',
      holds: 'The Madinah Mushaf\'s 604 pages line by line, each word as its QCF V2 glyph; fonts at /fonts/v2/p<page>.woff2',
      source: 'King Fahd Complex (QCF V2), layout from Quran.com' },
    { id: 'surahs', url: `${D}/surahs.json`, format: 'JSON', holds: 'The 114 surahs: names, ayah counts, pages' },
    { id: 'translations', url: `${D}/translations.json`, format: 'JSON', holds: `The ${q.translations.length} translations: ids, languages, translators, sources` },
    { id: 'recitations', url: `${D}/recitations.json`, format: 'JSON', holds: 'The reciters, by id' },
    { id: 'translation', url: `${F}/translation-<id>.json`, format: 'JSON, { translation, surahs: [114 arrays of ayahs] }',
      holds: 'One translation whole; the ids are in translations.json', source: 'QuranEnc and Tanzil, as translations.json names for each' },
    { id: 'tafsir', url: `${F}/tafsir-muyassar.json`, format: 'JSON, { tafsir, surahs: [114 arrays of ayahs] }',
      holds: 'Al-Tafsir al-Muyassar, Arabic', source: 'King Fahd Complex' },
    { id: 'words', url: `${D}/translit/<surah>.json, ${D}/meaning/<surah>.json, ${D}/meaning/<lang>/<surah>.json`,
      format: 'JSON, per surah: an array a ayah, a string a word', holds: 'Each word\'s Latin reading, and its meaning in English or another language',
      source: 'Quran.com word by word' },
    { id: 'timing', url: `${q.SITE}/surah/<surah>/<sss>.<reciter>.timing.json`, format: 'JSON, milliseconds',
      holds: 'Where each ayah and word of a recording starts and ends; <sss> is the surah in three figures' },
  ].map((d) => (d.url.includes('<') ? d : { ...d, download: saveLink(d.url) }));
}

/* A whole data set made from the per-surah files, as one. A few megabytes
   to put together, so the last few made are kept: asking again and again
   costs the server nothing more */
const built = new Map();
const KEEP = 6;
function wholeSet(q, label, part) {
  const key = JSON.stringify(label);
  if (built.has(key)) return built.get(key);
  const body = JSON.stringify({ ...label, surahs: q.surahs.map((s) => part(s.id)) });
  built.set(key, body);
  if (built.size > KEEP) built.delete(built.keys().next().value);
  return body;
}

function fileUrl(q, s, { translation, tafsir } = {}) {
  const p = new URLSearchParams();
  if (translation) p.set('translation', translation);
  if (tafsir) p.set('tafsir', '1');
  const query = p.toString();
  return `${q.SITE}/mcp/files/surah-${s}.txt${query ? '?' + query : ''}`;
}

/* "surah-18-al-kahf-hilali-tafsir.txt": what the browser saves it as */
function fileName(q, s, { translation, tafsir } = {}) {
  const slug = q.surah(s).en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return [`surah-${s}`, slug, translation, tafsir && 'tafsir'].filter(Boolean).join('-') + '.txt';
}

/** The file's text, or null if the surah or translation is not there. */
function surahFile(q, s, { translation, tafsir } = {}) {
  const info = q.surah(s);
  if (!info || (translation && !q.hasTranslation(translation))) return null;
  const text = translation ? q.translation(translation, s) : null;
  const notes = tafsir ? q.tafsir(s) : null;
  const out = [
    `سورة ${info.name} · Surah ${info.en} (${s}), ${info.v} ayahs`,
    'The Madinah Mushaf, Hafs',
    ...(text ? [`Translation: ${translationName(q, translation)}`] : []),
    ...(notes ? ['التفسير الميسر، مجمع الملك فهد لطباعة المصحف الشريف'] : []),
    `From ${q.link(s)}`,
    '',
  ];
  if (q.arabic[s].basmala) out.push(q.arabic[s].basmala, '');
  q.arabic[s].uthmani.forEach((ayah, i) => {
    out.push(`${s}:${i + 1}  ${ayah}`);
    if (text) out.push(text[i]);
    if (notes) out.push(`التفسير: ${notes[i]}`);
    out.push('');
  });
  return out.join('\n');
}

function send(req, res, type, name, body) {
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Disposition': `attachment; filename="${name}"`,
    'Cache-Control': 'public, max-age=86400',
  });
  res.end(req.method === 'HEAD' ? undefined : body);
  return true;
}

/** Answers GET /mcp/files/...; false when the path is not one of these. */
function serveFile(q, req, res) {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === UTHMANI) return send(req, res, 'text/plain; charset=utf-8', 'quran-uthmani.txt', q.uthmaniText());
  if (url.pathname === TAFSIR) {
    return send(req, res, 'application/json; charset=utf-8', 'tafsir-muyassar.json',
      wholeSet(q, { tafsir: 'Al-Tafsir al-Muyassar, King Fahd Complex (Arabic)' }, (s) => q.tafsir(s)));
  }
  const t = TRANSLATION.exec(url.pathname);
  if (t && q.hasTranslation(t[1])) {
    return send(req, res, 'application/json; charset=utf-8', `translation-${t[1]}.json`,
      wholeSet(q, { translation: translationName(q, t[1]), id: t[1] }, (s) => q.translation(t[1], s)));
  }
  const m = PATH.exec(url.pathname);
  if (!m) return false;
  const s = Number(m[1]);
  const opts = { translation: url.searchParams.get('translation') || undefined, tafsir: url.searchParams.get('tafsir') === '1' };
  const body = surahFile(q, s, opts);
  if (body === null) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('No such surah or translation.\n');
    return true;
  }
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Disposition': `attachment; filename="${fileName(q, s, opts)}"`,
    // The same file every time until the site's data changes, which a deploy does
    'Cache-Control': 'public, max-age=86400',
  });
  res.end(req.method === 'HEAD' ? undefined : body);
  return true;
}

module.exports = { fileUrl, fileName, surahFile, serveFile, datasets };
