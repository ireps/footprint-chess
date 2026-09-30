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
  assert.deepEqual(A.LEVELS.map(l => l.types.length), [1, 2, 3]);
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
  for (const lv of A.LEVELS) {
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

test('a child who follows the hints wins every level, in a short game', () => {
  for (const lv of A.LEVELS) {
    for (let seed = 1; seed <= 40; seed++) {
      const n = play(lv.id, seed, (s) => {
        const piece = A.hint(s, null);
        const to = A.hint(s, piece);
        return { from: piece, to };
      }, null, 90);
      assert.ok(n > 0, `${lv.id} seed ${seed}: not won in 90 moves`);
    }
  }
});

test('every game ends, even when the child moves at random, and the child keeps half their pieces', () => {
  for (const lv of A.LEVELS) {
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
