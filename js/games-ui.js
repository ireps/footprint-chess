/*
 * Footprint Chess: games screens and flow (stages 3 and 6).
 *
 * Owns everything from the home screen's Games button through the Games
 * screen (one row per kind of game, js/game-list.js), Team, Mission, the
 * game itself, the tip after a win and Won/Break: the pieces met so far
 * chase a knight, race to the other side, clear the other side's pawns or
 * capture a chain of them (rules in js/games.js, no DOM), or answer the
 * footprints quiz (js/quiz.js). Also owns the "juice" shared with capture rounds
 * (js/app.js calls captureJuice/resetStreak/maybeGoldenIndex/markGolden),
 * the capture jar and session stickers, and the break reminder.
 *
 * Reuses js/app.js's overlay/card machinery (FC.app.showCustomCard) rather
 * than duplicating it, and js/board.js's rendering primitives (pieceSvg,
 * moveHero, showFootprints, team bars, ...) rather than touching the DOM
 * directly, the same way js/player.js and js/app.js already do. Depends on
 * FC.rules, FC.games, FC.quiz, FC.gameList, FC.lessons, FC.themes,
 * FC.sound, FC.voice, FC.board and FC.player (all loaded before this file); FC.app (js/app.js) is
 * referenced only inside functions that run after user interaction, since
 * js/app.js itself loads after this file - see index.html's script order.
 *
 * Classic script: exposes window.FC.gamesUI. DOM is built with
 * createElement/textContent only (see SECURITY.md).
 */
(function () {
  'use strict';

  var FC = window.FC;
  var R = FC.rules;
  var G = FC.games;
  var A = FC.army;
  var Q = FC.quiz;
  var PD = FC.pond;
  var HD = FC.hands;
  var GL = FC.gameList;
  var LS = FC.lessons;
  var S = FC.sound;
  var V = FC.voice;
  var B = FC.board;
  var P = FC.player;

  var IDLE_MS = 5000;
  var GOLDEN_CHANCE = 0.2;
  var JAR_MAX = 10;
  // The quiz's footprints are all one colour, so their colour never gives
  // the answer away (every theme but Classic colours footprints per piece).
  var QUIZ_PRINT = '#7a8699';
  // Squares the king may not step to (Keep the king safe).
  var DANGER = '#e0604d';
  // The other side's footprints (Mirror Pond games), and a "safe" ring.
  var FOE_PRINT = '#3b4a5a';
  // The other side's last move in the growing battle.
  var LAST_MOVE = '#8a9bb0';
  var SAFE = '#3dc46b';

  /*
   * Test hooks, both harmless and off by default:
   *   ?golden=1     forces the next capture round/game's golden pawn
   *                 instead of leaving it to a 1-in-5 chance, so a
   *                 golden capture can be exercised without hundreds of
   *                 retries. Never changes anything else.
   *   ?breakmins=N  overrides the break length (the grown-ups' corner
   *                 setting, 15 minutes at first) with N minutes (may be
   *                 fractional, e.g. 0.1), for testing the Break card
   *                 without a wait. It never turns the reminder on: the
   *                 corner's switch and ?break=off still win.
   *   ?break=off    disables the break reminder entirely (documented in
   *                 help.html); the corner has the same switch.
   */
  function parseParam(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search || '');
    if (!m) return null;
    try {
      return decodeURIComponent(m[1]);
    } catch (e) {
      return null; // malformed escape such as "%E0": treat as absent
    }
  }
  var FORCE_GOLDEN = parseParam('golden') === '1';
  var BREAK_OFF = parseParam('break') === 'off';
  var breakMinsParam = parseFloat(parseParam('breakmins'));
  var BREAK_MS_PARAM = (!isNaN(breakMinsParam) && breakMinsParam >= 0) ? breakMinsParam * 60 * 1000 : null;

  /* ---------- small DOM helpers (see js/app.js for the same pattern) ---------- */

  function byId(id) { return document.getElementById(id); }
  function el(tag, cls) { var n = document.createElement(tag); if (cls) n.className = cls; return n; }
  function textEl(tag, cls, str) { var n = el(tag, cls); n.textContent = str; return n; }
  function clear(node) { node.textContent = ''; }
  function key(r, c) { return r + ',' + c; }

  var dom = {
    homeGames: byId('home-games'),
    gameScreen: byId('gamescreen'),
    gameRows: byId('game-rows'),
    armyLadder: byId('army-ladder'),
    gamesHome: byId('games-home'),
    stickerRow: byId('sticker-row'),
    jarFill: byId('game-jar-fill'),
    toolSkip: byId('tool-skip'),
    toolUndo: byId('tool-undo')
  };

  /* ---------- module state ---------- */

  var active = false;        // true from a game card tap until Home
  var gameId = null;         // an id from js/game-list.js
  var gmode = 'none';        // 'lesson' | 'team' | 'mission' | 'play' | 'quiz' | 'tip' | 'won' | 'break'
  var childSide = null;      // 'a' | 'b': the team the child is playing (set at the Team card, kept for Again / next game)
  var gstate = null;         // FC.games state (board games)
  var qstate = null;         // FC.quiz state (the footprints quiz)
  var pstate = null;         // FC.pond state (Their footprints, Which piece is in danger?)
  var pondIdle = 0;          // idle hints given on the current pond question
  var hstate = null;         // FC.hands state (Left or right?)
  var quizMisses = 0;        // wrong taps on the current quiz question
  var quizIdle = 0;          // idle hints given on the current quiz question
  var wrongTaps = {};        // piece type -> taps on a square it cannot reach, this game (for the tip)
  var rotated = {};          // game id -> the piece of its last game (Capture chain, Find the way)
  var tipDone = null;        // ends the tip that is playing (Skip), or null
  var pieceNodes = {};       // "r,c" -> DOM node, every piece currently on the board
  var selected = null;       // [r, c] or null
  var moves = [];
  var busy = false;
  var idleTimer = null;
  var botTimer = null;
  var botTurnCount = 0;      // for "say turn-foe at most every other bot turn"
  var goldenKey = null;      // "r,c" of the golden target this round/game, or null
  // Bumped by stop() and prepareGame(). Every callback a game schedules (a
  // move landing, the bot's pause and move, the win line) captures it when
  // scheduled and does nothing if it has changed, so a move started in one
  // game is never applied to a later one, and nothing runs after Home.
  var gameToken = 0;

  var streak = 0;            // consecutive captures (js/app.js shares this via captureJuice)
  var jarCount = 0;          // 0..JAR_MAX, saved for the current child (js/store.js)
  var store = null;          // the FC.store instance (js/app.js passes it to init)

  var accumMs = 0;           // active play time before the current stretch
  var activeSince = null;    // timestamp the current away-from-Home stretch began, or null
  var pausedByHide = false;  // the running stretch was paused because the page was hidden

  /* ---------- text ---------- */

  // No dedicated short name line exists for a game (only its longer
  // mission line), so the card caption is that line's first clause (every
  // mission line reads "<Name>! <rest>" or "<Name>? <rest>" in every
  // language) - a strict substring of the owner-approved text, not a new
  // translation; a question keeps its "?". The current language's text,
  // else the next language in its fallback chain.
  function shortCaption(lineId) {
    var line = LS.LINES[lineId];
    if (!line) return '';
    var chain = FC.langs.fallbackChain(V.getLang());
    var text = '';
    for (var i = 0; i < chain.length; i++) {
      if (line[chain[i]]) { text = line[chain[i]]; break; }
    }
    var m = /[!?]/.exec(text);
    if (!m) return text.trim();
    return text.slice(0, m[0] === '?' ? m.index + 1 : m.index).trim();
  }

  function modeTextPlay() { return LS.UI_TEXT.turn[V.getLang()]; }
  function modeTextWatch() { return LS.UI_TEXT.watch[V.getLang()]; }

  /* ---------- classic-swap: which visual side each team renders as ---------- */

  // Every theme but Classic keeps the child's own pieces in their usual
  // per-type colours (side 'me') whichever team is picked, and the other
  // side stays the one dark "other side" colour (side 'foe') - see
  // CLAUDE.md. Classic is the one exception: playing Black swaps the pair,
  // so the child's pieces render black and the opponent's render ivory.
  function classicSwap() {
    return B.getTheme() === 'classic' && childSide === 'b';
  }
  function childPieceSide() { return classicSwap() ? 'foe' : 'me'; }
  function foePieceSide() { return classicSwap() ? 'me' : 'foe'; }

  /* =====================================================================
   * Home: the games row
   * ===================================================================*/

  // mini: a compact variant for small spots (the Won card's "next game"
  // button and the panel's mission box).
  function buildGamePic(id, mini) {
    var pic = el('div', mini ? 'game-pic game-pic-mini' : 'game-pic');
    if (id === 'turns') {
      // The "turns" lesson's panel picture: the two teams' pawns.
      pic.appendChild(B.pieceSvg('p', 'me'));
      pic.appendChild(B.pieceSvg('p', 'foe'));
    } else if (id === 'catch') {
      var hand = B.svgUse('ic-hand');
      hand.classList.add('ic-hand-static');
      pic.appendChild(hand);
      pic.appendChild(B.pieceSvg('n', 'foe'));
    } else if (id === 'race') {
      var stack = el('div', 'game-pic-stack');
      stack.appendChild(el('div', 'finish-flag'));
      var row = el('div', 'game-pic-row');
      row.appendChild(B.pieceSvg('p', 'me'));
      row.appendChild(B.pieceSvg('p', 'foe'));
      stack.appendChild(row);
      pic.appendChild(stack);
    } else if (id === 'chain') {
      // One piece, then pawns linked by footprint dots: capture after capture.
      pic.classList.add('game-pic-3');
      pic.classList.add('game-pic-chain');
      pic.appendChild(B.pieceSvg('q', 'me'));
      pic.appendChild(el('span', 'chain-dot'));
      pic.appendChild(B.pieceSvg('p', 'foe'));
      pic.appendChild(el('span', 'chain-dot'));
      pic.appendChild(B.pieceSvg('p', 'foe'));
    } else if (id === 'hop' || id === 'way') {
      // A finish flag over the piece (and, for Find the way, one of the
      // child's own pawns in its way).
      var stack2 = el('div', 'game-pic-stack');
      stack2.appendChild(el('div', 'finish-flag'));
      var row2 = el('div', 'game-pic-row');
      if (id === 'way') row2.appendChild(B.pieceSvg('p', 'me'));
      row2.appendChild(B.pieceSvg(id === 'hop' ? 'n' : 'r', 'me'));
      stack2.appendChild(row2);
      pic.appendChild(stack2);
    } else if (id === 'stop') {
      // An opponent pawn marching down onto the child's rook.
      var stack3 = el('div', 'game-pic-stack game-pic-tight');
      stack3.appendChild(B.pieceSvg('p', 'foe'));
      stack3.appendChild(B.pieceSvg('r', 'me'));
      pic.appendChild(stack3);
    } else if (id === 'safe') {
      // The king, with a shield ring, beside a watching opponent rook.
      var king = el('div', 'safe-king');
      king.appendChild(B.pieceSvg('k', 'me'));
      pic.appendChild(king);
      pic.appendChild(B.pieceSvg('r', 'foe'));
    } else if (id === 'run') {
      // The child's rook hurrying away from an opponent knight.
      pic.classList.add('game-pic-run');
      pic.appendChild(B.pieceSvg('n', 'foe'));
      pic.appendChild(el('span', 'speed-lines'));
      pic.appendChild(B.pieceSvg('r', 'me'));
    } else if (id === 'hands') {
      // The two hand prints: left orange, right blue.
      ['left', 'right'].forEach(function (side) {
        var palm = el('div', 'palm palm-' + side);
        palm.appendChild(B.svgUse('ic-palm'));
        pic.appendChild(palm);
      });
    } else if (id === 'theirs') {
      // Their pawn above its dark footprints, pointing toward your side.
      var st5 = el('div', 'game-pic-stack game-pic-tight');
      st5.appendChild(B.pieceSvg('p', 'foe'));
      var feet = el('div', 'whose-feet their-feet');
      feet.appendChild(el('span'));
      feet.appendChild(el('span'));
      st5.appendChild(feet);
      pic.appendChild(st5);
    } else if (id === 'danger') {
      // An opponent rook looking at the child's piece in a red ring.
      pic.appendChild(B.pieceSvg('r', 'foe'));
      var ring5 = el('div', 'king-ring');
      ring5.appendChild(B.pieceSvg('b', 'me'));
      pic.appendChild(ring5);
    } else if (id === 'mate') {
      // The opponent king in a red ring, the child's queen beside him.
      var cage = el('div', 'king-ring');
      cage.appendChild(B.pieceSvg('k', 'foe'));
      pic.appendChild(cage);
      pic.appendChild(B.pieceSvg('q', 'me'));
    } else if (id === 'escape') {
      // An opponent rook, a red line of danger, the child's king.
      var stack4 = el('div', 'game-pic-stack game-pic-tight game-pic-check');
      stack4.appendChild(B.pieceSvg('r', 'foe'));
      stack4.appendChild(el('div', 'check-line'));
      stack4.appendChild(B.pieceSvg('k', 'me'));
      pic.appendChild(stack4);
    } else if (A.isArmy(id)) {
      // The growing battle: the newest three kinds of piece in that
      // battle, the newest one first.
      var types = A.level(id).types.slice().reverse().slice(0, 3);
      if (types.length === 1) types = ['p', 'p', 'p'];
      pic.classList.add('game-pic-3');
      if (A.level(id).full) {
        // The full game: both kings, with the queen between them.
        pic.appendChild(B.pieceSvg('k', 'me'));
        pic.appendChild(B.pieceSvg('q', 'me'));
        pic.appendChild(B.pieceSvg('k', 'foe'));
      } else {
        types.forEach(function (t) { pic.appendChild(B.pieceSvg(t, 'me')); });
      }
    } else if (id === 'whose') {
      pic.appendChild(buildWhoseMark());
      pic.appendChild(B.pieceSvg('n', 'me'));
    } else if (id === 'games') {
      // Home's Games button: the three rows' marks side by side.
      pic.classList.add('game-pic-entry');
      GL.ROWS.forEach(function (row) { pic.appendChild(buildRowMark(row)); });
    } else {
      pic.classList.add('game-pic-3');
      pic.appendChild(B.pieceSvg('r', 'me'));
      pic.appendChild(B.pieceSvg('p', 'foe'));
      pic.appendChild(B.pieceSvg('p', 'foe'));
    }
    return pic;
  }

  // Two footprints and a question mark: the footprints quiz, and the mark of
  // the thinking row.
  function buildWhoseMark() {
    var mark = el('div', 'whose-mark');
    var feet = el('div', 'whose-feet');
    feet.appendChild(el('span'));
    feet.appendChild(el('span'));
    mark.appendChild(feet);
    mark.appendChild(textEl('div', 'whose-q', '?'));
    return mark;
  }

  // The picture at the start of each row of the Games screen (no words):
  // a pawn being captured, the finish flag, footprints with a question mark.
  function buildRowMark(row) {
    var mark = el('div', 'row-mark row-mark-' + row);
    if (row === 'capture') {
      mark.appendChild(el('div', 'row-burst'));
      mark.appendChild(B.pieceSvg('p', 'foe'));
    } else if (row === 'pond') {
      // The pond: a pawn and its upside-down reflection in still water.
      var water = el('div', 'pond-mark');
      water.appendChild(B.pieceSvg('p', 'foe'));
      var refl = B.pieceSvg('p', 'foe');
      refl.classList.add('pond-mark-ref');
      water.appendChild(refl);
      mark.appendChild(water);
    } else if (row === 'king') {
      // The king in a red ring: games about keeping him safe.
      var ring = el('div', 'king-ring');
      ring.appendChild(B.pieceSvg('k', 'me'));
      mark.appendChild(ring);
    } else if (row === 'army') {
      // The growing battle: a whole army, pawns in front of their pieces.
      mark.classList.add('row-mark-army');
      var back = el('div', 'army-mark-row');
      ['r', 'k', 'b'].forEach(function (t) { back.appendChild(B.pieceSvg(t, 'me')); });
      var front = el('div', 'army-mark-row');
      ['p', 'p', 'p'].forEach(function (t) { front.appendChild(B.pieceSvg(t, 'me')); });
      mark.appendChild(front);
      mark.appendChild(back);
    } else if (row === 'reach') {
      mark.appendChild(el('div', 'finish-flag'));
      mark.appendChild(B.pieceSvg('p', 'me'));
    } else {
      mark.appendChild(buildWhoseMark());
    }
    return mark;
  }

  // Home: one Games button (the pictures of the three rows, no words).
  function renderHomeGames() {
    if (!dom.homeGames) return;
    clear(dom.homeGames);
    var card = el('button', 'game-card games-entry');
    card.type = 'button';
    card.appendChild(buildGamePic('games'));
    card.setAttribute('aria-label', 'Games');
    card.addEventListener('click', showGamesScreen);
    dom.homeGames.appendChild(card);
  }

  /* =====================================================================
   * The Games screen: one row per kind of game (js/game-list.js ROWS)
   * ===================================================================*/

  function wonHere(id) {
    var p = progress();
    return !!(p && p.wins[B.getTheme() + ':' + id]);
  }

  // Every game can be tapped. The first game not yet won in this theme
  // glows (the suggestion); a won game has a small green tick.
  // The growing battle's row is drawn as a ladder of its own (#army-ladder):
  // beside the rows in landscape, the first battle at the bottom; below
  // them in portrait, the first battle next to the row's picture.
  function renderGamesScreen() {
    if (!dom.gameRows) return;
    clear(dom.gameRows);
    if (dom.armyLadder) clear(dom.armyLadder);
    var suggested = null;
    GL.GAMES.forEach(function (g) { if (!suggested && !wonHere(g.id)) suggested = g.id; });
    GL.ROWS.forEach(function (row) {
      var ladder = row === 'army';
      if (ladder && !dom.armyLadder) return;
      var rowEl = ladder ? dom.armyLadder : el('div', 'game-row');
      rowEl.appendChild(buildRowMark(row));
      GL.inRow(row).forEach(function (g) {
        var card = el('button', 'game-card' + (g.id === suggested ? ' suggested' : ''));
        card.type = 'button';
        card.appendChild(buildGamePic(g.id));
        var name = shortCaption(g.mission);
        card.appendChild(textEl('div', 'game-name', name));
        card.setAttribute('aria-label', name);
        if (wonHere(g.id)) {
          var tick = el('div', 'home-card-tick');
          tick.appendChild(B.svgUse('ic-check'));
          card.appendChild(tick);
        }
        card.addEventListener('click', function () { onGameCardTap(g.id); });
        rowEl.appendChild(card);
      });
      if (!ladder) dom.gameRows.appendChild(rowEl);
    });
  }

  function gamesScreenVisible() {
    return !!dom.gameScreen && !dom.gameScreen.hidden;
  }

  // Leaves Home (or the Games screen) for a screen of this file: a capture
  // round may still be running behind the home screen, and the theme and
  // language rows close with it.
  function leaveHome() {
    if (FC.app && FC.app.stopRound) FC.app.stopRound();
    byId('homescreen').hidden = true;
    byId('theme-row').hidden = true;
    byId('lang-row').hidden = true;
  }

  function showGamesScreen() {
    S.unlock();
    leaveHome();
    renderGamesScreen();
    dom.gameScreen.hidden = false;
    V.say('games-pick', function () {});
  }

  function hideGamesScreen() {
    if (dom.gameScreen) dom.gameScreen.hidden = true;
  }

  // The shelf on Home: up to four stickers (earned this page load first,
  // then the book's), drawn by js/stickers.js.
  function renderStickerRow() {
    if (dom.stickerRow && FC.stickers) FC.stickers.renderShelf(dom.stickerRow);
  }

  // The side panel's mission box: while a game (or the "turns" lesson) is
  // showing, the capture round's portrait and three pawn slots would be
  // misleading, so swap them for that game's own goal pictogram (the jar
  // stays beside it). Restored by clearPanel() (see stop()).
  function setPanel(id) {
    var box = byId('mission-box');
    var old = byId('mission-pic');
    if (old) old.remove();
    var pic = buildGamePic(id, true);
    pic.id = 'mission-pic';
    pic.classList.add('mission-pic');
    box.insertBefore(pic, byId('game-jar'));
    box.classList.add('game-mode');
  }
  function clearPanel() {
    var old = byId('mission-pic');
    if (old) old.remove();
    var box = byId('mission-box');
    if (box) box.classList.remove('game-mode');
  }

  /* =====================================================================
   * Flow: game card -> turns lesson (once per child) -> team -> mission -> play -> won/break
   * ===================================================================*/

  function progress() { return (store && store.progress()) || null; }

  // The team the current child last chose in the current theme, or null.
  function rememberedTeam() {
    var p = progress();
    return (p && p.teams[B.getTheme()]) || null;
  }

  function onGameCardTap(id) {
    S.unlock();
    leaveHome();
    hideGamesScreen();
    onLeaveHome();
    P.stop();
    gameId = id;
    active = true;
    prepared = false;
    // The Team card always shows when a team game is entered from the Games
    // screen; the remembered team is only ringed on it. Play again and the
    // next game (on the Won card) skip it and keep childSide.
    childSide = null;
    enterGame();
  }

  // A game with its own lesson (js/game-list.js `lesson`, the "check"
  // lesson before Get out of check) plays it first, once per child. Team
  // games then start with the "Taking turns" lesson (once per child) and
  // the Team card, unless a team is already chosen; solo games go straight
  // to their Mission card.
  function enterGame() {
    var game = GL.get(gameId);
    var p = progress();
    if (game.lesson && !(p && p.seen[game.lesson])) {
      if (store) store.markSeen(game.lesson);
      startGameLesson(game.lesson, enterGame);
      return;
    }
    if (!game.teams || childSide) {
      showMissionCard();
      return;
    }
    if (!(p && p.seen.turns)) {
      if (store) store.markSeen('turns');
      startGameLesson('turns', showTeamCard);
    } else {
      showTeamCard();
    }
  }

  // Plays a lesson inside the games flow (Skip and Replay work as in any
  // lesson), then calls next.
  var lessonRun = null;      // { id, next } while a lesson plays in the games flow
  function startGameLesson(id, next) {
    gmode = 'lesson';
    lessonRun = { id: id, next: next };
    setPanel(id === 'turns' ? 'turns' : gameId);
    if (dom.toolSkip) dom.toolSkip.hidden = false;
    // The other side's view games: the pond (with the lesson's opponent
    // pawn reflected) shows from their lesson on.
    if (GL.get(gameId).row === 'pond') showPondStrip(LS.boardFor(LS.get(id)).board);
    P.start(LS.get(id), {
      onDone: function () {
        if (dom.toolSkip) dom.toolSkip.hidden = true;
        lessonRun = null;
        next();
      }
    });
  }

  function showTeamCard() {
    gmode = 'team';
    B.setMode('none');
    setPanel(gameId);
    if (dom.toolSkip) dom.toolSkip.hidden = true;
    var theme = B.getTheme();
    var remembered = rememberedTeam();
    function build() {
      var frag = document.createDocumentFragment();
      var row = el('div', 'card-row team-row');
      ['a', 'b'].forEach(function (side) {
        var opt = el('button', 'team-option' + (side === remembered ? ' remembered' : ''));
        opt.type = 'button';
        var portrait = el('div', 'portrait card-portrait');
        portrait.appendChild(B.pieceSvg('p', side === 'a' ? 'me' : 'foe'));
        opt.appendChild(portrait);
        var name = B.teamName(theme, side);
        opt.appendChild(textEl('div', 'big-name', name));
        opt.setAttribute('aria-label', name);
        opt.addEventListener('click', function (e) {
          e.stopPropagation();
          onTeamChosen(side);
        });
        row.appendChild(opt);
      });
      frag.appendChild(row);
      frag.appendChild(textEl('div', 'caption', LS.LINES['pick-team'][V.getLang()]));
      return frag;
    }
    FC.app.showCustomCard(build, null);
    V.say('pick-team', function () {});
  }

  function onTeamChosen(side) {
    S.unlock();
    childSide = side;
    if (store) store.setTeam(B.getTheme(), side);
    var lineId = 'team-' + B.getTheme() + '-' + side;
    // Interrupts the "pick a team" prompt; the mission line then queues
    // behind this one (showMissionCard uses sayAfter).
    V.say(lineId);
    showMissionCard();
  }

  function showMissionCard() {
    gmode = 'mission';
    B.setMode('none');
    setPanel(gameId);
    // Set the game's starting position up behind the card, so the picture
    // behind it matches the game about to start.
    prepareGame();
    if (dom.toolSkip) dom.toolSkip.hidden = true;
    var lineId = GL.get(gameId).mission;
    function build() {
      var frag = document.createDocumentFragment();
      frag.appendChild(buildGamePic(gameId));
      frag.appendChild(textEl('div', 'caption', LS.LINES[lineId][V.getLang()]));
      var row = el('div', 'btn-row');
      var go = el('button', 'go-btn');
      go.type = 'button';
      go.setAttribute('aria-label', 'Play');
      go.appendChild(B.svgUse('play-tri'));
      row.appendChild(go);
      // "Watch how to play", whenever the child wants it; then back here.
      var how = el('button', 'rbtn rbtn-tip');
      how.type = 'button';
      how.setAttribute('aria-label', 'Watch how to play');
      how.appendChild(B.svgUse('ic-bulb'));
      how.addEventListener('click', function (e) {
        e.stopPropagation();
        S.unlock();
        FC.app.hideCard();
        playHow(showMissionCard);
      });
      row.appendChild(how);
      frag.appendChild(row);
      return frag;
    }
    FC.app.showCustomCard(build, startOrHow);
    V.sayAfter(lineId);
  }

  // The first time a child plays a game, its "watch how to play" scene
  // comes first (saved as seen 'how-<game>'), then the game.
  function startOrHow() {
    var p = progress();
    var key = 'how-' + gameId;
    if (p && p.seen[key]) {
      startGame();
      return;
    }
    if (store) store.markSeen(key);
    playHow(function () {
      prepared = false; // the scene used the board; set the game up again
      startGame();
    });
  }

  function playHow(done) {
    playTip({ kind: 'how', line: GL.get(gameId).tip }, done, 'how-look');
  }

  /* =====================================================================
   * The game itself
   * ===================================================================*/

  function lastNonPawn() {
    return (FC.app && FC.app.lastNonPawnType) ? FC.app.lastNonPawnType() : 'r';
  }

  // The last piece chosen on Home if `list` has it, else the rook.
  function homePieceIn(list) {
    return list.indexOf(lastNonPawn()) !== -1 ? lastNonPawn() : 'r';
  }

  // The piece after `prev` in `list`, or the Home piece the first time.
  function rotate(list, prev) {
    return prev ? list[(list.indexOf(prev) + 1) % list.length] : homePieceIn(list);
  }

  function gameOptions(id) {
    if (id === 'catch') return { type: lastNonPawn() };
    if (id === 'stop') return { type: homePieceIn(G.STOP_TYPES) };
    if (id === 'run') return { type: lastNonPawn() };
    // Capture chain and Find the way: the first game uses the last piece
    // chosen on Home; each new one (Play again included) the next piece,
    // so every piece gets a turn.
    if (id === 'chain') {
      rotated.chain = rotate(G.CHAIN_TYPES, rotated.chain);
      return { type: rotated.chain };
    }
    if (id === 'way') {
      rotated.way = rotate(G.WAY_TYPES, rotated.way);
      return { type: rotated.way };
    }
    if (id === 'battle') {
      var extra = (FC.app && FC.app.seenNonPawnTypes) ? FC.app.seenNonPawnTypes() : [];
      return { types: ['r'].concat(extra.slice(0, 2)) };
    }
    return {};
  }

  function pickGoldenKey() {
    if (gameId === 'catch' || !gstate) return null;
    var candidates = [];
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = gstate.board[r][c];
        if (p && p.team === 'foe' && p.type === 'p') candidates.push(key(r, c));
      }
    }
    var idx = maybeGoldenIndex(candidates.length, Math.random);
    return idx === -1 ? null : candidates[idx];
  }

  function renderGame() {
    pieceNodes = {};
    if (GL.get(gameId).row === 'pond') showPondStrip(gstate.board);
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = gstate.board[r][c];
        if (!p) continue;
        var node;
        if (p.team === 'me') {
          node = B.addPiece(p.type, r, c, childPieceSide());
        } else {
          node = B.addItem(r, c, p.type, foePieceSide());
          if (key(r, c) === goldenKey) markGolden(node);
        }
        pieceNodes[key(r, c)] = node;
      }
    }
  }

  function showGameTeamBars() {
    // Solo games have no other team taking turns: no team bars.
    if (!childSide || !GL.get(gameId).teams) {
      B.hideTeamBars();
      return;
    }
    var theme = B.getTheme();
    var otherSide = childSide === 'a' ? 'b' : 'a';
    B.showTeamBars({
      home: { name: B.teamName(theme, childSide), pawnSide: childPieceSide() },
      far: { name: B.teamName(theme, otherSide), pawnSide: foePieceSide() },
      active: gstate.turn === 'me' ? 'home' : 'far'
    });
  }

  function refreshTeamBarLabels() {
    if (!active || !gstate || !childSide) return;
    showGameTeamBars();
  }

  var prepared = false;   // a starting position is already on the board (Mission card)

  function prepareGame() {
    wrongTaps = {};
    if (GL.get(gameId).kind === 'quiz') {
      prepareQuiz();
      return;
    }
    if (GL.get(gameId).kind === 'pond') {
      preparePond();
      return;
    }
    if (GL.get(gameId).kind === 'hands') {
      prepareHands();
      return;
    }
    gameToken += 1;
    window.clearTimeout(botTimer);
    botTimer = null;
    streak = 0;
    busy = false;
    selected = null;
    moves = [];
    botTurnCount = 0;
    gstate = G.create(gameId, gameOptions(gameId), Math.random);
    armyDangerKeys = {};
    armyDanger = [];
    // "The opponent moves first" when the child's chosen team is b: team a
    // always moves first (js/themes.js TEAMS), and js/games.js's own 'me'
    // is really just "the bottom of the board", not a literal team - so
    // handing the very first turn to 'foe' here is enough; every rule in
    // js/games.js still works unchanged either way round.
    if (childSide === 'b' && GL.get(gameId).teams) gstate.turn = 'foe';
    goldenKey = pickGoldenKey();
    B.clearAll();
    renderGame();
    showGameTeamBars();
    prepared = true;
  }

  function startGame() {
    if (GL.get(gameId).kind === 'quiz') {
      startQuiz();
      return;
    }
    if (GL.get(gameId).kind === 'pond') {
      startPond();
      return;
    }
    if (GL.get(gameId).kind === 'hands') {
      startHands();
      return;
    }
    gmode = 'play';
    if (dom.toolSkip) dom.toolSkip.hidden = true;
    setPanel(gameId);
    if (!prepared) prepareGame();
    prepared = false;
    updateUndo();
    if (gstate.turn === 'me') {
      B.setMode('play', modeTextPlay());
      S.play('your-turn');
      if (gameId === 'escape') showAttackers();
      if (PUZZLE_LINES[gameId]) V.sayAfter(PUZZLE_LINES[gameId].ask);
      armIdle();
    } else {
      B.setMode('watch', modeTextWatch());
      // Pacing: a short beat before the other team moves, which reduced
      // motion must not shorten.
      var myToken = gameToken;
      botTimer = B.wait(function () {
        if (myToken !== gameToken) return;
        botTurn();
      }, 500);
    }
  }

  /* ---------- selection and the child's move ---------- */

  function clearIdle() { window.clearTimeout(idleTimer); }
  function armIdle() {
    clearIdle();
    idleTimer = window.setTimeout(onIdle, IDLE_MS);
  }
  function onIdle() {
    if (gmode === 'pond') {
      onPondIdle();
      return;
    }
    if (gmode === 'hands') {
      onHandsIdle();
      return;
    }
    if (gmode === 'quiz') {
      // Once per question the question is asked again; the next time the
      // hand rests on the answer. Then nothing more until the child taps.
      if (busy || !qstate || qstate.over) return;
      quizIdle += 1;
      B.pulseFootprints();
      if (quizIdle === 1) {
        V.say('quiz-ask', function () {});
        armIdle();
      } else {
        pointAtAnswer();
      }
      return;
    }
    if (gmode !== 'play' || !gstate || gstate.turn !== 'me' || busy) return;
    if (selected) {
      B.pulseFootprints();
      // Checkmate in one and the growing battle: with a piece selected,
      // its best square glows.
      var target = (gameId === 'mate' || gstate.army) ? G.hint(gstate, selected) : null;
      if (target && gstate.army) {
        B.glow([]);
        armyHelp();
        B.glowAdd([target]);
      } else if (target && (target[0] !== selected[0] || target[1] !== selected[1])) B.glow([target]);
    } else if (gstate.army) {
      // The growing battle: the piece of a good move glows, beside the
      // other side's last move and any piece in danger.
      S.play('nudge');
      var piece = G.hint(gstate);
      B.glow([]);
      armyHelp();
      if (piece) B.glowAdd([piece]);
    } else {
      S.play('nudge');
      // A hint square glows: the next pawn of a capture chain, the next step
      // toward a pawn or toward the other side (js/games.js hint).
      var next = G.hint(gstate);
      if (next) B.glow([next]);
    }
    armIdle();
  }

  function findMove(r, c) {
    for (var i = 0; i < moves.length; i++) {
      if (moves[i].r === r && moves[i].c === c) return moves[i];
    }
    return null;
  }

  function selectPiece(r, c) {
    if (selected) {
      var prev = pieceNodes[key(selected[0], selected[1])];
      if (prev) prev.classList.remove('selected');
      B.hideFootprints(pieceNodes);
    }
    selected = [r, c];
    moves = G.legalMoves(gstate, r, c);
    var node = pieceNodes[key(r, c)];
    node.classList.add('selected');
    B.replay(node, 'bounce');
    B.showFootprints(gstate.board[r][c].type, [r, c], moves, pieceNodes);
    // Keep the king safe: the squares he may not step to glow red.
    B.glow(G.dangerSquares(gstate, r, c), DANGER);
    if (gstate.army) armyHelp();
    S.play('pick', gstate.board[r][c].type);
  }

  function isDanger(r, c) {
    if (!selected) return false;
    return G.dangerSquares(gstate, selected[0], selected[1]).some(function (sq) { return sq[0] === r && sq[1] === c; });
  }

  function handleTap(r, c) {
    if (gmode === 'lesson') { P.handleTap(r, c); return; }
    if (gmode === 'quiz') { onQuizTap(r, c); return; }
    if (gmode === 'pond') { onPondTap(r, c); return; }
    if (gmode === 'hands') { onHandsTap(r, c); return; }
    if (gmode === 'tip') { B.nudgeMode(); return; }
    if (gmode !== 'play' || !gstate || gstate.over) return;
    if (gstate.turn !== 'me' || busy) {
      B.nudgeMode();
      return;
    }
    armIdle();
    B.glow([]);
    if (gstate.army) armyHelp();
    var piece = gstate.board[r][c];
    if (piece && piece.team === 'me') {
      if (gstate.heroOnly && !G.legalMoves(gstate, r, c).length) {
        // Find the way: the child's pawns only stand in the way.
        B.replay(pieceNodes[key(r, c)], 'wiggle');
        S.play('bonk');
        return;
      }
      selectPiece(r, c);
      return;
    }
    if (!selected) {
      S.play('nudge');
      return;
    }
    var mv = findMove(r, c);
    if (mv) {
      doChildMove(selected, mv);
    } else if (isDanger(r, c)) {
      // A step the king may not take: the danger squares flash and the
      // voice says why. Not counted as a wrong tap (the king's rule is not
      // the thing to learn again here).
      B.replay(pieceNodes[key(selected[0], selected[1])], 'wiggle');
      B.glow(G.dangerSquares(gstate, selected[0], selected[1]), DANGER);
      B.pulseFootprints();
      S.play('bonk');
      V.say(gameId === 'run' ? 'run-danger' : 'king-danger', function () {});
    } else {
      var t = gstate.board[selected[0]][selected[1]].type;
      wrongTaps[t] = (wrongTaps[t] || 0) + 1;
      // The king's red squares stay while he is selected.
      B.glow(G.dangerSquares(gstate, selected[0], selected[1]), DANGER);
      if (gstate.army) armyHelp();
      B.pulseFootprints();
      S.play('bonk');
    }
  }

  function doChildMove(from, mv) {
    busy = true;
    updateUndo();
    B.glow([]);
    var node = pieceNodes[key(from[0], from[1])];
    node.classList.remove('selected');
    B.hideFootprints(pieceNodes);
    selected = null;
    var to = [mv.r, mv.c];
    var type = gstate.board[from[0]][from[1]].type;
    var myToken = gameToken;
    B.moveHero(node, type, from, to, function () {
      if (myToken !== gameToken || !gstate) return;
      var res = G.applyMove(gstate, from, to);
      if (res.reverted) {
        takeBack(node, type, from, to, res);
        return;
      }
      commitMove(node, from, to, res, true);
    });
  }

  // Checkmate in one: a move that is not checkmate goes back where it came
  // from; the squares the king could still reach glow red.
  function takeBack(node, type, from, to, res) {
    var myToken = gameToken;
    B.moveHero(node, type, to, from, function () {
      if (myToken !== gameToken || !gstate) return;
      B.glow(res.escapes || [], DANGER);
      resetStreak();
      busy = false;
      V.say('mate-nearly', function () {});
      armIdle();
    });
  }

  /* ---------- shared move landing (child or bot) ---------- */

  function syncNewPieces() {
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = gstate.board[r][c];
        var k = key(r, c);
        if (p && p.team === 'me' && !pieceNodes[k]) {
          var node = B.addPiece(p.type, r, c, childPieceSide());
          B.replay(node, 'enter');
          pieceNodes[k] = node;
        }
      }
    }
  }

  function handleEvents(events) {
    (events || []).forEach(function (ev) {
      if (ev === 'knight-tired') {
        V.sayAfter('knight-tired');
      } else if (ev === 'piece-back') {
        V.sayAfter('piece-back');
        syncNewPieces();
      }
    });
  }

  function commitMove(node, from, to, res, isChild) {
    var fk = key(from[0], from[1]);
    var tk = key(to[0], to[1]);
    // En passant captures a pawn beside the landing square.
    var ck = res.capturedAt ? key(res.capturedAt[0], res.capturedAt[1]) : tk;
    var goldenCaptured = !!res.captured && goldenKey === ck;
    if (goldenKey === fk) goldenKey = tk; // the golden piece itself just moved
    if (goldenCaptured) goldenKey = null;

    delete pieceNodes[fk];
    if (res.captured) {
      var capNode = pieceNodes[ck];
      if (capNode && capNode !== node) B.poof(capNode);
      delete pieceNodes[ck];
    }
    pieceNodes[tk] = node;
    if (res.rook) {
      // Castling: the rook moves beside the king.
      var rk = key(res.rook.from[0], res.rook.from[1]);
      var rookNode = pieceNodes[rk];
      delete pieceNodes[rk];
      if (rookNode) {
        pieceNodes[key(res.rook.to[0], res.rook.to[1])] = rookNode;
        B.moveHero(rookNode, 'r', res.rook.from, res.rook.to, function () {});
      }
      V.sayAfter('army-castle');
    }
    if ((res.events || []).indexOf('passant') !== -1) V.sayAfter('army-passant');
    if ((res.events || []).indexOf('foe-promoted') !== -1) {
      // The other side's pawn on the child's side becomes a queen.
      var foeQueen = B.addItem(to[0], to[1], 'q', foePieceSide());
      node.remove();
      node = foeQueen;
      pieceNodes[tk] = foeQueen;
      V.sayAfter('army-foe-queen');
    }
    if ((res.events || []).indexOf('promoted') !== -1) {
      // The pawn on the other side becomes a queen.
      var queen = B.addPiece('q', to[0], to[1], childPieceSide());
      B.replay(queen, 'enter');
      B.sparkle(to[0], to[1], 0);
      node.remove();
      node = queen;
      pieceNodes[tk] = queen;
      V.sayAfter('army-queen');
    }
    if (isChild && (res.events || []).indexOf('check') !== -1) V.sayAfter('army-check');

    if (res.captured && res.captured.team === 'foe') {
      captureJuice(to[0], to[1], { isPawn: res.captured.type === 'p', golden: goldenCaptured, node: node });
    } else if (isChild) {
      resetStreak();
    }
    handleEvents(res.events);

    busy = false;
    if (gstate.over) {
      onGameOver();
      return;
    }
    if ((gstate.id === 'escape' || gstate.id === 'mate') && gstate.solved) {
      nextPuzzleUI();
      return;
    }
    if (isChild) {
      armIdle();
      botTurn();
    } else {
      if (GL.get(gameId).row === 'pond') showPondStrip(gstate.board);
      B.setActiveTeamBar('home');
      B.setMode('play', modeTextPlay());
      S.play('your-turn');
      V.sayAfter('turn-me');
      updateUndo();
      if (gstate.army) {
        // A piece newly in danger: its red ring, and the warning once. In
        // check, the check line instead.
        var before = armyDangerKeys;
        B.glow([]);
        armyHelp(true);
        var fresh = Object.keys(armyDangerKeys).some(function (k) { return !before[k]; });
        if (R.inCheck(gstate.board, 'me')) V.sayAfter('escape-ask');
        else if (fresh) V.sayAfter('army-danger');
      }
      armIdle();
    }
  }

  /* ---------- the growing battle: help while playing ---------- */

  var armyDangerKeys = {};   // "r,c" of the child's pieces in danger, as last shown
  var armyDanger = [];       // the same squares, worked out once per turn

  // The other side's last move (where it came from and where it went)
  // glows softly, and the child's pieces the other side could capture get
  // a red ring. Added to whatever else glows. fresh: work the danger out
  // again (after a move); otherwise the squares from the start of this
  // turn are reused, since nothing has moved.
  // The Undo button (the growing battle): shown on the child's turn once
  // they have a move to take back.
  function updateUndo() {
    if (!dom.toolUndo) return;
    dom.toolUndo.hidden = !(gmode === 'play' && gstate && gstate.army && !busy && A.canUndo(gstate));
  }

  // Takes back the child's last move and the other side's reply, and sets
  // the board up again.
  function onUndo() {
    S.unlock();
    if (gmode !== 'play' || !gstate || !gstate.army || busy || !A.canUndo(gstate)) {
      B.nudgeMode();
      return;
    }
    A.undo(gstate);
    gameToken += 1;
    clearIdle();
    selected = null;
    moves = [];
    B.hideFootprints(pieceNodes);
    B.hideHand();
    B.clearAll();
    // The golden pawn stays golden only if it is still where it was.
    if (goldenKey) {
      var gp = gstate.board[+goldenKey.split(',')[0]][+goldenKey.split(',')[1]];
      if (!gp || gp.team !== 'foe' || gp.type !== 'p') goldenKey = null;
    }
    renderGame();
    B.glow([]);
    armyHelp(true);
    B.setActiveTeamBar('home');
    B.setMode('play', modeTextPlay());
    S.play('your-turn');
    V.say('army-undo', function () {});
    updateUndo();
    armIdle();
  }

  function armyHelp(fresh) {
    if (!gstate || !gstate.army) return;
    if (gstate.lastFoe) B.glowAdd([gstate.lastFoe.from, gstate.lastFoe.to], LAST_MOVE);
    if (fresh) {
      armyDanger = A.inDanger(gstate.board, 'me');
      // In check: the pieces giving check glow red too.
      if (R.inCheck(gstate.board, 'me')) armyDanger = armyDanger.concat(A.checkers(gstate.board, 'me'));
      armyDangerKeys = {};
      armyDanger.forEach(function (sq) { armyDangerKeys[key(sq[0], sq[1])] = true; });
    }
    B.glowAdd(armyDanger, DANGER);
  }

  /* ---------- Get out of check: one puzzle after another ---------- */

  // The squares of the opponent pieces giving check glow red.
  function showAttackers() {
    var king = R.findKing(gstate.board, 'me');
    if (!king) return;
    var from = [];
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = gstate.board[r][c];
        if (!p || p.team !== 'foe') continue;
        if (R.attacks(gstate.board, r, c).some(function (sq) { return sq[0] === king[0] && sq[1] === king[1]; })) from.push([r, c]);
      }
    }
    B.glow(from, DANGER);
  }

  // Get out of check and Checkmate in one: after a solved puzzle, its line,
  // then the next puzzle and its question.
  var PUZZLE_LINES = {
    escape: { solved: 'check-3', ask: 'escape-ask' },
    mate: { solved: 'mate-3', ask: 'mate-ask' }
  };

  function nextPuzzleUI() {
    busy = true;
    clearIdle();
    B.setMode('watch', modeTextWatch());
    var myToken = gameToken;
    var lines = PUZZLE_LINES[gstate.id];
    if (gstate.id === 'mate') glowKingCage();
    V.sayAfter(lines.solved, function () {
      if (myToken !== gameToken || !gstate) return;
      // Pacing between puzzles, which reduced motion must not shorten.
      B.wait(function () {
        if (myToken !== gameToken || !gstate) return;
        G.nextPuzzle(gstate);
        B.clearAll();
        renderGame();
        busy = false;
        B.setMode('play', modeTextPlay());
        S.play('your-turn');
        if (gstate.id === 'escape') showAttackers();
        V.say(lines.ask, function () {});
        armIdle();
      }, 400);
    });
  }

  // After a checkmate: the opponent king's square and every square around
  // it glow red (he has nowhere to go).
  function glowKingCage() {
    var king = R.findKing(gstate.board, 'foe');
    if (!king) return;
    var sqs = [];
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        if (R.onBoard(king[0] + dr, king[1] + dc)) sqs.push([king[0] + dr, king[1] + dc]);
      }
    }
    B.glow(sqs, DANGER);
  }

  /* ---------- the bot's turn ---------- */

  function botTurn() {
    if (!gstate || gstate.over || gstate.turn !== 'foe') return;
    var announce = (botTurnCount % 2 === 0);
    botTurnCount += 1;
    var theme = B.getTheme();
    var otherSide = childSide === 'a' ? 'b' : 'a';
    B.setActiveTeamBar('far');
    B.setMode('watch', announce ? B.turnBadgeText(theme, otherSide) : modeTextWatch());
    if (announce) V.sayAfter('turn-foe');
    var myToken = gameToken;
    // Pacing: the other team's "thinking" pause, which reduced motion must
    // not shorten.
    botTimer = B.wait(function () {
      if (myToken !== gameToken || !gstate) return;
      var mv = G.botMove(gstate, Math.random);
      if (!mv) {
        gstate.turn = 'me';
        updateUndo();
        B.setActiveTeamBar('home');
        B.setMode('play', modeTextPlay());
        S.play('your-turn');
        V.sayAfter('turn-me');
        armIdle();
        return;
      }
      var node = pieceNodes[key(mv.from[0], mv.from[1])];
      if (!node) return; // defensive: should never happen
      var type = gstate.board[mv.to[0]][mv.to[1]].type;
      B.moveHero(node, type, mv.from, mv.to, function () {
        if (myToken !== gameToken || !gstate) return;
        commitMove(node, mv.from, mv.to, { captured: mv.captured, capturedAt: mv.capturedAt, rook: mv.rook, events: mv.events }, false);
      });
    }, 600 + Math.floor(Math.random() * 300));
  }

  /* ---------- game over -> Won or Break ---------- */

  // The battle with kings can end with nobody winning (a stalemate).
  function isDraw() {
    return !!gstate && gstate.over && !gstate.winner && GL.get(gameId).kind === 'board';
  }

  function onGameOver() {
    clearIdle();
    updateUndo();
    resetStreak();
    B.hideFootprints(pieceNodes);
    B.hideHand();
    B.glow([]);
    selected = null;
    if (isDraw()) {
      // A calm ending: no win sound, no confetti, not counted as a win.
      var drawToken = gameToken;
      V.sayAfter(gstate.drawReason === 'kings' ? 'army-draw-kings' : 'army-draw', function () {
        if (drawToken === gameToken) showGameWonOrBreak();
      });
      return;
    }
    S.play('win');
    B.confetti(28);
    var lineId = GL.get(gameId).win;
    var myToken = gameToken;
    function toWon() {
      if (myToken !== gameToken) return;
      afterWin();
    }
    // Winning three different games in a theme for the first time also
    // earns the golden king: its pop and the sticker line come before the
    // Won card. markWin is true exactly once per child and theme.
    var goldenKing = !!store && store.markWin(B.getTheme(), gameId);
    if (goldenKing) {
      V.sayAfter(lineId);
      awardSticker('golden-k', toWon);
    } else {
      // Queued behind any sticker/golden line that is still playing.
      V.sayAfter(lineId, toWon);
    }
  }

  // After the win line: a tip on the board when one is due (js/game-list.js
  // pickTip), then the Won card (or the Break card).
  function afterWin() {
    // The pond games teach the other side's moves, so no rule tip of the
    // child's own pieces follows them.
    var kind = GL.get(gameId).kind;
    var misses = gmodeIsQuiz() ? qstate.misses : ((kind === 'pond' || kind === 'hands') ? {} : wrongTaps);
    var tip = GL.pickTip(gameId, misses);
    if (!tip) {
      showGameWonOrBreak();
      return;
    }
    playTip(tip, showGameWonOrBreak, 'tip-look');
  }

  function gmodeIsQuiz() {
    return GL.get(gameId).kind === 'quiz' && !!qstate;
  }

  function showGameWonOrBreak() {
    if (dueForBreak()) {
      showBreakCard(showGameWon);
    } else {
      showGameWon();
    }
  }

  function nextGameId() {
    return GL.next(gameId);
  }

  function showGameWon() {
    gmode = 'won';
    B.setMode('none');
    B.hideTeamBars();
    function build() {
      var frag = document.createDocumentFragment();
      var drawn = isDraw();
      var trophy = el('div', drawn ? 'trophy trophy-calm' : 'trophy');
      if (!drawn) trophy.appendChild(el('div', 'ray'));
      trophy.appendChild(buildGamePic(gameId));
      frag.appendChild(trophy);

      var row = el('div', 'btn-row');
      var again = el('button', 'rbtn rbtn-again');
      again.type = 'button';
      again.setAttribute('aria-label', 'Play again');
      again.appendChild(B.svgUse('again'));
      again.addEventListener('click', function (e) {
        e.stopPropagation();
        S.unlock();
        FC.app.hideCard();
        startGame();
      });
      row.appendChild(again);

      var nextId = nextGameId();
      var next = el('button', 'rbtn');
      next.type = 'button';
      next.setAttribute('aria-label', 'Next game');
      next.appendChild(buildGamePic(nextId, true));
      next.addEventListener('click', function (e) {
        e.stopPropagation();
        S.unlock();
        FC.app.hideCard();
        gameId = nextId;
        enterGame();
      });
      row.appendChild(next);

      // "Watch how to play" again, on the board, whenever the child wants it.
      var tipBtn = el('button', 'rbtn rbtn-tip');
      tipBtn.type = 'button';
      tipBtn.setAttribute('aria-label', 'Watch how to play');
      tipBtn.appendChild(B.svgUse('ic-bulb'));
      tipBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        S.unlock();
        FC.app.hideCard();
        playHow(showGameWon);
      });
      row.appendChild(tipBtn);

      var home = el('button', 'rbtn rbtn-home');
      home.type = 'button';
      home.setAttribute('aria-label', 'Home');
      home.appendChild(B.svgUse('house'));
      home.addEventListener('click', function (e) { e.stopPropagation(); S.unlock(); FC.app.goHome(); });
      row.appendChild(home);

      frag.appendChild(row);
      return frag;
    }
    FC.app.showCustomCard(build, null);
    if (!isDraw()) B.screenConfetti(40);
  }

  /* =====================================================================
   * The footprints quiz ("Whose footprints?", js/quiz.js)
   * ===================================================================*/

  function asMoves(list) {
    return list.map(function (sq) { return { r: sq[0], c: sq[1], capture: false }; });
  }

  function showQuizPrints() {
    var q = Q.current(qstate);
    if (q) B.showFootprints(q.answer, q.square, asMoves(q.footprints), {}, QUIZ_PRINT);
  }

  // The question on the board: the empty square glows, one-colour
  // footprints around it, and the three choices on the child's side.
  function renderQuestion() {
    B.clearAll();
    pieceNodes = {};
    var q = Q.current(qstate);
    B.glow([q.square]);
    q.choices.forEach(function (ch) {
      pieceNodes[key(ch.at[0], ch.at[1])] = B.addPiece(ch.type, ch.at[0], ch.at[1], childPieceSide());
    });
    showQuizPrints();
  }

  function prepareQuiz() {
    gameToken += 1;
    clearIdle();
    busy = false;
    quizMisses = 0;
    qstate = Q.create({}, Math.random);
    B.hideTeamBars();
    renderQuestion();
    prepared = true;
  }

  function startQuiz() {
    gmode = 'quiz';
    if (dom.toolSkip) dom.toolSkip.hidden = true;
    setPanel(gameId);
    if (!prepared) prepareQuiz();
    prepared = false;
    askQuestion(false);
  }

  // Watch while the question is asked, then the child's turn.
  function askQuestion(redraw) {
    quizMisses = 0;
    quizIdle = 0;
    busy = true;
    if (redraw) renderQuestion();
    B.setMode('watch', modeTextWatch());
    var myToken = gameToken;
    V.say('quiz-ask', function () {
      if (myToken !== gameToken) return;
      busy = false;
      B.setMode('play', modeTextPlay());
      S.play('your-turn');
      armIdle();
    });
  }

  // The ghost hand rests on the right choice.
  function pointAtAnswer() {
    var q = Q.current(qstate);
    if (!q) return;
    q.choices.forEach(function (ch) { if (ch.type === q.answer) B.handRest(ch.at[0], ch.at[1]); });
  }

  function onQuizTap(r, c) {
    if (!qstate || qstate.over || busy) {
      B.nudgeMode();
      return;
    }
    armIdle();
    var q = Q.current(qstate);
    var choice = null;
    q.choices.forEach(function (ch) { if (ch.at[0] === r && ch.at[1] === c) choice = ch; });
    if (!choice) {
      S.play('nudge');
      return;
    }
    S.play('pick', choice.type);
    var node = pieceNodes[key(r, c)];
    var res = Q.answer(qstate, choice.type);
    if (res.correct) quizRight(node, choice, q, res.over);
    else quizWrong(node, choice, q);
  }

  // The right piece steps onto the empty square, its footprints light up in
  // its own colour and its rule is said (the rule line names the piece).
  function quizRight(node, choice, q, over) {
    busy = true;
    clearIdle();
    B.hideHand();
    B.glow([]);
    B.setMode('watch', modeTextWatch());
    B.place(node, q.square[0], q.square[1]);
    B.replay(node, 'enter');
    B.sparkle(q.square[0], q.square[1], 0);
    S.play('star');
    B.showFootprints(choice.type, q.square, asMoves(q.footprints), {});
    var myToken = gameToken;
    V.say(GL.RULE_LINES[choice.type], function () {
      if (myToken !== gameToken) return;
      // Pacing between questions, which reduced motion must not shorten.
      B.wait(function () {
        if (myToken !== gameToken) return;
        if (over) onGameOver();
        else askQuestion(true);
      }, 500);
    });
  }

  // No fail state: the tapped piece wiggles and shows its own footprints
  // from the same square for a moment, then the question's footprints come
  // back. After two wrong taps the ghost hand rests on the answer.
  function quizWrong(node, choice, q) {
    busy = true;
    quizMisses += 1;
    // The app is showing something: Watch until the child can try again.
    B.setMode('watch', modeTextWatch());
    B.replay(node, 'wiggle');
    S.play('bonk');
    B.showFootprints(choice.type, q.square, asMoves(Q.footprints(choice.type, q.square)), {});
    var myToken = gameToken;
    V.say('quiz-again', function () {
      if (myToken !== gameToken) return;
      showQuizPrints();
      busy = false;
      B.setMode('play', modeTextPlay());
      if (quizMisses >= 2) pointAtAnswer();
      armIdle();
    });
  }

  /* =====================================================================
   * Mirror Pond: the other side's view (js/pond.js). A still pond in the
   * far strip shows the other side's pieces reflected, as if seen from
   * their seat; the board itself never turns.
   * ===================================================================*/

  function showPondStrip(board) {
    var pond = byId('pond');
    var strip = byId('strip-far');
    if (!pond || !strip) return;
    clear(pond);
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = board[r][c];
        if (!p || p.team !== 'foe') continue;
        var ref = el('div', 'pond-ref');
        ref.style.left = (c * 12.5) + '%';
        ref.appendChild(B.pieceSvg(p.type, foePieceSide()));
        pond.appendChild(ref);
      }
    }
    pond.hidden = false;
    strip.classList.add('pond-on');
  }

  function hidePondStrip() {
    var pond = byId('pond');
    var strip = byId('strip-far');
    if (pond) {
      clear(pond);
      pond.hidden = true;
    }
    if (strip) strip.classList.remove('pond-on');
  }

  function pondBoard() {
    return gameId === 'theirs' ? pstate.questions[pstate.index].board : pstate.positions[pstate.index].board;
  }
  function pondAskLine() { return gameId === 'theirs' ? 'theirs-ask' : 'danger-ask'; }

  function preparePond() {
    gameToken += 1;
    clearIdle();
    busy = false;
    pstate = gameId === 'theirs' ? PD.createTheirs({}, Math.random) : PD.createDanger({}, Math.random);
    B.hideTeamBars();
    renderPond();
    prepared = true;
  }

  function renderPond() {
    B.clearAll();
    pieceNodes = {};
    var board = pondBoard();
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = board[r][c];
        if (!p) continue;
        pieceNodes[key(r, c)] = p.team === 'me' ? B.addPiece(p.type, r, c, childPieceSide()) : B.addItem(r, c, p.type, foePieceSide());
      }
    }
    if (gameId === 'theirs') B.glow([pstate.questions[pstate.index].at]);
    showPondStrip(board);
  }

  function startPond() {
    gmode = 'pond';
    if (dom.toolSkip) dom.toolSkip.hidden = true;
    setPanel(gameId);
    if (!prepared) preparePond();
    prepared = false;
    askPond(false);
  }

  function askPond(redraw) {
    pondIdle = 0;
    busy = true;
    if (redraw) renderPond();
    B.setMode('watch', modeTextWatch());
    var myToken = gameToken;
    V.say(pondAskLine(), function () {
      if (myToken !== gameToken) return;
      busy = false;
      B.setMode('play', modeTextPlay());
      S.play('your-turn');
      armIdle();
    });
  }

  // Their piece's footprints, in the other side's dark colour.
  function showTheirPrints(at) {
    var board = pondBoard();
    var p = board[at[0]][at[1]];
    B.showFootprints(p.type, at, R.movesFor(board, at[0], at[1]), {}, FOE_PRINT);
  }

  // Next question or position, after a short pause (pacing, which reduced
  // motion must not shorten), or the end of the game.
  function pondNext(more) {
    var myToken = gameToken;
    B.wait(function () {
      if (myToken !== gameToken || !pstate) return;
      if (more) askPond(true);
      else onGameOver();
    }, 900);
  }

  function onPondTap(r, c) {
    if (!pstate || pstate.over || busy) {
      B.nudgeMode();
      return;
    }
    armIdle();
    if (gameId === 'theirs') theirsTap(r, c);
    else if (pstate.phase === 'find') dangerFindTap(r, c);
    else if (pstate.phase === 'move') dangerMoveTap(r, c);
  }

  function theirsTap(r, c) {
    var q = pstate.questions[pstate.index];
    var res = PD.tapTheirs(pstate, r, c);
    if (res === 'self') {
      S.play('nudge');
      return;
    }
    var myToken = gameToken;
    if (res === 'wrong') {
      // No fail state: its footprints show while the voice explains; after
      // two misses they stay.
      busy = true;
      B.setMode('watch', modeTextWatch());
      S.play('bonk');
      showTheirPrints(q.at);
      V.say('theirs-again', function () {
        if (myToken !== gameToken) return;
        if (pstate.misses < 2) B.hideFootprints({});
        busy = false;
        B.setMode('play', modeTextPlay());
        armIdle();
      });
      return;
    }
    // Right: its footprints show and it moves there.
    busy = true;
    clearIdle();
    B.setMode('watch', modeTextWatch());
    B.glow([]);
    showTheirPrints(q.at);
    S.play('star');
    var node = pieceNodes[key(q.at[0], q.at[1])];
    var landed = pieceNodes[key(r, c)];
    B.wait(function () {
      if (myToken !== gameToken) return;
      B.hideFootprints({});
      B.moveHero(node, q.type, q.at, [r, c], function () {
        if (myToken !== gameToken) return;
        if (landed && landed !== node) B.poof(landed);
        B.sparkle(r, c, 0);
        pondNext(PD.nextTheirs(pstate));
      });
    }, 700);
  }

  // The other side's piece (or pieces) that could capture the piece on sq.
  function attackersOf(board, sq) {
    var out = [];
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = board[r][c];
        if (p && p.team === 'foe' && R.attacks(board, r, c).some(function (a) { return a[0] === sq[0] && a[1] === sq[1]; })) out.push([r, c]);
      }
    }
    return out;
  }

  function dangerFindTap(r, c) {
    var pos = pstate.positions[pstate.index];
    var res = PD.tapDanger(pstate, r, c);
    if (res === 'none') {
      S.play('nudge');
      return;
    }
    var myToken = gameToken;
    if (res === 'safe') {
      B.replay(pieceNodes[key(r, c)], 'bounce');
      B.glow([[r, c]], SAFE);
      V.say('danger-safe', function () {});
      return;
    }
    // Right: the attacker's footprints reach it and it glows red; then the
    // child moves it to a safe square.
    busy = true;
    clearIdle();
    B.hideHand();
    B.setMode('watch', modeTextWatch());
    S.play('star');
    var from = attackersOf(pos.board, pos.target)[0];
    if (from) showTheirPrints(from);
    B.glow([pos.target], DANGER);
    V.say('danger-yes', function () {
      if (myToken !== gameToken) return;
      B.hideFootprints({});
      selectDangerPiece();
      busy = false;
      B.setMode('play', modeTextPlay());
      armIdle();
    });
  }

  // The piece in danger, selected: safe footprints, red on the rest.
  function selectDangerPiece() {
    var pos = pstate.positions[pstate.index];
    var node = pieceNodes[key(pos.target[0], pos.target[1])];
    var type = pos.board[pos.target[0]][pos.target[1]].type;
    node.classList.add('selected');
    B.replay(node, 'bounce');
    B.showFootprints(type, pos.target, PD.dangerSafeMoves(pstate), {});
    B.glow(PD.dangerUnsafe(pstate), DANGER);
  }

  function dangerMoveTap(r, c) {
    var pos = pstate.positions[pstate.index];
    var from = pos.target.slice();
    var type = pos.board[from[0]][from[1]].type;
    var node = pieceNodes[key(from[0], from[1])];
    var unsafe = PD.dangerUnsafe(pstate).some(function (sq) { return sq[0] === r && sq[1] === c; });
    if (!PD.moveToSafety(pstate, r, c)) {
      B.pulseFootprints();
      S.play('bonk');
      if (unsafe) V.say('run-danger', function () {});
      return;
    }
    busy = true;
    clearIdle();
    B.glow([]);
    B.hideFootprints({});
    node.classList.remove('selected');
    var landed = pieceNodes[key(r, c)];
    var myToken = gameToken;
    B.moveHero(node, type, from, [r, c], function () {
      if (myToken !== gameToken) return;
      if (landed && landed !== node) B.poof(landed);
      S.play('star');
      B.sparkle(r, c, 0);
      pondNext(PD.nextDanger(pstate));
    });
  }

  // First the question again, then an answer to look at (their footprints,
  // or the ghost hand on the piece in danger, or a safe square); then
  // nothing more until the child taps.
  function onPondIdle() {
    if (busy || !pstate || pstate.over) return;
    pondIdle += 1;
    if (gameId === 'danger' && pstate.phase === 'move') {
      var safe = PD.dangerSafeMoves(pstate);
      if (safe.length && pondIdle === 1) {
        B.pulseFootprints();
        armIdle();
      }
      return;
    }
    if (pondIdle === 1) {
      V.say(pondAskLine(), function () {});
      armIdle();
      return;
    }
    if (gameId === 'theirs') showTheirPrints(pstate.questions[pstate.index].at);
    else B.handRest(pstate.positions[pstate.index].target[0], pstate.positions[pstate.index].target[1]);
  }

  /* =====================================================================
   * Left or right? (js/hands.js): the one game that names left and right,
   * with the child's two hand prints at the ends of their own strip.
   * ===================================================================*/

  var handsIdle = 0;

  function handsAskLine() {
    var q = HD.current(hstate);
    return q && q.dir === 'right' ? 'hands-right' : 'hands-left';
  }

  function prepareHands() {
    gameToken += 1;
    clearIdle();
    busy = false;
    selected = null;
    hstate = HD.create({}, Math.random);
    B.hideTeamBars();
    renderHands();
    prepared = true;
  }

  function renderHands() {
    B.clearAll();
    pieceNodes = {};
    selected = null;
    var q = HD.current(hstate);
    pieceNodes[key(q.at[0], q.at[1])] = B.addPiece(q.type, q.at[0], q.at[1], childPieceSide());
    B.showHandPrints(true);
  }

  function startHands() {
    gmode = 'hands';
    if (dom.toolSkip) dom.toolSkip.hidden = true;
    setPanel(gameId);
    if (!prepared) prepareHands();
    prepared = false;
    askHands(false);
  }

  // Watch while the question is asked (the named hand print glows), then
  // the child's turn.
  function askHands(redraw) {
    handsIdle = 0;
    busy = true;
    if (redraw) renderHands();
    B.setMode('watch', modeTextWatch());
    B.flashHandPrint(HD.current(hstate).dir);
    var myToken = gameToken;
    V.say(handsAskLine(), function () {
      if (myToken !== gameToken) return;
      busy = false;
      B.setMode('play', modeTextPlay());
      S.play('your-turn');
      armIdle();
    });
  }

  function handsMoves() {
    return HD.moves(hstate);
  }

  function onHandsTap(r, c) {
    if (!hstate || hstate.over || busy) {
      B.nudgeMode();
      return;
    }
    armIdle();
    var q = HD.current(hstate);
    var node = pieceNodes[key(q.at[0], q.at[1])];
    if (r === q.at[0] && c === q.at[1]) {
      selected = q.at.slice();
      node.classList.add('selected');
      B.replay(node, 'bounce');
      B.showFootprints(q.type, q.at, handsMoves(), {});
      S.play('pick', q.type);
      return;
    }
    if (!selected) {
      S.play('nudge');
      return;
    }
    var legal = handsMoves().some(function (m) { return m.r === r && m.c === c; });
    if (!legal) {
      B.pulseFootprints();
      S.play('bonk');
      return;
    }
    var res = HD.answer(hstate, [r, c]);
    selected = null;
    node.classList.remove('selected');
    B.hideFootprints({});
    B.hideHand();
    busy = true;
    clearIdle();
    B.setMode('watch', modeTextWatch());
    var myToken = gameToken;
    B.moveHero(node, q.type, q.at, [r, c], function () {
      if (myToken !== gameToken || !hstate) return;
      if (res === 'yes') {
        S.play('star');
        B.sparkle(r, c, 0);
        B.flashHandPrint(q.dir);
        V.say(q.dir === 'left' ? 'hands-yes-left' : 'hands-yes-right', function () {
          if (myToken !== gameToken || !hstate) return;
          // Pacing between questions, which reduced motion must not shorten.
          B.wait(function () {
            if (myToken !== gameToken || !hstate) return;
            if (HD.next(hstate)) askHands(true);
            else onGameOver();
          }, 400);
        });
        return;
      }
      // No fail state: the piece goes back. The other way: that hand is
      // named, then the asked one glows; straight up or down: ask again.
      if (res === 'other') B.flashHandPrint(q.dir === 'left' ? 'right' : 'left');
      var line = res === 'other' ? (q.dir === 'left' ? 'hands-not-left' : 'hands-not-right') : handsAskLine();
      B.moveHero(node, q.type, [r, c], q.at, function () {
        if (myToken !== gameToken || !hstate) return;
        V.say(line, function () {
          if (myToken !== gameToken || !hstate) return;
          B.flashHandPrint(q.dir);
          busy = false;
          B.setMode('play', modeTextPlay());
          armIdle();
        });
      });
    });
  }

  // First the question again (with its hand print), then the ghost hand on
  // the piece, or, once it is selected, on a square the asked way; then
  // nothing more until the child taps.
  function onHandsIdle() {
    if (busy || !hstate || hstate.over) return;
    handsIdle += 1;
    var q = HD.current(hstate);
    if (handsIdle === 1) {
      B.flashHandPrint(q.dir);
      V.say(handsAskLine(), function () {});
      armIdle();
      return;
    }
    if (!selected) {
      B.handRest(q.at[0], q.at[1]);
      return;
    }
    var good = handsMoves().filter(function (m) { return HD.sideOf(q.at, [m.r, m.c]) === q.dir; });
    if (good.length) B.handRest(good[0].r, good[0].c);
  }

  /* =====================================================================
   * Short "watch" scenes on the board: "watch how to play" (each game's
   * own scene in HOW_TO, before its first game and from the light bulb on
   * its Mission and Won cards), and the rule tip after a win
   * (js/game-list.js pickTip), which shows one piece's footprints and says
   * its rule. Skip ends either at once.
   * ===================================================================*/

  // lead: the line said first ('tip-look' after a win, 'how-look' before
  // a "watch how to play" scene).
  function playTip(tip, done, lead) {
    lead = lead || 'tip-look';
    gmode = 'tip';
    clearIdle();
    busy = false;
    selected = null;
    V.stop();
    B.hideTeamBars();
    B.hideHand();
    B.clearAll();
    B.glow([]);
    pieceNodes = {};
    B.setMode('watch', modeTextWatch());
    S.play('watch');
    if (dom.toolSkip) dom.toolSkip.hidden = false;
    if (dom.toolUndo) dom.toolUndo.hidden = true;
    gameToken += 1;
    var myToken = gameToken;
    var finished = false;
    function alive() { return !finished && myToken === gameToken; }
    function finish() {
      if (finished) return;
      finished = true;
      tipDone = null;
      gameToken += 1;
      V.stop();
      B.hideFootprints({});
      B.glow([]);
      B.clearAll();
      B.setMode('none');
      if (dom.toolSkip) dom.toolSkip.hidden = true;
      done();
    }
    tipDone = finish;
    var ctx = {
      alive: alive,
      // Runs fn after ms, unless the tip was skipped or ended. Pacing, so
      // reduced motion must not shorten it.
      after: function (ms, fn) { B.wait(function () { if (alive()) fn(); }, ms); },
      end: function () { ctx.after(700, finish); }
    };
    V.say(lead, function () {
      if (!alive()) return;
      if (tip.kind === 'rule') ruleTip(ctx, tip.type, tip.line);
      else (HOW_TO[gameId] || ruleTipFallback)(ctx, tip.line);
    });
  }

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
    var node = B.addPiece(type, r, c, childPieceSide());
    B.replay(node, 'enter');
    return node;
  }
  function tipFoe(type, r, c) {
    return B.addItem(r, c, type, foePieceSide());
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
              var queen = B.addPiece('q', 0, 2, childPieceSide());
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
      showPondStrip(board);
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
      showPondStrip(board);
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

  /* ---------- break reminder ---------- */

  function onLeaveHome() {
    if (activeSince === null) activeSince = Date.now();
  }
  function onEnterHome() {
    renderStickerRow();
    pausedByHide = false;
    if (activeSince !== null) {
      accumMs += Date.now() - activeSince;
      activeSince = null;
    }
  }
  function elapsedMs() {
    return accumMs + (activeSince !== null ? Date.now() - activeSince : 0);
  }
  function resetPlayTimer() {
    accumMs = 0;
    if (activeSince !== null) activeSince = Date.now();
  }

  // A sleeping tablet is not play time: while the page is hidden the running
  // stretch is folded into accumMs and paused, and resumed on return, but
  // only if a stretch was running (never on the home screen).
  function onVisibilityChange() {
    if (document.hidden) {
      if (activeSince !== null) {
        accumMs += Date.now() - activeSince;
        activeSince = null;
        pausedByHide = true;
      }
    } else if (pausedByHide) {
      pausedByHide = false;
      if (activeSince === null) activeSince = Date.now();
    }
  }
  // The grown-ups' corner's break settings (js/store.js); ?break=off and
  // ?breakmins= (test hooks, see the top of this file) still apply.
  function dueForBreak() {
    if (BREAK_OFF) return false;
    var s = store ? store.settings() : { breakOn: true, breakMins: 15 };
    if (!s.breakOn) return false;
    var ms = BREAK_MS_PARAM !== null ? BREAK_MS_PARAM : s.breakMins * 60 * 1000;
    return elapsedMs() >= ms;
  }

  function showBreakCard(onKeepPlaying) {
    gmode = 'break';
    B.setMode('none');
    B.hideTeamBars();
    function build() {
      var frag = document.createDocumentFragment();
      var icon = el('div', 'break-icon');
      icon.appendChild(B.svgUse('ic-moon'));
      frag.appendChild(icon);
      frag.appendChild(textEl('div', 'caption', LS.LINES.break[V.getLang()]));
      var row = el('div', 'btn-row');
      var keep = el('button', 'go-btn');
      keep.type = 'button';
      keep.setAttribute('aria-label', 'Keep playing');
      keep.appendChild(B.svgUse('play-tri'));
      keep.addEventListener('click', function (e) {
        e.stopPropagation();
        S.unlock();
        resetPlayTimer();
        onKeepPlaying();
      });
      row.appendChild(keep);
      var home = el('button', 'rbtn rbtn-home');
      home.type = 'button';
      home.setAttribute('aria-label', 'Home');
      home.appendChild(B.svgUse('house'));
      home.addEventListener('click', function (e) {
        e.stopPropagation();
        S.unlock();
        resetPlayTimer();
        FC.app.goHome();
      });
      row.appendChild(home);
      frag.appendChild(row);
      return frag;
    }
    FC.app.showCustomCard(build, null);
    V.say('break', function () {});
  }

  /* =====================================================================
   * Juice: streak sound, capture burst/bump, jar, golden pawn, stickers.
   * Shared with js/app.js's own capture rounds (see captureAt/land there).
   * ===================================================================*/

  function resetStreak() { streak = 0; }

  // opts: { isPawn, golden, node }. node (the piece that just captured) is
  // optional so a caller without one handy (there is always one in
  // practice) can still get the sound/burst/bump/jar part.
  function captureJuice(r, c, opts) {
    opts = opts || {};
    streak += 1;
    B.sparkle(r, c, 0);
    B.captureBurst(r, c, 8 + Math.floor(Math.random() * 5));
    B.bump();
    S.play('capture', streak);
    if (opts.node) B.replay(opts.node, 'cheer');
    if (opts.golden) {
      V.sayAfter('golden');
      awardSticker('golden-p');
    } else if (opts.isPawn) {
      growJar();
    }
  }

  function maybeGoldenIndex(count, rng) {
    rng = rng || Math.random;
    if (!count) return -1;
    if (FORCE_GOLDEN) return 0;
    if (rng() >= GOLDEN_CHANCE) return -1;
    return Math.floor(rng() * count);
  }

  function markGolden(node) {
    node.classList.add('golden');
    var svg = node.querySelector('svg');
    // Set directly on the piece's own <svg> (not the wrapper div): a
    // theme's .side-foe rule sets --pc on that same element, and a
    // property declared on the element itself always wins over one merely
    // inherited from an ancestor, regardless of selector specificity.
    if (svg) svg.style.setProperty('--pc', '#f5c518');
  }

  function updateJarDom() {
    if (dom.jarFill) dom.jarFill.style.transform = 'scaleY(' + (jarCount / JAR_MAX) + ')';
  }

  function saveJar() {
    if (store) store.setJar(jarCount);
  }

  function growJar() {
    jarCount = Math.min(jarCount + 1, JAR_MAX);
    updateJarDom();
    saveJar();
    if (jarCount >= JAR_MAX) {
      jarCount = 0;
      updateJarDom();
      saveJar();
      awardSticker(pieceStickerType());
    }
  }

  // The piece a full jar earns a sticker of: the piece the child was
  // playing. In a game that is its one piece (heroType), the pawn (Pawn
  // race) or the rook (Little battle); in a capture round it is that
  // round's piece.
  function pieceStickerType() {
    if (active && gstate && gstate.heroType) return gstate.heroType;
    // The growing battle: the newest kind of piece in that battle.
    if (active && gstate && gstate.army) return A.level(gstate.id).types.slice(-1)[0];
    if (active && gameId === 'race') return 'p';
    if (active && gameId === 'battle') return 'r';
    return (FC.app && FC.app.roundType) ? FC.app.roundType() : 'p';
  }

  function showStickerPop(theme, kind) {
    var host = byId('mission-box');
    if (!host) return;
    var pop = el('div', 'sticker-pop');
    pop.appendChild(FC.stickers.art(theme, kind));
    host.appendChild(pop);
    window.setTimeout(function () { pop.remove(); }, 1500);
  }

  // Saves the sticker for the current child (js/store.js), pops it in the
  // side panel and says the sticker line; done runs when that line settles.
  function awardSticker(kind, done) {
    var theme = B.getTheme();
    if (store) store.addSticker(theme, kind);
    FC.stickers.record(theme, kind);
    V.sayAfter('sticker', done);
    showStickerPop(theme, kind);
    renderStickerRow();
  }

  /* ---------- stop / lifecycle ---------- */

  function stop() {
    gameToken += 1;
    window.clearTimeout(botTimer);
    botTimer = null;
    clearIdle();
    V.stop();
    P.stop();
    B.hideHand();
    B.hideTeamBars();
    if (dom.toolSkip) dom.toolSkip.hidden = true;
    if (dom.toolUndo) dom.toolUndo.hidden = true;
    active = false;
    gmode = 'none';
    gameId = null;
    gstate = null;
    qstate = null;
    pstate = null;
    hstate = null;
    B.showHandPrints(false);
    hidePondStrip();
    tipDone = null;
    B.glow([]);
    pieceNodes = {};
    selected = null;
    busy = false;
    prepared = false;
    clearPanel();
  }

  function onLangChange() {
    renderHomeGames();
    if (gamesScreenVisible()) renderGamesScreen();
    refreshTeamBarLabels();
  }
  function onThemeChange() {
    if (gamesScreenVisible()) renderGamesScreen();
    refreshTeamBarLabels();
  }

  function onSkip() {
    if (gmode === 'lesson' && lessonRun) {
      var next = lessonRun.next;
      lessonRun = null;
      P.stop();
      if (dom.toolSkip) dom.toolSkip.hidden = true;
      next();
    } else if (gmode === 'tip' && tipDone) {
      tipDone();
    }
  }

  function onReplay() {
    if (gmode === 'lesson' && lessonRun) startGameLesson(lessonRun.id, lessonRun.next);
    else if (gmode === 'quiz' && !busy) V.say('quiz-ask', function () {});
    else if (gmode === 'pond' && !busy) V.say(pondAskLine(), function () {});
    else if (gmode === 'hands' && !busy && hstate && !hstate.over) V.say(handsAskLine(), function () {});
  }

  // A different child is now playing (or everything was replaced): the
  // jar and the shelf belong to the child.
  function onProfileChange() {
    var p = progress();
    jarCount = p ? p.jar : 0;
    streak = 0;
    childSide = null;
    updateJarDom();
    renderStickerRow();
  }

  function init(theStore) {
    store = theStore;
    document.addEventListener('visibilitychange', onVisibilityChange);
    if (dom.gamesHome) {
      dom.gamesHome.appendChild(B.svgUse('house'));
      dom.gamesHome.addEventListener('click', function () { S.unlock(); FC.app.goHome(); });
    }
    if (dom.toolUndo) {
      dom.toolUndo.appendChild(B.svgUse('ic-undo'));
      dom.toolUndo.addEventListener('click', onUndo);
    }
    renderHomeGames();
    onProfileChange();
  }

  FC.gamesUI = {
    init: init,
    active: function () { return active; },
    handleTap: handleTap,
    onSkip: onSkip,
    onReplay: onReplay,
    onLangChange: onLangChange,
    onThemeChange: onThemeChange,
    onLeaveHome: onLeaveHome,
    onEnterHome: onEnterHome,
    onProfileChange: onProfileChange,
    hideGamesScreen: hideGamesScreen,
    stop: stop,
    captureJuice: captureJuice,
    resetStreak: resetStreak,
    maybeGoldenIndex: maybeGoldenIndex,
    markGolden: markGolden,
    dueForBreak: dueForBreak,
    showBreakCard: showBreakCard
  };
})();
