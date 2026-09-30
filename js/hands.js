/*
 * Footprint Chess: hand-print levels, left and right (stage 7).
 *
 * The one place in the app where left and right are named. The board still
 * never rotates and the child is always at the bottom, so the child's left
 * is always the board's column 0 side and their right the column 7 side.
 * A left and a right hand print stand at the two ends of the child's own
 * strip (js/games-ui.js), left always orange and right always blue.
 *
 *   'hands' - Left or right?: six questions ("Move to your left!", three
 *             each way, in a random order). One of the child's pieces
 *             (rook, queen or king) stands near the middle; any move that
 *             ends further toward the named hand is right. A move the other
 *             way is taken back and that hand print is named; a move
 *             straight up or down the board asks again.
 *
 * Pure rules, no DOM. Classic script: window.FC.hands in the browser,
 * module.exports in Node. Keep to ES2017 syntax.
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var R = isNode ? require('./rules.js') : root.FC.rules;

  var QUESTIONS = 6;
  var TYPES = ['r', 'q', 'k'];

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

  /* 'left' when (from -> to) ends nearer the child's left (column 0),
   * 'right' when nearer the right (column 7), 'straight' otherwise. */
  function sideOf(from, to) {
    if (to[1] < from[1]) return 'left';
    if (to[1] > from[1]) return 'right';
    return 'straight';
  }

  function create(options, rng) {
    rng = rng || Math.random;
    var dirs = shuffle(rng, ['left', 'left', 'left', 'right', 'right', 'right']);
    var questions = dirs.map(function (dir) {
      var type = TYPES[randInt(rng, TYPES.length)];
      // Near the middle (columns 2 to 5), so both ways are open.
      var at = [3 + randInt(rng, 3), 2 + randInt(rng, 4)];
      var board = R.emptyBoard();
      board[at[0]][at[1]] = { type: type, team: 'me' };
      return { type: type, at: at, dir: dir, board: board };
    });
    return { id: 'hands', questions: questions, index: 0, misses: 0, over: false };
  }

  function current(state) {
    return state.over ? null : state.questions[state.index];
  }

  function moves(state) {
    var q = current(state);
    return R.movesFor(q.board, q.at[0], q.at[1]);
  }

  /* The child moved the piece to `to`. Returns 'yes' (the asked way; the
   * next question follows with next()), 'other' (the other way: it goes
   * back) or 'straight' (neither way: ask again). Throws on an illegal move. */
  function answer(state, to) {
    if (state.over) throw new Error('answer: the game is over');
    var q = current(state);
    var legal = moves(state).some(function (m) { return m.r === to[0] && m.c === to[1]; });
    if (!legal) throw new Error('answer: not a move of the piece');
    var side = sideOf(q.at, to);
    if (side === q.dir) return 'yes';
    state.misses++;
    return side === 'straight' ? 'straight' : 'other';
  }

  function next(state) {
    state.index++;
    state.misses = 0;
    if (state.index >= state.questions.length) state.over = true;
    return !state.over;
  }

  var api = {
    QUESTIONS: QUESTIONS,
    create: create,
    current: current,
    moves: moves,
    answer: answer,
    next: next,
    sideOf: sideOf
  };

  if (isNode) {
    module.exports = api;
  } else {
    root.FC = root.FC || {};
    root.FC.hands = api;
  }
})(this);
