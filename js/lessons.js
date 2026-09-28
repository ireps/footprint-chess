/*
 * Footprint Chess: lesson content for the "watch, then do" player.
 *
 * A lesson has a short watch script that plays on the real board (voice
 * lines, a ghost hand, moves, glows and landmark pulses), then a practice
 * list of tap tasks played from the same start position. No DOM: this file
 * only describes content, board.js and player.js turn it into animation.
 *
 * Terminology rule for every voice line, in every language: real chess
 * names only (rook, bishop, queen, king, knight, pawn, capture); never a
 * robot name; never "left", "right", or a square name like e4 (Telugu
 * ఎడమ "left" and కుడి "right" are also banned); edges are "the other
 * side" (row 0) and "your side" (row 7), never named directly in a voice
 * line. Enforced by tests/lessons.test.js.
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
   * Languages the app can speak. English is the default (the owner's
   * decision); Telugu is the alternative, chosen with ?lang=te. Anything
   * that needs "the current language, else the app default" should fall
   * back to DEFAULT_LANG, not to LANGS[0], so the two stay independent.
   */
  var LANGS = ['en', 'te'];
  var DEFAULT_LANG = 'en';

  /*
   * Real chess piece names, per language, keyed by the same one-letter
   * type used everywhere else in this app (see js/rules.js).
   */
  var PIECE_NAMES = {
    en: { r: 'Rook', b: 'Bishop', q: 'Queen', k: 'King', n: 'Knight', p: 'Pawn' },
    te: { r: 'ఏనుగు', b: 'ఒంటె', q: 'మంత్రి', k: 'రాజు', n: 'గుర్రం', p: 'భటుడు' }
  };

  /* The order pieces are introduced in, and the order "next piece" cycles through. */
  var TYPE_ORDER = ['r', 'b', 'q', 'k', 'n', 'p'];

  /*
   * Every voice line's text, in English and Telugu, exactly as agreed with
   * the owner (docs/VOICE-SCRIPT.md carries the same text, plus a delivery
   * note per line, and tests/lessons.test.js checks the two files match).
   */
  var RAW_LINES = {
    /* used outside lessons, by js/app.js (see APP_LINES below) */
    'pick': { en: 'Pick a chess piece to play with!', te: 'ఆడుకోవడానికి ఒక పావుని ఎంచుకో!' },
    'meet-r': { en: 'This is the rook.', te: 'ఇది ఏనుగు.' },
    'meet-b': { en: 'This is the bishop.', te: 'ఇది ఒంటె.' },
    'meet-q': { en: 'This is the queen.', te: 'ఇది మంత్రి.' },
    'meet-k': { en: 'This is the king.', te: 'ఇది రాజు.' },
    'meet-n': { en: 'This is the knight.', te: 'ఇది గుర్రం.' },
    'meet-p': { en: 'This is the pawn.', te: 'ఇది భటుడు.' },

    /* hello */
    'hello-1': { en: "Hello! Let's learn chess.", te: 'హలో! చదరంగం నేర్చుకుందాం.' },
    'hello-2': { en: 'Tap your piece to see its footprints.', te: 'నీ పావుని నొక్కు, దాని అడుగుల గుర్తులు కనిపిస్తాయి.' },
    'hello-3': { en: 'Tap a footprint, and off it goes!', te: 'ఒక అడుగు గుర్తుని నొక్కు, అది అక్కడికి వెళ్తుంది!' },

    /* rook */
    'rook-1': { en: 'The rook moves in straight lines.', te: 'ఏనుగు తిన్నగా మాత్రమే వెళ్తుంది.' },
    'rook-2': { en: 'It can go all the way toward the other side.', te: 'అది అవతలి వైపు దాకా వెళ్లగలదు.' },
    'rook-3': { en: 'Or straight across, just as far.', te: 'లేదా అడ్డంగా కూడా అంతే దూరం వెళ్లగలదు.' },

    /* bishop */
    'bishop-1': { en: 'The bishop moves on slanty lines.', te: 'ఒంటె వాలుగా మాత్రమే వెళ్తుంది.' },
    'bishop-2': { en: 'It always stays on its own colour.', te: 'అది ఎప్పుడూ తన రంగు గడుల మీదే ఉంటుంది.' },
    'bishop-3': { en: 'Watch it slide the other way.', te: 'చూడు, ఇప్పుడు ఇంకో వైపు జారుతుంది!' },

    /* queen */
    'queen-1': { en: 'The queen moves like the rook and the bishop together.', te: 'మంత్రి ఏనుగు లాగా, ఒంటె లాగా కూడా వెళ్తుంది.' },
    'queen-2': { en: 'Straight lines, like the rook.', te: 'ఏనుగు లాగా తిన్నగా.' },
    'queen-3': { en: 'And slanty lines, like the bishop.', te: 'ఒంటె లాగా వాలుగా కూడా.' },

    /* king */
    'king-1': { en: 'The king takes just one step.', te: 'రాజు ఒక్క అడుగు మాత్రమే వేస్తాడు.' },
    'king-2': { en: 'But it can step any way it likes.', te: 'కానీ ఏ వైపుకైనా వేయగలడు.' },
    'king-3': { en: 'Slow and careful, like a real king.', te: 'నెమ్మదిగా, జాగ్రత్తగా, నిజమైన రాజు లాగా.' },

    /* knight */
    'knight-1': { en: 'The knight moves in a special way.', te: 'గుర్రం ప్రత్యేకంగా కదులుతుంది.' },
    'knight-2': { en: 'Two squares, then one to the side.', te: 'రెండు గడులు, తర్వాత పక్కకి ఒకటి.' },
    'knight-3': { en: 'It can even jump over other pieces!', te: 'అది వేరే పావుల మీదుగా కూడా దూకగలదు!' },

    /* pawn */
    'pawn-1': { en: 'The pawn marches toward the other side.', te: 'భటుడు అవతలి వైపుకి ముందుకు నడుస్తాడు.' },
    'pawn-2': { en: 'Its very first step can be two squares.', te: 'మొదటి అడుగులో రెండు గడులు వెళ్లగలడు.' },
    'pawn-3': { en: 'After that, one small step at a time.', te: 'ఆ తర్వాత, ఒక్కోసారి ఒక్క అడుగే.' },

    /* capturing, shared by every capture-<type> lesson */
    'capture-1': { en: 'Look, a pawn from the other side!', te: 'చూడు, అవతలి వైపు భటుడు!' },
    'capture-2': { en: 'Move onto its square to capture it.', te: 'దాని గడిలోకి వెళ్ళి, దాన్ని పట్టుకో.' },
    'capture-3': { en: 'Captured! Now it is off the board.', te: 'పట్టేసింది! ఇప్పుడు అది బోర్డు మీద లేదు.' },

    /* pawn capturing, its own special case */
    'pawncap-1': { en: 'A pawn captures on the slant, one step ahead.', te: 'భటుడు ముందు వాలుగా ఉన్న గడిలో పట్టుకుంటాడు.' },
    'pawncap-2': { en: 'It cannot capture straight ahead.', te: 'తిన్నగా ఎదురుగా ఉన్నదాన్ని పట్టుకోలేడు.' },

    /* generic practice-flow lines, reused by every lesson, and by the app outside lessons */
    'your-turn': { en: 'Now you try!', te: 'ఇప్పుడు నువ్వు చెయ్యి!' },
    'tap-piece': { en: 'Tap your piece.', te: 'నీ పావుని నొక్కు.' },
    'tap-footprint': { en: 'Tap a footprint.', te: 'ఒక అడుగు గుర్తుని నొక్కు.' },
    'great': { en: 'Great job!', te: 'భలే! చాలా బాగుంది!' },

    /* used outside lessons, by js/app.js */
    'mission': { en: 'Capture all three pawns!', te: 'మూడు భటులనీ పట్టుకో!' },
    'hint-pawn': { en: 'Follow the footprints to a pawn.', te: 'అడుగుల గుర్తుల దారిలో భటుడి దగ్గరికి వెళ్ళు.' },
    'won': { en: 'You captured them all!', te: 'అందరినీ పట్టేశావు!' },
    'next': { en: 'Play again, or pick the next piece.', te: 'మళ్ళీ ఆడు, లేదా తర్వాతి పావుని ఎంచుకో.' }
  };

  /*
   * Estimated spoken length in ms (not a recording length): used to pace
   * the watch script before real recordings exist, and as a guard timer
   * once they do. About 60ms per English character (minimum 1100ms);
   * Telugu is usually longer spoken, so the estimate also takes 75ms per
   * Telugu character, and the line uses whichever estimate is longer.
   * Shared by both languages, since it only paces the animation.
   */
  function estimateLineMs(en, te) {
    var enMs = Math.max(1100, Math.round(en.length * 60));
    var teMs = Math.max(1100, Math.round(te.length * 75));
    return Math.max(enMs, teMs);
  }

  var LINES = {};
  Object.keys(RAW_LINES).forEach(function (id) {
    var line = RAW_LINES[id];
    LINES[id] = { en: line.en, te: line.te, ms: estimateLineMs(line.en, line.te) };
  });

  var PRACTICE_LINES = ['your-turn', 'tap-piece', 'tap-footprint', 'great'];

  /*
   * Ids of lines the app speaks outside of a lesson's watch script (home
   * screen, meet card, mission card, round idle hints, won card). Kept
   * here, next to LINES, so tests/lessons.test.js can confirm every line
   * in LINES is said by something - a lesson's watch script, a practice
   * task, or the app itself.
   */
  var APP_LINES = [
    'pick', 'meet-r', 'meet-b', 'meet-q', 'meet-k', 'meet-n', 'meet-p',
    'mission', 'hint-pawn', 'won', 'next', 'tap-piece', 'tap-footprint'
  ];

  var LESSONS = [
    {
      id: 'hello',
      type: 'r',
      title: 'Say hello',
      setup: { hero: [7, 4], foes: [] },
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
      title: 'Rook',
      setup: { hero: [7, 1], foes: [] },
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
      title: 'Bishop',
      setup: { hero: [7, 2], foes: [] },
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
      title: 'Queen',
      setup: { hero: [7, 3], foes: [] },
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
      title: 'King',
      setup: { hero: [7, 4], foes: [] },
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
      title: 'Knight',
      setup: { hero: [7, 1], foes: [[6, 1]] },
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
      id: 'pawn',
      type: 'p',
      title: 'Pawn',
      setup: { hero: [6, 3], foes: [] },
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

  /*
   * capture-<type> lessons: the hero starts a single legal move away from
   * a foe pawn, and the watch script narrates capturing it. Every lesson
   * built from this template shares the same three voice lines, so they
   * all take the same time to watch. The capture is shown twice: once
   * narrated, then once more quietly, with the hand tapping the piece and
   * then the pawn, so the child sees the exact taps before trying.
   */
  var CAPTURE_POSITIONS = {
    r: { hero: [7, 3], foe: [4, 3] },
    b: { hero: [7, 2], foe: [4, 5] },
    q: { hero: [7, 3], foe: [4, 6] },
    k: { hero: [7, 4], foe: [6, 4] },
    n: { hero: [7, 1], foe: [5, 2] }
  };
  function makeCaptureLesson(type, hero, foe) {
    return {
      id: 'capture-' + type,
      type: type,
      title: 'Capture: ' + PIECE_NAMES.en[type],
      setup: { hero: hero, foes: [foe] },
      watch: [
        { wait: 500 },
        { say: 'capture-1' },
        { glow: [foe] },
        { waitVoice: true },
        { select: true },
        { say: 'capture-2' },
        { hand: foe },
        { move: foe },
        { waitVoice: true },
        { say: 'capture-3' },
        { waitVoice: true },
        { wait: 400 },
        { reset: true },
        { hand: hero },
        { select: true },
        { hand: foe },
        { move: foe },
        { wait: 600 },
        { reset: true }
      ],
      practice: [
        { to: foe, accept: 'only' }
      ]
    };
  }

  TYPE_ORDER.filter(function (t) { return t !== 'p'; }).forEach(function (type) {
    var pos = CAPTURE_POSITIONS[type];
    LESSONS.push(makeCaptureLesson(type, pos.hero, pos.foe));
  });

  LESSONS.push({
    id: 'pawn-capture',
    type: 'p',
    title: 'Pawn capture',
    setup: { hero: [6, 3], foes: [[5, 3], [5, 4]] },
    watch: [
      { say: 'pawncap-1' },
      { select: true },
      { glow: [[5, 2], [5, 4]] },
      { waitVoice: true },
      { say: 'pawncap-2' },
      { glow: [[5, 3]] },
      { waitVoice: true },
      { glow: [] },
      { hand: [5, 4] },
      { move: [5, 4] },
      { say: 'capture-3' },
      { waitVoice: true },
      { reset: true },
      { hand: [6, 3] },
      { select: true },
      { hand: [5, 4] },
      { move: [5, 4] },
      { wait: 600 },
      { reset: true }
    ],
    practice: [
      { to: [5, 4], accept: 'only' }
    ]
  });

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
    (lesson.setup.foes || []).forEach(function (sq) {
      board[sq[0]][sq[1]] = { type: 'p', team: 'foe' };
    });
    return { board: board, hero: hero.slice() };
  }

  /*
   * Simulated watch duration in ms: t is "wall clock" time, voiceEnd is when
   * the most recently started line finishes. say sets voiceEnd but does not
   * itself advance t (voice plays while other things happen); waitVoice
   * catches t up to voiceEnd. Everything else has a fixed cost.
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

  /* 'rook' | 'bishop' | 'queen' | 'king' | 'knight' | 'pawn', the id of a type's introductory lesson. */
  var LESSON_FOR = { r: 'rook', b: 'bishop', q: 'queen', k: 'king', n: 'knight', p: 'pawn' };
  function lessonFor(type) {
    return LESSON_FOR[type] || null;
  }

  /* 'capture-<type>', or 'pawn-capture' for the pawn, the id of a type's capturing lesson. */
  function captureLessonFor(type) {
    return type === 'p' ? 'pawn-capture' : 'capture-' + type;
  }

  var api = {
    LANGS: LANGS,
    DEFAULT_LANG: DEFAULT_LANG,
    PIECE_NAMES: PIECE_NAMES,
    TYPE_ORDER: TYPE_ORDER,
    LINES: LINES,
    PRACTICE_LINES: PRACTICE_LINES,
    APP_LINES: APP_LINES,
    LESSONS: LESSONS,
    get: get,
    boardFor: boardFor,
    estimateWatchMs: estimateWatchMs,
    suggestMove: suggestMove,
    lineIds: lineIds,
    lessonFor: lessonFor,
    captureLessonFor: captureLessonFor
  };

  if (isNode) {
    module.exports = api;
  } else {
    root.FC = root.FC || {};
    root.FC.lessons = api;
  }
})(this);
