/*
 * Footprint Chess: sound effects generated with the Web Audio API.
 * No audio files. Browsers block audio until the first user gesture,
 * so call FC.sound.unlock() from a tap handler before playing.
 *
 * Two kinds of sound:
 *  - Shared sounds (SOUNDS): the turn signals ('watch', 'your-turn') and the
 *    small interface sounds. They are the same in every theme so the child
 *    learns them once.
 *  - Theme sounds (THEME_SOUNDS): a cue for tapping each piece type, for a
 *    capture and for a win, chosen with FC.sound.setTheme(id). They are all
 *    one-shots under 1.5 seconds; nothing loops.
 *
 * Classic script: exposes window.FC.sound in the browser and module.exports
 * in Node (for tests; there is no AudioContext there, so play() does
 * nothing). Keep to ES2017 syntax (see README, "Browser support and coding
 * rules").
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;

  var ctx = null;
  var noiseOffset = 0;
  var master = null;
  var noiseBuf = null;
  var enabled = true;
  var themeId = 'robots';

  // Calm mode (the grown-ups' corner): sound effects are about 40% quieter.
  // Every effect goes through fxBus, a gain node between the effects and the
  // master, so the level of the voice (which connects to the master through
  // output()) does not change.
  var CALM_GAIN = 0.6;
  var calm = false;
  var fxBus = null;

  // Level of the theme sounds. They were auditioned with a master gain of
  // 0.8 and a 1.6 boost on every node; the app's master gain is 0.5, so the
  // boost here is 1.6 * 0.8 / 0.5. No single gain node goes above 1 (see
  // level()); the limiter after the master catches peaks when sounds overlap.
  var THEME_GAIN = 1.6 * 0.8 / 0.5;

  // Set only while play() schedules one sound: gainMul scales the level (1
  // for the shared sounds, THEME_GAIN for theme sounds) and pitchMul
  // multiplies every frequency (the capture streak pitch-up).
  var gainMul = 1;
  var pitchMul = 1;

  function level(vol) {
    return Math.min(vol * gainMul, 1);
  }

  function unlock() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return;
      try {
        ctx = new AC();
        // master -> gentle limiter -> speakers. The limiter only tames loud
        // peaks when several theme sounds overlap; normal levels pass as is.
        var limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -3;
        limiter.knee.value = 0;
        limiter.ratio.value = 4;
        limiter.attack.value = 0.002;
        limiter.release.value = 0.1;
        master = ctx.createGain();
        master.gain.value = 0.5;
        master.connect(limiter);
        limiter.connect(ctx.destination);
        fxBus = ctx.createGain();
        fxBus.gain.value = calm ? CALM_GAIN : 1;
        fxBus.connect(master);
        // Two seconds of white noise, shared by every noise burst. Made with
        // its own small generator so sound effects never use Math.random,
        // which the games' opponent moves rely on.
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        var data = noiseBuf.getChannelData(0);
        var seed = 22695477;
        for (var i = 0; i < data.length; i++) {
          seed = (seed * 16807) % 2147483647;
          data[i] = seed / 1073741823.5 - 1;
        }
      } catch (e) {
        ctx = null;
        master = null;
        fxBus = null;
        noiseBuf = null;
        return;
      }
    }
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
  }

  // One oscillator note with an optional pitch glide. opt (all optional):
  // lp / bp = low-pass / band-pass cutoff in Hz (q = its Q), vib = [rate Hz,
  // depth Hz] vibrato, attack = seconds.
  function tone(f0, f1, start, dur, wave, vol, opt) {
    opt = opt || {};
    f0 *= pitchMul;
    f1 *= pitchMul;
    var t = ctx.currentTime + start;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    if (opt.vib) {
      var lfo = ctx.createOscillator();
      var lfoGain = ctx.createGain();
      lfo.frequency.value = opt.vib[0];
      lfoGain.gain.value = opt.vib[1] * pitchMul;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    var node = osc;
    if (opt.lp || opt.bp) {
      var filter = ctx.createBiquadFilter();
      filter.type = opt.lp ? 'lowpass' : 'bandpass';
      filter.frequency.value = (opt.lp || opt.bp) * pitchMul;
      filter.Q.value = opt.q || 1;
      osc.connect(filter);
      node = filter;
    }
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(level(vol), t + (opt.attack || 0.012));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(gain);
    gain.connect(fxBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // A burst of filtered white noise; the filter sweeps from f0 to f1.
  function noise(start, dur, vol, type, f0, f1, q) {
    if (!noiseBuf) return;
    f0 *= pitchMul;
    f1 *= pitchMul;
    var t = ctx.currentTime + start;
    var src = ctx.createBufferSource();
    var filter = ctx.createBiquadFilter();
    var gain = ctx.createGain();
    src.buffer = noiseBuf;
    filter.type = type;
    filter.Q.value = q || 1;
    filter.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) filter.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(level(vol), t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(fxBus);
    // Start each burst at a different point in the shared noise buffer.
    noiseOffset = (noiseOffset + 0.37) % 1.5;
    src.start(t, noiseOffset);
    src.stop(t + dur + 0.05);
  }

  // Bell or metal: inharmonic sine partials, the higher ones fading sooner.
  function partials(f, ratios, start, dur, vol) {
    ratios.forEach(function (r, i) {
      tone(f * r, f * r, start, dur / (1 + i * 0.5), 'sine', vol / (1 + i * 0.6));
    });
  }

  // A cartoon roar: two sawtooths through a moving low-pass, with a growl
  // tremolo and a breath of noise.
  function roar(start, dur, lo, hi, vol) {
    lo *= pitchMul;
    hi *= pitchMul;
    var t = ctx.currentTime + start;
    var filter = ctx.createBiquadFilter();
    var trem = ctx.createGain();
    var amp = ctx.createGain();
    filter.type = 'lowpass';
    filter.Q.value = 2;
    filter.frequency.setValueAtTime(1200 * pitchMul, t);
    filter.frequency.linearRampToValueAtTime(3200 * pitchMul, t + dur * 0.35);
    filter.frequency.linearRampToValueAtTime(900 * pitchMul, t + dur);
    trem.gain.value = 0.6;
    var lfo = ctx.createOscillator();
    var lfoGain = ctx.createGain();
    lfo.frequency.value = 28;
    lfoGain.gain.value = 0.4;
    lfo.connect(lfoGain);
    lfoGain.connect(trem.gain);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(level(vol), t + 0.08);
    amp.gain.linearRampToValueAtTime(level(vol) * 0.8, t + dur * 0.6);
    amp.gain.linearRampToValueAtTime(0, t + dur);
    [1, 1.012].forEach(function (m) {
      var o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(lo * m, t);
      o.frequency.linearRampToValueAtTime(hi * m, t + dur * 0.35);
      o.frequency.linearRampToValueAtTime(lo * 0.75 * m, t + dur);
      o.connect(filter);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
    filter.connect(trem);
    trem.connect(amp);
    amp.connect(fxBus);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
    // noise() applies pitchMul itself, so hand it the unscaled values.
    noise(start, dur, vol * 0.45, 'bandpass', 1800, 1100, 1.2);
  }

  function stomp(start) {
    tone(240, 80, start, 0.25, 'triangle', 0.45);
    noise(start, 0.07, 0.35, 'bandpass', 1400, 500, 1.5);
  }

  function bell(start, f, dur) {
    partials(f, [1, 2, 2.76, 4.1], start, dur || 1.4, 0.12);
  }

  function coins(start) {
    [[0, 3200], [0.06, 4100], [0.11, 3600], [0.19, 4700], [0.24, 3900], [0.33, 4400]].forEach(function (c) {
      partials(c[1], [1, 1.5], start + c[0], 0.18, 0.06);
    });
  }

  // A wooden tap.
  function click(start, f) {
    noise(start, 0.03, 0.4, 'bandpass', f, f, 6);
    tone(f / 2, f / 2.6, start, 0.03, 'triangle', 0.1);
  }

  function arp(freqs, gap, dur, wave, vol) {
    freqs.forEach(function (f, i) { tone(f, f, i * gap, dur, wave, vol); });
  }

  // Sounds that are the same in every theme: the turn signals (watch / your
  // turn) and the small interface sounds. The child learns these once.
  var SOUNDS = {
    select: function () { tone(660, 990, 0, 0.09, 'square', 0.07); },
    nudge: function () { tone(520, 620, 0, 0.08, 'sine', 0.12); tone(620, 520, 0.1, 0.08, 'sine', 0.12); },
    // The app starts showing (soft, falling) / hands control to the child (bright, rising).
    watch: function () { tone(660, 660, 0, 0.12, 'sine', 0.1); tone(494, 494, 0.14, 0.2, 'sine', 0.1); },
    'your-turn': function () {
      [523, 659, 784].forEach(function (f, i) { tone(f, f, i * 0.09, 0.14, 'triangle', 0.16); });
    },
    bonk: function () { tone(220, 140, 0, 0.16, 'triangle', 0.22); },
    // A soft tick for a team-bar switch (games, and the "turns" lesson's
    // watch script { turn } step): quiet, no pitch sweep, easy to tell apart
    // from the brighter 'select' tone.
    tick: function () { tone(480, 480, 0, 0.05, 'sine', 0.06); },
    'move-r': function () { tone(300, 900, 0, 0.28, 'sawtooth', 0.05); },
    'move-b': function () { tone(900, 400, 0, 0.3, 'sine', 0.14); },
    'move-q': function () { tone(700, 1400, 0, 0.22, 'triangle', 0.12); tone(1050, 2100, 0.08, 0.2, 'sine', 0.07); },
    'move-k': function () { tone(180, 160, 0, 0.18, 'triangle', 0.2); tone(160, 180, 0.26, 0.18, 'triangle', 0.2); },
    'move-n': function () { tone(250, 700, 0, 0.16, 'square', 0.06); tone(250, 700, 0.38, 0.16, 'square', 0.06); },
    'move-p': function () { tone(440, 440, 0, 0.06, 'square', 0.05); tone(520, 520, 0.24, 0.06, 'square', 0.05); },
    star: function () {
      tone(880, 880, 0, 0.08, 'sine', 0.16);
      tone(1175, 1175, 0.07, 0.08, 'sine', 0.16);
      tone(1568, 1568, 0.14, 0.14, 'sine', 0.16);
    }
  };

  // Per-theme sounds, one entry per theme id in js/themes.js. pieces[type]
  // plays when the child taps that piece type, capture when a pawn is
  // captured, win when a round or game is won.
  var THEME_SOUNDS = {
    robots: {
      pieces: {
        k: function () { tone(300, 1200, 0, 0.5, 'triangle', 0.16); tone(300, 1200, 0, 0.5, 'square', 0.04); },
        q: function () { arp([1047, 1319, 1568, 2093], 0.06, 0.08, 'square', 0.05); },
        r: function () { tone(330, 780, 0, 0.35, 'sawtooth', 0.07, { lp: 4000, vib: [22, 40] }); },
        b: function () { tone(400, 2200, 0, 0.14, 'square', 0.05); },
        n: function () { tone(300, 800, 0, 0.35, 'triangle', 0.18, { vib: [14, 60] }); },
        p: function () { tone(880, 880, 0, 0.08, 'square', 0.06); tone(660, 660, 0.11, 0.1, 'square', 0.06); }
      },
      capture: function () { tone(1200, 300, 0, 0.12, 'square', 0.07); noise(0.1, 0.12, 0.2, 'bandpass', 1500, 600, 1.5); },
      win: function () { arp([523, 659, 784, 1047, 784, 1047], 0.09, 0.1, 'square', 0.06); }
    },
    classic: {
      pieces: {
        k: function () { click(0, 1500); },
        q: function () { click(0, 1700); },
        r: function () { click(0, 1600); },
        b: function () { click(0, 1800); },
        n: function () { click(0, 1900); },
        p: function () { click(0, 2000); }
      },
      capture: function () { click(0, 1800); click(0.09, 1400); },
      win: function () { arp([523, 659, 784, 1047], 0.11, 0.18, 'triangle', 0.16); }
    },
    space: {
      pieces: {
        k: function () { tone(1200, 1200, 0, 0.9, 'sine', 0.14); tone(1200, 1200, 0.35, 0.6, 'sine', 0.05); },
        q: function () {
          [1568, 2093, 2637, 3136].forEach(function (f, i) { tone(f, f, i * 0.05, 0.4, 'sine', 0.06, { vib: [9, 12] }); });
        },
        r: function () { noise(0, 0.6, 0.3, 'bandpass', 600, 4000, 1.5); },
        b: function () { tone(2200, 300, 0, 0.2, 'sawtooth', 0.06); },
        n: function () { tone(200, 1800, 0, 0.25, 'sine', 0.14); tone(1800, 300, 0.28, 0.25, 'sine', 0.1); },
        p: function () { tone(1000, 1000, 0, 0.06, 'sine', 0.16); tone(1500, 1500, 0.08, 0.06, 'sine', 0.12); }
      },
      capture: function () { tone(1600, 200, 0, 0.14, 'square', 0.05); tone(1400, 180, 0.13, 0.14, 'square', 0.05); },
      win: function () { arp([784, 988, 1175, 1568, 1976, 2349], 0.07, 0.3, 'sine', 0.1); }
    },
    dinos: {
      pieces: {
        k: function () { roar(0, 0.9, 170, 280, 0.26); },
        q: function () { roar(0, 0.7, 240, 460, 0.22); },
        r: function () { stomp(0); stomp(0.3); },
        b: function () {
          tone(349, 349, 0, 0.22, 'sawtooth', 0.12, { lp: 2600, vib: [6, 8] });
          tone(294, 294, 0.26, 0.3, 'sawtooth', 0.12, { lp: 2600, vib: [6, 8] });
        },
        n: function () { noise(0, 0.12, 0.25, 'bandpass', 900, 500, 1.5); roar(0.14, 0.35, 230, 330, 0.18); },
        p: function () { tone(1100, 1700, 0, 0.09, 'sine', 0.18); tone(1300, 1900, 0.12, 0.11, 'sine', 0.16); }
      },
      capture: function () {
        noise(0, 0.05, 0.35, 'bandpass', 1800, 1200, 2);
        tone(420, 160, 0, 0.1, 'triangle', 0.25);
        noise(0.13, 0.05, 0.35, 'bandpass', 1800, 1200, 2);
        tone(380, 140, 0.13, 0.12, 'triangle', 0.25);
      },
      win: function () { roar(0, 0.8, 220, 420, 0.24); stomp(0.85); stomp(1.1); }
    },
    pirate: {
      pieces: {
        k: function () { coins(0); },
        q: function () { bell(0, 880); },
        r: function () { noise(0, 0.5, 0.35, 'bandpass', 1600, 250, 1); tone(180, 60, 0, 0.4, 'triangle', 0.35); },
        b: function () {
          tone(1300, 1900, 0, 0.15, 'sawtooth', 0.08, { bp: 2200, vib: [45, 250] });
          tone(1300, 1900, 0.22, 0.15, 'sawtooth', 0.08, { bp: 2200, vib: [45, 250] });
        },
        n: function () {
          tone(1700, 2300, 0, 0.25, 'sine', 0.14, { vib: [10, 25] });
          tone(2300, 1500, 0.25, 0.3, 'sine', 0.14, { vib: [10, 25] });
        },
        p: function () { noise(0, 0.35, 0.22, 'bandpass', 3000, 9000, 4); tone(2600, 3800, 0, 0.3, 'sine', 0.05); }
      },
      capture: function () { partials(620, [1, 1.93, 2.97, 4.3, 5.6], 0, 0.7, 0.1); noise(0, 0.04, 0.3, 'highpass', 3000, 3000, 0.7); },
      // The second bell is 1.0 s (not 1.4 s) so the whole sound ends within 1.5 s.
      win: function () { bell(0, 880); bell(0.45, 880, 1.0); coins(0.9); }
    }
  };

  var DEFAULT_THEME_SOUND = 'robots';

  function has(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  // Unknown ids fall back to the Robots sounds.
  function setTheme(id) {
    themeId = has(THEME_SOUNDS, id) ? id : DEFAULT_THEME_SOUND;
  }

  function getTheme() {
    return themeId;
  }

  // Calm mode on or off: effects (not the voice) about 40% quieter.
  function setCalm(value) {
    calm = !!value;
    if (fxBus) fxBus.gain.value = calm ? CALM_GAIN : 1;
  }

  // Runs one sound with the given level and pitch multipliers, then puts the
  // multipliers back so the next sound is not affected.
  function run(fn, gm, pm) {
    gainMul = gm;
    pitchMul = pm;
    try {
      fn();
    } finally {
      gainMul = 1;
      pitchMul = 1;
    }
  }

  // arg: an optional extra value a sound can use; forTheme: an optional
  // theme id whose sound to play instead of the current theme's (the sticker
  // book plays another theme's piece sound without changing the app's theme;
  // an unknown id means the current theme).
  //   'pick'    arg = piece type (r b q k n p): the theme's tap sound.
  //   'capture' arg = streak: 1 for the first capture in a run, 2 for the
  //             next, and so on (js/games-ui.js resets it on a non-capturing
  //             move or a round/game end); each step raises the pitch by one
  //             semitone, capped at 6 steps, so a run of captures feels
  //             increasingly juicy without going shrill.
  //   'win'     the theme's win sound.
  // Every other name is the same in all themes (SOUNDS).
  function play(name, arg, forTheme) {
    if (!enabled || !ctx) return;
    try {
      var theme = THEME_SOUNDS[has(THEME_SOUNDS, forTheme) ? forTheme : themeId];
      if (name === 'pick') {
        if (has(theme.pieces, arg)) run(theme.pieces[arg], THEME_GAIN, 1);
      } else if (name === 'capture') {
        var steps = Math.min(Math.max((arg || 1) - 1, 0), 6);
        run(theme.capture, THEME_GAIN, Math.pow(2, steps / 12));
      } else if (name === 'win') {
        run(theme.win, THEME_GAIN, 1);
      } else if (has(SOUNDS, name)) {
        run(SOUNDS[name], 1, 1);
      }
    } catch (e) {
      // Sound is optional; never let it break the game.
    }
  }

  // The AudioContext once unlocked, or null before the first tap.
  function context() {
    return ctx;
  }

  // Where other sounds (js/voice.js) should connect to, so voice shares the
  // one unlocked context and its volume moves with the master gain.
  function output() {
    return master || (ctx ? ctx.destination : null);
  }

  var api = {
    unlock: unlock,
    play: play,
    context: context,
    output: output,
    setTheme: setTheme,
    getTheme: getTheme,
    setCalm: setCalm,
    isCalm: function () { return calm; },
    setEnabled: function (value) { enabled = !!value; },
    isEnabled: function () { return enabled; },
    // Exposed for tests.
    SOUNDS: SOUNDS,
    THEME_SOUNDS: THEME_SOUNDS
  };

  if (isNode) {
    module.exports = api;
  } else {
    root.FC = root.FC || {};
    root.FC.sound = api;
  }
})(this);
