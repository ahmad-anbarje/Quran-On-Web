// --- The mushaf pages that print a run of ayahs, drawn as the reader shows them, to download ---
(function () {
  'use strict';

  var SHAPES = { tall: [1080, 1920], square: [1080, 1080], wide: [1920, 1080] };

  var WORDS = {
    home:      ['← المصحف', '← The Mushaf'],
    title:     ['صورة الآيات', 'Ayahs as a picture'],
    surah:     ['السورة', 'Surah'],
    fromAyah:  ['من الآية', 'From ayah'],
    toAyah:    ['إلى الآية', 'To ayah'],
    shape:     ['الشكل', 'Shape'],
    tall:      ['طولي ٩:١٦', 'Tall 9:16'],
    square:    ['مربع', 'Square'],
    wide:      ['عريض ١٦:٩', 'Wide 16:9'],
    tallFor:   ['ستوري · حالة · خلفية الهاتف', 'Story · status · phone wallpaper'],
    squareFor: ['منشور إنستغرام وفيسبوك', 'Instagram and Facebook post'],
    wideFor:   ['خلفية الحاسوب · عرض تقديمي', 'Computer wallpaper · slides'],
    look:      ['الألوان', 'Colours'],
    light:     ['فاتح', 'Light'],
    dark:      ['داكن', 'Dark'],
    green:     ['أخضر', 'Green'],
    posTop:    ['أعلى', 'Top'],
    posMiddle: ['وسط', 'Middle'],
    posBottom: ['أسفل', 'Bottom'],
    showTitle: ['إظهار اسم السورة', 'Show the surah name'],
    showApp:   ['إظهار تطبيق القرآن العظيم ورمز QR لتحميله', 'Show the Great Quran app and a QR code to get it'],
    download:  ['تنزيل الصورة', 'Download picture'],
    page:      ['الصفحة', 'Page'],
    loading:   ['جارٍ التحميل…', 'Loading…'],
    failed:    ['تعذّر رسم الصفحة', 'The page could not be drawn'],
    langBtn:   ['English', 'العربية'],
  };

  var LANG_KEY = 'quran-lang';
  var KEEP_KEY = 'quran-picture-ask';
  var lang = !stored(LANG_KEY) || stored(LANG_KEY) === 'ar' ? 'ar' : 'en';
  var $ = function (id) { return document.getElementById(id); };
  var surahs = [], drawing = 0;
  var state = Object.assign({ surah: 1, from: 1, to: 7, shape: 'tall', look: 'light', title: true, app: true, titlePos: 'middle' }, kept());

  function stored(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function kept() {
    try { var k = JSON.parse(stored(KEEP_KEY) || '{}'); return { shape: k.shape, look: k.look, title: k.title, app: k.app, titlePos: k.titlePos }; } catch (e) { return {}; }
  }
  function keep() { try { localStorage.setItem(KEEP_KEY, JSON.stringify(state)); } catch (e) { /* storage denied */ } }
  function T(key) { return WORDS[key][lang === 'ar' ? 0 : 1]; }
  function num(n) { return lang === 'ar' ? String(n).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; }) : String(n); }

  // --- the form ---

  function words() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-t]').forEach(function (el) { el.textContent = T(el.dataset.t); });
    $('lang').textContent = T('langBtn');
    document.title = T('title') + ' · ' + (lang === 'ar' ? 'القرآن العظيم' : 'The Great Quran');
    $('surah').innerHTML = surahs.map(function (s) {
      return '<option value="' + s.id + '">' + num(s.id) + '. ' + (lang === 'ar' ? s.name : s.en) + '</option>';
    }).join('');
    show();
    refresh();
  }

  function show() {
    var n = surahs[state.surah - 1].v;
    $('surah').value = state.surah;
    $('from').max = $('to').max = n;
    $('from').value = state.from;
    $('to').value = state.to;
    $('show-title').checked = state.title !== false;
    $('app').checked = state.app !== false;
    // Only what the chosen shape and switches can draw is offered
    $('side-opts').hidden = state.shape === 'tall';
    $('title-opts').hidden = state.title === false;
    ['shape', 'look', 'titlePos'].forEach(function (k) {
      document.querySelectorAll('#' + k + ' button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === state[k]); });
    });
  }

  function tidy() {
    if (!SHAPES[state.shape]) state.shape = 'tall';
    if (!VideoPages.LOOKS[state.look]) state.look = 'light';
    state.surah = Math.min(Math.max(state.surah || 1, 1), 114);
    var n = surahs[state.surah - 1].v;
    state.from = Math.min(Math.max(state.from || 1, 1), n);
    state.to = Math.min(Math.max(state.to || state.from, state.from), n);
  }

  // --- the pictures: one a page ---

  function refresh() {
    keep();
    var mine = ++drawing;
    var pages = VideoPages.pagesOfAyahs(state.surah, state.from, state.to);
    $('status').textContent = T('loading');
    Promise.all([VideoPages.loadFonts(pages), state.app !== false ? VideoPages.loadApp() : null]).then(function () {
      if (mine !== drawing) return;
      var size = SHAPES[state.shape], look = VideoPages.LOOKS[state.look];
      var list = $('pictures');
      list.textContent = '';
      pages.forEach(function (p) {
        var card = document.createElement('figure');
        card.className = 'pc-card';
        var canvas = document.createElement('canvas');
        canvas.width = size[0];
        canvas.height = size[1];
        VideoPages.draw(canvas.getContext('2d'), size[0], size[1], look, {
          page: p, surah: state.surah, ayah: state.from, lit: null,
          showTitle: state.title !== false, titlePos: state.titlePos, showReciter: false, app: state.app !== false,
        });
        var save = document.createElement('button');
        save.type = 'button';
        save.className = 'vm-go';
        save.textContent = T('download') + (pages.length > 1 ? ' · ' + T('page') + ' ' + num(p) : '');
        save.addEventListener('click', function () { download(canvas, p); });
        card.appendChild(canvas);
        card.appendChild(save);
        list.appendChild(card);
      });
      $('status').textContent = '';
    }).catch(function () { if (mine === drawing) $('status').textContent = T('failed'); });
  }

  function download(canvas, page) {
    canvas.toBlob(function (blob) {
      if (!blob) return;
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'quran-page-' + page + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }, 'image/png');
  }

  // What the reader asked for: /picture/?surah=67&from=1&to=12
  function linked() {
    var q = new URLSearchParams(location.search);
    if (q.get('surah')) {
      state.surah = +q.get('surah');
      state.from = +q.get('from') || 1;
      state.to = +q.get('to') || 999;
    }
  }

  function bind() {
    $('lang').addEventListener('click', function () {
      lang = lang === 'ar' ? 'en' : 'ar';
      try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* storage denied */ }
      words();
    });
    $('surah').addEventListener('change', function () {
      state.surah = +$('surah').value;
      state.from = 1;
      state.to = Math.min(surahs[state.surah - 1].v, 7);
      show(); refresh();
    });
    ['from', 'to'].forEach(function (id) {
      $(id).addEventListener('change', function () { state[id] = +$(id).value; tidy(); show(); refresh(); });
    });
    ['shape', 'look', 'titlePos'].forEach(function (k) {
      $(k).addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (b) { state[k] = b.dataset.v; show(); refresh(); }
      });
    });
    $('show-title').addEventListener('change', function () { state.title = $('show-title').checked; show(); refresh(); });
    $('app').addEventListener('change', function () { state.app = $('app').checked; refresh(); });
  }

  Promise.all([
    fetch('/data/surahs.json').then(function (r) { return r.json(); }),
    VideoPages.load(),
  ]).then(function (got) {
    surahs = got[0];
    linked();
    tidy();
    bind();
    words();
  });
}());
