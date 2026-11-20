// --- A recitation made into an MP4 in the browser: pages drawn, audio cut, both encoded and muxed ---
(function (global) {
  'use strict';

  var FPS = 30;
  var GOP = 60;                 // a keyframe every two seconds, as live streaming expects
  var AUDIO_BPS = 128000;
  var SHAPES = { wide: [1920, 1080], tall: [1080, 1920], square: [1080, 1080] };
  // Each picture held at one quality, so a word lit is sharp at once rather than sharpening over the next frames
  var QUALITY = {
    standard: { scale: 1, q: 23, bps: 6e6 },
    high: { scale: 4 / 3, q: 22, bps: 10e6 },
    max: { scale: 2, q: 21, bps: 20e6 },
  };

  var surahs = null;

  function loadSurahs() {
    if (surahs) return Promise.resolve(surahs);
    return fetch('/data/surahs.json').then(function (r) { return r.json(); }).then(function (s) { surahs = s; return s; });
  }

  function audioBase() {
    var m = document.querySelector('meta[name="quran-audio-base"]');
    return (m && m.content) || 'https://audio.readqurantoday.com';
  }

  // --- what is recited: one run of ayahs a surah ---

  /** { kind: 'surah', surah, from, to } | { kind: 'juz', juz } | { kind: 'pages', from, to } -> [{ surah, from, to }] */
  function runs(ask) {
    if (ask.kind === 'surah') {
      var n = surahs[ask.surah - 1].v;
      var a = clamp(ask.from, 1, n), z = clamp(ask.to, a, n);
      return [{ surah: ask.surah, from: a, to: z }];
    }
    var first, last;
    if (ask.kind === 'juz') {
      var starts = VideoPages.juzPages();
      first = starts[ask.juz - 1];
      last = (starts[ask.juz] || 605) - 1;
    } else {
      first = clamp(ask.from, 1, 604);
      last = clamp(ask.to, first, 604);
    }
    // Every ayah that begins on these pages, grouped by surah
    var out = [];
    surahs.forEach(function (s) {
      for (var v = 1; v <= s.v; v++) {
        var p = VideoPages.began(s.id, v);
        if (p < first || p > last) continue;
        var run = out[out.length - 1];
        if (run && run.surah === s.id && run.to === v - 1) run.to = v;
        else out.push({ surah: s.id, from: v, to: v });
      }
    });
    return out;
  }

  function clamp(n, lo, hi) { return Math.min(Math.max(+n || lo, lo), hi); }

  /** Each run with its timing and where it starts and ends in its surah's recording. */
  async function plan(ask, reciter) {
    await Promise.all([VideoPages.load(), loadSurahs()]);
    var list = runs(ask);
    if (!list.length) throw new Error('nothing to recite');
    var at = 0;
    for (var i = 0; i < list.length; i++) {
      var run = list[i];
      run.timing = await Timing.fetch(Timing.url(run.surah, reciter));
      if (!run.timing) throw new Error('no timing for surah ' + run.surah);
      var t = run.timing, count = t.ayah.length;
      // From the surah's opening when it starts at its first ayah; to the next ayah's start, so the pause is kept
      run.startMs = run.from === 1 ? 0 : t.ayah[run.from - 1][0];
      run.endMs = run.to < count ? t.ayah[run.to][0] : Math.round(t.duration * 1000);
      run.audio = audioBase() + '/' + (t.audioPath || reciter + '/' + Timing.pad(run.surah) + '.mp3');
      run.offset = at;
      at += run.endMs - run.startMs;
    }
    return { runs: list, durationMs: at };
  }

  // --- what each moment shows ---

  function stateAt(run, ms, last) {
    var t = run.timing, s = run.surah;
    if (ms < t.ayah[run.from - 1][0]) {
      return { page: VideoPages.began(s, run.from), surah: s, ayah: run.from, lit: null };
    }
    var v = clamp(Timing.ayahAt(t, ms, last ? last.ayah : 0), run.from, run.to);
    var w = Timing.wordAt(t, v, ms);
    var page = VideoPages.pageOf(s, v, w);
    // A timing that names a word the page does not print keeps the word before it lit
    if (!page && last) return last;
    return { page: page || VideoPages.began(s, v), surah: s, ayah: v, lit: s + ':' + v + ':' + w };
  }

  // Everything one picture shows besides the page: the choices made, and the ayah's meaning if wanted
  function shownAt(now, opts, meaning) {
    return {
      page: now.page, surah: now.surah, ayah: now.ayah, lit: now.lit,
      reciter: opts.reciterName, showReciter: opts.reciterShown !== false, reciterPos: opts.reciterPos,
      showTitle: opts.title !== false, titlePos: opts.titlePos, titleScale: (opts.titleSize || 100) / 100,
      showAyah: opts.ayah === true, app: opts.app !== false,
      translation: meaning ? meaning[now.ayah - 1] : null,
    };
  }

  var meanings = {};

  // The Saheeh International translation of a surah, one string an ayah; null if it cannot be had
  function loadMeaning(surah) {
    if (!meanings[surah]) {
      meanings[surah] = fetch('/data/translation/sahih/' + surah + '.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    }
    return meanings[surah];
  }

  // Each run given its surah's meaning, where the meaning is wanted
  async function withMeanings(p, opts) {
    if (opts.translation === false) return;
    await Promise.all(p.runs.map(async function (run) { run.meaning = await loadMeaning(run.surah); }));
  }

  function same(a, b) { return a && b && a.page === b.page && a.lit === b.lit && a.ayah === b.ayah; }

  /** Every page a plan shows, so their fonts can be fetched first. */
  function pagesOf(p) {
    var seen = {};
    p.runs.forEach(function (run) {
      for (var v = run.from; v <= run.to; v++) {
        var first = VideoPages.began(run.surah, v);
        seen[first] = true;
        // An ayah can run over onto the next page
        for (var w = 0; w < 200; w++) {
          var at = VideoPages.pageOf(run.surah, v, w);
          if (!at || at === first) { if (!at) break; continue; }
          seen[at] = true;
        }
      }
    });
    return Object.keys(seen).map(Number).filter(Boolean);
  }

  // --- encoding ---

  function supported() {
    return !!(global.VideoEncoder && global.AudioEncoder && global.AudioDecoder && global.VideoFrame);
  }

  function size(shape, quality) {
    var base = SHAPES[shape] || SHAPES.wide, k = (QUALITY[quality] || QUALITY.standard).scale;
    return [base[0], base[1]].map(function (n) { return Math.round(n * k / 2) * 2; });
  }

  // The H.264 level a picture of this size needs: 4.0 up to 1080p, 5.0 to 1440p, 5.1 to 4K
  function codecs(width, height) {
    var level = width * height <= 1920 * 1088 ? '28' : width * height <= 2560 * 1600 ? '32' : '33';
    return ['avc1.6400' + level, 'avc1.4d00' + level, 'avc1.42e0' + level];
  }

  /** Constant quality where the encoder offers it, else a bitrate high enough for still pages. */
  async function videoConfig(width, height, quality) {
    var list = codecs(width, height);
    var modes = [{ bitrateMode: 'quantizer' }, { bitrateMode: 'variable', bitrate: quality.bps }];
    for (var m = 0; m < modes.length; m++) {
      for (var i = 0; i < list.length; i++) {
        var c = Object.assign({ codec: list[i], width: width, height: height, framerate: FPS, latencyMode: 'quality', avc: { format: 'avc' } }, modes[m]);
        var r = await VideoEncoder.isConfigSupported(c);
        if (r.supported) return r.config;
      }
    }
    throw new Error('this browser cannot encode H.264 video at this size');
  }

  async function audioConfig(sampleRate) {
    var c = { codec: 'mp4a.40.2', sampleRate: sampleRate, numberOfChannels: 2, bitrate: AUDIO_BPS };
    var r = await AudioEncoder.isConfigSupported(c);
    if (!r.supported) throw new Error('this browser cannot encode AAC audio');
    return r.config;
  }

  function waitDequeue(coder) {
    return new Promise(function (resolve) { coder.addEventListener('dequeue', resolve, { once: true }); });
  }

  /**
   * Make the video. `opts`: { ask, reciter, reciterName, shape, look, target, onProgress(stage, done), signal }.
   * `target` is a writable file stream, or null to keep the video in memory and return it as a Blob.
   */
  async function make(opts) {
    if (!supported()) throw new Error('this browser cannot make videos');
    var quality = QUALITY[opts.quality] || QUALITY.standard;
    var dims = size(opts.shape, opts.quality);
    var width = dims[0], height = dims[1];
    var look = VideoPages.LOOKS[opts.look] || VideoPages.LOOKS.light;
    var progress = opts.onProgress || function () {};
    var signal = opts.signal || { aborted: false };

    var p = await plan(opts.ask, opts.reciter);
    await withMeanings(p, opts);
    progress('fonts', 0);
    await VideoPages.loadFonts(pagesOf(p));
    if (opts.app !== false) await VideoPages.loadApp();

    // Every recording first: the sample rate decides the audio track
    var sounds = [];
    for (var i = 0; i < p.runs.length; i++) {
      var bytes = await VideoAudio.fetchBytes(p.runs[i].audio, function (got, total) {
        progress('audio', (i + (total ? got / total : 0)) / p.runs.length);
      });
      if (signal.aborted) throw new DOMException('stopped', 'AbortError');
      sounds.push({ bytes: bytes, info: VideoAudio.frames(bytes) });
    }
    var sampleRate = sounds[0].info.sampleRate;

    var vConfig = await videoConfig(width, height, quality);
    var perFrame = vConfig.bitrateMode === 'quantizer' ? { avc: { quantizer: quality.q } } : {};
    var aConfig = await audioConfig(sampleRate);
    var inMemory = !opts.target;
    var muxer = new Mp4Muxer.Muxer({
      target: inMemory ? new Mp4Muxer.ArrayBufferTarget() : new Mp4Muxer.FileSystemWritableFileStreamTarget(opts.target),
      video: { codec: 'avc', width: width, height: height, frameRate: FPS },
      audio: { codec: 'aac', sampleRate: sampleRate, numberOfChannels: 2 },
      fastStart: inMemory ? 'in-memory' : false,
      firstTimestampBehavior: 'offset',
    });

    var failed = null;
    var vEnc = new VideoEncoder({ output: function (c, m) { muxer.addVideoChunk(c, m); }, error: function (e) { failed = e; } });
    var aEnc = new AudioEncoder({ output: function (c, m) { muxer.addAudioChunk(c, m); }, error: function (e) { failed = e; } });
    vEnc.configure(vConfig);
    aEnc.configure(aConfig);

    // A page canvas, not an offscreen one: the medallions' filter lives in the page's own SVG
    var canvas = Object.assign(document.createElement('canvas'), { width: width, height: height });
    var ctx = canvas.getContext('2d', { alpha: false });
    var totalFrames = Math.ceil(p.durationMs * FPS / 1000);
    var frame = 0, samplesOut = 0;

    try {
      for (var r = 0; r < p.runs.length; r++) {
        var run = p.runs[r], sound = sounds[r];
        if (sound.info.sampleRate !== sampleRate) throw new Error('recordings at different sample rates');
        var runSamples = Math.round((run.endMs - run.startMs) * sampleRate / 1000);
        var runStartSample = samplesOut;
        var pcm = VideoAudio.span(sound.bytes, sound.info, run.startMs, run.endMs);
        var pcmDone = false;
        var lastFrame = Math.ceil((run.offset + run.endMs - run.startMs) * FPS / 1000);
        var shown = null;

        for (; frame < lastFrame; frame++) {
          if (signal.aborted) throw new DOMException('stopped', 'AbortError');
          if (failed) throw failed;
          var tMs = frame * 1000 / FPS;

          // The sound kept a second ahead of the picture, so the muxer can interleave them
          var wantSamples = Math.min(runStartSample + runSamples, Math.round((tMs + 1000) * sampleRate / 1000));
          while (!pcmDone && samplesOut < wantSamples) {
            var step = await pcm.next();
            if (step.done) { pcmDone = true; break; }
            samplesOut += encodeAudio(aEnc, step.value, samplesOut, runStartSample + runSamples, sampleRate);
            if (aEnc.encodeQueueSize > 32) await waitDequeue(aEnc);
          }

          var now = stateAt(run, run.startMs + tMs - run.offset, shown);
          if (!same(now, shown)) {
            shown = now;
            VideoPages.draw(ctx, width, height, look, shownAt(now, opts, run.meaning));
          }
          var vf = new VideoFrame(canvas, { timestamp: Math.round(frame * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
          vEnc.encode(vf, Object.assign({ keyFrame: frame % GOP === 0 }, perFrame));
          vf.close();
          if (vEnc.encodeQueueSize > 6) await waitDequeue(vEnc);
          if (frame % FPS === 0) progress('encode', frame / totalFrames);
        }

        // The rest of this run's sound, then silence if the recording fell short of its timing
        while (!pcmDone) {
          var rest = await pcm.next();
          if (rest.done) break;
          samplesOut += encodeAudio(aEnc, rest.value, samplesOut, runStartSample + runSamples, sampleRate);
        }
        var short = runStartSample + runSamples - samplesOut;
        if (short > 0) {
          var hush = new Float32Array(short);
          samplesOut += encodeAudio(aEnc, { left: hush, right: hush }, samplesOut, runStartSample + runSamples, sampleRate);
        }
      }

      await vEnc.flush();
      await aEnc.flush();
      if (failed) throw failed;
      muxer.finalize();
      progress('encode', 1);
      return {
        blob: inMemory ? new Blob([muxer.target.buffer], { type: 'video/mp4' }) : null,
        durationMs: p.durationMs,
        runs: p.runs.map(function (x) { return { surah: x.surah, from: x.from, to: x.to }; }),
      };
    } finally {
      if (vEnc.state !== 'closed') vEnc.close();
      if (aEnc.state !== 'closed') aEnc.close();
      VideoPages.dropFonts();
    }
  }

  // Encode up to `limit` samples of a piece; returns how many were taken
  function encodeAudio(enc, piece, at, limit, sampleRate) {
    var n = Math.min(piece.left.length, limit - at);
    if (n <= 0) return 0;
    var data = new Float32Array(2 * n);
    data.set(piece.left.subarray(0, n), 0);
    data.set(piece.right.subarray(0, n), n);
    var ad = new AudioData({
      format: 'f32-planar', sampleRate: sampleRate, numberOfFrames: n, numberOfChannels: 2,
      timestamp: Math.round(at * 1e6 / sampleRate), data: data,
    });
    enc.encode(ad);
    ad.close();
    return n;
  }

  /** The first picture of a plan, for the preview. */
  async function preview(canvas, opts) {
    var p = await plan(opts.ask, opts.reciter);
    await withMeanings(p, opts);
    var run = p.runs[0];
    var now = stateAt(run, run.timing.ayah[run.from - 1][0], null);
    await Promise.all([VideoPages.loadFonts([now.page]), opts.app !== false ? VideoPages.loadApp() : null]);
    var base = SHAPES[opts.shape] || SHAPES.wide;
    canvas.width = base[0];
    canvas.height = base[1];
    VideoPages.draw(canvas.getContext('2d'), base[0], base[1], VideoPages.LOOKS[opts.look] || VideoPages.LOOKS.light,
      shownAt(now, opts, run.meaning));
    return p;
  }

  // Tall pictures have no room beside the page, so nothing is drawn there
  function hasSides(shape) { return shape !== 'tall'; }

  global.VideoMaker = {
    SHAPES: SHAPES,
    hasSides: hasSides,
    supported: supported,
    loadSurahs: loadSurahs,
    plan: plan,
    preview: preview,
    make: make,
  };

}(window));
