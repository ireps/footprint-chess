'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const LG = require('../js/langs.js');
const L = require('../js/lessons.js');
const voiceClips = require('../js/voice-clips.js');

const ROOT = path.join(__dirname, '..');

/* ---------- registry shape ---------- */

test('LANGUAGES lists English then Telugu, with unique ids', () => {
  assert.deepEqual(LG.ids(), ['en', 'te']);
  assert.equal(new Set(LG.ids()).size, LG.LANGUAGES.length);
});

test('every entry has the documented fields', () => {
  for (const l of LG.LANGUAGES) {
    assert.match(l.id, /^[a-z]{2,3}$/, l.id + ': id is a short lowercase code');
    for (const key of ['name', 'nativeName', 'glyph', 'speech', 'azureVoice']) {
      assert.ok(typeof l[key] === 'string' && l[key].trim().length > 0, l.id + ': ' + key + ' is missing');
    }
    assert.equal([...l.glyph].length, 1, l.id + ': glyph is a single character');
    assert.match(l.speech, /^[a-z]{2,3}$/, l.id + ': speech is a BCP-47 language prefix');
    assert.match(l.azureVoice, /^[a-z]{2,3}-[A-Z]{2}-\w+Neural$/, l.id + ': azureVoice looks like xx-YY-NameNeural');
    assert.ok(l.azureVoice.startsWith(l.speech + '-'), l.id + ': azureVoice is in the same language as speech');
    assert.ok(l.fallback === null || LG.isLang(l.fallback), l.id + ': fallback is null or a registry id');
    assert.notEqual(l.fallback, l.id, l.id + ': a language is not its own fallback');
    assert.ok(l.script === null || l.script instanceof RegExp, l.id + ': script is null or a RegExp');
    assert.ok(typeof l.msPerChar === 'number' && l.msPerChar > 0, l.id + ': msPerChar');
    assert.equal(typeof l.turnOf, 'function', l.id + ': turnOf');
    assert.ok(l.voicePrefs === null || typeof l.voicePrefs === 'object', l.id + ': voicePrefs is null or an object');
  }
});

test('the glyphs are different, so the language button can tell languages apart', () => {
  assert.equal(new Set(LG.LANGUAGES.map(l => l.glyph)).size, LG.LANGUAGES.length);
});

test('English and Telugu entries carry the agreed data', () => {
  const en = LG.get('en');
  const te = LG.get('te');
  assert.equal(en.name, 'English');
  assert.equal(en.glyph, 'A');
  assert.equal(en.speech, 'en');
  assert.equal(en.fallback, null);
  assert.equal(en.script, null);
  assert.equal(en.azureVoice, 'en-IN-NeerjaNeural');
  assert.equal(te.name, 'Telugu');
  assert.equal(te.nativeName, 'తెలుగు');
  assert.equal(te.glyph, 'అ');
  assert.equal(te.speech, 'te');
  assert.equal(te.fallback, 'en');
  assert.ok(te.script.test('తెలుగు'));
  assert.ok(!te.script.test('English'));
  assert.equal(te.azureVoice, 'te-IN-ShrutiNeural');
});

test('English carries the voice preferences; Telugu has none', () => {
  const prefs = LG.get('en').voicePrefs;
  assert.ok(Array.isArray(prefs.preferNames) && prefs.preferNames.length === 10);
  assert.ok(prefs.preferNames.every(re => re instanceof RegExp));
  assert.equal(prefs.preferNames[0].test('Google UK English Female'), true);
  assert.ok(prefs.avoidNames instanceof RegExp);
  assert.equal(prefs.avoidNames.test('David'), true);
  assert.equal(prefs.avoidNames.test('Zira'), false);
  assert.deepEqual(prefs.preferRegions, ['en-in', 'en-gb']);
  assert.equal(LG.get('te').voicePrefs, null);
});

test('DEFAULT_LANG is English, is in the registry, and never falls back to another language', () => {
  assert.equal(LG.DEFAULT_LANG, 'en');
  assert.ok(LG.isLang(LG.DEFAULT_LANG));
  assert.equal(LG.get(LG.DEFAULT_LANG).fallback, null);
});

test('get, isLang and next', () => {
  assert.equal(LG.get('te').id, 'te');
  assert.equal(LG.get('xx'), null);
  assert.equal(LG.isLang('en'), true);
  for (const bad of ['xx', '', 'EN', null, undefined, 'en ']) assert.equal(LG.isLang(bad), false, String(bad));
  assert.equal(LG.next('en'), 'te');
  assert.equal(LG.next('te'), 'en', 'next wraps round to the first language');
  assert.equal(LG.next('xx'), LG.DEFAULT_LANG);
});

/* ---------- fallbackChain ---------- */

test('fallbackChain: the language, then its fallbacks, always ending at the default language', () => {
  assert.deepEqual(LG.fallbackChain('en'), ['en']);
  assert.deepEqual(LG.fallbackChain('te'), ['te', 'en']);
  assert.deepEqual(LG.fallbackChain('xx'), ['en']);
  for (const id of LG.ids()) {
    const chain = LG.fallbackChain(id);
    assert.equal(chain[0], id);
    assert.equal(chain[chain.length - 1], LG.DEFAULT_LANG, id + ': the chain ends at the default language');
    assert.equal(new Set(chain).size, chain.length, id + ': no language twice');
    assert.ok(chain.every(c => LG.isLang(c)));
  }
});

test('fallbackChain has no cycles, and still ends at the default language, even for a bad registry', () => {
  const extra = [
    { id: 'aa', fallback: 'bb' },
    { id: 'bb', fallback: 'aa' },
    { id: 'cc', fallback: null }
  ];
  LG.LANGUAGES.push(...extra);
  try {
    assert.deepEqual(LG.fallbackChain('aa'), ['aa', 'bb', 'en']);
    assert.deepEqual(LG.fallbackChain('bb'), ['bb', 'aa', 'en']);
    // A language with no fallback that is not the default still ends at the default.
    assert.deepEqual(LG.fallbackChain('cc'), ['cc', 'en']);
  } finally {
    LG.LANGUAGES.splice(LG.LANGUAGES.length - extra.length, extra.length);
  }
  assert.deepEqual(LG.ids(), ['en', 'te']);
});

/* ---------- turnOf ---------- */

test('English turnOf: a plural ending in s takes a bare apostrophe, otherwise apostrophe s', () => {
  const en = LG.get('en');
  assert.equal(en.turnOf('Androids'), 'Androids’ turn');
  assert.equal(en.turnOf('Buccaneers'), 'Buccaneers’ turn');
  assert.equal(en.turnOf('White'), 'White’s turn');
  assert.equal(en.turnOf('Black', 'ignored'), 'Black’s turn');
});

test('Telugu turnOf: the possessive form when there is one, else the name, then వంతు', () => {
  const te = LG.get('te');
  assert.equal(te.turnOf('పిడుగులు', 'పిడుగుల'), 'పిడుగుల వంతు');
  assert.equal(te.turnOf('సూర్య జట్టు'), 'సూర్య జట్టు వంతు');
  assert.equal(te.turnOf('సూర్య జట్టు', undefined), 'సూర్య జట్టు వంతు');
  assert.equal(te.turnOf('సూర్య జట్టు', ''), 'సూర్య జట్టు వంతు');
});

/* ---------- other modules read the registry ---------- */

test('FC.lessons.LANGS and DEFAULT_LANG come from the registry', () => {
  assert.deepEqual(L.LANGS, LG.ids());
  assert.equal(L.DEFAULT_LANG, LG.DEFAULT_LANG);
});

test('js/voice-clips.js has a key per registry language, and each language has a clip folder or no clips listed', () => {
  assert.deepEqual(Object.keys(voiceClips).sort(), LG.ids().slice().sort());
  for (const id of LG.ids()) {
    assert.ok(Array.isArray(voiceClips[id]), id + ': voice-clips.js entry is an array');
    const dir = path.join(ROOT, 'audio', 'voice', id);
    assert.ok(fs.existsSync(dir) || voiceClips[id].length === 0, 'audio/voice/' + id + '/ is missing but clips are listed');
  }
});

test('every registry language has a folder name matching its id, and no unknown folder sits under audio/voice/', () => {
  const dir = path.join(ROOT, 'audio', 'voice');
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (!fs.statSync(path.join(dir, name)).isDirectory()) continue;
    assert.ok(LG.isLang(name), 'audio/voice/' + name + '/ is not a registry language');
  }
});

test('check.html and index.html both load js/langs.js', () => {
  for (const page of ['index.html', 'check.html']) {
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    assert.ok(html.includes('<script src="js/langs.js"></script>'), page + ' does not load js/langs.js');
  }
});
