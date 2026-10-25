/**
 * The Quran as the site has it, read from the site's own files.
 *
 * Nothing here is a second copy: the Arabic is data/quran-uthmani.txt as the
 * surah pages print it (through scripts/surah-text.js, so the basmala is
 * lifted off verse 1 the same way), and everything else is public/data, the
 * files the reader fetches. A deploy that changes them changes this too, on
 * the next restart.
 *
 * The small catalogues are read once. A surah's translation, tafsir, word
 * list or timing is read the first time it is asked for and kept in a
 * bounded cache, so memory stays near what the handful of surahs being
 * asked about weigh, not the 30 MB the translations weigh together.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SITE = 'https://readqurantoday.com';
const AUDIO = 'https://audio.readqurantoday.com';

function open(root) {
  const PUBLIC = path.join(root, 'public');
  const DATA = path.join(PUBLIC, 'data');
  const json = (...p) => JSON.parse(fs.readFileSync(path.join(...p), 'utf8'));

  const surahs = json(DATA, 'surahs.json');
  const translations = json(DATA, 'translations.json');
  const recitations = json(DATA, 'recitations.json');
  const byTranslation = new Map(translations.map((t) => [t.id, t]));
  const byRecitation = new Map(recitations.recitations.map((r) => [r.id, r]));

  /* The Arabic, as the surah pages print it */
  const surahText = require(path.join(root, 'scripts', 'surah-text.js'));
  const arabic = surahText.spellings(surahs);

  /* The plain text the site's search runs on: "surah|ayah|text", no diacritics */
  const plain = fs.readFileSync(path.join(DATA, 'quran-simple.txt'), 'utf8').split('\n')
    .map((l) => l.split('|')).filter((p) => p.length === 3)
    .map(([s, a, t]) => ({ s: +s, a: +a, t }));

  /* Where each ayah begins in the mushaf. A page's word list ends each ayah
     with its number in Arabic figures, so counting those across the 604
     pages, in order, numbers all 6236 ayahs. */
  const pageOf = [];      // global ayah index -> page
  {
    let i = 0;
    for (let p = 1; p <= 604; p++) {
      for (const w of json(DATA, 'words', `p${p}.json`)) {
        if (pageOf[i] === undefined) pageOf[i] = p;
        if (/^[٠-٩]+$/.test(w)) i++;
      }
    }
    if (i !== 6236) throw new Error(`counted ${i} ayahs across the pages, not 6236`);
  }
  const first = [];       // surah -> global index of its ayah 1
  surahs.reduce((n, s) => { first[s.id] = n; return n + s.v; }, 0);

  /* Per-surah files, the least recently asked for dropped first */
  const cache = new Map();
  const MAX = 150;
  function file(key, keep, ...p) {
    if (cache.has(key)) {
      const v = cache.get(key);
      cache.delete(key);
      cache.set(key, v);
      return v;
    }
    const f = path.join(...p);
    const v = fs.existsSync(f) ? keep(JSON.parse(fs.readFileSync(f, 'utf8'))) : null;
    cache.set(key, v);
    if (cache.size > MAX) cache.delete(cache.keys().next().value);
    return v;
  }

  function surah(id) { return surahs[id - 1] || null; }

  function page(s, a) { return pageOf[first[s] + a - 1]; }

  function link(s) { return `${SITE}/surah/${s}/`; }

  /* Each ayah has its own page: the Arabic, a translation, the tafsir and its words */
  function ayahLink(s, a) { return `${SITE}/surah/${s}/${a}/`; }

  /* The reader, opened on the mushaf page the ayah is on, to read and listen */
  function readerLink(s, a) { return a ? `${SITE}/surah/${s}/?ayah=${a}` : link(s); }

  const whole = (v) => v;

  function translation(id, s) {
    return byTranslation.has(id) ? file(`t:${id}:${s}`, whole, DATA, 'translation', id, `${s}.json`) : null;
  }

  function tafsir(s) { return file(`f:${s}`, whole, DATA, 'tafsir', 'muyassar', `${s}.json`); }

  /* Each word's Latin reading and its meaning; English is meaning/, the
     other languages meaning/<lang>/ */
  function words(s, lang) {
    const latin = file(`l:${s}`, whole, DATA, 'translit', `${s}.json`);
    const meaning = lang && lang !== 'en'
      ? file(`m:${lang}:${s}`, whole, DATA, 'meaning', lang, `${s}.json`)
      : file(`m:en:${s}`, whole, DATA, 'meaning', `${s}.json`);
    return { latin, meaning };
  }

  function wordLanguages() {
    return ['en'].concat(fs.readdirSync(path.join(DATA, 'meaning'))
      .filter((d) => fs.statSync(path.join(DATA, 'meaning', d)).isDirectory()).sort());
  }

  /* Each ayah as the mushaf prints it, for the player: QCF V2 glyphs, one a word,
     in pieces by page, since each page has its own font. A glyph in the page's
     marks closes an ayah, as public/js/mushaf.js reads them (ayahIndex). */
  let mushafAyahs = null;
  function mushaf(s) {
    if (!mushafAyahs) {
      const m = json(DATA, 'mushaf.json');
      mushafAyahs = {};
      let su = 0, v = 1;
      for (let p = 1; p <= 604; p++) {
        const marks = m.marks[p] || '';
        for (const line of m.pages[p] || []) {
          if (line.t === 'surah') { su = line.s; v = 1; mushafAyahs[su] = []; continue; }
          if (line.t !== 'ayah') continue;
          for (const g of line.v2.split('|')) {
            const ayah = mushafAyahs[su][v - 1] || (mushafAyahs[su][v - 1] = []);
            const last = ayah[ayah.length - 1];
            if (last && last[0] === p) last[1].push(g); else ayah.push([p, [g]]);
            if (marks.indexOf(g) >= 0) v++;
          }
        }
      }
    }
    return mushafAyahs[s] || null;
  }

  /* A timing file also times every word, which is most of its weight and
     nothing asked for here: only where each ayah falls is kept. */
  const ayahTimes = (t) => ({ audioPath: t.audioPath, duration: t.duration, ayah: t.ayah });

  const timingName = (id, s) => `${String(s).padStart(3, '0')}.${id}.timing.json`;

  function timing(id, s) {
    return byRecitation.has(id) ? file(`r:${id}:${s}`, ayahTimes, PUBLIC, 'surah', String(s), timingName(id, s)) : null;
  }

  /* The whole timing file, words and all, as the site serves it */
  function timingLink(id, s) { return `${SITE}/surah/${s}/${timingName(id, s)}`; }

  return {
    SITE, AUDIO, surahs, translations, recitations, arabic, plain,
    surah, page, link, ayahLink, readerLink, translation, tafsir, words, wordLanguages, timing, mushaf, timingLink, hafs: surahText.hafs,
    hasTranslation: (id) => byTranslation.has(id),
    translationInfo: (id) => byTranslation.get(id) || null,
    recitation: (id) => byRecitation.get(id) || null,
  };
}

module.exports = { open };
