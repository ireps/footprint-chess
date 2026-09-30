/*
 * Footprint Chess: the "watch how to play" scenes and the rule tip (stage 6).
 *
 * Short scripted scenes on the board, one per game (HOW_TO, keyed by the
 * game id from js/game-list.js), and the rule tip after a win, which shows
 * one piece's footprints and says its rule. js/games-ui.js owns the flow
 * around them (playTip: the Watch state, Skip, the lead line) and passes a
 * context: ctx.alive() is false once the scene was skipped or ended,
 * ctx.after(ms, fn) paces the scene, ctx.end() finishes it, and
 * ctx.showPond(board) shows the other side's pieces in the pond strip.
 *
 * Depends on FC.rules, FC.games, FC.lessons, FC.voice and FC.board (loaded
 * before this file).
 *
 * Classic script: exposes window.FC.gamesHow. Draws only through FC.board.
 */
(function () {
  'use strict';

  var FC = window.FC;
  var R = FC.rules;
  var G = FC.games;
  var LS = FC.lessons;
  var V = FC.voice;
  var B = FC.board;

  // Colours shared with js/games-ui.js (FC.gamesHow.COLORS).
  var COLORS = {
    // The quiz's footprints are all one colour, so their colour never gives
    // the answer away (every theme but Classic colours footprints per piece).
    quizPrint: '#7a8699',
    // Squares a piece may not step to, and pieces in danger.
    danger: '#e0604d',
    // The other side's footprints (Mirror Pond games).
    foePrint: '#3b4a5a',
    // The other side's last move in the growing battle.
    lastMove: '#8a9bb0',
    // A "safe" ring.
    safe: '#3dc46b'
  };
  var DANGER = COLORS.danger;
  var FOE_PRINT = COLORS.foePrint;
  var SAFE = COLORS.safe;

  // How the child's pieces and the other side's pieces are drawn in the
  // scene playing now ('me' or 'foe'; Classic playing Black swaps them).
  var sides = { me: 'me', foe: 'foe' };

  function key(r, c) { return r + ',' + c; }

  function ruleTipFallback(ctx) { ctx.end(); }

  // Calls fn once both the line and the scene are done.
  function join(count, fn) {
    var left = count;
    return function () {
      left -= 1;
      if (left === 0) fn();
    };
  }

  function tipPiece(type, r, c) {
    var node = B.addPiece(type, r, c, sides.me);
    B.replay(node, 'enter');
    return node;
  }
  function tipFoe(type, r, c) {
    return B.addItem(r, c, type, sides.foe);
  }

  // Shows the footprints of the piece standing on `at` on `board`, with
  // `items` (foe nodes by "r,c") ringed where it could capture.
  function tipPrints(board, at, items) {
    var p = board[at[0]][at[1]];
    B.showFootprints(p.type, at, R.movesFor(board, at[0], at[1]), items || {});
  }

  // Moves a piece on the tip's board and in the picture; a captured foe
  // piece poofs. Calls done when it lands.
  function tipMove(ctx, board, node, from, to, items, done) {
    B.hideFootprints(items || {});
    var type = board[from[0]][from[1]].type;
    B.moveHero(node, type, from, to, function () {
      if (!ctx.alive()) return;
      var k = key(to[0], to[1]);
      if (items && items[k]) {
        B.poof(items[k]);
        delete items[k];
        B.sparkle(to[0], to[1], 0);
      }
      board[to[0]][to[1]] = board[from[0]][from[1]];
      board[from[0]][from[1]] = null;
      done();
    });
  }

  function ruleTip(ctx, type, line) {
    var at = type === 'p' ? [6, 3] : [4, 3];
    var board = R.emptyBoard();
    board[at[0]][at[1]] = { type: type, team: 'me' };
    var node = tipPiece(type, at[0], at[1]);
    node.classList.add('selected');
    tipPrints(board, at, {});
    V.say(line, function () {
      if (!ctx.alive()) return;
      // Then it walks to the footprint nearest the other side.
      var moves = R.movesFor(board, at[0], at[1]).sort(function (a, b) { return a.r - b.r || a.c - b.c; });
      node.classList.remove('selected');
      tipMove(ctx, board, node, at, [moves[0].r, moves[0].c], null, ctx.end);
    });
  }

  // "Watch how to play" scenes, one per game (tip.line is the game's
  // `tip` line in js/game-list.js).
  var HOW_TO = {
    // How to catch a knight that moves differently from your piece: see
    // where it can hop, stand so your footprints cover those squares, and
    // capture it when it lands on one.
    catch: function (ctx) {
      var board = R.emptyBoard();
      board[7][2] = { type: 'r', team: 'me' };
      board[3][4] = { type: 'n', team: 'foe' };
      var items = {};
      var rook = tipPiece('r', 7, 2);
      items['3,4'] = tipFoe('n', 3, 4);
      var hops = R.movesFor(board, 3, 4);
      B.showFootprints('n', [3, 4], hops, {});
      V.say('how-catch-1', function () {
        if (!ctx.alive()) return;
        tipMove(ctx, board, rook, [7, 2], [5, 2], null, function () {
          // The rook's footprints now cover some of the knight's hops: they glow.
          var covered = R.movesFor(board, 5, 2).filter(function (m) {
            return hops.some(function (h) { return h.r === m.r && h.c === m.c; });
          }).map(function (m) { return [m.r, m.c]; });
          tipPrints(board, [5, 2], {});
          B.glow(covered);
          V.say('how-catch-2', function () {
            if (!ctx.alive()) return;
            B.glow([]);
            B.hideFootprints({});
            // The knight hops onto one of them...
            var knight = items['3,4'];
            delete items['3,4'];
            B.moveHero(knight, 'n', [3, 4], [4, 2], function () {
              if (!ctx.alive()) return;
              board[4][2] = board[3][4];
              board[3][4] = null;
              items['4,2'] = knight;
              tipPrints(board, [5, 2], items);
              // ...and the rook captures it.
              V.say('how-catch-3', function () {
                if (!ctx.alive()) return;
                tipMove(ctx, board, rook, [5, 2], [4, 2], items, ctx.end);
              });
            });
          });
        });
      });
    },
    // Pawn battle: a pawn protected by another pawn is captured, and the
    // other pawn captures back.
    army1: function (ctx, line) {
      var board = R.emptyBoard();
      [[5, 3], [6, 4], [6, 1], [6, 6]].forEach(function (sq) { board[sq[0]][sq[1]] = { type: 'p', team: 'me' }; });
      board[4][2] = { type: 'p', team: 'foe' };
      board[1][5] = { type: 'p', team: 'foe' };
      var mine = {};
      [[5, 3], [6, 4], [6, 1], [6, 6]].forEach(function (sq) { mine[key(sq[0], sq[1])] = tipPiece('p', sq[0], sq[1]); });
      var foe = tipFoe('p', 4, 2);
      tipFoe('p', 1, 5);
      var done = join(2, ctx.end);
      V.say(line, function () { if (ctx.alive()) done(); });
      // The pawn behind watches over the one in front.
      B.glow([[5, 3]], SAFE);
      ctx.after(2200, function () {
        B.glow([]);
        B.moveHero(foe, 'p', [4, 2], [5, 3], function () {
          if (!ctx.alive()) return;
          B.poof(mine['5,3']);
          board[5][3] = board[4][2];
          board[4][2] = null;
          var items = { '5,3': foe };
          ctx.after(600, function () {
            var back = mine['6,4'];
            back.classList.add('selected');
            tipPrints(board, [6, 4], items);
            ctx.after(900, function () {
              back.classList.remove('selected');
              tipMove(ctx, board, back, [6, 4], [5, 3], items, done);
            });
          });
        });
      });
    },
    // Pawns and rooks: one pawn is protected (red), the other is not
    // (gold), and the rook captures the free one.
    army2: function (ctx, line) {
      var board = R.emptyBoard();
      board[7][0] = { type: 'r', team: 'me' };
      board[7][7] = { type: 'r', team: 'me' };
      [1, 2, 5, 6].forEach(function (c) { board[6][c] = { type: 'p', team: 'me' }; });
      [[3, 0], [2, 1], [3, 7], [1, 4]].forEach(function (sq) { board[sq[0]][sq[1]] = { type: 'p', team: 'foe' }; });
      var rookA = tipPiece('r', 7, 0);
      var rookB = tipPiece('r', 7, 7);
      [1, 2, 5, 6].forEach(function (c) { tipPiece('p', 6, c); });
      var items = {};
      [[3, 0], [2, 1], [3, 7], [1, 4]].forEach(function (sq) { items[key(sq[0], sq[1])] = tipFoe('p', sq[0], sq[1]); });
      var done = join(2, ctx.end);
      V.say(line, function () { if (ctx.alive()) done(); });
      rookA.classList.add('selected');
      tipPrints(board, [7, 0], items);
      ctx.after(1400, function () {
        // That pawn is protected: the pawn beside it could capture back.
        B.glow([[3, 0], [2, 1]], DANGER);
        ctx.after(1600, function () {
          rookA.classList.remove('selected');
          rookB.classList.add('selected');
          tipPrints(board, [7, 7], items);
          B.glow([[3, 7]]);
          ctx.after(1600, function () {
            B.glow([]);
            rookB.classList.remove('selected');
            tipMove(ctx, board, rookB, [7, 7], [3, 7], items, done);
          });
        });
      });
    },
    // Pawns, rooks and bishops: the bishop starts shut in behind its pawns;
    // a pawn steps out of the way and the bishop comes out.
    army3: function (ctx, line) {
      var board = R.emptyBoard();
      board[7][2] = { type: 'b', team: 'me' };
      board[7][0] = { type: 'r', team: 'me' };
      var pawns = {};
      for (var c = 0; c < 8; c++) {
        board[6][c] = { type: 'p', team: 'me' };
        board[1][c] = { type: 'p', team: 'foe' };
      }
      var bishop = tipPiece('b', 7, 2);
      tipPiece('r', 7, 0);
      for (var c2 = 0; c2 < 8; c2++) {
        pawns[c2] = tipPiece('p', 6, c2);
        tipFoe('p', 1, c2);
      }
      var done = join(2, ctx.end);
      V.say(line, function () { if (ctx.alive()) done(); });
      // Stuck: no footprints at all.
      bishop.classList.add('selected');
      B.replay(bishop, 'wiggle');
      B.glow([[6, 1], [6, 3]], DANGER);
      ctx.after(2000, function () {
        bishop.classList.remove('selected');
        B.glow([]);
        pawns[3].classList.add('selected');
        tipPrints(board, [6, 3], {});
        ctx.after(1000, function () {
          pawns[3].classList.remove('selected');
          tipMove(ctx, board, pawns[3], [6, 3], [4, 3], null, function () {
            bishop.classList.add('selected');
            tipPrints(board, [7, 2], {});
            ctx.after(1200, function () {
              bishop.classList.remove('selected');
              tipMove(ctx, board, bishop, [7, 2], [4, 5], null, done);
            });
          });
        });
      });
    },
    // Knights: the knight hops out over its own pawns, then lands where it
    // attacks two of the other side's pieces at once, and captures one.
    army4: function (ctx, line) {
      var board = R.emptyBoard();
      board[7][1] = { type: 'n', team: 'me' };
      board[2][5] = { type: 'r', team: 'foe' };
      board[1][2] = { type: 'b', team: 'foe' };
      var knight = tipPiece('n', 7, 1);
      for (var c = 0; c < 8; c++) {
        board[6][c] = { type: 'p', team: 'me' };
        tipPiece('p', 6, c);
      }
      var items = { '2,5': tipFoe('r', 2, 5), '1,2': tipFoe('b', 1, 2) };
      [[1, 0], [1, 6], [1, 7]].forEach(function (sq) {
        board[sq[0]][sq[1]] = { type: 'p', team: 'foe' };
        items[key(sq[0], sq[1])] = tipFoe('p', sq[0], sq[1]);
      });
      var done = join(2, ctx.end);
      V.say(line, function () { if (ctx.alive()) done(); });
      knight.classList.add('selected');
      tipPrints(board, [7, 1], items);
      ctx.after(1200, function () {
        knight.classList.remove('selected');
        tipMove(ctx, board, knight, [7, 1], [5, 2], items, function () {
          ctx.after(500, function () {
            tipMove(ctx, board, knight, [5, 2], [3, 3], items, function () {
              // Two pieces in reach at once.
              knight.classList.add('selected');
              tipPrints(board, [3, 3], items);
              B.glow([[2, 5], [1, 2]]);
              ctx.after(1800, function () {
                B.glow([]);
                knight.classList.remove('selected');
                tipMove(ctx, board, knight, [3, 3], [2, 5], items, done);
              });
            });
          });
        });
      });
    },
    // Queens: the queen could capture a pawn that is protected (red: she
    // would be captured back) or a knight nobody protects (gold).
    army5: function (ctx, line) {
      var board = R.emptyBoard();
      board[4][3] = { type: 'q', team: 'me' };
      var queen = tipPiece('q', 4, 3);
      [[6, 1], [6, 5], [7, 4]].forEach(function (sq) {
        var t = sq[0] === 7 ? 'k' : 'p';
        board[sq[0]][sq[1]] = { type: t, team: 'me' };
        tipPiece(t, sq[0], sq[1]);
      });
      var items = {};
      [[2, 3, 'p'], [1, 2, 'p'], [4, 6, 'n'], [1, 6, 'p'], [0, 4, 'k']].forEach(function (x) {
        board[x[0]][x[1]] = { type: x[2], team: 'foe' };
        items[key(x[0], x[1])] = tipFoe(x[2], x[0], x[1]);
      });
      var done = join(2, ctx.end);
      V.say(line, function () { if (ctx.alive()) done(); });
      queen.classList.add('selected');
      tipPrints(board, [4, 3], items);
      ctx.after(1800, function () {
        // That pawn is protected: capturing it loses the queen.
        B.glow([[2, 3], [1, 2]], DANGER);
        ctx.after(1800, function () {
          B.glow([[4, 6]]);
          ctx.after(1200, function () {
            B.glow([]);
            queen.classList.remove('selected');
            tipMove(ctx, board, queen, [4, 3], [4, 6], items, done);
          });
        });
      });
    },
    // The whole army: check and checkmate with many pieces. First the
    // child's king is in check and a pawn blocks the line; then the rook
    // and queen work together to checkmate the other king.
    army6: function (ctx, line) {
      var board = R.emptyBoard();
      var mine = {};
      function put(list, team) {
        list.forEach(function (x) {
          board[x[0]][x[1]] = { type: x[2], team: team };
          var n = team === 'me' ? tipPiece(x[2], x[0], x[1]) : tipFoe(x[2], x[0], x[1]);
          if (team === 'me') mine[key(x[0], x[1])] = n;
        });
      }
      put([[7, 4, 'k'], [7, 3, 'q'], [7, 0, 'r'], [6, 0, 'p'], [6, 1, 'p'], [6, 2, 'p'], [6, 4, 'p'], [6, 5, 'p'], [6, 6, 'p'], [6, 7, 'p']], 'me');
      put([[4, 1, 'b'], [0, 4, 'k'], [0, 7, 'r'], [1, 5, 'p'], [1, 6, 'p'], [2, 3, 'p']], 'foe');
      V.say(line, function () {
        if (!ctx.alive()) return;
        // Check: the bishop's line to the king glows red.
        B.glow([[4, 1], [5, 2], [6, 3], [7, 4]], DANGER);
        V.say('army-how-1', function () {
          if (!ctx.alive()) return;
          tipMove(ctx, board, mine['6,2'], [6, 2], [5, 2], null, function () {
            B.glow([[7, 4]], SAFE);
            V.say('army-how-2', function () {
              if (!ctx.alive()) return;
              ctx.after(400, secondPart);
            });
          });
        });
      });
      // Checkmate: a new position.
      function secondPart() {
        B.glow([]);
        B.clearAll();
        board = R.emptyBoard();
        mine = {};
        put([[7, 5, 'r'], [4, 1, 'q'], [7, 4, 'k'], [6, 0, 'p'], [6, 2, 'p'], [5, 3, 'p'], [6, 6, 'p']], 'me');
        put([[0, 6, 'k'], [1, 6, 'p'], [1, 7, 'p'], [4, 7, 'n'], [3, 4, 'p']], 'foe');
        V.say('army-how-3', function () {
          if (!ctx.alive()) return;
          tipMove(ctx, board, mine['7,5'], [7, 5], [4, 5], null, function () {
            // The rook now watches his escape squares.
            B.glow([[1, 5], [0, 5]], DANGER);
            ctx.after(900, function () {
              tipMove(ctx, board, mine['4,1'], [4, 1], [0, 1], null, function () {
                var cage = [];
                for (var dr = -1; dr <= 1; dr++) {
                  for (var dc = -1; dc <= 1; dc++) {
                    if (R.onBoard(0 + dr, 6 + dc)) cage.push([dr, 6 + dc]);
                  }
                }
                B.glow(cage, DANGER);
                V.say('mate-3', function () { if (ctx.alive()) ctx.end(); });
              });
            });
          });
        });
      }
    },
    // The full game: castling (the king steps two squares and the rook
    // jumps beside him), then a pawn reaching the other side becomes a
    // queen.
    army7: function (ctx, line) {
      var board = R.emptyBoard();
      var mine = {};
      function put(list, team) {
        list.forEach(function (x) {
          board[x[0]][x[1]] = { type: x[2], team: team };
          var n = team === 'me' ? tipPiece(x[2], x[0], x[1]) : tipFoe(x[2], x[0], x[1]);
          if (team === 'me') mine[key(x[0], x[1])] = n;
        });
      }
      put([[7, 4, 'k'], [7, 7, 'r'], [7, 0, 'r'], [7, 2, 'b'], [6, 0, 'p'], [6, 1, 'p'], [6, 5, 'p'], [6, 6, 'p'], [6, 7, 'p'], [5, 5, 'n'], [1, 2, 'p']], 'me');
      put([[0, 4, 'k'], [1, 5, 'p'], [1, 6, 'p'], [2, 0, 'p'], [0, 7, 'r']], 'foe');
      var king = mine['7,4'];
      king.classList.add('selected');
      B.showFootprints('k', [7, 4], R.fullMoves(board, 7, 4, R.newInfo()), {});
      B.glow([[7, 6]]);
      V.say(line, function () {
        if (!ctx.alive()) return;
        B.glow([]);
        king.classList.remove('selected');
        B.hideFootprints({});
        // The king and the rook move together.
        B.moveHero(mine['7,7'], 'r', [7, 7], [7, 5], function () {});
        tipMove(ctx, board, king, [7, 4], [7, 6], null, function () {
          board[7][5] = board[7][7];
          board[7][7] = null;
          V.say('army-castle', function () {
            if (!ctx.alive()) return;
            // A pawn on the other side becomes a queen.
            var pawn = mine['1,2'];
            tipMove(ctx, board, pawn, [1, 2], [0, 2], null, function () {
              var queen = B.addPiece('q', 0, 2, sides.me);
              B.replay(queen, 'enter');
              B.sparkle(0, 2, 0);
              pawn.remove();
              V.say('army-queen', function () { if (ctx.alive()) ctx.end(); });
            });
          });
        });
      });
    },
    // The pawn's first step: two squares.
    race: function (ctx, line) {
      var board = R.emptyBoard();
      board[6][3] = { type: 'p', team: 'me' };
      board[1][5] = { type: 'p', team: 'foe' };
      var pawn = tipPiece('p', 6, 3);
      tipFoe('p', 1, 5);
      var done = join(2, ctx.end);
      V.say(line, function () { if (ctx.alive()) done(); });
      pawn.classList.add('selected');
      tipPrints(board, [6, 3], {});
      ctx.after(1800, function () {
        pawn.classList.remove('selected');
        tipMove(ctx, board, pawn, [6, 3], [4, 3], null, done);
      });
    },
    // Two pieces, each with its own footprints.
    battle: function (ctx, line) {
      var board = R.emptyBoard();
      board[7][1] = { type: 'r', team: 'me' };
      board[7][5] = { type: 'b', team: 'me' };
      board[3][1] = { type: 'p', team: 'foe' };
      board[4][2] = { type: 'p', team: 'foe' };
      var items = {};
      var rook = tipPiece('r', 7, 1);
      var bishop = tipPiece('b', 7, 5);
      items['3,1'] = tipFoe('p', 3, 1);
      items['4,2'] = tipFoe('p', 4, 2);
      var done = join(2, ctx.end);
      V.say(line, function () { if (ctx.alive()) done(); });
      rook.classList.add('selected');
      tipPrints(board, [7, 1], items);
      ctx.after(1600, function () {
        rook.classList.remove('selected');
        bishop.classList.add('selected');
        tipPrints(board, [7, 5], items);
        ctx.after(1600, function () {
          bishop.classList.remove('selected');
          tipMove(ctx, board, bishop, [7, 5], [4, 2], items, done);
        });
      });
    },
    // Capture, then the next pawn is already one move away.
    chain: function (ctx, line) {
      var board = R.emptyBoard();
      board[7][2] = { type: 'r', team: 'me' };
      board[3][2] = { type: 'p', team: 'foe' };
      board[3][6] = { type: 'p', team: 'foe' };
      var items = {};
      var rook = tipPiece('r', 7, 2);
      items['3,2'] = tipFoe('p', 3, 2);
      items['3,6'] = tipFoe('p', 3, 6);
      var done = join(2, ctx.end);
      V.say(line, function () { if (ctx.alive()) done(); });
      tipPrints(board, [7, 2], items);
      ctx.after(1000, function () {
        tipMove(ctx, board, rook, [7, 2], [3, 2], items, function () {
          ctx.after(300, function () {
            tipPrints(board, [3, 2], items);
            ctx.after(1000, function () {
              tipMove(ctx, board, rook, [3, 2], [3, 6], items, done);
            });
          });
        });
      });
    },
    // The knight hops to the footprints nearest the other side, twice.
    hop: function (ctx, line) {
      var board = R.emptyBoard();
      board[7][2] = { type: 'n', team: 'me' };
      var knight = tipPiece('n', 7, 2);
      var done = join(2, ctx.end);
      V.say(line, function () { if (ctx.alive()) done(); });
      function hopFrom(at, to, then) {
        tipPrints(board, at, {});
        var best = R.movesFor(board, at[0], at[1]).filter(function (m) {
          return m.r === at[0] - 2;
        }).map(function (m) { return [m.r, m.c]; });
        B.glow(best);
        ctx.after(1400, function () {
          B.glow([]);
          tipMove(ctx, board, knight, at, to, null, then);
        });
      }
      hopFrom([7, 2], [5, 3], function () {
        ctx.after(300, function () { hopFrom([5, 3], [3, 4], done); });
      });
    },
    // The rook's footprints stop at its own pawn; it goes around.
    way: function (ctx, line) {
      var board = R.emptyBoard();
      board[7][3] = { type: 'r', team: 'me' };
      board[4][3] = { type: 'p', team: 'me' };
      var rook = tipPiece('r', 7, 3);
      tipPiece('p', 4, 3);
      var done = join(2, ctx.end);
      V.say(line, function () { if (ctx.alive()) done(); });
      tipPrints(board, [7, 3], {});
      B.glow([[4, 3]], DANGER);
      ctx.after(1800, function () {
        B.glow([]);
        tipMove(ctx, board, rook, [7, 3], [7, 5], null, function () {
          ctx.after(300, function () {
            tipPrints(board, [7, 5], {});
            ctx.after(1000, function () {
              tipMove(ctx, board, rook, [7, 5], [0, 5], null, done);
            });
          });
        });
      });
    },
    // The rook stands in front of a marching pawn, which cannot go on;
    // then captures it.
    stop: function (ctx, line) {
      var board = R.emptyBoard();
      board[7][4] = { type: 'r', team: 'me' };
      board[2][4] = { type: 'p', team: 'foe' };
      var items = {};
      var rook = tipPiece('r', 7, 4);
      items['2,4'] = tipFoe('p', 2, 4);
      var done = join(2, ctx.end);
      V.say(line, function () { if (ctx.alive()) done(); });
      ctx.after(600, function () {
        tipMove(ctx, board, rook, [7, 4], [3, 4], null, function () {
          B.glow([[2, 4]]);
          ctx.after(1800, function () {
            B.glow([]);
            tipMove(ctx, board, rook, [3, 4], [2, 4], items, done);
          });
        });
      });
    },
    // The king's footprints skip the squares the rook watches, which glow
    // red; he steps the safe way.
    safe: function (ctx, line) {
      var board = R.emptyBoard();
      board[7][4] = { type: 'k', team: 'me' };
      board[2][3] = { type: 'r', team: 'foe' };
      var king = tipPiece('k', 7, 4);
      tipFoe('r', 2, 3);
      var done = join(2, ctx.end);
      V.say(line, function () { if (ctx.alive()) done(); });
      king.classList.add('selected');
      var safeMoves = [[6, 4], [6, 5], [7, 5]].map(function (sq) { return { r: sq[0], c: sq[1], capture: false }; });
      B.showFootprints('k', [7, 4], safeMoves, {});
      B.glow([[6, 3], [7, 3]], DANGER);
      ctx.after(2200, function () {
        B.glow([]);
        king.classList.remove('selected');
        tipMove(ctx, board, king, [7, 4], [6, 5], null, done);
      });
    },
    // Run away: the knight's footprints show; the squares the rook must
    // not step to glow red; the rook steps to a safe one.
    run: function (ctx, line) {
      var board = R.emptyBoard();
      board[7][2] = { type: 'r', team: 'me' };
      board[4][4] = { type: 'n', team: 'foe' };
      var rook = tipPiece('r', 7, 2);
      tipFoe('n', 4, 4);
      var done = join(2, ctx.end);
      V.say(line, function () { if (ctx.alive()) done(); });
      B.showFootprints('n', [4, 4], R.movesFor(board, 4, 4), {});
      ctx.after(1600, function () {
        var probe = { id: 'run', board: board, hero: [7, 2] };
        var safe = G.legalMoves(Object.assign(probe, { over: false, turn: 'me' }), 7, 2);
        rook.classList.add('selected');
        B.showFootprints('r', [7, 2], safe, {});
        B.glow(G.dangerSquares(probe, 7, 2), DANGER);
        ctx.after(1800, function () {
          B.glow([]);
          rook.classList.remove('selected');
          tipMove(ctx, board, rook, [7, 2], [7, 7], null, done);
        });
      });
    },
    // The two hand prints glow in turn, then the rook slides toward the
    // left hand and back toward the right.
    hands: function (ctx, line) {
      var board = R.emptyBoard();
      board[4][4] = { type: 'r', team: 'me' };
      var rook = tipPiece('r', 4, 4);
      B.showHandPrints(true);
      var done = join(2, ctx.end);
      V.say(line, function () { if (ctx.alive()) done(); });
      ctx.after(1400, function () {
        B.flashHandPrint('left');
        ctx.after(1600, function () {
          B.flashHandPrint('right');
          ctx.after(1600, function () {
            B.flashHandPrint('left');
            tipMove(ctx, board, rook, [4, 4], [4, 1], null, function () {
              ctx.after(500, function () {
                B.flashHandPrint('right');
                tipMove(ctx, board, rook, [4, 1], [4, 6], null, done);
              });
            });
          });
        });
      });
    },
    // Their pawn's footprints point toward your side; it marches down.
    theirs: function (ctx, line) {
      var board = R.emptyBoard();
      board[2][3] = { type: 'p', team: 'foe' };
      board[3][4] = { type: 'n', team: 'me' };
      var pawn = tipFoe('p', 2, 3);
      tipPiece('n', 3, 4);
      ctx.showPond(board);
      var done = join(2, ctx.end);
      V.say(line, function () { if (ctx.alive()) done(); });
      B.glow([[2, 3]]);
      ctx.after(800, function () {
        B.showFootprints('p', [2, 3], R.movesFor(board, 2, 3), {}, FOE_PRINT);
        ctx.after(2200, function () {
          B.glow([]);
          B.hideFootprints({});
          B.moveHero(pawn, 'p', [2, 3], [3, 3], function () { if (ctx.alive()) done(); });
        });
      });
    },
    // Their rook's footprints reach one of your pieces: it glows red and
    // moves to safety.
    danger: function (ctx, line) {
      var board = R.emptyBoard();
      board[1][1] = { type: 'r', team: 'foe' };
      board[6][1] = { type: 'r', team: 'me' };
      board[5][5] = { type: 'b', team: 'me' };
      tipFoe('r', 1, 1);
      var rook = tipPiece('r', 6, 1);
      tipPiece('b', 5, 5);
      ctx.showPond(board);
      var done = join(2, ctx.end);
      V.say(line, function () { if (ctx.alive()) done(); });
      ctx.after(800, function () {
        B.showFootprints('r', [1, 1], R.movesFor(board, 1, 1), {}, FOE_PRINT);
        B.glow([[6, 1]], DANGER);
        ctx.after(2000, function () {
          B.glow([]);
          B.hideFootprints({});
          tipMove(ctx, board, rook, [6, 1], [6, 3], null, done);
        });
      });
    },
    // Checkmate: the king is stuck behind his pawns; the rook slides to
    // the far row; his squares glow red.
    mate: function (ctx, line) {
      var list = G.MATE_PUZZLES[0];
      var board = G.puzzleBoard(list, false);
      var nodes = {};
      for (var r = 0; r < 8; r++) {
        for (var c = 0; c < 8; c++) {
          var p = board[r][c];
          if (!p) continue;
          if (p.team === 'me') nodes[key(r, c)] = tipPiece(p.type, r, c);
          else tipFoe(p.type, r, c);
        }
      }
      var done = join(2, ctx.end);
      V.say(line, function () { if (ctx.alive()) done(); });
      B.glow([[1, 5], [1, 6], [1, 7]]);
      ctx.after(1400, function () {
        B.glow([]);
        tipPrints(board, [7, 0], {});
        ctx.after(1000, function () {
          tipMove(ctx, board, nodes['7,0'], [7, 0], [0, 0], null, function () {
            B.glow([[0, 5], [0, 6], [0, 7]], DANGER);
            ctx.after(1500, done);
          });
        });
      });
    },
    // The other side's pieces line up from the smallest prize to the
    // biggest; then a rook passes a guarded pawn and captures a free knight.
    value: function (ctx, line) {
      var row = ['p', 'n', 'b', 'r', 'q'];
      // The capture starts once both the line and the line-up are done.
      var next = join(2, function () {
        B.glow([]);
        B.clearAll();
        var board = R.emptyBoard();
        board[6][3] = { type: 'r', team: 'me' };
        board[3][3] = { type: 'p', team: 'foe' };
        board[2][2] = { type: 'p', team: 'foe' };
        board[6][6] = { type: 'n', team: 'foe' };
        var rook = tipPiece('r', 6, 3);
        var items = {};
        items['3,3'] = tipFoe('p', 3, 3);
        items['2,2'] = tipFoe('p', 2, 2);
        items['6,6'] = tipFoe('n', 6, 6);
        var done = join(2, ctx.end);
        V.say(line, function () { if (ctx.alive()) done(); });
        ctx.after(600, function () {
          tipPrints(board, [6, 3], items);
          ctx.after(1400, function () {
            // The pawn is guarded: its partner could capture the rook there.
            B.glow([[3, 3], [2, 2]], DANGER);
            ctx.after(1600, function () {
              B.glow([[6, 6]]);
              tipMove(ctx, board, rook, [6, 3], [6, 6], items, function () {
                B.glow([]);
                ctx.after(1200, done);
              });
            });
          });
        });
      });
      V.say('how-value-1', function () { if (ctx.alive()) next(); });
      row.forEach(function (type, i) {
        ctx.after(300 + i * 450, function () { tipFoe(type, 3, 1 + i); });
      });
      ctx.after(300 + row.length * 450, function () {
        B.glow([[3, 5]]);
        ctx.after(900, next);
      });
    },
    // The queen steps close to the king: he has no move but is not in
    // check (stalemate). She goes back and gives checkmate instead.
    stale: function (ctx, line) {
      var board = G.puzzleBoard(G.STALE_PUZZLES[0], false);
      var nodes = {};
      for (var r = 0; r < 8; r++) {
        for (var c = 0; c < 8; c++) {
          var p = board[r][c];
          if (!p) continue;
          nodes[key(r, c)] = p.team === 'me' ? tipPiece(p.type, r, c) : tipFoe(p.type, r, c);
        }
      }
      var stale = G.staleMoves(board).filter(function (m) { return board[m.from[0]][m.from[1]].type === 'q'; })[0];
      var mate = G.mateMoves(board)[0];
      var queen = nodes[key(stale.from[0], stale.from[1])];
      var king = R.findKing(board, 'foe');
      V.say(line, function () {
        if (!ctx.alive()) return;
        tipMove(ctx, board, queen, stale.from, stale.to, null, function () {
          B.glow([king], DANGER);
          V.say('stale-oops', function () {
            if (!ctx.alive()) return;
            B.glow([]);
            tipMove(ctx, board, queen, stale.to, stale.from, null, function () {
              ctx.after(500, function () {
                tipMove(ctx, board, queen, mate.from, mate.to, null, function () {
                  var cage = [];
                  for (var dr = -1; dr <= 1; dr++) {
                    for (var dc = -1; dc <= 1; dc++) {
                      if (R.onBoard(king[0] + dr, king[1] + dc)) cage.push([king[0] + dr, king[1] + dc]);
                    }
                  }
                  B.glow(cage, DANGER);
                  V.say('mate-3', function () { if (ctx.alive()) ctx.after(600, ctx.end); });
                });
              });
            });
          });
        });
      });
    },
    // From the start of a game: a middle pawn two squares, a knight and a
    // bishop out, then the king castles with the rook.
    opening: function (ctx, line) {
      var board = R.emptyBoard();
      var nodes = {};
      var back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
      for (var c = 0; c < 8; c++) {
        board[6][c] = { type: 'p', team: 'me' };
        board[7][c] = { type: back[c], team: 'me' };
        board[1][c] = { type: 'p', team: 'foe' };
        board[0][c] = { type: back[c], team: 'foe' };
        nodes['6,' + c] = tipPiece('p', 6, c);
        nodes['7,' + c] = tipPiece(back[c], 7, c);
        tipFoe('p', 1, c);
        tipFoe(back[c], 0, c);
      }
      var steps = [
        [[6, 4], [4, 4]],
        [[7, 6], [5, 5]],
        [[7, 5], [4, 2]],
        [[7, 4], [7, 6]]
      ];
      var done = join(2, ctx.end);
      V.say(line, function () { if (ctx.alive()) done(); });
      function play(i) {
        if (i === steps.length) {
          ctx.after(900, done);
          return;
        }
        var from = steps[i][0];
        var to = steps[i][1];
        var node = nodes[key(from[0], from[1])];
        delete nodes[key(from[0], from[1])];
        nodes[key(to[0], to[1])] = node;
        B.glow([from]);
        ctx.after(500, function () {
          B.glow([]);
          tipMove(ctx, board, node, from, to, null, function () {
            if (i === steps.length - 1) {
              // Castling: the rook comes round beside the king.
              var rook = nodes['7,7'];
              tipMove(ctx, board, rook, [7, 7], [7, 5], null, function () { ctx.after(600, function () { play(i + 1); }); });
            } else {
              ctx.after(600, function () { play(i + 1); });
            }
          });
        });
      }
      ctx.after(700, function () { play(0); });
    },
    // Checkmate in two with two rooks: one rook checks, the king has to
    // step to the far row, and the other rook gives checkmate there.
    mate2: function (ctx, line) {
      var board = G.puzzleBoard(G.MATE2_PUZZLES[0], false);
      var nodes = {};
      for (var r = 0; r < 8; r++) {
        for (var c = 0; c < 8; c++) {
          var p = board[r][c];
          if (!p) continue;
          nodes[key(r, c)] = p.team === 'me' ? tipPiece(p.type, r, c) : tipFoe(p.type, r, c);
        }
      }
      var done = join(2, ctx.end);
      V.say(line, function () { if (ctx.alive()) done(); });
      ctx.after(800, function () {
        tipPrints(board, [7, 7], {});
        ctx.after(1000, function () {
          // Check: the king's row glows red, so he must step away.
          tipMove(ctx, board, nodes['7,7'], [7, 7], [1, 7], null, function () {
            B.glow([[1, 3]], DANGER);
            ctx.after(1200, function () {
              B.glow([]);
              tipMove(ctx, board, nodes['1,3'], [1, 3], [0, 3], null, function () {
                ctx.after(700, function () {
                  tipPrints(board, [2, 0], {});
                  ctx.after(900, function () {
                    tipMove(ctx, board, nodes['2,0'], [2, 0], [0, 0], null, function () {
                      B.glow([[0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4]], DANGER);
                      ctx.after(1500, done);
                    });
                  });
                });
              });
            });
          });
        });
      });
    },
    // Three ways out of check, one after another, in time with the line:
    // step away, block the line, capture the attacker.
    escape: function (ctx, line) {
      var step = Math.max(1800, Math.round(LS.LINES[line].ms / 3));
      var done = join(2, ctx.end);
      V.say(line, function () { if (ctx.alive()) done(); });
      var scenes = [
        { list: G.ESCAPE_PUZZLES.step[0], from: [7, 4], to: [7, 5] },
        { list: G.ESCAPE_PUZZLES.block[0], from: [3, 2], to: [7, 2] },
        { list: G.ESCAPE_PUZZLES.capture[0], from: [2, 1], to: [7, 1] }
      ];
      function play(i) {
        if (i >= scenes.length) { done(); return; }
        var sc = scenes[i];
        B.clearAll();
        var board = G.puzzleBoard(sc.list, false);
        var nodes = {};
        var items = {};
        for (var r = 0; r < 8; r++) {
          for (var c = 0; c < 8; c++) {
            var p = board[r][c];
            if (!p) continue;
            if (p.team === 'me') nodes[key(r, c)] = tipPiece(p.type, r, c);
            else items[key(r, c)] = tipFoe(p.type, r, c);
          }
        }
        var king = R.findKing(board, 'me');
        B.glow(Object.keys(items).map(function (k) { return k.split(',').map(Number); }).filter(function (sq) {
          return R.attacks(board, sq[0], sq[1]).some(function (a) { return a[0] === king[0] && a[1] === king[1]; });
        }), DANGER);
        ctx.after(600, function () {
          B.glow([]);
          tipMove(ctx, board, nodes[key(sc.from[0], sc.from[1])], sc.from, sc.to, items, function () {
            ctx.after(Math.max(300, step - 1400), function () { play(i + 1); });
          });
        });
      }
      play(0);
    },
    // Rook, bishop, queen in turn on the same square, each with its own
    // footprints, in time with the line.
    whose: function (ctx, line) {
      var at = [3, 3];
      var step = Math.max(1500, Math.round(LS.LINES[line].ms / 3));
      var done = join(2, ctx.end);
      V.say(line, function () { if (ctx.alive()) done(); });
      var types = ['r', 'b', 'q'];
      function show(i) {
        if (i >= types.length) { done(); return; }
        B.clearAll();
        var board = R.emptyBoard();
        board[at[0]][at[1]] = { type: types[i], team: 'me' };
        tipPiece(types[i], at[0], at[1]);
        tipPrints(board, at, {});
        ctx.after(step, function () { show(i + 1); });
      }
      show(0);
    }
  };

  /*
   * Plays tip ({ kind: 'rule', type, line } or a "watch how to play" tip
   * with its line) for gameId. pieceSides: { me, foe }, how each side's
   * pieces are drawn.
   */
  function play(ctx, tip, gameId, pieceSides) {
    sides = pieceSides || { me: 'me', foe: 'foe' };
    if (tip.kind === 'rule') ruleTip(ctx, tip.type, tip.line);
    else (HOW_TO[gameId] || ruleTipFallback)(ctx, tip.line);
  }

  FC.gamesHow = {
    COLORS: COLORS,
    play: play,
    has: function (id) { return Object.prototype.hasOwnProperty.call(HOW_TO, id); }
  };
})();
