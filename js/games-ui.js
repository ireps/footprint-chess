/*
 * Footprint Chess: games screens and flow (stage 3).
 *
 * Owns everything from the home screen's second "games" row through Team,
 * Mission, the game itself and Won/Break: the pieces met so far chase a
 * knight, race to the other side, or clear the other side's pawns (rules in
 * js/games.js, no DOM). Also owns the "juice" shared with capture rounds
 * (js/app.js calls captureJuice/resetStreak/maybeGoldenIndex/markGolden),
 * the capture jar and session stickers, and the break reminder.
 *
 * Reuses js/app.js's overlay/card machinery (FC.app.showCustomCard) rather
 * than duplicating it, and js/board.js's rendering primitives (pieceSvg,
 * moveHero, showFootprints, team bars, ...) rather than touching the DOM
 * directly, the same way js/player.js and js/app.js already do. Depends on
 * FC.rules, FC.games, FC.lessons, FC.themes, FC.sound, FC.voice, FC.board
 * and FC.player (all loaded before this file); FC.app (js/app.js) is
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
  var LS = FC.lessons;
  var S = FC.sound;
  var V = FC.voice;
  var B = FC.board;
  var P = FC.player;

  var IDLE_MS = 5000;
  var GOLDEN_CHANCE = 0.2;
  var JAR_MAX = 10;
  var BREAK_MS_DEFAULT = 15 * 60 * 1000;

  /*
   * Test hooks, both harmless and off by default:
   *   ?golden=1     forces the next capture round/game's golden pawn
   *                 instead of leaving it to a 1-in-5 chance, so a
   *                 golden capture can be exercised without hundreds of
   *                 retries. Never changes anything else.
   *   ?breakmins=N  overrides the 15-minute break threshold with N
   *                 minutes (may be fractional, e.g. 0.1), for testing the
   *                 Break card without a 15-minute wait.
   *   ?break=off    the owner-facing switch from the spec: disables the
   *                 break reminder entirely (documented in help.html).
   */
  function parseParam(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search || '');
    return m ? decodeURIComponent(m[1]) : null;
  }
  var FORCE_GOLDEN = parseParam('golden') === '1';
  var BREAK_OFF = parseParam('break') === 'off';
  var breakMinsParam = parseFloat(parseParam('breakmins'));
  var BREAK_MS = (!isNaN(breakMinsParam) && breakMinsParam >= 0) ? breakMinsParam * 60 * 1000 : BREAK_MS_DEFAULT;

  /* ---------- small DOM helpers (see js/app.js for the same pattern) ---------- */

  function byId(id) { return document.getElementById(id); }
  function el(tag, cls) { var n = document.createElement(tag); if (cls) n.className = cls; return n; }
  function textEl(tag, cls, str) { var n = el(tag, cls); n.textContent = str; return n; }
  function clear(node) { node.textContent = ''; }
  function key(r, c) { return r + ',' + c; }

  var dom = {
    homeGames: byId('home-games'),
    stickerRow: byId('sticker-row'),
    jarFill: byId('game-jar-fill'),
    toolSkip: byId('tool-skip')
  };

  /* ---------- module state ---------- */

  var active = false;        // true from a game card tap until Home
  var gameId = null;         // 'catch' | 'race' | 'battle'
  var gmode = 'none';        // 'turns' | 'team' | 'mission' | 'play' | 'won' | 'break'
  var childSide = null;      // 'a' | 'b', remembered for this page load once chosen
  var turnsSeen = false;     // the "turns" lesson, shown once per page load
  var gstate = null;         // FC.games state
  var pieceNodes = {};       // "r,c" -> DOM node, every piece currently on the board
  var selected = null;       // [r, c] or null
  var moves = [];
  var busy = false;
  var idleTimer = null;
  var botTimer = null;
  var botTurnCount = 0;      // for "say turn-foe at most every other bot turn"
  var goldenKey = null;      // "r,c" of the golden target this round/game, or null

  var streak = 0;            // consecutive captures (js/app.js shares this via captureJuice)
  var jarCount = 0;          // 0..JAR_MAX, session-only
  var stickers = [];         // [{ type }], session-only, earned this page load

  var accumMs = 0;           // active play time before the current stretch
  var activeSince = null;    // timestamp the current away-from-Home stretch began, or null

  var GAMES = [
    { id: 'catch', line: 'game-catch' },
    { id: 'race', line: 'game-race' },
    { id: 'battle', line: 'game-battle' }
  ];

  /* ---------- text ---------- */

  // No dedicated short name line exists for a game (only its longer
  // mission line), so the card caption is that line's first clause (every
  // mission line reads "<Name>! <rest>" in both languages) - a strict
  // substring of the owner-approved text, not a new translation.
  function shortCaption(lineId) {
    var line = LS.LINES[lineId];
    if (!line) return '';
    var text = line[V.getLang()] || line.en;
    var idx = text.indexOf('!');
    return (idx === -1 ? text : text.slice(0, idx)).trim();
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
    } else {
      pic.classList.add('game-pic-3');
      pic.appendChild(B.pieceSvg('r', 'me'));
      pic.appendChild(B.pieceSvg('p', 'foe'));
      pic.appendChild(B.pieceSvg('p', 'foe'));
    }
    return pic;
  }

  function renderHomeGames() {
    if (!dom.homeGames) return;
    clear(dom.homeGames);
    GAMES.forEach(function (g) {
      var card = el('button', 'game-card');
      card.type = 'button';
      card.appendChild(buildGamePic(g.id));
      var name = shortCaption(g.line);
      card.appendChild(textEl('div', 'game-name', name));
      card.setAttribute('aria-label', name);
      card.addEventListener('click', function () { onGameCardTap(g.id); });
      dom.homeGames.appendChild(card);
    });
  }

  function renderStickerRow() {
    if (!dom.stickerRow) return;
    clear(dom.stickerRow);
    stickers.forEach(function (s) {
      var chip = el('div', 'sticker-chip');
      chip.appendChild(B.pieceSvg(s.type, 'me'));
      dom.stickerRow.appendChild(chip);
    });
    dom.stickerRow.hidden = stickers.length === 0;
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
   * Flow: game card -> turns lesson (once) -> team (once) -> mission -> play -> won/break
   * ===================================================================*/

  function onGameCardTap(id) {
    S.unlock();
    if (FC.app && FC.app.showCustomCard) { /* used later in the flow */ }
    byId('homescreen').hidden = true;
    byId('theme-row').hidden = true;
    onLeaveHome();
    P.stop();
    gameId = id;
    active = true;
    prepared = false;
    if (!turnsSeen) {
      turnsSeen = true;
      startTurnsLesson();
    } else {
      showTeamOrMission();
    }
  }

  function startTurnsLesson() {
    gmode = 'turns';
    setPanel('turns');
    if (dom.toolSkip) dom.toolSkip.hidden = false;
    P.start(LS.get('turns'), {
      onDone: function () {
        if (dom.toolSkip) dom.toolSkip.hidden = true;
        showTeamOrMission();
      }
    });
  }

  function showTeamOrMission() {
    if (!childSide) {
      showTeamCard();
    } else {
      showMissionCard();
    }
  }

  function showTeamCard() {
    gmode = 'team';
    B.setMode('none');
    setPanel(gameId);
    if (dom.toolSkip) dom.toolSkip.hidden = true;
    var theme = B.getTheme();
    function build() {
      var frag = document.createDocumentFragment();
      var row = el('div', 'card-row team-row');
      ['a', 'b'].forEach(function (side) {
        var opt = el('button', 'team-option');
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
    var lineId = 'team-' + B.getTheme() + '-' + side;
    V.say(lineId, function () {});
    showMissionCard();
  }

  var MISSION_LINE = { catch: 'game-catch', race: 'game-race', battle: 'game-battle' };

  function showMissionCard() {
    gmode = 'mission';
    B.setMode('none');
    setPanel(gameId);
    // Set the game's starting position up behind the card, so the picture
    // behind it matches the game about to start.
    prepareGame();
    if (dom.toolSkip) dom.toolSkip.hidden = true;
    var lineId = MISSION_LINE[gameId];
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
    V.say(lineId, function () {});
  }

  /* =====================================================================
   * The game itself
   * ===================================================================*/

  function gameOptions(id) {
    if (id === 'catch') return { type: (FC.app && FC.app.lastNonPawnType) ? FC.app.lastNonPawnType() : 'r' };
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
    if (childSide === 'b') gstate.turn = 'foe';
    goldenKey = pickGoldenKey();
    B.clearAll();
    renderGame();
    showGameTeamBars();
    prepared = true;
  }

  function startGame() {
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
      botTimer = B.later(botTurn, 500);
    }
  }

  /* ---------- selection and the child's move ---------- */

  function clearIdle() { window.clearTimeout(idleTimer); }
  function armIdle() {
    clearIdle();
    idleTimer = window.setTimeout(onIdle, IDLE_MS);
  }
  function onIdle() {
    if (gmode !== 'play' || !gstate || gstate.turn !== 'me' || busy) return;
    if (selected) {
      B.pulseFootprints();
    } else {
      S.play('nudge');
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
    S.play('pick', gstate.board[r][c].type);
  }

  function handleTap(r, c) {
    if (gmode === 'turns') { P.handleTap(r, c); return; }
    if (gmode !== 'play' || !gstate || gstate.over) return;
    if (gstate.turn !== 'me' || busy) {
      B.nudgeMode();
      return;
    }
    armIdle();
    var piece = gstate.board[r][c];
    if (piece && piece.team === 'me') {
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
    } else {
      B.pulseFootprints();
      S.play('bonk');
    }
  }

  function doChildMove(from, mv) {
    busy = true;
    var node = pieceNodes[key(from[0], from[1])];
    node.classList.remove('selected');
    B.hideFootprints(pieceNodes);
    selected = null;
    var to = [mv.r, mv.c];
    var type = gstate.board[from[0]][from[1]].type;
    B.moveHero(node, type, from, to, function () {
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
        V.say('knight-tired', function () {});
      } else if (ev === 'piece-back') {
        V.say('piece-back', function () {});
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
      V.say('turn-me', function () {});
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
    var foeName = B.teamName(theme, otherSide);
    B.setActiveTeamBar('far');
    B.setMode('watch', announce ? B.turnBadgeText(foeName) : modeTextWatch());
    if (announce) V.say('turn-foe', function () {});
    botTimer = B.later(function () {
      var mv = G.botMove(gstate, Math.random);
      if (!mv) {
        gstate.turn = 'me';
        B.setActiveTeamBar('home');
        B.setMode('play', modeTextPlay());
        S.play('your-turn');
        V.say('turn-me', function () {});
        armIdle();
        return;
      }
      var node = pieceNodes[key(mv.from[0], mv.from[1])];
      if (!node) return; // defensive: should never happen
      var type = gstate.board[mv.to[0]][mv.to[1]].type;
      B.moveHero(node, type, mv.from, mv.to, function () {
        commitMove(node, mv.from, mv.to, { captured: mv.captured, events: mv.events }, false);
      });
    }, 600 + Math.floor(Math.random() * 300));
  }

  /* ---------- game over -> Won or Break ---------- */

  function onGameOver() {
    clearIdle();
    resetStreak();
    B.hideFootprints(pieceNodes);
    selected = null;
    S.play('win');
    B.confetti(28);
    var lineId = gstate.id === 'catch' ? 'caught' : gstate.id === 'race' ? 'race-won' : 'won';
    V.say(lineId, function () { showGameWonOrBreak(); });
  }

  function showGameWonOrBreak() {
    if (dueForBreak()) {
      showBreakCard(showGameWon);
    } else {
      showGameWon();
    }
  }

  function nextGameId() {
    var ids = GAMES.map(function (g) { return g.id; });
    return GAMES[(ids.indexOf(gameId) + 1) % GAMES.length].id;
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
        gameId = nextId;
        showMissionCard();
      });
      row.appendChild(next);

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

  /* ---------- break reminder ---------- */

  function onLeaveHome() {
    if (activeSince === null) activeSince = Date.now();
  }
  function onEnterHome() {
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
  function dueForBreak() {
    return !BREAK_OFF && elapsedMs() >= BREAK_MS;
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
      V.say('golden', function () {});
      awardSticker();
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

  function growJar() {
    jarCount = Math.min(jarCount + 1, JAR_MAX);
    updateJarDom();
    if (jarCount >= JAR_MAX) {
      jarCount = 0;
      updateJarDom();
      awardSticker();
    }
  }

  function stickerPieceType() {
    if (gameId === 'catch') return (FC.app && FC.app.lastNonPawnType) ? FC.app.lastNonPawnType() : 'r';
    return 'p';
  }

  function showStickerPop() {
    var host = byId('mission-box');
    if (!host) return;
    var pop = el('div', 'sticker-pop');
    pop.appendChild(B.pieceSvg(stickerPieceType(), 'me'));
    host.appendChild(pop);
    window.setTimeout(function () { pop.remove(); }, 1500);
  }

  function awardSticker() {
    stickers.push({ type: stickerPieceType() });
    V.say('sticker', function () {});
    showStickerPop();
    renderStickerRow();
  }

  /* ---------- stop / lifecycle ---------- */

  function stop() {
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
    pieceNodes = {};
    selected = null;
    busy = false;
    prepared = false;
    clearPanel();
  }

  function onLangChange() {
    renderHomeGames();
    refreshTeamBarLabels();
  }
  function onThemeChange() {
    refreshTeamBarLabels();
  }

  function onSkip() {
    if (gmode === 'turns') {
      P.stop();
      if (dom.toolSkip) dom.toolSkip.hidden = true;
      showTeamOrMission();
    }
  }

  function onReplay() {
    if (gmode === 'turns') startTurnsLesson();
  }

  function init() {
    renderHomeGames();
    updateJarDom();
    renderStickerRow();
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
    stop: stop,
    captureJuice: captureJuice,
    resetStreak: resetStreak,
    maybeGoldenIndex: maybeGoldenIndex,
    markGolden: markGolden,
    dueForBreak: dueForBreak,
    showBreakCard: showBreakCard
  };
})();
