/*
 * Footprint Chess: Mirror Pond, the other side's view (stage 7).
 *
 * Pure rules, no DOM. Two games about seeing what the other side can do,
 * with the board never rotating (the child is always at the bottom; the
 * other side's forward is toward the child's side):
 *
 *   'theirs' - Their footprints: five questions. One opponent piece glows;
 *              the child taps any square it could move to. Mostly pawns
 *              (which march toward the child's side and capture on the
 *              downward slant) and knights.
 *   'danger' - Which piece is in danger?: five positions, each with three
 *              of the child's pieces and one or two opponent pieces.
 *              Exactly one of the child's pieces could be captured; the
 *              child finds it, then moves it to a square where it is safe.
 *
 * No fail states: a wrong tap is counted (for the hints) and the child
 * tries again. The pond picture and the flow are in js/games-ui.js.
 *
 * Classic script: exposes window.FC.pond in the browser and module.exports
 * in Node. Keep to ES2017 syntax.
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var R = isNode ? require('./rules.js') : root.FC.rules;

  var QUESTIONS = 5;
  var MAX_ATTEMPTS = 200;

  function randInt(rng, n) { return Math.floor(rng() * n); }
  function between(rng, lo, hi) { return lo + randInt(rng, hi - lo + 1); }
  function key(r, c) { return r + ',' + c; }

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

  // ---- theirs: Their footprints ----------------------------------------------

  /* One question: an opponent piece of `type`, and sometimes one of the
   * child's pieces where it could capture, so a capture footprint shows. */
  function theirsQuestion(type, rng) {
    var board = R.emptyBoard();
    var at;
    if (type === 'p') at = [between(rng, 1, 4), between(rng, 1, 6)];
    else at = [between(rng, 2, 4), between(rng, 1, 6)];
    board[at[0]][at[1]] = { type: type, team: 'foe' };
    if (rng() < 0.5) {
      var hits = R.attacks(board, at[0], at[1]).filter(function (sq) { return sq[0] > at[0]; });
      if (hits.length) {
        var sq = hits[randInt(rng, hits.length)];
        board[sq[0]][sq[1]] = { type: ['p', 'r', 'b', 'n'][randInt(rng, 4)], team: 'me' };
      }
    }
    return { board: board, at: at, type: type };
  }

  function createTheirs(options, rng) {
    rng = rng || Math.random;
    var extra = ['r', 'b', 'q', 'k'][randInt(rng, 4)];
    var types = shuffle(rng, ['p', 'p', 'n', 'n', extra]);
    return {
      id: 'theirs',
      questions: types.map(function (t) { return theirsQuestion(t, rng); }),
      index: 0,
      misses: 0,      // wrong taps on the current question
      over: false
    };
  }

  /* The current question's piece's moves: [{ r, c, capture }]. */
  function theirMoves(state) {
    var q = state.questions[state.index];
    return R.movesFor(q.board, q.at[0], q.at[1]);
  }

  /* The child tapped (r, c). Returns 'right' (a square the piece can move
   * to; the next question follows), 'self' (the piece itself) or 'wrong'. */
  function tapTheirs(state, r, c) {
    if (state.over) throw new Error('tapTheirs: the game is over');
    var q = state.questions[state.index];
    if (r === q.at[0] && c === q.at[1]) return 'self';
    var ok = theirMoves(state).some(function (m) { return m.r === r && m.c === c; });
    if (!ok) {
      state.misses++;
      return 'wrong';
    }
    return 'right';
  }

  /* After a right answer has been shown: the next question (or the end). */
  function nextTheirs(state) {
    state.index++;
    state.misses = 0;
    if (state.index >= state.questions.length) state.over = true;
    return !state.over;
  }

  // ---- danger: Which piece is in danger? ------------------------------------

  function afterMove(board, from, to) {
    var next = R.cloneBoard(board);
    next[to[0]][to[1]] = next[from[0]][from[1]];
    next[from[0]][from[1]] = null;
    return next;
  }

  function attackedMine(board) {
    var watched = R.attackedSquares(board, 'foe');
    var out = [];
    for (var r = 0; r < R.SIZE; r++) {
      for (var c = 0; c < R.SIZE; c++) {
        var p = board[r][c];
        if (p && p.team === 'me' && watched[key(r, c)]) out.push([r, c]);
      }
    }
    return out;
  }

  /* The moves of the piece on `from` that end where the other side could
   * not capture it (worked out on the board after the move). */
  function safeMovesFrom(board, from) {
    return R.movesFor(board, from[0], from[1]).filter(function (m) {
      var next = afterMove(board, from, [m.r, m.c]);
      return !R.attackedSquares(next, 'foe')[key(m.r, m.c)];
    });
  }

  function place(board, rows, rng, piece) {
    for (var i = 0; i < 50; i++) {
      var r = between(rng, rows[0], rows[1]);
      var c = randInt(rng, 8);
      if (!board[r][c]) {
        board[r][c] = piece;
        return true;
      }
    }
    return false;
  }

  function dangerPosition(rng) {
    for (var attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      var board = R.emptyBoard();
      var ok = true;
      for (var i = 0; i < 3 && ok; i++) {
        ok = place(board, [3, 7], rng, { type: ['p', 'r', 'b', 'n', 'q'][randInt(rng, 5)], team: 'me' });
      }
      var foes = 1 + randInt(rng, 2);
      for (var j = 0; j < foes && ok; j++) {
        ok = place(board, [0, 4], rng, { type: ['p', 'r', 'b', 'n', 'q'][randInt(rng, 5)], team: 'foe' });
      }
      if (!ok) continue;
      var hit = attackedMine(board);
      if (hit.length !== 1) continue;
      if (!safeMovesFrom(board, hit[0]).length) continue;
      return { board: board, target: hit[0] };
    }
    throw new Error('danger: could not build a position');
  }

  function createDanger(options, rng) {
    rng = rng || Math.random;
    var positions = [];
    for (var i = 0; i < QUESTIONS; i++) positions.push(dangerPosition(rng));
    return { id: 'danger', positions: positions, index: 0, phase: 'find', misses: 0, over: false };
  }

  /* Find phase: the child tapped (r, c). 'right' (the piece in danger; the
   * move phase starts), 'safe' (another of the child's pieces) or 'none'. */
  function tapDanger(state, r, c) {
    if (state.over || state.phase !== 'find') throw new Error('tapDanger: not finding');
    var pos = state.positions[state.index];
    var p = pos.board[r][c];
    if (!p || p.team !== 'me') return 'none';
    if (r === pos.target[0] && c === pos.target[1]) {
      state.phase = 'move';
      return 'right';
    }
    state.misses++;
    return 'safe';
  }

  /* Move phase: the safe moves of the piece in danger, and the rest. */
  function dangerSafeMoves(state) {
    var pos = state.positions[state.index];
    return safeMovesFrom(pos.board, pos.target);
  }
  function dangerUnsafe(state) {
    var pos = state.positions[state.index];
    var safe = {};
    dangerSafeMoves(state).forEach(function (m) { safe[key(m.r, m.c)] = true; });
    return R.movesFor(pos.board, pos.target[0], pos.target[1])
      .filter(function (m) { return !safe[key(m.r, m.c)]; })
      .map(function (m) { return [m.r, m.c]; });
  }

  /* Move phase: move the piece to (r, c). true when it is a safe move (the
   * piece moves; then nextDanger), false otherwise (nothing changes). */
  function moveToSafety(state, r, c) {
    if (state.over || state.phase !== 'move') throw new Error('moveToSafety: not moving');
    var ok = dangerSafeMoves(state).some(function (m) { return m.r === r && m.c === c; });
    if (!ok) return false;
    var pos = state.positions[state.index];
    pos.board = afterMove(pos.board, pos.target, [r, c]);
    pos.target = [r, c];
    state.phase = 'done';
    return true;
  }

  function nextDanger(state) {
    state.index++;
    state.phase = 'find';
    state.misses = 0;
    if (state.index >= state.positions.length) state.over = true;
    return !state.over;
  }

  var api = {
    QUESTIONS: QUESTIONS,
    createTheirs: createTheirs,
    theirMoves: theirMoves,
    tapTheirs: tapTheirs,
    nextTheirs: nextTheirs,
    createDanger: createDanger,
    tapDanger: tapDanger,
    dangerSafeMoves: dangerSafeMoves,
    dangerUnsafe: dangerUnsafe,
    moveToSafety: moveToSafety,
    nextDanger: nextDanger
  };

  if (isNode) {
    module.exports = api;
  } else {
    root.FC = root.FC || {};
    root.FC.pond = api;
  }
})(this);
