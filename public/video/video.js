// --- The video maker's form: what to recite, how it looks, and the making itself ---
(function () {
  'use strict';

  var WORDS = {
    home:        ['← المصحف', '← The Mushaf'],
    title:       ['صانع فيديو التلاوة', 'Recitation video maker'],
    unsupported: ['هذا المتصفح لا يستطيع صنع الفيديو. استخدم Chrome أو Edge على الحاسوب أو Android.', 'This browser cannot make videos. Use Chrome or Edge on a computer or Android.'],
    what:        ['المقطع', 'What to recite'],
    bySurah:     ['سورة', 'Surah'],
    byJuz:       ['جزء', 'Juz'],
    byPages:     ['صفحات', 'Pages'],
    surah:       ['السورة', 'Surah'],
    fromAyah:    ['من الآية', 'From ayah'],
    toAyah:      ['إلى الآية', 'To ayah'],
    juz:         ['الجزء', 'Juz'],
    fromPage:    ['من الصفحة', 'From page'],
    toPage:      ['إلى الصفحة', 'To page'],
    reciter:     ['القارئ', 'Reciter'],
    shape:       ['الشكل', 'Shape'],
    wide:        ['عريض ١٦:٩', 'Wide 16:9'],
    tall:        ['طولي ٩:١٦', 'Tall 9:16'],
    square:      ['مربع', 'Square'],
    wideFor:     ['يوتيوب · تلفاز · حاسوب', 'YouTube · TV · computer'],
    tallFor:     ['تيك توك · ريلز · حالة واتساب', 'TikTok · Reels · WhatsApp status'],
    squareFor:   ['منشور إنستغرام وفيسبوك', 'Instagram and Facebook post'],
    look:        ['الألوان', 'Colours'],
    light:       ['فاتح', 'Light'],
    dark:        ['داكن', 'Dark'],
    green:       ['أخضر', 'Green'],
    quality:     ['الجودة', 'Quality'],
    qStandard:   ['عادية 1080p', 'Standard 1080p'],
    qHigh:       ['عالية 1440p', 'High 1440p'],
    qMax:        ['فائقة 4K', 'Highest 4K'],
    posTop:      ['أعلى', 'Top'],
    posMiddle:   ['وسط', 'Middle'],
    posBottom:   ['أسفل', 'Bottom'],
    showTitle:   ['إظهار اسم السورة', 'Show the surah name'],
    showReciter: ['إظهار اسم القارئ', 'Show the reciter'],
    titleSize:   ['حجم اسم السورة', 'Surah name size'],
    showTranslation: ['إظهار المعنى بالإنجليزية (صحيح إنترناشيونال)', 'Show the English meaning (Saheeh International)'],
    showAyah:    ['إظهار رقم الآية', 'Show the ayah number'],
    showApp:     ['إظهار تطبيق القرآن العظيم ورمز QR لتحميله', 'Show the Great Quran app and a QR code to get it'],
    make:        ['صنع الفيديو', 'Make video'],
    stop:        ['إيقاف', 'Stop'],
    download:    ['تنزيل الفيديو', 'Download video'],
    back:        ['العودة إلى المعاينة', 'Back to the preview'],
    length:      ['مدة الفيديو: {t}', 'Video length: {t}'],
    fonts:       ['تحميل خطوط الصفحات…', 'Loading the page fonts…'],
    audio:       ['تحميل التلاوة… {p}٪', 'Loading the recitation… {p}%'],
    encode:      ['صنع الفيديو… {p}٪', 'Making the video… {p}%'],
    done:        ['تم صنع الفيديو وبدأ تنزيله', 'The video is ready and downloading'],
    saved:       ['تم حفظ الفيديو في الملف المختار', 'The video was saved to the chosen file'],
    stopped:     ['توقف صنع الفيديو', 'Stopped'],
    failed:      ['تعذّر صنع الفيديو: {e}', 'The video could not be made: {e}'],
    langBtn:     ['English', 'العربية'],
  };

  var LANG_KEY = 'quran-lang';
  var KEEP_KEY = 'quran-video-ask';
  // Longer than this goes straight to a file, where the browser allows it, rather than being held in memory
  var TO_FILE_MS = 10 * 60 * 1000;

  var lang = stored(LANG_KEY) === 'ar' || !stored(LANG_KEY) ? 'ar' : 'en';
  var $ = function (id) { return document.getElementById(id); };
  var surahs = [], reciters = [], plan = null, job = null, previewing = 0, madeUrl = null;

  var state = Object.assign({
    kind: 'surah', surah: 67, ayahFrom: 1, ayahTo: 5, juz: 30, pageFrom: 562, pageTo: 563,
    reciter: '', shape: 'wide', look: 'light', quality: 'standard', app: true, ayah: false, titleSize: 100, title: true, reciterShown: true, titlePos: 'middle', reciterPos: 'top', translation: true,
  }, kept(), linked());

  // What the reader's Share window asked for: /video/?surah=67&from=1&to=5&reciter=…
  function linked() {
    var q = new URLSearchParams(location.search), got = {};
    if (q.get('surah')) {
      got.kind = 'surah';
      got.surah = +q.get('surah');
      got.ayahFrom = +q.get('from') || 1;
      got.ayahTo = +q.get('to') || 999;
    } else if (q.get('juz')) {
      got.kind = 'juz';
      got.juz = +q.get('juz');
    }
    if (q.get('reciter')) got.reciter = q.get('reciter');
    return got;
  }

  function stored(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function kept() { try { return JSON.parse(stored(KEEP_KEY) || '{}'); } catch (e) { return {}; } }
  function keep() { try { localStorage.setItem(KEEP_KEY, JSON.stringify(state)); } catch (e) { /* storage denied */ } }

  function T(key, vars) {
    var s = WORDS[key][lang === 'ar' ? 0 : 1];
    return vars ? s.replace(/\{(\w+)\}/g, function (m, k) { return k in vars ? vars[k] : m; }) : s;
  }

  function num(n) { return lang === 'ar' ? String(n).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; }) : String(n); }

  function clock(ms) {
    var s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
    var t = (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0');
    return num(t);
  }

  // --- text and choices ---

  function words() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-t]').forEach(function (el) { el.textContent = T(el.dataset.t); });
    $('lang').textContent = T('langBtn');
    document.title = T('title') + ' · ' + (lang === 'ar' ? 'القرآن العظيم' : 'The Great Quran');
    if (plan) $('length').textContent = T('length', { t: clock(plan.durationMs) });
    fillChoices();
  }

  function fillChoices() {
    $('surah').innerHTML = surahs.map(function (s) {
      return '<option value="' + s.id + '">' + num(s.id) + '. ' + (lang === 'ar' ? s.name : s.en) + '</option>';
    }).join('');
    var juz = '';
    for (var j = 1; j <= 30; j++) juz += '<option value="' + j + '">' + (lang === 'ar' ? 'الجزء ' : 'Juz ') + num(j) + '</option>';
    $('juz').innerHTML = juz;
    $('reciter').innerHTML = reciters.map(function (r) {
      var name = lang === 'ar' ? r.nameAr : r.name, note = lang === 'ar' ? r.noteAr : r.note;
      return '<option value="' + r.id + '">' + name + (note ? ' — ' + note : '') + '</option>';
    }).join('');
    show();
  }

  function show() {
    document.querySelectorAll('#kind button').forEach(function (b) {
      var on = b.dataset.kind === state.kind;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on);
    });
    document.querySelectorAll('.vm-row[data-for]').forEach(function (row) { row.hidden = row.dataset.for !== state.kind; });
    $('surah').value = state.surah;
    var n = (surahs[state.surah - 1] || { v: 1 }).v;
    $('ayah-from').max = $('ayah-to').max = n;
    $('ayah-from').value = state.ayahFrom;
    $('ayah-to').value = state.ayahTo;
    $('juz').value = state.juz;
    $('page-from').value = state.pageFrom;
    $('page-to').value = state.pageTo;
    $('reciter').value = state.reciter;
    $('app').checked = state.app !== false;
    $('show-ayah').checked = !!state.ayah;
    $('title-size').value = state.titleSize || 100;
    $('show-title').checked = state.title !== false;
    $('show-reciter').checked = state.reciterShown !== false;
    $('show-translation').checked = state.translation !== false;
    // Only what the chosen shape and switches can draw is offered
    $('side-opts').hidden = !VideoMaker.hasSides(state.shape);
    $('title-opts').hidden = state.title === false;
    $('reciter-opts').hidden = state.reciterShown === false;
    ['shape', 'look', 'quality', 'titlePos', 'reciterPos'].forEach(function (k) {
      document.querySelectorAll('#' + k + ' button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === state[k]); });
    });
  }

  function ask() {
    if (state.kind === 'juz') return { kind: 'juz', juz: state.juz };
    if (state.kind === 'pages') return { kind: 'pages', from: state.pageFrom, to: state.pageTo };
    return { kind: 'surah', surah: state.surah, from: state.ayahFrom, to: state.ayahTo };
  }

  function reciterName() {
    var r = reciters.find(function (x) { return x.id === state.reciter; });
    return r ? r.nameAr : '';
  }

  function options() {
    return { ask: ask(), reciter: state.reciter, reciterName: reciterName(), shape: state.shape, look: state.look, quality: state.quality, app: state.app !== false, ayah: !!state.ayah, titleSize: state.titleSize || 100, title: state.title !== false, reciterShown: state.reciterShown !== false, titlePos: state.titlePos, reciterPos: state.reciterPos, translation: state.translation !== false };
  }

  // --- the preview: the first picture, and how long the whole will be ---

  function refresh() {
    keep();
    // A change of choice puts the finished video away for the new preview
    if (!job) backToPreview();
    var mine = ++previewing;
    plan = null;
    $('go').disabled = true;
    VideoMaker.preview($('preview'), options()).then(function (p) {
      if (mine !== previewing) return;
      plan = p;
      $('length').textContent = T('length', { t: clock(p.durationMs) });
      $('go').disabled = !VideoMaker.supported() || !!job;
    }).catch(function (e) {
      if (mine !== previewing) return;
      $('length').textContent = T('failed', { e: e.message });
    });
  }

  // --- making ---

  // The recitation's download is the first tenth of the bar, the making the rest
  function say(stage, done) {
    var p = Math.round(done * 100);
    $('bar').style.width = (stage === 'encode' ? 10 + p * 0.9 : stage === 'audio' ? p * 0.1 : 0) + '%';
    $('status').textContent = T(stage, { p: num(p) });
  }

  function backToPreview() {
    if (madeUrl) { URL.revokeObjectURL(madeUrl); madeUrl = null; }
    $('video').removeAttribute('src');
    $('video').hidden = true;
    $('preview').hidden = false;
    $('result').hidden = true;
  }

  function finished(note, url) {
    $('progress').hidden = true;
    $('result-note').textContent = note;
    $('save').hidden = !url;
    $('result').hidden = false;
    if (!url) return;
    madeUrl = url;
    // Shows its first picture, not a black frame, until it is played
    $('video').addEventListener('loadeddata', function () { this.currentTime = 0.05; }, { once: true });
    $('video').src = url;
    $('preview').hidden = true;
    $('video').hidden = false;
    $('save').href = url;
    $('save').download = fileName();
    // Its own page's blob, under a name made here from known ids: nothing from outside is fetched or named
    $('save').click();
  }

  function fileName() {
    var a = ask(), r = state.reciter;
    if (a.kind === 'juz') return 'juz-' + a.juz + '-' + r + '.mp4';
    if (a.kind === 'pages') return 'pages-' + a.from + '-' + a.to + '-' + r + '.mp4';
    var s = surahs[a.surah - 1];
    return s.en.replace(/[^A-Za-z0-9-]/g, '') + '-' + a.from + '-' + a.to + '-' + r + '.mp4';
  }

  async function start(e) {
    e.preventDefault();
    if (job || !plan) return;
    var target = null;
    if (plan.durationMs > TO_FILE_MS && window.showSaveFilePicker) {
      try {
        var handle = await window.showSaveFilePicker({ suggestedName: fileName(), types: [{ description: 'MP4', accept: { 'video/mp4': ['.mp4'] } }] });
        target = await handle.createWritable();
      } catch (err) { return; }
    }
    backToPreview();
    job = { aborted: false };
    $('go').disabled = true;
    $('stop').hidden = false;
    $('bar').style.width = '0%';
    $('status').textContent = '';
    $('progress').hidden = false;
    var opts = options();
    opts.target = target;
    opts.signal = job;
    opts.onProgress = say;
    try {
      var made = await VideoMaker.make(opts);
      if (target) await target.close();
      if (made.blob) finished(T('done'), URL.createObjectURL(made.blob));
      else finished(T('saved'), null);
    } catch (err) {
      if (target) try { await target.abort(); } catch (x) { /* already closed */ }
      finished(err.name === 'AbortError' ? T('stopped') : T('failed', { e: err.message }), null);
    } finally {
      job = null;
      $('stop').hidden = true;
      $('go').disabled = !plan;
    }
  }

  // --- wiring ---

  function bind() {
    $('lang').addEventListener('click', function () {
      lang = lang === 'ar' ? 'en' : 'ar';
      try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* storage denied */ }
      words();
    });
    $('kind').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) { state.kind = b.dataset.kind; show(); refresh(); }
    });
    ['shape', 'look', 'quality', 'titlePos', 'reciterPos'].forEach(function (k) {
      $(k).addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (b) { state[k] = b.dataset.v; show(); refresh(); }
      });
    });
    $('surah').addEventListener('change', function () {
      state.surah = +$('surah').value;
      state.ayahFrom = 1;
      state.ayahTo = Math.min(surahs[state.surah - 1].v, 10);
      show(); refresh();
    });
    var fields = { 'ayah-from': 'ayahFrom', 'ayah-to': 'ayahTo', 'page-from': 'pageFrom', 'page-to': 'pageTo', juz: 'juz' };
    Object.keys(fields).forEach(function (id) {
      $(id).addEventListener('change', function () { state[fields[id]] = +$(id).value; tidy(); show(); refresh(); });
    });
    $('reciter').addEventListener('change', function () { state.reciter = $('reciter').value; refresh(); });
    $('app').addEventListener('change', function () { state.app = $('app').checked; refresh(); });
    $('show-translation').addEventListener('change', function () { state.translation = $('show-translation').checked; refresh(); });
    $('show-ayah').addEventListener('change', function () { state.ayah = $('show-ayah').checked; refresh(); });
    $('show-title').addEventListener('change', function () { state.title = $('show-title').checked; show(); refresh(); });
    $('show-reciter').addEventListener('change', function () { state.reciterShown = $('show-reciter').checked; show(); refresh(); });
    // Redrawn as it is dragged, kept once let go
    $('title-size').addEventListener('input', function () { state.titleSize = +$('title-size').value; refresh(); });
    $('form').addEventListener('submit', start);
    $('stop').addEventListener('click', function () { if (job) job.aborted = true; });
    $('back').addEventListener('click', backToPreview);
  }

  // Both ends kept in range, the far one never before the near one
  function tidy() {
    state.surah = Math.min(Math.max(state.surah || 1, 1), 114);
    state.juz = Math.min(Math.max(state.juz || 1, 1), 30);
    var n = surahs[state.surah - 1].v;
    state.ayahFrom = Math.min(Math.max(state.ayahFrom || 1, 1), n);
    state.ayahTo = Math.min(Math.max(state.ayahTo || state.ayahFrom, state.ayahFrom), n);
    state.pageFrom = Math.min(Math.max(state.pageFrom || 1, 1), 604);
    state.pageTo = Math.min(Math.max(state.pageTo || state.pageFrom, state.pageFrom), 604);
  }

  Promise.all([
    VideoMaker.loadSurahs(),
    fetch('/data/recitations.json').then(function (r) { return r.json(); }),
  ]).then(function (got) {
    surahs = got[0];
    reciters = got[1].recitations;
    if (!reciters.some(function (r) { return r.id === state.reciter; })) state.reciter = got[1].default;
    $('unsupported').hidden = VideoMaker.supported();
    tidy();
    words();
    bind();
    refresh();
  });
}());
