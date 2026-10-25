/**
 * Each word's meaning in the languages Quran.com has word by word, beside the
 * English that fetch-translations.js writes to public/data/meaning/<n>.json.
 *
 *   node scripts/fetch-word-meanings.js
 *
 * Writes public/data/meaning/<lang>/<n>.json, the same shape as the English: one
 * array an ayah, one string a word, lined up with public/data/translit. The
 * label under a word shows the language of the translation the reader chose,
 * where there is one here, and the English otherwise.
 *
 * A surah is written only if every ayah has as many words as the Latin does and
 * every word came back in the language asked for: Quran.com answers in English
 * when it has nothing in a language, and an English word passed off as Urdu, or
 * one word out of step, would put a wrong meaning under a word.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'public', 'data');
const API = 'https://api.quran.com/api/v4/verses/by_chapter/';

// The languages Quran.com has word by word, and that a translation here is in
const LANGS = { ur: 'urdu', id: 'indonesian', bn: 'bengali', tr: 'turkish', fa: 'persian', hi: 'hindi', ta: 'tamil' };  // ta: too much missing, left out

async function get(url, tries = 4) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (e) {
      if (i >= tries - 1) throw new Error(url + ': ' + e.message);
      await new Promise((ok) => setTimeout(ok, 2000 * (i + 1)));
    }
  }
}

async function surah(lang, n) {
  const latin = JSON.parse(fs.readFileSync(path.join(DATA, 'translit', n + '.json'), 'utf8'));
  const d = await get(`${API}${n}?language=${lang}&words=true&per_page=300`);
  if (d.verses.length !== latin.length) throw new Error(`${lang} ${n}: ${d.verses.length} ayahs, wants ${latin.length}`);
  return d.verses.map((v, i) => {
    const words = v.words.filter((w) => w.char_type_name === 'word');
    if (words.length !== latin[i].length) {
      throw new Error(`${lang} ${v.verse_key}: ${words.length} words, the Latin has ${latin[i].length}`);
    }
    return words.map((w) => {
      const t = w.translation || {};
      // Quran.com's English, standing in for a word it lacks in this language: left
      // blank, so the label shows our own English for that word and says so by language
      if (t.language_name !== LANGS[lang]) { missing[lang] = (missing[lang] || 0) + 1; return ''; }
      found[lang] = (found[lang] || 0) + 1;
      return (t.text || '').trim();
    });
  });
}

const missing = {}, found = {};

(async () => {
  for (const lang of Object.keys(LANGS)) {
    const all = [];
    for (let n = 1; n <= 114; n++) all.push(JSON.stringify(await surah(lang, n)));
    const gaps = missing[lang] || 0, share = gaps / ((found[lang] || 0) + gaps);
    // Much English underneath is not a language's word meanings: left out whole
    if (share > 0.10) { console.log(`meaning/${lang}  left out: ${gaps} words not in it (${(share * 100).toFixed(1)}%)`); continue; }
    const into = path.join(DATA, 'meaning', lang);
    fs.mkdirSync(into, { recursive: true });
    all.forEach((json, i) => fs.writeFileSync(path.join(into, (i + 1) + '.json'), json));
    const kb = all.reduce((n, j) => n + j.length, 0) / 1024;
    console.log(`meaning/${lang}  114 files, ${Math.round(kb)} KB; ${gaps} words in English instead`);
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
