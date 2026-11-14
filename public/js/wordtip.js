/**
 * The label over a word of the page: how the word sounds, in Latin letters,
 * and under a rule, what it means.
 *
 * The same the Android app shows. The Latin reading and the English meanings
 * are one file a surah each, fetched when that surah is opened; where the
 * translation the reader chose has its words here too (Urdu, Indonesian,
 * Bengali, Turkish, Persian, Hindi), the meaning is in that language, with
 * English standing in until it arrives. On unless the reader turned it off.
 *
 * The player (recite.js) says which word is to be labelled, through init(),
 * and asks for the label again whenever that word changes.
 */
(function (global) {
  'use strict';

  function stored(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function store(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* denied */ }
  }

  /* On unless the reader turned it off, as in the app. */
  var LATIN_KEY = 'quran-latin';
  var latinOn = stored(LATIN_KEY) !== '0';
  var latin = {};               // surah id -> its ayahs' words, or the fetch for them
  var meanings = { en: {} };    // language -> the same, each word's meaning, under the Latin
  var latinSurah = null;        // the surah the labels are for
  /* The word meanings there are besides English, and the two of them written right to left */
  var WORD_LANGS = { ur: 1, id: 1, bn: 1, tr: 1, fa: 1, hi: 1 };
  var RTL_LANGS = { ur: 1, fa: 1 };
  /* The language of the translation the reader chose, where its words are here too */
  function wordsLang() {
    var l = stored('quran-translation-lang');
    return WORD_LANGS[l] ? l : 'en';
  }
  var tip = null;               // the label over the marked word

  /* The word to label, as the player has it: the one under the pointer first,
     then the marked one, since reading along by mouse is asking what each word
     says. Null until the player lends it. */
  var marked = function () { return null; };

  function loadLatin(id) {
    latinSurah = id;
    fetchWords(latin, '/data/translit/', id);
    /* The words' meaning, from one index with the Latin: the same ayah and
       word numbers find both. English always, to stand in for a word the
       chosen language has not arrived for yet. */
    fetchWords(meanings.en, '/data/meaning/', id);
    var l = wordsLang();
    if (l !== 'en') fetchWords(meanings[l] = meanings[l] || {}, '/data/meaning/' + l + '/', id);
  }

  function fetchWords(into, base, id) {
    if (into[id]) return;
    into[id] = fetch(base + id + '.json')
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (list) { into[id] = list; sayLatin(); })
      .catch(function () { delete into[id]; });
  }

  function wordOf(into, key, w) {
    var list = into[+key[0]];
    var ayah = Array.isArray(list) ? list[+key[1] - 1] : null;
    return ayah ? ayah[w] || null : null;
  }

  /* Placed by measuring the word, not inside it: the word's own font is the
     page's, which has no Latin letters, and a line can be clipped by its sheet. */
  function sayLatin() {
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'r-latin';
      tip.setAttribute('aria-hidden', 'true');
      tip.hidden = true;
      /* Two lines: how the word sounds, and under a rule, what it means. Set
         as text, never markup, since both come out of data files. */
      tip.innerHTML = '<span class="r-say"></span><span class="r-mean"></span>';
      document.body.appendChild(tip);
    }
    var word = marked();
    var said = null, means = null, l = wordsLang(), inLang = 'en';
    if (latinOn && word && word.dataset.a && word.dataset.w !== undefined) {
      var key = word.dataset.a.split(':');
      said = wordOf(latin, key, +word.dataset.w);
      means = l !== 'en' && meanings[l] ? wordOf(meanings[l], key, +word.dataset.w) : null;
      if (means) inLang = l;
      else means = wordOf(meanings.en, key, +word.dataset.w);
    }
    var r = said || means ? word.getBoundingClientRect() : null;
    /* A word turned off the screen takes its label with it. */
    if (!r || r.bottom < 0 || r.top > window.innerHeight || !r.width) { tip.hidden = true; return; }

    tip.firstChild.textContent = said || '';
    tip.firstChild.hidden = !said;
    tip.lastChild.textContent = means || '';
    tip.lastChild.hidden = !means;
    tip.lastChild.setAttribute('lang', inLang);
    tip.lastChild.setAttribute('dir', RTL_LANGS[inLang] ? 'rtl' : 'ltr');
    tip.hidden = false;
    var t = tip.getBoundingClientRect();
    /* Clear of the marks above the letters; below the word where there is no room above. */
    var gap = r.height * 0.18 + 4;
    var top = r.top - t.height - gap;
    if (top < 8) top = r.bottom + gap;
    var left = Math.max(8, Math.min(window.innerWidth - t.width - 8, r.left + r.width / 2 - t.width / 2));
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }

  /* Scrolling and resizing move the word under a label that stays put; one
     measure a frame is plenty. */
  var tipFrame = null;
  function chaseLatin() {
    if (tipFrame || !tip || tip.hidden) return;
    tipFrame = requestAnimationFrame(function () { tipFrame = null; sayLatin(); });
  }
  document.addEventListener('scroll', chaseLatin, true);
  window.addEventListener('resize', chaseLatin);

  /* The reader chose another translation: its language's words, where there are any */
  document.addEventListener('meaning:lang', function () {
    if (latinSurah) loadLatin(latinSurah);
    sayLatin();
  });

  global.WordTip = {
    /** [which] answers with the word to label now, or null. */
    init: function (which) { marked = which; },
    /** Fetch the labels for surah [id]. */
    load: loadLatin,
    /** Say the label again: the word, or where it stands, has changed. */
    say: sayLatin,
    on: function () { return latinOn; },
    toggle: function () {
      latinOn = !latinOn;
      store(LATIN_KEY, latinOn ? '1' : '0');
      sayLatin();
    },
  };

}(window));
