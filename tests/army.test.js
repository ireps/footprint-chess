'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/rules.js');
const A = require('../js/army.js');
const G = require('../js/games.js');

// A small seeded random source, so every run plays the same games.
function seeded(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function count(board, team, type) {
  let n = 0;
  for (const row of board) for (const p of row) if (p && p.team === team && (!type || p.type === type)) n++;
  return n;
}

function childMoves(state) {
  const out = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      A.legalMoves(state, r, c).forEach(m => out.push({ from: [r, c], to: [m.r, m.c] }));
    }
  }
  return out;
}

/* Plays one game: the child picks with pick(state, rng); the opponent is
 * the real gentle opponent. check(state) runs after every move. Returns
 * the number of child moves, or -1 if the game did not end. */
function play(id, seed, pick, check, limit) {
  const rng = seeded(seed);
  const state = A.create(id, {}, rng);
  let n = 0;
  while (!state.over && n < limit) {
    if (state.turn === 'me') {
      const mv = pick(state, rng);
      assert.ok(mv, `${id} seed ${seed}: the child has no move`);
      A.applyMove(state, mv.from, mv.to);
      n++;
    } else {
      A.botMove(state, rng);
      assert.equal(state.turn === 'me' || state.over, true);
    }
    if (check) check(state);
  }
  return state.over ? n : -1;
}

test('each level sets up both sides as in a real game, with only its kinds of piece', () => {
  for (const lv of A.LEVELS) {
    const s = A.create(lv.id, {}, Math.random);
    assert.equal(s.army, true);
    assert.equal(s.turn, 'me');
    for (let c = 0; c < 8; c++) {
      assert.deepEqual(s.board[6][c], { type: 'p', team: 'me' });
      assert.deepEqual(s.board[1][c], { type: 'p', team: 'foe' });
      const t = A.BACK_ROW[c];
      const want = lv.types.includes(t) ? t : null;
      assert.equal(s.board[7][c] && s.board[7][c].type, want === null ? null : want, `${lv.id} col ${c}`);
      assert.equal(s.board[0][c] && s.board[0][c].type, want === null ? null : want);
    }
    assert.equal(s.startPieces, count(s.board, 'me'));
  }
  assert.deepEqual(A.LEVELS.map(l => l.types.length), [1, 2, 3, 4, 5, 6, 6]);
  assert.deepEqual(A.LEVELS.map(l => l.id), ['army1', 'army2', 'army3', 'army4', 'army5', 'army6', 'army7']);
});

test('the opponent gets a little stronger at each level', () => {
  for (let i = 1; i < A.LEVELS.length; i++) assert.ok(A.LEVELS[i].mistake < A.LEVELS[i - 1].mistake);
});

test('js/games.js hands the growing battle to js/army.js', () => {
  const s = G.create('army2', {}, seeded(1));
  assert.equal(s.army, true);
  assert.deepEqual(G.legalMoves(s, 7, 0), A.legalMoves(s, 7, 0));
  assert.deepEqual(G.goalOf('army1'), { kind: 'reach-row', row: 0 });
  assert.equal(G.goalOf('army3').kind, 'pawns-or-reach');
  G.applyMove(s, [6, 4], [4, 4]);
  assert.equal(s.turn, 'foe');
  assert.ok(G.botMove(s, seeded(2)));
  assert.equal(s.turn, 'me');
});

test('the child moves only their own pieces, only on their turn', () => {
  const s = A.create('army1', {}, Math.random);
  assert.equal(A.legalMoves(s, 1, 3).length, 0);
  assert.equal(A.legalMoves(s, 6, 3).length, 2);
  A.applyMove(s, [6, 3], [4, 3]);
  assert.equal(A.legalMoves(s, 4, 3).length, 0);
  assert.throws(() => A.applyMove(s, [6, 4], [5, 4]));
});

test('a pawn reaching the other side wins, and so does capturing their last pawn', () => {
  const s = A.create('army1', {}, Math.random);
  s.board = R.emptyBoard();
  s.board[1][2] = { type: 'p', team: 'me' };
  s.board[1][6] = { type: 'p', team: 'foe' };
  const res = A.applyMove(s, [1, 2], [0, 2]);
  assert.deepEqual(res.events, ['army-won']);
  assert.equal(s.over, true);
  assert.equal(s.winner, 'me');

  const t = A.create('army2', {}, Math.random);
  t.board = R.emptyBoard();
  t.board[7][0] = { type: 'r', team: 'me' };
  t.board[6][3] = { type: 'p', team: 'me' };
  t.board[3][0] = { type: 'p', team: 'foe' };
  t.board[0][7] = { type: 'r', team: 'foe' };
  const res2 = A.applyMove(t, [7, 0], [3, 0]);
  assert.equal(res2.captured.type, 'p');
  assert.deepEqual(res2.events, ['army-won']);
});

test('inDanger: a piece the other side could capture, unless protected by a piece worth less', () => {
  const b = R.emptyBoard();
  // A pawn the opponent's pawn could capture, with nobody protecting it.
  b[4][3] = { type: 'p', team: 'me' };
  b[3][2] = { type: 'p', team: 'foe' };
  assert.deepEqual(A.inDanger(b, 'me'), [[4, 3]]);
  // Protected by another pawn: not in danger.
  b[5][4] = { type: 'p', team: 'me' };
  assert.deepEqual(A.inDanger(b, 'me'), []);
  // A rook the opponent's pawn could capture: in danger even though protected.
  b[4][3] = { type: 'r', team: 'me' };
  assert.deepEqual(A.inDanger(b, 'me'), [[4, 3]]);
});

test('the opponent captures a free piece when it does not miss on purpose', () => {
  const s = A.create('army2', {}, Math.random);
  s.board = R.emptyBoard();
  for (let c = 0; c < 8; c++) s.board[6][c] = { type: 'p', team: 'me' };
  s.board[7][0] = { type: 'r', team: 'me' };
  s.board[4][4] = { type: 'r', team: 'me' };  // free for the opponent's rook
  s.board[0][4] = { type: 'r', team: 'foe' };
  s.board[1][0] = { type: 'p', team: 'foe' };
  s.startPieces = 10;
  s.turn = 'foe';
  // rng 0.99: never takes the "mistake" branch.
  const mv = A.botMove(s, () => 0.99);
  assert.deepEqual(mv.to, [4, 4]);
  assert.equal(mv.captured.type, 'r');
  assert.deepEqual(s.lastFoe, { from: [0, 4], to: [4, 4] });
});

test('the opponent never takes the child below half their pieces, or their last big piece', () => {
  const s = A.create('army2', {}, Math.random);
  s.board = R.emptyBoard();
  s.board[4][4] = { type: 'r', team: 'me' };
  s.board[6][0] = { type: 'p', team: 'me' };
  s.board[6][7] = { type: 'p', team: 'me' };
  s.board[0][4] = { type: 'r', team: 'foe' };
  s.board[1][1] = { type: 'p', team: 'foe' };
  s.startPieces = 6;
  s.turn = 'foe';
  for (let i = 0; i < 20; i++) {
    const copy = { ...s, board: R.cloneBoard(s.board) };
    const mv = A.botMove(copy, seeded(i));
    assert.ok(!mv.captured, 'captured below half');
  }
  s.startPieces = 4;
  for (let i = 0; i < 20; i++) {
    const copy = { ...s, board: R.cloneBoard(s.board) };
    const mv = A.botMove(copy, seeded(i));
    assert.ok(!mv.captured || mv.captured.type !== 'r', 'captured the last rook');
  }
});

test('the opponent\'s pawns never step onto the child\'s home row', () => {
  for (const lv of A.LEVELS.filter(l => l.goal !== 'mate')) {
    for (let seed = 1; seed <= 25; seed++) {
      play(lv.id, seed, (s, rng) => { const all = childMoves(s); return all[Math.floor(rng() * all.length)]; }, (s) => {
        for (let c = 0; c < 8; c++) {
          const p = s.board[7][c];
          assert.ok(!(p && p.team === 'foe' && p.type === 'p'), `${lv.id} seed ${seed}`);
        }
      }, 800);
    }
  }
});

function hintMove(s) {
  const piece = A.hint(s, null);
  return { from: piece, to: A.hint(s, piece) };
}

test('a child who follows the hints wins every level, in a short game', () => {
  for (const lv of A.LEVELS.filter(l => l.goal !== 'mate')) {
    for (let seed = 1; seed <= 40; seed++) {
      const n = play(lv.id, seed, hintMove, null, 90);
      assert.ok(n > 0, `${lv.id} seed ${seed}: not won in 90 moves`);
    }
  }
});

test('with the kings, a child who follows the hints gives checkmate', () => {
  for (let seed = 1; seed <= 8; seed++) {
    const rng = seeded(seed);
    const s = A.create('army6', {}, rng);
    let n = 0;
    while (!s.over && n < 200) {
      if (s.turn === 'me') { const mv = hintMove(s); A.applyMove(s, mv.from, mv.to); n++; } else A.botMove(s, rng);
    }
    assert.equal(s.winner, 'me', `seed ${seed}`);
    assert.ok(A.checkmated(s.board, 'foe'));
  }
});

test('with the kings, the opponent never checkmates or stalemates the child, and plays only legal moves', () => {
  for (let seed = 1; seed <= 6; seed++) {
    const rng = seeded(seed);
    const s = A.create('army6', {}, rng);
    for (let n = 0; n < 60 && !s.over; n++) {
      if (s.turn === 'me') {
        const all = childMoves(s);
        assert.ok(all.length, `seed ${seed}: the child has no move`);
        const mv = all[Math.floor(rng() * all.length)];
        A.applyMove(s, mv.from, mv.to);
        assert.ok(!R.inCheck(s.board, 'me'), 'the child left their own king in check');
      } else {
        A.botMove(s, rng);
        assert.ok(!R.inCheck(s.board, 'foe'), 'the opponent left its king in check');
        if (!s.over) assert.ok(!A.checkmated(s.board, 'me') && !A.stalemated(s.board, 'me'));
      }
    }
  }
});

test('with the kings: a pawn on the other side becomes a queen, check and stalemate are reported', () => {
  const s = A.create('army6', {}, Math.random);
  s.board = R.emptyBoard();
  s.board[7][4] = { type: 'k', team: 'me' };
  s.board[1][0] = { type: 'p', team: 'me' };
  s.board[3][7] = { type: 'k', team: 'foe' };
  const res = A.applyMove(s, [1, 0], [0, 0]);
  assert.deepEqual(s.board[0][0], { type: 'q', team: 'me' });
  assert.ok(res.events.includes('promoted'));
  assert.ok(!res.events.includes('check'));

  const t = A.create('army6', {}, Math.random);
  t.board = R.emptyBoard();
  t.board[7][4] = { type: 'k', team: 'me' };
  t.board[5][0] = { type: 'r', team: 'me' };
  t.board[2][3] = { type: 'k', team: 'foe' };
  assert.ok(A.applyMove(t, [5, 0], [2, 0]).events.includes('check'));

  // The king in the corner with nowhere to go but not in check.
  const u = A.create('army6', {}, Math.random);
  u.board = R.emptyBoard();
  u.board[0][0] = { type: 'k', team: 'foe' };
  u.board[2][1] = { type: 'q', team: 'me' };
  u.board[7][7] = { type: 'k', team: 'me' };
  u.board[3][2] = { type: 'p', team: 'me' };
  const res3 = A.applyMove(u, [2, 1], [1, 2]);
  assert.deepEqual(res3.events, ['army-draw']);
  assert.equal(u.over, true);
  assert.equal(u.winner, null);
});

test('with the kings: the king cannot step into check, and those squares are reported', () => {
  const s = A.create('army6', {}, Math.random);
  s.board = R.emptyBoard();
  s.board[7][4] = { type: 'k', team: 'me' };
  s.board[0][3] = { type: 'r', team: 'foe' };
  s.board[0][7] = { type: 'k', team: 'foe' };
  const moves = A.legalMoves(s, 7, 4).map(m => m.c);
  assert.ok(!moves.includes(3));
  assert.deepEqual(A.dangerSquares(s, 7, 4).map(sq => sq[1]).sort(), [3, 3]);
  assert.deepEqual(A.checkers(s.board, 'me'), []);
});

test('every game ends, even when the child moves at random, and the child keeps half their pieces', () => {
  for (const lv of A.LEVELS.filter(l => l.goal !== 'mate')) {
    for (let seed = 1; seed <= 25; seed++) {
      let start = null;
      const n = play(lv.id, seed, (s, rng) => {
        if (start === null) start = s.startPieces;
        const all = childMoves(s);
        return all[Math.floor(rng() * all.length)];
      }, (s) => {
        assert.ok(count(s.board, 'me') >= Math.ceil(s.startPieces / 2), `${lv.id} seed ${seed}: too few pieces`);
        if (lv.types.length > 1) assert.ok(count(s.board, 'me') - count(s.board, 'me', 'p') >= 1);
      }, 800);
      assert.ok(n > 0, `${lv.id} seed ${seed}: did not end`);
      assert.ok(start > 0);
    }
  }
});

test('hint: nothing while the game is over or on the other side\'s turn', () => {
  const s = A.create('army1', {}, Math.random);
  assert.ok(A.hint(s, null));
  s.turn = 'foe';
  assert.equal(A.hint(s, null), null);
  s.turn = 'me';
  s.over = true;
  assert.equal(A.hint(s, null), null);
});

test('the full game: every rule, and the other side\'s pawns may promote', () => {
  const s = A.create('army7', {}, Math.random);
  assert.equal(s.full, true);
  assert.equal(s.checkRules, true);
  assert.ok(s.info && s.info.castle.me.k);
  // Castling offered once the squares are clear.
  s.board[7][5] = null;
  s.board[7][6] = null;
  assert.ok(A.legalMoves(s, 7, 4).some(m => m.c === 6 && m.castle === 'k'));
  const res = A.applyMove(s, [7, 4], [7, 6]);
  assert.ok(res.events.includes('castle'));
  assert.deepEqual(res.rook, { from: [7, 7], to: [7, 5] });
  // The other side's pawns are no longer held back.
  const t = A.create('army7', {}, Math.random);
  t.board = R.emptyBoard();
  t.board[6][2] = { type: 'p', team: 'foe' };
  t.board[0][7] = { type: 'k', team: 'foe' };
  t.board[3][4] = { type: 'k', team: 'me' };
  t.board[4][0] = { type: 'r', team: 'me' };
  t.startPieces = 2;
  t.turn = 'foe';
  const mv = A.botMove(t, () => 0.99);
  assert.deepEqual(mv.to, [7, 2]);
  assert.ok(mv.events.includes('foe-promoted'));
  assert.deepEqual(t.board[7][2], { type: 'q', team: 'foe' });
});

test('the full game: only the two kings left is a draw', () => {
  const s = A.create('army7', {}, Math.random);
  s.board = R.emptyBoard();
  s.board[7][4] = { type: 'k', team: 'me' };
  s.board[6][4] = { type: 'p', team: 'foe' };
  s.board[0][0] = { type: 'k', team: 'foe' };
  const res = A.applyMove(s, [7, 4], [6, 4]);
  assert.ok(res.events.includes('army-draw'));
  assert.equal(s.winner, null);
  assert.equal(s.drawReason, 'kings');
});

test('the full game: a child who follows the hints gives checkmate', () => {
  for (let seed = 1; seed <= 6; seed++) {
    const rng = seeded(seed);
    const s = A.create('army7', {}, rng);
    let n = 0;
    while (!s.over && n < 200) {
      if (s.turn === 'me') { const mv = hintMove(s); A.applyMove(s, mv.from, mv.to); n++; } else {
        A.botMove(s, rng);
        if (!s.over) assert.ok(!A.checkmated(s.board, 'me'));
      }
    }
    assert.equal(s.winner, 'me', `seed ${seed}`);
  }
});

test('undo takes back the child\'s move and the reply, in every battle', () => {
  for (const lv of A.LEVELS) {
    const rng = seeded(7);
    const s = A.create(lv.id, {}, rng);
    assert.equal(A.canUndo(s), false);
    const start = JSON.stringify(s.board);
    const startInfo = JSON.stringify(s.info);
    const mv = hintMove(s);
    A.applyMove(s, mv.from, mv.to);
    assert.equal(A.canUndo(s), false, 'not during the other side\'s turn');
    A.botMove(s, rng);
    assert.equal(A.canUndo(s), true);
    assert.equal(A.undo(s), true);
    assert.equal(JSON.stringify(s.board), start, lv.id);
    assert.equal(JSON.stringify(s.info), startInfo);
    assert.equal(s.turn, 'me');
    assert.equal(s.lastFoe, null);
    assert.equal(A.canUndo(s), false);
  }
});
