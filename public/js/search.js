/**
 * Search over the index: what is typed in the box above the surah list.
 *
 * A number offers the page it names; words are matched against the surahs'
 * names, in Arabic without its marks or in English, and against the ayahs'
 * own text, which is fetched only for a query that could be among it.
 *
 * The reader (app.js) lends the surahs, where each ayah begins and the ways
 * to go to a page, through init(), and is handed the folding of a name to
 * its bare letters, which the ayah search uses too.
 */
(function (global) {
  'use strict';

  /* What the reader lends: see init */
  var app = null;

  /* Run once the reader is up, as this was when it lived in it */
  function start() {
    /* A name with nothing on it: no vowel marks, one shape for the alef. The
       list names surahs as the mushaf does, and nobody types that, so both
       sides of the comparison are stripped to their letters. */
    var MARKS = /[ً-ٰٕۖ-ۭـ]/g;
    var ALEFS = /[آأإٱ]/g;

    function bare(t) {
      return t.replace(MARKS, '').replace(ALEFS, 'ا')
              .replace(/ؤ/g, 'و')
              .replace(/[ئى]/g, 'ي')
              .replace(/ة/g, 'ه');
    }

    /* Both sets of Arabic digits, so ٤٨ and ۴۸ read as 48. */
    function figures(t) {
      return t.replace(/[٠-٩۰-۹]/g, function (d) {
        var c = d.charCodeAt(0);
        return String(c >= 0x06f0 ? c - 0x06f0 : c - 0x0660);
      });
    }

    /* Folding drops marks, so a place in the folded text is not the same place in
       the printed one. Walked per row rather than mapped for all 6236, because
       only the sixty on screen are ever marked. */
    function spanIn(text, at, len) {
      var seen = 0, from = -1;
      for (var i = 0; i <= text.length; i++) {
        if (seen === at && from < 0) from = i;
        if (from >= 0 && seen === at + len) return [from, i];
        if (i < text.length && bare(text.charAt(i))) seen++;
      }
      return from < 0 ? null : [from, text.length];
    }

    /** A heading over a run of results. */
    function section(ar, en) {
      return '<div class="juz-label"><span class="lang-ar">' + ar + '</span>' +
        '<span class="lang-en">' + en + '</span></div>';
    }

    /** Show the index again, or the answer to what was typed. */
    function searching(on) {
      $('.list-switch').prop('hidden', on);
      $('#search-results').prop('hidden', !on);
      $('#surah-list').prop('hidden', on || !$('.list-tab[data-list="surahs"]').hasClass('on'));
      $('#juz-list').prop('hidden', on || !$('.list-tab[data-list="juz"]').hasClass('on'));
    }

    /* Enough of the ayah to see the match in its own words, rather than the whole
       of a verse that can run to a screenful. */
    function around(text, at, len) {
      var ROOM = 34;
      var from = Math.max(0, at - ROOM);
      var to = Math.min(text.length, at + len + ROOM);
      return (from ? '\u2026' : '') + text.slice(from, at) +
        '<mark>' + text.slice(at, at + len) + '</mark>' +
        text.slice(at + len, to) + (to < text.length ? '\u2026' : '');
    }

    /** The ayahs carrying the words typed, as their own run of rows. */
    function ayahRows(q) {
      var hits = Ayahs.find(q);
      if (!hits.length) return '';

      return section('الآيات', 'Ayahs') +
        hits.map(function (h) {
          var a = h.ayah;
          var page = app.ayahs() && app.ayahs().began[a.s + ':' + a.v];
          var span = spanIn(a.text, h.at, q.length);
          var body = span ? around(a.text, span[0], span[1] - span[0])
                          : app.esc(a.text.slice(0, 90));
          var name = app.quran()[a.s - 1];
          return '<button class="surah-item ayah-hit" data-page="' + (page || 1) +
            '" data-a="' + a.s + ':' + a.v + '">' +
            '<span class="surah-names">' +
              '<span class="ayah-text">' + body + '</span>' +
              '<span class="ayah-ref">' +
                '<span class="lang-ar">\u0633\u0648\u0631\u0629 ' + app.esc(name ? name.name : '') +
                  ' \u00b7 \u0622\u064a\u0629 ' + app.ar(a.v) + '</span>' +
                '<span class="lang-en">' + app.esc(name ? name.en : '') + ' \u00b7 ayah ' + a.v + '</span>' +
              '</span>' +
            '</span></button>';
        }).join('');
    }

    /* A number is the finer place and the one a copied reference uses, so the
       page it names comes before any surah that happens to carry the figure. */
    function jumpRows(n) {
      if (!(n >= 1 && n <= app.pages)) return '';
      return section('الانتقال', 'Go to') +
        '<button class="surah-item jump-row" data-page="' + n + '">' +
          '<span class="surah-num">' + n + '</span>' +
          '<span class="surah-names"><span class="juz-title">' +
            '<span class="lang-ar">صفحة ' + app.ar(n) + '</span>' +
            '<span class="lang-en">Page ' + n + '</span></span></span></button>';
    }

    /* Matched against the data, not the rows: a name on a row is calligraphy,
       and those glyphs spell nothing. */
    function nameRows(q) {
      var found = app.quran().filter(function (s) {
        return bare(s.name).indexOf(q) >= 0
            || s.en.toLowerCase().indexOf(q) >= 0
            || String(s.id) === q;
      });
      if (!found.length) return '';
      return section('السور', 'Surahs') + found.map(app.surahRow).join('');
    }

    function answer() {
      var raw = figures($('#surah-search').val().trim());
      var q = bare(raw.toLowerCase());

      if (!q) { searching(false); $('#search-results').empty(); return; }
      searching(true);

      var html = jumpRows(parseInt(raw, 10)) + nameRows(q);

      /* The words are only fetched for a query that could be among them, so a
         reader looking a surah up by name never pays for them. */
      if (q.length >= 2 && !/^\d+$/.test(raw)) {
        $('#search-results').html(html || section('لا نتائج', 'Searching'));
        Ayahs.load().then(function () {
          if (bare(figures($('#surah-search').val().trim()).toLowerCase()) !== q) return;
          var rows = html + ayahRows(q);
          $('#search-results').html(rows || section('لا نتائج', 'No results'));
        });
        return;
      }

      $('#search-results').html(html || section('لا نتائج', 'No results'));
    }

    $('#surah-search').on('input', answer);

    $('#search-results').on('click', '.ayah-hit', function () {
      app.goToPage(+$(this).data('page'));
      app.flashAyah($(this).data('a'));
      app.setSidebar(false);
    });

    return bare;
  }

  global.Search = {
    /** Wires the search box, and hands over the folding of a name to its bare letters. */
    init: function (lent) { app = lent; return start(); },
  };

}(window));
