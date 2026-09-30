/*
 * Footprint Chess: mini-games (stage 3).
 *
 * Pure game logic, no DOM. Gentle games built on top of js/rules.js:
 *   'catch'  - Catch the knight: the child's piece chases a foe knight.
 *   'race'   - Pawn race: three child pawns race three foe pawns to the far edge.
 *   'battle' - Little battle: the child's piece(s) clear four foe pawns.
 *   'chain'  - Capture chain (stage 6): one piece and four still foe pawns,
 *              placed so each capture lands where the next pawn is one move
 *              away. A solo game: the turn never passes to the other side.
 *   'hop'    - Knight hop (stage 6, solo): the knight reaches the other side,
 *              hopping over (or capturing) three still pawns.
 *   'way'    - Find the way (stage 6, solo): one piece reaches the other side
 *              around the child's own pawns, which it can neither jump nor
 *              capture (only the one piece moves).
 *   'stop'   - Stop the pawns (stage 6): three foe pawns march toward the
 *              child's side, one step a turn, never capturing and never
 *              past row 6; the child's piece captures them all. Standing in
 *              front of a pawn stops it.
 *   'safe'   - Keep the king safe (stage 6, solo): the king walks to the
 *              other side past a still rook and bishop; it can never step
 *              onto a square either of them could capture on.
 * The list of games shown to the child (names, rows, pictures) lives in
 * js/game-list.js; the footprints quiz is in js/quiz.js.
 *
 * The bot never plays to win. Every game design keeps a "no fail state"
 * guarantee (see docs/DESIGN.md): the child always finishes, the bot never
 * captures the child down to nothing, and a captured child piece in
 * 'battle' comes straight back.
 *
 * A game state is { id, board, turn: 'me'|'foe', moveCount, over, winner, ... }
 * plus game-specific bookkeeping (see create* below). No kings are used as
 * an opponent piece and check/checkmate are not implemented anywhere here,
 * matching js/rules.js.
 *
 * Classic script: exposes window.FC.games in the browser and module.exports
 * in Node. Keep to ES2017 syntax (see README, "Browser support and coding
 * rules").
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var R = isNode ? require('./rules.js') : root.FC.rules;

  var MAX_ATTEMPTS = 50;
  var RACE_PAWNS = 3;
  var BATTLE_PAWNS = 4;
  var TIRED_AFTER = 6;
  var CHAIN_PAWNS = 4;
  var CHAIN_TYPES = ['r', 'b', 'q', 'k', 'n'];
  var WAY_TYPES = ['r', 'b', 'q', 'k'];
  var WAY_BLOCKERS = 5;
  var HOP_PAWNS = 3;
  var STOP_PAWNS = 3;
  var STOP_TYPES = ['r', 'q', 'k', 'n'];

  function randInt(rng, n) {
    return Math.floor(rng() * n);
  }

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

  function key(sq) {
    return sq[0] + ',' + sq[1];
  }

  function collectPositions(board, type, team) {
    var out = [];
    for (var r = 0; r < R.SIZE; r++) {
      for (var c = 0; c < R.SIZE; c++) {
        var p = board[r][c];
        if (p && p.type === type && p.team === team) out.push([r, c]);
      }
    }
    return out;
  }

  function countPieces(board, type, team) {
    return collectPositions(board, type, team).length;
  }

  /* Single-step pawn moves only (never the two-square first step), clipped
   * so the pawn never lands on the given row or past it. Used by the 'race'
   * and 'battle' bots, whose pawns must stay one row short of the child's
   * back rank. */
  function singleStepMoves(board, r, c, maxRow) {
    return R.movesFor(board, r, c).filter(function (m) {
      return Math.abs(m.r - r) === 1 && m.r <= maxRow;
    });
  }

  // ---- catch: Catch the knight -------------------------------------------

  function createCatch(options, rng) {
    var type = (options && options.type) || 'r';
    var board = R.emptyBoard();
    var hero = [7, randInt(rng, 8)];
    board[hero[0]][hero[1]] = { type: type, team: 'me' };

    var knight = null;
    for (var attempt = 0; attempt < MAX_ATTEMPTS && !knight; attempt++) {
      var kr = 1 + randInt(rng, 4); // rows 1..4
      var kc = randInt(rng, 8);
      if (kr === hero[0] && kc === hero[1]) continue;
      // A knight always changes square colour every move. If the child's
      // piece is also a knight and starts on the SAME colour as the foe
      // knight, both pieces flip colour every move, so the colour
      // difference between them resets each full round and a legal
      // knight-move capture is never on offer, in any number of moves.
      // Starting on opposite colours avoids that permanent trap.
      if (type === 'n' && R.isLightSquare(kr, kc) === R.isLightSquare(hero[0], hero[1])) continue;
      board[kr][kc] = { type: 'n', team: 'foe' };
      var moves = R.movesFor(board, hero[0], hero[1]);
      var capturable = moves.some(function (m) { return m.r === kr && m.c === kc && m.capture; });
      if (capturable) {
        board[kr][kc] = null;
        continue;
      }
      knight = [kr, kc];
    }
    if (!knight) throw new Error('catch: could not place the knight out of reach');

    return {
      id: 'catch',
      board: board,
      turn: 'me',
      moveCount: 0,
      over: false,
      winner: null,
      heroType: type,
      hero: hero,
      knight: knight,
      childMoves: 0,
      tired: false
    };
  }

  /* Squares a piece standing on (heroR, heroC) could capture on next move,
   * with the knight removed from the board first (the knight is about to
   * leave its current square, so it should not block its own escape route
   * from being counted). Works for every non-pawn piece type. */
  function heroAttackSet(board, hero, knight) {
    var work = R.cloneBoard(board);
    work[knight[0]][knight[1]] = null;
    var moves = R.movesFor(work, hero[0], hero[1]);
    var set = {};
    moves.forEach(function (m) { set[m.r + ',' + m.c] = true; });
    return set;
  }

  var KNIGHT_STEPS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];

  /* Knight-move distance from every square to `target`, ignoring any piece
   * in the way (knights always jump). Used to steer a tired knight closer
   * to the hero, in knight-hops, when no move lands directly in the hero's
   * attack set - a plain grid distance underestimates how a knight
   * actually closes a gap, so the chase can stall without it. */
  function knightDistances(target) {
    var dist = {};
    dist[key(target)] = 0;
    var queue = [target];
    while (queue.length) {
      var cur = queue.shift();
      var d = dist[key(cur)];
      KNIGHT_STEPS.forEach(function (s) {
        var nr = cur[0] + s[0];
        var nc = cur[1] + s[1];
        if (!R.onBoard(nr, nc)) return;
        var k = nr + ',' + nc;
        if (dist[k] === undefined) {
          dist[k] = d + 1;
          queue.push([nr, nc]);
        }
      });
    }
    return dist;
  }

  function botCatch(state, rng) {
    var board = state.board;
    var knight = state.knight;
    var moves = R.movesFor(board, knight[0], knight[1]).filter(function (m) { return !m.capture; });
    if (!moves.length) {
      state.turn = 'me';
      return null;
    }

    var attackSet = heroAttackSet(board, state.hero, knight);
    var safe = moves.filter(function (m) { return !attackSet[m.r + ',' + m.c]; });
    var risky = moves.filter(function (m) { return attackSet[m.r + ',' + m.c]; });

    var pool;
    if (!state.tired) {
      pool = safe.length ? safe : moves;
    } else if (risky.length) {
      pool = risky;
    } else {
      // No move lands where the hero could capture it next: close the gap
      // instead, in knight-hops toward the hero, so the chase keeps
      // converging turn over turn.
      var distMap = knightDistances(state.hero);
      var bestDist = Infinity;
      moves.forEach(function (m) { bestDist = Math.min(bestDist, distMap[m.r + ',' + m.c]); });
      pool = moves.filter(function (m) { return distMap[m.r + ',' + m.c] === bestDist; });
    }
    var choice = pool[randInt(rng, pool.length)];

    board[choice.r][choice.c] = board[knight[0]][knight[1]];
    board[knight[0]][knight[1]] = null;
    state.knight = [choice.r, choice.c];
    state.moveCount++;
    state.turn = 'me';
    return { from: knight, to: [choice.r, choice.c], captured: null, events: [] };
  }

  // ---- race: Pawn race -----------------------------------------------------

  function createRace(options, rng) {
    var board = R.emptyBoard();
    var cols = shuffle(rng, [0, 1, 2, 3, 4, 5, 6, 7]);
    var childCols = cols.slice(0, RACE_PAWNS);
    var foeCols = cols.slice(RACE_PAWNS, 2 * RACE_PAWNS);
    childCols.forEach(function (c) { board[6][c] = { type: 'p', team: 'me' }; });
    foeCols.forEach(function (c) { board[1][c] = { type: 'p', team: 'foe' }; });
    return {
      id: 'race',
      board: board,
      turn: 'me',
      moveCount: 0,
      over: false,
      winner: null
    };
  }

  function botRace(state, rng) {
    var board = state.board;
    var childCount = countPieces(board, 'p', 'me');
    var pawns = collectPositions(board, 'p', 'foe');
    var captureMoves = [];
    var advanceMoves = [];
    pawns.forEach(function (pos) {
      // Row 6 and 7 are the child's side; a gentle foe pawn stops at row 5.
      singleStepMoves(board, pos[0], pos[1], 5).forEach(function (m) {
        var mv = { from: pos, to: [m.r, m.c] };
        if (m.capture) captureMoves.push(mv); else advanceMoves.push(mv);
      });
    });

    // Only capture if the child keeps at least 2 pawns afterwards.
    var allowed = childCount - 1 >= 2 ? captureMoves : [];
    var chosen = allowed.length ? allowed[randInt(rng, allowed.length)]
      : (advanceMoves.length ? advanceMoves[randInt(rng, advanceMoves.length)] : null);
    if (!chosen) {
      state.turn = 'me';
      return null;
    }

    var captured = board[chosen.to[0]][chosen.to[1]];
    board[chosen.to[0]][chosen.to[1]] = board[chosen.from[0]][chosen.from[1]];
    board[chosen.from[0]][chosen.from[1]] = null;
    state.moveCount++;
    state.turn = 'me';
    return { from: chosen.from, to: chosen.to, captured: captured || null, events: [] };
  }

  // ---- battle: Little battle -----------------------------------------------

  function createBattle(options, rng) {
    var types = (options && options.types && options.types.length) ? options.types.slice(0, 3) : ['r'];
    var board = R.emptyBoard();
    var childCols = shuffle(rng, [0, 1, 2, 3, 4, 5, 6, 7]).slice(0, types.length);
    var childSlots = types.map(function (type, i) {
      var col = childCols[i];
      board[7][col] = { type: type, team: 'me' };
      return { type: type, homeCol: col, pos: [7, col], onBoard: true };
    });

    var foeCols = shuffle(rng, [0, 1, 2, 3, 4, 5, 6, 7]).slice(0, BATTLE_PAWNS);
    foeCols.forEach(function (c) { board[1][c] = { type: 'p', team: 'foe' }; });

    return {
      id: 'battle',
      board: board,
      turn: 'me',
      moveCount: 0,
      over: false,
      winner: null,
      childSlots: childSlots,
      foePawns: foeCols.length
    };
  }

  function findSlotByPos(state, pos) {
    var slots = state.childSlots;
    for (var i = 0; i < slots.length; i++) {
      var s = slots[i];
      if (s.onBoard && s.pos[0] === pos[0] && s.pos[1] === pos[1]) return s;
    }
    return null;
  }

  /* The nearest free column on row 7 to homeCol, searching outward
   * (homeCol, homeCol-1, homeCol+1, homeCol-2, ...). Returns null if row 7
   * is entirely full (cannot happen with at most 3 child pieces). */
  function nearestFreeCol(board, homeCol) {
    for (var d = 0; d < R.SIZE; d++) {
      var candidates = d === 0 ? [homeCol] : [homeCol - d, homeCol + d];
      for (var i = 0; i < candidates.length; i++) {
        var c = candidates[i];
        if (c >= 0 && c < R.SIZE && !board[7][c]) return c;
      }
    }
    return null;
  }

  function botBattle(state, rng) {
    var board = state.board;
    var pawns = collectPositions(board, 'p', 'foe');
    var captureMoves = [];
    var advanceMoves = [];
    pawns.forEach(function (pos) {
      // Row 7 is the child's back rank; a gentle foe pawn never lands there.
      singleStepMoves(board, pos[0], pos[1], 6).forEach(function (m) {
        var mv = { from: pos, to: [m.r, m.c] };
        if (m.capture) captureMoves.push(mv); else advanceMoves.push(mv);
      });
    });

    var chosen = captureMoves.length ? captureMoves[randInt(rng, captureMoves.length)]
      : (advanceMoves.length ? advanceMoves[randInt(rng, advanceMoves.length)] : null);
    if (!chosen) {
      state.turn = 'me';
      return null;
    }

    var captured = board[chosen.to[0]][chosen.to[1]];
    board[chosen.to[0]][chosen.to[1]] = board[chosen.from[0]][chosen.from[1]];
    board[chosen.from[0]][chosen.from[1]] = null;
    state.moveCount++;

    var events = [];
    if (captured && captured.team === 'me') {
      var slot = findSlotByPos(state, chosen.to);
      if (slot) {
        slot.onBoard = false;
        var col = nearestFreeCol(board, slot.homeCol);
        if (col !== null) {
          board[7][col] = { type: slot.type, team: 'me' };
          slot.pos = [7, col];
          slot.onBoard = true;
          events.push('piece-back');
        }
      }
    }

    state.turn = 'me';
    return { from: chosen.from, to: chosen.to, captured: captured || null, events: events };
  }

  // ---- chain: Capture chain -----------------------------------------------

  /* Replays the chain on a copy of the board: from the hero's square, each
   * pawn in order must be a legal capture from where the previous capture
   * landed. */
  function chainWorks(board, hero, pawns) {
    var work = R.cloneBoard(board);
    var cur = hero;
    for (var i = 0; i < pawns.length; i++) {
      var next = pawns[i];
      var ok = R.movesFor(work, cur[0], cur[1]).some(function (m) {
        return m.capture && m.r === next[0] && m.c === next[1];
      });
      if (!ok) return false;
      work[next[0]][next[1]] = work[cur[0]][cur[1]];
      work[cur[0]][cur[1]] = null;
      cur = next;
    }
    return true;
  }

  function capturableCount(board, hero) {
    return R.movesFor(board, hero[0], hero[1]).filter(function (m) { return m.capture; }).length;
  }

  /* One attempt at a chain: each next pawn goes on a square the piece could
   * move to from the previous square (rows 1 to 6, not next to the square it
   * came from unless the piece is the king), with every pawn in place. */
  function tryChain(type, rng, strict) {
    var board = R.emptyBoard();
    var hero = [7, randInt(rng, 8)];
    board[hero[0]][hero[1]] = { type: type, team: 'me' };
    var pawns = [];
    var cur = hero;
    for (var i = 0; i < CHAIN_PAWNS; i++) {
      var work = R.cloneBoard(board);
      pawns.forEach(function (p) { work[p[0]][p[1]] = null; });
      work[hero[0]][hero[1]] = null;
      work[cur[0]][cur[1]] = { type: type, team: 'me' };
      var from = cur;
      var options = R.movesFor(work, from[0], from[1]).filter(function (m) {
        if (m.capture || m.r < 1 || m.r > 6) return false;
        if (board[m.r][m.c]) return false;
        if (type !== 'k' && Math.max(Math.abs(m.r - from[0]), Math.abs(m.c - from[1])) < 2) return false;
        return true;
      });
      if (!options.length) return null;
      var pick = options[randInt(rng, options.length)];
      pawns.push([pick.r, pick.c]);
      board[pick.r][pick.c] = { type: 'p', team: 'foe' };
      cur = [pick.r, pick.c];
    }
    if (!chainWorks(board, hero, pawns)) return null;
    // Strict: at the start only the first pawn of the chain can be
    // captured, so the chain is the obvious way through.
    if (strict && capturableCount(board, hero) !== 1) return null;
    return { board: board, hero: hero, pawns: pawns };
  }

  function createChain(options, rng) {
    var type = (options && CHAIN_TYPES.indexOf(options.type) !== -1) ? options.type : 'r';
    var made = null;
    for (var attempt = 0; attempt < MAX_ATTEMPTS * 4 && !made; attempt++) {
      made = tryChain(type, rng, attempt < MAX_ATTEMPTS * 3);
    }
    if (!made) throw new Error('chain: could not build a chain for ' + type);
    return {
      id: 'chain',
      board: made.board,
      turn: 'me',
      moveCount: 0,
      over: false,
      winner: null,
      heroType: type,
      hero: made.hero,
      chain: made.pawns,
      foePawns: CHAIN_PAWNS,
      solo: true
    };
  }

  /* The next pawn of the chain still on the board, or null. */
  function nextInChain(state) {
    if (!state.chain) return null;
    for (var i = 0; i < state.chain.length; i++) {
      var sq = state.chain[i];
      var p = state.board[sq[0]][sq[1]];
      if (p && p.team === 'foe') return sq.slice();
    }
    return null;
  }

  // ---- helpers for the "reach the other side" games ------------------------

  /* Shortest path for the one piece on `from` to a square where goal(r, c)
   * is true, every other piece standing still (a capture only removes the
   * captured piece from the square being stood on, as in FC.rules.reachable).
   * accept(work, from, move), if given, can refuse a move. Returns the list
   * of squares after `from`, ending on the goal, or null. */
  function heroPath(board, from, goal, accept) {
    var piece = board[from[0]][from[1]];
    if (!piece) return null;
    var work = R.cloneBoard(board);
    work[from[0]][from[1]] = null;
    var prev = {};
    prev[key(from)] = null;
    var queue = [from];
    while (queue.length) {
      var cur = queue.shift();
      if ((cur[0] !== from[0] || cur[1] !== from[1]) && goal(cur[0], cur[1])) {
        var path = [];
        for (var k = cur; k; k = prev[key(k)]) path.unshift(k);
        return path.slice(1);
      }
      var original = work[cur[0]][cur[1]];
      work[cur[0]][cur[1]] = piece;
      var moves = R.movesFor(work, cur[0], cur[1]);
      var ok = accept ? moves.filter(function (m) { return accept(work, cur, m); }) : moves;
      work[cur[0]][cur[1]] = original;
      ok.forEach(function (m) {
        var nk = m.r + ',' + m.c;
        if (prev[nk] !== undefined) return;
        prev[nk] = cur;
        queue.push([m.r, m.c]);
      });
    }
    return null;
  }

  function isFarRow(r) { return r === 0; }

  /* The squares the king on (r, c) could step to that the other side could
   * capture on: computed with the king lifted off the board, so it cannot
   * hide behind itself along a line. */
  function kingDanger(board, r, c) {
    var work = R.cloneBoard(board);
    var king = work[r][c];
    work[r][c] = null;
    var attacked = R.attackedSquares(work, 'foe');
    work[r][c] = king;
    return R.movesFor(work, r, c).filter(function (m) { return attacked[m.r + ',' + m.c]; });
  }

  function placeAt(board, rows, rng, type, team) {
    for (var i = 0; i < 100; i++) {
      var r = rows[0] + randInt(rng, rows[1] - rows[0] + 1);
      var c = randInt(rng, 8);
      if (!board[r][c]) {
        board[r][c] = { type: type, team: team };
        return [r, c];
      }
    }
    return null;
  }

  // ---- hop: Knight hop -----------------------------------------------------

  function createHop(options, rng) {
    var board = R.emptyBoard();
    var hero = [7, randInt(rng, 8)];
    board[hero[0]][hero[1]] = { type: 'n', team: 'me' };
    for (var i = 0; i < HOP_PAWNS; i++) placeAt(board, [2, 5], rng, 'p', 'foe');
    return {
      id: 'hop', board: board, turn: 'me', moveCount: 0, over: false, winner: null,
      heroType: 'n', hero: hero, solo: true
    };
  }

  // ---- way: Find the way ---------------------------------------------------

  function createWay(options, rng) {
    var type = (options && WAY_TYPES.indexOf(options.type) !== -1) ? options.type : 'r';
    // The king always needs seven steps, so it only needs a few blockers.
    var blockers = type === 'k' ? 3 : WAY_BLOCKERS;
    var minSteps = type === 'k' ? 7 : (type === 'b' ? 2 : 3);
    var made = null;
    for (var attempt = 0; attempt < MAX_ATTEMPTS * 4 && !made; attempt++) {
      var board = R.emptyBoard();
      var hero = [7, randInt(rng, 8)];
      board[hero[0]][hero[1]] = { type: type, team: 'me' };
      for (var i = 0; i < blockers; i++) placeAt(board, [1, 6], rng, 'p', 'me');
      var path = heroPath(board, hero, isFarRow);
      var need = attempt < MAX_ATTEMPTS * 3 ? minSteps : 2;
      if (path && path.length >= need) made = { board: board, hero: hero };
    }
    if (!made) throw new Error('way: could not build a board for ' + type);
    return {
      id: 'way', board: made.board, turn: 'me', moveCount: 0, over: false, winner: null,
      heroType: type, hero: made.hero, solo: true, heroOnly: true
    };
  }

  // ---- stop: Stop the pawns --------------------------------------------------

  function createStop(options, rng) {
    // Not the bishop: a pawn that stops on row 6 on the other colour could
    // never be captured by it.
    var type = (options && STOP_TYPES.indexOf(options.type) !== -1) ? options.type : 'r';
    var board = R.emptyBoard();
    var hero = [7, randInt(rng, 8)];
    board[hero[0]][hero[1]] = { type: type, team: 'me' };
    shuffle(rng, [0, 1, 2, 3, 4, 5, 6, 7]).slice(0, STOP_PAWNS).forEach(function (c) {
      board[1][c] = { type: 'p', team: 'foe' };
    });
    return {
      id: 'stop', board: board, turn: 'me', moveCount: 0, over: false, winner: null,
      heroType: type, hero: hero, foePawns: STOP_PAWNS
    };
  }

  // One pawn marches one step toward the child's side; never a capture,
  // never onto row 7. A pawn with the child's piece in front of it is stopped.
  function botStop(state, rng) {
    var board = state.board;
    var steps = [];
    collectPositions(board, 'p', 'foe').forEach(function (pos) {
      singleStepMoves(board, pos[0], pos[1], 6).forEach(function (m) {
        if (!m.capture) steps.push({ from: pos, to: [m.r, m.c] });
      });
    });
    state.turn = 'me';
    if (!steps.length) return null;
    var chosen = steps[randInt(rng, steps.length)];
    board[chosen.to[0]][chosen.to[1]] = board[chosen.from[0]][chosen.from[1]];
    board[chosen.from[0]][chosen.from[1]] = null;
    state.moveCount++;
    return { from: chosen.from, to: chosen.to, captured: null, events: [] };
  }

  // ---- safe: Keep the king safe ------------------------------------------------

  function createSafe(options, rng) {
    var made = null;
    for (var attempt = 0; attempt < MAX_ATTEMPTS * 4 && !made; attempt++) {
      var board = R.emptyBoard();
      var hero = [7, randInt(rng, 8)];
      board[hero[0]][hero[1]] = { type: 'k', team: 'me' };
      if (!placeAt(board, [1, 5], rng, 'r', 'foe') || !placeAt(board, [1, 5], rng, 'b', 'foe')) continue;
      var start = R.cloneBoard(board);
      start[hero[0]][hero[1]] = null;
      if (R.attackedSquares(start, 'foe')[key(hero)]) continue;
      var danger = kingDanger(board, hero[0], hero[1]);
      // Strict at first: the guards already watch at least two of the
      // king's first steps, so the idea shows at once.
      if (attempt < MAX_ATTEMPTS * 3 && danger.length < 2) continue;
      var path = heroPath(board, hero, isFarRow, safeAccept());
      if (path) made = { board: board, hero: hero };
    }
    if (!made) throw new Error('safe: could not build a board');
    return {
      id: 'safe', board: made.board, turn: 'me', moveCount: 0, over: false, winner: null,
      heroType: 'k', hero: made.hero, solo: true
    };
  }

  // For heroPath: the king never steps onto a square the guards watch
  // (guards stand still; one that is captured stops watching).
  function safeAccept() {
    return function (work, cur, m) {
      var lifted = R.cloneBoard(work);
      lifted[cur[0]][cur[1]] = null;
      return !R.attackedSquares(lifted, 'foe')[m.r + ',' + m.c];
    };
  }

  /* Catch the knight: the knight itself when it can be captured now;
   * otherwise the move that puts the most of the knight's next hops on the
   * piece's footprints (ties: the square nearest the knight), so that
   * wherever it hops, it is likely to land where it can be captured. */
  function catchHint(state) {
    var board = state.board;
    var hero = state.hero;
    var knight = state.knight;
    var now = R.movesFor(board, hero[0], hero[1]);
    if (now.some(function (m) { return m.r === knight[0] && m.c === knight[1]; })) return knight.slice();
    var hops = R.movesFor(board, knight[0], knight[1]).filter(function (m) { return !m.capture; });
    var best = null;
    var bestScore = -1;
    var bestDist = Infinity;
    now.forEach(function (m) {
      if (m.capture) return;
      var work = R.cloneBoard(board);
      work[m.r][m.c] = work[hero[0]][hero[1]];
      work[hero[0]][hero[1]] = null;
      var covers = heroAttackSet(work, [m.r, m.c], knight);
      var score = hops.filter(function (h) { return covers[h.r + ',' + h.c]; }).length;
      var dist = Math.max(Math.abs(m.r - knight[0]), Math.abs(m.c - knight[1]));
      if (score > bestScore || (score === bestScore && dist < bestDist)) {
        best = [m.r, m.c];
        bestScore = score;
        bestDist = dist;
      }
    });
    return best;
  }

  /* A square to glow as a hint, or null: the knight or a good square to
   * wait on (Catch the knight), the next pawn of a capture chain,
   * (else the first step toward the nearest pawn), the first step toward
   * the nearest pawn (Stop the pawns), or the next
   * step of a shortest way to the other side. */
  function hint(state) {
    if (state.over) return null;
    if (state.id === 'catch') return catchHint(state);
    if (state.id === 'chain') {
      // The next pawn of the chain when it is one move away; otherwise
      // (the child left the chain) the first step toward the nearest pawn.
      var next = nextInChain(state);
      var here = state.hero;
      if (next && R.movesFor(state.board, here[0], here[1]).some(function (m) {
        return m.r === next[0] && m.c === next[1];
      })) return next;
    }
    if (state.id === 'chain' || state.id === 'stop') {
      // The first step toward the nearest pawn to capture.
      var board = state.board;
      var toPawn = heroPath(board, state.hero, function (r, c) {
        var p = board[r][c];
        return !!p && p.team === 'foe';
      });
      return toPawn ? toPawn[0] : null;
    }
    if (state.id === 'hop' || state.id === 'way' || state.id === 'safe') {
      var path = heroPath(state.board, state.hero, isFarRow, state.id === 'safe' ? safeAccept() : null);
      return path ? path[0] : null;
    }
    return null;
  }

  /* 'safe' only: the squares next to the king it may not step to. */
  function dangerSquares(state, r, c) {
    if (state.id !== 'safe') return [];
    var p = state.board[r][c];
    if (!p || p.type !== 'k' || p.team !== 'me') return [];
    return kingDanger(state.board, r, c).map(function (m) { return [m.r, m.c]; });
  }

  // ---- shared API ------------------------------------------------------

  function create(id, options, rng) {
    rng = rng || Math.random;
    if (id === 'catch') return createCatch(options, rng);
    if (id === 'race') return createRace(options, rng);
    if (id === 'battle') return createBattle(options, rng);
    if (id === 'chain') return createChain(options, rng);
    if (id === 'hop') return createHop(options, rng);
    if (id === 'way') return createWay(options, rng);
    if (id === 'stop') return createStop(options, rng);
    if (id === 'safe') return createSafe(options, rng);
    throw new Error('Unknown game id: ' + id);
  }

  function legalMoves(state, r, c) {
    if (state.over || state.turn !== 'me') return [];
    var piece = state.board[r][c];
    if (!piece || piece.team !== 'me') return [];
    // Find the way: only the one piece moves; the child's pawns are in the way.
    if (state.heroOnly && (r !== state.hero[0] || c !== state.hero[1])) return [];
    var moves = R.movesFor(state.board, r, c);
    if (state.id === 'safe') {
      var danger = {};
      kingDanger(state.board, r, c).forEach(function (m) { danger[m.r + ',' + m.c] = true; });
      moves = moves.filter(function (m) { return !danger[m.r + ',' + m.c]; });
    }
    return moves;
  }

  function applyMove(state, from, to) {
    if (state.over) throw new Error('applyMove: game is already over');
    if (state.turn !== 'me') throw new Error('applyMove: not the child\'s turn');
    var moves = legalMoves(state, from[0], from[1]);
    var valid = moves.some(function (m) { return m.r === to[0] && m.c === to[1]; });
    if (!valid) throw new Error('applyMove: illegal move from ' + key(from) + ' to ' + key(to));

    var board = state.board;
    var piece = board[from[0]][from[1]];
    var captured = board[to[0]][to[1]];
    board[to[0]][to[1]] = piece;
    board[from[0]][from[1]] = null;
    state.moveCount++;

    var events = [];
    if (state.id === 'catch') {
      state.hero = [to[0], to[1]];
      state.childMoves++;
      if (captured && captured.type === 'n') {
        state.over = true;
        state.winner = 'me';
        events.push('caught');
      } else if (!state.tired && state.childMoves >= TIRED_AFTER) {
        state.tired = true;
        events.push('knight-tired');
      }
    } else if (state.id === 'race') {
      if (to[0] === 0) {
        state.over = true;
        state.winner = 'me';
        events.push('race-won');
      }
    } else if (state.id === 'battle') {
      var slot = findSlotByPos(state, from);
      if (slot) slot.pos = to;
      if (captured && captured.type === 'p') {
        state.foePawns--;
        if (state.foePawns === 0) {
          state.over = true;
          state.winner = 'me';
          events.push('battle-won');
        }
      }
    } else if (state.id === 'hop' || state.id === 'way' || state.id === 'safe') {
      state.hero = [to[0], to[1]];
      if (to[0] === 0) {
        state.over = true;
        state.winner = 'me';
        events.push('reach-won');
      }
    } else if (state.id === 'chain' || state.id === 'stop') {
      state.hero = [to[0], to[1]];
      if (captured && captured.type === 'p') {
        state.foePawns--;
        if (state.foePawns === 0) {
          state.over = true;
          state.winner = 'me';
          events.push(state.id + '-won');
        }
      }
    }

    // A solo game ('chain') never hands the turn to the other side.
    state.turn = (state.over || state.solo) ? state.turn : 'foe';
    return { captured: captured || null, events: events };
  }

  function botMove(state, rng) {
    rng = rng || Math.random;
    if (state.over || state.turn !== 'foe') return null;
    if (state.id === 'catch') return botCatch(state, rng);
    if (state.id === 'race') return botRace(state, rng);
    if (state.id === 'battle') return botBattle(state, rng);
    if (state.id === 'stop') return botStop(state, rng);
    return null;
  }

  function goalOf(id) {
    if (id === 'catch') return { kind: 'capture', target: 'n' };
    if (id === 'race') return { kind: 'reach-row', row: 0 };
    if (id === 'battle') return { kind: 'capture-all', target: 'p', count: BATTLE_PAWNS };
    if (id === 'chain') return { kind: 'capture-all', target: 'p', count: CHAIN_PAWNS };
    if (id === 'stop') return { kind: 'capture-all', target: 'p', count: STOP_PAWNS };
    if (id === 'hop' || id === 'way' || id === 'safe') return { kind: 'reach-row', row: 0 };
    return null;
  }

  var api = {
    create: create,
    legalMoves: legalMoves,
    applyMove: applyMove,
    botMove: botMove,
    goalOf: goalOf,
    nextInChain: nextInChain,
    hint: hint,
    dangerSquares: dangerSquares,
    CHAIN_TYPES: CHAIN_TYPES,
    WAY_TYPES: WAY_TYPES,
    STOP_TYPES: STOP_TYPES
  };

  if (isNode) {
    module.exports = api;
  } else {
    root.FC = root.FC || {};
    root.FC.games = api;
  }
})(this);
