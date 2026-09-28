/*
 * Footprint Chess: star rounds, the rail, and the ready/lesson/round flow.
 * Depends on FC.rules, FC.levels, FC.lessons, FC.sound, FC.board and
 * FC.player (loaded before this file).
 * DOM is built with createElement/textContent only (see SECURITY.md).
 */
(function () {
  'use strict';

  var FC = window.FC;
  var R = FC.rules;
  var L = FC.levels;
  var LS = FC.lessons;
  var S = FC.sound;
  var B = FC.board;
  var P = FC.player;

  var THEME = B.THEME;
  var TYPE_ORDER = B.TYPE_ORDER;
  var TYPES = B.TYPES;
  var svgUse = B.svgUse;
  var place = B.place;
  var replay = B.replay;
  var later = B.later;
  var animate = B.animate;
  var pos = B.pos;

  var IDLE_MS = 5000;
  var NEXT_ROUND_MS = 1500;

  // type -> lesson id. hello and bump are not reached through this map: hello
  // plays once at the very start, bump plays after a non-pawn star round win.
  var LESSON_ID = { r: 'rook', b: 'bishop', q: 'queen', k: 'king', n: 'knight', p: 'pawn' };

  var dom = {
    stars: byId('stars'),
    characters: byId('characters'),
    sound: byId('sound-toggle'),
    lessonReplay: byId('lesson-replay'),
    lessonSkip: byId('lesson-skip')
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

  // 'ready' (page just loaded, hello has not started), 'lesson' (a lesson is
  // watching or practicing on the board) or 'round' (a star round is live).
  var mode = 'ready';
  var seen = {};          // lesson id -> true, once it has started this page load
  var activeLesson = null; // the lesson currently playing, while mode === 'lesson'
  var pendingOnDone = null; // that lesson's onDone, so Replay can restart it exactly

  /* ---------- helpers ---------- */

  function byId(id) { return document.getElementById(id); }
  function key(r, c) { return r + ',' + c; }

  /* ---------- static UI ---------- */

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
        onCharacterTap(type);
      });
      dom.characters.appendChild(btn);
    });

    dom.lessonReplay.addEventListener('click', onReplay);
    dom.lessonSkip.addEventListener('click', onSkip);

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

  // Skip is visible only in 'ready' or 'lesson' mode; Replay is always shown.
  function updateToolButtons() {
    dom.lessonSkip.hidden = mode === 'round';
  }

  /* ---------- lesson <-> round flow ---------- */

  function playLesson(lesson, onDone) {
    window.clearTimeout(state.roundTimer);
    clearIdle();
    state.round = null;
    state.busy = false;
    state.selected = false;
    state.collected = 0;
    renderSlots(-1);
    mode = 'lesson';
    activeLesson = lesson;
    pendingOnDone = onDone;
    seen[lesson.id] = true;
    markActive(lesson.type);
    updateToolButtons();
    P.start(lesson, { onDone: onDone });
  }

  function finishLessonToRound(type) {
    P.stop();
    activeLesson = null;
    pendingOnDone = null;
    mode = 'round';
    updateToolButtons();
    startRound(type);
  }

  // Plays the type's lesson first if it has not been seen this page load,
  // otherwise goes straight to its star round.
  function playOrRound(type) {
    var id = LESSON_ID[type];
    if (!seen[id]) {
      playLesson(LS.get(id), function () { finishLessonToRound(type); });
    } else {
      finishLessonToRound(type);
    }
  }

  function startHello() {
    playLesson(LS.get('hello'), function () { playOrRound('r'); });
  }

  function onCharacterTap(type) {
    P.stop();
    window.clearTimeout(state.roundTimer);
    clearIdle();
    markActive(type);
    playOrRound(type);
  }

  function onReplay() {
    S.unlock();
    if (P.active()) {
      playLesson(activeLesson, pendingOnDone);
      return;
    }
    var type = state.type;
    playLesson(LS.get(LESSON_ID[type]), function () { finishLessonToRound(type); });
  }

  // Which piece type Skip should jump to: the active lesson's own type,
  // except bump (always type 'r') resumes the round it interrupted, and
  // ready mode (no lesson started yet: the hello lesson is implicitly next)
  // goes to rook, same as hello's own type.
  function typeForSkip() {
    if (activeLesson) {
      return activeLesson.id === 'bump' ? state.type : activeLesson.type;
    }
    return mode === 'ready' ? 'r' : state.type;
  }

  function onSkip() {
    S.unlock();
    if (mode === 'round') return;
    var type = typeForSkip();
    finishLessonToRound(type);
  }

  /* ---------- board taps ---------- */

  function onBoardTap(r, c) {
    if (mode === 'ready') {
      startHello();
      return;
    }
    if (mode === 'lesson') {
      P.handleTap(r, c);
      return;
    }
    onRoundTap(r, c);
  }

  /* ---------- rounds ---------- */

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
    B.clearAll();
    markActive(type);
    renderSlots(-1);

    var board = state.round.board;
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var cell = board[r][c];
        if (!cell) continue;
        if (cell.team === 'me') {
          state.hero = B.addPiece(cell.type, r, c);
        } else {
          state.foes[key(r, c)] = B.addPiece(cell.type, r, c);
        }
      }
    }
    state.round.stars.forEach(function (s) {
      state.items[key(s[0], s[1])] = B.addItem(s[0], s[1]);
    });
    replay(state.hero, 'enter');
    armIdle();
  }

  /* ---------- selection and moves ---------- */

  function select(silent) {
    var h = state.round.hero;
    state.selected = true;
    state.moves = R.movesFor(state.round.board, h[0], h[1]);
    state.hero.classList.add('selected');
    replay(state.hero, 'bounce');
    B.showFootprints(state.type, h, state.moves, state.items);
    if (!silent) S.play('select');
  }

  function findMove(r, c) {
    for (var i = 0; i < state.moves.length; i++) {
      if (state.moves[i].r === r && state.moves[i].c === c) return state.moves[i];
    }
    return null;
  }

  function move(mv) {
    state.busy = true;
    state.selected = false;
    B.hideFootprints(state.items);
    state.hero.classList.remove('selected');

    var from = state.round.hero;
    var to = [mv.r, mv.c];

    B.moveHero(state.hero, state.type, from, to, function () {
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
        B.poof(foe);
      }
      B.sparkle(to[0], to[1], 0);
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
    B.sparkle(r, c, 0);
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
    B.confetti(28);
    var type = state.type;
    state.roundTimer = later(function () {
      if (type !== 'p' && !seen.bump) {
        playLesson(LS.get('bump'), function () { finishLessonToRound(type); });
      } else {
        startRound(type);
      }
    }, NEXT_ROUND_MS);
  }

  /* ---------- idle hints (star rounds only; the lesson player has its own) ---------- */

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
      B.pulseFootprints();
    } else {
      replay(state.hero, 'nudge');
    }
    armIdle();
  }

  /* ---------- star-round input ---------- */

  function onRoundTap(r, c) {
    if (!state.round || state.busy) return;
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
      B.pulseFootprints();
      S.play('bonk');
    }
  }

  /* ---------- start ---------- */

  function init() {
    B.init(onBoardTap);
    buildRail();
    updateToolButtons();
    P.prepare(LS.get('hello'));
    mode = 'ready';
  }

  init();
})();
