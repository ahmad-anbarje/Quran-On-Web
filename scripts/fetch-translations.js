/**
 * The meaning beside the text: translations of each ayah, the Tafsir
 * al-Muyassar, and the English of each word.
 *
 *   node scripts/fetch-translations.js
 *
 * Writes, one file a surah, each an array with one entry an ayah:
 *
 *   public/data/translation/sahih/<n>.json   Saheeh International
 *   public/data/translations.json            its entry in the list, for the picker
 *   public/data/tafsir/muyassar/<n>.json     التفسير الميسر, King Fahd Complex
 *   public/data/meaning/<n>.json             each word's English, as an array
 *                                            a word, lined up with translit/
 *
 * Only Saheeh International is fetched here; every other translation comes
 * from QuranEnc through fetch-quranenc.py, each credited as QuranEnc credits it.
 *
 * Run once; the result is committed and served from here, so nothing at
 * runtime asks anyone else for anything.
 *
 * The ayah texts are Tanzil's, by way of fawazahmed0/quran-api on GitHub. The
 * words are Quran.com's word-by-word data, packaged on npm. The words are only
 * written if every ayah's Latin, in that same data, is word for word the Latin
 * already in public/data/translit — the label draws both from one index, so
 * one word out of step would put every meaning after it under the wrong word.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'public', 'data');

const EDITIONS = 'https://raw.githubusercontent.com/fawazahmed0/quran-api/1/editions/';
const WORDS = { name: '@kmaslesa/holy-quran-word-by-word-full-data', version: '1.0.6' };

/* Saheeh International, from Tanzil. Every other translation is QuranEnc's,
   written by fetch-quranenc.py, which owns the rest of translations.json. */
const TRANSLATIONS = [
  { id: 'sahih', edition: 'eng-ummmuhammad', lang: 'en', complex: false,
    language: { en: 'English', ar: 'الإنجليزية', native: 'English' },
    name: { en: 'Saheeh International', ar: 'صحيح إنترناشيونال' } },
];

/* Footnote numbers whose footnotes are not in the text: [١], [12], [১]. Only
   for the translations marked as carrying them: elsewhere a number in brackets
   can be the text's own, as the tafsir's "the ayah before, no. [50]". */
const FOOTNOTE = /\s*\[\s*[\d\u0660-\u0669\u06f0-\u06f9\u09e6-\u09ef]+\s*\]/g;

function clean(text) {
  /* and, in two places in the Bengali, the ayah's own number left at its head */
  return text.replace(FOOTNOTE, '').replace(/^[\d\u09e6-\u09ef]+\.\s*/, '').replace(/\s+([,.;:!?،])/g, '$1').replace(/\s{2,}/g, ' ').trim();
}

const surahs = JSON.parse(fs.readFileSync(path.join(DATA, 'surahs.json'), 'utf8'));

async function get(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ': ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

/** One edition, as surah -> its ayahs' texts, checked against the index. */
async function edition(id, footnotes) {
  const rows = JSON.parse(await get(EDITIONS + id + '.json')).quran;
  const by = surahs.map(() => []);
  for (const row of rows) by[row.chapter - 1][row.verse - 1] = footnotes ? clean(row.text) : row.text.trim();
  surahs.forEach((s, i) => {
    const got = by[i].filter(Boolean).length;
    if (got !== s.v) throw new Error(`${id}: surah ${s.id} has ${got} ayahs of ${s.v}`);
  });
  return by;
}

/** One file out of an npm tarball, without unpacking it or running anything in it. */
function fromTar(tgz, want) {
  const tar = zlib.gunzipSync(tgz);
  for (let at = 0; at + 512 <= tar.length;) {
    const head = tar.subarray(at, at + 512);
    if (!head[0]) break;
    const field = (a, b) => head.subarray(a, b).toString('utf8').replace(/\0.*$/s, '');
    const name = (field(345, 500) ? field(345, 500) + '/' : '') + field(0, 100);
    const size = parseInt(field(124, 136).trim() || '0', 8);
    if (name === want) return tar.subarray(at + 512, at + 512 + size);
    at += 512 + Math.ceil(size / 512) * 512;
  }
  throw new Error(want + ' is not in the package');
}

/** Each word's English, as surah -> ayah -> words, checked against translit/. */
async function words() {
  const meta = JSON.parse(await get(`https://registry.npmjs.org/${WORDS.name}/${WORDS.version}`));
  const pages = JSON.parse(fromTar(await get(meta.dist.tarball), 'package/data.json'));

  const at = new Map();     // "s:v" -> position -> word
  for (const page of pages) {
    for (const ayah of page.ayahs || []) {
      for (const w of ayah.words || []) {
        if (!w || w.char_type_name !== 'word') continue;
        if (!at.has(w.parentAyahVerseKey)) at.set(w.parentAyahVerseKey, new Map());
        at.get(w.parentAyahVerseKey).set(w.position, w);
      }
    }
  }

  return surahs.map((s) => {
    const latin = JSON.parse(fs.readFileSync(path.join(DATA, 'translit', s.id + '.json'), 'utf8'));
    return latin.map((said, i) => {
      const key = s.id + ':' + (i + 1);
      const row = at.get(key);
      const list = row ? [...row.keys()].sort((a, b) => a - b).map((p) => row.get(p)) : [];
      const theirs = list.map((w) => w.transliteration && w.transliteration.text);
      if (theirs.join('|') !== said.join('|')) {
        throw new Error(`${key}: the words do not line up with translit/\n  ours   ${said.join(' ')}\n  theirs ${theirs.join(' ')}`);
      }
      return list.map((w) => ((w.translation && w.translation.text) || '').trim());
    });
  });
}

function write(dir, by) {
  const into = path.join(DATA, dir);
  fs.mkdirSync(into, { recursive: true });
  by.forEach((list, i) => fs.writeFileSync(path.join(into, (i + 1) + '.json'), JSON.stringify(list)));
  const kb = by.reduce((n, list) => n + JSON.stringify(list).length, 0) / 1024;
  console.log(`${dir.padEnd(22)} ${by.length} files, ${Math.round(kb)} KB`);
}

(async () => {
  for (const t of TRANSLATIONS) write('translation/' + t.id, await edition(t.edition, t.footnotes));
  // Only these entries are ours; the rest of the list is QuranEnc's and is kept as it stands
  const file = path.join(DATA, 'translations.json');
  const listed = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  const ours = TRANSLATIONS.map((t) => ({
    id: t.id, lang: t.lang, dir: t.dir || 'ltr', complex: t.complex, language: t.language, name: t.name,
    source: 'tanzil',
  }));
  const rest = listed.filter((t) => !ours.some((o) => o.id === t.id));
  const english = rest.filter((t) => t.language.en === 'English');
  fs.writeFileSync(file, JSON.stringify([...english.slice(0, 1), ...ours, ...english.slice(1),
    ...rest.filter((t) => t.language.en !== 'English')]));
  write('tafsir/muyassar', await edition('ara-kingfahadquranc'));
  write('meaning', await words());
})().catch((e) => { console.error(e.message); process.exit(1); });
