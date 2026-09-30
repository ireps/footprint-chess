'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/army.js');
const S = require('../js/speed.js');

test('a speed run plays the battles with kings and times every hint and reply', () => {
  const run = S.createRun(A, () => Date.now(), { moves: 3 });
  let steps = 0;
  while (run.step() && steps < 50) steps++;
  const res = run.result();
  assert.equal(res.hint.length, 6);
  assert.ok(res.bot.length >= 5 && res.bot.length <= 6);
  assert.ok(res.hint.every(t => t >= 0));
});

test('summary gives the median and the longest time', () => {
  assert.deepEqual(S.summary([5, 1, 9, 3]), { median: 5, max: 9 });
  assert.deepEqual(S.summary([]), { median: 0, max: 0 });
});

test('the speed limits match the opponent\'s pause and the hint delay', () => {
  assert.ok(S.LIMITS.bot <= 600);
  assert.ok(S.LIMITS.hint <= 5000);
});
