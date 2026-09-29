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
