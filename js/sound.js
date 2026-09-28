/*
 * Footprint Chess: sound effects generated with the Web Audio API.
 * No audio files. Browsers block audio until the first user gesture,
 * so call FC.sound.unlock() from a tap handler before playing.
 */
(function (root) {
  'use strict';

  var ctx = null;
  var master = null;
  var enabled = true;

  function unlock() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.5;
        master.connect(ctx.destination);
      } catch (e) {
        ctx = null;
        return;
      }
    }
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
  }

  function tone(f0, f1, start, dur, wave, vol) {
    var t = ctx.currentTime + start;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  var SOUNDS = {
    select: function () { tone(660, 990, 0, 0.09, 'square', 0.07); },
    nudge: function () { tone(520, 620, 0, 0.08, 'sine', 0.12); tone(620, 520, 0.1, 0.08, 'sine', 0.12); },
    bonk: function () { tone(220, 140, 0, 0.16, 'triangle', 0.22); },
    'move-r': function () { tone(300, 900, 0, 0.28, 'sawtooth', 0.05); },
    'move-b': function () { tone(900, 400, 0, 0.3, 'sine', 0.14); },
    'move-q': function () { tone(700, 1400, 0, 0.22, 'triangle', 0.12); tone(1050, 2100, 0.08, 0.2, 'sine', 0.07); },
    'move-k': function () { tone(180, 160, 0, 0.18, 'triangle', 0.2); tone(160, 180, 0.26, 0.18, 'triangle', 0.2); },
    'move-n': function () { tone(250, 700, 0, 0.16, 'square', 0.06); tone(250, 700, 0.38, 0.16, 'square', 0.06); },
    'move-p': function () { tone(440, 440, 0, 0.06, 'square', 0.05); tone(520, 520, 0.24, 0.06, 'square', 0.05); },
    capture: function () { tone(900, 120, 0, 0.22, 'sawtooth', 0.07); },
    star: function () {
      tone(880, 880, 0, 0.08, 'sine', 0.16);
      tone(1175, 1175, 0.07, 0.08, 'sine', 0.16);
      tone(1568, 1568, 0.14, 0.14, 'sine', 0.16);
    },
    win: function () {
      [523, 659, 784, 1047].forEach(function (f, i) { tone(f, f, i * 0.11, 0.18, 'triangle', 0.16); });
    }
  };

  function play(name) {
    if (!enabled || !ctx || !SOUNDS[name]) return;
    try {
      SOUNDS[name]();
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

  root.FC = root.FC || {};
  root.FC.sound = {
    unlock: unlock,
    play: play,
    context: context,
    output: output,
    setEnabled: function (value) { enabled = !!value; },
    isEnabled: function () { return enabled; }
  };
})(this);
