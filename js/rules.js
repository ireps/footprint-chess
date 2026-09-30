/*
 * Footprint Chess: movement rules.
 *
 * Board: 8x8 array, board[row][col]. Row 0 is the far edge (opponent side),
 * row 7 is the player's home edge. A square holds null or { type, team }.
 *   type: 'p' pawn, 'r' rook, 'b' bishop, 'q' queen, 'k' king, 'n' knight,
 *         'x' junk (a static obstacle that can be captured but never moves).
 *   team: 'me' moves toward row 0, 'foe' moves toward row 7.
 *
 * Scope (stage 1): piece movement, blocking and captures.
 * Not implemented: check, checkmate, castling, en passant, promotion.
 *
 * Classic script: exposes window.FC.rules in the browser and module.exports in Node.
 * Keep to ES2017 syntax (see README, "Browser support and coding rules").
 */
(function (root) {
  'use strict';

  var SIZE = 8;

  var LINES = {
    r: [[-1, 0], [1, 0], [0, -1], [0, 1]],
    b: [[-1, -1], [-1, 1], [1, -1], [1, 1]]
  };
  LINES.q = LINES.r.concat(LINES.b);

  var STEPS = {
    k: LINES.q,
    n: [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]
  };

  function onBoard(r, c) {
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  }

  function emptyBoard() {
    var board = [];
    for (var r = 0; r < SIZE; r++) {
      var row = [];
      for (var c = 0; c < SIZE; c++) row.push(null);
      board.push(row);
    }
    return board;
  }

  function cloneBoard(board) {
    return board.map(function (row) { return row.slice(); });
  }

  function isLightSquare(r, c) {
    return (r + c) % 2 === 0;
  }

  /* Returns [{ r, c, capture }] for the piece on (r, c). Empty square returns []. */
  function movesFor(board, r, c) {
    var piece = board[r][c];
    var out = [];
    if (!piece) return out;

    function add(tr, tc) {
      var target = board[tr][tc];
      if (!target) {
        out.push({ r: tr, c: tc, capture: false });
        return true;
      }
      if (target.team !== piece.team) out.push({ r: tr, c: tc, capture: true });
      return false;
    }

    if (piece.type === 'p') {
      var dir = piece.team === 'me' ? -1 : 1;
      var startRow = piece.team === 'me' ? 6 : 1;
      var r1 = r + dir;
      if (onBoard(r1, c) && !board[r1][c]) {
        out.push({ r: r1, c: c, capture: false });
        var r2 = r + 2 * dir;
        if (r === startRow && onBoard(r2, c) && !board[r2][c]) {
          out.push({ r: r2, c: c, capture: false });
        }
      }
      [-1, 1].forEach(function (dc) {
        var cc = c + dc;
        if (!onBoard(r1, cc)) return;
        var target = board[r1][cc];
        if (target && target.team !== piece.team) out.push({ r: r1, c: cc, capture: true });
      });
      return out;
    }

    var lines = LINES[piece.type];
    if (lines) {
      lines.forEach(function (d) {
        var tr = r + d[0];
        var tc = c + d[1];
        while (onBoard(tr, tc)) {
          if (!add(tr, tc)) break;
          tr += d[0];
          tc += d[1];
        }
      });
      return out;
    }

    var steps = STEPS[piece.type];
    if (steps) {
      steps.forEach(function (d) {
        var tr = r + d[0];
        var tc = c + d[1];
        if (onBoard(tr, tc)) add(tr, tc);
      });
    }
    return out;
  }

  /*
   * Squares the piece on (r, c) attacks: every square it could capture on
   * if an opponent stood there, including squares its own team stands on
   * (so a piece "protects" its neighbours). Same rays and steps as
   * movesFor; a pawn attacks only its two forward slants. Returns [[r, c]].
   */
  function attacks(board, r, c) {
    var piece = board[r][c];
    var out = [];
    if (!piece) return out;
    if (piece.type === 'p') {
      var r1 = r + (piece.team === 'me' ? -1 : 1);
      [-1, 1].forEach(function (dc) {
        if (onBoard(r1, c + dc)) out.push([r1, c + dc]);
      });
      return out;
    }
    var lines = LINES[piece.type];
    if (lines) {
      lines.forEach(function (d) {
        var tr = r + d[0];
        var tc = c + d[1];
        while (onBoard(tr, tc)) {
          out.push([tr, tc]);
          if (board[tr][tc]) break;
          tr += d[0];
          tc += d[1];
        }
      });
      return out;
    }
    (STEPS[piece.type] || []).forEach(function (d) {
      if (onBoard(r + d[0], c + d[1])) out.push([r + d[0], c + d[1]]);
    });
    return out;
  }

  /* Every square any piece of `team` attacks, as a set of "r,c" keys. */
  function attackedSquares(board, team) {
    var set = {};
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var p = board[r][c];
        if (!p || p.team !== team) continue;
        attacks(board, r, c).forEach(function (sq) { set[sq[0] + ',' + sq[1]] = true; });
      }
    }
    return set;
  }

  /*
   * Squares the piece on (r, c) can reach in any number of moves, with every
   * other piece standing still. Captured pieces are only removed from the
   * square being stood on, so the result is a safe subset of what is reachable.
   * Returns [[r, c], ...] in breadth-first order, excluding the start square.
   */
  function reachable(board, r, c) {
    var piece = board[r][c];
    if (!piece) return [];
    var work = cloneBoard(board);
    work[r][c] = null;
    var seen = {};
    seen[r + ',' + c] = true;
    var queue = [[r, c]];
    var out = [];
    while (queue.length) {
      var cur = queue.shift();
      var original = work[cur[0]][cur[1]];
      work[cur[0]][cur[1]] = piece;
      var moves = movesFor(work, cur[0], cur[1]);
      work[cur[0]][cur[1]] = original;
      for (var i = 0; i < moves.length; i++) {
        var k = moves[i].r + ',' + moves[i].c;
        if (seen[k]) continue;
        seen[k] = true;
        out.push([moves[i].r, moves[i].c]);
        queue.push([moves[i].r, moves[i].c]);
      }
    }
    return out;
  }

  var api = {
    SIZE: SIZE,
    onBoard: onBoard,
    emptyBoard: emptyBoard,
    cloneBoard: cloneBoard,
    isLightSquare: isLightSquare,
    movesFor: movesFor,
    attacks: attacks,
    attackedSquares: attackedSquares,
    reachable: reachable
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.FC = root.FC || {};
    root.FC.rules = api;
  }
})(this);
