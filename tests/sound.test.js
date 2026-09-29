'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const TH = require('../js/themes.js');
const sound = require('../js/sound.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'sound.js'), 'utf8');
const TYPES = ['r', 'b', 'q', 'k', 'n', 'p'];
const SHARED = ['select', 'nudge', 'watch', 'your-turn', 'bonk', 'tick',
  'move-r', 'move-b', 'move-q', 'move-k', 'move-n', 'move-p', 'star'];

/*
 * A minimal recording stand-in for the Web Audio API, so the sounds can be
 * scheduled in Node. Nothing is played: every parameter change is logged as
 * a string, in order, and node stop times are collected.
 */
function makeRecorder() {
  const rec = { log: [], gains: [], stops: [], loops: 0, nodes: [], compressor: null, dest: null };
  const r6 = (x) => Math.round(x * 1e6) / 1e6;

  function param(label, initial, isGain) {
    let v = initial;
    const note = (kind, val, t) => {
      rec.log.push(label + '.' + kind + ' ' + r6(val) + (t === undefined ? '' : ' @' + r6(t)));
      // Envelope gains only; a .value assignment is a fixed depth (vibrato in Hz, the master).
      if (isGain && kind !== 'value') rec.gains.push(val);
    };
    return {
      get value() { return v; },
      set value(x) { v = x; note('value', x); },
      setValueAtTime(x, t) { note('set', x, t); },
      exponentialRampToValueAtTime(x, t) { note('exp', x, t); },
      linearRampToValueAtTime(x, t) { note('lin', x, t); }
    };
  }

  function node(kind, extra) {
    const n = Object.assign({ kind, connected: [] }, extra);
    n.connect = (to) => { n.connected.push(to); return to; };
    rec.nodes.push(n);
    return n;
  }

  function typed(n, label) {
    Object.defineProperty(n, 'type', { set(x) { rec.log.push(label + '.type ' + x); } });
    return n;
  }

  class FakeAudioContext {
    constructor() {
      this.currentTime = 0;
      this.sampleRate = 8000;
      this.state = 'running';
      this.destination = node('destination');
      rec.dest = this.destination;
    }
    createGain() {
      return node('gain', { gain: param('gain.gain', 1, true) });
    }
    createOscillator() {
      const n = typed(node('osc', { frequency: param('osc.frequency', 440) }), 'osc');
      n.start = (t) => { rec.log.push('osc.start @' + r6(t)); };
      n.stop = (t) => { rec.stops.push(t); rec.log.push('osc.stop @' + r6(t)); };
      return n;
    }
    createBiquadFilter() {
      const n = node('filter', { frequency: param('filter.frequency', 350), Q: param('filter.Q', 1) });
      return typed(n, 'filter');
    }
    createBufferSource() {
      const n = node('source', {});
      n.start = (t) => { rec.log.push('src.start @' + r6(t)); };
      n.stop = (t) => { rec.stops.push(t); rec.log.push('src.stop @' + r6(t)); };
      Object.defineProperty(n, 'loop', { set(x) { if (x) rec.loops += 1; } });
      return n;
    }
    createBuffer(channels, length) {
      return { getChannelData: () => new Float32Array(length) };
    }
    createDynamicsCompressor() {
      const n = node('compressor', {
        threshold: param('comp.threshold', -24),
        knee: param('comp.knee', 30),
        ratio: param('comp.ratio', 12),
        attack: param('comp.attack', 0.003),
        release: param('comp.release', 0.25)
      });
      rec.compressor = n;
      return n;
    }
    resume() {}
  }
  return { rec, FakeAudioContext };
}

// Loads js/sound.js the way a browser does (top-level this is the global
// object, no module), with the fake AudioContext.
function loadInBrowser(unlock) {
  const made = makeRecorder();
  const sandbox = { AudioContext: made.FakeAudioContext };
  vm.runInNewContext(SRC, sandbox);
  const S = sandbox.FC.sound;
  if (unlock !== false) S.unlock();
  return { S, rec: made.rec };
}

// Runs one sound on a fresh context and returns what it scheduled.
function record(theme, name, arg) {
  const { S, rec } = loadInBrowser();
  if (theme) S.setTheme(theme);
  rec.log.length = 0;
  rec.gains.length = 0;
  rec.stops.length = 0;
  S.play(name, arg);
  return rec;
}

/* ---------- table coverage ---------- */

test('every theme id has a pick sound for all six piece types, plus capture and win', () => {
  const ids = TH.THEMES.map((t) => t.id);
  assert.deepEqual(Object.keys(sound.THEME_SOUNDS).sort(), ids.slice().sort());
  for (const id of ids) {
    const t = sound.THEME_SOUNDS[id];
    for (const type of TYPES) {
      assert.equal(typeof t.pieces[type], 'function', id + ': no pick sound for ' + type);
    }
    assert.deepEqual(Object.keys(t.pieces).sort(), TYPES.slice().sort(), id + ': unexpected piece types');
    assert.equal(typeof t.capture, 'function', id + ': no capture sound');
    assert.equal(typeof t.win, 'function', id + ': no win sound');
  }
});

test('the shared sounds are not part of any theme table', () => {
  for (const name of ['watch', 'your-turn', 'tick', 'nudge', 'bonk', 'select']) {
    assert.equal(typeof sound.SOUNDS[name], 'function', name + ' missing from SOUNDS');
    for (const id of Object.keys(sound.THEME_SOUNDS)) {
      const t = sound.THEME_SOUNDS[id];
      assert.equal(t[name], undefined, id + ' overrides ' + name);
      assert.equal(t.pieces[name], undefined, id + ' overrides ' + name);
    }
  }
});

/* ---------- safety without a context ---------- */

test('js/sound.js loads in Node and play() is a safe no-op without a context', () => {
  assert.equal(sound.context(), null);
  assert.equal(sound.output(), null);
  for (const name of SHARED.concat(['pick', 'capture', 'win', 'no-such-sound'])) {
    assert.doesNotThrow(() => sound.play(name, 'k'));
  }
  assert.doesNotThrow(() => sound.unlock()); // no AudioContext in Node
  assert.equal(sound.context(), null);
  assert.doesNotThrow(() => sound.play('pick', 'p'));
});

test('play() before unlock() does nothing', () => {
  const { S, rec } = loadInBrowser(false);
  S.play('win');
  S.play('pick', 'k');
  assert.equal(rec.log.length, 0);
  assert.equal(rec.nodes.length, 0);
});

test('setTheme accepts every theme id and falls back to robots for anything else', () => {
  const { S } = loadInBrowser();
  assert.equal(S.getTheme(), 'robots');
  for (const t of TH.THEMES) {
    S.setTheme(t.id);
    assert.equal(S.getTheme(), t.id);
  }
  for (const bad of ['nope', '', null, undefined, 'toString', '__proto__']) {
    S.setTheme(bad);
    assert.equal(S.getTheme(), 'robots', String(bad));
  }
});

/* ---------- the audio graph ---------- */

test('unlock() puts a gentle limiter between the master gain and the speakers', () => {
  const { rec } = loadInBrowser();
  const comp = rec.compressor;
  assert.ok(comp, 'no compressor');
  assert.equal(comp.threshold.value, -3);
  assert.equal(comp.knee.value, 0);
  assert.equal(comp.ratio.value, 4);
  assert.equal(comp.attack.value, 0.002);
  assert.equal(comp.release.value, 0.1);
  assert.deepEqual(comp.connected, [rec.dest]);
  const master = rec.nodes.find((n) => n.kind === 'gain');
  assert.equal(master.gain.value, 0.5);
  assert.deepEqual(master.connected, [comp]);
});

/* ---------- unchanged sounds ---------- */

test('the turn signals and interface sounds are identical in every theme', () => {
  for (const name of SHARED) {
    const base = record('robots', name, 'k').log;
    assert.ok(base.length > 0, name + ' scheduled nothing');
    for (const t of TH.THEMES) {
      assert.deepEqual(record(t.id, name, 'k').log, base, name + ' differs in ' + t.id);
    }
  }
});

test('the shared sounds keep their original levels (no theme boost)', () => {
  const peak = (name) => Math.max.apply(null, record('pirate', name).gains);
  assert.equal(peak('watch'), 0.1);
  assert.equal(peak('your-turn'), 0.16);
  assert.equal(peak('tick'), 0.06);
  assert.equal(peak('select'), 0.07);
});

/* ---------- theme sounds ---------- */

test('every theme sound schedules audio, stays within gain 1, never loops and ends within 1.5 s', () => {
  for (const t of TH.THEMES) {
    const calls = TYPES.map((type) => ['pick', type]).concat([['capture', 1], ['capture', 7], ['win']]);
    for (const c of calls) {
      const label = t.id + ' ' + c.join(' ');
      const rec = record(t.id, c[0], c[1]);
      assert.ok(rec.stops.length > 0, label + ': scheduled nothing');
      assert.equal(rec.loops, 0, label + ': loops');
      for (const g of rec.gains) assert.ok(g <= 1, label + ': gain ' + g + ' above 1');
      const end = Math.max.apply(null, rec.stops);
      assert.ok(end <= 1.5 + 0.06, label + ': ends at ' + end + ' s');
    }
  }
});

test('pick with an unknown or missing piece type is silent', () => {
  assert.equal(record('robots', 'pick', 'x').log.length, 0);
  assert.equal(record('robots', 'pick').log.length, 0);
});

test('theme sounds differ between themes', () => {
  for (const type of TYPES) {
    const logs = TH.THEMES.map((t) => JSON.stringify(record(t.id, 'pick', type).log));
    assert.equal(new Set(logs).size, TH.THEMES.length, 'pick ' + type + ' is the same in two themes');
  }
});

test('the capture streak raises pitch one semitone per step, capped at six', () => {
  const firstFreq = (streak) => {
    const rec = record('space', 'capture', streak);
    const line = rec.log.find((l) => l.indexOf('osc.frequency.set ') === 0);
    return Number(line.split(' ')[1]);
  };
  const base = firstFreq(1);
  assert.equal(firstFreq(undefined), base);
  for (let s = 2; s <= 7; s++) {
    const want = base * Math.pow(2, (s - 1) / 12);
    assert.ok(Math.abs(firstFreq(s) - want) < 1e-3, 'streak ' + s);
  }
  assert.equal(firstFreq(30), firstFreq(7));
});

test('the pitch multiplier does not leak into the next sound', () => {
  const { S, rec } = loadInBrowser();
  S.play('capture', 7);
  rec.log.length = 0;
  S.play('watch');
  const first = rec.log.find((l) => l.indexOf('osc.frequency.set ') === 0);
  assert.ok(first.indexOf('osc.frequency.set 660 ') === 0, first);
});

/* ---------- another theme's sound, and calm mode (stage 5) ---------- */

test('play() can use another theme\'s sound without changing the current theme', () => {
  const { S, rec } = loadInBrowser();
  S.setTheme('robots');
  const logOf = (fn) => { rec.log.length = 0; fn(); return rec.log.slice(); };
  const own = logOf(() => S.play('pick', 'k'));
  const pirate = logOf(() => S.play('pick', 'k', 'pirate'));
  const pirateNative = record('pirate', 'pick', 'k').log;
  assert.deepEqual(pirate, pirateNative);
  assert.notDeepEqual(pirate, own);
  assert.equal(S.getTheme(), 'robots');
  // capture and win take the override too
  assert.deepEqual(logOf(() => S.play('capture', 1, 'space')), record('space', 'capture', 1).log);
  assert.deepEqual(logOf(() => S.play('win', undefined, 'dinos')), record('dinos', 'win').log);
});

test('an unknown theme override plays the current theme\'s sound', () => {
  const { S, rec } = loadInBrowser();
  S.setTheme('space');
  const base = record('space', 'pick', 'q').log;
  for (const bad of ['nope', '', null, 'toString', '__proto__']) {
    rec.log.length = 0;
    S.play('pick', 'q', bad);
    assert.deepEqual(rec.log, base, String(bad));
  }
});

test('calm mode lowers the effects bus to 0.6 and leaves the master and the voice output alone', () => {
  const { S, rec } = loadInBrowser();
  const gains = rec.nodes.filter((n) => n.kind === 'gain');
  const master = gains[0];
  const fx = gains[1];
  assert.equal(master.gain.value, 0.5);
  assert.deepEqual(fx.connected, [master]);
  assert.equal(fx.gain.value, 1);
  assert.equal(S.output(), master, 'the voice must connect to the master, not to the effects bus');
  assert.equal(S.isCalm(), false);
  S.setCalm(true);
  assert.equal(S.isCalm(), true);
  assert.equal(fx.gain.value, 0.6);
  assert.equal(master.gain.value, 0.5);
  assert.equal(S.output(), master);
  S.setCalm(false);
  assert.equal(fx.gain.value, 1);
});

test('every effect reaches the master through the effects bus, never directly', () => {
  for (const [name, arg] of [['select'], ['your-turn'], ['pick', 'k'], ['capture', 3], ['win'], ['move-q']]) {
    for (const t of TH.THEMES) {
      const { S, rec } = loadInBrowser();
      S.setTheme(t.id);
      const before = rec.nodes.length;
      S.play(name, arg);
      const master = rec.nodes.find((n) => n.kind === 'gain');
      const made = rec.nodes.slice(before);
      assert.ok(made.length > 0, name + ' scheduled nothing');
      for (const n of made) {
        assert.ok(n.connected.indexOf(master) === -1, name + ' in ' + t.id + ': a node connects straight to the master');
      }
    }
  }
});

test('calm mode set before the first tap is applied when the audio context is created', () => {
  const made = makeRecorder();
  const sandbox = { AudioContext: made.FakeAudioContext };
  vm.runInNewContext(SRC, sandbox);
  const S = sandbox.FC.sound;
  S.setCalm(true);
  assert.doesNotThrow(() => S.setCalm(true)); // no context yet
  S.unlock();
  const fx = made.rec.nodes.filter((n) => n.kind === 'gain')[1];
  assert.equal(fx.gain.value, 0.6);
});
