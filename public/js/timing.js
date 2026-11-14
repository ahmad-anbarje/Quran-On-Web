/**
 * A recitation's timing file: where it is kept, and what it says.
 *
 * The audio is one file a surah, so where each ayah and word falls in it is
 * worked out ahead of time and shipped beside it as
 * <nnn>.<recitation>.timing.json: `ayah` is each ayah's start and end in
 * milliseconds, `word` each ayah's pairs of time and word.
 *
 * Nothing here keeps a file or knows what is playing: the player (recite.js)
 * hands each lookup the file it has loaded.
 */
(function (global) {
  'use strict';

  function pad(n) { return String(n).padStart(3, '0'); }

  function timingUrl(id, which) {
    return '/surah/' + id + '/' + pad(id) + '.' + which + '.timing.json';
  }

  function fetchTiming(url) {
    return fetch(url)
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  /** Which ayah covers this moment. The list is in order, so a walk from where
      we were costs nothing while playing and a search only on a seek. */
  function ayahAt(timing, t, at) {
    var a = timing.ayah;
    if (at >= 1 && at <= a.length) {
      var i = at - 1;
      if (t >= a[i][0] && t < a[i][1]) return at;
      if (i + 1 < a.length && t >= a[i + 1][0] && t < a[i + 1][1]) return at + 1;
    }
    var lo = 0, hi = a.length - 1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (t < a[mid][0]) hi = mid - 1;
      else if (t >= a[mid][1]) lo = mid + 1;
      else return mid + 1;
    }
    /* Between two ayahs — the pause after one is still that one's, so the
       highlight rests where the reciter left it rather than going out. */
    return Math.max(1, Math.min(a.length, lo));
  }

  /* Which word of an ayah is being said. The timings are pairs of time and
     word: the word is named rather than implied by position because a reciter
     doubles back — twenty-six ayahs of Al-Baqarah do. */
  function wordAt(timing, v, t) {
    var w = timing.word[v - 1];
    if (!w || !w.length) return 0;
    var d = t - timing.ayah[v - 1][0];
    for (var i = w.length - 2; i >= 0; i -= 2) if (d >= w[i]) return w[i + 1];
    return w[1];
  }

  /* Where one word sits: its end is where the next begins, and the last word
     of an ayah runs to the ayah's end, taking the reciter's pause with it. */
  function wordTime(timing, v, k) {
    var w = timing.word[v - 1], span = timing.ayah[v - 1];
    if (!w || !w.length) return span;
    /* The first time this word is said, where it is said more than once — that
       is the one the reader pointed at. */
    for (var i = 0; i < w.length; i += 2) {
      if (w[i + 1] !== k) continue;
      return [span[0] + w[i], i + 2 < w.length ? span[0] + w[i + 2] : span[1]];
    }
    return span;
  }

  global.Timing = {
    pad: pad,
    url: timingUrl,
    fetch: fetchTiming,
    ayahAt: ayahAt,
    wordAt: wordAt,
    wordTime: wordTime,
  };

}(window));
