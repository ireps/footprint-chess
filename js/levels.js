/*
 * Footprint Chess: star-collecting rounds.
 *
 * A round is { board, hero: [r, c], stars: [[r, c], ...] }.
 * Every star is placed on an empty square the hero can reach.
 * Classic script: exposes window.FC.levels in the browser and module.exports in Node.
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var R = isNode ? require('./rules.js') : root.FC.rules;

  var STAR_COUNT = 3;
  var MAX_ATTEMPTS = 50;

  function randInt(rng, n) {
    return Math.floor(rng() * n);
  }

  function shuffle(rng, list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = randInt(rng, i + 1);
      var tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  function key(sq) {
    return sq[0] + ',' + sq[1];
  }

  function tryRound(type, rng) {
    var board = R.emptyBoard();
    var hero = type === 'p' ? [6, randInt(rng, 8)] : [7, randInt(rng, 8)];
    board[hero[0]][hero[1]] = { type: type, team: 'me' };

    if (type === 'p') {
      // Pawns only move forward: stars go straight ahead on squares a pawn can land on.
      return { board: board, hero: hero, stars: [[4, hero[1]], [2, hero[1]], [0, hero[1]]] };
    }

    // One or two junk bots, never on the home row.
    var empties = [];
    for (var r = 0; r < 7; r++) {
      for (var c = 0; c < 8; c++) {
        if (!board[r][c]) empties.push([r, c]);
      }
    }
    shuffle(rng, empties);
    var foeCount = 1 + randInt(rng, 2);
    for (var i = 0; i < foeCount; i++) {
      board[empties[i][0]][empties[i][1]] = { type: 'x', team: 'foe' };
    }

    var free = R.reachable(board, hero[0], hero[1]).filter(function (sq) {
      return !board[sq[0]][sq[1]];
    });
    if (free.length < STAR_COUNT) return null;
    shuffle(rng, free);
    return { board: board, hero: hero, stars: free.slice(0, STAR_COUNT) };
  }

  function createStarRound(type, rng) {
    rng = rng || Math.random;
    for (var attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      var round = tryRound(type, rng);
      if (round) return round;
    }
    throw new Error('Could not build a round for piece type ' + type);
  }

  /*
   * After a move some stars may no longer be reachable (for example a pawn that
   * stepped past one). Move each of those to a reachable empty square.
   * Mutates round.stars. Returns [{ from: [r, c], to: [r, c] | null }].
   * to is null when there is no reachable free square; that star is removed.
   */
  function relocateStranded(round, rng) {
    rng = rng || Math.random;
    var reach = R.reachable(round.board, round.hero[0], round.hero[1]);
    var reachKeys = {};
    reach.forEach(function (sq) { reachKeys[key(sq)] = true; });
    var starKeys = {};
    round.stars.forEach(function (sq) { starKeys[key(sq)] = true; });

    var free = shuffle(rng, reach.filter(function (sq) {
      return !round.board[sq[0]][sq[1]] && !starKeys[key(sq)];
    }));

    var kept = [];
    var changes = [];
    round.stars.forEach(function (star) {
      if (reachKeys[key(star)]) {
        kept.push(star);
        return;
      }
      var to = free.length ? free.shift() : null;
      changes.push({ from: star, to: to });
      if (to) kept.push(to);
    });
    round.stars = kept;
    return changes;
  }

  var api = {
    STAR_COUNT: STAR_COUNT,
    createStarRound: createStarRound,
    relocateStranded: relocateStranded
  };

  if (isNode) {
    module.exports = api;
  } else {
    root.FC = root.FC || {};
    root.FC.levels = api;
  }
})(this);
