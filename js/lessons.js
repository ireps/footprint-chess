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
 * name like e4, in English or Telugu (Telugu ఎడమ "left" and కుడి "right"
 * are also banned). Say "toward the junkyard", "back toward the charging
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
   * Languages the app can speak. English is the default (the owner's
   * decision); Telugu is the alternative, chosen with ?lang=te. Anything
   * that needs "the current language, else the app default" should fall
   * back to DEFAULT_LANG, not to LANGS[0], so the two stay independent.
   */
  var LANGS = ['en', 'te'];
  var DEFAULT_LANG = 'en';

  /*
   * LINES: every voice line the lesson player can say, in both languages.
   * ms is an estimated spoken length (not a recording length) used to pace
   * the watch script before real recordings exist, and as a guard timer
   * once they do. It is shared by both languages: close enough for pacing,
   * and simpler than keeping two estimates in sync.
   */
  var LINES = {
    /* hello */
    'hello-1': { en: 'Meet your robot.', te: 'ఇదిగో, నీ రోబో!', ms: 1400 },
    'hello-2': { en: 'Tap your robot to see its footprints.', te: 'నీ రోబోని నొక్కు, దాని అడుగుల గుర్తులు కనిపిస్తాయి.', ms: 2800 },
    'hello-3': { en: 'Tap a footprint, and off it goes!', te: 'ఒక అడుగు గుర్తుని నొక్కు, అది అక్కడికి వెళ్తుంది!', ms: 2800 },

    /* rook: Rail bot */
    'rook-1': { en: 'Rail bot only moves in straight lines.', te: 'రైల్ బాట్ ఎప్పుడూ తిన్నగానే వెళ్తుంది.', ms: 2500 },
    'rook-2': { en: 'It can glide all the way toward the junkyard.', te: 'అది జంక్ యార్డ్ వైపు సాఫీగా చాలా దూరం వెళ్లగలదు.', ms: 3300 },
    'rook-3': { en: 'Or it can glide straight across, just as far.', te: 'లేదా అడ్డంగా కూడా అంతే దూరం వెళ్లగలదు.', ms: 3000 },

    /* bishop: Slide bot */
    'bishop-1': { en: 'Slide bot only moves on slanty lines.', te: 'స్లైడ్ బాట్ ఎప్పుడూ వాలుగానే వెళ్తుంది.', ms: 2500 },
    'bishop-2': { en: 'It always stays on its own colour.', te: 'అది ఎప్పుడూ తన రంగు గడుల మీదే ఉంటుంది.', ms: 2500 },
    'bishop-3': { en: 'Watch it swoosh the other way.', te: 'చూడు, ఇప్పుడు ఇంకో వైపు జారుతుంది!', ms: 2200 },

    /* queen: Star bot */
    'queen-1': { en: 'Star bot moves like Rail bot and Slide bot together.', te: 'స్టార్ బాట్ రైల్ బాట్ లాగా, స్లైడ్ బాట్ లాగా కూడా వెళ్తుంది.', ms: 3300 },
    'queen-2': { en: 'Straight lines, just like Rail bot.', te: 'రైల్ బాట్ లాగా తిన్నగా.', ms: 2200 },
    'queen-3': { en: 'And slanty lines too, with sparkles!', te: 'వాలుగా కూడా, మెరుపులతో!', ms: 2200 },

    /* king: Sleepy bot */
    'king-1': { en: 'Sleepy bot only takes one little step.', te: 'స్లీపీ బాట్ ఒక్క చిన్న అడుగు మాత్రమే వేస్తుంది.', ms: 2500 },
    'king-2': { en: 'But it can step any way it likes.', te: 'కానీ ఏ వైపుకైనా వేయగలదు.', ms: 2700 },
    'king-3': { en: 'Then it needs a little rest.', te: 'తర్వాత దానికి కొంచెం విశ్రాంతి కావాలి.', ms: 2200 },

    /* knight: Spring bot */
    'knight-1': { en: 'Spring bot hops in a special shape.', te: 'స్ప్రింగ్ బాట్ ప్రత్యేకంగా గెంతుతుంది.', ms: 2500 },
    'knight-2': { en: 'It hops two, then one to the side.', te: 'రెండు గడులు గెంతి, తర్వాత పక్కకి ఒకటి.', ms: 2700 },
    'knight-3': { en: 'It can even jump over junk bots!', te: 'అది జంక్ బాట్ల మీదుగా కూడా దూకగలదు!', ms: 2700 },

    /* bump: capturing a junk bot */
    'bump-1': { en: 'Uh oh, a junk bot is in the way!', te: 'అయ్యో, దారిలో ఒక జంక్ బాట్ ఉంది!', ms: 3000 },
    'bump-2': { en: 'Land on it, and bump! It is gone.', te: 'దాని మీదకి వెళ్ళు, ఢాం! అది మాయం.', ms: 2700 },
    'bump-3': { en: 'See? The way is clear now.', te: 'చూశావా? ఇప్పుడు దారి ఖాళీ.', ms: 2500 },

    /* pawn: Mini bot */
    'pawn-1': { en: 'Mini bot marches straight toward the junkyard.', te: 'మినీ బాట్ జంక్ యార్డ్ వైపు తిన్నగా నడుస్తుంది.', ms: 2500 },
    'pawn-2': { en: 'Its very first step can be two squares.', te: 'మొదటి అడుగులో రెండు గడులు వెళ్లగలదు.', ms: 2700 },
    'pawn-3': { en: 'After that, just one small step at a time.', te: 'ఆ తర్వాత, ఒక్కోసారి ఒక్క చిన్న అడుగే.', ms: 3300 },

    /* generic practice-flow lines, reused by every lesson */
    'your-turn': { en: 'Now you try!', te: 'ఇప్పుడు నువ్వు చెయ్యి!', ms: 1400 },
    'tap-robot': { en: 'Tap your robot.', te: 'నీ రోబోని నొక్కు.', ms: 1400 },
    'tap-footprint': { en: 'Tap a footprint.', te: 'ఒక అడుగు గుర్తుని నొక్కు.', ms: 1400 },
    'great': { en: 'Great job!', te: 'భలే! చాలా బాగుంది!', ms: 1100 }
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
    LANGS: LANGS,
    DEFAULT_LANG: DEFAULT_LANG,
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
