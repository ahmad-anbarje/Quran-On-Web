/**
 * Translation and tafsir: what an ayah means, in a window of its own.
 *
 * Opened from the player, on the ayah the player is about, and it then keeps
 * up with the recitation: while an ayah is being read, its meaning is the one
 * on show. Two tabs, a translation and the Arabic of the Tafsir al-Muyassar,
 * one ayah at a time, with steps to the ayah either side. The translations
 * are QuranEnc's, in every language listed in data/translations.json, each
 * credited as QuranEnc credits it; Hilali and Muhsin Khan is the first, and
 * Saheeh International stands beside it for plainer English.
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
     data/translations.json; until it arrives, Hilali and Khan's English stands in. */
  var TEXTS = {
    hilali: {
      base: '/data/translation/hilali/', lang: 'en', dir: 'ltr', source: 'quranenc', key: 'english_hilali_khan',
      by: { ar: 'تقي الدين الهلالي ومحسن خان · الإنجليزية', en: 'Hilali and Khan · English' },
    },
    muyassar: {
      base: '/data/tafsir/muyassar/', lang: 'ar', dir: 'rtl', source: 'tanzil',
      by: { ar: 'التفسير الميسر · مجمع الملك فهد', en: 'Al-Muyassar · King Fahd Complex (Arabic)' },
    },
  };

  /* The tabs. The translation tab holds a choice of translations, grouped
     by language; the tafsir tab holds one. */
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
          t.hay = [t.language.ar, t.language.en, t.language.native, t.name.ar, t.name.en, t.lang, ALSO[t.lang]]
            .map(function (x) { return x ? fold(x) : ''; });
          TEXTS[t.id] = {
            base: '/data/translation/' + t.id + '/', lang: t.lang, dir: t.dir || 'ltr',
            source: t.source, key: t.key,
            by: {
              ar: [t.name.ar, house(t, 'ar'), t.language.ar].filter(Boolean).join(' · '),
              en: [t.name.en, house(t, 'en'), t.language.en].filter(Boolean).join(' · '),
            },
          };
        });
        /* A choice remembered from a list that has since lost it falls back;
           with no choice yet, the reader's own language where there is one. */
        if (!stored(TRANSLATION_KEY)) translation = deviceChoice() || translation;
        if (!TEXTS[translation]) translation = 'hilali';
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
      /* Which translation, under its tab: the choice as a button, and behind it
         a search over a hundred and more, grouped by language. */
      '<div class="mn-choices" hidden>' +
        '<button type="button" class="mn-pick" aria-haspopup="listbox" aria-expanded="false">' +
          '<span class="mn-pick-lang"></span><span class="mn-pick-name"></span>' +
          '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</button>' +
        '<div class="mn-picker" hidden>' +
          '<input type="search" class="mn-search" autocomplete="off" spellcheck="false" />' +
          '<p class="mn-count" aria-live="polite"></p>' +
          '<ul class="mn-list" role="listbox"></ul>' +
        '</div>' +
      '</div>' +
      '<div class="mn-body" id="mn-body" role="tabpanel" tabindex="0" aria-live="polite">' +
        '<p class="mn-text"></p>' +
        '<p class="mn-by"></p>' +
      '</div>' +
      '<span class="mn-size" aria-hidden="true"></span>' +
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
      pick: box.querySelector('.mn-pick'),
      pickLang: box.querySelector('.mn-pick-lang'),
      pickName: box.querySelector('.mn-pick-name'),
      picker: box.querySelector('.mn-picker'),
      search: box.querySelector('.mn-search'),
      count: box.querySelector('.mn-count'),
      list: box.querySelector('.mn-list'),
      text: box.querySelector('.mn-text'),
      by: box.querySelector('.mn-by'),
    };

    box.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      var item = e.target.closest('.mn-item');
      if (item) choose(item.dataset.id);
      else if (b) {
        if (b === el.pick) togglePicker();
        else if (b.dataset.tab) { tab = b.dataset.tab; store(TAB_KEY, tab); togglePicker(false); render(); }
        else if (b.dataset.step) step(+b.dataset.step);
        else if (b === el.close) close();
      }
      /* The page reads a click anywhere else as "put the player away". */
      e.stopPropagation();
    });

    /* Left and right step through the ayahs, as they turn the pages
       outside; kept here so they do not turn a page as well. */
    box.addEventListener('keydown', function (e) {
      /* The search box's keys are the search's: up and down walk the results,
         Enter takes one, Escape puts the list away and leaves the window open. */
      if (e.target === el.search) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { move(e.key === 'ArrowDown' ? 1 : -1); e.preventDefault(); }
        else if (e.key === 'Enter') { var on = el.list.querySelector('.mn-item.active'); if (on) choose(on.dataset.id); e.preventDefault(); }
        else if (e.key === 'Escape') { togglePicker(false); el.pick.focus(); e.preventDefault(); }
        e.stopPropagation();
        return;
      }
      if (e.key === 'Escape') { close(); e.stopPropagation(); return; }
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
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

    el.search.addEventListener('input', function () { fillList(el.search.value); });

    draggable(el.bar);
    resizable(box.querySelector('.mn-size'));

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

    window.addEventListener('resize', function () { if (!box.hidden) { sized(); settle(); } });
  }

  /* Sized by its corner on a wide screen, and kept at that size the next time;
     a double click on the corner puts it back as it was made. */
  var SIZE_KEY = 'quran-meaning-size';
  var MIN_W = 300, MIN_H = 220;

  function resizable(grip) {
    var from = null;
    grip.addEventListener('pointerdown', function (e) {
      if (phone() || box.hidden) return;
      var r = box.getBoundingClientRect();
      // The corner is at the inline end: the left one in Arabic, so the left edge moves too
      from = { x: e.clientX, y: e.clientY, w: r.width, h: r.height, left: r.left, top: r.top,
        rtl: getComputedStyle(box).direction === 'rtl' };
      try { grip.setPointerCapture(e.pointerId); } catch (err) { /* gone */ }
      box.classList.add('mn-sizing');
      e.preventDefault();
      e.stopPropagation();
    });
    grip.addEventListener('pointermove', function (e) {
      if (!from) return;
      var span = room(), pad = 8;
      var dx = e.clientX - from.x;
      var most = from.rtl ? from.left + from.w - span.from - pad : span.to - pad - from.left;
      var w = Math.max(MIN_W, Math.min(most, from.w + (from.rtl ? -dx : dx)));
      var h = Math.max(MIN_H, Math.min(window.innerHeight - pad - from.top, from.h + e.clientY - from.y));
      box.style.width = w + 'px';
      box.style.height = h + 'px';
      box.style.maxHeight = 'none';
      box.style.left = (from.rtl ? from.left + from.w - w : from.left) + 'px';
      moved = true;
    });
    var end = function () {
      if (!from) return;
      from = null;
      box.classList.remove('mn-sizing');
      store(SIZE_KEY, Math.round(box.offsetWidth) + 'x' + Math.round(box.offsetHeight));
    };
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
    grip.addEventListener('dblclick', function (e) {
      try { localStorage.removeItem(SIZE_KEY); } catch (err) { /* denied */ }
      sized();
      var r = box.getBoundingClientRect();
      place(r.left, r.top);
      e.stopPropagation();
    });
  }

  /* The size the reader gave it, within the screen; a phone's sheet has its own. */
  function sized() {
    var s = /^(\d+)x(\d+)$/.exec(stored(SIZE_KEY) || '');
    if (!s || +s[1] < MIN_W || +s[2] < MIN_H || phone()) { box.style.width = box.style.height = box.style.maxHeight = ''; return; }
    var span = room();
    box.style.width = Math.max(MIN_W, Math.min(+s[1], span.to - span.from - 16)) + 'px';
    box.style.height = Math.max(MIN_H, Math.min(+s[2], window.innerHeight - 16)) + 'px';
    box.style.maxHeight = 'none';
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

  /* Letters as a search should see them: no case, no diacritics, and Arabic's
     several ways of writing one letter as one ("اوردو" finds "أوردو"). */
  function fold(s) {
    return String(s).toLowerCase().normalize('NFD')
      .replace(/[̀-ًͯ-ٰٟۖ-ۭـ]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
      .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/\s+/g, ' ').trim()
      /* An Arabic word without its article or its -ي/-ية ending, so "تركي"
         finds "التركية" and "انجليزي" finds "الإنجليزية". */
      .split(' ').map(function (w) {
        return /[؀-ۿ]/.test(w) && w.length > 3 ? w.replace(/^ال/, '').replace(/(يه|ي)$/, '') : w;
      }).join(' ');
  }

  /* What people call a language that its list name does not say. */
  var ALSO = {
    ur: 'اوردو urdu', ps: 'بشتو pushto', ms: 'ماليزي malaysian', tl: 'فلبيني تاغالوغ filipino',
    fa: 'فارسي farsi', prs: 'دري افغاني', ckb: 'كردي سوراني sorani', kmr: 'كرمانجي بهدينان',
    zh: 'صيني mandarin', ug: 'ايغوري', bs: 'بوسني', id: 'اندونيسي bahasa', dv: 'ديفيهي',
  };

  /* The first translation in a language the device asks for, if any. */
  function deviceChoice() {
    var want = (navigator.languages || [navigator.language || '']).map(function (x) {
      return String(x).toLowerCase().split('-')[0];
    });
    for (var i = 0; i < want.length; i++) {
      for (var j = 0; j < offered.length; j++) if (offered[j].lang === want[i]) return offered[j].id;
    }
    return null;
  }

  /* A language by the reader's name for it, and by its own where that differs. */
  function langLabel(t, l) {
    var mine = t.language[l] || t.language.en, own = t.language.native;
    return own && fold(own) !== fold(mine) ? mine + ' · ' + own : mine;
  }

  function current() {
    for (var i = 0; i < offered.length; i++) if (offered[i].id === textOf('translation')) return offered[i];
    return null;
  }

  function updatePick() {
    var t = current(), l = lang();
    el.pickLang.textContent = t ? langLabel(t, l) : '';
    el.pickName.textContent = t ? t.name[l] : '';
    el.search.placeholder = l === 'ar' ? 'ابحث عن لغة أو مترجم…' : 'Search a language or translator…';
    el.search.setAttribute('aria-label', el.search.placeholder);
    el.pick.setAttribute('aria-label', (l === 'ar' ? 'اللغة والمترجم: ' : 'Language and translator: ')
      + el.pickLang.textContent + ' · ' + el.pickName.textContent);
  }

  function togglePicker(open) {
    if (open === undefined) open = el.picker.hidden;
    el.picker.hidden = !open;
    el.body.hidden = open;
    el.pick.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open) return;
    el.search.value = '';
    fillList('');
    el.search.focus();
    var on = el.list.querySelector('[aria-selected="true"]');
    if (on) on.scrollIntoView({ block: 'center' });
  }

  /* How well a translation answers the search: every word must be found somewhere
     in it, and a word that opens a language's name counts most. 0 if not at all. */
  function score(t, words) {
    var total = 0;
    for (var i = 0; i < words.length; i++) {
      var best = 0;
      for (var j = 0; j < t.hay.length; j++) {
        var f = t.hay[j], at = f.indexOf(words[i]), lang = j < 3 || j >= 5;
        if (at < 0) continue;
        var s = at === 0 ? (lang ? 6 : 4) : f.charAt(at - 1) === ' ' ? (lang ? 4 : 3) : 1;
        if (lang && f === words[i]) s += 3;
        if (s > best) best = s;
      }
      if (!best) return 0;
      total += best;
    }
    return total;
  }

  /* The list: a group a language, the best answers first while searching and the
     catalogue's order otherwise; the chosen one marked, the first answer ready for Enter. */
  function fillList(q) {
    var l = lang(), words = fold(q).split(' ').filter(Boolean), groups = [], by = {}, shown = 0;
    offered.forEach(function (t, n) {
      var s = words.length ? score(t, words) : 1;
      if (!s) return;
      shown++;
      var key = t.language.en + '|' + t.lang;
      if (!by[key]) { by[key] = { label: langLabel(t, l), list: [], best: 0, first: n }; groups.push(by[key]); }
      by[key].list.push(t);
      by[key].best = Math.max(by[key].best, s);
    });
    if (words.length) groups.sort(function (a, b) { return b.best - a.best || a.first - b.first; });

    el.list.textContent = '';
    var chosen = textOf('translation');
    groups.forEach(function (g) {
      var head = document.createElement('li');
      head.className = 'mn-group';
      head.setAttribute('role', 'presentation');
      head.textContent = g.label;
      el.list.appendChild(head);
      g.list.forEach(function (t) {
        var li = document.createElement('li');
        li.className = 'mn-item';
        li.setAttribute('role', 'option');
        li.dataset.id = t.id;
        li.setAttribute('aria-selected', t.id === chosen ? 'true' : 'false');
        li.textContent = [t.name[l], house(t, l)].filter(Boolean).join(' · ');
        el.list.appendChild(li);
      });
    });
    var first = el.list.querySelector('.mn-item');
    if (first && words.length) first.classList.add('active');

    var langs = groups.length;
    el.count.textContent = !shown ? (l === 'ar' ? 'لا نتائج' : 'No match')
      : l === 'ar' ? ar(shown) + ' ترجمة في ' + ar(langs) + ' لغة'
      : shown + (shown === 1 ? ' translation' : ' translations') + ' in ' + langs + (langs === 1 ? ' language' : ' languages');
  }

  function move(by) {
    var items = [].slice.call(el.list.querySelectorAll('.mn-item'));
    if (!items.length) return;
    var at = items.indexOf(el.list.querySelector('.mn-item.active'));
    if (at < 0) at = items.indexOf(el.list.querySelector('[aria-selected="true"]'));
    at = Math.max(0, Math.min(items.length - 1, at + by));
    items.forEach(function (x) { x.classList.remove('active'); });
    items[at].classList.add('active');
    items[at].scrollIntoView({ block: 'nearest' });
  }

  function choose(id) {
    if (!TEXTS[id]) return;
    translation = id;
    store(TRANSLATION_KEY, id);
    togglePicker(false);
    el.pick.focus();
    render();
  }

  /* Where a text comes from, as a link a reader can check it against. */
  function sourceLink(src, l) {
    var a = document.createElement('a');
    a.target = '_blank';
    a.rel = 'noopener';
    if (src.source === 'quranenc') {
      a.href = 'https://quranenc.com/' + (l === 'ar' ? 'ar' : 'en') + '/browse/' + src.key + '/' + surah.id;
      a.textContent = l === 'ar' ? 'موسوعة القرآن الكريم (QuranEnc)' : 'QuranEnc, Encyclopedia of the Noble Quran';
    } else {
      a.href = 'https://tanzil.net/trans/';
      a.textContent = l === 'ar' ? 'تنزيل (Tanzil)' : 'Tanzil';
    }
    return a;
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

  /* The word labels follow the translation's language: told once it changes. */
  var WORDS_LANG_KEY = 'quran-translation-lang';
  function tellWordsLang() {
    var t = TEXTS[textOf('translation')];
    if (!t || stored(WORDS_LANG_KEY) === t.lang) return;
    store(WORDS_LANG_KEY, t.lang);
    document.dispatchEvent(new CustomEvent('meaning:lang', { detail: t.lang }));
  }

  function render() {
    if (!box || !surah) return;
    var l = lang(), which = textOf(tab), src = TEXTS[which];
    if (offered.length) tellWordsLang();

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
    if (el.choices.hidden && !el.picker.hidden) togglePicker(false);
    if (offered.length) updatePick();
    if (!el.picker.hidden && el.list.dataset.lang !== l) { fillList(el.search.value); el.list.dataset.lang = l; }

    el.text.setAttribute('lang', src.lang);
    el.text.setAttribute('dir', src.dir);
    el.text.className = 'mn-text ' + (src.lang === 'ar' ? 'mn-ar' : src.dir === 'rtl' ? 'mn-rtl' : 'mn-ltr');
    el.by.textContent = src.by[l] + ' · ' + (l === 'ar' ? 'المصدر: ' : 'Source: ');
    el.by.appendChild(sourceLink(src, l));

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
    if (!was) { sized(); settle(); told(); }
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
