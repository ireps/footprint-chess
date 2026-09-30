#!/usr/bin/env node
'use strict';

/*
 * Footprint Chess: browser tests.
 *
 * Plays the app in headless Chromium, the way a child would, and fails on
 * any page error, console error or Content Security Policy report:
 *   - Home and the Games screen, at the tablet's landscape (1280x800) and
 *     portrait (800x1280) sizes, with touch;
 *   - every game on the Games screen, from its card through any first-time
 *     lesson, the Team card, the Mission card and the "watch how to play"
 *     scene, until the child's turn begins;
 *   - the pawn battle played to its Won card (the child follows the app's
 *     own hints; js/army.js decides the moves from what is on the board).
 *
 * Needs Playwright, which is not a dependency of the app:
 *   npm install --no-save playwright@1.56.1 && npx playwright install chromium
 *   node e2e/run.js
 * Continuous integration runs it on every pull request
 * (.github/workflows/test.yml). Screenshots of a failure are written to
 * e2e/output/ (ignored by git).
 *
 * Kept out of tests/ on purpose: `node --test` must not need a browser.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const R = require('../js/rules.js');
const A = require('../js/army.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'output');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const LANDSCAPE = { width: 1280, height: 800 };
const PORTRAIT = { width: 800, height: 1280 };

/* A static file server for the repository, on a free port. */
function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = path.normalize(path.join(ROOT, url === '/' ? 'index.html' : url));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

let browser;
let base;
const failures = [];

async function newPage(viewport) {
  const context = await browser.newContext({ viewport, hasTouch: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.errors = [];
  page.on('console', m => { if (m.type() === 'error' || /Content Security Policy/.test(m.text())) page.errors.push(m.text()); });
  page.on('pageerror', e => page.errors.push('page error: ' + e.message));
  await page.goto(base + '/index.html?break=off');
  await page.waitForSelector('.games-entry');
  return page;
}

async function done(page, name) {
  if (page.errors.length) failures.push(name + ': ' + page.errors.join(' | '));
  await page.context().close();
}

async function fail(page, name, why) {
  failures.push(name + ': ' + why);
  try {
    fs.mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: path.join(OUT, name.replace(/[^\w-]+/g, '_') + '.png') });
  } catch (e) { /* the screenshot is only a help */ }
}

async function modeText(page) {
  return page.$eval('#mode-text', n => n.textContent).catch(() => '');
}

async function visible(page, selector) {
  return !!(await page.$(selector + ':not([hidden])'));
}

/* From a game card to the child's first turn: skip lessons and scenes,
 * pick the first team, press Play. */
async function reachTurn(page, name) {
  for (let i = 0; i < 120; i++) {
    if (await page.$('.team-option')) {
      await page.click('.team-option');
    } else if (await page.$('#card .go-btn')) {
      await page.click('#card .go-btn');
    } else if (await visible(page, '#tool-skip')) {
      await page.click('#tool-skip');
    } else if ((await modeText(page)) === 'Your turn!' && !(await visible(page, '#overlay'))) {
      return true;
    }
    await page.waitForTimeout(250);
  }
  await fail(page, name, 'never reached the child\'s turn');
  return false;
}

async function tapSquare(page, r, c) {
  const box = await page.$eval('#board', b => { const x = b.getBoundingClientRect(); return { x: x.left, y: x.top, w: x.width, h: x.height }; });
  await page.touchscreen.tap(box.x + (c + 0.5) * box.w / 8, box.y + (r + 0.5) * box.h / 8);
}

/* The board as the page shows it: the child's pieces and the other side's. */
async function readBoard(page) {
  const st = await page.evaluate(() => {
    function at(n) { const m = /translate\((-?[\d.]+)%, ?(-?[\d.]+)%\)/.exec(n.style.transform); return [Math.round(+m[2] / 100), Math.round(+m[1] / 100)]; }
    function type(n) { return /-(\w)$/.exec(n.querySelector('use').getAttribute('href'))[1]; }
    return {
      me: [...document.querySelectorAll('#pieces .piece:not(.poof)')].map(n => ({ at: at(n), t: type(n) })),
      foe: [...document.querySelectorAll('#items .item:not(.poof)')].map(n => ({ at: at(n), t: type(n) }))
    };
  });
  const board = R.emptyBoard();
  st.me.forEach(p => { board[p.at[0]][p.at[1]] = { type: p.t, team: 'me' }; });
  st.foe.forEach(p => { board[p.at[0]][p.at[1]] = { type: p.t, team: 'foe' }; });
  return board;
}

async function testScreens() {
  for (const [label, viewport] of [['landscape', LANDSCAPE], ['portrait', PORTRAIT]]) {
    const name = 'screens ' + label;
    const page = await newPage(viewport);
    await page.click('.games-entry');
    await page.waitForSelector('#game-rows .game-card');
    const cards = (await page.$$('#game-rows .game-card')).length + (await page.$$('#army-ladder .game-card')).length;
    if (cards < 20) await fail(page, name, 'only ' + cards + ' game cards');
    // Decorative background shapes may reach past the edge; what matters is
    // that a child can never scroll the page sideways.
    const scrolls = await page.evaluate(() => {
      const wide = document.documentElement.scrollWidth > window.innerWidth + 1;
      const hidden = [document.documentElement, document.body].some(n => getComputedStyle(n).overflowX === 'hidden');
      return wide && !hidden;
    });
    if (scrolls) await fail(page, name, 'the Games screen scrolls sideways');
    await done(page, name);
  }
}

async function testEveryGame() {
  const page0 = await newPage(LANDSCAPE);
  await page0.click('.games-entry');
  const names = await page0.$$eval('#game-rows .game-card, #army-ladder .game-card', cards => cards.map(c => c.getAttribute('aria-label')));
  await done(page0, 'games list');
  for (const game of names) {
    const name = 'game ' + game;
    const page = await newPage(LANDSCAPE);
    await page.click('.games-entry');
    await page.click('.game-card[aria-label="' + game.replace(/"/g, '\\"') + '"]');
    await reachTurn(page, name);
    await done(page, name);
  }
  return names.length;
}

async function testPawnBattle() {
  const name = 'pawn battle to the Won card (portrait)';
  const page = await newPage(PORTRAIT);
  await page.click('.games-entry');
  await page.click('#army-ladder .game-card');
  if (!(await reachTurn(page, name))) { await done(page, name); return; }
  let last = null;
  for (let move = 0; move < 60; move++) {
    // Wait for the child's turn, or for the game to end (the win line, any
    // tip and then the Won card).
    for (let w = 0; w < 240 && (await modeText(page)) !== 'Your turn!' && !(await page.$('#card .rbtn-home')); w++) await page.waitForTimeout(250);
    if (await page.$('#card .rbtn-home')) break;
    if ((await modeText(page)) !== 'Your turn!') { await fail(page, name, 'stuck waiting for the child\'s turn'); break; }
    const state = { board: await readBoard(page), turn: 'me', over: false, lastMine: last };
    const piece = A.hint(state, null);
    const to = piece && A.hint(state, piece);
    // No move: the game has just ended (every pawn blocked counts as a win
    // for the child), so the Won card is on its way.
    if (!to) break;
    await tapSquare(page, piece[0], piece[1]);
    await page.waitForTimeout(250);
    await tapSquare(page, to[0], to[1]);
    last = { from: piece, to };
    await page.waitForTimeout(1200);
  }
  for (let w = 0; w < 80 && !(await page.$('#card .rbtn-home')); w++) await page.waitForTimeout(250);
  if (!(await page.$('#card .rbtn-home'))) await fail(page, name, 'the Won card never showed');
  await done(page, name);
}

async function main() {
  const server = await serve();
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch();
  try {
    await testScreens();
    const n = await testEveryGame();
    await testPawnBattle();
    console.log('Browser tests: home and Games screen at both sizes, ' + n + ' games to the first turn, the pawn battle to its Won card.');
  } finally {
    await browser.close();
    server.close();
  }
  if (failures.length) {
    console.log('\n' + failures.length + ' failure(s):');
    failures.forEach(f => console.log('  ' + f));
    process.exit(1);
  }
  console.log('All browser tests passed.');
}

main().catch(e => { console.error(e); process.exit(1); });
