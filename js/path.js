/*
 * Footprint Chess: the learning journey on Home, as data and rules (no DOM).
 *
 * Home is a path of steps split into parts, each part one screen
 * (js/path-ui.js draws it), in teaching order: the line pieces, the stepping
 * and jumping pieces, playing together, thinking ahead, the other side's
 * view, keeping the king safe, and the growing battle. It is the only way
 * into the lessons and games: every game in js/game-list.js is a step,
 * exactly once (tested). A step is a piece (its lessons and capture round),
 * the "Taking turns" lesson, or a game; a game with its own lesson
 * (js/game-list.js `lesson`) still plays it first, the first time.
 *
 * The suggested next step is a piece marked "practise again" if there is
 * one, otherwise the first step the current child has not done, in path
 * order; nothing is ever locked, the suggestion only glows. A step counts
 * as done when:
 *   a piece   the child wins a capture round with it;
 *   turns     the "Taking turns" lesson has been watched (or skipped);
 *   a game    the child wins it, in any theme.
 * Progress is kept per child by js/store.js (progress.done, progress.last,
 * progress.practise).
 *
 * New games, quizzes and lessons join the path here, as data, in teaching
 * order: a step in a part, or a new part. Never as a loose card elsewhere.
 *
 * Classic script: exposes window.FC.path in the browser and module.exports
 * in Node. Keep to ES2017 syntax (see README, "Browser support and coding
 * rules").
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var GL = isNode ? require('./game-list.js') : root.FC.gameList;

  var PIECES = ['r', 'b', 'q', 'k', 'n', 'p'];

  /*
   * The parts, in order. pic: the part button's picture (no words for the
   * child): [piece type, side] pairs drawn in the current theme's art,
   * ['ic-...'] for an icon from the sprite in index.html, or ['row:<row>']
   * for a row picture from js/game-pics.js.
   */
  var CHAPTERS = [
    // Lines: the rook, the bishop, and the queen who moves like both.
    { id: 'lines', pic: [['r', 'me'], ['b', 'me'], ['q', 'me']], stops: ['r', 'b', 'q', 'whose'] },
    // Steps and jumps: the short-move pieces.
    { id: 'steps', pic: [['k', 'me'], ['n', 'me'], ['p', 'me']], stops: ['k', 'n', 'p'] },
    // Playing together, against the other team.
    { id: 'play', pic: [['p', 'me'], ['p', 'foe']], stops: ['turns', 'catch', 'race', 'chain', 'battle'] },
    // Think ahead: moving well, left and right, the opening, good captures.
    { id: 'think', pic: [['ic-bulb']], stops: ['hop', 'way', 'stop', 'hands', 'opening', 'value'] },
    // Their side: the other side's view.
    { id: 'pond', pic: [['row:pond']], stops: ['theirs', 'danger', 'run'] },
    // Protect your king: safety, check and checkmate.
    { id: 'king', pic: [['row:king']], stops: ['safe', 'escape', 'mate', 'stale', 'mate2'] },
    // The growing battle, up to the full game.
    { id: 'army', pic: [['row:army']], stops: ['army1', 'army2', 'army3', 'army4', 'army5', 'army6', 'army7'] }
  ];

  var ORDER = [];
  CHAPTERS.forEach(function (ch) { ORDER = ORDER.concat(ch.stops); });

  function isStop(id) { return typeof id === 'string' && ORDER.indexOf(id) !== -1; }

  // 'piece', 'lesson' (Taking turns) or 'game' (anything in js/game-list.js).
  function kindOf(id) {
    if (!isStop(id)) return null;
    if (PIECES.indexOf(id) !== -1) return 'piece';
    if (id === 'turns') return 'lesson';
    return 'game';
  }

  // The index of the part holding a step, or -1.
  function chapterOf(id) {
    for (var i = 0; i < CHAPTERS.length; i++) {
      if (CHAPTERS[i].stops.indexOf(id) !== -1) return i;
    }
    return -1;
  }

  function doneMap(progress) {
    return (progress && progress.done && typeof progress.done === 'object') ? progress.done : {};
  }

  function isDone(progress, id) { return doneMap(progress)[id] === true; }

  function chapterDone(progress, index) {
    var ch = CHAPTERS[index];
    return !!ch && ch.stops.every(function (id) { return isDone(progress, id); });
  }

  function allDone(progress) {
    return ORDER.every(function (id) { return isDone(progress, id); });
  }

  // The step after id in path order, wrapping round to the first.
  function after(id) {
    var i = ORDER.indexOf(id);
    return ORDER[(i + 1) % ORDER.length];
  }

  // Pieces marked "practise again" (a quiz had to show their move), in path
  // order.
  function practiseList(progress) {
    var map = (progress && progress.practise && typeof progress.practise === 'object') ? progress.practise : {};
    return ORDER.filter(function (id) { return kindOf(id) === 'piece' && map[id] === true; });
  }

  function needsPractice(progress, id) { return practiseList(progress).indexOf(id) !== -1; }

  // The suggested next step: a piece to practise again, else the first step
  // not done, in path order. Once every step is done, the one after the last
  // step played (progress.last), so the suggestion keeps moving along the path.
  function nextStop(progress) {
    var again = practiseList(progress);
    if (again.length) return again[0];
    for (var i = 0; i < ORDER.length; i++) {
      if (!isDone(progress, ORDER[i])) return ORDER[i];
    }
    var last = progress && progress.last;
    return isStop(last) ? after(last) : ORDER[0];
  }

  // What a Won card offers as "next" after finishing step id: the suggested
  // next step, or, once every step is done, the one after id.
  function nextAfter(progress, id) {
    if (practiseList(progress).length || !allDone(progress)) return nextStop(progress);
    return isStop(id) ? after(id) : ORDER[0];
  }

  /*
   * The done steps for progress saved before the path existed (no "done"
   * yet): a piece whose round was started (met), the "Taking turns" lesson
   * if seen, a game won in any theme. Used once by js/store.js; generous on
   * purpose, so a child keeps the ticks they earned.
   */
  function legacyDone(p) {
    var out = {};
    var met = (p && p.met) || {};
    var seen = (p && p.seen) || {};
    var wins = (p && p.wins) || {};
    ORDER.forEach(function (id) {
      var kind = kindOf(id);
      if (kind === 'piece' && met[id] === true) out[id] = true;
      if (kind === 'lesson' && seen[id] === true) out[id] = true;
    });
    Object.keys(wins).forEach(function (k) {
      var game = k.split(':')[1];
      if (wins[k] === true && kindOf(game) === 'game') out[game] = true;
    });
    return out;
  }

  var api = {
    CHAPTERS: CHAPTERS,
    STOP_IDS: ORDER.slice(),
    isStop: isStop,
    kindOf: kindOf,
    chapterOf: chapterOf,
    isDone: isDone,
    chapterDone: chapterDone,
    allDone: allDone,
    after: after,
    practiseList: practiseList,
    needsPractice: needsPractice,
    nextStop: nextStop,
    nextAfter: nextAfter,
    legacyDone: legacyDone
  };

  if (isNode) {
    module.exports = api;
  } else {
    root.FC = root.FC || {};
    root.FC.path = api;
  }
})(this);
