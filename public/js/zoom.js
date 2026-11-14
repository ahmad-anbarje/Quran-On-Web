/**
 * Moving about the page with the pointer: dragging the sheet to scroll it,
 * magnifying a spread round the pointer, and the rail that shows and sets how
 * close the page is.
 *
 * The reader (app.js) lends what these need to know of it, which layout the
 * pages are in and whether the index is open, through init(), and is handed
 * the magnifier to reset when the page changes under it.
 */
(function (global) {
  'use strict';

  /* What the reader lends: see init */
  var app = null;

  /* Run once the reader is up, as these were when they lived in it, so their
     listeners stand after the page's own */
  function start() {
    /* ---------- drag the page ----------
       Grab the sheet and pull, and let it glide on. Mouse only: a touch screen
       scrolls this way already, and fighting it breaks the momentum. */

    (function dragScroll() {
      var area = document.getElementById('content-area');
      var down = false, moved = false, onSheet = false, glide = null;
      var startY = 0, startTop = 0, lastY = 0, lastT = 0, speed = 0;

      function stopGlide() {
        if (glide) cancelAnimationFrame(glide);
        glide = null;
        area.classList.remove('free');
      }

      area.addEventListener('pointerdown', function (e) {
        /* Cleared first: a drag that ended without a click would otherwise
           leave this set and swallow the next press. */
        moved = false;
        if (e.pointerType === 'touch' || e.button !== 0) return;
        if (e.target.closest('button, input, a')) return;
        /* Dragging is for the margin beside the sheet. On the sheet itself the
           pointer belongs to the text — but the press is still tracked, so a
           plain click there still shuts the index. */
        onSheet = !!e.target.closest('.page-section');
        stopGlide();
        down = true; speed = 0;
        startY = lastY = e.clientY;
        startTop = area.scrollTop;
        lastT = e.timeStamp;
      });

      area.addEventListener('pointermove', function (e) {
        if (!down) return;
        /* A spread has nothing to scroll, and hiding the scrollbar does not stop
           scrollTop being written, so the drag stands down itself. */
        if (app.mode() === 'spread' || onSheet) return;
        var dy = e.clientY - startY;
        /* A few pixels of slack, so a click on a bookmark ribbon is still a
           click and not a one-pixel drag. */
        if (!moved) {
          if (Math.abs(dy) < 6) return;
          moved = true;
          area.classList.add('dragging', 'free');
          /* Keeps the drag alive if the cursor leaves the pane. Throws if the
             pointer is already gone, which is harmless here. */
          try { area.setPointerCapture(e.pointerId); } catch (err) { /* gone */ }
        }
        area.scrollTop = startTop - dy;
        var dt = e.timeStamp - lastT;
        if (dt > 0) speed = (e.clientY - lastY) / dt;   // px per ms
        lastY = e.clientY;
        lastT = e.timeStamp;
      });

      function release() {
        if (!down) return;
        down = false;
        area.classList.remove('dragging');

        /* A click on the page, not a drag: the index has served its purpose. */
        if (!moved) {
          if (app.sideOpen() && $('#bookmarks-panel').prop('hidden') &&
              $('#help-panel').prop('hidden')) app.setSidebar(false);
          return;
        }

        var v = speed * 16;               // px per frame at the moment of release
        (function step() {
          v *= 0.94;
          if (Math.abs(v) < 0.4) { stopGlide(); return; }
          area.scrollTop -= v;
          glide = requestAnimationFrame(step);
        }());
      }

      area.addEventListener('pointerup', release);
      area.addEventListener('pointercancel', release);
      /* A drag that ends over a ribbon must not also press it. */
      area.addEventListener('click', function (e) {
        if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; }
      }, true);
      area.addEventListener('wheel', stopGlide, { passive: true });
    }());

    /* ---------- magnify ----------
       A spread has nothing to scroll, so there the wheel moves closer to the page:
       the sheet is scaled as it stands, round the pointer, and dragged to look
       about. Nothing is laid out again, so it stays smooth. */

    var magnify = (function () {
      var area = document.getElementById('content-area');
      var box = document.getElementById('ayahs-container');
      var MAX = 4;
      var s = 1, tx = 0, ty = 0;
      var ox = 0, oy = 0;   // the box's unscaled corner on screen
      var drag = null, dragged = false;

      /* The turners are part of the scene, as they are under a touchpad pinch: they
         move out and grow with the pages rather than float over the magnified words. */
      var arrows = [], arrowAt = [];

      function apply() {
        box.style.transform = s === 1 ? '' : 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')';
        arrows.forEach(function (b, i) {
          var c = arrowAt[i];
          if (s === 1 || !c) { b.style.transform = ''; return; }
          var nx = ox + tx + (c[0] - ox) * s, ny = oy + ty + (c[1] - oy) * s;
          b.style.transform = 'translate(' + (nx - c[0]) + 'px,' + (ny - c[1]) + 'px) scale(' + s + ')';
        });
        document.body.classList.toggle('magnified', s > 1);
        if (heard) heard(s);
      }

      var heard = null;   // the zoom rail, told of every change whatever made it

      var bw = 0, bh = 0;   // the box's unscaled size, read with its corner

      // The magnified sheet keeps covering its own box, so it cannot be pushed off screen
      function clamp() {
        tx = Math.min(0, Math.max(bw - bw * s, tx));
        ty = Math.min(0, Math.max(bh - bh * s, ty));
      }

      /* While the size is moving the sheet is one layer the graphics card stretches,
         smooth at any speed; once it rests, the words are drawn sharp again at the size they settled on. */
      var settle = null;
      function moving() {
        clearTimeout(settle);
        document.body.classList.add('zooming');
      }
      function rested() {
        clearTimeout(settle);
        settle = setTimeout(function () { document.body.classList.remove('zooming'); }, 120);
      }

      /* The point under the pointer stays under it: its place in the unscaled box
         is worked out, then the box is moved so it lands there again. */
      function zoomAt(next, x, y) {
        next = Math.min(MAX, Math.max(1, next));
        if (next === s) return;
        /* Read only while unscaled: mid-glide the box measures where the easing
           has it, not where it is going, and each notch would drift further. */
        if (s === 1) {
          var r = box.getBoundingClientRect();
          ox = r.left; oy = r.top;
          // Read here, not per frame: a size read after a write lays the page out mid-glide
          bw = box.offsetWidth; bh = box.offsetHeight;
          // Where each turner's centre sits unscaled; a hidden one has no box and stays out of it
          arrows = [].slice.call(document.querySelectorAll('#page-nav button'));
          arrowAt = arrows.map(function (b) {
            var br = b.getBoundingClientRect();
            return br.width ? [br.left + br.width / 2, br.top + br.height / 2] : null;
          });
        }
        var ux = (x - ox - tx) / s, uy = (y - oy - ty) / s;
        s = next;
        tx = x - ox - ux * s;
        ty = y - oy - uy * s;
        if (s < 1.01 && target === 1) { s = 1; tx = ty = 0; }
        clamp();
        apply();
      }

      /* The wheel sets where the size is heading; each 60th of a second closes 30% of
         the way, round the pointer. Notches rolled quickly blend into one glide, as a pinch does. */
      var target = 1, ax = 0, ay = 0, frame = null, last = 0;

      // Timed, not counted in frames, so a 144Hz screen glides no faster than a 60Hz one
      function glide(now) {
        var dt = last ? Math.min(64, now - last) : 16.7;
        last = now;
        var next = s + (target - s) * (1 - Math.pow(0.82, dt / 16.7));   // eased over a few more frames, for a smooth glide
        if (Math.abs(target - next) < 0.002) next = target;
        zoomAt(next, ax, ay);
        frame = next === target ? null : requestAnimationFrame(glide);
        if (!frame) { last = 0; rested(); }
      }

      function stop() {
        if (frame) cancelAnimationFrame(frame);
        frame = null;
        last = 0;
        target = s;
        rested();
      }

      function reset() {
        stop();
        if (s === 1) return;
        s = target = 1; tx = ty = 0;
        apply();
      }

      /** Head for a size, round a point on screen; the glide gets it there. */
      function toward(next, x, y) {
        target = Math.min(MAX, Math.max(1, next));
        ax = x; ay = y;
        moving();
        if (!frame) frame = requestAnimationFrame(glide);
      }

      function wheelBy(e) {
        var dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        return target * Math.exp(-dy * 0.0008);   // about 8% a notch
      }

      area.addEventListener('wheel', function (e) {
        // A touchpad pinch arrives with ctrlKey and is the browser's own zoom
        if (app.mode() !== 'spread' || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        e.preventDefault();
        toward(wheelBy(e), e.clientX, e.clientY);
      }, { passive: false });

      area.addEventListener('pointerdown', function (e) {
        dragged = false;
        if (s === 1 || e.pointerType === 'touch' || e.button !== 0) return;
        if (e.target.closest('button, input, a')) return;
        stop();   // a grab holds the size where it is
        drag = { x: e.clientX, y: e.clientY, tx: tx, ty: ty };
      });

      area.addEventListener('pointermove', function (e) {
        if (!drag) return;
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!dragged) {
          if (Math.abs(dx) + Math.abs(dy) < 6) return;   // still a click
          dragged = true;
          document.body.classList.add('panning');
          try { area.setPointerCapture(e.pointerId); } catch (err) { /* gone */ }
        }
        tx = drag.tx + dx;
        ty = drag.ty + dy;
        clamp();
        apply();
      });

      function end() {
        drag = null;
        document.body.classList.remove('panning');
      }
      area.addEventListener('pointerup', end);
      area.addEventListener('pointercancel', end);

      // A drag that ends on a word must not also open the player
      area.addEventListener('click', function (e) {
        if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; }
      }, true);

      return {
        reset: reset,
        toward: toward,
        wheelBy: wheelBy,
        target: function () { return target; },
        MAX: MAX,
        listen: function (fn) { heard = fn; fn(s); },
      };
    }());

    /* ---------- zoom rail ----------
       The magnifier made visible: a slim track in the bottom-left corner whose
       handle follows the zoom from wherever it comes, and drags it too. Up is closer. */

    (function zoomRail() {
      var rail = document.getElementById('zoom-rail');
      if (!rail) return;
      var track = rail.querySelector('.zr-track');
      var fill = rail.querySelector('.zr-fill');
      var thumb = rail.querySelector('.zr-thumb');
      var level = rail.querySelector('.zr-level');
      // Logarithmic, so each doubling is the same distance along the track
      var SPAN = Math.log(magnify.MAX);

      magnify.listen(function (s) {
        var t = Math.log(s) / SPAN * 100;
        fill.style.height = t + '%';
        thumb.style.bottom = t + '%';
        level.textContent = Math.round(s * 100) + '%';
        rail.classList.toggle('zoomed', s > 1);
        rail.setAttribute('aria-valuenow', Math.round(s * 100));
      });

      // The rail sits beside the pages, not on them, so it zooms round the middle of the reading area
      function middle() {
        var r = document.getElementById('content-area').getBoundingClientRect();
        return [r.left + r.width / 2, r.top + r.height / 2];
      }
      function go(next) { var m = middle(); magnify.toward(next, m[0], m[1]); }

      function fromY(y) {
        var r = track.getBoundingClientRect();
        return Math.exp(Math.min(1, Math.max(0, (r.bottom - y) / r.height)) * SPAN);
      }

      var sliding = false;
      track.addEventListener('pointerdown', function (e) {
        sliding = true;
        try { track.setPointerCapture(e.pointerId); } catch (err) { /* gone */ }
        rail.classList.add('sliding');
        go(fromY(e.clientY));
        e.preventDefault();
      });
      track.addEventListener('pointermove', function (e) { if (sliding) go(fromY(e.clientY)); });
      function end() { sliding = false; rail.classList.remove('sliding'); }
      track.addEventListener('pointerup', end);
      track.addEventListener('pointercancel', end);

      rail.addEventListener('wheel', function (e) {
        e.preventDefault();
        go(magnify.wheelBy(e));
      }, { passive: false });

      rail.querySelectorAll('.zr-step').forEach(function (b) {
        b.addEventListener('click', function () { go(magnify.target() * (+b.dataset.step > 0 ? 1.25 : 0.8)); });
      });
      level.addEventListener('click', function () { magnify.reset(); });

      // A slider for the keyboard too: up and down, as the track runs
      rail.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') go(magnify.target() * 1.15);
        else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') go(magnify.target() / 1.15);
        else if (e.key === 'Home') magnify.reset();
        else return;
        e.preventDefault();
        e.stopPropagation();   // not a page turn as well
      });
    }());

    return magnify;
  }

  global.Zoom = {
    /** Starts the three, and hands over the magnifier: reset, toward, wheelBy, target, MAX, listen. */
    init: function (lent) { app = lent; return start(); },
  };

}(window));
