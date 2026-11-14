/**
 * The player's menu as markup: its bar, the ring and transport, the repeat and
 * recitation choices, and the row of smaller actions.
 *
 * Only the markup. The player (recite.js) puts it on the page the first time
 * a word is opened, finds its parts and gives them their words and their work.
 */
(function (global) {
  'use strict';

  global.PlayerMarkup =
    '<div id="r-menu" hidden>' +
      '<div class="r-menu-bar">' +
        '<span class="r-grip" aria-hidden="true"></span>' +
        '<span class="r-menu-head"></span>' +
        /* Folds the menu back to its bar. The player keeps playing and keeps
           saying where it is — what goes away is everything that is only there
           to be pressed, which is most of the height and all of what covers
           the page being read. */
        '<button class="r-menu-min" data-act="minimize" aria-label="تصغير">' +
          '<svg class="r-min-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
               'stroke-width="2.2" stroke-linecap="round">' +
            '<path d="M6.5 12.5h11"/>' +
          '</svg>' +
          '<svg class="r-max-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
               'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M7 14l5-5 5 5"/>' +
          '</svg>' +
        '</button>' +
        '<button class="r-menu-close" data-act="close" aria-label="إغلاق">' +
          '<svg class="r-x-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
               'stroke-width="2.2" stroke-linecap="round">' +
            '<path d="M7.5 7.5l9 9M16.5 7.5l-9 9"/>' +
          '</svg>' +
        '</button>' +
      '</div>' +

      /* How far the recitation is, shown once there is a place in it to be at */
      '<div class="r-now" hidden>' +
        '<div class="r-seek"><i class="r-played"></i></div>' +
      '</div>' +

      '<div class="r-acts">' +
        /* Three kinds of row, in the order they are wanted: what to play, how to
           hear it (who, how fast, how often), and what it means. */
        /* The ayah first, in the accent: play, and pause while it plays */
        '<button data-act="play" class="r-ayah" aria-label="تشغيل">' +
          '<svg class="ic r-ic-play" viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>' +
          '<svg class="ic r-ic-pause" viewBox="0 0 24 24"><path d="M7 5h3.2v14H7zM13.8 5H17v14h-3.2z"/></svg>' +
          '<span class="r-when-paused"><span class="lang-ar">تشغيل الآية</span><span class="lang-en">Play this ayah</span></span>' +
          '<span class="r-when-playing"><span class="lang-ar">إيقاف مؤقت</span><span class="lang-en">Pause</span></span>' +
        '</button>' +
        '<button data-act="word">' +
          '<svg class="ic" viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>' +
          '<span class="lang-ar">تشغيل الكلمة</span><span class="lang-en">Play this word</span>' +
        '</button>' +
        '<div class="r-sep" role="separator"></div>' +
        /* Only where there is in fact a choice to make. One recitation and
           this is a row that opens a list of one and changes nothing. */
        '<button data-act="voice" class="r-voice" hidden>' +
          '<svg class="ic" viewBox="0 0 24 24"><path d="M12 12.2a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2zm0 1.8c-4.2 0-7.2 2.2-7.2 4.6V21h14.4v-2.4c0-2.4-3-4.6-7.2-4.6z"/></svg>' +
          '<span class="lang-ar">القارئ</span><span class="lang-en">Reciter</span>' +
          '<span class="r-voice-value"></span>' +
        '</button>' +
        '<button data-act="speed" class="r-speed">' +
          '<svg class="ic ic-line" viewBox="0 0 24 24"><path d="M5.07 18A8 8 0 1 1 18.93 18"/><path d="M12 14l3.6-4.4M12 14m-1.3 0a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0"/></svg>' +
          '<span class="lang-ar">سرعة التلاوة</span><span class="lang-en">Speed</span>' +
          '<span class="r-speed-value"></span>' +
        '</button>' +
        '<button data-act="repeat" class="r-repeat">' +
          '<svg class="ic" viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z"/></svg>' +
          '<span class="lang-ar">التكرار</span><span class="lang-en">Repeat</span>' +
          '<span class="r-repeat-value"></span>' +
        '</button>' +
        '<div class="r-sep" role="separator"></div>' +
        /* What the ayah means: the translation and the tafsir, in a window of
           their own that keeps up with the recitation. */
        '<button data-act="meaning" class="r-meaning">' +
          '<svg class="ic ic-line" viewBox="0 0 24 24"><path d="M12 6.5C10.3 5.2 7.9 4.6 4 4.6v13.2c3.9 0 6.3.6 8 1.9 1.7-1.3 4.1-1.9 8-1.9V4.6c-3.9 0-6.3.6-8 1.9zM12 6.5v13.2"/></svg>' +
          '<span class="lang-ar">الترجمة والتفسير</span><span class="lang-en">Translation &amp; tafsir</span>' +
        '</button>' +
        '<button data-act="latin" class="r-latin">' +
          '<svg class="ic ic-line" viewBox="0 0 24 24"><path d="M2.8 18.5 7.5 5.5l4.7 13M4.5 14h6"/><path d="M17 15.2m-3.2 0a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0-6.4 0M20.2 11.6v6.9"/></svg>' +
          '<span class="lang-ar">النطق بالحروف اللاتينية</span><span class="lang-en">Transliteration</span>' +
        '</button>' +
      '</div>' +

      /* Its own panel rather than a third group inside the repeat one: what is
         being repeated and who is reciting are not settings of one another,
         and folding them together would mean opening the repeat panel to
         change reciter. */
      '<div class="r-panel r-voices" hidden></div>' +

      /* Folded into the same menu rather than opening a second panel of its
         own: one surface to learn, and nothing that grows the page. */
      '<div class="r-panel" hidden>' +
        '<div class="r-group">' +
          '<span class="r-legend"><span class="lang-ar">ما يُعاد</span>' +
                                 '<span class="lang-en">Repeat</span></span>' +
          '<button class="r-chip" data-scope="ayah"><span class="lang-ar">الآية</span><span class="lang-en">Ayah</span></button>' +
          '<button class="r-chip" data-scope="page"><span class="lang-ar">الصفحة</span><span class="lang-en">Page</span></button>' +
          '<button class="r-chip" data-scope="range"><span class="lang-ar">مقطع</span><span class="lang-en">Range</span></button>' +
          '<button class="r-chip" data-scope="surah"><span class="lang-ar">السورة</span><span class="lang-en">Surah</span></button>' +
        '</div>' +
        '<div class="r-group">' +
          '<span class="r-legend"><span class="lang-ar">كم مرة</span>' +
                                 '<span class="lang-en">How many</span></span>' +
          '<button class="r-chip" data-times="1">١<span class="r-x">×</span></button>' +
          '<button class="r-chip" data-times="3">٣<span class="r-x">×</span></button>' +
          '<button class="r-chip" data-times="5">٥<span class="r-x">×</span></button>' +
          '<button class="r-chip" data-times="7">٧<span class="r-x">×</span></button>' +
          '<button class="r-chip r-inf" data-times="inf" aria-label="بلا نهاية">∞</button>' +
        '</div>' +
        '<div class="r-group r-range">' +
          '<span class="r-legend"><span class="lang-ar">من الآية</span>' +
                                 '<span class="lang-en">From ayah</span></span>' +
          '<input class="r-from" type="number" min="1" step="1" />' +
          '<span class="r-legend"><span class="lang-ar">إلى</span>' +
                                 '<span class="lang-en">to</span></span>' +
          '<input class="r-to" type="number" min="1" step="1" />' +
        '</div>' +
      '</div>' +

      '<div class="r-note" hidden></div>' +

      /* Minimised, the whole player is a circle in the corner with a ring for
         how far through the surah it is. Inside the menu rather than beside
         it, so one element carries the player in both of its shapes. */
      '<button class="r-bubble" data-act="minimize">' +
        '<svg class="r-bubble-ring" viewBox="0 0 54 54" aria-hidden="true">' +
          '<circle class="r-ring-track" cx="27" cy="27" r="24.5"/>' +
          '<circle class="r-ring-line" cx="27" cy="27" r="24.5"/>' +
        '</svg>' +
        /* Bars, not a face and not a play triangle. A play triangle would
           promise that pressing this starts something, when what it does is
           bring the window back; bars say "there is sound here" and nothing
           more, and they can rise and fall while it is actually running. */
        '<svg class="r-bubble-ic" viewBox="0 0 24 24" aria-hidden="true">' +
          '<rect class="r-bar" x="5.2" y="8" width="2.8" height="8" rx="1.4"/>' +
          '<rect class="r-bar" x="10.6" y="4.5" width="2.8" height="15" rx="1.4"/>' +
          '<rect class="r-bar" x="16" y="9" width="2.8" height="6" rx="1.4"/>' +
        '</svg>' +
      '</button>' +
      /* The phone's player: one row in the Android app's order, shown only on a phone. */
      '<div class="r-dock">' +
        /* The app's player, slot for slot (part_player_reader.xml): three either side of play,
           each the app's own outline over its name */
        '<button data-act="tajweed" class="r-dock-tajweed">' +
          '<svg class="ic ic-line" viewBox="0 0 24 24"><use href="#i-tajweed"/></svg>' +
          '<span class="lang-ar">تجويد</span><span class="lang-en">Tajweed</span>' +
        '</button>' +
        '<button data-act="voice" class="r-dock-voice">' +
          '<svg class="ic ic-line" viewBox="0 0 24 24"><path d="M12 8m-3.6 0a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0-7.2 0M4.8 20.5v-1a5 5 0 0 1 5-5h4.4a5 5 0 0 1 5 5v1"/></svg>' +
          '<span class="lang-ar">القارئ</span><span class="lang-en">Reciter</span>' +
        '</button>' +
        '<button data-act="latin" class="r-dock-latin">' +
          '<svg class="ic ic-line" viewBox="0 0 24 24"><path d="M2.8 18.5 7.5 5.5l4.7 13M4.5 14h6"/><path d="M17 15.2m-3.2 0a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0-6.4 0M20.2 11.6v6.9"/></svg>' +
          '<span class="lang-ar">النطق</span><span class="lang-en">Phonetic</span>' +
        '</button>' +
        '<button data-act="play" class="r-dock-play">' +
          '<span class="r-dock-disc">' +
            '<svg class="ic r-ic-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>' +
            '<svg class="ic r-ic-pause" viewBox="0 0 24 24"><path d="M7 5h3.2v14H7zM13.8 5H17v14h-3.2z"/></svg>' +
          '</span>' +
          '<span class="r-when-paused"><span class="lang-ar">تشغيل</span><span class="lang-en">Play</span></span>' +
          '<span class="r-when-playing"><span class="lang-ar">إيقاف</span><span class="lang-en">Pause</span></span>' +
        '</button>' +
        '<button data-act="word" class="r-dock-word">' +
          '<svg class="ic ic-line" viewBox="0 0 24 24"><path d="M4 9.5h3.5l5-4v13l-5-4H4z"/><path d="M16 8.8a4.2 4.2 0 0 1 0 6.4M18.6 6.2a7.6 7.6 0 0 1 0 11.6"/></svg>' +
          '<span class="r-word-idle"><span class="lang-ar">كلمة</span><span class="lang-en">Word</span></span>' +
          '<span class="r-word-wait"><span class="lang-ar">تحميل…</span><span class="lang-en">Loading…</span></span>' +
        '</button>' +
        '<button data-act="repeat" class="r-dock-repeat">' +
          '<svg class="ic ic-line" viewBox="0 0 24 24"><path d="M16.5 3 20 6.5 16.5 10M4 11.5v-2a3 3 0 0 1 3-3h13M7.5 21 4 17.5 7.5 14M20 12.5v2a3 3 0 0 1-3 3H4"/></svg>' +
          '<span class="lang-ar">تكرار</span><span class="lang-en">Repeat</span>' +
        '</button>' +
        '<button data-act="speed" class="r-dock-speed">' +
          '<svg class="ic ic-line" viewBox="0 0 24 24"><path d="M5.07 18A8 8 0 1 1 18.93 18"/><path d="M12 14l3.6-4.4M12 14m-1.3 0a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0"/></svg>' +
          '<span class="r-speed-value"></span>' +
        '</button>' +
      '</div>' +
    '</div>';

}(window));
