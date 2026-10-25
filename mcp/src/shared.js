/**
 * What the tools and the file addresses share: the limits on one call, the
 * folding a search does, and the shape of an answer.
 */
'use strict';

const MAX_AYAHS = 50;      // one call's worth: enough for a passage, not for copying the Quran out
const MAX_RESULTS = 50;
const DEFAULT_TRANSLATION = 'hilali';   // the King Fahd Complex's English, as the site opens on

/* Diacritics and the letters spelled more than one way, folded away on both
   sides, so a search typed without them still finds the ayah */
function fold(s) {
  return String(s)
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

function reply(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

function fail(message) {
  return { content: [{ type: 'text', text: message }], isError: true };
}

/** Why a run of ayahs cannot be given, or null if it can. */
function checkAyahs(q, s, from, to) {
  const info = q.surah(s);
  if (!info) return `There is no surah ${s}; surahs are 1-114.`;
  if (from < 1 || from > info.v) return `Surah ${s} (${info.en}) has ${info.v} ayahs.`;
  if (to < from || to > info.v) return `"to" must be between ${from} and ${info.v}.`;
  if (to - from + 1 > MAX_AYAHS) return `At most ${MAX_AYAHS} ayahs a call; ask for ${from}-${from + MAX_AYAHS - 1}, then go on.`;
  return null;
}

/** "Hilali and Khan (English)", for saying which translation an answer is in. */
function translationName(q, id) {
  const t = q.translationInfo(id);
  return t ? `${t.name.en} (${t.language.en})` : id;
}

module.exports = { MAX_AYAHS, MAX_RESULTS, DEFAULT_TRANSLATION, fold, reply, fail, checkAyahs, translationName };
