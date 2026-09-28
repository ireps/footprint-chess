/*
 * Footprint Chess: lesson content for the "watch, then do" player.
 *
 * A lesson has a short watch script that plays on the real board (voice
 * lines, a ghost hand, moves, glows and landmark pulses), then a practice
 * list of tap tasks played from the same start position. No DOM: this file
 * only describes content, board.js and player.js (stage 2, steps 1 and 4)
 * turn it into animation.
 *
 * Wording rule for every voice line: never "left", "right", or a square
 * name like e4. Say "toward the junkyard", "back toward the charging
 * station", "across", "slanty" instead. Enforced by tests/lessons.test.js.
 *
 * Classic script: exposes window.FC.lessons in the browser and
 * module.exports in Node. Keep to ES2017 syntax (see README, "Browser
 * support and coding rules").
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var R = isNode ? require('./rules.js') : root.FC.rules;

  /*
   * LINES: every voice line the lesson player can say. ms is an estimated
   * spoken length (not a recording length) used to pace the watch script
   * before real recordings exist, and as a guard timer once they do.
   */
  var LINES = {
    /* hello */
    'hello-1': { text: 'Meet your robot.', ms: 1400 },
    'hello-2': { text: 'Tap your robot to see its footprints.', ms: 2800 },
    'hello-3': { text: 'Tap a footprint, and off it goes!', ms: 2800 },

    /* rook: Rail bot */
    'rook-1': { text: 'Rail bot only moves in straight lines.', ms: 2500 },
    'rook-2': { text: 'It can glide all the way toward the junkyard.', ms: 3300 },
    'rook-3': { text: 'Or it can glide straight across, just as far.', ms: 3000 },

    /* bishop: Slide bot */
    'bishop-1': { text: 'Slide bot only moves on slanty lines.', ms: 2500 },
    'bishop-2': { text: 'It always stays on its own colour.', ms: 2500 },
    'bishop-3': { text: 'Watch it swoosh the other way.', ms: 2200 },

    /* queen: Star bot */
    'queen-1': { text: 'Star bot moves like Rail bot and Slide bot together.', ms: 3300 },
    'queen-2': { text: 'Straight lines, just like Rail bot.', ms: 2200 },
    'queen-3': { text: 'And slanty lines too, with sparkles!', ms: 2200 },

    /* king: Sleepy bot */
    'king-1': { text: 'Sleepy bot only takes one little step.', ms: 2500 },
    'king-2': { text: 'But it can step any way it likes.', ms: 2700 },
    'king-3': { text: 'Then it needs a little rest.', ms: 2200 },

    /* knight: Spring bot */
    'knight-1': { text: 'Spring bot hops in a special shape.', ms: 2500 },
    'knight-2': { text: 'It hops two, then one to the side.', ms: 2700 },
    'knight-3': { text: 'It can even jump over junk bots!', ms: 2700 },

    /* bump: capturing a junk bot */
    'bump-1': { text: 'Uh oh, a junk bot is in the way!', ms: 3000 },
    'bump-2': { text: 'Land on it, and bump! It is gone.', ms: 2700 },
    'bump-3': { text: 'See? The way is clear now.', ms: 2500 },

    /* pawn: Mini bot */
    'pawn-1': { text: 'Mini bot marches straight toward the junkyard.', ms: 2500 },
    'pawn-2': { text: 'Its very first step can be two squares.', ms: 2700 },
    'pawn-3': { text: 'After that, just one small step at a time.', ms: 3300 },

    /* generic practice-flow lines, reused by every lesson */
    'your-turn': { text: 'Now you try!', ms: 1400 },
    'tap-robot': { text: 'Tap your robot.', ms: 1400 },
    'tap-footprint': { text: 'Tap a footprint.', ms: 1400 },
    'great': { text: 'Great job!', ms: 1100 }
  };

  var PRACTICE_LINES = ['your-turn', 'tap-robot', 'tap-footprint', 'great'];

  var LESSONS = [
    {
      id: 'hello',
      type: 'r',
      title: 'Say hello',
      setup: { hero: [7, 4], junk: [] },
      watch: [
        { wait: 600 },
        { say: 'hello-1' },
        { waitVoice: true },
        { wait: 500 },
        { say: 'hello-2' },
        { hand: [7, 4] },
        { select: true },
        { waitVoice: true },
        { wait: 800 },
        { say: 'hello-3' },
        { hand: [5, 4] },
        { move: [5, 4] },
        { waitVoice: true },
        { select: true },
        { hand: [5, 1] },
        { move: [5, 1] },
        { wait: 600 },
        { reset: true }
      ],
      practice: [
        { to: [5, 4], accept: 'any' }
      ]
    },
    {
      id: 'rook',
      type: 'r',
      title: 'Rail bot',
      setup: { hero: [7, 1], junk: [] },
      watch: [
        { say: 'rook-1' },
        { waitVoice: true },
        { select: true },
        { say: 'rook-2' },
        { landmark: 'far' },
        { waitVoice: true },
        { hand: [1, 1] },
        { move: [1, 1] },
        { wait: 300 },
        { reset: true },
        { select: true },
        { say: 'rook-3' },
        { waitVoice: true },
        { hand: [7, 6] },
        { move: [7, 6] }
      ],
      practice: [
        { to: [1, 1], accept: 'any' }
      ]
    },
    {
      id: 'bishop',
      type: 'b',
      title: 'Slide bot',
      setup: { hero: [7, 2], junk: [] },
      watch: [
        { say: 'bishop-1' },
        { waitVoice: true },
        { select: true },
        { glow: [[6, 3], [5, 4], [4, 5], [3, 6], [2, 7], [6, 1], [5, 0]] },
        { say: 'bishop-2' },
        { waitVoice: true },
        { hand: [4, 5] },
        { move: [4, 5] },
        { wait: 300 },
        { reset: true },
        { select: true },
        { say: 'bishop-3' },
        { waitVoice: true },
        { hand: [5, 0] },
        { move: [5, 0] }
      ],
      practice: [
        { to: [4, 5], accept: 'any' }
      ]
    },
    {
      id: 'queen',
      type: 'q',
      title: 'Star bot',
      setup: { hero: [7, 3], junk: [] },
      watch: [
        { say: 'queen-1' },
        { waitVoice: true },
        { select: true },
        { say: 'queen-2' },
        { waitVoice: true },
        { hand: [2, 3] },
        { move: [2, 3] },
        { wait: 300 },
        { reset: true },
        { select: true },
        { say: 'queen-3' },
        { waitVoice: true },
        { hand: [4, 0] },
        { move: [4, 0] }
      ],
      practice: [
        { to: [2, 3], accept: 'any' },
        { to: [4, 1], accept: 'any' }
      ]
    },
    {
      id: 'king',
      type: 'k',
      title: 'Sleepy bot',
      setup: { hero: [7, 4], junk: [] },
      watch: [
        { say: 'king-1' },
        { waitVoice: true },
        { select: true },
        { hand: [6, 4] },
        { move: [6, 4] },
        { wait: 300 },
        { reset: true },
        { say: 'king-2' },
        { waitVoice: true },
        { select: true },
        { hand: [6, 5] },
        { move: [6, 5] },
        { say: 'king-3' },
        { waitVoice: true }
      ],
      practice: [
        { to: [6, 4], accept: 'any' }
      ]
    },
    {
      id: 'knight',
      type: 'n',
      title: 'Spring bot',
      setup: { hero: [7, 1], junk: [[6, 1]] },
      watch: [
        { say: 'knight-1' },
        { waitVoice: true },
        { select: true },
        { wait: 400 },
        { say: 'knight-2' },
        { hand: [5, 2] },
        { move: [5, 2] },
        { waitVoice: true },
        { wait: 300 },
        { reset: true },
        { select: true },
        { say: 'knight-3' },
        { waitVoice: true },
        { hand: [5, 0] },
        { move: [5, 0] }
      ],
      practice: [
        { to: [5, 2], accept: 'any' }
      ]
    },
    {
      id: 'bump',
      type: 'r',
      title: 'Bump!',
      setup: { hero: [7, 4], junk: [[4, 4]] },
      watch: [
        { say: 'bump-1' },
        { waitVoice: true },
        { select: true },
        { wait: 400 },
        { say: 'bump-2' },
        { waitVoice: true },
        { hand: [4, 4] },
        { move: [4, 4] },
        { wait: 300 },
        { say: 'bump-3' },
        { waitVoice: true }
      ],
      practice: [
        { to: [4, 4], accept: 'only' }
      ]
    },
    {
      id: 'pawn',
      type: 'p',
      title: 'Mini bot',
      setup: { hero: [6, 3], junk: [] },
      watch: [
        { say: 'pawn-1' },
        { waitVoice: true },
        { select: true },
        { landmark: 'far' },
        { say: 'pawn-2' },
        { waitVoice: true },
        { hand: [4, 3] },
        { move: [4, 3] },
        { wait: 300 },
        { say: 'pawn-3' },
        { waitVoice: true },
        { select: true },
        { hand: [3, 3] },
        { move: [3, 3] }
      ],
      practice: [
        { to: [4, 3], accept: 'any' },
        { to: [3, 3], accept: 'any' }
      ]
    }
  ];

  var STEP_MS = { hand: 900, move: 700, select: 300, unselect: 300, reset: 300 };

  function get(id) {
    for (var i = 0; i < LESSONS.length; i++) {
      if (LESSONS[i].id === id) return LESSONS[i];
    }
    return null;
  }

  /* Fresh { board, hero } built from a lesson's setup, for FC.rules.movesFor. */
  function boardFor(lesson) {
    var board = R.emptyBoard();
    var hero = lesson.setup.hero;
    board[hero[0]][hero[1]] = { type: lesson.type, team: 'me' };
    (lesson.setup.junk || []).forEach(function (sq) {
      board[sq[0]][sq[1]] = { type: 'x', team: 'foe' };
    });
    return { board: board, hero: hero.slice() };
  }

  /*
   * Simulated watch duration in ms: t is "wall clock" time, voiceEnd is when
   * the most recently started line finishes. say sets voiceEnd but does not
   * itself advance t (voice plays while other things happen); waitVoice
   * catches t up to voiceEnd. Everything else has a fixed cost. See
   * STAGE2-SPEC.md for the exact model.
   */
  function estimateWatchMs(lesson) {
    var t = 0;
    var voiceEnd = 0;
    lesson.watch.forEach(function (step) {
      if (step.say) {
        var line = LINES[step.say];
        voiceEnd = t + (line ? line.ms : 0);
      } else if (step.waitVoice) {
        t = Math.max(t, voiceEnd);
      } else if (typeof step.wait === 'number') {
        t += step.wait;
      } else if (step.hand) {
        t += STEP_MS.hand;
      } else if (step.move) {
        t += STEP_MS.move;
      } else if (step.select) {
        t += STEP_MS.select;
      } else if (step.unselect) {
        t += STEP_MS.unselect;
      } else if (step.reset) {
        t += STEP_MS.reset;
      }
      // handAway, glow and landmark steps have no time cost.
    });
    return Math.max(t, voiceEnd);
  }

  /*
   * [r, c]: preferred if it is a legal move for the hero, else a legal
   * capture, else the legal move closest to row 0 (the far edge). Ties are
   * broken by column so the result is deterministic.
   */
  function suggestMove(board, hero, preferred) {
    var moves = R.movesFor(board, hero[0], hero[1]);
    if (!moves.length) return null;
    if (preferred) {
      for (var i = 0; i < moves.length; i++) {
        if (moves[i].r === preferred[0] && moves[i].c === preferred[1]) {
          return [preferred[0], preferred[1]];
        }
      }
    }
    var sorted = moves.slice().sort(function (a, b) {
      return a.r - b.r || a.c - b.c;
    });
    var captures = sorted.filter(function (m) { return m.capture; });
    var pick = captures.length ? captures[0] : sorted[0];
    return [pick.r, pick.c];
  }

  /* Ids of the voice lines a lesson's watch script says, in first-use order. */
  function lineIds(lesson) {
    var ids = [];
    lesson.watch.forEach(function (step) {
      if (step.say && ids.indexOf(step.say) === -1) ids.push(step.say);
    });
    return ids;
  }

  var api = {
    LINES: LINES,
    PRACTICE_LINES: PRACTICE_LINES,
    LESSONS: LESSONS,
    get: get,
    boardFor: boardFor,
    estimateWatchMs: estimateWatchMs,
    suggestMove: suggestMove,
    lineIds: lineIds
  };

  if (isNode) {
    module.exports = api;
  } else {
    root.FC = root.FC || {};
    root.FC.lessons = api;
  }
})(this);
