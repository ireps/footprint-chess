'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/rules.js');
const P = require('../js/pond.js');

function seeded(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

test('theirs: five questions, two pawns and two knights, each an opponent piece with somewhere to go', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const state = P.createTheirs({}, seeded(seed));
    const types = state.questions.map(q => q.type).sort();
    assert.equal(types.filter(t => t === 'p').length, 2);
    assert.equal(types.filter(t => t === 'n').length, 2);
    for (const q of state.questions) {
      const p = q.board[q.at[0]][q.at[1]];
      assert.deepEqual(p, { type: q.type, team: 'foe' });
      assert.ok(R.movesFor(q.board, q.at[0], q.at[1]).length > 0);
    }
  }
});

test('theirs: an opponent pawn moves toward the child\'s side and captures on the downward slant', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const state = P.createTheirs({}, seeded(seed));
    state.questions.forEach((q, i) => {
      if (q.type !== 'p') return;
      state.index = i;
      for (const m of P.theirMoves(state)) {
        assert.ok(m.r > q.at[0], 'a foe pawn only ever moves down the board');
        if (m.capture) assert.equal(Math.abs(m.c - q.at[1]), 1);
        else assert.equal(m.c, q.at[1]);
      }
    });
  }
});

test('theirs: a wrong tap counts a miss and keeps the question; the piece itself is "self"; five right answers end it', () => {
  const state = P.createTheirs({}, seeded(8));
  const q = state.questions[0];
  assert.equal(P.tapTheirs(state, q.at[0], q.at[1]), 'self');
  const moves = P.theirMoves(state);
  let wrong = null;
  for (let r = 0; r < 8 && !wrong; r++) for (let c = 0; c < 8 && !wrong; c++) {
    if (!(r === q.at[0] && c === q.at[1]) && !moves.some(m => m.r === r && m.c === c)) wrong = [r, c];
  }
  assert.equal(P.tapTheirs(state, wrong[0], wrong[1]), 'wrong');
  assert.equal(state.misses, 1);
  for (let i = 0; i < 5; i++) {
    const m = P.theirMoves(state)[0];
    assert.equal(P.tapTheirs(state, m.r, m.c), 'right');
    assert.equal(P.nextTheirs(state), i < 4);
    if (i < 4) assert.equal(state.misses, 0);
  }
  assert.ok(state.over);
  assert.throws(() => P.tapTheirs(state, 0, 0));
});

test('danger: exactly one of the child\'s three pieces can be captured, and it has a safe move', () => {
  for (let seed = 1; seed <= 150; seed++) {
    const state = P.createDanger({}, seeded(seed));
    assert.equal(state.positions.length, 5);
    for (const pos of state.positions) {
      const mine = [], foes = [];
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const p = pos.board[r][c];
        if (p && p.team === 'me') mine.push([r, c]);
        if (p && p.team === 'foe') foes.push([r, c]);
      }
      assert.equal(mine.length, 3);
      assert.ok(foes.length >= 1 && foes.length <= 2);
      const attacked = mine.filter(([r, c]) => foes.some(([fr, fc]) => R.movesFor(pos.board, fr, fc).some(m => m.r === r && m.c === c)));
      assert.deepEqual(attacked, [pos.target]);
    }
  }
});

test('danger: find the piece (others say safe), then only a safe move is taken, and it really is safe', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const state = P.createDanger({}, seeded(seed));
    for (let i = 0; i < 5; i++) {
      const pos = state.positions[i];
      let other = null;
      for (let r = 0; r < 8 && !other; r++) for (let c = 0; c < 8 && !other; c++) {
        const p = pos.board[r][c];
        if (p && p.team === 'me' && !(r === pos.target[0] && c === pos.target[1])) other = [r, c];
      }
      assert.equal(P.tapDanger(state, other[0], other[1]), 'safe');
      assert.equal(P.tapDanger(state, pos.target[0], pos.target[1]), 'right');
      const unsafe = P.dangerUnsafe(state);
      if (unsafe.length) assert.equal(P.moveToSafety(state, unsafe[0][0], unsafe[0][1]), false);
      const safe = P.dangerSafeMoves(state);
      assert.ok(safe.length);
      assert.equal(P.moveToSafety(state, safe[0].r, safe[0].c), true);
      const watched = R.attackedSquares(pos.board, 'foe');
      assert.ok(!watched[pos.target[0] + ',' + pos.target[1]], 'the moved piece is safe');
      assert.equal(P.nextDanger(state), i < 4);
    }
    assert.ok(state.over);
  }
});
