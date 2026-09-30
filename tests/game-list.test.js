'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const GL = require('../js/game-list.js');
const G = require('../js/games.js');
const Q = require('../js/quiz.js');
const L = require('../js/lessons.js');
const PD = require('../js/pond.js');

test('every game has a known row, unique id, and lines that exist in every language', () => {
  assert.equal(new Set(GL.ids()).size, GL.GAMES.length);
  for (const g of GL.GAMES) {
    assert.ok(GL.ROWS.includes(g.row), `${g.id}: unknown row`);
    assert.ok(['board', 'quiz', 'pond', 'hands'].includes(g.kind));
    assert.equal(typeof g.teams, 'boolean');
  }
  for (const id of GL.lineIds()) {
    assert.ok(L.LINES[id], `game list names unknown line "${id}"`);
  }
});

test('every row has at least one game, so no row is ever empty or locked', () => {
  for (const row of GL.ROWS) assert.ok(GL.inRow(row).length >= 1, row);
});

test('every board game can be created, the quiz too', () => {
  for (const g of GL.GAMES) {
    if (g.kind === 'board') assert.equal(G.create(g.id, {}, Math.random).id, g.id);
    else if (g.kind === 'quiz') assert.equal(Q.create({}, Math.random).id, g.id);
    else if (g.kind === 'hands') assert.equal(require('../js/hands.js').create({}, Math.random).id, g.id);
    else assert.equal((g.id === 'theirs' ? PD.createTheirs : PD.createDanger)({}, Math.random).id, g.id);
  }
});

test('solo games are exactly the ones the rules never hand to the other side', () => {
  for (const g of GL.GAMES.filter(x => x.kind === 'board')) {
    const state = G.create(g.id, {}, Math.random);
    assert.equal(!!state.solo, !g.teams, g.id);
  }
});

test('next cycles through every game and wraps round', () => {
  const seen = [];
  let id = GL.GAMES[0].id;
  for (let i = 0; i < GL.GAMES.length; i++) { seen.push(id); id = GL.next(id); }
  assert.deepEqual(seen, GL.ids());
  assert.equal(id, GL.GAMES[0].id);
});

test('pickTip: struggling with a piece shows its rule, otherwise no tip after the win', () => {
  assert.deepEqual(GL.pickTip('chain', { b: 2 }), { kind: 'rule', type: 'b', line: 'bishop-1' });
  assert.deepEqual(GL.pickTip('chain', { r: 2, n: 3 }), { kind: 'rule', type: 'n', line: 'knight-2' });
  assert.equal(GL.pickTip('chain', { r: 1 }), null);
  assert.equal(GL.pickTip('chain', {}), null);
  assert.equal(GL.pickTip('nope', { r: 5 }), null);
});

test('the golden king needs three different games', () => {
  assert.equal(GL.GOLDEN_KING_GAMES, 3);
});
