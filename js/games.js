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

  // ---- shared API ------------------------------------------------------

  function create(id, options, rng) {
    rng = rng || Math.random;
    if (id === 'catch') return createCatch(options, rng);
    if (id === 'race') return createRace(options, rng);
    if (id === 'battle') return createBattle(options, rng);
    if (id === 'chain') return createChain(options, rng);
    throw new Error('Unknown game id: ' + id);
  }

  function legalMoves(state, r, c) {
    if (state.over || state.turn !== 'me') return [];
    var piece = state.board[r][c];
    if (!piece || piece.team !== 'me') return [];
    return R.movesFor(state.board, r, c);
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
    } else if (state.id === 'chain') {
      state.hero = [to[0], to[1]];
      if (captured && captured.type === 'p') {
        state.foePawns--;
        if (state.foePawns === 0) {
          state.over = true;
          state.winner = 'me';
          events.push('chain-won');
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
    return null;
  }

  function goalOf(id) {
    if (id === 'catch') return { kind: 'capture', target: 'n' };
    if (id === 'race') return { kind: 'reach-row', row: 0 };
    if (id === 'battle') return { kind: 'capture-all', target: 'p', count: BATTLE_PAWNS };
    if (id === 'chain') return { kind: 'capture-all', target: 'p', count: CHAIN_PAWNS };
    return null;
  }

  var api = {
    create: create,
    legalMoves: legalMoves,
    applyMove: applyMove,
    botMove: botMove,
    goalOf: goalOf,
    nextInChain: nextInChain,
    CHAIN_TYPES: CHAIN_TYPES
  };

  if (isNode) {
    module.exports = api;
  } else {
    root.FC = root.FC || {};
    root.FC.games = api;
  }
})(this);
