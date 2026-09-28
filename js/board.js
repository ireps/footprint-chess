/*
 * Footprint Chess: board view (DOM, layout and animation only).
 * No round or lesson logic lives here; see js/app.js.
 * Depends on FC.rules and FC.sound (loaded before this file).
 * DOM is built with createElement/textContent only (see SECURITY.md).
 */
(function () {
  'use strict';

  var FC = window.FC = window.FC || {};
  var R = FC.rules;
  var S = FC.sound;

  var THEME = 'robots';
  var TYPE_ORDER = ['r', 'b', 'q', 'k', 'n', 'p'];
  var TYPES = {
    r: { name: 'Rail bot, the rook', color: '#f59e2e' },
    b: { name: 'Slide bot, the bishop', color: '#ec5f99' },
    q: { name: 'Star bot, the queen', color: '#9a6ce0' },
    k: { name: 'Sleepy bot, the king', color: '#f5d23b' },
    n: { name: 'Spring bot, the knight', color: '#36c2ce' },
    p: { name: 'Mini bot, the pawn', color: '#6ccb5f' }
  };
  var CONFETTI_COLORS = ['#f59e2e', '#ec5f99', '#9a6ce0', '#f5d23b', '#36c2ce', '#6ccb5f', '#ffffff'];
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var dom = {
    board: byId('board'),
    squares: byId('squares'),
    marks: byId('marks'),
    items: byId('items'),
    pieces: byId('pieces'),
    footprints: byId('footprints'),
    fx: byId('fx'),
    guide: byId('guide'),
    stripFar: byId('strip-far'),
    stripHome: byId('strip-home')
  };

  var onTap = null;

  // The ghost hand: one node, reused for travel/press/rest. Reset to null
  // whenever clearAll() empties #guide, so the next hand()/handRest() call
  // creates a fresh node instead of touching a detached one.
  var handNode = null;
  var handAt = null; // [r, c] the hand currently rests on/near, or null before its first show

  /* ---------- helpers ---------- */

  function byId(id) { return document.getElementById(id); }
  function key(r, c) { return r + ',' + c; }

  function svgUse(id) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', '#' + id);
    svg.appendChild(use);
    return svg;
  }

  function pos(r, c) {
    return 'translate(' + (c * 100) + '%,' + (r * 100) + '%)';
  }

  // Same transform-function list in every keyframe so the browser interpolates smoothly.
  function frame(r, c, lift, rot, scale, offset) {
    var f = { transform: pos(r, c) + ' translateY(' + lift + '%) rotate(' + rot + 'deg) scale(' + scale + ')' };
    if (offset !== undefined) f.offset = offset;
    return f;
  }

  function place(node, r, c) {
    node.style.transform = pos(r, c);
  }

  // Restart a CSS animation class.
  function replay(node, cls) {
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
  }

  function clear(node) {
    node.textContent = '';
  }

  function later(fn, ms) {
    return window.setTimeout(fn, reduceMotion ? Math.min(ms, 60) : ms);
  }

  // Run an animation, then call done exactly once (with a timer as a fallback).
  function animate(node, frames, duration, easing, done) {
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      if (done) done();
    }
    if (reduceMotion || typeof node.animate !== 'function') {
      finish();
      return;
    }
    var anim = node.animate(frames, { duration: duration, easing: easing });
    anim.onfinish = finish;
    window.setTimeout(finish, duration + 150);
  }

  /* ---------- layout ---------- */

  function layout() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var pad = 12;
    var rail = 110;
    var boardRows = 8 + 2 * 0.55; // board plus the two landmark strips
    var cell = h > w
      ? Math.min((h - rail - pad * 3) / boardRows, (w - pad * 2) / 8)
      : Math.min((h - pad * 2) / boardRows, (w - rail - pad * 3) / 8);
    cell = Math.max(24, Math.floor(cell));
    document.documentElement.style.setProperty('--cell', cell + 'px');
  }

  /* ---------- squares ---------- */

  function buildSquares() {
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var sq = document.createElement('div');
        sq.className = 'sq ' + (R.isLightSquare(r, c) ? 'light' : 'dark');
        dom.squares.appendChild(sq);
      }
    }
  }

  /* ---------- pieces and items ---------- */

  function addPiece(kind, r, c) {
    var node = document.createElement('div');
    node.className = 'piece';
    node.appendChild(svgUse(THEME + '-' + kind));
    place(node, r, c);
    dom.pieces.appendChild(node);
    return node;
  }

  function addItem(r, c) {
    var node = document.createElement('div');
    node.className = 'item';
    node.appendChild(svgUse(THEME + '-star'));
    place(node, r, c);
    dom.items.appendChild(node);
    return node;
  }

  function clearAll() {
    [dom.footprints, dom.items, dom.pieces, dom.fx, dom.marks, dom.guide].forEach(clear);
    handNode = null;
    handAt = null;
  }

  /* ---------- footprints ---------- */

  function showFootprints(type, hero, moves, itemsByKey) {
    hideFootprints(itemsByKey);
    var color = TYPES[type].color;
    moves.forEach(function (m) {
      var dist = Math.max(Math.abs(m.r - hero[0]), Math.abs(m.c - hero[1]));
      var delay = (reduceMotion ? 0 : Math.min(dist * 55, 330)) + 'ms';
      var item = itemsByKey[key(m.r, m.c)];
      if (item) {
        // A reachable star gets a ring instead of footprints, so the star stays visible.
        item.style.setProperty('--tc', color);
        item.style.animationDelay = delay;
        item.classList.add('target');
        return;
      }
      var fp = document.createElement('div');
      fp.className = 'fp';
      var print = document.createElement('span');
      print.className = 'print' + (m.capture ? ' capture' : '');
      print.style.setProperty('--tc', color);
      print.style.animationDelay = delay;
      fp.appendChild(print);
      place(fp, m.r, m.c);
      dom.footprints.appendChild(fp);
    });
  }

  function clearTargets(itemsByKey) {
    Object.keys(itemsByKey).forEach(function (k) {
      itemsByKey[k].classList.remove('target');
    });
  }

  function hideFootprints(itemsByKey) {
    clear(dom.footprints);
    clearTargets(itemsByKey);
    dom.footprints.classList.remove('pulse');
    dom.items.classList.remove('pulse');
  }

  function pulseFootprints() {
    [dom.footprints, dom.items].forEach(function (layer) {
      layer.classList.remove('pulse');
      void layer.offsetWidth;
      layer.classList.add('pulse');
    });
  }

  /* ---------- move animation ---------- */

  function moveFrames(type, from, to) {
    var dr = to[0] - from[0];
    var dc = to[1] - from[1];
    var dist = Math.max(Math.abs(dr), Math.abs(dc));

    if (type === 'n') {
      // Two hops: two squares along the long side, then one to the side.
      var corner = Math.abs(dr) === 2 ? [from[0] + dr, from[1]] : [from[0], from[1] + dc];
      return {
        duration: 760,
        easing: 'linear',
        frames: [
          frame(from[0], from[1], 0, 0, 1, 0),
          frame((from[0] + corner[0]) / 2, (from[1] + corner[1]) / 2, -40, 0, 1.15, 0.25),
          frame(corner[0], corner[1], 0, 0, 0.95, 0.5),
          frame((corner[0] + to[0]) / 2, (corner[1] + to[1]) / 2, -30, 0, 1.1, 0.75),
          frame(to[0], to[1], 0, 0, 1, 1)
        ]
      };
    }

    if (type === 'k') {
      // Sleepy shuffle: lean, step, lean back.
      return {
        duration: 560,
        easing: 'ease-in-out',
        frames: [
          frame(from[0], from[1], 0, 0, 1, 0),
          frame(from[0], from[1], -6, -10, 1, 0.25),
          frame(to[0], to[1], -6, 10, 1, 0.75),
          frame(to[0], to[1], 0, 0, 1, 1)
        ]
      };
    }

    if (type === 'p') {
      // March: one small hop per square.
      var frames = [];
      var sr = dr / dist;
      var sc = dc / dist;
      for (var s = 0; s < dist; s++) {
        frames.push(frame(from[0] + sr * s, from[1] + sc * s, 0, 0, 1, s / dist));
        frames.push(frame(from[0] + sr * (s + 0.5), from[1] + sc * (s + 0.5), -14, 0, 1, (s + 0.5) / dist));
      }
      frames.push(frame(to[0], to[1], 0, 0, 1, 1));
      return { duration: 260 * dist + 80, easing: 'linear', frames: frames };
    }

    if (type === 'b') {
      // Swoosh along the diagonal.
      return {
        duration: Math.min(620, 260 + 70 * dist),
        easing: 'ease-in-out',
        frames: [
          frame(from[0], from[1], 0, 0, 1, 0),
          frame((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, 0, dc > 0 ? 12 : -12, 1.12, 0.5),
          frame(to[0], to[1], 0, 0, 1, 1)
        ]
      };
    }

    // Rook and queen glide.
    return {
      duration: Math.min(560, 200 + 70 * dist),
      easing: 'cubic-bezier(0.55, 0, 0.25, 1)',
      frames: [frame(from[0], from[1], 0, 0, 1, 0), frame(to[0], to[1], 0, 0, 1, 1)]
    };
  }

  function sparkle(r, c, delay) {
    later(function () {
      var node = document.createElement('div');
      node.className = 'spark';
      node.appendChild(document.createElement('span'));
      place(node, r, c);
      dom.fx.appendChild(node);
      later(function () { node.remove(); }, 600);
    }, delay);
  }

  function moveHero(node, type, from, to, done) {
    var plan = moveFrames(type, from, to);

    if (type === 'q') {
      var dist = Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]));
      for (var s = 1; s < dist; s++) {
        sparkle(from[0] + (to[0] - from[0]) * s / dist, from[1] + (to[1] - from[1]) * s / dist, s * 50);
      }
    }

    S.play('move-' + type);
    place(node, to[0], to[1]);
    animate(node, plan.frames, plan.duration, plan.easing, done);
  }

  function poof(node) {
    node.classList.add('poof');
    later(function () { node.remove(); }, 400);
  }

  function confetto() {
    var node = document.createElement('div');
    node.className = 'confetti';
    node.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    dom.fx.appendChild(node);
    var angle = Math.random() * Math.PI * 2;
    var reach = 30 + Math.random() * 45; // percent of board size
    var size = dom.board.clientWidth / 100;
    var dx = Math.cos(angle) * reach * size;
    var dy = Math.sin(angle) * reach * size;
    var spin = (Math.random() * 2 - 1) * 540;
    animate(node, [
      { transform: 'translate(-50%,-50%) translate(0px,0px) rotate(0deg)', opacity: 1 },
      { transform: 'translate(-50%,-50%) translate(' + dx + 'px,' + dy + 'px) rotate(' + spin + 'deg)', opacity: 1, offset: 0.7 },
      { transform: 'translate(-50%,-50%) translate(' + dx + 'px,' + (dy + 40) + 'px) rotate(' + spin + 'deg)', opacity: 0 }
    ], 900 + Math.random() * 400, 'ease-out', function () { node.remove(); });
  }

  function confetti(count) {
    if (reduceMotion) return;
    for (var i = 0; i < count; i++) confetto();
  }

  /* ---------- glow and landmark (step 4) ---------- */

  // Highlight a set of squares (a soft ring/fill in the given colour). An
  // empty list clears them. Player.js passes the hero's colour (the spec's
  // glow(squares) has no colour parameter, but the glow is drawn "in the
  // hero colour via --tc"; board.js has no lesson/type state of its own to
  // derive that from, so the colour is an optional second argument here and
  // falls back to the theme's --active gold when omitted).
  function glow(squares, color) {
    clear(dom.marks);
    (squares || []).forEach(function (sq) {
      var node = document.createElement('div');
      node.className = 'glow';
      node.style.setProperty('--tc', color || 'var(--active)');
      place(node, sq[0], sq[1]);
      dom.marks.appendChild(node);
    });
  }

  // Pulse the far or home landmark strip. Finite (CSS handles the iteration
  // count) so nothing loops while the child is thinking.
  function landmark(edge) {
    var node = edge === 'home' ? dom.stripHome : dom.stripFar;
    if (node) replay(node, 'lit');
  }

  /* ---------- ghost hand (step 4) ---------- */

  function ensureHand() {
    if (!handNode) {
      handNode = document.createElement('div');
      handNode.className = 'hand';
      handNode.setAttribute('aria-hidden', 'true');
      handNode.appendChild(svgUse('ic-hand'));
      dom.guide.appendChild(handNode);
    }
    return handNode;
  }

  // The hand is not one cell in size (see css/app.css), so it is positioned
  // with its own transform rather than pos()/place(): the fingertip (the top
  // centre of ic-hand's viewBox) lands on the square centre, in --cell units
  // so it tracks the board at any size.
  // The hand box is one cell; its drawing is offset in CSS so the fingertip
  // sits at the box centre. Plain percentages (no calc/var) so the keyframes
  // interpolate on older Chromium too.
  function handTransform(r, c, scale) {
    return 'translate(' + (c * 100) + '%,' + (r * 100) + '%) scale(' + scale + ')';
  }

  function handFrame(r, c, scale, offset) {
    var f = { transform: handTransform(r, c, scale) };
    if (offset !== undefined) f.offset = offset;
    return f;
  }

  function ripple(r, c) {
    var node = document.createElement('div');
    node.className = 'ripple';
    place(node, r, c);
    dom.guide.appendChild(node);
    later(function () { node.remove(); }, 400);
  }

  function press(r, c, done) {
    ripple(r, c);
    animate(handNode, [
      handFrame(r, c, 1),
      handFrame(r, c, 0.85, 0.5),
      handFrame(r, c, 1)
    ], 350, 'ease-out', done);
  }

  // Travels from wherever it last was (or just below the board centre, the
  // first time) to (r, c), presses with a ripple, then calls done.
  function hand(r, c, done) {
    var node = ensureHand();
    node.classList.remove('away');
    node.style.opacity = '';
    var from = handAt || [8.4, 3.5];
    handAt = [r, c];

    if (reduceMotion || typeof node.animate !== 'function') {
      node.style.transform = handTransform(r, c, 1);
      later(function () { if (done) done(); }, 300);
      return;
    }

    node.style.transform = handTransform(r, c, 1); // final pose; the animation below is an overlay
    animate(node, [
      handFrame(from[0], from[1], 1),
      handFrame(r, c, 1)
    ], 550, 'ease-in-out', function () { press(r, c, done); });
  }

  // Show the hand resting on a square, static (no loop).
  function handRest(r, c) {
    var node = ensureHand();
    node.classList.remove('away');
    node.style.opacity = '';
    handAt = [r, c];
    node.style.transform = handTransform(r, c, 1);
  }

  function hideHand() {
    if (!handNode) return;
    var node = handNode;
    handAt = null;
    node.style.opacity = '0';
    later(function () { node.classList.add('away'); }, 220);
  }

  /* ---------- input ---------- */

  function onBoardDown(e) {
    e.preventDefault();
    S.unlock();
    var rect = dom.board.getBoundingClientRect();
    var c = Math.floor((e.clientX - rect.left) / rect.width * 8);
    var r = Math.floor((e.clientY - rect.top) / rect.height * 8);
    if (!R.onBoard(r, c)) return;
    if (onTap) onTap(r, c);
  }

  /* ---------- start ---------- */

  function init(cb) {
    onTap = cb;
    layout();
    buildSquares();
    window.addEventListener('resize', layout);
    window.addEventListener('orientationchange', layout);
    dom.board.addEventListener('pointerdown', onBoardDown);
    dom.board.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  FC.board = {
    TYPES: TYPES,
    TYPE_ORDER: TYPE_ORDER,
    THEME: THEME,
    reduceMotion: reduceMotion,
    init: init,
    clearAll: clearAll,
    addPiece: addPiece,
    addItem: addItem,
    place: place,
    replay: replay,
    later: later,
    animate: animate,
    showFootprints: showFootprints,
    hideFootprints: hideFootprints,
    pulseFootprints: pulseFootprints,
    moveHero: moveHero,
    poof: poof,
    sparkle: sparkle,
    confetti: confetti,
    glow: glow,
    landmark: landmark,
    hand: hand,
    handRest: handRest,
    hideHand: hideHand,
    // Not in the step-1 spec list, but app.js's rail (svgUse) and star-relocation
    // animation (pos) need the same primitives board.js already builds, so they are
    // exposed here rather than duplicated.
    svgUse: svgUse,
    pos: pos
  };
})();
