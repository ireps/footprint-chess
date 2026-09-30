'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../js/hands.js');

function seeded(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

test('six questions, three each way, a rook, queen or king near the middle that can go both ways', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const state = H.create({}, seeded(seed));
    assert.equal(state.questions.length, 6);
    assert.equal(state.questions.filter(q => q.dir === 'left').length, 3);
    for (const q of state.questions) {
      assert.ok(['r', 'q', 'k'].includes(q.type));
      assert.ok(q.at[1] >= 2 && q.at[1] <= 5);
      state.index = state.questions.indexOf(q);
      const ms = H.moves(state);
      assert.ok(ms.some(m => m.c < q.at[1]) && ms.some(m => m.c > q.at[1]));
    }
  }
});

test('left is toward column 0 and right toward column 7, from the child at the bottom', () => {
  assert.equal(H.sideOf([4, 4], [4, 1]), 'left');
  assert.equal(H.sideOf([4, 4], [2, 6]), 'right');
  assert.equal(H.sideOf([4, 4], [0, 4]), 'straight');
});

test('answer: the asked way is yes; the other way and straight count a miss; illegal throws; six yes end it', () => {
  const state = H.create({}, seeded(5));
  const q = H.current(state);
  const ms = H.moves(state);
  const other = ms.find(m => H.sideOf(q.at, [m.r, m.c]) !== q.dir && H.sideOf(q.at, [m.r, m.c]) !== 'straight');
  assert.equal(H.answer(state, [other.r, other.c]), 'other');
  const straight = ms.find(m => m.c === q.at[1]);
  if (straight) assert.equal(H.answer(state, [straight.r, straight.c]), 'straight');
  assert.ok(state.misses >= 1);
  assert.throws(() => H.answer(state, [7, 7 === q.at[1] ? 0 : 7]));
  for (let i = 0; i < 6; i++) {
    const cq = H.current(state);
    const yes = H.moves(state).find(m => H.sideOf(cq.at, [m.r, m.c]) === cq.dir);
    assert.equal(H.answer(state, [yes.r, yes.c]), 'yes');
    assert.equal(H.next(state), i < 5);
  }
  assert.ok(state.over);
});
