/**
 * Android readers are offered the app: a card over the foot of the page,
 * never a screen in front of it, so the reading and the ranking are untouched.
 */
(function () {
  'use strict';

  var KEY = 'quran-app-card';
  var QUIET_FOR = 30 * 24 * 3600 * 1000;   /* a no holds for a month */

  var ua = navigator.userAgent;
  // Crawlers and PageSpeed present as Android phones; the app itself stamps QuranShell
  if (!/Android/i.test(ua)) return;
  if (/QuranShell\/|bot|crawler|spider|Lighthouse|Google-InspectionTool/i.test(ua)) return;
  if (location.hostname === 'appassets.androidplatform.net') return;

  var last = 0;
  try { last = +localStorage.getItem(KEY) || 0; } catch (e) {}
  if (Date.now() - last < QUIET_FOR) return;

  function remember() {
    try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
  }

  function track(name) {
    if (window.umami) try { window.umami.track(name); } catch (e) {}
  }

  function hide(card) {
    card.classList.add('out');
    setTimeout(function () { card.hidden = true; }, 320);
  }

  function show() {
    var card = document.getElementById('app-card');
    if (!card) return;
    card.classList.add('out');
    card.hidden = false;
    void card.offsetHeight;          // laid out below the edge before it rises
    card.classList.remove('out');
    track('app-card-shown');

    card.querySelector('.ac-get').addEventListener('click', function () {
      remember();
      track('app-card-play');
      hide(card);
    });
    card.querySelector('.ac-skip').addEventListener('click', function () {
      remember();
      track('app-card-skip');
      hide(card);
    });
  }

  // A beat after the page is up, not after every font and file: on a phone that was seconds
  setTimeout(show, 1000);
}());
