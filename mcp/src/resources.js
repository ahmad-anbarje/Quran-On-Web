/**
 * The site's files by address, for clients that read resources rather than
 * call tools. One pattern each covers every surah, every translation and
 * every recording the catalogues list, so new data needs no new code:
 *
 *   quran://surah/{surah}                    the Arabic
 *   quran://translation/{id}/{surah}         a translation
 *   quran://tafsir/{surah}                   the Tafsir al-Muyassar
 *   quran://recitation/{reciter}/{surah}     a recording's link and timings
 */
'use strict';

const { ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { translationName } = require('./shared');

function registerResources(server, q) {
  const asJson = (uri, value) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(value) }] });
  const num = (v, lo, hi) => { const n = Number(v); return Number.isInteger(n) && n >= lo && n <= hi ? n : null; };

  server.registerResource('surah', new ResourceTemplate('quran://surah/{surah}', {
    list: () => ({ resources: q.surahs.map((s) => ({ uri: `quran://surah/${s.id}`, name: `${s.id}. ${s.en}` })) }),
  }), { title: 'A surah in Arabic', mimeType: 'application/json' }, (uri, { surah }) => {
    const s = num(surah, 1, 114);
    if (!s) throw new Error('surah must be 1-114');
    const info = q.surah(s);
    return asJson(uri, { number: s, name: info.en, arabic: info.name, basmala: q.arabic[s].basmala, ayahs: q.arabic[s].uthmani, link: q.link(s) });
  });

  server.registerResource('translation', new ResourceTemplate('quran://translation/{id}/{surah}', { list: undefined }),
    { title: 'A surah in a translation', mimeType: 'application/json' }, (uri, { id, surah }) => {
      const s = num(surah, 1, 114);
      if (!s || !q.hasTranslation(id)) throw new Error('unknown translation id or surah');
      return asJson(uri, { surah: s, translation: translationName(q, id), ayahs: q.translation(id, s), link: q.link(s) });
    });

  server.registerResource('tafsir', new ResourceTemplate('quran://tafsir/{surah}', { list: undefined }),
    { title: 'A surah\'s Tafsir al-Muyassar', mimeType: 'application/json' }, (uri, { surah }) => {
      const s = num(surah, 1, 114);
      if (!s) throw new Error('surah must be 1-114');
      return asJson(uri, { surah: s, tafsir: 'Al-Muyassar', ayahs: q.tafsir(s), link: q.link(s) });
    });

  server.registerResource('recitation', new ResourceTemplate('quran://recitation/{reciter}/{surah}', { list: undefined }),
    { title: 'A recording of a surah: its link and timings', mimeType: 'application/json' }, (uri, { reciter, surah }) => {
      const s = num(surah, 1, 114);
      const t = s && q.timing(reciter, s);
      if (!t) throw new Error('unknown reciter or surah');
      return asJson(uri, { surah: s, reciter, audio: `${q.AUDIO}/${t.audioPath}`, duration: t.duration, ayahs: t.ayah });
    });
}

module.exports = { registerResources };
