/*
 * Footprint Chess: Home as a path of footprints (the steps and parts come
 * from js/path.js).
 *
 * One part of the path shows at a time, as a trail of steps joined by
 * footprints that climbs from the bottom of the screen (the child's side)
 * to a flag at the end. The suggested next step is bigger, glows, has a
 * green play badge and the child's own picture beside it; done steps have a
 * green tick and the footprints up to them are coloured in the child's ring
 * colour. Every step can be tapped; nothing is locked. The part buttons at
 * the top (pictures only) switch parts; a finished part has a tick and a
 * raised flag, and tapping the flag shows the next part.
 *
 * When the child comes back to Home after finishing a step, the path moves
 * on: the new footprints appear one after another, the child's picture
 * hops to the next step and a voice line says what is next; a finished part
 * raises its flag first and then the next part shows. Motion is transform
 * and opacity only; under reduced motion the picture still slides, plainly
 * (as moving pieces do), and nothing loops: after about six seconds without a tap the ghost hand taps the
 * glowing step once.
 *
 * Classic script, DOM built with createElement/textContent only.
 */
(function () {
  'use strict';

  var FC = window.FC;
  var PATH = FC.path;
  var LS = FC.lessons;
  var V = FC.voice;
  var S = FC.sound;
  var B = FC.board;

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var HAND_DELAY_MS = 6000;
  var STEP_MS = 45;          // between two footprints appearing
  var REVEAL_MAX_MS = 1100;  // the longest the footprints take to fill in
  var HOP_MS = 650;          // the child's picture moving to the next step
  var FLAG_MS = 900;         // the flag going up, before the next part shows

  var dom = {
    screen: document.getElementById('homescreen'),
    area: document.getElementById('path-area'),
    chapters: document.getElementById('path-chapters')
  };

  var store = null;
  var onStart = function () {};
  var view = 0;              // the part on screen
  var lastNext = {};         // child id -> the next step Home showed last (this page load)
  var lastAllDone = {};      // child id -> every step was done when Home showed last
  var timers = [];
  var handShown = false;
  var showing = false;

  /* ---------- small helpers ---------- */

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }
  function svgEl(tag, attrs) {
    var n = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function later(fn, ms) {
    var t = window.setTimeout(function () {
      timers = timers.filter(function (x) { return x !== t; });
      if (showing) fn();
    }, ms);
    timers.push(t);
  }
  function clearTimers() {
    timers.forEach(function (t) { window.clearTimeout(t); });
    timers = [];
  }

  function progress() { return (store && store.progress()) || {}; }
  function childId() {
    var cur = store && store.current();
    return cur ? cur.id : '';
  }
  function ringColour() {
    var cur = store && store.current();
    return (cur && cur.pic && cur.pic.ring) || '#f59e2e';
  }

  // Text in the current language, else the next one in its fallback chain.
  function textOf(entry) {
    if (!entry) return '';
    var chain = FC.langs.fallbackChain(V.getLang());
    for (var i = 0; i < chain.length; i++) {
      if (entry[chain[i]]) return entry[chain[i]];
    }
    return '';
  }

  function caption(id) {
    var kind = PATH.kindOf(id);
    if (kind === 'piece') return (LS.PIECE_NAMES[V.getLang()] || LS.PIECE_NAMES[LS.DEFAULT_LANG])[id];
    if (id === 'turns') return textOf(LS.UI_TEXT.takingTurns);
    return FC.gamesUI.caption(id);
  }
  function captionEn(id) {
    var kind = PATH.kindOf(id);
    if (kind === 'piece') return LS.PIECE_NAMES[LS.DEFAULT_LANG][id];
    if (id === 'turns') return LS.UI_TEXT.takingTurns[LS.DEFAULT_LANG];
    return FC.gamesUI.caption(id, LS.DEFAULT_LANG);
  }

  // A step's picture: a piece in the theme's art with its real silhouette
  // badge, or a game's own pictogram.
  function stopPic(id, mini) {
    if (PATH.kindOf(id) === 'piece') {
      var wrap = el('div', 'stop-art');
      var bot = B.pieceSvg(id, 'me');
      bot.classList.add('bot');
      wrap.appendChild(bot);
      if (!mini) {
        var cl = el('div', 'stop-cl');
        cl.appendChild(B.svgUse('cl-' + id));
        wrap.appendChild(cl);
      }
      return wrap;
    }
    // A game's own picture (js/game-pics.js); Taking turns is the two teams' pawns.
    return FC.gamePics.game(id, !!mini);
  }

  /* ---------- layout ---------- */

  // Centre points for n steps and the flag, inside a w x h area, and the
  // step size. The trail starts at the bottom and climbs; rows run one way
  // and then the other.
  function layout(n, w, h) {
    var portrait = h > w;
    var pts = [];
    var flag;
    var size;
    var i;
    if (portrait) {
      size = Math.max(96, Math.min(150, w * 0.19, h * 0.12));
      var rows = Math.ceil(n / 2);
      var xs = [w * 0.27, w * 0.73];
      var maxBottom = h - size * 0.95;
      var step = rows > 1 ? Math.min(size * 2.1, (maxBottom - size * 0.95) / (rows - 1 + 0.6)) : 0;
      // Centred in the height, so a short part does not leave the top empty.
      var bottom = Math.min(maxBottom, h / 2 + (rows - 1) * step / 2 + size * 0.4);
      for (i = 0; i < n; i++) {
        var r = Math.floor(i / 2);
        var c = (r % 2 === 0) ? (i % 2) : 1 - (i % 2);
        pts.push([xs[c], bottom - r * step]);
      }
      var lastP = pts[n - 1];
      var lastCol = lastP[0] > w / 2 ? 1 : 0;
      if (n % 2 === 1) {
        flag = [xs[1 - lastCol], lastP[1]];
      } else {
        flag = [lastCol === 1 ? w * 0.92 : w * 0.08, lastP[1] - size * 0.15];
      }
    } else if (n <= 4) {
      size = Math.max(96, Math.min(150, h * 0.24, w * 0.12));
      var span = w - size * 2.6;
      var gap = span / n;
      var x0 = size * 1.3;
      for (i = 0; i < n; i++) {
        pts.push([x0 + i * gap, i % 2 === 0 ? h * 0.7 : h * 0.42]);
      }
      flag = [x0 + n * gap - gap * 0.35, h * 0.24];
    } else {
      size = Math.max(96, Math.min(150, h * 0.23, w * 0.12));
      var cols = Math.ceil(n / 2);
      var spacing = Math.min(size * 2.3, (w - size * 2.4) / Math.max(1, cols - 1));
      var left = w / 2 - spacing * (cols - 1) / 2;
      var yBottom = h - size * 0.95;
      var yTop = Math.max(size * 0.75, yBottom - size * 2.2);
      for (i = 0; i < n; i++) {
        if (i < cols) pts.push([left + i * spacing, yBottom]);
        else pts.push([left + (cols - 1 - (i - cols)) * spacing, yTop]);
      }
      var used = n - cols;
      flag = used < cols ? [left + (cols - 1 - used) * spacing, yTop] : [Math.max(size * 0.5, left - spacing * 0.6), yTop];
    }
    return { pts: pts, flag: flag, size: size, portrait: portrait };
  }

  // Points along the trail from a to b: straight-ish along a row, bulging
  // outward when it climbs to the next row.
  function curve(a, b, w, size) {
    var c1;
    var c2;
    var climbs = Math.abs(a[1] - b[1]) > size * 0.9 && Math.abs(a[0] - b[0]) < size * 0.5;
    if (climbs) {
      var out = a[0] > w / 2 ? size * 1.25 : -size * 1.25;
      c1 = [a[0] + out, a[1]];
      c2 = [b[0] + out, b[1]];
    } else {
      c1 = [a[0] + (b[0] - a[0]) / 3, a[1]];
      c2 = [a[0] + 2 * (b[0] - a[0]) / 3, b[1]];
    }
    return function (t) {
      var u = 1 - t;
      return [
        u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0],
        u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1]
      ];
    };
  }

  // Footprints along one stretch of the trail, as SVG ellipses; skips the
  // parts hidden under the two ends.
  function footprints(svg, f, a, b, size, cls, skipA, skipB) {
    var k = size / 150;
    var gapPx = 30 * k;
    var out = [];
    var prev = f(0);
    var acc = 0;
    var n = 0;
    for (var s = 1; s <= 160; s++) {
      var p = f(s / 160);
      acc += Math.sqrt((p[0] - prev[0]) * (p[0] - prev[0]) + (p[1] - prev[1]) * (p[1] - prev[1]));
      if (acc >= gapPx) {
        acc = 0;
        var da = Math.sqrt((p[0] - a[0]) * (p[0] - a[0]) + (p[1] - a[1]) * (p[1] - a[1]));
        var db = Math.sqrt((p[0] - b[0]) * (p[0] - b[0]) + (p[1] - b[1]) * (p[1] - b[1]));
        if (da > skipA && db > skipB) {
          var ang = Math.atan2(p[1] - prev[1], p[0] - prev[0]);
          var off = (n % 2 ? 7 : -7) * k;
          var x = p[0] - Math.sin(ang) * off;
          var y = p[1] + Math.cos(ang) * off;
          var e = svgEl('ellipse', {
            cx: x.toFixed(1), cy: y.toFixed(1), rx: (10 * k).toFixed(1), ry: (6 * k).toFixed(1),
            transform: 'rotate(' + (ang * 180 / Math.PI).toFixed(1) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')',
            'class': cls
          });
          svg.appendChild(e);
          out.push(e);
          n++;
        }
      }
      prev = p;
    }
    return out;
  }

  /* ---------- drawing ---------- */

  function drawChapters(p, next) {
    dom.chapters.textContent = '';
    PATH.CHAPTERS.forEach(function (ch, i) {
      var btn = el('button', 'path-chap' + (i === view ? ' cur' : ''));
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Part ' + (i + 1));
      btn.setAttribute('aria-pressed', i === view ? 'true' : 'false');
      var pics = el('div', 'chap-pics');
      ch.pic.forEach(function (pair) {
        // A piece in the theme's art, an icon from the sprite (ic-...) or a
        // row picture (row:...).
        if (pair[0].indexOf('ic-') === 0) {
          var icon = B.svgUse(pair[0]);
          icon.setAttribute('class', 'chap-sym');
          pics.appendChild(icon);
        } else if (pair[0].indexOf('row:') === 0) {
          // A row picture from the games (js/game-pics.js): the pond, the king, the army.
          pics.appendChild(FC.gamePics.rowMark(pair[0].slice(4)));
        } else {
          pics.appendChild(B.pieceSvg(pair[0], pair[1]));
        }
      });
      btn.appendChild(pics);
      if (PATH.chapterDone(p, i)) {
        var tick = el('div', 'chap-tick');
        tick.appendChild(B.svgUse('ic-check'));
        btn.appendChild(tick);
      } else if (PATH.chapterOf(next) === i) {
        var dot = el('div', 'chap-dot');
        dot.appendChild(B.svgUse('play-tri'));
        btn.appendChild(dot);
      }
      btn.addEventListener('click', function () {
        S.unlock();
        if (view === i) return;
        S.play('select');
        clearTimers();
        view = i;
        draw(progress(), PATH.nextStop(progress()), null);
        armHand();
      });
      dom.chapters.appendChild(btn);
    });
  }

  // Draws part `view`. anim (optional): { from: the step the child's
  // picture moves from, toFlag: it walks on to the flag instead of a step }.
  // Returns the pieces an animation needs.
  function draw(p, next, anim) {
    drawChapters(p, next);
    var area = dom.area;
    area.textContent = '';
    area.classList.remove('swap');
    var ch = PATH.CHAPTERS[view];
    var w = area.clientWidth || window.innerWidth;
    var h = area.clientHeight || window.innerHeight;
    var lay = layout(ch.stops.length, w, h);
    var size = lay.size;
    var ring = ringColour();
    area.style.setProperty('--ring', ring);

    var svg = svgEl('svg', { 'class': 'path-trail', width: w, height: h, viewBox: '0 0 ' + w + ' ' + h, 'aria-hidden': 'true', focusable: 'false' });
    area.appendChild(svg);

    var fromIdx = anim && anim.from ? ch.stops.indexOf(anim.from) : -1;
    var toIdx = anim ? (anim.toFlag ? ch.stops.length : ch.stops.indexOf(next)) : -1;
    var fresh = [];
    var ends = lay.pts.concat([lay.flag]);
    for (var i = 0; i < ends.length - 1; i++) {
      var walked = PATH.isDone(p, ch.stops[i]);
      var isNew = anim && fromIdx !== -1 && i >= fromIdx && i < toIdx;
      var cls = walked ? 'tfp walked' : 'tfp';
      if (isNew) cls += ' tfp-hidden';
      var f = curve(ends[i], ends[i + 1], w, size);
      var skipB = (i + 1 === ends.length - 1) ? size * 0.25 : size * 0.62;
      var made = footprints(svg, f, ends[i], ends[i + 1], size, cls, size * 0.62, skipB);
      if (isNew) fresh = fresh.concat(made);
    }

    var stopNodes = {};
    ch.stops.forEach(function (id, idx) {
      var done = PATH.isDone(p, id);
      var isNext = id === next;
      var btn = el('button', 'path-stop' + (done ? ' done' : '') + (isNext ? ' next' : ''));
      btn.type = 'button';
      var s = isNext ? size * 1.17 : size;
      btn.style.width = s + 'px';
      btn.style.height = s + 'px';
      btn.style.left = (lay.pts[idx][0] - s / 2) + 'px';
      btn.style.top = (lay.pts[idx][1] - s / 2) + 'px';
      btn.style.setProperty('--s', (s / 150).toFixed(3));
      var pic = stopPic(id);
      // A game's picture is drawn for a 150-pixel card: scaled to the step.
      if (PATH.kindOf(id) !== 'piece') pic.style.transform = 'scale(' + (s / 150).toFixed(3) + ')';
      btn.appendChild(pic);
      var name = el('div', 'stop-name');
      name.textContent = caption(id);
      btn.appendChild(name);
      if (done) {
        var tick = el('div', 'stop-tick');
        tick.appendChild(B.svgUse('ic-check'));
        btn.appendChild(tick);
      }
      // "Practise again": a quiz had to show this piece's move.
      if (PATH.needsPractice(p, id)) {
        btn.classList.add('practise');
        var again = el('div', 'stop-again');
        again.appendChild(B.svgUse('again'));
        btn.appendChild(again);
      }
      if (isNext) {
        var play = el('div', 'stop-play');
        play.appendChild(B.svgUse('play-tri'));
        btn.appendChild(play);
      }
      btn.setAttribute('aria-label', captionEn(id));
      btn.addEventListener('click', function () { start(id); });
      area.appendChild(btn);
      stopNodes[id] = btn;
    });

    // The flag at the end of the part: up and gold once the part is done.
    var flag = el('button', 'path-flag' + (PATH.chapterDone(p, view) ? ' raised' : ''));
    flag.type = 'button';
    flag.setAttribute('aria-label', 'Next part');
    flag.style.width = (size * 0.6) + 'px';
    flag.style.height = (size * 0.95) + 'px';
    flag.style.left = (lay.flag[0] - size * 0.17) + 'px';
    flag.style.top = (lay.flag[1] - size * 0.8) + 'px';
    flag.appendChild(el('div', 'flag-pole'));
    flag.appendChild(el('div', 'flag-cloth'));
    flag.addEventListener('click', function () {
      S.unlock();
      S.play('select');
      clearTimers();
      view = (view + 1) % PATH.CHAPTERS.length;
      draw(progress(), PATH.nextStop(progress()), null);
      armHand();
    });
    area.appendChild(flag);

    // The child's own picture, beside the step they are on.
    var marker = null;
    var nextIdx = ch.stops.indexOf(next);
    if (nextIdx !== -1 || (anim && anim.toFlag)) {
      var cur = store && store.current();
      marker = el('div', 'path-me');
      if (cur) marker.appendChild(FC.profileUI.avatar(cur.pic));
      var at = anim && anim.toFlag ? lay.flag : lay.pts[nextIdx];
      var ms = Math.max(56, size * 0.5);
      marker.style.width = ms + 'px';
      marker.style.height = ms + 'px';
      marker.style.left = (at[0] - size * 0.66 - ms / 2) + 'px';
      marker.style.top = (at[1] - size * 0.62 - ms / 2) + 'px';
      if (anim && fromIdx !== -1) {
        var from = lay.pts[fromIdx];
        marker.style.transform = 'translate(' + (from[0] - at[0]).toFixed(1) + 'px,' + (from[1] - at[1]).toFixed(1) + 'px)';
      }
      area.appendChild(marker);
    }

    return { stops: stopNodes, fresh: fresh, marker: marker, flag: flag, lay: lay };
  }

  /* ---------- the "what next" moment ---------- */

  function revealFootprints(fresh) {
    // A long stretch (several steps at once) still fills in about a second.
    var step = Math.min(STEP_MS, REVEAL_MAX_MS / Math.max(1, fresh.length));
    fresh.forEach(function (e, i) {
      e.style.transitionDelay = Math.round(i * step) + 'ms';
    });
    // Next frame, so the hidden state has been painted first.
    later(function () {
      fresh.forEach(function (e) { e.classList.remove('tfp-hidden'); });
    }, 30);
    return Math.round(fresh.length * step) + 150;
  }

  function hop(marker, delay) {
    if (!marker) return;
    later(function () {
      marker.classList.add('moving');
      marker.style.transform = 'translate(0px,0px)';
    }, delay);
  }

  function say(id) {
    if (S.context()) V.sayAfter(id, function () {});
  }

  // "Here's what's next", or "let's practise this one again" when the path
  // sends the child back to a piece.
  function nextLine(p, next) {
    return PATH.needsPractice(p, next) ? 'practise-next' : 'path-next';
  }

  // The child came back and the path moved on from `from` to `next`.
  function moveOn(p, from, next) {
    var fromCh = PATH.chapterOf(from);
    var nextCh = PATH.chapterOf(next);
    if (fromCh === nextCh || fromCh === -1 || !PATH.chapterDone(p, fromCh)) {
      view = nextCh;
      var parts = draw(p, next, { from: from });
      if (parts.stops[from]) parts.stops[from].classList.add('pop');
      var t = revealFootprints(parts.fresh);
      hop(parts.marker, Math.max(150, t - HOP_MS / 2));
      say(nextLine(p, next));
      later(armHand, t + HOP_MS);
      return;
    }
    // A part was finished: walk to its flag and raise it, then show the
    // next part with the child's picture on its next step.
    view = fromCh;
    var first = draw(p, next, { from: from, toFlag: true });
    first.flag.classList.remove('raised');
    if (first.stops[from]) first.stops[from].classList.add('pop');
    var t1 = revealFootprints(first.fresh);
    hop(first.marker, Math.max(150, t1 - HOP_MS / 2));
    var tFlag = t1 + HOP_MS / 2;
    later(function () {
      first.flag.classList.add('raised');
      S.play('select');
    }, tFlag);
    say('chapter-done');
    later(function () { dom.area.classList.add('swap'); }, tFlag + FLAG_MS);
    later(function () {
      view = nextCh;
      var second = draw(progress(), next, null);
      if (second.marker) second.marker.classList.add('land');
      say(nextLine(progress(), next));
      later(armHand, 600);
    }, tFlag + FLAG_MS + 260);
  }

  /* ---------- ghost hand: once per visit, after a quiet spell ---------- */

  function armHand() {
    if (handShown) return;
    later(showHand, HAND_DELAY_MS);
  }

  function showHand() {
    if (handShown) return;
    var target = dom.area.querySelector('.path-stop.next');
    if (!target) return;
    handShown = true;
    var hand = B.svgUse('ic-hand');
    hand.setAttribute('class', 'path-hand');
    var size = target.offsetWidth;
    hand.style.width = (size * 0.55) + 'px';
    hand.style.height = (size * 0.55) + 'px';
    hand.style.left = (target.offsetLeft + size * 0.5 - size * 0.275) + 'px';
    hand.style.top = (target.offsetTop + size * 0.45) + 'px';
    dom.area.appendChild(hand);
    later(function () { if (hand.parentNode) hand.parentNode.removeChild(hand); }, 1700);
  }

  function onAnyTap() {
    // A tap means the child is choosing: no hand this visit.
    handShown = true;
  }

  /* ---------- public ---------- */

  function start(id) {
    S.unlock();
    leave();
    onStart(id);
  }

  // Draws Home for the current child. Called every time Home shows.
  function render() {
    clearTimers();
    showing = true;
    handShown = false;
    var p = progress();
    var id = childId();
    var next = PATH.nextStop(p);
    var prev = lastNext[id];
    var allDone = PATH.allDone(p);
    var wasAllDone = !!lastAllDone[id];
    lastNext[id] = next;
    lastAllDone[id] = allDone;

    var moved = !!prev && prev !== next && PATH.isDone(p, prev) && (!allDone || PATH.needsPractice(p, next));
    // Under reduced motion too (the owner's tablet has it on): the picture
    // still slides plainly to the next step, without a bounce (css/app.css).
    if (moved) {
      moveOn(p, prev, next);
      return;
    }
    view = Math.max(0, PATH.chapterOf(next));
    draw(p, next, null);
    if (allDone && !wasAllDone && prev) {
      say('path-all-done');
    } else if (moved) {
      if (PATH.chapterOf(prev) !== PATH.chapterOf(next) && PATH.chapterDone(p, PATH.chapterOf(prev))) say('chapter-done');
      say(nextLine(p, next));
    }
    armHand();
  }

  // Redraws the part on screen as it is now, without any animation (a
  // language switch, a resize).
  function refresh() {
    if (!showing) return;
    clearTimers();
    var p = progress();
    draw(p, PATH.nextStop(p), null);
  }

  // Home is being left: stop timers so nothing plays later.
  function leave() {
    showing = false;
    clearTimers();
  }

  // The voice line for the first tap on Home: the pieces' greeting for a
  // brand-new child, otherwise "here's what's next".
  function greetingLine() {
    var p = progress();
    var any = PATH.STOP_IDS.some(function (id) { return PATH.isDone(p, id); });
    return any ? 'path-next' : 'pick';
  }

  function init(theStore, opts) {
    store = theStore;
    onStart = opts.onStart;
    dom.screen.addEventListener('pointerdown', onAnyTap, true);
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(refresh, 150);
    });
  }

  FC.pathUI = {
    init: init,
    render: render,
    refresh: refresh,
    leave: leave,
    stopPic: stopPic,
    caption: caption,
    captionEn: captionEn,
    greetingLine: greetingLine,
    layout: layout
  };
})();
