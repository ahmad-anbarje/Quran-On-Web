/**
 * Translation and tafsir: what an ayah means, in a window of its own.
 *
 * Opened from the player, on the ayah the player is about, and it then keeps
 * up with the recitation: while an ayah is being read, its meaning is the one
 * on show. Two tabs, a translation and the Arabic of the Tafsir al-Muyassar,
 * one ayah at a time, with steps to the ayah either side. The translations
 * are the King Fahd Complex's, the same house as the mushaf and the tafsir, in
 * every language listed in data/translations.json; its English, Hilali and
 * Muhsin Khan, is the first, and Saheeh International stands beside it for
 * plainer English.
 *
 * A window rather than a column beside the page, because the page is the
 * mushaf and keeps its size: on a wide screen it can be carried wherever it
 * covers least, by its bar, like the player. On a phone there is no "out of
 * the way", so it sits along the foot, above the player, and the page scrolls
 * behind it.
 *
 * The texts are one file a surah, fetched the first time that surah's meaning
 * is asked for and kept. Nothing loads until the window is opened.
 */
(function (global) {
  'use strict';

  /* The texts, by the name each is kept under. The translations join from
     data/translations.json; until it arrives, the Complex's English stands in. */
  var TEXTS = {
    hilali: {
      base: '/data/translation/hilali/', lang: 'en', dir: 'ltr',
      by: { ar: 'الهلالي ومحسن خان · مجمع الملك فهد · الإنجليزية', en: 'Hilali & Muhsin Khan · King Fahd Complex · English' },
    },
    muyassar: {
      base: '/data/tafsir/muyassar/', lang: 'ar', dir: 'rtl',
      by: { ar: 'التفسير الميسر · مجمع الملك فهد', en: 'Al-Muyassar · King Fahd Complex (Arabic)' },
    },
  };

  /* The tabs. The translation tab holds a choice of translations, the
     Complex's first; the tafsir tab holds one. */
  var TABS = {
    translation: { ar: 'الترجمة', en: 'Translation' },
    tafsir: { ar: 'التفسير', en: 'Tafsir' },
  };

  var CATALOGUE_URL = '/data/translations.json';
  var catalogue = null;       // the list, once fetched; its fetch before that
  var offered = [];           // the list's entries, in its order

  /* "King Fahd Complex" after the translator's name, unless that is the name. */
  var COMPLEX = { ar: 'مجمع الملك فهد', en: 'King Fahd Complex' };
  function house(t, l) { return t.complex && t.name[l] !== COMPLEX[l] ? COMPLEX[l] : ''; }

  function loadCatalogue() {
    if (catalogue) return catalogue;
    catalogue = fetch(CATALOGUE_URL)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (list) {
        offered = list;
        list.forEach(function (t) {
          texts[t.id] = texts[t.id] || {};
          TEXTS[t.id] = {
            base: '/data/translation/' + t.id + '/', lang: t.lang, dir: t.dir || 'ltr',
            by: {
              ar: [t.name.ar, house(t, 'ar'), t.language.ar].filter(Boolean).join(' · '),
              en: [t.name.en, house(t, 'en'), t.language.en].filter(Boolean).join(' · '),
            },
          };
        });
        /* A choice remembered from a list that has since lost it falls back. */
        if (!TEXTS[translation]) translation = 'hilali';
        fillChoices();
        render();
      })
      .catch(function () { catalogue = null; });
    return catalogue;
  }

  var TAB_KEY = 'quran-meaning-tab';
  var TRANSLATION_KEY = 'quran-translation';

  var box = null, el = {};
  var surah = null;           // { id, en, full, v }
  var ayah = 1;
  var tab = null;
  /* Trusted only once the list confirms it; see loadCatalogue. */
  var translation = stored(TRANSLATION_KEY) || 'hilali';
  var texts = { hilali: {}, muyassar: {} };   // text -> surah id -> list, or its fetch
  var moved = false;

  function stored(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function store(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* denied */ }
  }

  function lang() { return document.body.getAttribute('data-lang') || 'ar'; }
  function ar(n) { return String(n).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; }); }
  function phone() { return window.matchMedia('(max-width: 480px)').matches; }

  /* Whichever was read last; before that, the one in the reader's language. */
  function firstTab() {
    var was = stored(TAB_KEY);
    if (TABS[was]) return was;
    return lang() === 'en' ? 'translation' : 'tafsir';
  }

  var MARKUP =
    '<section id="meaning" role="dialog" aria-labelledby="mn-title" hidden>' +
      '<div class="mn-bar">' +
        '<span class="r-grip" aria-hidden="true"></span>' +
        '<h2 id="mn-title" class="mn-title"></h2>' +
        '<button class="mn-step" data-step="-1"><svg class="ic" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '<button class="mn-step" data-step="1"><svg class="ic" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '<button class="mn-close"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M7.5 7.5l9 9M16.5 7.5l-9 9"/></svg></button>' +
      '</div>' +
      '<div class="mn-tabs" role="tablist">' +
        '<button role="tab" class="mn-tab" data-tab="translation" id="mn-tab-translation" aria-controls="mn-body"></button>' +
        '<button role="tab" class="mn-tab" data-tab="tafsir" id="mn-tab-tafsir" aria-controls="mn-body"></button>' +
      '</div>' +
      /* Which translation, under its tab: a list, since there are many, in
         groups by language. */
      '<label class="mn-choices" hidden>' +
        '<span class="mn-choices-label"></span>' +
        '<select class="mn-select"></select>' +
      '</label>' +
      '<div class="mn-body" id="mn-body" role="tabpanel" tabindex="0" aria-live="polite">' +
        '<p class="mn-text"></p>' +
        '<p class="mn-by"></p>' +
      '</div>' +
    '</section>';

  function build() {
    document.body.insertAdjacentHTML('beforeend', MARKUP);
    box = document.getElementById('meaning');
    el = {
      bar: box.querySelector('.mn-bar'),
      title: box.querySelector('.mn-title'),
      prev: box.querySelector('[data-step="-1"]'),
      next: box.querySelector('[data-step="1"]'),
      close: box.querySelector('.mn-close'),
      body: box.querySelector('.mn-body'),
      choices: box.querySelector('.mn-choices'),
      choicesLabel: box.querySelector('.mn-choices-label'),
      select: box.querySelector('.mn-select'),
      text: box.querySelector('.mn-text'),
      by: box.querySelector('.mn-by'),
    };

    box.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) {
        if (b.dataset.tab) { tab = b.dataset.tab; store(TAB_KEY, tab); render(); }
        else if (b.dataset.step) step(+b.dataset.step);
        else if (b === el.close) close();
      }
      /* The page reads a click anywhere else as "put the player away". */
      e.stopPropagation();
    });

    /* Left and right step through the ayahs, as they turn the pages
       outside; kept here so they do not turn a page as well. */
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { close(); e.stopPropagation(); return; }
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      /* The list's own arrows are the list's, and not a page turn either. */
      if (e.target === el.select) { e.stopPropagation(); return; }
      if (e.target.closest('.mn-tabs')) {
        tab = tab === 'translation' ? 'tafsir' : 'translation';
        store(TAB_KEY, tab);
        render();
        box.querySelector('[data-tab="' + tab + '"]').focus();
      } else {
        /* The next ayah lies to the left in Arabic and to the right in English. */
        var forward = (e.key === 'ArrowLeft') === (lang() === 'ar');
        step(forward ? 1 : -1);
      }
      e.preventDefault();
      e.stopPropagation();
    });

    el.select.addEventListener('change', function () {
      translation = el.select.value;
      store(TRANSLATION_KEY, translation);
      render();
    });

    draggable(el.bar);

    /* A longer tafsir, or the other tab, changes its height where it stands;
       kept inside the screen as the player is. On a phone the sheet is
       anchored to the foot and grows upwards by itself. */
    if (global.ResizeObserver) {
      new ResizeObserver(function () {
        if (box.hidden || phone()) return;
        var r = box.getBoundingClientRect();
        if (r.top < 8 || r.bottom > window.innerHeight - 8) place(r.left, r.top);
      }).observe(box);
    }

    new MutationObserver(function () { if (!box.hidden) render(); })
      .observe(document.body, { attributes: true, attributeFilter: ['data-lang'] });

    window.addEventListener('resize', function () { if (!box.hidden) settle(); });
  }

  /** Carried by its bar on a wide screen; on a phone it has one place. */
  function draggable(bar) {
    var from = null, was = null;
    bar.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button') || phone()) return;
      var r = box.getBoundingClientRect();
      from = { x: e.clientX, y: e.clientY };
      was = { x: r.left, y: r.top };
      try { bar.setPointerCapture(e.pointerId); } catch (err) { /* gone */ }
      box.classList.add('mn-moving');
      e.preventDefault();
    });
    bar.addEventListener('pointermove', function (e) {
      if (!from) return;
      moved = true;
      place(was.x + e.clientX - from.x, was.y + e.clientY - from.y);
    });
    var end = function () { from = null; box.classList.remove('mn-moving'); };
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
  }

  /* The span the window may use: the screen, less the index where it is open, which stands above it. */
  function room() {
    var from = 0, to = window.innerWidth;
    var side = document.getElementById('sidebar');
    if (side && !side.classList.contains('hidden')) {
      var s = side.getBoundingClientRect();
      if (s.width && s.width < to) {
        if (s.left > to / 2) to = s.left; else from = s.right;
      }
    }
    return { from: from, to: to };
  }

  function place(left, top) {
    var pad = 8, r = box.getBoundingClientRect(), span = room();
    box.style.left = Math.max(span.from + pad, Math.min(span.to - r.width - pad, left)) + 'px';
    box.style.top = Math.max(pad, Math.min(window.innerHeight - r.height - pad, top)) + 'px';
  }

  /* Where it stands. On a phone, just above the player if the player is up;
     elsewhere, where the reader left it, or, the first time, beside the
     player so the two read as one thing. */
  function settle() {
    if (phone()) {
      var player = document.getElementById('r-menu');
      var under = player && !player.hidden ? player.getBoundingClientRect() : null;
      box.style.left = box.style.top = '';
      box.style.bottom = under ? Math.max(0, window.innerHeight - under.top) + 'px' : '';
      return;
    }
    box.style.bottom = '';
    if (moved) { var r = box.getBoundingClientRect(); place(r.left, r.top); return; }
    var p = document.getElementById('r-menu');
    var at = p && !p.hidden ? p.getBoundingClientRect() : null;
    var w = box.getBoundingClientRect().width;
    if (at && at.width) {
      /* Beside the player, on whichever side has the room. */
      var span = room();
      if (at.left - w - 12 >= span.from + 8) place(at.left - w - 12, at.top);
      else if (at.right + 12 + w <= span.to - 8) place(at.right + 12, at.top);
      // Room on neither side: above it all, clear of the player and the index
      else place((span.from + span.to - w) / 2, 72);
    } else {
      var free = room();
      place((free.from + free.to - w) / 2, 72);
    }
  }

  /* The text a tab is showing: the chosen translation, or the tafsir. */
  function textOf(t) {
    if (t !== 'translation') return 'muyassar';
    return TEXTS[translation] ? translation : 'hilali';
  }

  /* The list, in the reader's language: a group a language, English first
     as the catalogue has it, each translation by its translator. */
  function fillChoices() {
    if (!box || !offered.length) return;
    var l = lang(), groups = [], by = {};
    offered.forEach(function (t) {
      var key = t.language.en;
      if (!by[key]) { by[key] = { name: t.language[l], list: [] }; groups.push(by[key]); }
      by[key].list.push(t);
    });
    el.select.textContent = '';
    groups.forEach(function (g) {
      var og = document.createElement('optgroup');
      og.label = g.name;
      g.list.forEach(function (t) {
        var o = document.createElement('option');
        o.value = t.id;
        o.textContent = [t.name[l], house(t, l)].filter(Boolean).join(' — ');
        og.appendChild(o);
      });
      el.select.appendChild(og);
    });
    el.select.dataset.lang = l;
  }

  function load(source, id) {
    var have = texts[source][id];
    if (have) return Array.isArray(have) ? Promise.resolve(have) : have;
    var p = fetch(TEXTS[source].base + id + '.json')
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (list) { texts[source][id] = list; return list; })
      .catch(function () { delete texts[source][id]; return null; });
    texts[source][id] = p;
    return p;
  }

  function step(by) {
    if (!surah) return;
    var to = Math.max(1, Math.min(surah.v, ayah + by));
    if (to === ayah) return;
    ayah = to;
    render();
  }

  function render() {
    if (!box || !surah) return;
    var l = lang(), which = textOf(tab), src = TEXTS[which];

    el.title.textContent = l === 'ar'
      ? 'الآية ' + ar(ayah) + ' · ' + (surah.full || surah.name || '')
      : surah.en + ' · ' + surah.id + ':' + ayah;
    box.setAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
    el.prev.setAttribute('aria-label', l === 'ar' ? 'الآية السابقة' : 'Previous ayah');
    el.next.setAttribute('aria-label', l === 'ar' ? 'الآية التالية' : 'Next ayah');
    el.close.setAttribute('aria-label', l === 'ar' ? 'إغلاق' : 'Close');
    el.prev.disabled = ayah <= 1;
    el.next.disabled = ayah >= surah.v;

    box.querySelectorAll('.mn-tab').forEach(function (b) {
      var on = b.dataset.tab === tab;
      b.textContent = TABS[b.dataset.tab][l];
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    el.body.setAttribute('aria-labelledby', 'mn-tab-' + tab);

    el.choices.hidden = tab !== 'translation' || offered.length < 2;
    el.choicesLabel.textContent = l === 'ar' ? 'اللغة والمترجم' : 'Language and translator';
    if (offered.length && el.select.dataset.lang !== l) fillChoices();
    if (offered.length) el.select.value = textOf('translation');

    el.text.setAttribute('lang', src.lang);
    el.text.setAttribute('dir', src.dir);
    el.text.className = 'mn-text ' + (src.lang === 'ar' ? 'mn-ar' : 'mn-ltr');
    el.by.textContent = src.by[l];

    var want = { id: surah.id, ayah: ayah, which: which };
    var list = texts[which][surah.id];
    if (Array.isArray(list)) { say(list); return; }
    el.text.textContent = l === 'ar' ? 'جارٍ التحميل…' : 'Loading…';
    box.classList.add('mn-loading');
    load(which, surah.id).then(function (got) {
      /* Moved on while this was in the air. */
      if (!surah || want.id !== surah.id || want.ayah !== ayah || want.which !== textOf(tab)) return;
      if (got) { say(got); return; }
      box.classList.remove('mn-loading');
      el.text.textContent = lang() === 'ar' ? 'تعذّر التحميل. تحقق من الاتصال.' : 'Could not load. Check the connection.';
    });

    function say(got) {
      box.classList.remove('mn-loading');
      el.text.textContent = got[ayah - 1] || '';
      el.body.scrollTop = 0;
    }
  }

  /** Open on an ayah, or move an open window to it. */
  function show(s, v) {
    if (!s) return;
    if (!box) build();
    var was = !box.hidden;
    surah = s;
    ayah = Math.max(1, Math.min(s.v, v || 1));
    if (!tab) tab = firstTab();
    loadCatalogue();
    box.hidden = false;
    document.body.classList.add('has-meaning');
    render();
    if (!was) { settle(); told(); }
    /* The other tab's text too, so switching does not wait. */
    load(textOf(tab === 'translation' ? 'tafsir' : 'translation'), s.id);
  }

  /** Keep up with the recitation, if the window is up. */
  function follow(s, v) {
    if (!box || box.hidden || !s || !v) return;
    if (surah && surah.id === s.id && ayah === v) return;
    show(s, v);
  }

  function close() {
    if (!box || box.hidden) return;
    box.hidden = true;
    document.body.classList.remove('has-meaning');
    moved = false;
    box.style.left = box.style.top = box.style.bottom = '';
    told();
  }

  function told() { document.dispatchEvent(new CustomEvent('meaning:state')); }

  global.Meaning = {
    show: show,
    follow: follow,
    close: close,
    settle: function () { if (box && !box.hidden) settle(); },
    open: function () { return !!box && !box.hidden; },
  };

}(window));
