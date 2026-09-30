/*
 * Footprint Chess: the growing battle (stage 8).
 *
 * Pure rules, no DOM. A ladder of battles that adds pieces step by step
 * until the child plays a whole game of chess. Both sides set up as in a
 * real game, with only the level's kinds of piece on the board:
 *
 *   'army1' - Pawn battle: eight pawns each. Win: a pawn reaches the
 *             other side.
 *   'army2' - Pawns and rooks. Win: capture all their pawns, or a pawn
 *             reaches the other side.
 *   'army3' - Pawns, rooks and bishops. Same win.
 *   'army4' - Knights join in. Same win.
 *   'army5' - The queens join in. Same win.
 *   'army6' - The kings join in: a whole army each, with check. Win:
 *             checkmate their king. Every move follows the check rules
 *             (never leaving your own king in check), a pawn that reaches
 *             the other side becomes a queen, and a stalemate ends the game
 *             with nobody winning.
 *
 * The other side is a gentle opponent (see botMove): no chess engine, just
 * a few simple rules with a chance of missing things on purpose, a little
 * smaller at each level. Its pawns never step onto the child's home row,
 * it never captures the child below half of their pieces or their last
 * piece that is not a pawn, and it never leaves the child with no move, so
 * the child can always finish (docs/DESIGN.md, "no fail states"). With the
 * kings on the board it never gives checkmate (so the child never loses)
 * and never leaves the child stalemated.
 *
 * The game states work with the same calls as js/games.js (legalMoves,
 * applyMove, botMove, hint), which hands every 'army' game to this file.
 *
 * Classic script: exposes window.FC.army in the browser and module.exports
 * in Node. Keep to ES2017 syntax.
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var R = isNode ? require('./rules.js') : root.FC.rules;

  // The back row of a real game, from the child's view (the board never
  // rotates; both sides mirror each other).
  var BACK_ROW = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

  /*
   * id:      the game id (js/game-list.js)
   * types:   the kinds of piece on the board
   * mistake: the chance the opponent plays any move instead of its best
   *          one (smaller as the levels go up)
   * goal:    'reach' (a pawn reaches the other side) or 'pawns' (capture
   *          all their pawns, or a pawn reaches the other side)
   */
  var LEVELS = [
    { id: 'army1', types: ['p'], mistake: 0.45, goal: 'reach' },
    { id: 'army2', types: ['p', 'r'], mistake: 0.35, goal: 'pawns' },
    { id: 'army3', types: ['p', 'r', 'b'], mistake: 0.3, goal: 'pawns' },
    { id: 'army4', types: ['p', 'r', 'b', 'n'], mistake: 0.25, goal: 'pawns' },
    { id: 'army5', types: ['p', 'r', 'b', 'n', 'q'], mistake: 0.2, goal: 'pawns' },
    { id: 'army6', types: ['p', 'r', 'b', 'n', 'q', 'k'], mistake: 0.15, goal: 'mate' }
  ];

  var VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 50 };

  // The opponent's pawns stop one row short of the child's home row.
  var FOE_PAWN_LAST_ROW = 6;

  function randInt(rng, n) { return Math.floor(rng() * n); }
  function key(r, c) { return r + ',' + c; }

  function level(id) {
    for (var i = 0; i < LEVELS.length; i++) {
      if (LEVELS[i].id === id) return LEVELS[i];
    }
    return null;
  }

  function isArmy(id) { return !!level(id); }

  function startBoard(types) {
    var board = R.emptyBoard();
    for (var c = 0; c < R.SIZE; c++) {
      if (types.indexOf('p') !== -1) {
        board[6][c] = { type: 'p', team: 'me' };
        board[1][c] = { type: 'p', team: 'foe' };
      }
      var t = BACK_ROW[c];
      if (types.indexOf(t) !== -1) {
        board[7][c] = { type: t, team: 'me' };
        board[0][c] = { type: t, team: 'foe' };
      }
    }
    return board;
  }

  function count(board, team, type) {
    var n = 0;
    for (var r = 0; r < R.SIZE; r++) {
      for (var c = 0; c < R.SIZE; c++) {
        var p = board[r][c];
        if (p && p.team === team && (!type || p.type === type)) n++;
      }
    }
    return n;
  }

  function create(id, options, rng) {
    var lv = level(id);
    if (!lv) throw new Error('army: unknown level ' + id);
    var board = startBoard(lv.types);
    return {
      id: id,
      army: true,
      board: board,
      turn: 'me',
      moveCount: 0,
      over: false,
      winner: null,
      startPieces: count(board, 'me'),
      checkRules: lv.goal === 'mate',
      lastFoe: null   // the other side's last move: { from, to }
    };
  }

  /* The moves of the piece on (r, c) under this game's rules: the
   * opponent's pawns never reach the child's home row, and on a board
   * with kings a move may never leave the mover's own king in check. */
  function pieceMoves(board, r, c) {
    var p = board[r][c];
    if (!p) return [];
    var moves = R.movesFor(board, r, c);
    if (p.type === 'p' && p.team === 'foe') moves = moves.filter(function (m) { return m.r <= FOE_PAWN_LAST_ROW; });
    if (R.findKing(board, p.team)) {
      moves = moves.filter(function (m) { return !R.inCheck(afterMove(board, [r, c], [m.r, m.c]), p.team); });
    }
    return moves;
  }

  /* The squares next to the king on (r, c) he may not step to, because the
   * other side could capture him there. */
  function kingDanger(board, r, c) {
    var p = board[r][c];
    if (!p || p.type !== 'k') return [];
    var ok = {};
    pieceMoves(board, r, c).forEach(function (m) { ok[key(m.r, m.c)] = true; });
    return R.movesFor(board, r, c).filter(function (m) { return !ok[key(m.r, m.c)]; }).map(function (m) { return [m.r, m.c]; });
  }

  function hasMove(board, team) {
    for (var r = 0; r < R.SIZE; r++) {
      for (var c = 0; c < R.SIZE; c++) {
        var p = board[r][c];
        if (p && p.team === team && pieceMoves(board, r, c).length) return true;
      }
    }
    return false;
  }

  function checkmated(board, team) {
    return R.inCheck(board, team) && !hasMove(board, team);
  }

  // A king that is not in check but whose side has no move.
  function stalemated(board, team) {
    var king = R.findKing(board, team);
    if (!king || R.inCheck(board, team) || pieceMoves(board, king[0], king[1]).length) return false;
    return !hasMove(board, team);
  }

  function allMoves(board, team) {
    var out = [];
    for (var r = 0; r < R.SIZE; r++) {
      for (var c = 0; c < R.SIZE; c++) {
        var p = board[r][c];
        if (!p || p.team !== team) continue;
        pieceMoves(board, r, c).forEach(function (m) {
          out.push({ from: [r, c], to: [m.r, m.c], capture: m.capture });
        });
      }
    }
    return out;
  }

  /* The board after a move. In the battle with kings, the child's pawn
   * that reaches the other side becomes a queen. */
  function afterMove(board, from, to) {
    var next = R.cloneBoard(board);
    var piece = next[from[0]][from[1]];
    if (piece && piece.type === 'p' && piece.team === 'me' && to[0] === 0 && R.findKing(board, 'me')) {
      piece = { type: 'q', team: 'me' };
    }
    next[to[0]][to[1]] = piece;
    next[from[0]][from[1]] = null;
    return next;
  }

  /*
   * The child's pieces that are in danger: the other side could capture
   * them, and either nobody of the child's protects them or the cheapest
   * piece that could capture is worth less. Returns [[r, c]].
   */
  function inDanger(board, team) {
    team = team || 'me';
    var foe = team === 'me' ? 'foe' : 'me';
    var guarded = R.attackedSquares(board, team);
    var cheapest = {};
    for (var r = 0; r < R.SIZE; r++) {
      for (var c = 0; c < R.SIZE; c++) {
        var p = board[r][c];
        if (!p || p.team !== foe) continue;
        pieceMoves(board, r, c).forEach(function (m) {
          if (!m.capture) return;
          var k = key(m.r, m.c);
          if (cheapest[k] === undefined || VALUE[p.type] < cheapest[k]) cheapest[k] = VALUE[p.type];
        });
      }
    }
    var out = [];
    for (var rr = 0; rr < R.SIZE; rr++) {
      for (var cc = 0; cc < R.SIZE; cc++) {
        var q = board[rr][cc];
        var k2 = key(rr, cc);
        if (!q || q.team !== team || cheapest[k2] === undefined) continue;
        if (!guarded[k2] || cheapest[k2] < VALUE[q.type]) out.push([rr, cc]);
      }
    }
    return out;
  }

  /*
   * How good a move is for its side: what it captures, what it walks into,
   * what it saves, and (for the child) reaching the other side. Used by
   * the opponent and by the child's hint.
   */
  function score(board, mv, team) {
    var piece = board[mv.from[0]][mv.from[1]];
    var target = board[mv.to[0]][mv.to[1]];
    var s = 0;
    if (target) s += VALUE[target.type] * 10;
    var next = afterMove(board, mv.from, mv.to);
    var dangerNow = inDanger(board, team).some(function (sq) { return sq[0] === mv.from[0] && sq[1] === mv.from[1]; });
    var dangerAfter = inDanger(next, team).some(function (sq) { return sq[0] === mv.to[0] && sq[1] === mv.to[1]; });
    if (dangerAfter) s -= VALUE[piece.type] * 9;
    else if (dangerNow) s += VALUE[piece.type] * 5;
    var other = team === 'me' ? 'foe' : 'me';
    var theirKing = R.findKing(next, other);
    if (theirKing) {
      // With kings: the child plays for checkmate (never stalemate); the
      // opponent likes a check but never gives checkmate (botMove).
      if (checkmated(next, other)) return 5000;
      if (stalemated(next, other)) return -3000;
      if (R.inCheck(next, other)) s += 2;
      if (team === 'me') {
        // Fewer squares for their king, and their king nearer an edge.
        s -= pieceMoves(next, theirKing[0], theirKing[1]).length * 1.5;
        s += Math.max(Math.abs(theirKing[0] - 3.5), Math.abs(theirKing[1] - 3.5));
      }
    }
    if (piece.type === 'p') {
      var goal = team === 'me' ? 0 : FOE_PAWN_LAST_ROW;
      if (team === 'me' && mv.to[0] === goal) s += theirKing ? 80 : 1000;
      if (!dangerAfter) s += 1 + (team === 'me' ? (6 - mv.to[0]) : (mv.to[0] - 1)) * 0.5;
    } else if (!dangerAfter) {
      // Bring a piece out from the back row, and aim it at something that
      // nobody protects (so the next move can capture it).
      if (team === 'me' ? mv.from[0] === 7 : mv.from[0] === 0) s += 1.5;
      var guarded = R.attackedSquares(next, team === 'me' ? 'foe' : 'me');
      pieceMoves(next, mv.to[0], mv.to[1]).forEach(function (m) {
        if (m.capture && !guarded[key(m.r, m.c)]) s += 3;
      });
    }
    return s;
  }

  /* Whether the child's move from `from` to `to` is allowed now. */
  function legalMoves(state, r, c) {
    if (state.over || state.turn !== 'me') return [];
    var p = state.board[r][c];
    if (!p || p.team !== 'me') return [];
    return pieceMoves(state.board, r, c);
  }

  function won(state) {
    var board = state.board;
    if (state.checkRules) return checkmated(board, 'foe');
    for (var c = 0; c < R.SIZE; c++) {
      var p = board[0][c];
      if (p && p.team === 'me' && p.type === 'p') return true;
    }
    // Capturing every one of their pawns wins too (in the pawn battle
    // that also leaves the other side with no move).
    return count(board, 'foe', 'p') === 0;
  }

  function finish(state, events) {
    state.over = true;
    state.winner = 'me';
    events.push('army-won');
  }

  // Nobody wins (a stalemate, or nobody can move in the battle with kings).
  function draw(state, events) {
    state.over = true;
    state.winner = null;
    events.push('army-draw');
  }

  function applyMove(state, from, to) {
    if (state.over) throw new Error('applyMove: game is already over');
    if (state.turn !== 'me') throw new Error('applyMove: not the child\'s turn');
    var ok = legalMoves(state, from[0], from[1]).some(function (m) { return m.r === to[0] && m.c === to[1]; });
    if (!ok) throw new Error('applyMove: illegal move from ' + key(from[0], from[1]) + ' to ' + key(to[0], to[1]));
    var captured = state.board[to[0]][to[1]];
    var moved = state.board[from[0]][from[1]];
    state.board = afterMove(state.board, from, to);
    state.lastMine = { from: from.slice(), to: to.slice() };
    var board = state.board;
    state.moveCount++;
    var events = [];
    if (board[to[0]][to[1]].type !== moved.type) events.push('promoted');
    if (won(state)) {
      finish(state, events);
    } else if (state.checkRules && stalemated(board, 'foe')) {
      draw(state, events);
    } else if (!allMoves(board, 'foe').length && !allMoves(board, 'me').length) {
      // Nobody can move (only possible with pawns alone): the child wins.
      finish(state, events);
    } else {
      if (state.checkRules && R.inCheck(board, 'foe')) events.push('check');
      state.turn = 'foe';
    }
    return { captured: captured || null, events: events };
  }

  /*
   * The opponent's move. Gentle rules, in order:
   *   - never a capture that leaves the child with less than half of their
   *     pieces, or without their last piece that is not a pawn;
   *   - never a move that leaves the child with no move, when it has
   *     another;
   *   - with the level's `mistake` chance, any allowed move that captures
   *     nothing; otherwise the best-scoring move (captures what is free,
   *     keeps its own pieces out of danger, brings pieces out, pushes
   *     pawns), ties broken at random.
   * Returns { from, to, captured, events } or null (no move: the turn
   * passes back).
   */
  function botMove(state, rng) {
    rng = rng || Math.random;
    if (state.over || state.turn !== 'foe') return null;
    var lv = level(state.id);
    var board = state.board;
    var mine = count(board, 'me');
    var mineBig = mine - count(board, 'me', 'p') - count(board, 'me', 'k');
    var keep = Math.ceil(state.startPieces / 2);
    var all = allMoves(board, 'foe');
    // Never checkmate the child, and never leave them without a move.
    var fair = all.filter(function (m) { return hasMove(afterMove(board, m.from, m.to), 'me'); });
    if (fair.length) all = fair;
    var moves = all.filter(function (m) {
      if (!m.capture) return true;
      var t = board[m.to[0]][m.to[1]];
      if (mine - 1 < keep) return false;
      if (t.type !== 'p' && mineBig <= 1) return false;
      return true;
    });
    // In the battle with kings the opponent must move (a king in check
    // may have only captures left): then any legal move. Before the kings,
    // it passes instead.
    if (!moves.length && state.checkRules) moves = all;
    state.turn = 'me';
    if (!moves.length) return null;

    var choice;
    var quiet = moves.filter(function (m) { return !m.capture; });
    if (quiet.length && rng() < lv.mistake) {
      choice = quiet[randInt(rng, quiet.length)];
    } else {
      var best = -Infinity;
      var pool = [];
      moves.forEach(function (m) {
        var s = score(board, m, 'foe');
        if (s > best + 1e-9) { best = s; pool = [m]; } else if (Math.abs(s - best) <= 1e-9) pool.push(m);
      });
      choice = pool[randInt(rng, pool.length)];
    }

    var captured = board[choice.to[0]][choice.to[1]];
    board[choice.to[0]][choice.to[1]] = board[choice.from[0]][choice.from[1]];
    board[choice.from[0]][choice.from[1]] = null;
    state.moveCount++;
    state.lastFoe = { from: choice.from, to: choice.to };
    var events = [];
    if (!hasMove(board, 'me')) {
      // Only when every move left the child stuck: the child wins, or in
      // the battle with kings nobody does.
      if (state.checkRules) draw(state, events); else finish(state, events);
    } else if (R.inCheck(board, 'me')) {
      events.push('check');
    }
    return { from: choice.from, to: choice.to, captured: captured || null, events: events };
  }

  /* The child's best move by the same scoring, or null. Ties go to the
   * first found (from the other side's edge down), so a hint is steady. */
  function bestMove(board, fromSq, last) {
    var best = null;
    var bestScore = -Infinity;
    allMoves(board, 'me').forEach(function (m) {
      if (fromSq && (m.from[0] !== fromSq[0] || m.from[1] !== fromSq[1])) return;
      var s = score(board, m, 'me');
      // Going straight back where the child's last move came from gets
      // nowhere: a small penalty.
      if (last && m.from[0] === last.to[0] && m.from[1] === last.to[1] && m.to[0] === last.from[0] && m.to[1] === last.from[1]) s -= 4;
      if (s > bestScore) { best = m; bestScore = s; }
    });
    return best;
  }

  /*
   * The idle hint: with no piece selected, the piece of the best move;
   * with one selected, the best square for that piece (null when it has
   * no move).
   */
  function hint(state, selected) {
    if (state.over || state.turn !== 'me') return null;
    if (selected) {
      var own = bestMove(state.board, selected, state.lastMine);
      return own ? own.to.slice() : null;
    }
    var mv = bestMove(state.board, null, state.lastMine);
    return mv ? mv.from.slice() : null;
  }

  function goalOf(id) {
    var lv = level(id);
    if (!lv) return null;
    if (lv.goal === 'mate') return { kind: 'checkmate' };
    return lv.goal === 'reach' ? { kind: 'reach-row', row: 0 } : { kind: 'pawns-or-reach', target: 'p', row: 0 };
  }

  /* The child's king's forbidden squares, when the king on (r, c) is
   * selected (for the red glow). */
  function dangerSquares(state, r, c) {
    var p = state.board[r][c];
    if (!state.checkRules || !p || p.team !== 'me' || p.type !== 'k') return [];
    return kingDanger(state.board, r, c);
  }

  /* The other side's pieces giving check to the child's king. */
  function checkers(board, team) {
    var king = R.findKing(board, team);
    var out = [];
    if (!king) return out;
    for (var r = 0; r < R.SIZE; r++) {
      for (var c = 0; c < R.SIZE; c++) {
        var p = board[r][c];
        if (!p || p.team === team) continue;
        if (R.attacks(board, r, c).some(function (sq) { return sq[0] === king[0] && sq[1] === king[1]; })) out.push([r, c]);
      }
    }
    return out;
  }

  var api = {
    LEVELS: LEVELS,
    BACK_ROW: BACK_ROW,
    VALUE: VALUE,
    FOE_PAWN_LAST_ROW: FOE_PAWN_LAST_ROW,
    isArmy: isArmy,
    level: level,
    startBoard: startBoard,
    create: create,
    legalMoves: legalMoves,
    applyMove: applyMove,
    botMove: botMove,
    inDanger: inDanger,
    bestMove: bestMove,
    hint: hint,
    goalOf: goalOf,
    dangerSquares: dangerSquares,
    checkers: checkers,
    checkmated: checkmated,
    stalemated: stalemated
  };

  if (isNode) {
    module.exports = api;
  } else {
    root.FC = root.FC || {};
    root.FC.army = api;
  }
})(this);
