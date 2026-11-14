/**
 * Reading history: every page opened, with when, newest first; two pages
 * only when they were open together as a spread. Kept in this browser for 30
 * days, and shown on the saved pages' drawer.
 *
 * The reader (app.js) lends the surah open and the surahs' names through
 * init(), and is handed the two things it asks of the history: note these
 * pages as read, and show the list.
 */
(function (global) {
  'use strict';

  /* What the reader lends: see init */
  var app = null;

  /* Run once the reader is up, as this was when it lived in it */
  function start() {
    function dayKey(back) {
      var d = new Date();
      d.setDate(d.getDate() - (back || 0));
      return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    }
    function readHistory() {
      try { return JSON.parse(localStorage.getItem('quran-reads')) || {}; } catch (e) { return {}; }
    }
    try { localStorage.removeItem('quran-history'); } catch (e) { /* the first list's key, not used since */ }
    function logPages(pages) {
      var surah = app.surah();
      if (!surah) return;
      var h = readHistory(), key = dayKey(), day = h[key] = h[key] || [];
      pages = pages.filter(function (p) { return p >= 1 && p <= app.pages; });
      // The same view again (a refit, a reload) only moves its time
      if (day[0] && day[0].s === surah.id && day[0].p.join() === pages.join()) day.shift();
      day.unshift({ s: surah.id, p: pages, t: Date.now() });
      if (day.length > 300) day.length = 300;
      Object.keys(h).sort().reverse().slice(30).forEach(function (k) { delete h[k]; });
      try { localStorage.setItem('quran-reads', JSON.stringify(h)); } catch (e) { /* full or blocked: the reading goes on */ }
      if (!$('.drawer-pane[data-pane="history"]').prop('hidden')) showHistory();
    }
    /* "4 minutes ago" today, the clock time on earlier days */
    function whenSaid(t, today) {
      if (!today) return new Date(t).toLocaleTimeString(I18n.lang(), { hour: 'numeric', minute: '2-digit' });
      var mins = Math.round((Date.now() - t) / 60000);
      if (!window.Intl || !Intl.RelativeTimeFormat) return new Date(t).toLocaleTimeString();
      var rel = new Intl.RelativeTimeFormat(I18n.lang(), { numeric: 'auto' });
      return mins < 1 ? rel.format(0, 'second') : mins < 60 ? rel.format(-mins, 'minute') : rel.format(-Math.floor(mins / 60), 'hour');
    }
    function showHistory() {
      var list = document.getElementById('history-list');
      if (!list || !app.quran()) return;
      list.textContent = '';
      var h = readHistory(), days = Object.keys(h).sort().reverse();
      $('#btn-clear-history').prop('hidden', !days.length);
      if (!days.length) {
        var none = document.createElement('p');
        none.className = 'hist-none';
        none.textContent = T('لا قراءة بعد', 'Nothing read yet');
        list.appendChild(none);
        return;
      }
      days.forEach(function (k) {
        var seen = {};
        h[k].forEach(function (e) { e.p.forEach(function (p) { seen[p] = 1; }); });
        var head = document.createElement('div');
        head.className = 'hist-day';
        var today = k === dayKey();
        var name = today ? T('اليوم', 'Today') : k === dayKey(1) ? T('أمس', 'Yesterday')
          : new Date(k + 'T12:00:00').toLocaleDateString(I18n.lang(), { weekday: 'long', day: 'numeric', month: 'long' });
        var n = document.createElement('span');
        n.textContent = name;
        var c = document.createElement('span');
        c.className = 'hist-count';
        c.textContent = T('{n} صفحة', '{n} pages', { n: app.num(Object.keys(seen).length) });
        head.appendChild(n);
        head.appendChild(c);
        list.appendChild(head);
        h[k].forEach(function (e) {
          var s = app.quran().find(function (x) { return x.id === e.s; });
          if (!s) return;
          var row = document.createElement('button');
          row.className = 'hist-row';
          row.dataset.s = e.s;
          row.dataset.p = e.p[0];
          var t = document.createElement('span');
          t.className = 'hist-name';
          var pages = e.p.map(app.num).join(app.lang() === 'ar' ? '، ' : ', ');
          t.textContent = (e.p.length > 1 ? T('صفحة {n}', 'Pages {n}', { n: pages }) : T('صفحة {n}', 'Page {n}', { n: pages }))
            + ' · ' + (app.lang() === 'ar' ? s.full : s.en);
          var at = document.createElement('span');
          at.className = 'hist-where';
          at.textContent = whenSaid(e.t, today);
          row.appendChild(t);
          row.appendChild(at);
          list.appendChild(row);
        });
      });
    }
    $('#btn-clear-history').on('click', function () {
      if (!window.confirm(T('مسح سجل القراءة كله؟', 'Clear all of your reading history?'))) return;
      try { localStorage.removeItem('quran-reads'); } catch (e) { /* nothing to clear */ }
      showHistory();
    });
    $(document).on('click', '.hist-row', function () {
      var id = +this.dataset.s, s = app.quran().find(function (x) { return x.id === id; });
      if (!s) return;
      app.open(s, +this.dataset.p || null);
      history.pushState({ surah: s.id }, '', '/surah/' + s.id + '/');
      app.setSidebar(false);
    });

    return { log: logPages, show: showHistory };
  }

  global.Reads = {
    /** Wires the list, and hands over { log(pages), show() }. */
    init: function (lent) { app = lent; return start(); },
  };

}(window));
