'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'voice.js'), 'utf8');
const LANGS_SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'langs.js'), 'utf8');

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
  // js/voice.js depends on the language registry (FC.langs), loaded first.
  vm.runInContext(LANGS_SRC, sandbox);
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

/* ---------- device voices and the fallback chain (mocked speechSynthesis) ---------- */

// Sound is "enabled" but there is no AudioContext and no clip list, so every
// line skips its clips and goes straight to device speech: this exercises
// pickVoice and the language chain. spoken collects { text, voice } for each
// utterance; every utterance ends by itself after a few ms.
function loadWithSpeech(voices) {
  const spoken = [];
  const sandbox = {
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    speechSynthesis: {
      getVoices: () => voices,
      addEventListener: () => {},
      cancel: () => {},
      speak: (u) => { spoken.push({ text: u.text, voice: u.voice }); setTimeout(() => u.onend && u.onend(), 5); }
    },
    SpeechSynthesisUtterance: function (text) { this.text = text; },
    FC: {
      lessons: {
        LINES: { g: { ms: 30, en: 'english g', te: 'telugu g' } }
      },
      sound: { isEnabled: () => true }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(LANGS_SRC, sandbox);
  vm.runInContext(SRC, sandbox);
  return { V: sandbox.FC.voice, spoken };
}

const voice = (name, lang) => ({ name, lang });

async function speakOnce(V, lang) {
  V.setLang(lang);
  let done = false;
  V.say('g', () => { done = true; });
  await sleep(80);
  assert.ok(done, 'the line must finish');
}

test('English: the first preferred name wins, in the registry order', async () => {
  const { V, spoken } = loadWithSpeech([
    voice('David', 'en-US'), voice('Zira', 'en-US'), voice('Google UK English Female', 'en-GB'), voice('Neerja', 'en-IN')
  ]);
  await speakOnce(V, 'en');
  assert.equal(spoken.length, 1);
  assert.equal(spoken[0].text, 'english g');
  assert.equal(spoken[0].voice.name, 'Google UK English Female');
});

test('English: with no preferred name, a "female" voice, then en-IN, then en-GB, skipping avoided names', async () => {
  let r = loadWithSpeech([voice('Foo', 'en-GB'), voice('Some Female Voice', 'en-US'), voice('Bar', 'en-IN')]);
  await speakOnce(r.V, 'en');
  assert.equal(r.spoken[0].voice.name, 'Some Female Voice');

  r = loadWithSpeech([voice('Foo', 'en-GB'), voice('Baz', 'en-US'), voice('Bar', 'en-IN')]);
  await speakOnce(r.V, 'en');
  assert.equal(r.spoken[0].voice.name, 'Bar');

  // Mark is on the avoid list, so en-IN is skipped and en-GB wins.
  r = loadWithSpeech([voice('Mark', 'en-IN'), voice('Zed', 'en-GB'), voice('Qux', 'en-US')]);
  await speakOnce(r.V, 'en');
  assert.equal(r.spoken[0].voice.name, 'Zed');

  // Every English voice avoided: still better than silence, the first one.
  r = loadWithSpeech([voice('David', 'en-US'), voice('Mark', 'en-GB')]);
  await speakOnce(r.V, 'en');
  assert.equal(r.spoken[0].voice.name, 'David');
});

test('Telugu: a "female" Telugu voice if there is one, else the first; the line is spoken in Telugu', async () => {
  let r = loadWithSpeech([voice('Zira', 'en-US'), voice('Plain', 'te-IN'), voice('Some Female', 'te-IN')]);
  await speakOnce(r.V, 'te');
  assert.equal(r.spoken.length, 1);
  assert.equal(r.spoken[0].text, 'telugu g');
  assert.equal(r.spoken[0].voice.name, 'Some Female');

  r = loadWithSpeech([voice('Plain', 'te-IN'), voice('Other', 'te_IN')]);
  await speakOnce(r.V, 'te');
  assert.equal(r.spoken[0].voice.name, 'Plain');
});

test('Telugu falls back to English speech when the device has no Telugu voice', async () => {
  const { V, spoken } = loadWithSpeech([voice('Zira', 'en-US')]);
  await speakOnce(V, 'te');
  assert.equal(spoken.length, 1);
  assert.equal(spoken[0].text, 'english g');
  assert.equal(spoken[0].voice.name, 'Zira');
});

test('English never falls back to Telugu: with only a Telugu voice, the line is silent but still finishes', async () => {
  const { V, spoken } = loadWithSpeech([voice('Plain', 'te-IN')]);
  await speakOnce(V, 'en');
  assert.equal(spoken.length, 0);
});

test('a voice whose tag only starts with the prefix letters does not match ("eng" is not "en")', async () => {
  const { V, spoken } = loadWithSpeech([voice('Odd', 'eng'), voice('Real', 'en-US')]);
  await speakOnce(V, 'en');
  assert.equal(spoken[0].voice.name, 'Real');
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
