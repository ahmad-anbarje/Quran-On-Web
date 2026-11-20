// --- A surah's MP3 cut to a span of time, decoded as it is needed, as stereo samples ---
(function (global) {
  'use strict';

  var RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
  var KBPS_1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  var KBPS_2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  // Decoded ahead of the span's start, so the bit reservoir is filled when it begins
  var WARM = 10;

  function header(b, i) {
    if (b[i] !== 0xFF || (b[i + 1] & 0xE0) !== 0xE0) return null;
    var version = (b[i + 1] >> 3) & 3, layer = (b[i + 1] >> 1) & 3;
    var rate = (b[i + 2] >> 2) & 3, kbpsAt = b[i + 2] >> 4;
    if (version === 1 || layer !== 1 || rate === 3 || kbpsAt === 0 || kbpsAt === 15) return null;
    var mpeg1 = version === 3;
    var sampleRate = RATES[version][rate];
    var kbps = (mpeg1 ? KBPS_1 : KBPS_2)[kbpsAt];
    var spf = mpeg1 ? 1152 : 576;
    var size = Math.floor(spf / 8 * kbps * 1000 / sampleRate) + ((b[i + 2] >> 1) & 1);
    var mono = (b[i + 3] >> 6) === 3;
    return { sampleRate: sampleRate, spf: spf, size: size, channels: mono ? 1 : 2, side: mpeg1 ? (mono ? 17 : 32) : (mono ? 9 : 17) };
  }

  function isTag(b, at) {
    var t = String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);
    return t === 'Xing' || t === 'Info';
  }

  /** Every frame's place in the file, past any ID3 tag and the encoder's own info frame. */
  function frames(bytes) {
    var b = bytes, i = 0;
    if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) {
      i = 10 + ((b[6] & 0x7F) << 21 | (b[7] & 0x7F) << 14 | (b[8] & 0x7F) << 7 | (b[9] & 0x7F));
      if (b[5] & 0x10) i += 10;
    }
    var list = [], first = null;
    while (i + 4 <= b.length) {
      var h = header(b, i);
      // A sync that is not followed by another frame is noise inside the data
      if (!h || (i + h.size + 4 <= b.length && !header(b, i + h.size))) { i++; continue; }
      if (!first) {
        first = h;
        if (isTag(b, i + 4 + h.side)) { i += h.size; continue; }
      }
      list.push(i, h.size);
      i += h.size;
    }
    if (!first) throw new Error('not an MP3');
    return { sampleRate: first.sampleRate, spf: first.spf, channels: first.channels, list: list, count: list.length / 2 };
  }

  function waitDequeue(coder) {
    return new Promise(function (resolve) { coder.addEventListener('dequeue', resolve, { once: true }); });
  }

  /**
   * The samples from `fromMs` to `toMs`, in order, as { left, right } Float32Arrays.
   * A mono recording is given the same samples on both sides.
   */
  async function* span(bytes, info, fromMs, toMs) {
    var sr = info.sampleRate;
    var a = Math.round(fromMs * sr / 1000), z = Math.round(toMs * sr / 1000);
    var i0 = Math.max(0, Math.floor(a / info.spf) - WARM);
    var i1 = Math.min(info.count, Math.ceil(z / info.spf) + 2);
    var ready = [], failed = null;
    var decoder = new AudioDecoder({
      output: function (d) { ready.push(d); },
      error: function (e) { failed = e; },
    });
    decoder.configure({ codec: 'mp3', sampleRate: sr, numberOfChannels: info.channels });

    function* drain() {
      while (ready.length) {
        var d = ready.shift();
        var cut = trim(d, a, z, sr);
        d.close();
        if (cut) yield cut;
      }
    }

    try {
      for (var i = i0; i < i1; i++) {
        var at = info.list[2 * i], size = info.list[2 * i + 1];
        decoder.decode(new EncodedAudioChunk({
          type: 'key',
          timestamp: Math.round(i * info.spf * 1e6 / sr),
          data: bytes.subarray(at, at + size),
        }));
        if (decoder.decodeQueueSize > 48) await waitDequeue(decoder);
        if (failed) throw failed;
        yield* drain();
      }
      await decoder.flush();
      if (failed) throw failed;
      yield* drain();
    } finally {
      if (decoder.state !== 'closed') decoder.close();
      ready.forEach(function (d) { d.close(); });
    }
  }

  // The part of one decoded piece that falls inside [a, z), in samples
  function trim(d, a, z, sr) {
    var start = Math.round(d.timestamp * sr / 1e6), n = d.numberOfFrames;
    var from = Math.max(a, start), to = Math.min(z, start + n);
    if (to <= from) return null;
    var planes = [];
    for (var c = 0; c < Math.min(2, d.numberOfChannels); c++) {
      var all = new Float32Array(n);
      d.copyTo(all, { planeIndex: c, format: 'f32-planar' });
      planes.push(all.subarray(from - start, to - start));
    }
    return { left: planes[0], right: planes[1] || planes[0] };
  }

  function fetchBytes(url, onProgress) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('audio ' + r.status);
      var total = +r.headers.get('content-length') || 0;
      if (!r.body || !onProgress) return r.arrayBuffer().then(function (b) { return new Uint8Array(b); });
      var reader = r.body.getReader(), parts = [], got = 0;
      return (function next() {
        return reader.read().then(function (step) {
          if (step.done) {
            var out = new Uint8Array(got), at = 0;
            parts.forEach(function (p) { out.set(p, at); at += p.length; });
            return out;
          }
          parts.push(step.value);
          got += step.value.length;
          onProgress(got, total);
          return next();
        });
      }());
    });
  }

  global.VideoAudio = { frames: frames, span: span, fetchBytes: fetchBytes };

}(window));
