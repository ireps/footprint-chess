'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'voice.js'), 'utf8');

/*
 * js/voice.js is a browser script. Here it runs in a sandbox with sound off,
 * so every line is "silence" timed by its estimated length (LINES[id].ms):
 * that exercises say/sayAfter/stop and the queue without any audio.
 */
function load() {
  const sandbox = {
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    FC: {
      lessons: {
        LANGS: ['en', 'te'],
        DEFAULT_LANG: 'en',
        LINES: {
          a: { ms: 20, en: 'a', te: 'a' },
          b: { ms: 20, en: 'b', te: 'b' },
          c: { ms: 20, en: 'c', te: 'c' },
          d: { ms: 20, en: 'd', te: 'd' },
          e: { ms: 20, en: 'e', te: 'e' },
          f: { ms: 20, en: 'f', te: 'f' }
        }
      },
      sound: { isEnabled: () => false }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return sandbox.FC.voice;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('sayAfter with nothing playing behaves like say', async () => {
  const V = load();
  const log = [];
  V.sayAfter('a', () => log.push('a'));
  await sleep(60);
  assert.deepEqual(log, ['a']);
});

test('sayAfter plays after the current line has settled and its done ran', async () => {
  const V = load();
  const log = [];
  V.say('a', () => log.push('a done'));
  V.sayAfter('b', () => log.push('b done'));
  assert.deepEqual(log, []);
  await sleep(30);
  assert.deepEqual(log, ['a done']);
  await sleep(40);
  assert.deepEqual(log, ['a done', 'b done']);
});

test('queued lines play in order', async () => {
  const V = load();
  const log = [];
  V.say('a', () => log.push('a'));
  V.sayAfter('b', () => log.push('b'));
  V.sayAfter('c', () => log.push('c'));
  await sleep(120);
  assert.deepEqual(log, ['a', 'b', 'c']);
});

test('say() interrupts and clears the queue without calling callbacks', async () => {
  const V = load();
  const log = [];
  V.say('a', () => log.push('a'));
  V.sayAfter('b', () => log.push('b'));
  V.say('c', () => log.push('c'));
  await sleep(120);
  assert.deepEqual(log, ['c']);
});

test('stop() drops the current line and the queue', async () => {
  const V = load();
  const log = [];
  V.say('a', () => log.push('a'));
  V.sayAfter('b', () => log.push('b'));
  V.stop();
  await sleep(80);
  assert.deepEqual(log, []);
  // Usable again afterwards.
  V.sayAfter('c', () => log.push('c'));
  await sleep(60);
  assert.deepEqual(log, ['c']);
});

test('a done that speaks again keeps the queue in order', async () => {
  const V = load();
  const log = [];
  V.say('a', () => { log.push('a'); V.sayAfter('c', () => log.push('c')); });
  V.sayAfter('b', () => log.push('b'));
  await sleep(140);
  assert.deepEqual(log, ['a', 'b', 'c']);
});

test('the queue holds 4; callback-less items are dropped first, flow callbacks never', async () => {
  const V = load();
  const log = [];
  V.say('a', () => log.push('a'));
  V.sayAfter('b');
  V.sayAfter('c', () => log.push('c'));
  V.sayAfter('d');
  V.sayAfter('e');
  V.sayAfter('f', () => log.push('f')); // full: drops the oldest callback-less item (b)
  await sleep(200);
  assert.deepEqual(log, ['a', 'c', 'f']);
});

test('a new callback-less item is dropped when the queue is full of flow callbacks', async () => {
  const V = load();
  const log = [];
  V.say('a', () => log.push('a'));
  ['b', 'c', 'd', 'e'].forEach((id) => V.sayAfter(id, () => log.push(id)));
  V.sayAfter('f');
  await sleep(220);
  assert.deepEqual(log, ['a', 'b', 'c', 'd', 'e']);
});

test('a flow callback is kept even when the queue is full', async () => {
  const V = load();
  const log = [];
  V.say('a', () => log.push('a'));
  ['b', 'c', 'd', 'e'].forEach((id) => V.sayAfter(id, () => log.push(id)));
  V.sayAfter('f', () => log.push('f'));
  await sleep(260);
  assert.deepEqual(log, ['a', 'b', 'c', 'd', 'e', 'f']);
});

test('nothing throws on unknown ids or missing callbacks', async () => {
  const V = load();
  V.say('nope');
  V.sayAfter('nope');
  V.sayAfter('also-nope');
  V.stop();
  V.setLang('xx');
  assert.equal(V.getLang(), 'en');
  await sleep(10);
});
