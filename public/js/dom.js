/**
 * The few parts of jQuery the reader uses, and nothing else: $ and jQuery.
 *
 * app.js, listen.js and offline.js were written against jQuery, which is
 * 87 KB (30 KB over the wire) for a handful of its methods. jQuery itself is
 * kept only in tests/vendor/, for that test. This is those
 * methods, over the browser's own DOM: select and wrap, events (delegated
 * too), attributes and properties, classes, text and markup, data-*, a little
 * walking about, showing and hiding, and $.getJSON, $.when and $.ajax for
 * the three requests that go through it. Each behaves as jQuery's does for
 * the way this site calls it; tests/check-dom.js runs both side by side.
 *
 * Not a jQuery: no animation, no CSS getters, no plugins. A call to anything
 * else is a TypeError, which ESLint and the browser tests would show.
 */
(function (global) {
  'use strict';

  /* ---------- the set ---------- */

  function Set$(nodes) {
    for (var i = 0; i < nodes.length; i++) this[i] = nodes[i];
    this.length = nodes.length;
  }
  var fn = Set$.prototype;

  function parse(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return Array.prototype.slice.call(t.content.childNodes).filter(function (n) { return n.nodeType === 1; });
  }

  /* As jQuery runs ready handlers: once the document is parsed and every
     deferred script has run, which is DOMContentLoaded, never before. */
  var ready = false, waiting = [];
  document.addEventListener('DOMContentLoaded', function () {
    ready = true;
    waiting.splice(0).forEach(function (f) { f(); });
  });
  if (document.readyState === 'complete') ready = true;

  function $(what) {
    if (what instanceof Set$) return what;
    if (typeof what === 'function') {
      if (ready) setTimeout(what); else waiting.push(what);
      return;
    }
    if (typeof what === 'string') {
      return new Set$(what.trim().charAt(0) === '<' ? parse(what)
        : Array.prototype.slice.call(document.querySelectorAll(what)));
    }
    if (!what) return new Set$([]);
    return new Set$(what.nodeType || what === global ? [what] : Array.prototype.slice.call(what));
  }

  function all(set) { return Array.prototype.slice.call(set); }
  function matches(el, sel) { return el.nodeType === 1 && el.matches(sel); }
  function many(set, f) { for (var i = 0; i < set.length; i++) f(set[i], i); return set; }
  function words(s) { return String(s).split(/\s+/).filter(Boolean); }

  fn.get = function (i) { return i === undefined ? all(this) : this[i < 0 ? this.length + i : i]; };
  fn.each = function (f) {
    for (var i = 0; i < this.length; i++) if (f.call(this[i], i, this[i]) === false) break;
    return this;
  };
  fn.map = function (f) {
    var out = [];
    for (var i = 0; i < this.length; i++) {
      var v = f.call(this[i], i, this[i]);
      if (v != null) out = out.concat(v);
    }
    return new Set$(out);
  };

  /* ---------- walking about ---------- */

  function unique(list) { return list.filter(function (n, i) { return list.indexOf(n) === i; }); }

  fn.find = function (sel) {
    var out = [];
    many(this, function (el) { if (el.querySelectorAll) out = out.concat(all(el.querySelectorAll(sel))); });
    return new Set$(unique(out));
  };
  fn.filter = function (test) {
    return new Set$(all(this).filter(typeof test === 'function'
      ? function (el, i) { return test.call(el, i, el); }
      : function (el) { return matches(el, test); }));
  };
  fn.is = function (sel) { return all(this).some(function (el) { return matches(el, sel); }); };
  fn.closest = function (sel) {
    return new Set$(unique(all(this).map(function (el) { return el.closest ? el.closest(sel) : null; }).filter(Boolean)));
  };
  fn.children = function (sel) {
    var out = [];
    many(this, function (el) { out = out.concat(all(el.children || []).filter(function (c) { return !sel || matches(c, sel); })); });
    return new Set$(out);
  };

  /* ---------- changing it ---------- */

  function target(t) { return t instanceof Set$ ? t[0] : typeof t === 'string' ? document.querySelector(t) : t; }

  fn.appendTo = function (t) { var to = target(t); many(this, function (el) { to.appendChild(el); }); return this; };
  fn.insertAfter = function (t) {
    var at = target(t);
    all(this).reverse().forEach(function (el) { at.parentNode.insertBefore(el, at.nextSibling); });
    return this;
  };
  fn.remove = function () { return many(this, function (el) { if (el.parentNode) el.parentNode.removeChild(el); }); };
  fn.empty = function () { return many(this, function (el) { el.textContent = ''; }); };

  fn.html = function (v) {
    if (v === undefined) return this[0] ? this[0].innerHTML : undefined;
    return many(this, function (el) { el.innerHTML = v; });
  };
  fn.text = function (v) {
    if (v === undefined) return all(this).map(function (el) { return el.textContent; }).join('');
    return many(this, function (el) { el.textContent = v; });
  };
  fn.val = function (v) {
    if (v === undefined) return this[0] ? this[0].value : undefined;
    return many(this, function (el) { el.value = v; });
  };

  fn.attr = function (name, v) {
    if (typeof name === 'object') {
      return many(this, function (el) { Object.keys(name).forEach(function (k) { el.setAttribute(k, name[k]); }); });
    }
    if (v === undefined) {
      var a = this[0] && this[0].getAttribute(name);
      return a === null ? undefined : a;
    }
    return many(this, function (el) { if (v === null) el.removeAttribute(name); else el.setAttribute(name, v); });
  };
  fn.removeAttr = function (name) { return many(this, function (el) { el.removeAttribute(name); }); };
  fn.prop = function (name, v) {
    if (v === undefined) return this[0] ? this[0][name] : undefined;
    return many(this, function (el) { el[name] = v; });
  };

  fn.addClass = function (c) { return many(this, function (el) { words(c).forEach(function (w) { el.classList.add(w); }); }); };
  fn.removeClass = function (c) { return many(this, function (el) { words(c).forEach(function (w) { el.classList.remove(w); }); }); };
  fn.hasClass = function (c) { return all(this).some(function (el) { return el.classList.contains(c); }); };
  fn.toggleClass = function (c, on) {
    return many(this, function (el) {
      words(c).forEach(function (w) { if (on === undefined) el.classList.toggle(w); else el.classList.toggle(w, !!on); });
    });
  };

  /* Shown or hidden: display as the stylesheet has it, or none */
  fn.toggle = function (on) {
    return many(this, function (el) {
      var show = on === undefined ? getComputedStyle(el).display === 'none' : !!on;
      el.style.display = show ? '' : 'none';
    });
  };

  /* data-* as jQuery reads it: "4" a number, "true" a boolean, "{...}" an object */
  function typed(v) {
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (v === 'null') return null;
    if (v !== '' && String(+v) === v) return +v;
    if (/^[[{]/.test(v)) { try { return JSON.parse(v); } catch (e) { /* as written */ } }
    return v;
  }
  fn.data = function (key) {
    var el = this[0];
    if (!el) return undefined;
    var v = el.getAttribute('data-' + key.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }));
    return v === null ? undefined : typed(v);
  };

  /* ---------- events ---------- */

  /* on(events, handler) or on(events, selector, handler): with a selector the
     handler runs for a match the event passed through, as `this`.

     In jQuery's order, which matters here: one listener per element and
     event, running the delegated handlers from the innermost match outwards,
     then the element's own. A delegated handler that stops propagation stops
     the ones for matches further out on the same element too, so deleting a
     saved page (a button inside its card, both delegated from document) does
     not also open it. */
  function dispatch(el, type) {
    return function (e) {
      var list = el.__on[type].slice(), stopped = false, stop = e.stopPropagation;
      e.stopPropagation = function () { stopped = true; stop.call(e); };
      function run(h, at) {
        if (h.fn.call(at, e) === false) { e.preventDefault(); e.stopPropagation(); }
      }
      for (var at = e.target; at && at !== el && !stopped; at = at.parentNode) {
        for (var i = 0; i < list.length; i++) if (list[i].sel && matches(at, list[i].sel)) run(list[i], at);
      }
      if (!stopped) list.forEach(function (h) { if (!h.sel) run(h, el); });
    };
  }
  fn.on = function (events, sel, handler) {
    if (typeof sel === 'function') { handler = sel; sel = null; }
    return many(this, function (el) {
      words(events).forEach(function (type) {
        el.__on = el.__on || {};
        if (!el.__on[type]) { el.__on[type] = []; el.addEventListener(type, dispatch(el, type)); }
        el.__on[type].push({ sel: sel, fn: handler });
      });
    });
  };
  fn.trigger = function (type) {
    return many(this, function (el) {
      if (typeof el[type] === 'function') el[type]();
      else el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
    });
  };

  /* ---------- requests ---------- */

  /* What jQuery's requests hand back: done, fail, always, and then */
  function deferred(promise) {
    var d = {
      done: function (f) { promise.then(function (a) { f.apply(null, a); }, function () {}); return d; },
      fail: function (f) { promise.then(null, function (a) { f.apply(null, a); }); return d; },
      always: function (f) { promise.then(function () { f(); }, function () { f(); }); return d; },
      then: function (a, b) { return promise.then(a && function (x) { return a.apply(null, x); }, b && function (x) { return b.apply(null, x); }); },
      _promise: promise,
    };
    return d;
  }

  /* An error as jQuery's xhr would show it: its status, 0 for no answer */
  function request(url, init, timeout, json) {
    var abort = global.AbortController ? new AbortController() : null;
    var timer = timeout && abort ? setTimeout(function () { abort.abort(); }, timeout) : null;
    var p = fetch(url, Object.assign({}, init, abort ? { signal: abort.signal } : {}))
      .then(function (r) {
        if (timer) clearTimeout(timer);
        var xhr = { status: r.status };
        if (!r.ok) return Promise.reject([xhr, 'error']);
        return (json ? r.json() : r.text()).then(function (data) { return [data, 'success', xhr]; },
          function () { return Promise.reject([xhr, 'parsererror']); });
      }, function () {
        if (timer) clearTimeout(timer);
        return Promise.reject([{ status: 0 }, 'error']);
      });
    return deferred(p);
  }

  $.getJSON = function (url) { return request(url, {}, 0, true); };

  $.ajax = function (o) {
    var headers = o.contentType ? { 'Content-Type': o.contentType } : {};
    return request(o.url, { method: o.method || o.type || 'GET', headers: headers, body: o.data }, o.timeout, false);
  };

  /* Several requests at once: done gets each one's [data, status, xhr] */
  $.when = function () {
    var each = Array.prototype.slice.call(arguments).map(function (d) { return d._promise; });
    return deferred(Promise.all(each).then(function (list) { return list; }, function (a) { return Promise.reject(a); }));
  };

  $.trim = function (s) { return s == null ? '' : String(s).trim(); };

  $.fn = fn;
  global.$ = global.jQuery = $;
}(window));
