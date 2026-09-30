/*
 * Footprint Chess: board view (DOM, layout and animation only).
 * No round or lesson logic lives here; see js/app.js.
 * Depends on FC.rules, FC.lessons and FC.sound (loaded before this file).
 * DOM is built with createElement/textContent only (see SECURITY.md).
 */
(function () {
  'use strict';

  var FC = window.FC = window.FC || {};
  var R = FC.rules;
  var S = FC.sound;
  var T = FC.themes;
  var V = FC.voice;

  // The current theme id (js/themes.js THEMES/DEFAULT_THEME). Changed only
  // by setTheme(), which also updates the body class and every placed
  // piece's <use> href; the artwork and colours live in index.html's
  // sprite and css/app.css (see THEMES-SPEC in the repo history).
  var THEME = T.DEFAULT_THEME;
  // Real chess names are looked up from FC.lessons.PIECE_NAMES by callers
  // (app.js, player.js); this table only carries the look, not the words.
  var TYPE_ORDER = FC.lessons.TYPE_ORDER;
  var TYPES = {
    r: { color: '#f59e2e', tint: '#ffe7c7' },
    b: { color: '#ec5f99', tint: '#ffe0ee' },
    q: { color: '#9a6ce0', tint: '#ece2fb' },
    k: { color: '#f5d23b', tint: '#fff5c6' },
    n: { color: '#36c2ce', tint: '#d8f5f7' },
    p: { color: '#6ccb5f', tint: '#e1f6dc' }
  };
  var CONFETTI_COLORS = ['#f59e2e', '#ec5f99', '#9a6ce0', '#f5d23b', '#36c2ce', '#6ccb5f', '#ffffff'];
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Calm mode (the grown-ups' corner, js/grownups-ui.js): no board bump, at
  // most CALM_BURST_MAX bits in a capture burst, no full-screen confetti and
  // half the in-board confetti. Sound effects have their own switch in
  // FC.sound.setCalm; the grown-ups' corner sets both together.
  var CALM_BURST_MAX = 3;
  var calm = false;

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
    stripHome: byId('strip-home'),
    teamBarFar: byId('team-bar-far'),
    teamBarHome: byId('team-bar-home')
  };

  var onTap = null;

  // The ghost hand: one node, reused for travel/press/rest. Reset to null
  // whenever clearAll() empties #guide, so the next hand()/handRest() call
  // creates a fresh node instead of touching a detached one.
  var handNode = null;
  var handAt = null; // [r, c] the hand currently rests on/near, or null before its first show
  var handHideTimer = null; // pending "away" after hideHand(); cancelled if the hand shows again

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

  // A themed piece image: every piece drawing in the app (board pieces and
  // items, portrait, tiles, home cards, meet/mission/won cards, capture
  // slots) goes through this so a theme change only has to rewrite hrefs
  // and flip a body class (see setTheme). side is 'me' (the child's piece,
  // any type) or 'foe' (an opponent pawn; the app only ever places foe
  // pawns). data-pt records the type so setTheme can find and rewrite this
  // <use> later; the class records the side so css/app.css can colour it
  // per theme with --pc/--acc/etc.
  function pieceSvg(type, side) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', 'pc side-' + side);
    var use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('data-pt', type);
    use.setAttribute('href', '#' + THEME + '-' + type);
    svg.appendChild(use);
    return svg;
  }

  // A piece image fixed to themeId (not necessarily the current theme):
  // used for the home screen's theme swatches, which must keep showing
  // their own theme's art (and, for Space/Dinosaurs/Pirate, their own
  // theme's per-type --pc; see css/app.css) no matter which theme is
  // currently applied. data-pt is still set, so the same CSS colour rules
  // apply; data-fixed-theme marks it so setTheme()'s href rewrite skips it.
  function themedPieceSvg(themeId, type, side) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', 'pc side-' + side);
    var use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('data-pt', type);
    use.setAttribute('data-fixed-theme', themeId);
    use.setAttribute('href', '#' + themeId + '-' + type);
    svg.appendChild(use);
    return svg;
  }

  // Applies id (falling back to the default theme for an unknown id): a
  // body class other CSS rules key off (css/app.css), and every placed
  // piece image's href, so pieces already on screen change look at once.
  // Skips any [data-fixed-theme] (theme-swatch previews; see
  // themedPieceSvg), which must never track the currently applied theme.
  function setTheme(id) {
    THEME = T.isTheme(id) ? id : T.DEFAULT_THEME;
    var body = document.body;
    T.THEMES.forEach(function (theme) { body.classList.remove('theme-' + theme.id); });
    body.classList.add('theme-' + THEME);
    var uses = document.querySelectorAll('[data-pt]:not([data-fixed-theme])');
    for (var i = 0; i < uses.length; i++) {
      uses[i].setAttribute('href', '#' + THEME + '-' + uses[i].getAttribute('data-pt'));
    }
  }

  function getTheme() { return THEME; }

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

  // Waits for an animation or visual effect to end: under reduced motion
  // there is no motion to wait for, so the delay is capped. Use wait() for
  // anything that sets the pace of a lesson, a turn or a card.
  function later(fn, ms) {
    return window.setTimeout(fn, reduceMotion ? Math.min(ms, 60) : ms);
  }

  // A plain timer that reduced motion never shortens: lesson pauses, the
  // Meet card's minimum time, the bot's thinking pause and similar pacing.
  function wait(fn, ms) {
    return window.setTimeout(fn, ms);
  }

  // Run an animation, then call done exactly once (with a timer as a fallback).
  // always: run it even under reduced motion (a piece's plain slide, which
  // shows where it went; see moveHero).
  function animate(node, frames, duration, easing, done, always) {
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      if (done) done();
    }
    if ((reduceMotion && !always) || typeof node.animate !== 'function') {
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
    var pad = 16;      // .app padding
    var framePad = 24; // .scene padding, both sides
    var boardRows = 8 + 2 * 0.85; // board plus the two edge strips
    var cell;
    if (h > w) {
      // Portrait: scene above, panel below (a fixed-ish strip reserved for it).
      var panelH = 190;
      var gap = 12;
      cell = Math.min(
        (h - panelH - pad * 2 - gap - framePad) / boardRows,
        (w - pad * 2 - framePad) / 8
      );
    } else {
      // Landscape: scene and panel side by side.
      var panelW = 300;
      var gapL = 24;
      cell = Math.min(
        (h - pad * 2 - framePad) / boardRows,
        (w - panelW - pad * 2 - gapL - framePad) / 8
      );
    }
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

  // side defaults to 'me' (every existing caller - the hero in a lesson or
  // round - is always the child's own piece); games (js/games-ui.js) pass
  // an explicit side, since a game can place a child-controlled piece that
  // must render in the "other side" colours (Classic, when the child plays
  // Black - see js/games-ui.js childPieceSide).
  function addPiece(kind, r, c, side) {
    var node = document.createElement('div');
    node.className = 'piece';
    node.appendChild(pieceSvg(kind, side || 'me'));
    place(node, r, c);
    dom.pieces.appendChild(node);
    return node;
  }

  // An opponent piece (a capture-round/lesson target, or a game's foe
  // piece): type defaults to 'p' (every existing caller places a pawn) and
  // side defaults to 'foe'; js/games-ui.js passes an explicit type (the
  // 'catch' game's foe is a knight) and, for Classic when the child plays
  // Black, side 'me' (ivory), so the swap in js/games-ui.js's
  // childPieceSide/foePieceSide is honoured for both addPiece and addItem.
  function addItem(r, c, type, side) {
    var node = document.createElement('div');
    node.className = 'item';
    node.appendChild(pieceSvg(type || 'p', side || 'foe'));
    place(node, r, c);
    dom.items.appendChild(node);
    return node;
  }

  function clearAll() {
    [dom.footprints, dom.items, dom.pieces, dom.fx, dom.marks, dom.guide].forEach(clear);
    cancelHandHide();
    handNode = null;
    handAt = null;
  }

  /* ---------- footprints ---------- */

  // colorOverride (optional): one colour for every footprint, used by the
  // footprints quiz (js/games-ui.js), whose footprints must not give the
  // answer away by their colour.
  function showFootprints(type, hero, moves, itemsByKey, colorOverride) {
    hideFootprints(itemsByKey);
    // Every theme but Classic keeps today's per-type footprint colours,
    // matching the child's per-type piece colours (css/app.css); Classic
    // uses its own single footprint colour (--fp) instead, the same token
    // its panel portraits/tiles/home cards use.
    var color = colorOverride || (THEME === 'classic' ? 'var(--fp)' : TYPES[type].color);
    moves.forEach(function (m) {
      var dist = Math.max(Math.abs(m.r - hero[0]), Math.abs(m.c - hero[1]));
      var delay = (reduceMotion ? 0 : Math.min(dist * 55, 330)) + 'ms';
      var item = itemsByKey[key(m.r, m.c)];
      if (item) {
        // A reachable target (an opponent pawn) gets a dashed ring instead
        // of a footprint, so the pawn stays visible.
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
      // Careful shuffle: lean, step, lean back.
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

  // How much slower a move is in a "watch how to play" scene or a tip, so a
  // child can follow it (opts.slow).
  var SLOW_MOVE = 1.8;

  // Under reduced motion a piece still slides to its square, plainly: no
  // hop, lean, swoosh or bounce, but the path stays visible, since where a
  // piece can go is what the app teaches. The knight slides along its two
  // legs, the rest straight.
  function slideFrames(type, from, to) {
    var dr = to[0] - from[0];
    var dc = to[1] - from[1];
    var dist = Math.max(Math.abs(dr), Math.abs(dc));
    if (type === 'n') {
      var corner = Math.abs(dr) === 2 ? [from[0] + dr, from[1]] : [from[0], from[1] + dc];
      return {
        duration: 700,
        frames: [frame(from[0], from[1], 0, 0, 1, 0), frame(corner[0], corner[1], 0, 0, 1, 0.66), frame(to[0], to[1], 0, 0, 1, 1)]
      };
    }
    return {
      duration: Math.min(900, 300 + 120 * dist),
      frames: [frame(from[0], from[1], 0, 0, 1, 0), frame(to[0], to[1], 0, 0, 1, 1)]
    };
  }

  // opts.slow: a scene's pace (SLOW_MOVE times longer).
  function moveHero(node, type, from, to, done, opts) {
    var slow = (opts && opts.slow) ? SLOW_MOVE : 1;
    var plan = moveFrames(type, from, to);

    if (type === 'q') {
      var dist = Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]));
      for (var s = 1; s < dist; s++) {
        sparkle(from[0] + (to[0] - from[0]) * s / dist, from[1] + (to[1] - from[1]) * s / dist, s * 50 * slow);
      }
    }

    S.play('move-' + type);
    place(node, to[0], to[1]);
    if (reduceMotion) {
      var slide = slideFrames(type, from, to);
      animate(node, slide.frames, slide.duration * slow, 'ease-in-out', done, true);
      return;
    }
    animate(node, plan.frames, plan.duration * slow, plan.easing, done);
  }

  function poof(node) {
    node.classList.add('poof');
    later(function () { node.remove(); }, 400);
  }

  function confetto(container, size) {
    var node = document.createElement('div');
    node.className = 'bit';
    node.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    node.style.left = (4 + Math.random() * 92) + '%';
    node.style.top = (2 + Math.random() * 30) + '%';
    var spin = (Math.random() * 2 - 1) * 200;
    node.style.transform = 'rotate(' + spin + 'deg)';
    container.appendChild(node);
    var fall = 55 + Math.random() * 35;
    animate(node, [
      { transform: 'translateY(0) rotate(' + spin + 'deg)', opacity: 1 },
      { transform: 'translateY(' + fall + 'vh) rotate(' + (spin + 260) + 'deg)', opacity: 1, offset: 0.75 },
      { transform: 'translateY(' + (fall + 10) + 'vh) rotate(' + (spin + 300) + 'deg)', opacity: 0 }
    ], 1400 + Math.random() * 500, 'ease-in', function () { node.remove(); });
  }

  // In-board celebration burst (a round's own win moment), confined to the
  // board's fx layer so it sits behind any card that follows.
  function confettiInBoard(count) {
    if (reduceMotion) return;
    if (calm) count = Math.ceil(count / 2);
    for (var i = 0; i < count; i++) {
      later((function (i2) {
        return function () { boardConfetto(i2); };
      })(i), 0);
    }
  }

  function boardConfetto() {
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

  // Full-screen confetti for the Won card. Self-removing; safe to call
  // repeatedly (each call is its own overlay).
  function screenConfetti(count) {
    if (reduceMotion || calm) return;
    var layer = document.createElement('div');
    layer.className = 'confetti-burst';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
    for (var i = 0; i < count; i++) confetto(layer);
    later(function () { layer.remove(); }, 2200);
  }

  // A capture's "juice" burst (js/games-ui.js, and js/app.js's capture
  // rounds): a handful of confetti bits radiating from one board square,
  // sized to a cell rather than the whole board (compare boardConfetto,
  // used for a round/game's full win). transform/opacity only.
  function burstBit(host) {
    var node = document.createElement('div');
    node.className = 'confetti burst-bit';
    node.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    host.appendChild(node);
    var angle = Math.random() * Math.PI * 2;
    var size = dom.board.clientWidth / 8; // one cell, in px
    var reach = (0.6 + Math.random() * 0.5) * size;
    var dx = Math.cos(angle) * reach;
    var dy = Math.sin(angle) * reach;
    var spin = (Math.random() * 2 - 1) * 480;
    animate(node, [
      { transform: 'translate(-50%,-50%) translate(0px,0px) rotate(0deg)', opacity: 1 },
      { transform: 'translate(-50%,-50%) translate(' + dx + 'px,' + dy + 'px) rotate(' + spin + 'deg)', opacity: 1, offset: 0.7 },
      { transform: 'translate(-50%,-50%) translate(' + dx + 'px,' + (dy + 24) + 'px) rotate(' + spin + 'deg)', opacity: 0 }
    ], 650 + Math.random() * 250, 'ease-out', function () { node.remove(); });
  }

  function captureBurst(r, c, count) {
    if (reduceMotion) return;
    if (calm) count = Math.min(count, CALM_BURST_MAX);
    var host = document.createElement('div');
    host.className = 'burst-host';
    place(host, r, c);
    dom.fx.appendChild(host);
    for (var i = 0; i < count; i++) burstBit(host);
    later(function () { host.remove(); }, 950);
  }

  // A small board "bump" (translateY and back): part of a capture's juice.
  // Finite, transform only.
  function bump() {
    if (calm) return;
    replay(dom.board, 'bump');
  }

  function setCalm(value) { calm = !!value; }
  function isCalm() { return calm; }

  /* ---------- team bars (games, and the "turns" lesson) ---------- */

  // The team's entry in FC.themes.TEAMS, or null.
  function teamEntry(themeId, side) {
    var teams = T.TEAMS;
    return (teams && teams[themeId] && teams[themeId][side]) || null;
  }

  // FC.themes.TEAMS[themeId][side].<lang>, without the trailing "!" the
  // spoken team-pick lines use (js/lessons.js LINES['team-<id>-<side>']).
  // The current language's name, else the next language in its fallback
  // chain (js/langs.js). Falls back to a plain placeholder if TEAMS or the
  // theme id is somehow missing, so a team bar never shows nothing.
  function teamName(themeId, side) {
    var entry = teamEntry(themeId, side);
    if (!entry) return side === 'a' ? 'Team A' : 'Team B';
    var chain = FC.langs.fallbackChain(V.getLang());
    for (var i = 0; i < chain.length; i++) {
      if (entry[chain[i]]) return entry[chain[i]];
    }
    return side === 'a' ? 'Team A' : 'Team B';
  }

  // The mode badge's text while a team bar's foe side has the turn (see
  // js/player.js and js/games-ui.js): "<name>'s turn" in English,
  // "<name> వంతు" in Telugu. The wording is per language (turnOf in
  // js/langs.js); the team's optional possessive form for the current
  // language (TEAMS[..].of[lang]: Telugu మెరుపుల వంతు, not మెరుపులు వంతు)
  // is passed along with the name.
  function turnBadgeText(themeId, side) {
    var lang = V.getLang();
    var entry = teamEntry(themeId, side);
    var ofForm = entry && entry.of ? entry.of[lang] : undefined;
    return FC.langs.get(lang).turnOf(teamName(themeId, side), ofForm);
  }

  function buildTeamBar(container, name, pawnSide) {
    clear(container);
    var pawn = pieceSvg('p', pawnSide);
    pawn.classList.add('team-bar-pawn');
    container.appendChild(pawn);
    var label = document.createElement('span');
    label.className = 'team-bar-name';
    label.textContent = name;
    container.appendChild(label);
  }

  // opts: { far: { name, pawnSide }, home: { name, pawnSide }, active: 'far' | 'home' }.
  // Replaces the strip's plain piece-silhouette row with a team bar (pawn +
  // name); the active side is lit, the other dimmed. Used by games and the
  // "turns" lesson only (js/player.js, js/games-ui.js); every other lesson
  // and round leaves the strips in their normal state.
  function showTeamBars(opts) {
    if (!dom.teamBarFar || !dom.teamBarHome) return;
    buildTeamBar(dom.teamBarFar, opts.far.name, opts.far.pawnSide);
    buildTeamBar(dom.teamBarHome, opts.home.name, opts.home.pawnSide);
    dom.teamBarFar.hidden = false;
    dom.teamBarHome.hidden = false;
    dom.stripFar.classList.add('team-mode');
    dom.stripHome.classList.add('team-mode');
    setActiveTeamBar(opts.active);
  }

  function setActiveTeamBar(active) {
    if (!dom.teamBarFar || dom.teamBarFar.hidden) return;
    dom.teamBarFar.classList.toggle('lit', active === 'far');
    dom.teamBarFar.classList.toggle('dim', active !== 'far');
    dom.teamBarHome.classList.toggle('lit', active === 'home');
    dom.teamBarHome.classList.toggle('dim', active !== 'home');
  }

  function hideTeamBars() {
    if (!dom.teamBarFar || !dom.teamBarHome) return;
    dom.teamBarFar.hidden = true;
    dom.teamBarHome.hidden = true;
    dom.stripFar.classList.remove('team-mode');
    dom.stripHome.classList.remove('team-mode');
    clear(dom.teamBarFar);
    clear(dom.teamBarHome);
  }

  /* ---------- glow and landmark ---------- */

  // Highlight a set of squares (a soft ring/fill in the given colour). An
  // empty list clears them.
  function glow(squares, color) {
    clear(dom.marks);
    glowAdd(squares, color);
  }

  // Like glow, but keeps the glows already showing (the growing battle
  // shows the other side's last move and the pieces in danger together).
  function glowAdd(squares, color) {
    (squares || []).forEach(function (sq) {
      var node = document.createElement('div');
      node.className = 'glow';
      node.style.setProperty('--tc', color || 'var(--gold)');
      place(node, sq[0], sq[1]);
      dom.marks.appendChild(node);
    });
  }

  // Pulse the far or home edge strip. Finite (CSS handles the iteration
  // count) so nothing loops while the child is thinking.
  function landmark(edge) {
    var node = edge === 'home' ? dom.stripHome : dom.stripFar;
    if (node) replay(node, 'lit');
  }

  /* ---------- hand prints (left/right levels) ---------- */

  // The child's left and right hand prints at the two ends of their own
  // strip, shown only in the hand-print levels.
  function showHandPrints(on) {
    ['hand-left', 'hand-right'].forEach(function (id) {
      var node = byId(id);
      if (node) node.hidden = !on;
    });
  }

  // One hand print glows and grows for a moment (finite, see css/app.css).
  function flashHandPrint(side) {
    var node = byId(side === 'right' ? 'hand-right' : 'hand-left');
    if (!node) return;
    node.hidden = false;
    replay(node, 'lit');
  }

  /* ---------- ghost hand ---------- */

  function cancelHandHide() {
    if (handHideTimer !== null) {
      window.clearTimeout(handHideTimer);
      handHideTimer = null;
    }
  }

  function ensureHand() {
    cancelHandHide();
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
      // No travel animation to wait for, but the pause still shows the child
      // where the hand is before the lesson goes on: pacing, not motion.
      wait(function () { if (done) done(); }, 300);
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
    cancelHandHide();
    handHideTimer = later(function () {
      handHideTimer = null;
      node.classList.add('away');
    }, 220);
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

  /* ---------- who is in control ---------- */

  var mode = 'none';

  // mode: 'watch' (the app is showing; board taps do nothing), 'play' (the
  // child's turn) or 'none' (cards, home). text is the badge label in the
  // current language. A change of mode pops the badge; setting the same
  // mode again only updates the label (for a language switch).
  function setMode(next, text) {
    var scene = byId('scene');
    var badge = byId('mode-badge');
    if (!scene || !badge) return;
    var changed = next !== mode;
    mode = next;
    scene.classList.toggle('mode-watch', next === 'watch');
    scene.classList.toggle('mode-play', next === 'play');
    badge.hidden = next === 'none';
    badge.classList.toggle('watch', next === 'watch');
    badge.classList.toggle('play', next === 'play');
    byId('mode-text').textContent = text || '';
    byId('mode-icon-use').setAttribute('href', next === 'play' ? '#ic-hand' : '#ic-eye');
    if (changed && next !== 'none') {
      badge.classList.remove('nudge');
      replay(badge, 'pop');
    }
  }

  function getMode() { return mode; }

  // A tap while the app is showing: the badge wiggles ("not yet, watch").
  function nudgeMode() {
    var badge = byId('mode-badge');
    if (!badge || badge.hidden) return;
    badge.classList.remove('pop');
    replay(badge, 'nudge');
  }

  FC.board = {
    setMode: setMode,
    getMode: getMode,
    nudgeMode: nudgeMode,
    TYPES: TYPES,
    TYPE_ORDER: TYPE_ORDER,
    setTheme: setTheme,
    getTheme: getTheme,
    setCalm: setCalm,
    isCalm: isCalm,
    reduceMotion: reduceMotion,
    init: init,
    layout: layout,
    clearAll: clearAll,
    addPiece: addPiece,
    addItem: addItem,
    place: place,
    replay: replay,
    later: later,
    wait: wait,
    animate: animate,
    showFootprints: showFootprints,
    hideFootprints: hideFootprints,
    pulseFootprints: pulseFootprints,
    moveHero: moveHero,
    poof: poof,
    sparkle: sparkle,
    confetti: confettiInBoard,
    screenConfetti: screenConfetti,
    captureBurst: captureBurst,
    bump: bump,
    teamName: teamName,
    turnBadgeText: turnBadgeText,
    showTeamBars: showTeamBars,
    setActiveTeamBar: setActiveTeamBar,
    hideTeamBars: hideTeamBars,
    glow: glow,
    glowAdd: glowAdd,
    landmark: landmark,
    showHandPrints: showHandPrints,
    flashHandPrint: flashHandPrint,
    hand: hand,
    handRest: handRest,
    hideHand: hideHand,
    // Not pure board rendering, but app.js's home/panel screens (svgUse,
    // pieceSvg) and target-relocation animation (pos) need the same
    // primitives board.js already builds, so they are exposed here rather
    // than duplicated.
    svgUse: svgUse,
    pieceSvg: pieceSvg,
    themedPieceSvg: themedPieceSvg,
    pos: pos
  };
})();
