/**
 * Ayahs to copy or share: a surah's ayahs from one to another, as their
 * pointed text or as a picture.
 *
 * Opened from the meaning window, on the ayah it shows; the range can then be
 * widened either way. The text is the pointed Uthmani text the surah's text
 * page prints, one small file a surah (data/text/<n>.json), not the stripped
 * copy the search reads: what is sent on is the Quran, and it goes with its
 * marks. Each ayah is closed by its number, and the whole is followed by
 * where it is from and the link that opens the mushaf there.
 *
 * The picture is drawn here, on a canvas, in the King Fahd Complex's face the
 * text pages use; nothing is sent to a server to make it. A phone hands it to
 * its own share sheet; where there is none, it is saved as a file.
 *
 * Fetched the first time it is opened, as the meaning window is.
 */
(function (global) {
  'use strict';

  var TEXT_URL = '/data/text/';
  var FACE = 'KFGQPC HAFS';
  var FACE_URL = '/fonts/UthmanicHafs1Ver18.woff2';

  /* The picture, in its own pixels: the same on every screen */
  var WIDE = 1080, MOST_TALL = 1920, EDGE = 56, SIDE = 44, HEAD = 190, FOOT = 170;
  var TYPE_MOST = 64, TYPE_LEAST = 32, TYPE_STEP = 2, LINE = 2.05;

  /* The face draws this text's sukun and round zero as a dotted circle unless
     they are written as it expects; the same exchange the text pages make.
     Only the picture is drawn in it, so only the picture's words are changed:
     what is copied is the text as it was given. */
  var HAFS = { 'ْ': 'ۡ', '۟': 'ْ', '۫': '۬', 'ۣ': 'ۜ' };
  function hafs(t) { return t.replace(/[ْۣ۟۫]/g, function (c) { return HAFS[c]; }); }

  var box = null, el = {};
  var surah = null;            // { id, en, full, v }
  var from = 1, to = 1;
  var texts = {};              // surah id -> { basmala, ayahs }, or its fetch
  var face = null;             // the picture's face, once asked for

  function lang() { return document.body.getAttribute('data-lang') || 'ar'; }
  function T(a, e) { return lang() === 'ar' ? a : e; }
  function ar(n) { return String(n).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; }); }

  var MARKUP =
    '<section id="share" role="dialog" aria-modal="true" aria-labelledby="sh-title" hidden>' +
      '<div class="sh-card">' +
        '<div class="sh-bar">' +
          '<h2 id="sh-title" class="sh-title"></h2>' +
          '<button type="button" class="sh-close"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M7.5 7.5l9 9M16.5 7.5l-9 9"/></svg></button>' +
        '</div>' +
        '<div class="sh-range">' +
          '<label class="sh-field"><span class="sh-from-l"></span><input type="number" class="sh-from" inputmode="numeric" min="1" /></label>' +
          '<label class="sh-field"><span class="sh-to-l"></span><input type="number" class="sh-to" inputmode="numeric" min="1" /></label>' +
        '</div>' +
        '<p class="sh-text" lang="ar" dir="rtl" tabindex="0"></p>' +
        '<p class="sh-ref"></p>' +
        '<div class="sh-acts">' +
          '<button type="button" class="sh-act" data-act="copy"></button>' +
          '<button type="button" class="sh-act" data-act="send"></button>' +
          '<button type="button" class="sh-act" data-act="picture"></button>' +
        '</div>' +
        '<p class="sh-said" role="status" aria-live="polite"></p>' +
      '</div>' +
    '</section>';

  function build() {
    document.body.insertAdjacentHTML('beforeend', MARKUP);
    box = document.getElementById('share');
    el = {
      title: box.querySelector('.sh-title'),
      close: box.querySelector('.sh-close'),
      from: box.querySelector('.sh-from'),
      to: box.querySelector('.sh-to'),
      fromLabel: box.querySelector('.sh-from-l'),
      toLabel: box.querySelector('.sh-to-l'),
      text: box.querySelector('.sh-text'),
      ref: box.querySelector('.sh-ref'),
      said: box.querySelector('.sh-said'),
    };

    box.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      /* Outside the card is the page behind it: a click there puts this away */
      if (e.target === box || b === el.close) close();
      else if (b && b.dataset.act) act(b.dataset.act);
      e.stopPropagation();
    });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
      /* The arrows step the numbers here; outside they turn the page */
      e.stopPropagation();
    });
    el.from.addEventListener('change', function () { ranged(+el.from.value, to); });
    el.to.addEventListener('change', function () { ranged(from, +el.to.value); });
  }

  /* Both ends kept inside the surah, and the far end never before the near one */
  function ranged(a, b) {
    var last = surah.v;
    from = Math.min(Math.max(a || 1, 1), last);
    to = Math.min(Math.max(b || from, from), last);
    render();
  }

  function load(id) {
    if (texts[id]) return Promise.resolve(texts[id]);
    texts[id] = fetch(TEXT_URL + id + '.json')
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (got) { texts[id] = got; return got; })
      .catch(function () { texts[id] = null; return null; });
    return texts[id];
  }

  /* The text for this surah, if it has come: a fetch still on its way is not it */
  function held() {
    var t = surah && texts[surah.id];
    return t && t.ayahs ? t : null;
  }

  function reference() {
    var name = lang() === 'ar' ? (surah.full || surah.name || '') : 'Surah ' + surah.en;
    if (lang() === 'ar') return name + ' · ' + (from === to ? 'الآية ' + ar(from) : 'الآيات ' + ar(from) + '–' + ar(to));
    return name + ' · ' + (from === to ? 'Ayah ' + from : 'Ayahs ' + from + '–' + to);
  }

  function link() { return location.origin + '/surah/' + surah.id + '/ayah/' + from; }

  /* The ayahs alone, each closed by its number, under the basmala where the
     surah's opening is among them */
  function ayahs() {
    var t = held();
    if (!t) return '';
    var said = [];
    for (var a = from; a <= to; a++) said.push(t.ayahs[a - 1] + ' ﴿' + ar(a) + '﴾');
    return (from === 1 && t.basmala ? t.basmala + '\n' : '') + said.join(' ');
  }

  /* What is sent: the words, where they are from, and the way to read them here */
  function message() { return ayahs() + '\n\n' + reference() + '\n' + link(); }

  function render() {
    if (!box || !surah) return;
    box.setAttribute('dir', lang() === 'ar' ? 'rtl' : 'ltr');
    el.title.textContent = T('مشاركة الآيات', 'Share ayahs');
    el.close.setAttribute('aria-label', T('إغلاق', 'Close'));
    el.fromLabel.textContent = T('من الآية', 'From ayah');
    el.toLabel.textContent = T('إلى الآية', 'To ayah');
    el.from.max = el.to.max = surah.v;
    el.from.value = from;
    el.to.value = to;
    el.to.min = from;

    var names = {
      copy: T('نسخ النص', 'Copy text'),
      send: T('مشاركة النص', 'Share as text'),
      picture: T('مشاركة كصورة', 'Share as a picture'),
    };
    var ready = !!held();
    box.querySelectorAll('.sh-act').forEach(function (b) {
      b.textContent = names[b.dataset.act];
      b.disabled = !ready;
    });
    el.text.textContent = ready ? ayahs() : T('جارٍ التحميل…', 'Loading…');
    el.ref.textContent = reference();
  }

  function say(what) { el.said.textContent = what; }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    /* An older browser, or a page not served securely: the selection is copied instead */
    return new Promise(function (resolve, reject) {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.className = 'sh-offscreen';
      box.appendChild(area);
      area.select();
      var done = false;
      try { done = document.execCommand('copy'); } catch (e) { done = false; }
      box.removeChild(area);
      if (done) resolve(); else reject(new Error('copy refused'));
    });
  }

  function act(what) {
    if (!held()) return;
    say('');
    if (what === 'copy') {
      copy(message()).then(
        function () { say(T('تم نسخ النص', 'Text copied')); },
        function () { say(T('تعذّر النسخ', 'The text could not be copied')); });
    } else if (what === 'send') {
      if (navigator.share) {
        /* Dismissing the phone's sheet is not a failure, and is not said */
        navigator.share({ text: message() }).catch(function () {});
      } else {
        copy(message()).then(function () { say(T('تم نسخ النص للمشاركة', 'Text copied, ready to paste')); },
          function () { say(T('تعذّر النسخ', 'The text could not be copied')); });
      }
    } else if (what === 'picture') {
      picture();
    }
  }

  /* --- the picture --- */

  function loadFace() {
    if (face) return face;
    if (!global.FontFace || !document.fonts) return (face = Promise.resolve());
    face = new FontFace(FACE, 'url(' + FACE_URL + ') format("woff2")').load()
      .then(function (f) { document.fonts.add(f); })
      .catch(function () { face = null; });
    return face;
  }

  /* The page's own colours, so the picture is of the theme the reader reads in */
  function colour(name, fallback) {
    var c = getComputedStyle(document.body).getPropertyValue(name).trim();
    return c || fallback;
  }

  /* Each word with its width; an ayah's number rides on its last word, so it
     never opens a line on its own */
  function measured(ctx, size) {
    var t = held(), out = [];
    ctx.font = size + 'px "' + FACE + '", serif';
    var mark = size * 1.25;
    for (var a = from; a <= to; a++) {
      var words = hafs(t.ayahs[a - 1]).split(' ');
      for (var i = 0; i < words.length; i++) {
        var w = { text: words[i], wide: ctx.measureText(words[i]).width };
        if (i === words.length - 1) { w.n = ar(a); w.mark = mark; w.wide += mark + size * 0.2; }
        out.push(w);
      }
    }
    return { words: out, gap: ctx.measureText(' ').width, mark: mark };
  }

  function lined(m, room) {
    var lines = [], line = [], wide = 0;
    m.words.forEach(function (w) {
      var add = (line.length ? m.gap : 0) + w.wide;
      if (line.length && wide + add > room) { lines.push({ words: line, wide: wide }); line = []; wide = 0; add = w.wide; }
      line.push(w);
      wide += add;
    });
    if (line.length) lines.push({ words: line, wide: wide });
    return lines;
  }

  function draw() {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    var room = WIDE - 2 * (EDGE + SIDE);
    var most = MOST_TALL - HEAD - FOOT - 2 * EDGE;

    /* The largest type whose lines the tallest picture holds */
    var size = TYPE_MOST, m, lines;
    for (;;) {
      m = measured(ctx, size);
      lines = lined(m, room);
      if (lines.length * size * LINE <= most || size <= TYPE_LEAST) break;
      size -= TYPE_STEP;
    }
    var block = lines.length * size * LINE;
    if (block > most) return null;

    var tall = Math.max(WIDE, Math.ceil(block + HEAD + FOOT + 2 * EDGE));
    canvas.width = WIDE;
    canvas.height = tall;

    var paper = colour('--paper', '#fffdf7'), ink = colour('--text', '#16283a'), accent = colour('--primary', '#1a6fa3');
    var ui = '"Cairo", system-ui, sans-serif';
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, WIDE, tall);

    /* Two lines round it, as a page's frame: a firm one and a fine one inside */
    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    ctx.strokeRect(EDGE / 2, EDGE / 2, WIDE - EDGE, tall - EDGE);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(EDGE / 2 + 12, EDGE / 2 + 12, WIDE - EDGE - 24, tall - EDGE - 24);

    ctx.direction = 'rtl';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.font = '700 58px ' + ui;
    ctx.fillText(surah.full || surah.name || surah.en, WIDE / 2, EDGE + HEAD * 0.66);

    /* The words stand in the middle of the room between the title and the foot,
       laid from the right, each ayah's number in a ring after its last word */
    var y = EDGE + HEAD + (tall - HEAD - FOOT - 2 * EDGE - block) / 2 + size * 1.3;
    lines.forEach(function (line) {
      var x = (WIDE + line.wide) / 2;
      line.words.forEach(function (w) {
        ctx.font = size + 'px "' + FACE + '", serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = ink;
        ctx.fillText(w.text, x, y);
        if (w.n) {
          var cx = x - (w.wide - w.mark) - size * 0.2 - w.mark / 2, cy = y - size * 0.32;
          ctx.strokeStyle = accent;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, w.mark / 2 - 2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.font = '600 ' + Math.round(size * 0.42) + 'px ' + ui;
          ctx.textAlign = 'center';
          ctx.fillStyle = accent;
          ctx.fillText(w.n, cx, cy + size * 0.15);
        }
        x -= w.wide + m.gap;
      });
      y += size * LINE;
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = ink;
    ctx.font = '600 36px ' + ui;
    ctx.fillText(reference(), WIDE / 2, tall - EDGE - FOOT * 0.56);
    ctx.globalAlpha = 0.6;
    ctx.font = '400 28px ' + ui;
    ctx.direction = 'ltr';
    ctx.fillText(location.host, WIDE / 2, tall - EDGE - FOOT * 0.2);
    ctx.globalAlpha = 1;
    return canvas;
  }

  function picture() {
    say(T('جارٍ إنشاء الصورة…', 'Making the picture…'));
    Promise.resolve(loadFace()).then(function () {
      var canvas = draw();
      if (!canvas) { say(T('الآيات أطول من أن تسعها صورة واحدة', 'These ayahs are too long for one picture')); return; }
      canvas.toBlob(function (blob) {
        if (!blob) { say(T('تعذّر إنشاء الصورة', 'The picture could not be made')); return; }
        var name = 'quran-' + surah.id + '-' + from + (to > from ? '-' + to : '') + '.png';
        var file = global.File ? new File([blob], name, { type: 'image/png' }) : null;
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          say('');
          navigator.share({ files: [file], text: reference() + '\n' + link() }).catch(function () {});
          return;
        }
        /* No share sheet here: the picture is saved as a file instead */
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = name;
        box.appendChild(a);
        a.click();
        box.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        say(T('تم حفظ الصورة', 'Picture saved'));
      }, 'image/png');
    });
  }

  /* --- opening and closing --- */

  var opener = null;

  function open(s, ayah) {
    if (!s) return;
    if (!box) build();
    surah = s;
    opener = document.activeElement;
    from = to = Math.min(Math.max(ayah || 1, 1), s.v);
    say('');
    box.hidden = false;
    render();
    el.close.focus();
    var id = s.id;
    load(id).then(function (got) {
      if (!surah || surah.id !== id || box.hidden) return;
      if (!got) { el.text.textContent = T('تعذّر تحميل النص', 'The text could not be loaded'); return; }
      render();
    });
  }

  function close() {
    if (!box || box.hidden) return;
    box.hidden = true;
    if (opener && opener.focus) opener.focus();
    opener = null;
  }

  document.addEventListener('ui:lang', function () { if (box && !box.hidden) render(); });

  global.Share = {
    open: open,
    close: close,
    isOpen: function () { return !!box && !box.hidden; },
  };

}(window));
