/**
 * The site's own words in more languages than its Arabic and English.
 *
 * The page is written twice over, every phrase as an Arabic span and an English
 * one, and the stylesheet shows one by body[data-lang]. Another language rides
 * on the English: data-lang stays "en", and each English phrase is swapped for
 * its translation from public/i18n/<lang>.json, a list keyed by the English.
 * A phrase with no translation stays in English. Script-built text asks T().
 *
 * The language is the reader's choice, else the browser's, else Arabic.
 */
(function (global) {
  'use strict';

  /* Each language by its own name, in the order the setting lists them. */
  var LANGS = [
    { code: 'ar', name: 'العربية', dir: 'rtl' },
    { code: 'en', name: 'English', dir: 'ltr' },
    { code: 'ur', name: 'اردو', dir: 'rtl' },
    { code: 'id', name: 'Bahasa Indonesia', dir: 'ltr' },
    { code: 'bn', name: 'বাংলা', dir: 'ltr' },
    { code: 'tr', name: 'Türkçe', dir: 'ltr' },
    { code: 'fr', name: 'Français', dir: 'ltr' },
    { code: 'fa', name: 'فارسی', dir: 'rtl' },
    { code: 'hi', name: 'हिन्दी', dir: 'ltr' },
    { code: 'ms', name: 'Bahasa Melayu', dir: 'ltr' },
    { code: 'es', name: 'Español', dir: 'ltr' },
    { code: 'ru', name: 'Русский', dir: 'ltr' },
    { code: 'de', name: 'Deutsch', dir: 'ltr' },
    { code: 'zh', name: '中文', dir: 'ltr' },
  ];
  var BY = {};
  LANGS.forEach(function (l) { BY[l.code] = l; });

  var KEY = 'quran-lang';
  var DICT_KEY = 'quran-i18n';
  var VERSION = '2026-10-25b';

  function stored(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* denied */ } }

  /* The browser's first language that is here; Arabic for one that is not, as the site always was. */
  function fromBrowser() {
    var want = navigator.languages || [navigator.language || ''];
    for (var i = 0; i < want.length; i++) {
      var c = String(want[i]).toLowerCase().split('-')[0];
      if (BY[c]) return c;
    }
    return 'ar';
  }

  var ui = stored(KEY);
  if (!BY[ui]) ui = fromBrowser();
  var dict = {};

  /* The last list used comes from storage, so a return visit opens in its language at once. */
  try {
    var kept = JSON.parse(stored(DICT_KEY) || 'null');
    if (kept && kept.lang === ui && kept.v === VERSION) dict = kept.words;
  } catch (e) { /* none */ }

  function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }

  function fill(s, vars) {
    return vars ? s.replace(/\{(\w+)\}/g, function (m, k) { return k in vars ? vars[k] : m; }) : s;
  }

  /* The translation of an English phrase; "Juz 7" is looked up as "Juz {n}". */
  function word(en) {
    var key = norm(en), edge = /^(\s*)[\s\S]*?(\s*)$/.exec(en);
    var t = dict[key];
    if (!t) {
      var n = /\d+/.exec(key);
      t = n && dict[key.replace(n[0], '{n}')];
      if (t) t = t.replace('{n}', n[0]);
    }
    // The spaces around a phrase belong to the sentence it sits in
    return t ? edge[1] + t + edge[2] : en;
  }

  /** The phrase in the reader's language: Arabic as given, any other from the English. */
  function T(ar, en, vars) {
    if (ui === 'ar') return fill(ar, vars);
    return fill(ui === 'en' ? en : word(en), vars);
  }

  /* --- the page's own English, swapped in place --- */

  var ATTRS = [['data-tip-en', 'data-tip-en'], ['data-ph-en', 'data-ph-en']];

  function swap(el) {
    if (el.__en === undefined) el.__en = el.innerHTML;
    var to = ui === 'en' || ui === 'ar' ? el.__en : word(el.__en);
    if (el.innerHTML !== to) el.innerHTML = to;
  }

  function swapAttrs(el) {
    ATTRS.forEach(function (a) {
      if (!el.hasAttribute(a[0])) return;
      var keep = '__' + a[0];
      if (el[keep] === undefined) el[keep] = el.getAttribute(a[0]);
      el.setAttribute(a[0], ui === 'en' || ui === 'ar' ? el[keep] : word(el[keep]));
    });
  }

  /* The index's search box says "بحث | Search"; beyond Arabic and English,
     the Arabic and the reader's own word. */
  function placeholders() {
    var box = document.getElementById('surah-search');
    if (!box) return;
    if (box.__ph === undefined) box.__ph = box.getAttribute('placeholder');
    var own = ui === 'ar' || ui === 'en' ? null : word('Search');
    box.setAttribute('placeholder', own && own !== 'Search' ? 'بحث | ' + own : box.__ph);
  }

  function translate(root) {
    if (!root || !root.querySelectorAll) return;
    if (root === document.body) placeholders();
    if (root.classList && root.classList.contains('lang-en')) swap(root);
    root.querySelectorAll('.lang-en').forEach(swap);
    root.querySelectorAll('[data-tip-en],[data-ph-en]').forEach(swapAttrs);
  }

  /* Menus and lists are built after load: their English is swapped as it arrives. */
  var watching = false;
  function watch() {
    if (watching || !global.MutationObserver) return;
    watching = true;
    new MutationObserver(function (ms) {
      if (ui === 'ar' || ui === 'en') return;
      ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) translate(n); }); });
    }).observe(document.body, { childList: true, subtree: true });
  }

  function mark() {
    var l = BY[ui], b = document.body;
    b.setAttribute('data-lang', ui === 'ar' ? 'ar' : 'en');
    b.setAttribute('data-ui', ui);
    b.classList.toggle('ui-rtl', l.dir === 'rtl');
    document.documentElement.setAttribute('lang', ui);
    document.documentElement.setAttribute('dir', l.dir);
  }

  function told() { document.dispatchEvent(new CustomEvent('ui:lang', { detail: ui })); }

  function load(code) {
    if (code === 'ar' || code === 'en') { dict = {}; return Promise.resolve(); }
    return fetch('/i18n/' + code + '.json?v=' + VERSION)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (words) {
        if (code !== ui) return;
        dict = words;
        store(DICT_KEY, JSON.stringify({ lang: code, v: VERSION, words: words }));
      })
      .catch(function () { /* stays in English */ });
  }

  /** Change the site's language; the reader's choice is kept. */
  function set(code, keep) {
    if (!BY[code]) return Promise.resolve();
    ui = code;
    if (keep !== false) store(KEY, code);
    mark();
    translate(document.body);
    return load(code).then(function () {
      if (code !== ui) return;
      translate(document.body);
      told();
    });
  }

  function start() {
    mark();
    watch();
    translate(document.body);
    if (ui !== 'ar' && ui !== 'en') load(ui).then(function () { translate(document.body); told(); });
  }

  global.I18n = {
    LANGS: LANGS,
    T: T,
    lang: function () { return ui; },
    rtl: function () { return BY[ui].dir === 'rtl'; },
    name: function (code) { return (BY[code || ui] || {}).name; },
    set: set,
    start: start,
  };
  global.T = T;
}(window));
