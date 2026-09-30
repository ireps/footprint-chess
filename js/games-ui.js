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
  var Q = FC.quiz;
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
    gamesHome: byId('games-home'),
    stickerRow: byId('sticker-row'),
    jarFill: byId('game-jar-fill'),
    toolSkip: byId('tool-skip')
  };

  /* ---------- module state ---------- */

  var active = false;        // true from a game card tap until Home
  var gameId = null;         // an id from js/game-list.js
  var gmode = 'none';        // 'turns' | 'team' | 'mission' | 'play' | 'quiz' | 'tip' | 'won' | 'break'
  var childSide = null;      // 'a' | 'b': the team the child is playing (set at the Team card, kept for Again / next game)
  var gstate = null;         // FC.games state (board games)
  var qstate = null;         // FC.quiz state (the footprints quiz)
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
  function renderGamesScreen() {
    if (!dom.gameRows) return;
    clear(dom.gameRows);
    var suggested = null;
    GL.GAMES.forEach(function (g) { if (!suggested && !wonHere(g.id)) suggested = g.id; });
    GL.ROWS.forEach(function (row) {
      var rowEl = el('div', 'game-row');
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
      dom.gameRows.appendChild(rowEl);
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

  // Team games start with the "Taking turns" lesson (once per child) and
  // the Team card, unless a team is already chosen; solo games (Capture
  // chain, the quiz) go straight to their Mission card.
  function enterGame() {
    if (!GL.get(gameId).teams || childSide) {
      showMissionCard();
      return;
    }
    var p = progress();
    if (!(p && p.seen.turns)) {
      if (store) store.markSeen('turns');
      startTurnsLesson();
    } else {
      showTeamCard();
    }
  }

  function startTurnsLesson() {
    gmode = 'turns';
    setPanel('turns');
    if (dom.toolSkip) dom.toolSkip.hidden = false;
    P.start(LS.get('turns'), {
      onDone: function () {
        if (dom.toolSkip) dom.toolSkip.hidden = true;
        showTeamCard();
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
      var go = el('button', 'go-btn');
      go.type = 'button';
      go.appendChild(B.svgUse('play-tri'));
      frag.appendChild(go);
      return frag;
    }
    FC.app.showCustomCard(build, startGame);
    V.sayAfter(lineId);
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
    gameToken += 1;
    window.clearTimeout(botTimer);
    botTimer = null;
    streak = 0;
    busy = false;
    selected = null;
    moves = [];
    botTurnCount = 0;
    gstate = G.create(gameId, gameOptions(gameId), Math.random);
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
    gmode = 'play';
    if (dom.toolSkip) dom.toolSkip.hidden = true;
    setPanel(gameId);
    if (!prepared) prepareGame();
    prepared = false;
    if (gstate.turn === 'me') {
      B.setMode('play', modeTextPlay());
      S.play('your-turn');
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
    S.play('pick', gstate.board[r][c].type);
  }

  function isDanger(r, c) {
    if (!selected) return false;
    return G.dangerSquares(gstate, selected[0], selected[1]).some(function (sq) { return sq[0] === r && sq[1] === c; });
  }

  function handleTap(r, c) {
    if (gmode === 'turns') { P.handleTap(r, c); return; }
    if (gmode === 'quiz') { onQuizTap(r, c); return; }
    if (gmode === 'tip') { B.nudgeMode(); return; }
    if (gmode !== 'play' || !gstate || gstate.over) return;
    if (gstate.turn !== 'me' || busy) {
      B.nudgeMode();
      return;
    }
    armIdle();
    B.glow([]);
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
      V.say('king-danger', function () {});
    } else {
      var t = gstate.board[selected[0]][selected[1]].type;
      wrongTaps[t] = (wrongTaps[t] || 0) + 1;
      // The king's red squares stay while he is selected.
      B.glow(G.dangerSquares(gstate, selected[0], selected[1]), DANGER);
      B.pulseFootprints();
      S.play('bonk');
    }
  }

  function doChildMove(from, mv) {
    busy = true;
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
      commitMove(node, from, to, res, true);
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
    var goldenCaptured = !!res.captured && goldenKey === tk;
    if (goldenKey === fk) goldenKey = tk; // the golden piece itself just moved
    if (goldenCaptured) goldenKey = null;

    delete pieceNodes[fk];
    if (res.captured) {
      var capNode = pieceNodes[tk];
      if (capNode && capNode !== node) B.poof(capNode);
    }
    pieceNodes[tk] = node;

    if (res.captured) {
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
    if (isChild) {
      armIdle();
      botTurn();
    } else {
      B.setActiveTeamBar('home');
      B.setMode('play', modeTextPlay());
      S.play('your-turn');
      V.sayAfter('turn-me');
      armIdle();
    }
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
        commitMove(node, mv.from, mv.to, { captured: mv.captured, events: mv.events }, false);
      });
    }, 600 + Math.floor(Math.random() * 300));
  }

  /* ---------- game over -> Won or Break ---------- */

  function onGameOver() {
    clearIdle();
    resetStreak();
    B.hideFootprints(pieceNodes);
    B.hideHand();
    B.glow([]);
    selected = null;
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
    var p = progress();
    var misses = gmodeIsQuiz() ? qstate.misses : wrongTaps;
    var tip = GL.pickTip(gameId, misses, !!(p && p.seen['tip-' + gameId]));
    if (!tip) {
      showGameWonOrBreak();
      return;
    }
    if (tip.kind === 'strategy' && store) store.markSeen('tip-' + gameId);
    playTip(tip, showGameWonOrBreak);
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
      var trophy = el('div', 'trophy');
      trophy.appendChild(el('div', 'ray'));
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

      // The game's tip, on the board, whenever the child wants it again.
      var tipBtn = el('button', 'rbtn rbtn-tip');
      tipBtn.type = 'button';
      tipBtn.setAttribute('aria-label', 'Tip');
      tipBtn.appendChild(B.svgUse('ic-bulb'));
      tipBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        S.unlock();
        FC.app.hideCard();
        playTip({ kind: 'strategy', line: GL.get(gameId).tip }, showGameWon);
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
    B.screenConfetti(40);
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
   * Tips after a game: a short "watch" on the board (js/game-list.js
   * pickTip chooses which). A rule tip shows one piece's footprints and
   * says its rule; a strategy tip plays the game's own little scene. Skip
   * ends it at once.
   * ===================================================================*/

  function playTip(tip, done) {
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
    V.say('tip-look', function () {
      if (!alive()) return;
      if (tip.kind === 'rule') ruleTip(ctx, tip.type, tip.line);
      else (STRATEGY_TIPS[gameId] || ruleTipFallback)(ctx, tip.line);
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

  var STRATEGY_TIPS = {
    // The piece comes closer, then the knight's own footprints show where
    // it can hop.
    catch: function (ctx, line) {
      var board = R.emptyBoard();
      board[7][1] = { type: 'r', team: 'me' };
      board[3][4] = { type: 'n', team: 'foe' };
      var rook = tipPiece('r', 7, 1);
      tipFoe('n', 3, 4);
      var done = join(2, ctx.end);
      V.say(line, function () { if (ctx.alive()) done(); });
      ctx.after(600, function () {
        tipMove(ctx, board, rook, [7, 1], [5, 1], null, function () {
          ctx.after(300, function () {
            B.showFootprints('n', [3, 4], R.movesFor(board, 3, 4), {});
            ctx.after(1500, done);
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
    active = false;
    gmode = 'none';
    gameId = null;
    gstate = null;
    qstate = null;
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
    if (gmode === 'turns') {
      P.stop();
      if (dom.toolSkip) dom.toolSkip.hidden = true;
      showTeamCard();
    } else if (gmode === 'tip' && tipDone) {
      tipDone();
    }
  }

  function onReplay() {
    if (gmode === 'turns') startTurnsLesson();
    else if (gmode === 'quiz' && !busy) V.say('quiz-ask', function () {});
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
