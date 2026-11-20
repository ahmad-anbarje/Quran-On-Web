// --- Mushaf pages drawn on a canvas, laid out as the reader lays them out, one word lit ---
(function (global) {
  'use strict';

  var SEP = '|';
  var LINE = 1.92;              // --m-line-ratio in style.css
  var LINES = 15;
  var CENTRE_GAP = 0.32;        // .m-short's gap
  var WORD_GAP = 0.04;          // the drawn gap inside a two-glyph word
  var SURAH_FACE = 'QCF Surah Names';
  var UI_FACE = '"Cairo", system-ui, sans-serif';

  var mushaf = null;
  var index = null;
  var faces = {};

  var LOOKS = {
    light: { bg: '#e9eef3', paper: '#fffdf7', ink: '#16283a', lit: '#c62828', wash: 'rgba(198,40,40,0.13)',
             mark: '#155982', disc: '#bfd5df', head: '#1a6fa3', soft: '#5b6b7a', rule: '#d8e0e8' },
    dark:  { bg: '#0f1317', paper: '#1a1f25', ink: '#e3e7eb', lit: '#f08a72', wash: 'rgba(240,138,114,0.12)',
             mark: '#8cc8ee', disc: 'rgba(63,155,209,0.38)', head: '#d9b95f', soft: '#9aa6b2', rule: '#2c343d', medal: 'url(#medal-dark)' },
    green: { bg: '#0a2a21', paper: '#0f3b2e', ink: '#ffffff', lit: '#e8b84a', wash: 'rgba(232,184,74,0.14)',
             mark: '#e8b84a', disc: 'rgba(232,184,74,0.22)', head: '#e8b84a', soft: '#b9cfc6', rule: '#1d5444', medal: 'url(#medal-dark)' },
  };

  function ar(n) { return String(n).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; }); }

  function surahGlyph(n) { return String.fromCharCode(0xE000 + parseInt(String(n).padStart(3, '0'), 16)); }
  var SURAH_WORD = String.fromCharCode(0xE000);

  function load() {
    if (mushaf) return Promise.resolve();
    return fetch('/data/mushaf-v4.json')
      .then(function (r) { if (!r.ok) throw new Error('mushaf ' + r.status); return r.json(); })
      .then(function (m) { mushaf = m; index = build(m); });
  }

  // Ayah numbers are recovered by counting end marks from each surah's start, as mushaf.js does
  function build(m) {
    var pageOf = {}, began = {}, juzOf = {};
    var s = 0, v = 0, w = 0, juz = 0;
    for (var p = 1; p <= 604; p++) {
      if (m.juzPages[juz] === p) juz++;
      juzOf[p] = juz;
      var mk = m.marks[p] || '';
      (m.pages[p] || []).forEach(function (line) {
        if (line.t === 'surah') { s = line.s; v = 1; w = 0; }
        if (line.t !== 'ayah') return;
        line.v4.split(SEP).forEach(function (g) {
          if (mk.indexOf(g) >= 0) { v++; w = 0; return; }
          if (w === 0 && !began[s + ':' + v]) began[s + ':' + v] = p;
          pageOf[s + ':' + v + ':' + w] = p;
          w++;
        });
      });
    }
    return { pageOf: pageOf, began: began, juzOf: juzOf };
  }

  function pageOf(s, v, w) { return index.pageOf[s + ':' + v + ':' + w] || index.began[s + ':' + v] || 0; }
  function began(s, v) { return index.began[s + ':' + v] || 0; }
  function juzOf(p) { return index.juzOf[p] || 1; }
  function juzPages() { return mushaf.juzPages; }

  /** Every page that prints part of ayahs `a` to `z` of surah `s`, in order. */
  function pagesOfAyahs(s, a, z) {
    var seen = {};
    for (var v = a; v <= z; v++) {
      if (index.began[s + ':' + v]) seen[index.began[s + ':' + v]] = true;
      for (var w = 0, p; (p = index.pageOf[s + ':' + v + ':' + w]); w++) seen[p] = true;
    }
    return Object.keys(seen).map(Number).sort(function (x, y) { return x - y; });
  }

  function family(p) { return 'QCFV4-' + p; }
  // The ayah medallions, from the Tajweed edition's colour face, as the reader draws them
  function medalFamily(p) { return 'QCFTJB-' + p; }

  function loadFace(name, url) {
    if (!faces[name]) {
      var face = new FontFace(name, 'url(' + url + ')');
      faces[name] = face.load().then(function (f) { document.fonts.add(f); return f; });
    }
    return faces[name];
  }

  function loadFont(p) { return loadFace(family(p), '/fonts/v4/p' + p + '.woff2'); }

  // A page without its medallion face still draws, with the plain marks
  var medalOk = {};
  function loadMedals(p) {
    return loadFace(medalFamily(p), '/fonts/tjb/p' + p + '.woff2')
      .then(function (f) { medalOk[p] = true; return f; }, function () { return null; });
  }

  // Everything a run of pages draws with: their own faces, their medallions, the Basmalah's, and the names'
  function loadFonts(pages) {
    var all = pages.map(loadFont).concat(pages.map(loadMedals));
    all.push(loadFont('b'));
    all.push(document.fonts.load('40px "' + SURAH_FACE + '"', SURAH_WORD));
    all.push(document.fonts.load('700 40px Cairo', 'الجزء'));
    all.push(document.fonts.load('600 40px Cairo', 'Juz'));
    return Promise.all(all);
  }

  function dropFonts() {
    Object.keys(faces).forEach(function (name) {
      faces[name].then(function (f) { if (f) document.fonts.delete(f); }).catch(function () {});
    });
    faces = {};
    medalOk = {};
    laid = {};
  }

  // --- one page laid out at a type size, words placed by their right edge ---

  function metrics(ctx, sample) {
    var m = ctx.measureText(sample);
    return { a: m.fontBoundingBoxAscent, d: m.fontBoundingBoxDescent };
  }

  function wordWidth(ctx, text, em) {
    var parts = text.split(' ');
    var w = 0;
    for (var i = 0; i < parts.length; i++) w += ctx.measureText(parts[i]).width;
    return w + (parts.length - 1) * WORD_GAP * em;
  }

  function layout(ctx, p, em, measure) {
    var lineH = em * LINE;
    var mk = mushaf.marks[p] || '';
    var centreBelow = mushaf.fit.centreBelow.v4 || 0.92;
    var out = { lines: [] };
    var s = 0, v = 0, w = 0;
    var medals = Array.from((mushaf.ends && mushaf.ends[p]) || ''), m = 0;
    var hasMedals = !!medalOk[p];
    // Where this page's numbering stands as it opens
    var first = firstWordOf(p);
    if (first) { s = first.s; v = first.v; w = first.w; }

    (mushaf.pages[p] || []).forEach(function (line, i) {
      var top = i * lineH;
      if (line.t === 'surah') { s = line.s; v = 1; w = 0; out.lines.push({ t: 'surah', s: s, top: top }); return; }
      if (line.t === 'basmalah') { out.lines.push({ t: 'basmalah', text: line.v4.split(SEP).join(' '), top: top }); return; }

      var glyphs = line.v4.split(SEP);
      var words = glyphs.map(function (g) {
        var end = mk.indexOf(g) >= 0;
        var medal = end && medals[m] && hasMedals ? medals[m++] : null;
        ctx.font = em + 'px "' + (medal ? medalFamily(p) : family(p)) + '"';
        var word = { text: medal || g, medal: !!medal, end: end, wide: wordWidth(ctx, medal || g, em), key: end ? null : s + ':' + v + ':' + w };
        if (end) { v++; w = 0; } else w++;
        return word;
      });
      var total = words.reduce(function (a, x) { return a + x.wide; }, 0);
      var size = em, gap, x = measure;

      if (total > measure) {
        // Drawn wider than the measure: shrunk to fit, as the reader does
        size = em * measure / total * 0.995;
        words.forEach(function (x2) { x2.wide *= size / em; });
        total *= size / em;
        gap = words.length > 1 ? (measure - total) / (words.length - 1) : 0;
      } else if (total < measure * centreBelow && total + (words.length - 1) * CENTRE_GAP * em <= measure) {
        gap = CENTRE_GAP * em;
        x = (measure + total + gap * (words.length - 1)) / 2;
      } else if (words.length > 1) {
        gap = (measure - total) / (words.length - 1);
      } else {
        gap = 0;
        x = (measure + total) / 2;
      }

      ctx.font = size + 'px "' + family(p) + '"';
      var fm = metrics(ctx, glyphs[0]);
      var base = top + (lineH - (fm.a + fm.d)) / 2 + fm.a;
      words.forEach(function (word) {
        word.right = x;
        x -= word.wide + gap;
      });
      out.lines.push({ t: 'ayah', words: words, size: size, base: base, a: fm.a, d: fm.d });
    });
    return out;
  }

  function firstWordOf(p) {
    var keys = index.firstKeys || (index.firstKeys = firstKeys());
    return keys[p];
  }

  function firstKeys() {
    var at = {};
    Object.keys(index.pageOf).forEach(function (k) {
      var p = index.pageOf[k];
      var parts = k.split(':');
      var key = { s: +parts[0], v: +parts[1], w: +parts[2] };
      var cur = at[p];
      if (!cur || key.s < cur.s || (key.s === cur.s && (key.v < cur.v || (key.v === cur.v && key.w < cur.w)))) at[p] = key;
    });
    return at;
  }

  var laid = {};

  function laidOut(ctx, p, em, measure) {
    var k = p + '@' + em.toFixed(3);
    if (!laid[k]) {
      if (Object.keys(laid).length > 6) laid = {};
      laid[k] = layout(ctx, p, em, measure);
    }
    return laid[k];
  }

  // --- drawing ---

  function drawWord(ctx, p, word, size, x, y) {
    ctx.font = size + 'px "' + (word.medal ? medalFamily(p) : family(p)) + '"';
    var parts = word.text.split(' ');
    for (var i = 0; i < parts.length; i++) {
      ctx.fillText(parts[i], x, y);
      x -= ctx.measureText(parts[i]).width + WORD_GAP * size;
    }
  }

  function drawPage(ctx, p, x0, y0, em, measure, look, lit) {
    var page = laidOut(ctx, p, em, measure);
    var lineH = em * LINE;
    ctx.save();
    ctx.translate(x0, y0);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';

    page.lines.forEach(function (line) {
      if (line.t === 'surah') return drawSurahLine(ctx, line, measure, lineH, look);
      if (line.t === 'basmalah') return drawBasmalah(ctx, line, measure, lineH, em, look);
      line.words.forEach(function (word) {
        if (word.medal) {
          // A colour glyph: its own palette, recoloured for dark pages as the reader's filter does
          ctx.save();
          if (look.medal) ctx.filter = look.medal;
          drawWord(ctx, p, word, line.size, word.right, line.base);
          ctx.restore();
          return;
        }
        if (word.end) {
          var cx = word.right - word.wide / 2;
          var cy = line.base - line.a + 0.56 * (line.a + line.d);
          ctx.fillStyle = look.disc;
          ctx.beginPath();
          ctx.arc(cx, cy, 0.36 * line.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = look.mark;
        } else if (word.key === lit) {
          ctx.fillStyle = look.wash;
          var r = 0.08 * line.size;
          roundRect(ctx, word.right - word.wide - r, line.base - line.a, word.wide + 2 * r, line.a + line.d, r);
          ctx.fill();
          ctx.fillStyle = look.lit;
        } else {
          ctx.fillStyle = look.ink;
        }
        drawWord(ctx, p, word, line.size, word.right, line.base);
      });
    });
    ctx.restore();
  }

  function drawSurahLine(ctx, line, measure, lineH, look) {
    var fs = lineH * 0.95;
    ctx.font = fs + 'px "' + SURAH_FACE + '"';
    var name = surahGlyph(line.s);
    var ws = ctx.measureText(SURAH_WORD).width, wn = ctx.measureText(name).width, gap = 0.1 * fs;
    var fm = metrics(ctx, name);
    var base = line.top + (lineH - (fm.a + fm.d)) / 2 + fm.a;
    var x = (measure + ws + gap + wn) / 2;
    ctx.fillStyle = look.head;
    ctx.fillText(SURAH_WORD, x, base);
    ctx.fillText(name, x - ws - gap, base);
  }

  function drawBasmalah(ctx, line, measure, lineH, em, look) {
    var fs = em * 0.86;
    ctx.font = fs + 'px "' + family('b') + '", serif';
    var fm = metrics(ctx, line.text);
    var base = line.top + (lineH - (fm.a + fm.d)) / 2 + fm.a;
    ctx.fillStyle = look.head;
    ctx.save();
    // A run of left-to-right glyphs, as the reader's rtl line shows it
    ctx.direction = 'ltr';
    ctx.textAlign = 'center';
    ctx.fillText(line.text, measure / 2, base);
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // --- the whole picture: the sheet, its running head, and what is said beside it ---

  var HEAD = 2.1;               // the running head's height, in ems
  var PAD = 0.9;                // the sheet's padding, in ems

  // Where the sheet sits in a picture of this size, and at what type size
  function frame(width, height) {
    var base = mushaf.fit.body.v4;
    var margin = Math.round(Math.min(width, height) * 0.04);
    var tallEms = LINES * LINE + HEAD + 2 * PAD;
    var wideEms = base + 2 * PAD;
    var em = Math.min((width - 2 * margin) / wideEms, (height - 2 * margin) / tallEms);
    var sheetW = wideEms * em, sheetH = tallEms * em;
    return {
      em: em, measure: base * em,
      sheet: { x: (width - sheetW) / 2, y: (height - sheetH) / 2, w: sheetW, h: sheetH },
    };
  }

  /**
   * One picture. `at` is { page, surah, ayah, lit, reciter, total } — lit the "s:v:w" being said, or null.
   */
  function draw(ctx, width, height, look, at) {
    var f = frame(width, height);
    var sh = f.sheet, em = f.em;
    ctx.fillStyle = look.bg;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = look.paper;
    roundRect(ctx, sh.x, sh.y, sh.w, sh.h, em * 0.6);
    ctx.fill();
    ctx.strokeStyle = look.rule;
    ctx.lineWidth = Math.max(1, em * 0.05);
    ctx.stroke();

    var inX = sh.x + PAD * em, inY = sh.y + PAD * em;
    drawHead(ctx, inX, inY, f.measure, em, look, at);
    drawPage(ctx, at.page, inX, inY + HEAD * em, em, f.measure, look, at.lit);
    drawSides(ctx, width, height, f, look, at);
  }

  function drawHead(ctx, x, y, measure, em, look, at) {
    var mid = y + HEAD * em * 0.42;
    var size = em * 0.62;
    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.fillStyle = look.head;
    ctx.font = '700 ' + size + 'px ' + UI_FACE;
    ctx.textAlign = 'right';
    ctx.direction = 'rtl';
    ctx.fillText('الجزء ' + ar(juzOf(at.page)), x + measure, mid);
    ctx.textAlign = 'left';
    ctx.fillText(ar(at.page), x, mid);
    ctx.font = (size * 1.6) + 'px "' + SURAH_FACE + '"';
    ctx.textAlign = 'center';
    ctx.direction = 'ltr';
    ctx.fillText(surahGlyph(at.surah), x + measure / 2, mid);
    ctx.strokeStyle = look.rule;
    ctx.lineWidth = Math.max(1, em * 0.04);
    ctx.beginPath();
    ctx.moveTo(x, y + HEAD * em * 0.84);
    ctx.lineTo(x + measure, y + HEAD * em * 0.84);
    ctx.stroke();
    ctx.restore();
  }

  // --- the Android app: its icon, its name and a QR code to its store page ---

  var APP_NAME = 'تطبيق القرآن العظيم';
  var STORE = 'Google Play';
  var app = { ready: false, icon: null, qr: null };

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = src;
    });
  }

  function loadApp() {
    if (app.ready) return Promise.resolve();
    return Promise.all([loadImage('/icon-512.png'), loadImage('/video/app-qr.svg')]).then(function (got) {
      app.icon = got[0];
      app.qr = got[1];
      app.ready = true;
    }).catch(function () { /* drawn without it */ });
  }

  // The QR on white whatever the look, so a phone's camera reads it
  function drawQr(ctx, x, y, s) {
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, x, y, s, s, s * 0.06);
    ctx.fill();
    ctx.drawImage(app.qr, x, y, s, s);
  }

  /**
   * A small strip: the code, then the icon with the name and the store beside it, read from the right.
   * `right` is where the strip ends; `mid` its vertical middle; `qs` the code's size.
   */
  function drawAppStrip(ctx, right, mid, qs, look) {
    var ic = qs * 0.5, gap = qs * 0.14, text = qs * 0.17;
    ctx.save();
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.drawImage(app.icon, right - ic, mid - ic / 2, ic, ic);
    var tx = right - ic - gap;
    ctx.fillStyle = look.ink;
    ctx.font = '700 ' + text + 'px ' + UI_FACE;
    ctx.fillText(APP_NAME, tx, mid - text * 0.62);
    var nameW = ctx.measureText(APP_NAME).width;
    ctx.fillStyle = look.soft;
    ctx.font = '600 ' + (text * 0.85) + 'px ' + UI_FACE;
    ctx.fillText(STORE, tx, mid + text * 0.72);
    drawQr(ctx, tx - nameW - gap - qs, mid - qs / 2, qs);
    ctx.restore();
  }

  // A column too narrow for the strip: the icon and name, with the code under them, ending at `bottom`
  function drawAppStack(ctx, cx, bottom, qs, look) {
    var ic = qs * 0.36, text = qs * 0.13;
    ctx.save();
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawQr(ctx, cx - qs / 2, bottom - qs, qs);
    var y = bottom - qs - text * 1.2;
    ctx.fillStyle = look.ink;
    ctx.font = '700 ' + text + 'px ' + UI_FACE;
    ctx.fillText(APP_NAME, cx, y);
    ctx.drawImage(app.icon, cx - ic / 2, y - text * 0.9 - ic, ic, ic);
    ctx.restore();
  }

  function stripWidth(ctx, qs) {
    ctx.save();
    ctx.font = '700 ' + (qs * 0.17) + 'px ' + UI_FACE;
    var w = qs * 0.5 + qs * 0.14 + ctx.measureText(APP_NAME).width + qs * 0.14 + qs;
    ctx.restore();
    return w;
  }

  // "سورة" and the name on one line, as the mushaf heads a surah, fitted to `room`
  function drawSurahTitle(ctx, s, cx, cy, size, room, colour) {
    ctx.save();
    ctx.font = size + 'px "' + SURAH_FACE + '"';
    var name = surahGlyph(s);
    var ws = ctx.measureText(SURAH_WORD).width, wn = ctx.measureText(name).width, gap = 0.1 * size;
    var total = ws + gap + wn;
    if (total > room) {
      size *= room / total;
      ctx.font = size + 'px "' + SURAH_FACE + '"';
      ws = ctx.measureText(SURAH_WORD).width; wn = ctx.measureText(name).width; gap = 0.1 * size;
      total = ws + gap + wn;
    }
    ctx.direction = 'ltr';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = colour;
    var x = cx + total / 2;
    ctx.fillText(SURAH_WORD, x, cy);
    ctx.fillText(name, x - ws - gap, cy);
    ctx.restore();
  }

  // --- the ayah's meaning beside the page ---

  var TRANSLATION_BY = 'Saheeh International';
  var LATIN_FACE = '"Cairo", system-ui, -apple-system, "Segoe UI", sans-serif';

  // The taller of the two bands left above and below what is already drawn there
  function freeBand(a, z, busy, gap) {
    if (!busy) return [a, z];
    var above = [a, busy[0] - gap], below = [busy[1] + gap, z];
    return above[1] - above[0] > below[1] - below[0] ? above : below;
  }

  function wrap(ctx, text, width) {
    var lines = [], line = '';
    text.split(/\s+/).forEach(function (w) {
      var next = line ? line + ' ' + w : w;
      if (line && ctx.measureText(next).width > width) { lines.push(line); line = w; } else line = next;
    });
    if (line) lines.push(line);
    return lines;
  }

  // The largest type, down to a readable least, that holds the whole meaning in `band`; nothing if none does
  function drawTranslation(ctx, text, cx, width, band, size, look) {
    var room = band[1] - band[0];
    var least = Math.max(size * 0.3, 13);
    for (var f = size * 0.48; f >= least; f -= 1) {
      ctx.font = '500 ' + f + 'px ' + LATIN_FACE;
      var lines = wrap(ctx, text, width), lh = f * 1.5, by = f * 0.75;
      var tall = lines.length * lh + by * 1.8;
      if (tall > room) continue;
      ctx.save();
      ctx.direction = 'ltr';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var y = band[0] + (room - tall) / 2 + lh / 2;
      ctx.fillStyle = look.ink;
      lines.forEach(function (l) { ctx.fillText(l, cx, y); y += lh; });
      ctx.fillStyle = look.soft;
      ctx.font = '500 ' + by + 'px ' + LATIN_FACE;
      ctx.fillText(TRANSLATION_BY, cx, y - lh / 2 + by * 1.4);
      ctx.restore();
      return true;
    }
    return false;
  }

  // The room beside or around the sheet: the surah, the reciter, the ayah if asked for, and the app if wanted
  function drawSides(ctx, width, height, f, look, at) {
    var sh = f.sheet;
    var side = sh.x, above = sh.y;
    var withApp = at.app && app.ready;
    ctx.save();
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (side > width * 0.16) {
      var colW = side * 0.84;
      var size = Math.min(colW / 6, height * 0.05);
      var cxR = sh.x + sh.w + side / 2, cxL = side / 2;
      // The app sits at the left column's foot; what is placed at the bottom stands above it
      var qs = height * 0.11, stacked = withApp && stripWidth(ctx, qs) > colW;
      var appH = !withApp ? 0 : stacked ? Math.min(colW * 0.62, height * 0.13) * 1.75 : qs;
      // Right of the sheet: the surah's name, at the place and size asked for
      if (at.showTitle !== false) {
        var ty = { top: 0.1, middle: 0.45, bottom: 0.9 }[at.titlePos] || 0.45;
        drawSurahTitle(ctx, at.surah, cxR, sh.y + sh.h * ty, size * 2.2 * (at.titleScale || 1), colW, look.head);
      }
      // Left: the reciter, and the ayah under it only if asked for, at the place asked for
      var blockH = size * (at.showAyah ? 2.3 : 1.2);
      var floor = sh.y + sh.h - (appH ? appH + size * 0.8 : 0);
      var top = { top: sh.y + sh.h * 0.08, middle: sh.y + sh.h * 0.45 - blockH / 2, bottom: floor - blockH }[at.reciterPos] || sh.y + sh.h * 0.08;
      if (at.reciter && at.showReciter !== false) {
        ctx.fillStyle = look.soft;
        ctx.font = '600 ' + (size * 0.45) + 'px ' + UI_FACE;
        ctx.fillText('القارئ', cxL, top);
        ctx.fillStyle = look.ink;
        ctx.font = '700 ' + (size * 0.62) + 'px ' + UI_FACE;
        ctx.fillText(at.reciter, cxL, top + size * 0.75);
      }
      if (at.showAyah) {
        ctx.fillStyle = look.ink;
        ctx.font = '700 ' + (size * 0.62) + 'px ' + UI_FACE;
        ctx.fillText('الآية ' + ar(at.ayah), cxL, top + size * 1.85);
      }
      // The meaning in the largest room the reciter leaves in the column, or not at all where it cannot be read
      if (at.translation) {
        var busy = (at.reciter && at.showReciter !== false) || at.showAyah ? [top - size * 0.5, top + blockH] : null;
        drawTranslation(ctx, at.translation, cxL, colW, freeBand(sh.y + sh.h * 0.04, floor, busy, size * 0.6), size, look);
      }
      if (withApp) {
        if (!stacked) drawAppStrip(ctx, cxL + stripWidth(ctx, qs) / 2, sh.y + sh.h - qs / 2, qs, look);
        else drawAppStack(ctx, cxL, sh.y + sh.h, Math.min(colW * 0.62, height * 0.13), look);
      }
    } else {
      var s2 = Math.min(Math.max(above, height * 0.03) * 0.42, width * 0.04);
      if (at.showAyah && above > height * 0.02) {
        ctx.fillStyle = look.head;
        ctx.font = '700 ' + s2 + 'px ' + UI_FACE;
        ctx.fillText('الآية ' + ar(at.ayah), width / 2, above / 2);
      }
    }
    ctx.restore();
  }

  global.VideoPages = {
    LOOKS: LOOKS,
    load: load,
    loadFonts: loadFonts,
    loadApp: loadApp,
    dropFonts: dropFonts,
    pageOf: pageOf,
    began: began,
    juzOf: juzOf,
    juzPages: juzPages,
    pagesOfAyahs: pagesOfAyahs,
    draw: draw,
  };

}(window));
