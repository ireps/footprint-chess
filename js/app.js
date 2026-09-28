/*
 * Footprint Chess: board UI.
 * Depends on FC.rules, FC.levels and FC.sound (loaded before this file).
 * DOM is built with createElement/textContent only (see SECURITY.md).
 */
(function () {
  'use strict';

  var FC = window.FC;
  var R = FC.rules;
  var L = FC.levels;
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
  var IDLE_MS = 5000;
  var NEXT_ROUND_MS = 1500;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var dom = {
    board: byId('board'),
    squares: byId('squares'),
    items: byId('items'),
    pieces: byId('pieces'),
    footprints: byId('footprints'),
    fx: byId('fx'),
    stars: byId('stars'),
    characters: byId('characters'),
    sound: byId('sound-toggle')
  };

  var state = {
    type: 'r',
    round: null,
    hero: null,       // hero DOM node
    foes: {},         // "r,c" -> DOM node
    items: {},        // "r,c" -> DOM node (stars)
    moves: [],
    selected: false,
    busy: false,
    collected: 0,
    idleTimer: null,
    roundTimer: null
  };

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

  /* ---------- static UI ---------- */

  function buildSquares() {
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var sq = document.createElement('div');
        sq.className = 'sq ' + (R.isLightSquare(r, c) ? 'light' : 'dark');
        dom.squares.appendChild(sq);
      }
    }
  }

  function buildRail() {
    for (var i = 0; i < L.STAR_COUNT; i++) {
      var slot = document.createElement('span');
      slot.className = 'slot';
      slot.appendChild(svgUse(THEME + '-star'));
      dom.stars.appendChild(slot);
    }
    dom.stars.setAttribute('role', 'img');

    TYPE_ORDER.forEach(function (type) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'char';
      btn.setAttribute('aria-label', TYPES[type].name);
      btn.setAttribute('data-type', type);
      btn.appendChild(svgUse(THEME + '-' + type));
      btn.addEventListener('click', function () {
        S.unlock();
        startRound(type);
      });
      dom.characters.appendChild(btn);
    });

    dom.sound.addEventListener('click', function () {
      S.unlock();
      var on = !S.isEnabled();
      S.setEnabled(on);
      dom.sound.setAttribute('aria-pressed', on ? 'true' : 'false');
      dom.sound.querySelector('use').setAttribute('href', on ? '#ic-sound-on' : '#ic-sound-off');
      if (on) S.play('select');
    });
  }

  function renderSlots(popIndex) {
    var slots = dom.stars.children;
    for (var i = 0; i < slots.length; i++) {
      var on = i < state.collected;
      slots[i].classList.toggle('on', on);
      if (i === popIndex) replay(slots[i], 'on');
    }
    dom.stars.setAttribute('aria-label', state.collected + ' of ' + L.STAR_COUNT + ' stars');
  }

  function markActive(type) {
    var buttons = dom.characters.children;
    for (var i = 0; i < buttons.length; i++) {
      var active = buttons[i].getAttribute('data-type') === type;
      buttons[i].classList.toggle('active', active);
      buttons[i].setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  /* ---------- rounds ---------- */

  function makePiece(kind, r, c) {
    var node = document.createElement('div');
    node.className = 'piece';
    node.appendChild(svgUse(THEME + '-' + kind));
    place(node, r, c);
    dom.pieces.appendChild(node);
    return node;
  }

  function makeItem(r, c) {
    var node = document.createElement('div');
    node.className = 'item';
    node.appendChild(svgUse(THEME + '-star'));
    place(node, r, c);
    dom.items.appendChild(node);
    return node;
  }

  function startRound(type) {
    window.clearTimeout(state.roundTimer);
    state.type = type;
    state.round = L.createStarRound(type);
    state.collected = 0;
    state.selected = false;
    state.moves = [];
    state.busy = false;
    state.foes = {};
    state.items = {};
    [dom.footprints, dom.items, dom.pieces, dom.fx].forEach(clear);
    markActive(type);
    renderSlots(-1);

    var board = state.round.board;
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var cell = board[r][c];
        if (!cell) continue;
        if (cell.team === 'me') {
          state.hero = makePiece(cell.type, r, c);
        } else {
          state.foes[key(r, c)] = makePiece(cell.type, r, c);
        }
      }
    }
    state.round.stars.forEach(function (s) {
      state.items[key(s[0], s[1])] = makeItem(s[0], s[1]);
    });
    replay(state.hero, 'enter');
    armIdle();
  }

  /* ---------- footprints ---------- */

  function showFootprints() {
    hideFootprints();
    var hero = state.round.hero;
    var color = TYPES[state.type].color;
    state.moves.forEach(function (m) {
      var dist = Math.max(Math.abs(m.r - hero[0]), Math.abs(m.c - hero[1]));
      var delay = (reduceMotion ? 0 : Math.min(dist * 55, 330)) + 'ms';
      var item = state.items[key(m.r, m.c)];
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

  function clearTargets() {
    Object.keys(state.items).forEach(function (k) {
      state.items[k].classList.remove('target');
    });
  }

  function hideFootprints() {
    clear(dom.footprints);
    clearTargets();
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

  /* ---------- selection and moves ---------- */

  function select(silent) {
    var h = state.round.hero;
    state.selected = true;
    state.moves = R.movesFor(state.round.board, h[0], h[1]);
    state.hero.classList.add('selected');
    replay(state.hero, 'bounce');
    showFootprints();
    if (!silent) S.play('select');
  }

  function findMove(r, c) {
    for (var i = 0; i < state.moves.length; i++) {
      if (state.moves[i].r === r && state.moves[i].c === c) return state.moves[i];
    }
    return null;
  }

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

  function move(mv) {
    state.busy = true;
    state.selected = false;
    hideFootprints();
    state.hero.classList.remove('selected');

    var from = state.round.hero;
    var to = [mv.r, mv.c];
    var plan = moveFrames(state.type, from, to);

    if (state.type === 'q') {
      var dist = Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]));
      for (var s = 1; s < dist; s++) {
        sparkle(from[0] + (to[0] - from[0]) * s / dist, from[1] + (to[1] - from[1]) * s / dist, s * 50);
      }
    }

    S.play('move-' + state.type);
    place(state.hero, to[0], to[1]);
    animate(state.hero, plan.frames, plan.duration, plan.easing, function () {
      land(from, to, mv);
    });
  }

  function land(from, to, mv) {
    var board = state.round.board;
    board[to[0]][to[1]] = board[from[0]][from[1]];
    board[from[0]][from[1]] = null;
    state.round.hero = to;

    if (mv.capture) {
      var foe = state.foes[key(to[0], to[1])];
      delete state.foes[key(to[0], to[1])];
      if (foe) {
        foe.classList.add('poof');
        later(function () { foe.remove(); }, 400);
      }
      sparkle(to[0], to[1], 0);
      S.play('capture');
    }

    var starIndex = -1;
    state.round.stars.forEach(function (s, i) {
      if (s[0] === to[0] && s[1] === to[1]) starIndex = i;
    });
    if (starIndex >= 0) {
      state.round.stars.splice(starIndex, 1);
      collectItem(to[0], to[1]);
    }

    if (state.round.stars.length === 0) {
      celebrate();
      return;
    }

    var changes = L.relocateStranded(state.round);
    changes.forEach(moveItem);

    later(function () {
      state.busy = false;
      select(true);
      armIdle();
    }, changes.length ? 650 : 120);
  }

  function collectItem(r, c) {
    var node = state.items[key(r, c)];
    delete state.items[key(r, c)];
    if (node) {
      node.classList.add('collect');
      later(function () { node.remove(); }, 450);
    }
    sparkle(r, c, 0);
    state.collected += 1;
    renderSlots(state.collected - 1);
    S.play('star');
  }

  // A star that can no longer be reached floats to a square that can.
  function moveItem(change) {
    var node = state.items[key(change.from[0], change.from[1])];
    delete state.items[key(change.from[0], change.from[1])];
    if (!node) return;
    if (!change.to) {
      node.remove();
      state.collected += 1;
      renderSlots(state.collected - 1);
      return;
    }
    var f = change.from;
    var t = change.to;
    state.items[key(t[0], t[1])] = node;
    place(node, t[0], t[1]);
    animate(node, [
      { transform: pos(f[0], f[1]) + ' scale(1)', opacity: 1 },
      { transform: pos(f[0], f[1]) + ' scale(0.2)', opacity: 0, offset: 0.45 },
      { transform: pos(t[0], t[1]) + ' scale(0.2)', opacity: 0, offset: 0.55 },
      { transform: pos(t[0], t[1]) + ' scale(1)', opacity: 1 }
    ], 600, 'ease-in-out');
  }

  function celebrate() {
    clearIdle();
    replay(state.hero, 'cheer');
    S.play('win');
    if (!reduceMotion) {
      for (var i = 0; i < 28; i++) confetto();
    }
    state.roundTimer = later(function () { startRound(state.type); }, NEXT_ROUND_MS);
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

  /* ---------- idle hints ---------- */

  function clearIdle() {
    window.clearTimeout(state.idleTimer);
  }

  function armIdle() {
    clearIdle();
    state.idleTimer = window.setTimeout(onIdle, IDLE_MS);
  }

  function onIdle() {
    if (!state.round || state.busy) return;
    if (state.selected) {
      pulseFootprints();
    } else {
      replay(state.hero, 'nudge');
    }
    armIdle();
  }

  /* ---------- input ---------- */

  function onBoardDown(e) {
    e.preventDefault();
    S.unlock();
    if (!state.round || state.busy) return;
    var rect = dom.board.getBoundingClientRect();
    var c = Math.floor((e.clientX - rect.left) / rect.width * 8);
    var r = Math.floor((e.clientY - rect.top) / rect.height * 8);
    if (!R.onBoard(r, c)) return;
    armIdle();

    var hero = state.round.hero;
    if (r === hero[0] && c === hero[1]) {
      select(false);
      return;
    }
    if (!state.selected) {
      replay(state.hero, 'nudge');
      S.play('nudge');
      return;
    }
    var mv = findMove(r, c);
    if (mv) {
      move(mv);
    } else {
      replay(state.hero, 'wiggle');
      pulseFootprints();
      S.play('bonk');
    }
  }

  /* ---------- start ---------- */

  function init() {
    layout();
    buildSquares();
    buildRail();
    window.addEventListener('resize', layout);
    window.addEventListener('orientationchange', layout);
    dom.board.addEventListener('pointerdown', onBoardDown);
    dom.board.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    startRound(state.type);
  }

  init();
})();
