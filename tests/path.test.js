'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const PATH = require('../js/path.js');
const GL = require('../js/game-list.js');
const L = require('../js/lessons.js');

function prog(doneIds, last) {
  const done = {};
  doneIds.forEach((id) => { done[id] = true; });
  return { done, last: last || null };
}

test('the journey: lines, steps and jumps, playing together, thinking ahead, their side, the king, the growing battle', () => {
  assert.deepEqual(PATH.CHAPTERS.map((c) => c.id), ['lines', 'steps', 'play', 'think', 'pond', 'king', 'army']);
  assert.deepEqual(PATH.CHAPTERS[0].stops, ['r', 'b', 'q', 'whose']);
  assert.deepEqual(PATH.CHAPTERS[1].stops, ['k', 'n', 'p']);
  assert.deepEqual(PATH.CHAPTERS[2].stops, ['turns', 'catch', 'race', 'chain', 'battle']);
});

test('the path is the only way in: every game is a step exactly once, every piece is a step', () => {
  const games = PATH.STOP_IDS.filter((id) => PATH.kindOf(id) === 'game');
  assert.deepEqual(games.slice().sort(), GL.ids().slice().sort());
  assert.equal(new Set(PATH.STOP_IDS).size, PATH.STOP_IDS.length);
  for (const t of L.TYPE_ORDER) assert.equal(PATH.kindOf(t), 'piece');
  assert.equal(PATH.kindOf('turns'), 'lesson');
  assert.ok(L.get('turns'));
  assert.equal(PATH.kindOf('nope'), null);
});

test('teaching order: every piece before the first game, Taking turns before the first team game, the growing battle in order', () => {
  const firstGame = PATH.STOP_IDS.findIndex((id) => PATH.kindOf(id) === 'game' && id !== 'whose');
  for (const t of L.TYPE_ORDER) assert.ok(PATH.STOP_IDS.indexOf(t) < firstGame, t);
  // The footprints quiz asks about the rook, bishop and queen, so it comes after them.
  for (const t of ['r', 'b', 'q']) assert.ok(PATH.STOP_IDS.indexOf(t) < PATH.STOP_IDS.indexOf('whose'));
  const firstTeam = PATH.STOP_IDS.findIndex((id) => PATH.kindOf(id) === 'game' && GL.get(id).teams);
  assert.ok(PATH.STOP_IDS.indexOf('turns') < firstTeam);
  const army = PATH.STOP_IDS.filter((id) => /^army\d$/.test(id));
  assert.deepEqual(army, ['army1', 'army2', 'army3', 'army4', 'army5', 'army6', 'army7']);
  // Check comes before checkmate, and both before the battles that use them.
  assert.ok(PATH.STOP_IDS.indexOf('escape') < PATH.STOP_IDS.indexOf('mate'));
  assert.ok(PATH.STOP_IDS.indexOf('mate2') < PATH.STOP_IDS.indexOf('army6'));
});

test('every part picture is a piece, an icon or a row picture', () => {
  for (const ch of PATH.CHAPTERS) {
    assert.ok(ch.pic.length >= 1);
    for (const [first, side] of ch.pic) {
      if (first.startsWith('ic-')) continue;
      if (first.startsWith('row:')) { assert.ok(GL.ROWS.includes(first.slice(4)), first); continue; }
      assert.ok(L.TYPE_ORDER.includes(first));
      assert.ok(side === 'me' || side === 'foe');
    }
  }
});

test('the next step is the first not done, in path order', () => {
  assert.equal(PATH.nextStop(null), 'r');
  assert.equal(PATH.nextStop(prog(['r', 'b'])), 'q');
  assert.equal(PATH.nextStop(prog(['r', 'q'])), 'b');
  assert.equal(PATH.nextStop(prog(['r', 'b', 'q'])), 'whose');
  assert.equal(PATH.nextStop(prog(['r', 'b', 'q', 'whose', 'k', 'n', 'p'])), 'turns');
});

test('once every step is done, the suggestion moves on from the last step played', () => {
  const all = PATH.STOP_IDS;
  assert.ok(PATH.allDone(prog(all)));
  assert.equal(PATH.nextStop(prog(all, 'q')), 'whose');
  assert.equal(PATH.nextStop(prog(all, 'army7')), 'r');
  assert.equal(PATH.nextAfter(prog(all), 'race'), 'chain');
  assert.equal(PATH.nextAfter(prog(['r']), 'r'), 'b');
});

test('a part is done when all its steps are done', () => {
  assert.equal(PATH.chapterDone(prog(['r', 'b', 'q']), 0), false);
  assert.equal(PATH.chapterDone(prog(['r', 'b', 'q', 'whose']), 0), true);
  assert.equal(PATH.chapterDone(prog([]), 99), false);
});

test('a piece marked "practise again" is suggested first, and by the Won card', () => {
  const p = prog(['r', 'b', 'q', 'whose', 'k']);
  p.practise = { b: true, zzz: true };
  assert.deepEqual(PATH.practiseList(p), ['b']);
  assert.equal(PATH.nextStop(p), 'b');
  assert.equal(PATH.nextAfter(p, 'whose'), 'b');
  const all = prog(PATH.STOP_IDS, 'army7');
  all.practise = { q: true };
  assert.equal(PATH.nextAfter(all, 'army7'), 'q');
});

test('progress saved before the path keeps its ticks', () => {
  const done = PATH.legacyDone({
    met: { r: true, n: true },
    seen: { turns: true, rook: true },
    wins: { 'space:race': true, 'robots:mate2': true, 'robots:catch': false }
  });
  assert.deepEqual(Object.keys(done).sort(), ['mate2', 'n', 'r', 'race', 'turns']);
  assert.deepEqual(PATH.legacyDone(null), {});
});
