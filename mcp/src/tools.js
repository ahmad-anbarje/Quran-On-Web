/**
 * The tools: a few general questions an assistant or an app can ask. They
 * read the same catalogues the site does (translations.json,
 * recitations.json, surahs.json), so a translation or a reciter added to the
 * site is offered here with no change to this file.
 *
 * Every ayah an answer gives carries two links to readqurantoday.com: its
 * own page (`link`: the Arabic, a translation, the tafsir, its words) and the
 * reader opened at it (`read`: the mushaf page, to read on and listen), so an
 * assistant quoting it has a source to give and a reader a place to go.
 * Recordings are links, not the audio: they are tens of megabytes, and the
 * listener's player fetches them from the same bucket the site plays them
 * from. Files to save are links too (get_file, files.js).
 */
'use strict';

const { z } = require('zod');
const { MAX_RESULTS, DEFAULT_TRANSLATION, fold, reply, fail, checkAyahs, translationName } = require('./shared');
const { playerMeta } = require('./app');
const { fileUrl, fileName } = require('./files');

const surahArg = z.number().int().min(1).max(114).describe('Surah number, 1-114');

/* The Arabic as the search compares it, folded once rather than on every search */
const foldedArabic = new WeakMap();
function arabicIndex(q) {
  if (!foldedArabic.has(q)) foldedArabic.set(q, q.plain.map((row) => fold(row.t)));
  return foldedArabic.get(q);
}

function registerTools(server, q) {
  // The directory reads a tool's name from its annotations: the one title, given in both places
  const tool = (name, def, fn) => server.registerTool(name, { ...def, annotations: { title: def.title, ...def.annotations } }, fn);

  tool('get_ayah', {
    title: 'Get ayahs',
    description:
      'The Arabic of one ayah or a run of them (up to 50), with a translation. ' +
      'Defaults to the King Fahd Complex English (Hilali & Muhsin Khan).',
    inputSchema: {
      surah: surahArg,
      ayah: z.number().int().min(1).describe('First ayah'),
      to: z.number().int().min(1).optional().describe('Last ayah, for a run; defaults to the first'),
      translation: z.string().optional().describe('Translation id, e.g. "hilali", "sahih", "urdu_junagarhi"; "none" for the Arabic alone'),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, ({ surah: s, ayah, to, translation }) => {
    const last = to || ayah;
    const bad = checkAyahs(q, s, ayah, last);
    if (bad) return fail(bad);
    const tid = translation || DEFAULT_TRANSLATION;
    if (tid !== 'none' && !q.hasTranslation(tid)) return fail(`No translation "${tid}"; list_translations gives the ids.`);
    const text = tid === 'none' ? null : q.translation(tid, s);
    const info = q.surah(s);
    const ayahs = [];
    for (let a = ayah; a <= last; a++) {
      ayahs.push({
        ref: `${s}:${a}`,
        arabic: q.arabic[s].uthmani[a - 1],
        ...(text ? { translation: text[a - 1] } : {}),
        page: q.page(s, a),
        link: q.ayahLink(s, a),
        read: q.readerLink(s, a),
      });
    }
    return reply({
      surah: { number: s, name: info.en, arabic: info.name, ayahs: info.v },
      ...(text ? { translation: translationName(q, tid) } : {}),
      ayahs,
      link: q.link(s),
    });
  });

  tool('search', {
    title: 'Search the Quran',
    description:
      'Ayahs containing the words given: in the Arabic (diacritics optional) or, with "translation", ' +
      'in that translation. Up to 50 results, each with its reference and link.',
    inputSchema: {
      query: z.string().min(2).max(200),
      translation: z.string().optional().describe('Search this translation instead of the Arabic, e.g. "hilali"'),
      limit: z.number().int().min(1).max(MAX_RESULTS).optional().describe('Default 10'),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, ({ query, translation, limit }) => {
    const want = fold(query);
    const most = limit || 10;
    const found = [];
    let total = 0;
    if (translation) {
      if (!q.hasTranslation(translation)) return fail(`No translation "${translation}"; list_translations gives the ids.`);
      for (const info of q.surahs) {
        const text = q.translation(translation, info.id) || [];
        text.forEach((t, i) => {
          if (!fold(t).includes(want)) return;
          total++;
          if (found.length < most) {
            found.push({ ref: `${info.id}:${i + 1}`, surah: info.en, text: t, link: q.ayahLink(info.id, i + 1), read: q.readerLink(info.id, i + 1) });
          }
        });
      }
    } else {
      const index = arabicIndex(q);
      q.plain.forEach((row, i) => {
        if (!index[i].includes(want)) return;
        total++;
        if (found.length < most) {
          found.push({
            ref: `${row.s}:${row.a}`, surah: q.surah(row.s).en,
            arabic: q.arabic[row.s].uthmani[row.a - 1], link: q.ayahLink(row.s, row.a), read: q.readerLink(row.s, row.a),
          });
        }
      });
    }
    return reply({ query, in: translation ? translationName(q, translation) : 'Arabic', total, results: found });
  });

  tool('get_tafsir', {
    title: 'Get tafsir',
    description: 'The Tafsir al-Muyassar (King Fahd Complex, Arabic) of one ayah or a run of them, up to 50.',
    inputSchema: {
      surah: surahArg,
      ayah: z.number().int().min(1),
      to: z.number().int().min(1).optional(),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, ({ surah: s, ayah, to }) => {
    const last = to || ayah;
    const bad = checkAyahs(q, s, ayah, last);
    if (bad) return fail(bad);
    const text = q.tafsir(s);
    const out = [];
    for (let a = ayah; a <= last; a++) out.push({ ref: `${s}:${a}`, tafsir: text[a - 1], link: q.ayahLink(s, a), read: q.readerLink(s, a) });
    return reply({ tafsir: 'Al-Tafsir al-Muyassar, King Fahd Complex (Arabic)', ayahs: out, link: q.link(s) });
  });

  tool('word_by_word', {
    title: 'Word by word',
    description: 'Each word of an ayah: its Latin reading and its meaning, in English or one of the other languages that have word meanings.',
    inputSchema: {
      surah: surahArg,
      ayah: z.number().int().min(1),
      language: z.string().optional().describe('Language code for the meanings; default "en"'),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, ({ surah: s, ayah, language }) => {
    const bad = checkAyahs(q, s, ayah, ayah);
    if (bad) return fail(bad);
    const lang = language || 'en';
    const langs = q.wordLanguages();
    if (!langs.includes(lang)) return fail(`Word meanings are in: ${langs.join(', ')}.`);
    const { latin, meaning } = q.words(s, lang);
    const said = latin[ayah - 1], means = meaning[ayah - 1];
    // A word missing in the language is given in English, as the site shows it, and marked so
    const english = lang === 'en' ? means : q.words(s, 'en').meaning[ayah - 1];
    return reply({
      ref: `${s}:${ayah}`,
      arabic: q.arabic[s].uthmani[ayah - 1],
      language: lang,
      words: said.map((l, i) => (means[i]
        ? { position: i + 1, transliteration: l, meaning: means[i] }
        : { position: i + 1, transliteration: l, meaning: english[i], meaningLanguage: 'en' })),
      link: q.ayahLink(s, ayah),
      read: q.readerLink(s, ayah),
    });
  });

  tool('get_recitation', {
    title: 'Get a recitation',
    description:
      'The recording of a surah: a link to the MP3, its length, and where each ayah starts and ends, ' +
      'in seconds, with a link that starts at a given ayah.',
    inputSchema: {
      surah: surahArg,
      reciter: z.string().optional().describe('Reciter id; defaults to the site\'s own'),
      ayah: z.number().int().min(1).optional().describe('An ayah to start the link at'),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: playerMeta,
  }, ({ surah: s, reciter, ayah }) => {
    const id = reciter || q.recitations.default;
    const r = q.recitation(id);
    if (!r) return fail(`No reciter "${id}"; list_reciters gives the ids.`);
    const t = q.timing(id, s);
    if (!t) return fail(`${r.name} (${id}) has no recording of surah ${s} here.`);
    const info = q.surah(s);
    if (ayah && ayah > info.v) return fail(`Surah ${s} has ${info.v} ayahs.`);
    const audio = `${q.AUDIO}/${t.audioPath}`;
    const sec = (ms) => Math.round(ms) / 1000;
    const value = {
      surah: { number: s, name: info.en, arabic: info.name },
      reciter: { id, name: r.name, arabic: r.nameAr, note: r.note || undefined },
      audio,
      ...(ayah ? { startAyah: ayah, startAt: `${audio}#t=${sec(t.ayah[ayah - 1][0])}` } : {}),
      duration: Math.round(t.duration),
      ayahs: t.ayah.map(([a, b], i) => ({ ayah: i + 1, start: sec(a), end: sec(b) })),
      link: q.link(s),
      // The same recording on the site, in the mushaf, from the ayah asked for
      read: q.readerLink(s, ayah),
    };
    // The player draws from structuredContent; the mushaf's own glyphs ride in _meta, for it and not the model
    return {
      ...reply(value),
      structuredContent: value,
      _meta: { 'com.readqurantoday/mushaf': { fonts: `${q.SITE}/fonts/v2/`, ayahs: q.mushaf(s) } },
    };
  });

  tool('get_file', {
    title: 'Get a file',
    description:
      'A link to download a surah as a file: its text (the Arabic, optionally with a translation and the ' +
      'Tafsir al-Muyassar) as a .txt, or its recording as an MP3. For the recordings, leave out the surah ' +
      'for the links to all of a reciter\'s.',
    inputSchema: {
      kind: z.enum(['text', 'audio']),
      surah: surahArg.optional().describe('Surah number, 1-114; needed for text'),
      translation: z.string().optional().describe('For text: a translation id to put under each ayah, e.g. "hilali"'),
      tafsir: z.boolean().optional().describe('For text: the Tafsir al-Muyassar under each ayah'),
      reciter: z.string().optional().describe('For audio: reciter id; defaults to the site\'s own'),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, ({ kind, surah: s, translation, tafsir, reciter }) => {
    if (kind === 'text') {
      if (!s) return fail('A text file is one surah: give its number.');
      if (translation && !q.hasTranslation(translation)) return fail(`No translation "${translation}"; list_translations gives the ids.`);
      const opts = { translation, tafsir };
      const info = q.surah(s);
      return reply({
        surah: { number: s, name: info.en, arabic: info.name, ayahs: info.v },
        file: fileName(q, s, opts),
        contains: ['Arabic', ...(translation ? [translationName(q, translation)] : []), ...(tafsir ? ['Tafsir al-Muyassar'] : [])],
        download: fileUrl(q, s, opts),
        link: q.link(s),
      });
    }
    const id = reciter || q.recitations.default;
    const r = q.recitation(id);
    if (!r) return fail(`No reciter "${id}"; list_reciters gives the ids.`);
    const mp3 = (n) => {
      const t = q.timing(id, n);
      return t && { surah: n, name: q.surah(n).en, download: `${q.AUDIO}/${t.audioPath}`, minutes: Math.round(t.duration / 60) };
    };
    const files = (s ? [s] : q.surahs.map((x) => x.id)).map(mp3).filter(Boolean);
    if (!files.length) return fail(`${r.name} (${id}) has no recording of surah ${s} here.`);
    return reply({
      reciter: { id, name: r.name, arabic: r.nameAr, note: r.note || undefined },
      files,
      // An MP3 link opens in the browser's player, which has its own download button
      note: 'Each link is the MP3 itself; the browser plays it, and saves it from its menu.',
      ...(s ? { link: q.link(s) } : {}),
    });
  });

  tool('list_surahs', {
    title: 'List the surahs',
    description: 'All 114 surahs: number, names, ayah count and mushaf pages.',
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, () => reply(q.surahs.map((s) => ({
    number: s.id, name: s.en, arabic: s.name, ayahs: s.v, pages: [s.from, s.to], link: q.link(s.id),
  }))));

  tool('list_translations', {
    title: 'List the translations',
    description: 'The translations on offer, optionally for one language: id, language, translator. Also which languages have word-by-word meanings.',
    inputSchema: {
      language: z.string().optional().describe('A language name or code to narrow to, e.g. "urdu" or "ur"'),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, ({ language }) => {
    const want = language ? fold(language) : null;
    // A code is matched whole ("ur" is not in "Turkish"); a name may be part of one ("kurd")
    const isCode = want && q.translations.some((t) => t.lang === want);
    const list = q.translations.filter((t) => !want || (isCode ? t.lang === want
      : [t.language.en, t.language.native, t.language.ar].some((x) => x && fold(x).includes(want))));
    return reply({
      translations: list.map((t) => ({ id: t.id, language: t.language.en, code: t.lang, translator: t.name.en })),
      wordByWordLanguages: q.wordLanguages(),
    });
  });

  tool('list_reciters', {
    title: 'List the reciters',
    description: 'The recordings on offer: id, reciter, and what tells two recordings by one voice apart.',
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, () => reply({
    default: q.recitations.default,
    reciters: q.recitations.recitations.map((r) => ({ id: r.id, name: r.name, arabic: r.nameAr, note: r.note || undefined })),
  }));
}

module.exports = { registerTools };
