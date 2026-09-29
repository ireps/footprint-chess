'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('../js/quiz.js');

function seeded(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const key = list => list.map(sq => sq.join(',')).sort().join(' ');

test('a quiz has five questions, no piece repeats, three distinct choices on row 7 including the answer', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const state = Q.create({}, seeded(seed));
    assert.equal(state.questions.length, Q.QUESTIONS);
    assert.equal(new Set(state.questions.map(q => q.answer)).size, Q.QUESTIONS);
    for (const q of state.questions) {
      const types = q.choices.map(c => c.type);
      assert.equal(types.length, 3);
      assert.equal(new Set(types).size, 3);
      assert.ok(types.includes(q.answer));
      q.choices.forEach(c => assert.equal(c.at[0], 7));
      assert.equal(new Set(q.choices.map(c => c.at[1])).size, 3);
      assert.ok(q.square[0] >= 2 && q.square[0] <= 4 && q.square[1] >= 2 && q.square[1] <= 5);
    }
  }
});

test('every question has exactly one right answer: no other choice makes the same footprints', () => {
  for (let seed = 1; seed <= 300; seed++) {
    for (const q of Q.create({}, seeded(seed)).questions) {
      assert.equal(key(q.footprints), key(Q.footprints(q.answer, q.square)));
      assert.ok(q.footprints.length > 0);
      for (const c of q.choices) {
        if (c.type !== q.answer) assert.notEqual(key(Q.footprints(c.type, q.square)), key(q.footprints));
      }
    }
  }
});

test('distractors are the pieces most often mixed up with the answer', () => {
  const state = Q.create({}, seeded(3));
  for (const q of state.questions) {
    const others = q.choices.map(c => c.type).filter(t => t !== q.answer).sort();
    assert.deepEqual(others, Q.CONFUSE[q.answer].slice().sort());
  }
});

test('footprints never include row 7 and match the piece rule on an empty board', () => {
  assert.deepEqual(key(Q.footprints('k', [3, 3])), key([[2, 2], [2, 3], [2, 4], [3, 2], [3, 4], [4, 2], [4, 3], [4, 4]]));
  assert.deepEqual(Q.footprints('p', [4, 4]), [[3, 4]]);
  assert.ok(Q.footprints('r', [3, 3]).every(sq => sq[0] !== 7));
  assert.equal(Q.footprints('r', [3, 3]).length, 14 - 1);
});

test('answer: a wrong tap counts a miss for the answer and keeps the question; a right one moves on; five right ends it', () => {
  const state = Q.create({}, seeded(11));
  const q = Q.current(state);
  const wrong = q.choices.find(c => c.type !== q.answer).type;
  assert.deepEqual(Q.answer(state, wrong), { correct: false, over: false });
  assert.equal(state.misses[q.answer], 1);
  assert.equal(Q.current(state), q);
  assert.throws(() => Q.answer(state, 'x'));
  for (let i = 0; i < Q.QUESTIONS; i++) {
    const res = Q.answer(state, Q.current(state).answer);
    assert.equal(res.correct, true);
    assert.equal(res.over, i === Q.QUESTIONS - 1);
  }
  assert.equal(Q.current(state), null);
  assert.throws(() => Q.answer(state, 'r'));
});
