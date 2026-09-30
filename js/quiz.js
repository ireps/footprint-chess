/*
 * Footprint Chess: the footprints quiz, "Whose footprints?" (stage 6).
 *
 * Pure quiz logic, no DOM. Each question shows one piece's footprints
 * around an empty square (the piece itself is hidden), and three of the
 * child's pieces stand on their side (row 7) to choose from. The child taps
 * the piece that makes those footprints. A wrong tap is never a fail: the
 * tapped piece shows its own, different footprints and the child tries
 * again. The distractors are the pieces most often mixed up with the
 * answer (the queen with the rook and the bishop, the king with the queen,
 * and so on), so every question practises a real difference between two
 * rules.
 *
 * A quiz state is { id: 'whose', questions, index, over, misses } where
 * misses counts, per piece type, the wrong taps made while that type was
 * the answer (js/game-list.js uses it to pick a tip after the quiz).
 *
 * Classic script: exposes window.FC.quiz in the browser and module.exports
 * in Node. Keep to ES2017 syntax.
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var R = isNode ? require('./rules.js') : root.FC.rules;

  var QUESTIONS = 5;
  var TYPES = ['r', 'b', 'q', 'k', 'n', 'p'];
  // The two pieces a child most often confuses with each piece, in order.
  var CONFUSE = {
    r: ['q', 'k'],
    b: ['q', 'p'],
    q: ['r', 'b'],
    k: ['q', 'p'],
    n: ['k', 'b'],
    p: ['k', 'r']
  };
  // Columns of the three choices on the child's side (row 7).
  var CHOICE_COLS = [1, 3, 6];

  function randInt(rng, n) { return Math.floor(rng() * n); }

  function shuffle(rng, list) {
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = randInt(rng, i + 1);
      var tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  /* The squares a piece of `type` (the child's team) could move to from
   * `sq` on an empty board, leaving out row 7, where the choices stand. */
  function footprints(type, sq) {
    var board = R.emptyBoard();
    board[sq[0]][sq[1]] = { type: type, team: 'me' };
    return R.movesFor(board, sq[0], sq[1])
      .filter(function (m) { return m.r !== 7; })
      .map(function (m) { return [m.r, m.c]; });
  }

  function patternKey(list) {
    return list.map(function (sq) { return sq[0] + ',' + sq[1]; }).sort().join(' ');
  }

  function makeQuestion(answer, rng) {
    // The empty square in the middle of the board (rows 2 to 4, columns 2
    // to 5), so every pattern has room to show.
    var sq = [2 + randInt(rng, 3), 2 + randInt(rng, 4)];
    var key = patternKey(footprints(answer, sq));
    var pool = CONFUSE[answer].concat(shuffle(rng, TYPES));
    var picks = [];
    pool.forEach(function (t) {
      if (picks.length >= 2 || t === answer || picks.indexOf(t) !== -1) return;
      if (patternKey(footprints(t, sq)) === key) return; // would be two right answers
      picks.push(t);
    });
    var choices = shuffle(rng, [answer].concat(picks));
    return {
      answer: answer,
      square: sq,
      footprints: footprints(answer, sq),
      choices: choices.map(function (t, i) { return { type: t, at: [7, CHOICE_COLS[i]] }; })
    };
  }

  function create(options, rng) {
    rng = rng || Math.random;
    var count = (options && options.count) || QUESTIONS;
    // Every piece once before any repeats.
    var order = [];
    while (order.length < count) order = order.concat(shuffle(rng, TYPES));
    var questions = order.slice(0, count).map(function (t) { return makeQuestion(t, rng); });
    return { id: 'whose', questions: questions, index: 0, over: false, misses: {} };
  }

  function current(state) {
    return state.over ? null : state.questions[state.index];
  }

  /* The child tapped the choice of `type`. Returns { correct, over }. */
  function answer(state, type) {
    if (state.over) throw new Error('answer: the quiz is already over');
    var q = current(state);
    var valid = q.choices.some(function (ch) { return ch.type === type; });
    if (!valid) throw new Error('answer: ' + type + ' is not one of the choices');
    if (type !== q.answer) {
      state.misses[q.answer] = (state.misses[q.answer] || 0) + 1;
      return { correct: false, over: false };
    }
    state.index++;
    if (state.index >= state.questions.length) state.over = true;
    return { correct: true, over: state.over };
  }

  var api = {
    QUESTIONS: QUESTIONS,
    CONFUSE: CONFUSE,
    create: create,
    current: current,
    answer: answer,
    footprints: footprints
  };

  if (isNode) {
    module.exports = api;
  } else {
    root.FC = root.FC || {};
    root.FC.quiz = api;
  }
})(this);
