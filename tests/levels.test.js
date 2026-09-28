'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/rules.js');
const L = require('../js/levels.js');

function seeded(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const TYPES = ['r', 'b', 'q', 'k', 'n', 'p'];

test('every generated round has reachable, distinct stars on empty squares', () => {
  for (const type of TYPES) {
    for (let seed = 1; seed <= 300; seed++) {
      const round = L.createStarRound(type, seeded(seed));
      const [hr, hc] = round.hero;
      assert.equal(round.board[hr][hc].type, type);
      assert.equal(round.stars.length, L.STAR_COUNT);
      const reach = new Set(R.reachable(round.board, hr, hc).map(s => s.join(',')));
      const seen = new Set();
      for (const s of round.stars) {
        const k = s.join(',');
        assert.ok(!seen.has(k), `duplicate star ${type} seed ${seed}`);
        seen.add(k);
        assert.equal(round.board[s[0]][s[1]], null, `star on occupied square ${type} seed ${seed}`);
        assert.ok(reach.has(k), `unreachable star ${type} seed ${seed}`);
      }
    }
  }
});

test('junk bots are never placed on the home row', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const round = L.createStarRound('r', seeded(seed));
    for (let c = 0; c < 8; c++) {
      const cell = round.board[7][c];
      assert.ok(!cell || cell.team === 'me');
    }
  }
});

test('relocateStranded moves an unreachable star somewhere reachable', () => {
  const board = R.emptyBoard();
  board[4][2] = { type: 'p', team: 'me' };
  const round = { board, hero: [4, 2], stars: [[5, 2], [1, 2]] };
  const changes = L.relocateStranded(round, seeded(7));
  assert.equal(changes.length, 1);
  assert.deepEqual(changes[0].from, [5, 2]);
  const reach = new Set(R.reachable(board, 4, 2).map(s => s.join(',')));
  for (const s of round.stars) assert.ok(reach.has(s.join(',')));
  assert.equal(round.stars.length, 2);
});

test('relocateStranded removes a star when nothing is reachable', () => {
  const board = R.emptyBoard();
  board[0][3] = { type: 'p', team: 'me' };
  const round = { board, hero: [0, 3], stars: [[4, 3]] };
  const changes = L.relocateStranded(round, seeded(3));
  assert.deepEqual(changes, [{ from: [4, 3], to: null }]);
  assert.deepEqual(round.stars, []);
});
