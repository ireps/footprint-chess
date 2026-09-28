'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/rules.js');

function boardWith(pieces) {
  const b = R.emptyBoard();
  for (const [r, c, type, team] of pieces) b[r][c] = { type, team: team || 'me' };
  return b;
}
function targets(moves) {
  return moves.map(m => m.r + ',' + m.c + (m.capture ? 'x' : '')).sort();
}

test('empty square has no moves', () => {
  assert.deepEqual(R.movesFor(R.emptyBoard(), 3, 3), []);
});

test('rook on an empty board reaches 14 squares', () => {
  assert.equal(R.movesFor(boardWith([[4, 3, 'r']]), 4, 3).length, 14);
});

test('bishop in a corner reaches 7 squares', () => {
  assert.equal(R.movesFor(boardWith([[7, 0, 'b']]), 7, 0).length, 7);
});

test('queen near the centre reaches 27 squares', () => {
  assert.equal(R.movesFor(boardWith([[4, 3, 'q']]), 4, 3).length, 27);
});

test('king: 8 squares in the centre, 3 in a corner', () => {
  assert.equal(R.movesFor(boardWith([[4, 3, 'k']]), 4, 3).length, 8);
  assert.equal(R.movesFor(boardWith([[0, 0, 'k']]), 0, 0).length, 3);
});

test('knight: 8 squares in the centre, 2 in a corner', () => {
  assert.equal(R.movesFor(boardWith([[4, 3, 'n']]), 4, 3).length, 8);
  assert.equal(R.movesFor(boardWith([[7, 7, 'n']]), 7, 7).length, 2);
});

test('knight jumps over pieces', () => {
  const b = boardWith([[7, 1, 'n'], [6, 0, 'p'], [6, 1, 'p'], [6, 2, 'p']]);
  assert.deepEqual(targets(R.movesFor(b, 7, 1)), ['5,0', '5,2', '6,3']);
});

test('rook stops before its own piece and captures a foe', () => {
  const b = boardWith([[7, 0, 'r'], [4, 0, 'p'], [7, 3, 'x', 'foe']]);
  assert.deepEqual(targets(R.movesFor(b, 7, 0)), ['5,0', '6,0', '7,1', '7,2', '7,3x']);
});

test('player pawn: one or two steps from the start row, one after that', () => {
  assert.deepEqual(targets(R.movesFor(boardWith([[6, 4, 'p']]), 6, 4)), ['4,4', '5,4']);
  assert.deepEqual(targets(R.movesFor(boardWith([[5, 4, 'p']]), 5, 4)), ['4,4']);
});

test('pawn cannot step into or jump over a blocker', () => {
  assert.deepEqual(R.movesFor(boardWith([[6, 4, 'p'], [5, 4, 'x', 'foe']]), 6, 4), []);
  assert.deepEqual(targets(R.movesFor(boardWith([[6, 4, 'p'], [4, 4, 'x', 'foe']]), 6, 4)), ['5,4']);
});

test('pawn captures diagonally forward only', () => {
  const b = boardWith([[6, 4, 'p'], [5, 3, 'x', 'foe'], [5, 5, 'p'], [7, 5, 'x', 'foe']]);
  assert.deepEqual(targets(R.movesFor(b, 6, 4)), ['4,4', '5,3x', '5,4']);
});

test('foe pawn moves toward row 7', () => {
  assert.deepEqual(targets(R.movesFor(boardWith([[1, 2, 'p', 'foe']]), 1, 2)), ['2,2', '3,2']);
});

test('junk bots never move', () => {
  assert.deepEqual(R.movesFor(boardWith([[3, 3, 'x', 'foe']]), 3, 3), []);
});

test('bishop can only ever reach squares of its own colour', () => {
  const reach = R.reachable(boardWith([[7, 2, 'b']]), 7, 2);
  assert.equal(reach.length, 31);
  for (const [r, c] of reach) assert.equal(R.isLightSquare(r, c), R.isLightSquare(7, 2));
});

test('knight can reach every other square', () => {
  assert.equal(R.reachable(boardWith([[7, 6, 'n']]), 7, 6).length, 63);
});

test('reachable does not modify the board', () => {
  const b = boardWith([[7, 0, 'r'], [3, 0, 'x', 'foe']]);
  const before = JSON.stringify(b);
  R.reachable(b, 7, 0);
  assert.equal(JSON.stringify(b), before);
});
