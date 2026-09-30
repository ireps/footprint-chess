'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/rules.js');
const G = require('../js/games.js');

function seeded(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const SEEDS = 300;
const CATCH_TYPES = ['r', 'q', 'b', 'n', 'k'];

function boardPieces(board) {
  const out = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c]) out.push({ r, c, piece: board[r][c] });
    }
  }
  return out;
}

// A random-but-greedy child: captures with the piece(s) it controls when a
// capture is on offer, otherwise makes a uniformly random legal move. Used
// to exercise the "child always wins in the end" guarantees the same way a
// real, not-especially-strategic 6-year-old would play.
function greedyChildMove(state, rng) {
  const pieces = boardPieces(state.board).filter(p => p.piece.team === 'me');
  const all = [];
  let capture = null;
  pieces.forEach(({ r, c }) => {
    G.legalMoves(state, r, c).forEach(m => {
      const mv = { from: [r, c], to: [m.r, m.c] };
      all.push(mv);
      if (m.capture && !capture) capture = mv;
    });
  });
  if (!all.length) return null;
  return capture || all[Math.floor(rng() * all.length)];
}

function playGreedy(id, options, seed, maxChildMoves) {
  const rng = seeded(seed);
  const state = G.create(id, options, rng);
  const events = [];
  let childMoves = 0;
  let maxFoeRow = -1;
  let minChildPieces = Infinity;
  while (!state.over && childMoves <= maxChildMoves) {
    const mv = greedyChildMove(state, rng);
    assert.ok(mv, `${id} seed ${seed}: child has no legal move on move ${childMoves}`);
    const res = G.applyMove(state, mv.from, mv.to);
    events.push.apply(events, res.events);
    childMoves++;
    const childCount = boardPieces(state.board).filter(p => p.piece.team === 'me').length;
    minChildPieces = Math.min(minChildPieces, childCount);
    if (state.over) break;
    const bres = G.botMove(state, rng);
    if (bres) {
      events.push.apply(events, bres.events);
      maxFoeRow = Math.max(maxFoeRow, bres.to[0]);
    }
  }
  return { state, events, childMoves, maxFoeRow, minChildPieces };
}

// ---- create -------------------------------------------------------------

test('create "catch": hero on row 7, knight on rows 1..4, not capturable on the first move', () => {
  for (const type of CATCH_TYPES) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const state = G.create('catch', { type }, seeded(seed));
      const [hr, hc] = state.hero;
      const [kr, kc] = state.knight;
      assert.equal(hr, 7, `${type} seed ${seed}: hero row`);
      assert.deepEqual(state.board[hr][hc], { type, team: 'me' }, `${type} seed ${seed}: hero piece`);
      assert.ok(kr >= 1 && kr <= 4, `${type} seed ${seed}: knight row ${kr}`);
      assert.deepEqual(state.board[kr][kc], { type: 'n', team: 'foe' }, `${type} seed ${seed}: knight piece`);
      assert.equal(boardPieces(state.board).length, 2, `${type} seed ${seed}: only two pieces on the board`);

      const moves = R.movesFor(state.board, hr, hc);
      const capturesKnight = moves.some(m => m.r === kr && m.c === kc && m.capture);
      assert.ok(!capturesKnight, `${type} seed ${seed}: knight must not be capturable on move 1`);

      assert.equal(state.turn, 'me');
      assert.equal(state.over, false);
      assert.equal(state.winner, null);
      assert.equal(state.tired, false);
      assert.equal(state.childMoves, 0);
    }
  }
});

test('create "catch": a knight hero starts on the opposite colour square from the foe knight', () => {
  // Same-colour knight-vs-knight is a permanent parity trap (see js/games.js):
  // both pieces flip square colour every move, so the colour difference
  // between them never changes and a legal capture is never on offer.
  for (let seed = 1; seed <= SEEDS; seed++) {
    const state = G.create('catch', { type: 'n' }, seeded(seed));
    const [hr, hc] = state.hero;
    const [kr, kc] = state.knight;
    assert.notEqual(R.isLightSquare(hr, hc), R.isLightSquare(kr, kc), `seed ${seed}`);
  }
});

test('create "race": 3 child pawns on row 6, 3 foe pawns on row 1, no shared column', () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const state = G.create('race', {}, seeded(seed));
    const childCols = [];
    const foeCols = [];
    for (let c = 0; c < 8; c++) {
      if (state.board[6][c]) { assert.deepEqual(state.board[6][c], { type: 'p', team: 'me' }); childCols.push(c); }
      if (state.board[1][c]) { assert.deepEqual(state.board[1][c], { type: 'p', team: 'foe' }); foeCols.push(c); }
    }
    assert.equal(childCols.length, 3, `seed ${seed}: 3 child pawns`);
    assert.equal(foeCols.length, 3, `seed ${seed}: 3 foe pawns`);
    assert.equal(new Set(childCols.concat(foeCols)).size, 6, `seed ${seed}: no shared column`);
    assert.equal(boardPieces(state.board).length, 6, `seed ${seed}: no stray pieces`);
    assert.equal(state.turn, 'me');
  }
});

test('create "battle": child pieces on row 7 in distinct columns, 4 foe pawns on row 1', () => {
  const combos = [['r'], ['b'], ['q'], ['n'], ['k'], ['r', 'n'], ['r', 'n', 'q']];
  for (const types of combos) {
    for (let seed = 1; seed <= 50; seed++) {
      const state = G.create('battle', { types }, seeded(seed));
      assert.equal(state.childSlots.length, types.length, `${types} seed ${seed}`);
      const cols = new Set();
      state.childSlots.forEach((slot, i) => {
        assert.equal(slot.type, types[i]);
        assert.deepEqual(slot.pos, [7, slot.homeCol]);
        assert.equal(slot.onBoard, true);
        assert.deepEqual(state.board[7][slot.homeCol], { type: types[i], team: 'me' });
        cols.add(slot.homeCol);
      });
      assert.equal(cols.size, types.length, `${types} seed ${seed}: distinct columns`);

      let foeCount = 0;
      for (let c = 0; c < 8; c++) {
        if (state.board[1][c]) { assert.deepEqual(state.board[1][c], { type: 'p', team: 'foe' }); foeCount++; }
      }
      assert.equal(foeCount, 4, `${types} seed ${seed}: 4 foe pawns`);
      assert.equal(state.foePawns, 4);
      assert.equal(state.turn, 'me');
    }
  }
});

test('create: defaults to a single rook for battle, and rejects an unknown id', () => {
  const state = G.create('battle', {}, seeded(1));
  assert.deepEqual(state.childSlots.map(s => s.type), ['r']);
  assert.throws(() => G.create('nope', {}, seeded(1)), /Unknown game id/);
});

// ---- legalMoves -----------------------------------------------------------

test('legalMoves: matches FC.rules.movesFor for the child\'s own piece, empty otherwise', () => {
  const state = G.create('catch', { type: 'r' }, seeded(3));
  const [hr, hc] = state.hero;
  assert.deepEqual(G.legalMoves(state, hr, hc), R.movesFor(state.board, hr, hc));

  const [kr, kc] = state.knight;
  assert.deepEqual(G.legalMoves(state, kr, kc), [], 'not the child\'s piece');
  assert.deepEqual(G.legalMoves(state, 0, 0), [], 'empty square');

  state.turn = 'foe';
  assert.deepEqual(G.legalMoves(state, hr, hc), [], 'not the child\'s turn');
  state.turn = 'me';
  state.over = true;
  assert.deepEqual(G.legalMoves(state, hr, hc), [], 'game already over');
});

// ---- applyMove --------------------------------------------------------

test('applyMove: rejects illegal moves and moves out of turn', () => {
  const state = G.create('catch', { type: 'r' }, seeded(3));
  const [hr, hc] = state.hero;
  assert.throws(() => G.applyMove(state, [hr, hc], [hr, hc]), /illegal move/);
  state.turn = 'foe';
  assert.throws(() => G.applyMove(state, [hr, hc], [hr - 1, hc]), /child/);
});

test('applyMove "catch": capturing the knight ends the game and fires "caught"', () => {
  const board = R.emptyBoard();
  board[7][0] = { type: 'r', team: 'me' };
  board[7][3] = { type: 'n', team: 'foe' };
  const state = {
    id: 'catch', board, turn: 'me', moveCount: 0, over: false, winner: null,
    heroType: 'r', hero: [7, 0], knight: [7, 3], childMoves: 0, tired: false
  };
  const res = G.applyMove(state, [7, 0], [7, 3]);
  assert.deepEqual(res.captured, { type: 'n', team: 'foe' });
  assert.deepEqual(res.events, ['caught']);
  assert.equal(state.over, true);
  assert.equal(state.winner, 'me');
});

test('applyMove "catch": fires "knight-tired" exactly once, on the child\'s 6th move', () => {
  // Two adjacent squares the rook can always shuttle between, far from the
  // knight, so the moves never accidentally capture it first.
  const board = R.emptyBoard();
  board[7][0] = { type: 'r', team: 'me' };
  board[0][7] = { type: 'n', team: 'foe' };
  const state = {
    id: 'catch', board, turn: 'me', moveCount: 0, over: false, winner: null,
    heroType: 'r', hero: [7, 0], knight: [0, 7], childMoves: 0, tired: false
  };
  const squares = [[7, 0], [7, 1]];
  let tiredCount = 0;
  for (let i = 0; i < 6; i++) {
    const from = squares[i % 2];
    const to = squares[(i + 1) % 2];
    const res = G.applyMove(state, from, to);
    if (res.events.indexOf('knight-tired') !== -1) tiredCount++;
    if (state.over) break;
    state.turn = 'me'; // isolate applyMove behaviour without depending on botMove
  }
  assert.equal(tiredCount, 1, 'knight-tired should fire exactly once');
  assert.equal(state.tired, true);
  assert.equal(state.childMoves, 6);
});

test('applyMove "race": reaching row 0 wins with "race-won"', () => {
  const board = R.emptyBoard();
  board[1][2] = { type: 'p', team: 'me' };
  const state = { id: 'race', board, turn: 'me', moveCount: 0, over: false, winner: null };
  const res = G.applyMove(state, [1, 2], [0, 2]);
  assert.deepEqual(res.events, ['race-won']);
  assert.equal(state.over, true);
  assert.equal(state.winner, 'me');
});

test('applyMove "battle": capturing the last foe pawn wins with "battle-won"', () => {
  const board = R.emptyBoard();
  board[7][0] = { type: 'r', team: 'me' };
  board[7][1] = { type: 'p', team: 'foe' };
  const state = {
    id: 'battle', board, turn: 'me', moveCount: 0, over: false, winner: null,
    childSlots: [{ type: 'r', homeCol: 0, pos: [7, 0], onBoard: true }], foePawns: 1
  };
  const res = G.applyMove(state, [7, 0], [7, 1]);
  assert.deepEqual(res.captured, { type: 'p', team: 'foe' });
  assert.deepEqual(res.events, ['battle-won']);
  assert.equal(state.over, true);
  assert.equal(state.foePawns, 0);
});

// ---- botMove: gentleness rules -----------------------------------------

test('botMove "catch": never captures the child\'s piece, and only knight moves', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const rng = seeded(seed);
    const state = G.create('catch', { type: 'q' }, rng);
    for (let i = 0; i < 6 && !state.over; i++) {
      const mv = greedyChildMove(state, rng);
      if (!mv) break;
      G.applyMove(state, mv.from, mv.to);
      if (state.over) break;
      const bres = G.botMove(state, rng);
      if (!bres) continue;
      assert.notDeepEqual(bres.to, state.hero, `seed ${seed}: bot must not land on the hero`);
      assert.equal(bres.captured, null, `seed ${seed}: bot never captures`);
      const dr = Math.abs(bres.to[0] - bres.from[0]);
      const dc = Math.abs(bres.to[1] - bres.from[1]);
      assert.ok((dr === 1 && dc === 2) || (dr === 2 && dc === 1), `seed ${seed}: not a knight move`);
      assert.equal(state.turn, 'me');
    }
  }
});

test('botMove "race": only single steps, never onto rows 6-7, capture only leaving >=2 child pawns', () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const rng = seeded(seed);
    const state = G.create('race', {}, rng);
    for (let i = 0; i < 30 && !state.over; i++) {
      const mv = greedyChildMove(state, rng);
      if (!mv) break;
      G.applyMove(state, mv.from, mv.to);
      if (state.over) break;
      const childBefore = boardPieces(state.board).filter(p => p.piece.team === 'me').length;
      const bres = G.botMove(state, rng);
      if (!bres) continue;
      assert.equal(Math.abs(bres.to[0] - bres.from[0]), 1, `seed ${seed}: single step only`);
      assert.ok(bres.to[0] <= 5, `seed ${seed}: foe pawn must stop one row before the child's side`);
      if (bres.captured) {
        const childAfter = boardPieces(state.board).filter(p => p.piece.team === 'me').length;
        assert.ok(childAfter >= 2, `seed ${seed}: capture must leave the child with >=2 pawns`);
        assert.equal(childBefore - childAfter, 1);
      }
    }
  }
});

test('botMove "battle": single pawn steps, prefers captures, never onto row 7, returns a captured piece', () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const rng = seeded(seed);
    const state = G.create('battle', { types: ['r'] }, rng);
    for (let i = 0; i < 60 && !state.over; i++) {
      const mv = greedyChildMove(state, rng);
      if (!mv) break;
      G.applyMove(state, mv.from, mv.to);
      if (state.over) break;
      const board = state.board;
      const captureAvailable = boardPieces(board)
        .filter(p => p.piece.team === 'foe' && p.piece.type === 'p')
        .some(({ r, c }) => R.movesFor(board, r, c).some(m => Math.abs(m.r - r) === 1 && m.r <= 6 && m.capture));

      const bres = G.botMove(state, rng);
      if (!bres) continue;
      assert.equal(Math.abs(bres.to[0] - bres.from[0]), 1, `seed ${seed}: single step only`);
      assert.ok(bres.to[0] <= 6, `seed ${seed}: foe pawn must never reach row 7`);
      if (captureAvailable) assert.ok(bres.captured, `seed ${seed}: a capture was available and should be preferred`);

      if (bres.captured && bres.captured.team === 'me') {
        assert.deepEqual(bres.events, ['piece-back']);
        const backSlot = state.childSlots.find(s => s.onBoard && s.pos[0] === 7);
        assert.ok(backSlot, `seed ${seed}: a slot must be back on row 7`);
        assert.deepEqual(state.board[backSlot.pos[0]][backSlot.pos[1]], { type: backSlot.type, team: 'me' });
      }
      const childCount = boardPieces(state.board).filter(p => p.piece.team === 'me').length;
      assert.ok(childCount >= 1, `seed ${seed}: child must always have at least one piece`);
    }
  }
});

test('botMove "battle": returns a captured piece to the nearest free column to its start', () => {
  const board = R.emptyBoard();
  board[7][3] = { type: 'n', team: 'me' }; // sitting on the rook's home column
  board[6][2] = { type: 'r', team: 'me' }; // the rook, off row 7, about to be captured
  board[5][1] = { type: 'p', team: 'foe' }; // diagonal-forward capture lands on (6, 2)
  const state = {
    id: 'battle', board, turn: 'foe', moveCount: 0, over: false, winner: null,
    childSlots: [
      { type: 'r', homeCol: 3, pos: [6, 2], onBoard: true },
      { type: 'n', homeCol: 4, pos: [7, 3], onBoard: true }
    ],
    foePawns: 1
  };
  const rng = seeded(42);
  const res = G.botMove(state, rng);
  assert.deepEqual(res.captured, { type: 'r', team: 'me' });
  assert.deepEqual(res.events, ['piece-back']);
  // Column 3 (the rook's own home) is occupied by the knight; nearest free is column 2.
  const slot = state.childSlots[0];
  assert.equal(slot.onBoard, true);
  assert.deepEqual(slot.pos, [7, 2]);
  assert.deepEqual(state.board[7][2], { type: 'r', team: 'me' });
});

test('botMove: returns null and hands the turn back when the bot has no legal move', () => {
  const board = R.emptyBoard();
  board[7][0] = { type: 'r', team: 'me' };
  board[6][0] = { type: 'p', team: 'foe' }; // boxed in by its own back rank rule (row 6 -> row 7 is forbidden)
  const state = { id: 'race', board, turn: 'foe', moveCount: 0, over: false, winner: null };
  const res = G.botMove(state, seeded(1));
  assert.equal(res, null);
  assert.equal(state.turn, 'me');
});

// ---- goalOf ---------------------------------------------------------------

test('goalOf: short machine descriptions for each game', () => {
  assert.deepEqual(G.goalOf('catch'), { kind: 'capture', target: 'n' });
  assert.deepEqual(G.goalOf('race'), { kind: 'reach-row', row: 0 });
  assert.deepEqual(G.goalOf('battle'), { kind: 'capture-all', target: 'p', count: 4 });
  assert.equal(G.goalOf('nope'), null);
});

// ---- guarantees (no fail state) ------------------------------------------

test('guarantee "catch": every piece type finishes within 20 child moves for 300 seeds', () => {
  for (const type of CATCH_TYPES) {
    let max = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const { state, childMoves } = playGreedy('catch', { type }, seed, 20);
      assert.ok(state.over, `${type} seed ${seed}: did not finish within 20 child moves`);
      assert.equal(state.winner, 'me');
      max = Math.max(max, childMoves);
    }
    assert.ok(max <= 20, `${type}: worst case ${max} child moves`);
  }
});

test('guarantee "race": a random child wins within 30 moves, never drops below 2 pawns, foe never reaches row 6', () => {
  let max = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    // A plain random child (not greedy) per the spec.
    const rng = seeded(seed);
    const state = G.create('race', {}, rng);
    let childMoves = 0;
    let minPawns = Infinity;
    let maxFoeRow = -1;
    while (!state.over && childMoves <= 30) {
      const pieces = boardPieces(state.board).filter(p => p.piece.team === 'me');
      const all = [];
      pieces.forEach(({ r, c }) => G.legalMoves(state, r, c).forEach(m => all.push({ from: [r, c], to: [m.r, m.c] })));
      assert.ok(all.length, `race seed ${seed}: child has no legal move`);
      const mv = all[Math.floor(rng() * all.length)];
      G.applyMove(state, mv.from, mv.to);
      childMoves++;
      minPawns = Math.min(minPawns, boardPieces(state.board).filter(p => p.piece.team === 'me').length);
      if (state.over) break;
      const bres = G.botMove(state, rng);
      if (bres) maxFoeRow = Math.max(maxFoeRow, bres.to[0]);
    }
    assert.ok(state.over, `race seed ${seed}: did not finish within 30 moves`);
    assert.ok(minPawns >= 2, `race seed ${seed}: child pawns dropped below 2`);
    assert.ok(maxFoeRow <= 5, `race seed ${seed}: a foe pawn reached row 6`);
    max = Math.max(max, childMoves);
  }
  assert.ok(max <= 30, `race: worst case ${max} moves`);
});

test('guarantee "battle": a random-but-greedy child (default rook) wins within 60 moves for 300 seeds', () => {
  let max = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const { state, childMoves } = playGreedy('battle', { types: ['r'] }, seed, 60);
    assert.ok(state.over, `battle seed ${seed}: did not finish within 60 moves`);
    assert.equal(state.winner, 'me');
    max = Math.max(max, childMoves);
  }
  assert.ok(max <= 60, `battle: worst case ${max} moves`);
});

// ---- chain (stage 6) ----------------------------------------------------

test('create "chain": hero on row 7, four foe pawns on rows 1..6 forming a legal capture chain', () => {
  for (const type of G.CHAIN_TYPES) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const state = G.create('chain', { type }, seeded(seed));
      assert.equal(state.hero[0], 7);
      assert.equal(state.chain.length, 4);
      const pawns = boardPieces(state.board).filter(p => p.piece.team === 'foe');
      assert.equal(pawns.length, 4);
      pawns.forEach(p => assert.ok(p.r >= 1 && p.r <= 6 && p.piece.type === 'p'));
      // Following the chain captures every pawn, one move each.
      let cur = state.hero;
      for (const sq of state.chain) {
        const mv = G.legalMoves(state, cur[0], cur[1]).find(m => m.r === sq[0] && m.c === sq[1]);
        assert.ok(mv && mv.capture, `${type} seed ${seed}: chain link ${sq} is not a capture from ${cur}`);
        G.applyMove(state, cur, sq);
        cur = sq;
      }
      assert.ok(state.over && state.winner === 'me');
    }
  }
});

test('create "chain": usually only the first pawn can be captured at the start', () => {
  let strict = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const state = G.create('chain', { type: 'q' }, seeded(seed));
    const caps = G.legalMoves(state, state.hero[0], state.hero[1]).filter(m => m.capture);
    if (caps.length === 1) strict++;
  }
  assert.ok(strict >= SEEDS * 0.9, `only ${strict} of ${SEEDS} start with a single capture`);
});

test('applyMove "chain": the turn stays with the child, nextInChain follows the captures, "chain-won" ends it', () => {
  const state = G.create('chain', { type: 'n' }, seeded(7));
  assert.deepEqual(G.nextInChain(state), state.chain[0]);
  // A move that captures nothing keeps the child's turn.
  const quiet = G.legalMoves(state, state.hero[0], state.hero[1]).find(m => !m.capture);
  G.applyMove(state, state.hero, [quiet.r, quiet.c]);
  assert.equal(state.turn, 'me');
  assert.equal(G.botMove(state), null);
  assert.deepEqual(state.hero, [quiet.r, quiet.c]);
  assert.equal(G.goalOf('chain').count, 4);
});

test('guarantee "chain": a random-but-greedy child captures every pawn within 60 moves', () => {
  for (const type of G.CHAIN_TYPES) {
    for (let seed = 1; seed <= 100; seed++) {
      const out = playGreedy('chain', { type }, seed, 60);
      assert.ok(out.state.over, `${type} seed ${seed}: not finished in 60 moves`);
      assert.ok(out.events.includes('chain-won'));
    }
  }
});

test('create "chain": an unknown piece type falls back to the rook', () => {
  assert.equal(G.create('chain', { type: 'p' }, seeded(1)).heroType, 'r');
});

// ---- hop, way, stop, safe (stage 6, parts 2 and 3) ----------------------

// A child that follows the hint when there is one, else plays greedily.
function hintChildMove(state, rng) {
  const h = G.hint(state);
  if (h && state.hero) {
    const ok = G.legalMoves(state, state.hero[0], state.hero[1]).some(m => m.r === h[0] && m.c === h[1]);
    if (ok) return { from: state.hero, to: h };
  }
  return greedyChildMove(state, rng);
}

function playWith(id, options, seed, maxChildMoves, chooser) {
  const rng = seeded(seed);
  const state = G.create(id, options, rng);
  const events = [];
  let childMoves = 0;
  while (!state.over && childMoves < maxChildMoves) {
    const mv = chooser(state, rng);
    assert.ok(mv, `${id} seed ${seed}: child has no legal move`);
    const res = G.applyMove(state, mv.from, mv.to);
    events.push.apply(events, res.events);
    childMoves++;
    if (state.over) break;
    const b = G.botMove(state, rng);
    if (b) events.push.apply(events, b.events);
  }
  return { state, events, childMoves };
}

test('create "hop": a knight on row 7 and three still pawns on rows 2..5; solo', () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const state = G.create('hop', {}, seeded(seed));
    assert.equal(state.hero[0], 7);
    assert.deepEqual(state.board[7][state.hero[1]], { type: 'n', team: 'me' });
    const foes = boardPieces(state.board).filter(p => p.piece.team === 'foe');
    assert.equal(foes.length, 3);
    foes.forEach(p => assert.ok(p.r >= 2 && p.r <= 5));
    assert.ok(state.solo);
  }
});

test('guarantee "hop": following the hint reaches the other side in at most 6 moves', () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const out = playWith('hop', {}, seed, 6, hintChildMove);
    assert.ok(out.state.over && out.events.includes('reach-won'), `hop seed ${seed}`);
    assert.equal(out.state.hero[0], 0);
  }
});

test('"hop", "way", "safe": wherever a random child wanders, there is always a hint to the other side', () => {
  for (const id of ['hop', 'way', 'safe']) {
    for (let seed = 1; seed <= 60; seed++) {
      const rng = seeded(seed);
      const state = G.create(id, {}, rng);
      for (let i = 0; i < 25 && !state.over; i++) {
        assert.ok(G.hint(state), `${id} seed ${seed}: no hint after ${i} moves`);
        const mv = greedyChildMove(state, rng);
        assert.ok(mv, `${id} seed ${seed}: stuck`);
        G.applyMove(state, mv.from, mv.to);
      }
    }
  }
});

test('create "way": only the one piece moves, it cannot reach the other side in one move, and a way exists', () => {
  for (const type of G.WAY_TYPES) {
    for (let seed = 1; seed <= 100; seed++) {
      const state = G.create('way', { type }, seeded(seed));
      assert.equal(state.heroType, type);
      const own = boardPieces(state.board).filter(p => p.piece.team === 'me' && p.piece.type === 'p');
      assert.ok(own.length >= 3);
      own.forEach(p => assert.deepEqual(G.legalMoves(state, p.r, p.c), []));
      const first = G.legalMoves(state, state.hero[0], state.hero[1]);
      assert.ok(!first.some(m => m.r === 0), `${type} seed ${seed}: reachable in one move`);
      assert.ok(first.every(m => !m.capture), 'the hero never captures its own pawns');
      assert.ok(G.hint(state), `${type} seed ${seed}: no way to the other side`);
    }
  }
});

test('guarantee "way": following the hint reaches the other side', () => {
  for (const type of G.WAY_TYPES) {
    for (let seed = 1; seed <= 100; seed++) {
      const out = playWith('way', { type }, seed, 20, hintChildMove);
      assert.ok(out.state.over && out.events.includes('reach-won'), `${type} seed ${seed}`);
    }
  }
});

test('create "stop": three foe pawns on row 1, the child\'s piece on row 7; team game', () => {
  const state = G.create('stop', { type: 'q' }, seeded(5));
  assert.equal(boardPieces(state.board).filter(p => p.piece.team === 'foe' && p.r === 1).length, 3);
  assert.equal(state.heroType, 'q');
  assert.ok(!state.solo);
});

test('botMove "stop": one single step forward, never a capture, never onto row 7; a blocked pawn stays', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const rng = seeded(seed);
    const state = G.create('stop', { type: 'r' }, rng);
    for (let i = 0; i < 30 && !state.over; i++) {
      const mv = greedyChildMove(state, rng);
      G.applyMove(state, mv.from, mv.to);
      if (state.over) break;
      const b = G.botMove(state, rng);
      if (!b) { assert.equal(state.turn, 'me'); continue; }
      assert.equal(b.to[0] - b.from[0], 1);
      assert.equal(b.to[1], b.from[1]);
      assert.equal(b.captured, null);
      assert.ok(b.to[0] <= 6);
    }
  }
  // A pawn with a piece in front of it cannot move.
  const state = G.create('stop', { type: 'r' }, seeded(9));
  const R0 = state.board;
  const pawns = boardPieces(R0).filter(p => p.piece.team === 'foe');
  for (let c = 0; c < 8; c++) if (R0[1][c]) R0[1][c] = null;
  R0[1][pawns[0].c] = { type: 'p', team: 'foe' };
  R0[state.hero[0]][state.hero[1]] = null;
  R0[2][pawns[0].c] = { type: 'r', team: 'me' };
  state.hero = [2, pawns[0].c];
  state.turn = 'foe';
  assert.equal(G.botMove(state, seeded(1)), null);
});

test('guarantee "stop": following the hint captures all three pawns within 40 moves; a random-but-greedy rook or queen within 60', () => {
  assert.equal(G.create('stop', { type: 'b' }, seeded(1)).heroType, 'r');
  for (const type of G.STOP_TYPES) {
    for (let seed = 1; seed <= 100; seed++) {
      const hinted = playWith('stop', { type }, seed, 40, hintChildMove);
      assert.ok(hinted.state.over, `${type} seed ${seed}: following the hint did not finish in 40 moves`);
      if (type === 'k' || type === 'n') continue; // a wandering king or knight is slow, not stuck
      const out = playGreedy('stop', { type }, seed, 60);
      assert.ok(out.state.over, `${type} seed ${seed}`);
      assert.ok(out.events.includes('stop-won'));
      assert.ok(out.minChildPieces >= 1);
    }
  }
});

test('create "safe": the king starts safe, the guards already watch some first steps, and a safe way exists', () => {
  let strict = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const state = G.create('safe', {}, seeded(seed));
    assert.deepEqual(state.board[state.hero[0]][state.hero[1]], { type: 'k', team: 'me' });
    const foes = boardPieces(state.board).filter(p => p.piece.team === 'foe').map(p => p.piece.type).sort();
    assert.deepEqual(foes, ['b', 'r']);
    if (G.dangerSquares(state, state.hero[0], state.hero[1]).length >= 2) strict++;
    assert.ok(G.hint(state), `safe seed ${seed}: no safe way`);
  }
  assert.ok(strict >= SEEDS * 0.9);
});

test('legalMoves "safe": never a square a guard could capture on, and dangerSquares lists exactly those', () => {
  const R2 = require('../js/rules.js');
  for (let seed = 1; seed <= SEEDS; seed++) {
    const state = G.create('safe', {}, seeded(seed));
    const [kr, kc] = state.hero;
    const all = R2.movesFor(state.board, kr, kc).map(m => m.r + ',' + m.c);
    const legal = G.legalMoves(state, kr, kc).map(m => m.r + ',' + m.c);
    const danger = G.dangerSquares(state, kr, kc).map(sq => sq.join(','));
    assert.deepEqual([...legal, ...danger].sort(), all.sort());
    // Check each legal square by hand: no guard's move (with the king lifted) lands on it.
    const lifted = R2.cloneBoard(state.board);
    lifted[kr][kc] = null;
    for (const sq of legal) {
      const [r, c] = sq.split(',').map(Number);
      const probe = R2.cloneBoard(lifted);
      probe[r][c] = { type: 'k', team: 'me' };
      for (const g of boardPieces(probe).filter(p => p.piece.team === 'foe' && !(p.r === r && p.c === c))) {
        const hits = R2.movesFor(probe, g.r, g.c).some(m => m.r === r && m.c === c);
        assert.ok(!hits, `safe seed ${seed}: ${sq} is watched`);
      }
    }
  }
});

test('guarantee "safe": following the hint walks the king to the other side safely', () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const out = playWith('safe', {}, seed, 30, hintChildMove);
    assert.ok(out.state.over && out.events.includes('reach-won'), `safe seed ${seed}`);
  }
});

test('hint: null for games without one', () => {
  assert.equal(G.hint(G.create('race', {}, seeded(1))), null);
  assert.deepEqual(G.dangerSquares(G.create('race', {}, seeded(1)), 6, 0), []);
});

test('hint "chain" and "stop": always a square the piece can move to now, even after leaving the chain', () => {
  for (const id of ['chain', 'stop']) {
    for (let seed = 1; seed <= 100; seed++) {
      const rng = seeded(seed);
      const state = G.create(id, { type: 'r' }, rng);
      for (let i = 0; i < 12 && !state.over; i++) {
        const h = G.hint(state);
        assert.ok(h, `${id} seed ${seed}: no hint`);
        const ok = G.legalMoves(state, state.hero[0], state.hero[1]).some(m => m.r === h[0] && m.c === h[1]);
        assert.ok(ok, `${id} seed ${seed}: hint ${h} is not a move from ${state.hero}`);
        const mv = greedyChildMove(state, rng);
        G.applyMove(state, mv.from, mv.to);
        if (!state.over) G.botMove(state, rng);
      }
    }
  }
});

test('hint "catch": the knight when it can be captured, else a move that covers some of its hops', () => {
  for (const type of CATCH_TYPES) {
    for (let seed = 1; seed <= 100; seed++) {
      const rng = seeded(seed);
      const state = G.create('catch', { type }, rng);
      for (let i = 0; i < 8 && !state.over; i++) {
        const h = G.hint(state);
        assert.ok(h, `${type} seed ${seed}: no hint`);
        const moves = G.legalMoves(state, state.hero[0], state.hero[1]);
        assert.ok(moves.some(m => m.r === h[0] && m.c === h[1]), `${type} seed ${seed}: hint is not a move`);
        const catchNow = moves.some(m => m.r === state.knight[0] && m.c === state.knight[1]);
        if (catchNow) assert.deepEqual(h, state.knight);
        G.applyMove(state, state.hero, h);
        if (!state.over) G.botMove(state, rng);
      }
    }
  }
});

test('guarantee "catch": following the hint catches the knight within 12 moves', () => {
  for (const type of CATCH_TYPES) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const rng = seeded(seed);
      const state = G.create('catch', { type }, rng);
      let n = 0;
      while (!state.over && n < 12) {
        G.applyMove(state, state.hero, G.hint(state));
        n++;
        if (!state.over) G.botMove(state, rng);
      }
      assert.ok(state.over, `${type} seed ${seed}: not caught in 12`);
    }
  }
});

// ---- escape: Get out of check (stage 7) ----------------------------------

test('escape puzzles: the king is in check, a way out exists, and block/capture puzzles allow only that way', () => {
  for (const kind of Object.keys(G.ESCAPE_PUZZLES)) {
    G.ESCAPE_PUZZLES[kind].forEach((list, n) => {
      for (const mirror of [false, true]) {
        const board = G.puzzleBoard(list, mirror);
        const tag = `${kind} ${n}${mirror ? ' mirrored' : ''}`;
        assert.ok(R.inCheck(board, 'me'), `${tag}: not in check`);
        const moves = [];
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
          const p = board[r][c];
          if (p && p.team === 'me') R.legalMoves(board, r, c).forEach(m => moves.push({ p, m }));
        }
        assert.ok(moves.length, `${tag}: no way out`);
        if (kind === 'step') assert.ok(moves.some(x => x.p.type === 'k' && !x.m.capture), `${tag}: the king cannot step away`);
        if (kind === 'block') moves.forEach(x => assert.ok(x.p.type !== 'k' && !x.m.capture, `${tag}: a move that is not a block`));
        if (kind === 'capture') moves.forEach(x => assert.ok(x.m.capture, `${tag}: a move that is not a capture`));
        assert.equal(R.isCheckmate(board, 'me'), false);
      }
    });
  }
});

test('escape: five puzzles (two step, a block, two captures), no repeats; any legal move solves one; the fifth wins', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const rng = seeded(seed);
    const state = G.create('escape', {}, rng);
    assert.deepEqual(state.puzzles.map(p => p.kind), ['step', 'step', 'block', 'capture', 'capture']);
    const ids = state.puzzles.map(p => p.kind + p.n);
    assert.equal(new Set(ids).size, ids.length, `seed ${seed}: a puzzle repeats`);
    for (let i = 0; i < 5; i++) {
      assert.ok(R.inCheck(state.board, 'me'));
      const h = G.hint(state);
      const moves = G.legalMoves(state, h[0], h[1]);
      assert.ok(moves.length, `seed ${seed}: the hint piece cannot move`);
      const res = G.applyMove(state, h, [moves[0].r, moves[0].c]);
      assert.ok(res.events.includes('escaped'));
      assert.equal(R.inCheck(state.board, 'me'), false);
      assert.deepEqual(G.legalMoves(state, state.hero[0], state.hero[1]), [], 'nothing moves until the next puzzle');
      if (i < 4) { assert.ok(!state.over); assert.ok(G.nextPuzzle(state)); }
    }
    assert.ok(state.over && state.winner === 'me');
    assert.equal(G.nextPuzzle(state), false);
  }
});

test('escape: a king step into check is never legal, and dangerSquares names it', () => {
  const state = G.create('escape', {}, seeded(3));
  const [kr, kc] = state.hero;
  const legal = G.legalMoves(state, kr, kc).map(m => m.r + ',' + m.c);
  const danger = G.dangerSquares(state, kr, kc).map(sq => sq.join(','));
  danger.forEach(d => assert.ok(!legal.includes(d)));
});

// ---- run: Run away (stage 7) ----------------------------------------------

function chaserOf(state) {
  return boardPieces(state.board).find(p => p.piece.team === 'foe');
}

test('create "run": a chaser of another kind, not watching the start square and not capturable; two safe first moves', () => {
  for (const type of G.CHAIN_TYPES) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const state = G.create('run', { type }, seeded(seed));
      const ch = chaserOf(state);
      assert.equal(ch.piece.type, G.RUN_CHASER[type]);
      assert.notEqual(ch.piece.type, type);
      assert.ok(ch.r >= 1 && ch.r <= 3);
      assert.ok(!R.attacks(state.board, ch.r, ch.c).some(sq => sq[0] === state.hero[0] && sq[1] === state.hero[1]));
      assert.ok(G.legalMoves(state, state.hero[0], state.hero[1]).length >= 2);
    }
  }
});

test('legalMoves "run": never a square the chaser could capture on (checked by hand), and dangerSquares lists the rest', () => {
  for (const type of G.CHAIN_TYPES) {
    for (let seed = 1; seed <= 100; seed++) {
      const rng = seeded(seed);
      const state = G.create('run', { type }, rng);
      for (let i = 0; i < 6 && !state.over; i++) {
        const [hr, hc] = state.hero;
        const legal = G.legalMoves(state, hr, hc);
        const danger = G.dangerSquares(state, hr, hc).map(sq => sq.join(','));
        const all = R.movesFor(state.board, hr, hc).map(m => m.r + ',' + m.c);
        assert.deepEqual([...legal.map(m => m.r + ',' + m.c), ...danger].sort(), all.sort());
        for (const m of legal) {
          if (m.capture) continue;
          const probe = R.cloneBoard(state.board);
          probe[m.r][m.c] = probe[hr][hc];
          probe[hr][hc] = null;
          const ch = chaserOf({ board: probe });
          assert.ok(!R.movesFor(probe, ch.r, ch.c).some(x => x.r === m.r && x.c === m.c), `${type} seed ${seed}: ${m.r},${m.c} is watched`);
        }
        G.applyMove(state, state.hero, [legal[0].r, legal[0].c]);
        if (!state.over) G.botMove(state, rng);
      }
    }
  }
});

test('guarantee "run": a random child always has a safe move, the chaser never captures, and it ends in six moves', () => {
  for (const type of G.CHAIN_TYPES) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const out = playWith('run', { type }, seed, G.RUN_MOVES, greedyChildMove);
      assert.ok(out.state.over && out.events.includes('run-won'), `${type} seed ${seed}`);
      assert.equal(boardPieces(out.state.board).filter(p => p.piece.team === 'me').length, 1);
    }
  }
});

test('hint "run": a safe move', () => {
  const state = G.create('run', { type: 'q' }, seeded(4));
  const h = G.hint(state);
  assert.ok(G.legalMoves(state, state.hero[0], state.hero[1]).some(m => m.r === h[0] && m.c === h[1]));
});
