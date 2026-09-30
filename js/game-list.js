/*
 * Footprint Chess: the list of games (stage 6).
 *
 * One registry for every game the Games screen shows: its row, its lines
 * (mission, win and tip) and whether it is played in teams. No DOM; the
 * pictures are drawn by js/game-pics.js, the rules live in
 * js/games.js (board games) and js/quiz.js (the footprints quiz). Adding a
 * game is an entry here, its rules and tests, its picture and its lines in
 * js/lessons.js and docs/VOICE-SCRIPT.md.
 *
 * The Games screen has one row per kind of game, each marked with a
 * picture rather than a word: capture games, "reach the other side"
 * games, thinking games, the other side's view (the pond), the king's
 * games, and the growing battle (stage 8, 'army': a ladder of whole-army
 * battles, a few more kinds of piece at each step, drawn as a ladder of
 * its own beside the rows).
 * The order here is also the order of the Won card's "next game" button.
 *
 * Each game has a "watch how to play" scene (js/games-how.js), played
 * before the first game each child plays of it and from the light bulb on
 * its Mission and Won cards; `tip` is its line. After a win, pickTip
 * chooses a rule tip: a child who kept tapping squares a piece cannot reach
 * sees that piece's rule again.
 *
 * Classic script: exposes window.FC.gameList in the browser and
 * module.exports in Node. Keep to ES2017 syntax.
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;

  var ROWS = ['capture', 'reach', 'think', 'pond', 'king', 'army'];

  /*
   * id:      the game id (js/games.js or js/quiz.js; stored in a child's wins)
   * row:     one of ROWS
   * mission: the line said on the Mission card (its text up to the first
   *          "!" or "?" is the card's caption on the Games screen)
   * win:     the line said when the game is won
   * tip:     the line of its "watch how to play" scene
   * teams:   true when the child plays against the other side, taking
   *          turns (the Team card shows first); false for a solo game
   * kind:    'board' (js/games.js), 'quiz' (js/quiz.js), 'pond'
   *          (js/pond.js, the other side's view) or 'hands' (js/hands.js,
   *          left and right)
   * lesson:  (optional) a lesson (js/lessons.js) played before the child's
   *          first game of it, like the "Taking turns" lesson before team
   *          games
   */
  var GAMES = [
    { id: 'catch', row: 'capture', mission: 'game-catch', win: 'caught', tip: 'how-catch-2', teams: true, kind: 'board' },
    { id: 'battle', row: 'capture', mission: 'game-battle', win: 'won', tip: 'tip-battle', teams: true, kind: 'board' },
    { id: 'chain', row: 'capture', mission: 'game-chain', win: 'won', tip: 'tip-chain', teams: false, kind: 'board' },
    { id: 'race', row: 'reach', mission: 'game-race', win: 'race-won', tip: 'tip-race', teams: true, kind: 'board' },
    { id: 'hop', row: 'reach', mission: 'game-hop', win: 'reach-won', tip: 'tip-hop', teams: false, kind: 'board' },
    { id: 'way', row: 'reach', mission: 'game-way', win: 'reach-won', tip: 'tip-way', teams: false, kind: 'board' },
    { id: 'whose', row: 'think', mission: 'game-whose', win: 'quiz-won', tip: 'tip-whose', teams: false, kind: 'quiz' },
    { id: 'theirs', row: 'pond', mission: 'game-theirs', win: 'theirs-won', tip: 'tip-theirs', teams: false, kind: 'pond', lesson: 'theirside' },
    { id: 'danger', row: 'pond', mission: 'game-danger', win: 'danger-won', tip: 'tip-danger', teams: false, kind: 'pond', lesson: 'theirside' },
    { id: 'run', row: 'pond', mission: 'game-run', win: 'run-won', tip: 'tip-run', teams: true, kind: 'board' },
    { id: 'hands', row: 'think', mission: 'game-hands', win: 'hands-won', tip: 'tip-hands', teams: false, kind: 'hands', lesson: 'yourhands' },
    { id: 'stop', row: 'think', mission: 'game-stop', win: 'won', tip: 'tip-stop', teams: true, kind: 'board' },
    { id: 'safe', row: 'king', mission: 'game-safe', win: 'reach-won', tip: 'tip-safe', teams: false, kind: 'board' },
    { id: 'escape', row: 'king', mission: 'game-escape', win: 'escape-won', tip: 'tip-escape', teams: false, kind: 'board', lesson: 'check' },
    { id: 'mate', row: 'king', mission: 'game-mate', win: 'mate-won', tip: 'tip-mate', teams: false, kind: 'board', lesson: 'checkmate' },
    { id: 'mate2', row: 'king', mission: 'game-mate2', win: 'mate2-won', tip: 'tip-mate2', teams: false, kind: 'board', lesson: 'checkmate' },
    { id: 'army1', row: 'army', mission: 'game-army1', win: 'army-won', tip: 'tip-army1', teams: true, kind: 'board' },
    { id: 'army2', row: 'army', mission: 'game-army2', win: 'army-won', tip: 'tip-army2', teams: true, kind: 'board' },
    { id: 'army3', row: 'army', mission: 'game-army3', win: 'army-won', tip: 'tip-army3', teams: true, kind: 'board' },
    { id: 'army4', row: 'army', mission: 'game-army4', win: 'army-won', tip: 'tip-army4', teams: true, kind: 'board' },
    { id: 'army5', row: 'army', mission: 'game-army5', win: 'army-won', tip: 'tip-army5', teams: true, kind: 'board' },
    { id: 'army6', row: 'army', mission: 'game-army6', win: 'army-mate-won', tip: 'tip-army6', teams: true, kind: 'board' },
    { id: 'army7', row: 'army', mission: 'game-army7', win: 'army-mate-won', tip: 'tip-army7', teams: true, kind: 'board' }
  ];

  // Winning this many different games in a theme, for the first time,
  // earns that theme's golden king.
  var GOLDEN_KING_GAMES = 3;

  // Wrong taps with one piece type in one game before its rule is shown
  // again after the game.
  var STRUGGLE_TAPS = 2;

  // The line that states each piece's rule (its lesson's first rule line).
  var RULE_LINES = { r: 'rook-1', b: 'bishop-1', q: 'queen-1', k: 'king-1', n: 'knight-2', p: 'pawn-1' };

  function ids() {
    return GAMES.map(function (g) { return g.id; });
  }

  function get(id) {
    for (var i = 0; i < GAMES.length; i++) {
      if (GAMES[i].id === id) return GAMES[i];
    }
    return null;
  }

  function inRow(row) {
    return GAMES.filter(function (g) { return g.row === row; });
  }

  /* The game after `id`, in list order, wrapping round. */
  function next(id) {
    var list = ids();
    var i = list.indexOf(id);
    return list[(i + 1) % list.length];
  }

  /*
   * The tip to show after winning game `id`: { kind: 'rule', type, line }
   * when the child made STRUGGLE_TAPS or more wrong taps with one piece
   * type (the type with the most; ties go to the earlier type in 'rbqknp'
   * order), else null. wrong maps a piece type to its wrong-tap count for
   * this game.
   */
  function pickTip(id, wrong) {
    var game = get(id);
    if (!game) return null;
    var best = null;
    var bestCount = 0;
    Object.keys(RULE_LINES).forEach(function (t) {
      var n = (wrong && typeof wrong[t] === 'number') ? wrong[t] : 0;
      if (n >= STRUGGLE_TAPS && n > bestCount) {
        best = t;
        bestCount = n;
      }
    });
    return best ? { kind: 'rule', type: best, line: RULE_LINES[best] } : null;
  }

  /* Every line id the registry names (tests check each exists). */
  function lineIds() {
    var out = [];
    GAMES.forEach(function (g) { out.push(g.mission, g.win, g.tip); });
    Object.keys(RULE_LINES).forEach(function (t) { out.push(RULE_LINES[t]); });
    return out.filter(function (id, i) { return out.indexOf(id) === i; });
  }

  var api = {
    ROWS: ROWS,
    GAMES: GAMES,
    GOLDEN_KING_GAMES: GOLDEN_KING_GAMES,
    STRUGGLE_TAPS: STRUGGLE_TAPS,
    RULE_LINES: RULE_LINES,
    ids: ids,
    get: get,
    inRow: inRow,
    next: next,
    pickTip: pickTip,
    lineIds: lineIds
  };

  if (isNode) {
    module.exports = api;
  } else {
    root.FC = root.FC || {};
    root.FC.gameList = api;
  }
})(this);
