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
const SEEDS = 300;

test('every generated round has TARGET_COUNT distinct, reachable foe pawns on rows 1..6', () => {
  for (const type of TYPES) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const round = L.createCaptureRound(type, seeded(seed));
      const [hr, hc] = round.hero;
      assert.equal(round.board[hr][hc].type, type, `${type} seed ${seed}: hero type`);
      assert.equal(round.board[hr][hc].team, 'me', `${type} seed ${seed}: hero team`);
      assert.equal(round.targets.length, L.TARGET_COUNT, `${type} seed ${seed}: target count`);

      const reach = new Set(R.reachable(round.board, hr, hc).map(s => s.join(',')));
      const seen = new Set();
      for (const t of round.targets) {
        const k = t.join(',');
        assert.ok(!seen.has(k), `duplicate target ${type} seed ${seed}`);
        seen.add(k);
        assert.ok(t[0] >= 1 && t[0] <= 6, `target off rows 1..6: ${type} seed ${seed} ${t}`);
        assert.deepEqual(round.board[t[0]][t[1]], { type: 'p', team: 'foe' },
          `target square is not a foe pawn: ${type} seed ${seed} ${t}`);
        assert.ok(reach.has(k), `unreachable target ${type} seed ${seed} ${t}`);
      }
    }
  }
});

test('hero starts on row 7, except the pawn which starts on row 6', () => {
  for (const type of TYPES) {
    for (let seed = 1; seed <= 50; seed++) {
      const round = L.createCaptureRound(type, seeded(seed));
      assert.equal(round.hero[0], type === 'p' ? 6 : 7, `${type} seed ${seed}`);
    }
  }
});

test('bishop targets always land on the same colour square as the hero', () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const round = L.createCaptureRound('b', seeded(seed));
    const [hr, hc] = round.hero;
    for (const [tr, tc] of round.targets) {
      assert.equal(R.isLightSquare(tr, tc), R.isLightSquare(hr, hc), `seed ${seed}`);
    }
  }
});

test('pawn rounds form a diagonal-forward capture chain from the hero', () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const round = L.createCaptureRound('p', seeded(seed));
    let [prevR, prevC] = round.hero;
    for (const [r, c] of round.targets) {
      assert.equal(r, prevR - 1, `seed ${seed}: not one row closer to the far edge`);
      assert.equal(Math.abs(c - prevC), 1, `seed ${seed}: not one column over`);
      prevR = r;
      prevC = c;
    }
  }
});

test('pawn rounds can be finished by capturing only, in chain order', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const round = L.createCaptureRound('p', seeded(seed));
    const board = round.board;
    let hero = round.hero.slice();
    for (const target of round.targets) {
      const moves = R.movesFor(board, hero[0], hero[1]);
      const mv = moves.find(m => m.r === target[0] && m.c === target[1]);
      assert.ok(mv && mv.capture, `seed ${seed}: target ${target} not capturable in order`);
      board[hero[0]][hero[1]] = null;
      board[target[0]][target[1]] = { type: 'p', team: 'me' };
      hero = target.slice();
    }
  }
});

test('relocateStranded moves an unreachable target to a reachable square on rows 1..6, and mutates the board', () => {
  // A bishop can never reach a square of the other colour, no matter what else is on the
  // board, so this target is permanently unreachable - a clean, deterministic strand.
  const board = R.emptyBoard();
  board[7][2] = { type: 'b', team: 'me' }; // (7+2) is odd: this bishop's whole colour is "odd" squares
  board[4][4] = { type: 'p', team: 'foe' }; // (4+4) is even: the other colour, unreachable
  const round = { board, hero: [7, 2], targets: [[4, 4]] };
  const changes = L.relocateStranded(round, seeded(11));

  assert.equal(changes.length, 1);
  assert.deepEqual(changes[0].from, [4, 4]);
  assert.equal(board[4][4], null, 'old square must be cleared');
  assert.ok(changes[0].to, 'a same-colour square is always available to relocate to');
  const [tr, tc] = changes[0].to;
  assert.deepEqual(board[tr][tc], { type: 'p', team: 'foe' }, 'new square must hold a foe pawn');
  assert.ok(tr >= 1 && tr <= 6);
  assert.equal(R.isLightSquare(tr, tc), R.isLightSquare(7, 2));
  assert.deepEqual(round.targets, [[tr, tc]]);
});

test('relocateStranded removes a target when the hero has no moves at all', () => {
  // A rook boxed in on two sides by its own team has zero legal moves, so nothing on the
  // board is reachable, and a target anywhere else can never be relocated - only removed.
  const board = R.emptyBoard();
  board[0][0] = { type: 'r', team: 'me' };
  board[0][1] = { type: 'r', team: 'me' };
  board[1][0] = { type: 'r', team: 'me' };
  board[4][4] = { type: 'p', team: 'foe' };
  const round = { board, hero: [0, 0], targets: [[4, 4]] };
  const changes = L.relocateStranded(round, seeded(4));
  assert.deepEqual(changes, [{ from: [4, 4], to: null }]);
  assert.equal(board[4][4], null);
  assert.deepEqual(round.targets, []);
});

test('relocateStranded keeps a pawn target off empty forward-only squares (capture only, never a march)', () => {
  // Hero pawn has advanced; one target is stranded behind it (pawns never move backward).
  const board = R.emptyBoard();
  board[3][3] = { type: 'p', team: 'me' };
  board[5][3] = { type: 'p', team: 'foe' }; // stranded: behind the hero
  const round = { board, hero: [3, 3], targets: [[5, 3]] };
  const changes = L.relocateStranded(round, seeded(9));
  assert.equal(changes.length, 1);
  assert.deepEqual(changes[0].from, [5, 3]);
  if (changes[0].to) {
    const [tr, tc] = changes[0].to;
    // Must be capturable: a diagonal-forward neighbour of some square the hero can reach.
    const reach = R.reachable(board, 3, 3).concat([[3, 3]]);
    const capturable = reach.some(([pr, pc]) => pr - 1 === tr && Math.abs(pc - tc) === 1);
    assert.ok(capturable, `relocated pawn target ${changes[0].to} is not capturable`);
  }
});
