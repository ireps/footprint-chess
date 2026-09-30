/*
 * Footprint Chess: game speed check (for check.html).
 *
 * No DOM. Times the heaviest work the app does while a child plays: the
 * growing battle's opponent move and idle hint (js/army.js) in the two
 * battles with kings, where every move is checked against the check rules.
 * A run plays a fixed game (seeded, so every device plays the same moves):
 * the child side follows the hints, and each hint and each opponent move
 * is timed. The page calls step() once per move, with a pause between, so
 * a slow tablet stays responsive while it runs.
 *
 * Classic script: exposes window.FC.speed in the browser and module.exports
 * in Node. Keep to ES2017 syntax.
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;

  // The battles timed, and the child's moves played in each.
  var LEVELS = ['army6', 'army7'];
  var MOVES = 10;

  // Longest time (ms) that still feels quick: the opponent's move is hidden
  // behind its "thinking" pause (at least 600 ms), and a hint only shows
  // after 5 seconds of waiting.
  var LIMITS = { bot: 600, hint: 1000 };

  // A small seeded random source, so every device plays the same game.
  function seeded(seed) {
    var t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      var x = Math.imul(t ^ (t >>> 15), 1 | t);
      x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  /*
   * A run over LEVELS. army: FC.army; now: a clock in ms. step() plays one
   * child move and the reply, and returns false once the run is over; then
   * result() gives { hint: [ms...], bot: [ms...] }.
   */
  function createRun(army, now, options) {
    var levels = (options && options.levels) || LEVELS;
    var moves = (options && options.moves) || MOVES;
    var li = 0;
    var played = 0;
    var rng = seeded(1);
    var state = army.create(levels[0], {}, rng);
    var times = { hint: [], bot: [] };

    function nextLevel() {
      li++;
      played = 0;
      if (li < levels.length) {
        rng = seeded(1);
        state = army.create(levels[li], {}, rng);
      }
    }

    function step() {
      if (li >= levels.length) return false;
      if (state.over || played >= moves) {
        nextLevel();
        return li < levels.length;
      }
      var t0 = now();
      var piece = army.hint(state, null);
      var to = piece ? army.hint(state, piece) : null;
      times.hint.push(now() - t0);
      if (!piece || !to) {
        nextLevel();
        return li < levels.length;
      }
      army.applyMove(state, piece, to);
      played++;
      if (!state.over) {
        var t1 = now();
        army.botMove(state, rng);
        times.bot.push(now() - t1);
      }
      return true;
    }

    return {
      step: step,
      result: function () { return { hint: times.hint.slice(), bot: times.bot.slice() }; }
    };
  }

  /* { median, max } of a list of times, rounded to whole ms. */
  function summary(list) {
    if (!list.length) return { median: 0, max: 0 };
    var sorted = list.slice().sort(function (a, b) { return a - b; });
    return { median: Math.round(sorted[Math.floor(sorted.length / 2)]), max: Math.round(sorted[sorted.length - 1]) };
  }

  var api = {
    LEVELS: LEVELS,
    MOVES: MOVES,
    LIMITS: LIMITS,
    createRun: createRun,
    summary: summary
  };

  if (isNode) {
    module.exports = api;
  } else {
    root.FC = root.FC || {};
    root.FC.speed = api;
  }
})(this);
