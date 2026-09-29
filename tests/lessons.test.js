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
const BANNED_EN = /\b(bots?|robots?|junk\w*|charging|bump\w*|rail bot|slide bot|star bot|sleepy|spring bot|mini bot)\b/i;
const BANNED_TE = /రోబో|బాట్|జంక్|ఎడమ|కుడి/;

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

test('every capture-<type> and pawn-capture practice task is a capture, and accepts only that square', () => {
  for (const type of L.TYPE_ORDER) {
    const lesson = L.get(L.captureLessonFor(type));
    assert.ok(lesson, `no lesson for captureLessonFor(${type})`);
    assert.equal(lesson.practice.length, 1);
    assert.equal(lesson.practice[0].accept, 'only');
    const start = L.boardFor(lesson);
    const moves = R.movesFor(start.board, start.hero[0], start.hero[1]);
    const mv = moves.find(m => m.r === lesson.practice[0].to[0] && m.c === lesson.practice[0].to[1]);
    assert.ok(mv && mv.capture, `${lesson.id}: practice task is not a capture`);
  }
});

test('the knight lesson jumps over a foe pawn without capturing it', () => {
  const knight = L.get('knight');
  assert.deepEqual(knight.setup.foes, [[6, 1]]);
  const start = L.boardFor(knight);
  const moves = R.movesFor(start.board, start.hero[0], start.hero[1]);
  const hop = moves.find(m => m.r === 5 && m.c === 2);
  assert.ok(hop && !hop.capture, 'knight should land on 5,2 without capturing the pawn it jumps');
  assert.deepEqual(start.board[6][1], { type: 'p', team: 'foe' }, 'the jumped-over pawn must still be on the board');
});

test('pawn-capture: the hero cannot capture straight ahead, only on the slant', () => {
  const lesson = L.get('pawn-capture');
  assert.deepEqual(lesson.setup.foes, [[5, 3], [5, 4]]);
  const start = L.boardFor(lesson);
  const moves = R.movesFor(start.board, start.hero[0], start.hero[1]);
  assert.equal(moves.length, 1, 'the straight-ahead pawn must block the march with no capture');
  assert.deepEqual(moves[0], { r: 5, c: 4, capture: true });
});

test('pawn hero starts on row 6 so the first step can be a double step', () => {
  const pawn = L.get('pawn');
  assert.equal(pawn.setup.hero[0], 6);
  const pawnCapture = L.get('pawn-capture');
  assert.equal(pawnCapture.setup.hero[0], 6);
});

/* ---------- turns lesson (stage 3): turn / foeMove steps, practice reply ---------- */

test('turns lesson: setup matches the taking-turns spec', () => {
  const lesson = L.get('turns');
  assert.ok(lesson, 'no "turns" lesson');
  assert.equal(lesson.type, 'p');
  assert.deepEqual(lesson.setup, { hero: [6, 3], foes: [[1, 4]] });
});

test('turns lesson: every foeMove step in the watch script is legal for team foe at that point, and never captures the hero', () => {
  const lesson = L.get('turns');
  const start = L.boardFor(lesson);
  let board = cloneBoard(start.board);
  let hero = start.hero.slice();
  let sawFoeMove = false;

  for (const step of lesson.watch) {
    if (step.move) {
      applyMove(board, hero, step.move, lesson.type);
      hero = step.move.slice();
    } else if (step.foeMove) {
      sawFoeMove = true;
      const [from, to] = step.foeMove;
      const piece = board[from[0]][from[1]];
      assert.ok(piece && piece.team === 'foe', `foeMove ${JSON.stringify(step.foeMove)}: no foe piece at ${from}`);
      const moves = R.movesFor(board, from[0], from[1]);
      const legal = moves.some(m => m.r === to[0] && m.c === to[1]);
      assert.ok(legal, `turns: illegal foeMove ${JSON.stringify(step.foeMove)}`);
      assert.ok(!(to[0] === hero[0] && to[1] === hero[1]), 'foeMove must not capture the hero in this lesson');
      board[to[0]][to[1]] = piece;
      board[from[0]][from[1]] = null;
    } else if (step.reset) {
      board = cloneBoard(start.board);
      hero = start.hero.slice();
    }
  }
  assert.ok(sawFoeMove, 'turns watch script should include a foeMove step');
});

test('turns lesson: the practice reply is legal for team foe no matter which legal first move the hero pawn makes', () => {
  const lesson = L.get('turns');
  const task = lesson.practice[0];
  assert.ok(task.reply, 'first practice task should have a reply');
  const start = L.boardFor(lesson);
  const heroMoves = R.movesFor(start.board, start.hero[0], start.hero[1]);
  assert.ok(heroMoves.length > 1, 'expected more than one legal first move for the hero pawn');

  const [from, to] = task.reply;
  for (const hm of heroMoves) {
    const board = cloneBoard(start.board);
    applyMove(board, start.hero, [hm.r, hm.c], lesson.type);
    const piece = board[from[0]][from[1]];
    assert.ok(piece && piece.team === 'foe', `reply: no foe piece at ${from}`);
    const moves = R.movesFor(board, from[0], from[1]);
    const legal = moves.some(m => m.r === to[0] && m.c === to[1]);
    assert.ok(legal, `reply ${JSON.stringify(task.reply)} illegal after hero moves to ${hm.r},${hm.c}`);
  }
  assert.ok(!lesson.practice[1].reply, 'second practice task should have no reply (the lesson ends after it)');
});

/* ---------- line ids and content ---------- */

test('every said id, every PRACTICE_LINES id and every APP_LINES id exists in LINES, and no LINES entry is unused', () => {
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
  for (const id of L.APP_LINES) {
    assert.ok(L.LINES[id], `APP_LINES: unknown line "${id}"`);
    used.add(id);
  }
  for (const id of L.GAME_LINES) {
    assert.ok(L.LINES[id], `GAME_LINES: unknown line "${id}"`);
    used.add(id);
  }
  for (const id of Object.keys(L.LINES)) {
    assert.ok(used.has(id), `LINES entry "${id}" is never used`);
  }
});

test('lesson order is hello, rook, bishop, queen, king, knight, pawn, a capture lesson per type, then turns', () => {
  assert.deepEqual(L.LESSONS.map(l => l.id), [
    'hello', 'rook', 'bishop', 'queen', 'king', 'knight', 'pawn',
    'capture-r', 'capture-b', 'capture-q', 'capture-k', 'capture-n', 'pawn-capture',
    'turns'
  ]);
});

test('every LINES entry has non-empty English and Telugu text and a positive ms estimate', () => {
  for (const [id, line] of Object.entries(L.LINES)) {
    assert.ok(typeof line.en === 'string' && line.en.trim().length > 0, `${id}: missing English text`);
    assert.ok(typeof line.te === 'string' && line.te.trim().length > 0, `${id}: missing Telugu text`);
    assert.ok(typeof line.ms === 'number' && line.ms >= 1100, `${id}: bad ms estimate`);
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

test('no LINES text uses a robot name, "bot", "robot", junk, charging or bump, in either language', () => {
  for (const [id, line] of Object.entries(L.LINES)) {
    assert.ok(!BANNED_EN.test(line.en), `${id}: English contains banned robot-theme wording`);
    assert.ok(!BANNED_TE.test(line.te), `${id}: Telugu contains banned robot-theme wording`);
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

/* ---------- PIECE_NAMES / TYPE_ORDER ---------- */

test('TYPE_ORDER lists every piece type once, and PIECE_NAMES has a name for each, in every language', () => {
  assert.deepEqual(L.TYPE_ORDER.slice().sort(), ['b', 'k', 'n', 'p', 'q', 'r']);
  assert.equal(new Set(L.TYPE_ORDER).size, L.TYPE_ORDER.length);
  for (const lang of L.LANGS) {
    assert.ok(L.PIECE_NAMES[lang], `PIECE_NAMES missing language "${lang}"`);
    for (const type of L.TYPE_ORDER) {
      const name = L.PIECE_NAMES[lang][type];
      assert.ok(typeof name === 'string' && name.trim().length > 0, `PIECE_NAMES.${lang}.${type} missing`);
    }
  }
});

test('PIECE_NAMES uses the agreed Telugu piece names', () => {
  assert.deepEqual(L.PIECE_NAMES.te, {
    k: 'రాజు', q: 'మంత్రి', r: 'ఏనుగు', b: 'ఒంటె', n: 'గుర్రం', p: 'భటుడు'
  });
});

/* ---------- lessonFor / captureLessonFor ---------- */

test('lessonFor maps every type to its introductory lesson id', () => {
  assert.equal(L.lessonFor('r'), 'rook');
  assert.equal(L.lessonFor('b'), 'bishop');
  assert.equal(L.lessonFor('q'), 'queen');
  assert.equal(L.lessonFor('k'), 'king');
  assert.equal(L.lessonFor('n'), 'knight');
  assert.equal(L.lessonFor('p'), 'pawn');
  for (const type of L.TYPE_ORDER) {
    assert.ok(L.get(L.lessonFor(type)), `lessonFor(${type}) is not a real lesson id`);
  }
});

test('captureLessonFor maps the pawn to pawn-capture, and every other type to capture-<type>', () => {
  assert.equal(L.captureLessonFor('p'), 'pawn-capture');
  for (const type of L.TYPE_ORDER) {
    if (type === 'p') continue;
    assert.equal(L.captureLessonFor(type), 'capture-' + type);
  }
  for (const type of L.TYPE_ORDER) {
    assert.ok(L.get(L.captureLessonFor(type)), `captureLessonFor(${type}) is not a real lesson id`);
  }
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
  board[7][3] = { type: 'p', team: 'foe' };
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
  board[1][0] = { type: 'p', team: 'foe' };
  // Pawn on row 0 with team 'me' also has no forward square on the board.
  assert.equal(L.suggestMove(board, [0, 0], [5, 5]), null);
});

/* ---------- other helpers ---------- */

test('get returns a lesson by id, or null', () => {
  assert.equal(L.get('rook').id, 'rook');
  assert.equal(L.get('nope'), null);
});

test('boardFor places the hero and foe pawns from setup, nothing else', () => {
  const knight = L.get('knight');
  const state = L.boardFor(knight);
  assert.deepEqual(state.hero, knight.setup.hero);
  const [hr, hc] = knight.setup.hero;
  assert.deepEqual(state.board[hr][hc], { type: knight.type, team: 'me' });
  for (const [fr, fc] of knight.setup.foes) {
    assert.deepEqual(state.board[fr][fc], { type: 'p', team: 'foe' });
  }
  let occupied = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (state.board[r][c]) occupied += 1;
    }
  }
  assert.equal(occupied, 1 + knight.setup.foes.length);
});

test('control badges (watch / your turn) have English and Telugu labels', () => {
  for (const key of ['watch', 'turn']) {
    const t = L.UI_TEXT[key];
    assert.ok(t && t.en && t.te, `UI_TEXT.${key} needs en and te`);
    assert.match(t.te, /[\u0C00-\u0C7F]/, `UI_TEXT.${key}.te should be Telugu script`);
  }
});
