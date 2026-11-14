/**
 * Reporting an issue or suggesting something: the form on the feedback panel.
 *
 * The same form as the Android app's, posted to the same endpoint. What is
 * sent beside the message is listed on the form itself: the language, the
 * theme, the screen, the browser, the page last read and the reciter.
 *
 * The reader (app.js) lends its language and theme through init(), and asks
 * for the form to be said again when either changes.
 */
(function (global) {
  'use strict';

  /* What the reader lends: see init */
  var app = null;

  /* Run once the reader is up, as this was when it lived in it */
  function start() {
    var feedback = { kind: 'bug', severity: null, sending: false };

    var FEEDBACK_SAYS = {
      sending:  { ar: 'جارٍ الإرسال…', en: 'Sending…' },
      sent:     { ar: 'شكرًا لك، وصلت رسالتك.', en: 'Thank you, your message was sent.' },
      short:    { ar: 'اكتب رسالة أطول قليلًا.', en: 'Please write a little more.' },
      email:    { ar: 'البريد الإلكتروني غير صحيح.', en: 'That email address is not valid.' },
      tooMany:  { ar: 'أرسلت رسائل كثيرة، حاول لاحقًا.', en: 'Too many messages sent, please try later.' },
      failed:   { ar: 'تعذّر الإرسال الآن. حاول مرة أخرى بعد قليل.', en: 'Could not send right now. Please try again shortly.' }
    };

    function sayFeedbackStatus(key, bad) {
      $('#fb-status').text(key ? T(FEEDBACK_SAYS[key].ar, FEEDBACK_SAYS[key].en) : '')
                     .toggleClass('bad', !!bad);
    }

    function sayFeedback() {
      $('#feedback-panel .fb-chip[data-kind]').each(function () {
        $(this).attr('aria-pressed', String($(this).data('kind') === feedback.kind));
      });
      $('#feedback-panel .fb-chip[data-severity]').each(function () {
        $(this).attr('aria-pressed', String(($(this).attr('data-severity') || null) === feedback.severity));
      });
      $('#fb-severity').prop('hidden', feedback.kind !== 'bug');
      var box = $('#fb-message');
      box.attr('placeholder', box.attr(app.lang() === 'ar' ? 'data-ph-ar' : 'data-ph-en'));
      $('#fb-send').prop('disabled', feedback.sending);
    }

    /* "Chrome 138 on Windows": enough to tell browsers apart, nothing more. */
    function browserName() {
      var ua = navigator.userAgent;
      var name = /Edg\/(\d+)/.test(ua) ? 'Edge ' + RegExp.$1
        : /OPR\/(\d+)/.test(ua) ? 'Opera ' + RegExp.$1
        : /Firefox\/(\d+)/.test(ua) ? 'Firefox ' + RegExp.$1
        : /(?:Chrome|CriOS)\/(\d+)/.test(ua) ? 'Chrome ' + RegExp.$1
        : /Version\/(\d+).*Safari/.test(ua) ? 'Safari ' + RegExp.$1
        : 'Other browser';
      var os = /Android/.test(ua) ? 'Android'
        : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
        : /Windows/.test(ua) ? 'Windows'
        : /Mac OS X/.test(ua) ? 'macOS'
        : /Linux/.test(ua) ? 'Linux'
        : 'unknown OS';
      return name + ' on ' + os;
    }

    /* The window as the reader sees it; a hidden or unmeasured window falls back to the screen. */
    function screenSize() {
      var w = window.innerWidth || screen.width, h = window.innerHeight || screen.height;
      return (w > h ? 'landscape ' : 'portrait ') + w + 'x' + h;
    }

    function feedbackContext() {
      var context = {
        language: app.lang(),
        theme: app.themeChoice() || 'system',
        themeShown: app.theme() === 'dark' ? 'dark' : 'light',
        screen: screenSize(),
        browser: browserName()
      };
      var last = +localStorage.getItem('quran-last-page');
      if (last >= 1 && last <= 604) context.page = last;
      var voice = null;
      try { voice = localStorage.getItem('quran-recitation'); } catch (e) { /* denied */ }
      if (voice) context.reciter = voice.slice(0, 80);
      return context;
    }

    $('#feedback-panel').on('click', '.fb-chip[data-kind]', function () {
      feedback.kind = $(this).data('kind');
      if (feedback.kind !== 'bug') feedback.severity = null;
      sayFeedback();
    });

    $('#feedback-panel').on('click', '.fb-chip[data-severity]', function () {
      feedback.severity = $(this).attr('data-severity') || null;
      sayFeedback();
    });

    $('#feedback-form').on('submit', function (e) {
      e.preventDefault();
      if (feedback.sending) return;

      var message = $.trim($('#fb-message').val());
      var email = $.trim($('#fb-email').val());
      if (message.length < 5) return sayFeedbackStatus('short', true);
      if (email && !$('#fb-email')[0].checkValidity()) return sayFeedbackStatus('email', true);

      var body = { source: 'web', kind: feedback.kind, message: message, app: feedbackContext() };
      if (feedback.kind === 'bug' && feedback.severity) body.severity = feedback.severity;
      if (email) body.email = email;

      feedback.sending = true;
      sayFeedback();
      sayFeedbackStatus('sending');

      $.ajax({
        url: '/api/feedback',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(body),
        timeout: 15000
      }).done(function () {
        $('#fb-message').val('');
        sayFeedbackStatus('sent');
      }).fail(function (xhr) {
        sayFeedbackStatus(xhr.status === 429 ? 'tooMany' : 'failed', true);
      }).always(function () {
        feedback.sending = false;
        sayFeedback();
      });
    });

    return sayFeedback;
  }

  global.Report = {
    /** Wires the form, and hands over what says it again in the reader's language. */
    init: function (lent) { app = lent; return start(); },
  };

}(window));
