/*
 * Footprint Chess: capture rounds.
 *
 * A round is { board, hero: [r, c], targets: [[r, c], ...] }. Every target
 * is a real opponent pawn ({ type: 'p', team: 'foe' }) standing on rows
 * 1..6 (real pawns never stand on either back row). The round's goal is to
 * capture every target; TARGET_COUNT of them are placed per round.
 *
 * Classic script: exposes window.FC.levels in the browser and
 * module.exports in Node.
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var R = isNode ? require('./rules.js') : root.FC.rules;

  var TARGET_COUNT = 3;
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

  function inTargetRows(sq) {
    return sq[0] >= 1 && sq[0] <= 6;
  }

  /*
   * Builds a chain of diagonal-forward capture squares starting from the
   * hero pawn: each target is one row closer to the far edge than the one
   * before it (or than the hero, for the first target), and one column to
   * either side. A pawn only ever captures diagonally forward, so every
   * target in the chain can be captured in turn, in order, without any
   * other kind of move. The hero starts on row 6, so with TARGET_COUNT
   * targets the chain never needs a row before row 6 - TARGET_COUNT.
   */
  function tryPawnChain(hero, rng) {
    var board = R.emptyBoard();
    board[hero[0]][hero[1]] = { type: 'p', team: 'me' };
    var targets = [];
    var row = hero[0];
    var col = hero[1];
    for (var i = 0; i < TARGET_COUNT; i++) {
      row -= 1;
      if (row < 0) return null;
      var options = [];
      if (col - 1 >= 0) options.push(col - 1);
      if (col + 1 <= 7) options.push(col + 1);
      if (!options.length) return null;
      col = options[randInt(rng, options.length)];
      var sq = [row, col];
      board[row][col] = { type: 'p', team: 'foe' };
      targets.push(sq);
    }
    return { board: board, hero: hero, targets: targets };
  }

  /*
   * Places TARGET_COUNT foe pawns one at a time, each on a square the hero
   * can currently reach (FC.rules.reachable). After each placement every
   * earlier target is re-checked: adding a new pawn can block the path to
   * one placed before it, since it now stands in the way. A placement that
   * strands an earlier target is undone and another candidate square is
   * tried. Bishops only ever reach squares of their own colour, so their
   * targets land on that colour automatically.
   */
  function tryGenericRound(type, hero, rng) {
    var board = R.emptyBoard();
    board[hero[0]][hero[1]] = { type: type, team: 'me' };
    var targets = [];

    for (var i = 0; i < TARGET_COUNT; i++) {
      var reach = R.reachable(board, hero[0], hero[1]);
      var candidates = shuffle(rng, reach.filter(function (sq) {
        return inTargetRows(sq) && !board[sq[0]][sq[1]];
      }));

      var placed = false;
      for (var ci = 0; ci < candidates.length; ci++) {
        var cand = candidates[ci];
        board[cand[0]][cand[1]] = { type: 'p', team: 'foe' };

        var reach2 = R.reachable(board, hero[0], hero[1]);
        var reach2Keys = {};
        reach2.forEach(function (sq) { reach2Keys[key(sq)] = true; });

        var ok = !!reach2Keys[key(cand)];
        for (var ti = 0; ok && ti < targets.length; ti++) {
          if (!reach2Keys[key(targets[ti])]) ok = false;
        }

        if (ok) {
          targets.push(cand);
          placed = true;
          break;
        }
        board[cand[0]][cand[1]] = null;
      }
      if (!placed) return null;
    }
    return { board: board, hero: hero, targets: targets };
  }

  function createCaptureRound(type, rng) {
    rng = rng || Math.random;
    for (var attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      var hero = type === 'p' ? [6, randInt(rng, 8)] : [7, randInt(rng, 8)];
      var round = type === 'p' ? tryPawnChain(hero, rng) : tryGenericRound(type, hero, rng);
      if (round) return round;
    }
    throw new Error('Could not build a round for piece type ' + type);
  }

  /*
   * Diagonal-forward neighbours of sq for a pawn moving in direction dir
   * (-1 toward row 0, 1 toward row 7), clipped to the board. Used to find
   * squares that would be capturable if a foe pawn stood there, since a
   * pawn (unlike every other piece) can only ever land on an occupied
   * square by capturing it diagonally.
   */
  function pawnDiagonalNeighbours(sq, dir) {
    var out = [];
    [-1, 1].forEach(function (dc) {
      var tr = sq[0] + dir;
      var tc = sq[1] + dc;
      if (R.onBoard(tr, tc)) out.push([tr, tc]);
    });
    return out;
  }

  /*
   * Empty squares where a foe pawn, if placed there, could eventually be
   * captured by the hero: the diagonal-forward neighbours of every square
   * already reachable by the hero (including the hero's own square).
   */
  function pawnCapturableEmptySquares(board, hero, reach) {
    var piece = board[hero[0]][hero[1]];
    var dir = piece.team === 'me' ? -1 : 1;
    var seen = {};
    var out = [];
    reach.concat([hero]).forEach(function (sq) {
      pawnDiagonalNeighbours(sq, dir).forEach(function (n) {
        var k = key(n);
        if (seen[k]) return;
        seen[k] = true;
        out.push(n);
      });
    });
    return out;
  }

  /*
   * After a move some targets may no longer be reachable (for example a
   * pawn that captured past one on the diagonal it needed). Move each of
   * those to a reachable, capturable square on rows 1..6.
   * Mutates round.board and round.targets. Returns
   * [{ from: [r, c], to: [r, c] | null }]; to is null when there is no
   * such square, and that target is removed (it counts as captured, so
   * the round can still end).
   */
  function relocateStranded(round, rng) {
    rng = rng || Math.random;
    var heroPiece = round.board[round.hero[0]][round.hero[1]];
    var isPawn = heroPiece && heroPiece.type === 'p';

    var reach = R.reachable(round.board, round.hero[0], round.hero[1]);
    var reachKeys = {};
    reach.forEach(function (sq) { reachKeys[key(sq)] = true; });

    var targetKeys = {};
    round.targets.forEach(function (sq) { targetKeys[key(sq)] = true; });

    var candidates = isPawn ? pawnCapturableEmptySquares(round.board, round.hero, reach) : reach;
    var free = shuffle(rng, candidates.filter(function (sq) {
      return inTargetRows(sq) && !round.board[sq[0]][sq[1]] && !targetKeys[key(sq)];
    }));

    var kept = [];
    var changes = [];
    round.targets.forEach(function (target) {
      if (reachKeys[key(target)]) {
        kept.push(target);
        return;
      }
      round.board[target[0]][target[1]] = null;
      var to = free.length ? free.shift() : null;
      changes.push({ from: target, to: to });
      if (to) {
        round.board[to[0]][to[1]] = { type: 'p', team: 'foe' };
        kept.push(to);
      }
    });
    round.targets = kept;
    return changes;
  }

  var api = {
    TARGET_COUNT: TARGET_COUNT,
    createCaptureRound: createCaptureRound,
    relocateStranded: relocateStranded
  };

  if (isNode) {
    module.exports = api;
  } else {
    root.FC = root.FC || {};
    root.FC.levels = api;
  }
})(this);
