'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const R = require('../js/rules.js');
const L = require('../js/lessons.js');
const voiceClips = require('../js/voice-clips.js');

const ROOT = path.join(__dirname, '..');
const NO_LEFT_RIGHT = /\b(left|right)\b/i;
const NO_SQUARE_NAME = /\b[a-h][1-8]\b/;
const NO_TELUGU_LEFT_RIGHT = /ఎడమ|కుడి/;
const HAS_TELUGU_SCRIPT = /[ఀ-౿]/;

/* ---------- helpers shared by several tests ---------- */

function applyMove(board, hero, to, type) {
  board[hero[0]][hero[1]] = null;
  board[to[0]][to[1]] = { type: type, team: 'me' };
}

function cloneBoard(board) {
  return board.map(row => row.slice());
}

/* Parse the "id | English | Telugu | delivery note" table out of
   docs/VOICE-SCRIPT.md. */
function parseVoiceScript() {
  const text = fs.readFileSync(path.join(ROOT, 'docs', 'VOICE-SCRIPT.md'), 'utf8');
  const rows = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) continue;
    const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());
    if (cells.length < 3) continue;
    if (cells[0] === 'id') continue; // header
    if (/^-+$/.test(cells[0])) continue; // separator row
    rows[cells[0]] = { en: cells[1], te: cells[2] };
  }
  return rows;
}

/* ---------- watch timing ---------- */

test('every lesson watch estimate is between 10 and 15 seconds', () => {
  for (const lesson of L.LESSONS) {
    const ms = L.estimateWatchMs(lesson);
    assert.ok(ms >= 10000 && ms <= 15000, `${lesson.id}: ${ms}ms out of range`);
  }
});

/* ---------- legality of watch moves and practice tasks ---------- */

test('every watch move step is legal from the position at that point, and reset restores the setup', () => {
  for (const lesson of L.LESSONS) {
    const start = L.boardFor(lesson);
    const setupBoard = cloneBoard(start.board);
    const setupHero = start.hero.slice();
    let board = start.board;
    let hero = start.hero.slice();

    for (const step of lesson.watch) {
      if (step.move) {
        const moves = R.movesFor(board, hero[0], hero[1]);
        const legal = moves.some(m => m.r === step.move[0] && m.c === step.move[1]);
        assert.ok(legal, `${lesson.id}: illegal move ${step.move} from ${hero}`);
        applyMove(board, hero, step.move, lesson.type);
        hero = step.move.slice();
      } else if (step.reset) {
        board = cloneBoard(setupBoard);
        hero = setupHero.slice();
      }
    }
  }
});

test('every practice task is legal, chained from the setup position', () => {
  for (const lesson of L.LESSONS) {
    const start = L.boardFor(lesson);
    const board = start.board;
    let hero = start.hero.slice();

    for (const task of lesson.practice) {
      const moves = R.movesFor(board, hero[0], hero[1]);
      const legal = moves.some(m => m.r === task.to[0] && m.c === task.to[1]);
      assert.ok(legal, `${lesson.id}: illegal practice target ${task.to} from ${hero}`);
      assert.ok(task.accept === 'any' || task.accept === 'only', `${lesson.id}: bad accept value`);
      applyMove(board, hero, task.to, lesson.type);
      hero = task.to.slice();
    }
  }
});

test('bump practice accepts only the junk square, pawn practice has no captures', () => {
  const bump = L.get('bump');
  assert.equal(bump.practice.length, 1);
  assert.equal(bump.practice[0].accept, 'only');
  assert.deepEqual(bump.practice[0].to, bump.setup.junk[0]);

  const pawn = L.get('pawn');
  assert.equal(pawn.setup.junk.length, 0);
  const start = L.boardFor(pawn);
  const board = start.board;
  let hero = start.hero.slice();
  for (const task of pawn.practice) {
    const moves = R.movesFor(board, hero[0], hero[1]);
    const mv = moves.find(m => m.r === task.to[0] && m.c === task.to[1]);
    assert.ok(mv && !mv.capture, 'pawn practice task must not be a capture');
    applyMove(board, hero, task.to, pawn.type);
    hero = task.to.slice();
  }
});

test('pawn hero starts on row 6 so the first step can be a double step', () => {
  const pawn = L.get('pawn');
  assert.equal(pawn.setup.hero[0], 6);
});

/* ---------- line ids and content ---------- */

test('every said id and every PRACTICE_LINES id exists in LINES, and no LINES entry is unused', () => {
  const used = new Set();
  for (const lesson of L.LESSONS) {
    for (const id of L.lineIds(lesson)) {
      assert.ok(L.LINES[id], `${lesson.id}: says unknown line "${id}"`);
      used.add(id);
    }
  }
  for (const id of L.PRACTICE_LINES) {
    assert.ok(L.LINES[id], `PRACTICE_LINES: unknown line "${id}"`);
    used.add(id);
  }
  for (const id of Object.keys(L.LINES)) {
    assert.ok(used.has(id), `LINES entry "${id}" is never used`);
  }
});

test('lesson order is hello, rook, bishop, queen, king, knight, bump, pawn', () => {
  assert.deepEqual(L.LESSONS.map(l => l.id),
    ['hello', 'rook', 'bishop', 'queen', 'king', 'knight', 'bump', 'pawn']);
});

test('every LINES entry has non-empty English and Telugu text', () => {
  for (const [id, line] of Object.entries(L.LINES)) {
    assert.ok(typeof line.en === 'string' && line.en.trim().length > 0, `${id}: missing English text`);
    assert.ok(typeof line.te === 'string' && line.te.trim().length > 0, `${id}: missing Telugu text`);
  }
});

test('every Telugu line actually contains Telugu script', () => {
  for (const [id, line] of Object.entries(L.LINES)) {
    assert.ok(HAS_TELUGU_SCRIPT.test(line.te), `${id}: Telugu text has no Telugu script`);
  }
});

test('no LINES text says left, right, or a square name, in English or Telugu', () => {
  for (const [id, line] of Object.entries(L.LINES)) {
    assert.ok(!NO_LEFT_RIGHT.test(line.en), `${id}: English contains "left" or "right"`);
    assert.ok(!NO_SQUARE_NAME.test(line.en), `${id}: English contains a square name`);
    assert.ok(!NO_TELUGU_LEFT_RIGHT.test(line.te), `${id}: Telugu contains ఎడమ or కుడి`);
  }
});

test('every English line is short enough for a 6-year-old (about 12 words or fewer)', () => {
  for (const [id, line] of Object.entries(L.LINES)) {
    const words = line.en.trim().split(/\s+/).length;
    assert.ok(words <= 12, `${id}: ${words} words is too long`);
  }
});

/* ---------- docs/VOICE-SCRIPT.md ---------- */

test('docs/VOICE-SCRIPT.md lists exactly the LINES ids, with the same English and Telugu text', () => {
  const rows = parseVoiceScript();
  const linesIds = Object.keys(L.LINES).sort();
  const docIds = Object.keys(rows).sort();
  assert.deepEqual(docIds, linesIds, 'VOICE-SCRIPT.md ids do not match LINES ids');
  for (const id of linesIds) {
    assert.equal(rows[id].en, L.LINES[id].en, `${id}: VOICE-SCRIPT.md English text does not match LINES`);
    assert.equal(rows[id].te, L.LINES[id].te, `${id}: VOICE-SCRIPT.md Telugu text does not match LINES`);
  }
});

/* ---------- js/lessons.js: LANGS / DEFAULT_LANG ---------- */

test('LANGS is English then Telugu, and DEFAULT_LANG is English', () => {
  assert.deepEqual(L.LANGS, ['en', 'te']);
  assert.equal(L.DEFAULT_LANG, 'en');
});

/* ---------- js/voice-clips.js ---------- */

test('voice-clips.js has an array only for each language in LANGS', () => {
  assert.equal(typeof voiceClips, 'object');
  assert.deepEqual(Object.keys(voiceClips).sort(), L.LANGS.slice().sort());
  for (const lang of Object.keys(voiceClips)) {
    assert.ok(Array.isArray(voiceClips[lang]), `voice-clips.js: "${lang}" is not an array`);
  }
});

test('every voice-clips.js id has a matching audio file and a LINES entry', () => {
  for (const lang of Object.keys(voiceClips)) {
    for (const id of voiceClips[lang]) {
      assert.ok(L.LINES[id], `voice-clips.js: "${lang}/${id}" is not in LINES`);
      const file = path.join(ROOT, 'audio', 'voice', lang, id + '.mp3');
      assert.ok(fs.existsSync(file), `voice-clips.js: missing ${file}`);
    }
  }
});

/* ---------- suggestMove ---------- */

test('suggestMove returns the preferred square when it is legal', () => {
  const board = R.emptyBoard();
  board[7][0] = { type: 'r', team: 'me' };
  assert.deepEqual(L.suggestMove(board, [7, 0], [5, 0]), [5, 0]);
});

test('suggestMove prefers a legal capture when the preferred square is not legal', () => {
  const board = R.emptyBoard();
  board[7][0] = { type: 'r', team: 'me' };
  board[7][3] = { type: 'x', team: 'foe' };
  // Preferred square is off the rook's lines entirely, so it falls back.
  const result = L.suggestMove(board, [7, 0], [6, 6]);
  const moves = R.movesFor(board, 7, 0);
  const mv = moves.find(m => m.r === result[0] && m.c === result[1]);
  assert.ok(mv && mv.capture, 'expected a capture');
});

test('suggestMove falls back to the legal move closest to row 0, deterministically', () => {
  const board = R.emptyBoard();
  board[4][3] = { type: 'k', team: 'me' };
  const result = L.suggestMove(board, [4, 3], [9, 9]); // never legal
  const moves = R.movesFor(board, 4, 3);
  const minRow = Math.min(...moves.map(m => m.r));
  assert.equal(result[0], minRow);
  // Deterministic: same inputs, same output, every time.
  assert.deepEqual(L.suggestMove(board, [4, 3], [9, 9]), result);
});

test('suggestMove returns null when the hero has no legal moves', () => {
  const board = R.emptyBoard();
  board[0][0] = { type: 'p', team: 'me' };
  board[1][0] = { type: 'x', team: 'foe' };
  // Pawn on row 0 with team 'me' also has no forward square on the board.
  assert.equal(L.suggestMove(board, [0, 0], [5, 5]), null);
});

/* ---------- other helpers ---------- */

test('get returns a lesson by id, or null', () => {
  assert.equal(L.get('rook').id, 'rook');
  assert.equal(L.get('nope'), null);
});

test('boardFor places the hero and junk bots from setup, nothing else', () => {
  const bump = L.get('bump');
  const state = L.boardFor(bump);
  assert.deepEqual(state.hero, bump.setup.hero);
  const [hr, hc] = bump.setup.hero;
  assert.deepEqual(state.board[hr][hc], { type: bump.type, team: 'me' });
  for (const [jr, jc] of bump.setup.junk) {
    assert.deepEqual(state.board[jr][jc], { type: 'x', team: 'foe' });
  }
  let occupied = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (state.board[r][c]) occupied += 1;
    }
  }
  assert.equal(occupied, 1 + bump.setup.junk.length);
});
