/*
 * Footprint Chess: screen flow (home, meet, lesson, mission, round, won),
 * the side panel, and capture rounds.
 * Depends on FC.rules, FC.levels, FC.lessons, FC.sound, FC.voice, FC.board
 * and FC.player (loaded before this file).
 * DOM is built with createElement/textContent only (see SECURITY.md).
 */
(function () {
  'use strict';

  var FC = window.FC;
  var R = FC.rules;
  var L = FC.levels;
  var LS = FC.lessons;
  var S = FC.sound;
  var V = FC.voice;
  var B = FC.board;
  var P = FC.player;

  var TYPE_ORDER = LS.TYPE_ORDER;
  var svgUse = B.svgUse;
  var place = B.place;
  var replay = B.replay;
  var later = B.later;
  var animate = B.animate;
  var pos = B.pos;

  var IDLE_MS = 5000;

  var dom = {
    app: byId('app'),
    portrait: byId('portrait'),
    goal: byId('goal'),
    tiles: byId('tiles'),
    toolReplay: byId('tool-replay'),
    toolSkip: byId('tool-skip'),
    lang: byId('lang-toggle'),
    langGlyph: byId('lang-glyph'),
    sound: byId('sound-toggle'),
    home: byId('home-toggle'),
    overlay: byId('overlay'),
    card: byId('card'),
    homescreen: byId('homescreen'),
    homeLang: byId('home-lang-toggle'),
    homeLangGlyph: byId('home-lang-glyph'),
    homeSound: byId('home-sound-toggle'),
    homeCards: byId('home-cards')
  };

  var state = {
    type: 'r',
    round: null,
    hero: null,     // hero DOM node (round)
    items: {},       // "r,c" -> DOM node, round targets
    moves: [],
    selected: false,
    busy: false,
    collected: 0,
    idleTimer: null
  };

  // 'home' | 'meet' | 'lesson' | 'mission' | 'round' | 'won'.
  var mode = 'home';
  var seen = {};          // lesson id -> true, once it has started this page load
  var playedTypes = {};    // type -> true, once a round for it has started this page load
  var pendingType = null;   // the type the current meet/lesson step is ultimately leading to
  var cardTap = null;        // fn called when the open card is tapped, or null
  var rerenderCard = null;    // fn that rebuilds the open card's content (language switch)

  /* ---------- helpers ---------- */

  function byId(id) { return document.getElementById(id); }
  function key(r, c) { return r + ',' + c; }
  function clear(node) { node.textContent = ''; }

  function el(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function textEl(tag, className, str) {
    var node = el(tag, className);
    node.textContent = str;
    return node;
  }

  function modeText(m) {
    return LS.UI_TEXT[m === 'play' ? 'turn' : 'watch'][V.getLang()];
  }

  function pieceName(type) { return LS.PIECE_NAMES[V.getLang()][type]; }
  function pieceNameEn(type) { return LS.PIECE_NAMES.en[type]; }

  /* ---------- language ---------- */

  // Simple, dependency-free ?lang= reader: no URLSearchParams needed. English
  // is the default (no param, or an unrecognised value); ?lang=te bookmarks
  // Telugu. FC.voice.setLang falls back to the default for anything else.
  function parseLangFromUrl() {
    var m = /[?&]lang=([^&]*)/.exec(window.location.search || '');
    return m ? decodeURIComponent(m[1]) : null;
  }

  // Shows the OTHER language's glyph: tapping switches to it.
  function langGlyph(lang) {
    return lang === 'te' ? 'A' : 'అ';
  }

  function langName(lang) {
    return lang === 'te' ? 'Telugu' : 'English';
  }

  function updateLangButtons() {
    var lang = V.getLang();
    var glyph = langGlyph(lang);
    var label = 'Language: ' + langName(lang);
    dom.langGlyph.textContent = glyph;
    dom.homeLangGlyph.textContent = glyph;
    dom.lang.setAttribute('aria-label', label);
    dom.homeLang.setAttribute('aria-label', label);
  }

  // Rewrites ?lang= in place, keeping any other query parameters and the
  // hash. English (the default) is expressed by leaving the param out
  // entirely, so a bookmark for it stays a plain URL.
  function setUrlLang(lang) {
    if (!window.history || typeof window.history.replaceState !== 'function') return;
    try {
      var raw = window.location.search ? window.location.search.slice(1) : '';
      var kept = raw.split('&').filter(function (p) {
        return p && p.split('=')[0] !== 'lang';
      });
      if (lang !== LS.DEFAULT_LANG) {
        kept.push('lang=' + encodeURIComponent(lang));
      }
      var search = kept.length ? '?' + kept.join('&') : '';
      window.history.replaceState(null, '', window.location.pathname + search + window.location.hash);
    } catch (e) {
      // Bookmarkable URL is a nicety, not required; ignore failures.
    }
  }

  function onLangToggle() {
    S.unlock();
    var next = V.getLang() === 'te' ? 'en' : 'te';
    V.setLang(next);
    updateLangButtons();
    if (B.getMode() !== 'none') B.setMode(B.getMode(), modeText(B.getMode()));
    setUrlLang(next);
    renderTiles();
    if (!dom.homescreen.hidden) renderHomeCards();
    if (rerenderCard) rerenderCard();
    // Load the current lesson's lines first, then everything else.
    var lesson = P.active() ? P.lesson() : null;
    if (lesson) {
      V.preload(LS.lineIds(lesson).concat(LS.PRACTICE_LINES), function () {});
    }
    V.preloadAll();
    S.play('select');
  }

  /* ---------- sound ---------- */

  function updateSoundButtons() {
    var on = S.isEnabled();
    [dom.sound, dom.homeSound].forEach(function (btn) {
      clear(btn);
      btn.appendChild(svgUse(on ? 'ic-sound-on' : 'ic-sound-off'));
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function onSoundToggle() {
    S.unlock();
    S.setEnabled(!S.isEnabled());
    updateSoundButtons();
    if (S.isEnabled()) S.play('select');
  }

  /* ---------- static tool icons ---------- */

  function buildToolIcons() {
    dom.toolReplay.appendChild(svgUse('again'));
    dom.toolSkip.appendChild(svgUse('ic-skip'));
    dom.home.appendChild(svgUse('house'));
  }

  function updateToolButtons() {
    dom.toolSkip.hidden = !(mode === 'meet' || mode === 'lesson');
  }

  /* ---------- side panel: mission box ---------- */

  function setPortrait(type) {
    clear(dom.portrait);
    dom.portrait.className = 'portrait type-' + type;
    dom.portrait.appendChild(svgUse('robots-' + type));
  }

  function resetSlots() {
    clear(dom.goal);
    for (var i = 0; i < L.TARGET_COUNT; i++) {
      var slot = el('div', 'cap-slot');
      slot.appendChild(svgUse('robots-p-dark'));
      dom.goal.appendChild(slot);
    }
  }

  function updateSlots(popIndex) {
    var slots = dom.goal.children;
    for (var i = 0; i < slots.length; i++) {
      if (i === popIndex) {
        replay(slots[i], 'on');
      } else {
        slots[i].classList.toggle('on', i < state.collected);
      }
    }
  }

  /* ---------- side panel: piece tiles ---------- */

  function renderTiles() {
    clear(dom.tiles);
    TYPE_ORDER.forEach(function (type) {
      var active = type === state.type;
      var tile = el('button', 'tile type-' + type + (active ? ' active' : ''));
      tile.type = 'button';
      var badge = el('div', 'tile-badge');
      badge.appendChild(svgUse('cl-' + type));
      tile.appendChild(badge);
      var bot = svgUse('robots-' + type);
      bot.classList.add('bot');
      tile.appendChild(bot);
      tile.appendChild(textEl('div', 'tile-name', pieceName(type)));
      tile.setAttribute('aria-label', pieceNameEn(type));
      tile.setAttribute('aria-pressed', active ? 'true' : 'false');
      tile.addEventListener('click', function () { choosePiece(type); });
      dom.tiles.appendChild(tile);
    });
  }

  /* ---------- home screen ---------- */

  function suggestedType() {
    for (var i = 0; i < TYPE_ORDER.length; i++) {
      if (!playedTypes[TYPE_ORDER[i]]) return TYPE_ORDER[i];
    }
    return TYPE_ORDER[0];
  }

  function renderHomeCards() {
    clear(dom.homeCards);
    var suggested = suggestedType();
    TYPE_ORDER.forEach(function (type) {
      var isSuggested = type === suggested;
      var card = el('button', 'home-card' + (isSuggested ? ' suggested' : ''));
      card.type = 'button';
      var cl = el('div', 'home-card-cl');
      cl.appendChild(svgUse('cl-' + type));
      card.appendChild(cl);
      var bot = svgUse('robots-' + type);
      bot.classList.add('bot');
      card.appendChild(bot);
      card.appendChild(el('div', 'base tint-' + type));
      card.appendChild(textEl('div', 'home-name', pieceName(type)));
      if (isSuggested) {
        var badge = el('div', 'home-card-badge');
        badge.appendChild(svgUse('play-tri'));
        card.appendChild(badge);
      }
      card.setAttribute('aria-label', pieceNameEn(type));
      card.addEventListener('click', function () {
        hideHomeScreen();
        choosePiece(type);
      });
      dom.homeCards.appendChild(card);
    });
  }

  function showHomeScreen() {
    B.setMode('none');
    P.stop();
    clearIdle();
    B.hideHand();
    hideOverlay();
    mode = 'home';
    updateToolButtons();
    renderHomeCards();
    dom.homescreen.hidden = false;
  }

  function hideHomeScreen() {
    dom.homescreen.hidden = true;
  }

  /* ---------- overlay: dim + card ---------- */

  // Bumped every time the open card is abandoned (hidden), so a Meet card's
  // own pending timer or voice callback can never fire after the child has
  // moved on to something else (Home, a different piece, Skip): each card
  // captures the token's value when it opens and checks it before acting.
  var cardToken = 0;

  function showOverlay() {
    dom.overlay.hidden = false;
  }

  function hideOverlay() {
    cardToken += 1;
    dom.overlay.hidden = true;
    clear(dom.card);
    cardTap = null;
    rerenderCard = null;
  }

  function onCardActivate() {
    if (cardTap) cardTap();
  }

  /* ---------- meet card ---------- */

  function meetContent(type) {
    var frag = document.createDocumentFragment();
    var row = el('div', 'card-row');
    var realBox = el('div', 'meet-real');
    realBox.appendChild(svgUse('cl-' + type));
    row.appendChild(realBox);
    var arrow = svgUse('arrow');
    arrow.classList.add('meet-arrow');
    row.appendChild(arrow);
    var portrait = el('div', 'portrait card-portrait meet type-' + type);
    portrait.appendChild(svgUse('robots-' + type));
    row.appendChild(portrait);
    frag.appendChild(row);

    var name = el('div', 'big-name');
    name.appendChild(document.createTextNode(pieceName(type)));
    if (V.getLang() !== LS.DEFAULT_LANG) {
      name.appendChild(textEl('span', 'sub', pieceNameEn(type)));
    }
    frag.appendChild(name);
    return frag;
  }

  var MEET_MIN_MS = 2500;

  function showMeet(type, onContinue) {
    B.setMode('none');
    hideOverlay();
    var myToken = cardToken;
    B.clearAll();
    mode = 'meet';
    pendingType = type;
    updateToolButtons();

    function build() {
      clear(dom.card);
      dom.card.appendChild(meetContent(type));
    }
    build();
    rerenderCard = build;

    var advanced = false;
    function advance() {
      if (advanced || myToken !== cardToken) return;
      advanced = true;
      hideOverlay();
      onContinue();
    }
    cardTap = advance;
    showOverlay();

    var lineDone = false;
    var minWaited = false;
    function maybeAuto() {
      if (lineDone && minWaited) advance();
    }
    V.say('meet-' + type, function () { lineDone = true; maybeAuto(); });
    later(function () { minWaited = true; maybeAuto(); }, MEET_MIN_MS);
  }

  /* ---------- mission card ---------- */

  function missionContent(type) {
    var frag = document.createDocumentFragment();
    var row = el('div', 'card-row');
    var portrait = el('div', 'portrait card-portrait type-' + type);
    portrait.appendChild(svgUse('robots-' + type));
    row.appendChild(portrait);
    row.appendChild(textEl('div', 'plus', '+'));
    var pawns = el('div', 'pawns3');
    for (var i = 0; i < L.TARGET_COUNT; i++) pawns.appendChild(svgUse('robots-p-dark'));
    row.appendChild(pawns);
    frag.appendChild(row);

    frag.appendChild(textEl('div', 'caption', LS.LINES.mission[V.getLang()]));

    var go = el('button', 'go-btn');
    go.type = 'button';
    go.setAttribute('aria-label', LS.LINES.mission.en);
    go.appendChild(svgUse('play-tri'));
    frag.appendChild(go);
    return frag;
  }

  function showMission(type, onStart) {
    B.setMode('none');
    hideOverlay();
    B.clearAll();
    mode = 'mission';
    pendingType = type;
    updateToolButtons();

    function build() {
      clear(dom.card);
      dom.card.appendChild(missionContent(type));
    }
    build();
    rerenderCard = build;

    var started = false;
    function start() {
      if (started) return;
      started = true;
      hideOverlay();
      onStart();
    }
    cardTap = start;
    showOverlay();
    V.say('mission', function () {});
  }

  /* ---------- won card ---------- */

  function wonContent(type, nextType) {
    var frag = document.createDocumentFragment();
    var trophy = el('div', 'trophy');
    trophy.appendChild(el('div', 'ray'));
    trophy.appendChild(svgUse('robots-' + type));
    frag.appendChild(trophy);

    var pawns = el('div', 'pawns3');
    for (var i = 0; i < L.TARGET_COUNT; i++) pawns.appendChild(svgUse('robots-p-dark'));
    frag.appendChild(pawns);

    var row = el('div', 'btn-row');
    var again = el('button', 'rbtn rbtn-again');
    again.type = 'button';
    again.setAttribute('aria-label', 'Play again');
    again.appendChild(svgUse('again'));
    row.appendChild(again);

    var next = el('button', 'rbtn rbtn-next type-' + nextType);
    next.type = 'button';
    next.setAttribute('aria-label', 'Next piece: ' + pieceNameEn(nextType));
    next.appendChild(svgUse('robots-' + nextType));
    row.appendChild(next);

    var home = el('button', 'rbtn rbtn-home');
    home.type = 'button';
    home.setAttribute('aria-label', 'Home');
    home.appendChild(svgUse('house'));
    row.appendChild(home);

    frag.appendChild(row);
    return { frag: frag, again: again, next: next, home: home };
  }

  function showWon(type) {
    B.setMode('none');
    mode = 'won';
    updateToolButtons();
    var nextType = TYPE_ORDER[(TYPE_ORDER.indexOf(type) + 1) % TYPE_ORDER.length];

    function build() {
      clear(dom.card);
      var parts = wonContent(type, nextType);
      dom.card.appendChild(parts.frag);
      parts.again.addEventListener('click', function (e) {
        e.stopPropagation();
        onWonAgain(type);
      });
      parts.next.addEventListener('click', function (e) {
        e.stopPropagation();
        onWonNext(nextType);
      });
      parts.home.addEventListener('click', function (e) {
        e.stopPropagation();
        onWonHome();
      });
    }
    build();
    rerenderCard = build;
    cardTap = null;
    showOverlay();
    B.screenConfetti(40);
    V.say('next', function () {});
  }

  function onWonAgain(type) {
    S.unlock();
    hideOverlay();
    playOrRound(type);
  }

  function onWonNext(type) {
    S.unlock();
    hideOverlay();
    playOrRound(type);
  }

  function onWonHome() {
    S.unlock();
    hideOverlay();
    showHomeScreen();
  }

  /* ---------- piece flow: home/tile tap -> hello -> meet -> lesson -> capture lesson -> mission -> round ---------- */

  function choosePiece(type) {
    S.unlock();
    pendingType = type;
    if (!seen.hello) {
      playLessonScreen(LS.get('hello'), function () { playOrRound(type); });
    } else {
      playOrRound(type);
    }
  }

  function playOrRound(type) {
    pendingType = type;
    state.type = type;
    renderTiles();
    setPortrait(type);
    resetSlots();

    var lessonId = LS.lessonFor(type);
    if (!seen[lessonId]) {
      showMeet(type, function () {
        playLessonScreen(LS.get(lessonId), function () { afterPieceLesson(type); });
      });
    } else {
      afterPieceLesson(type);
    }
  }

  function afterPieceLesson(type) {
    var capId = LS.captureLessonFor(type);
    if (!seen[capId]) {
      playLessonScreen(LS.get(capId), function () { showMissionThenRound(type); });
    } else {
      showMissionThenRound(type);
    }
  }

  function showMissionThenRound(type) {
    showMission(type, function () { startRound(type); });
  }

  function playLessonScreen(lesson, onDone) {
    mode = 'lesson';
    updateToolButtons();
    seen[lesson.id] = true;
    P.start(lesson, { onDone: onDone });
  }

  function onReplay() {
    S.unlock();
    var type = state.type;
    showMeet(type, function () {
      playLessonScreen(LS.get(LS.lessonFor(type)), function () { afterPieceLesson(type); });
    });
  }

  function onSkip() {
    if (mode !== 'meet' && mode !== 'lesson') return;
    S.unlock();
    var type = pendingType || state.type;
    P.stop();
    hideOverlay();
    seen[LS.lessonFor(type)] = true;
    seen[LS.captureLessonFor(type)] = true;
    if (type !== state.type) {
      state.type = type;
      renderTiles();
      setPortrait(type);
    }
    showMissionThenRound(type);
  }

  /* ---------- capture rounds ---------- */

  function startRound(type) {
    clearIdle();
    mode = 'round';
    updateToolButtons();
    playedTypes[type] = true;
    state.type = type;
    state.round = L.createCaptureRound(type, Math.random);
    state.collected = 0;
    state.selected = false;
    state.moves = [];
    state.busy = false;
    state.items = {};
    B.clearAll();
    // Rounds are always the child's turn.
    B.setMode('play', modeText('play'));
    S.play('your-turn');
    renderTiles();
    setPortrait(type);
    resetSlots();

    var hr = state.round.hero;
    state.hero = B.addPiece(type, hr[0], hr[1]);
    state.round.targets.forEach(function (t) {
      var node = B.addItem(t[0], t[1]);
      node.classList.add('round-target');
      state.items[key(t[0], t[1])] = node;
    });
    replay(state.hero, 'enter');
    armIdle();
  }

  function select(silent) {
    var h = state.round.hero;
    state.selected = true;
    state.moves = R.movesFor(state.round.board, h[0], h[1]);
    state.hero.classList.add('selected');
    replay(state.hero, 'bounce');
    B.showFootprints(state.type, h, state.moves, state.items);
    if (!silent) S.play('select');
  }

  function findMove(r, c) {
    for (var i = 0; i < state.moves.length; i++) {
      if (state.moves[i].r === r && state.moves[i].c === c) return state.moves[i];
    }
    return null;
  }

  function move(mv) {
    state.busy = true;
    state.selected = false;
    B.hideFootprints(state.items);
    state.hero.classList.remove('selected');

    var from = state.round.hero;
    var to = [mv.r, mv.c];

    B.moveHero(state.hero, state.type, from, to, function () {
      land(from, to, mv);
    });
  }

  function land(from, to) {
    var board = state.round.board;
    board[to[0]][to[1]] = board[from[0]][from[1]];
    board[from[0]][from[1]] = null;
    state.round.hero = to;

    var idx = -1;
    state.round.targets.forEach(function (t, i) {
      if (t[0] === to[0] && t[1] === to[1]) idx = i;
    });
    if (idx >= 0) {
      state.round.targets.splice(idx, 1);
      captureAt(to[0], to[1]);
    }

    if (state.round.targets.length === 0) {
      celebrate();
      return;
    }

    var changes = L.relocateStranded(state.round);
    changes.forEach(moveItem);

    later(function () {
      state.busy = false;
      select(true);
      armIdle();
    }, changes.length ? 650 : 120);
  }

  function captureAt(r, c) {
    var node = state.items[key(r, c)];
    delete state.items[key(r, c)];
    if (node) B.poof(node);
    B.sparkle(r, c, 0);
    state.collected += 1;
    updateSlots(state.collected - 1);
    S.play('capture');
  }

  // A target that can no longer be reached floats to a square that can.
  function moveItem(change) {
    var node = state.items[key(change.from[0], change.from[1])];
    delete state.items[key(change.from[0], change.from[1])];
    if (!node) return;
    if (!change.to) {
      node.remove();
      state.collected += 1;
      updateSlots(state.collected - 1);
      return;
    }
    var f = change.from;
    var t = change.to;
    state.items[key(t[0], t[1])] = node;
    place(node, t[0], t[1]);
    animate(node, [
      { transform: pos(f[0], f[1]) + ' scale(1)', opacity: 1 },
      { transform: pos(f[0], f[1]) + ' scale(0.2)', opacity: 0, offset: 0.45 },
      { transform: pos(t[0], t[1]) + ' scale(0.2)', opacity: 0, offset: 0.55 },
      { transform: pos(t[0], t[1]) + ' scale(1)', opacity: 1 }
    ], 600, 'ease-in-out');
  }

  function celebrate() {
    clearIdle();
    replay(state.hero, 'cheer');
    S.play('win');
    B.confetti(28);
    var type = state.type;
    V.say('won', function () { showWon(type); });
  }

  /* ---------- round idle hints ---------- */

  function clearIdle() {
    window.clearTimeout(state.idleTimer);
  }

  function armIdle() {
    clearIdle();
    state.idleTimer = window.setTimeout(onIdle, IDLE_MS);
  }

  function onIdle() {
    if (!state.round || state.busy) return;
    if (state.selected) {
      B.pulseFootprints();
      V.say('hint-pawn', function () {});
    } else {
      replay(state.hero, 'nudge');
      V.say('tap-piece', function () {});
    }
    armIdle();
  }

  function onRoundTap(r, c) {
    if (!state.round || state.busy) return;
    armIdle();

    var hero = state.round.hero;
    if (r === hero[0] && c === hero[1]) {
      select(false);
      return;
    }
    if (!state.selected) {
      replay(state.hero, 'nudge');
      S.play('nudge');
      return;
    }
    var mv = findMove(r, c);
    if (mv) {
      move(mv);
    } else {
      replay(state.hero, 'wiggle');
      B.pulseFootprints();
      S.play('bonk');
    }
  }

  /* ---------- board taps ---------- */

  function onBoardTap(r, c) {
    if (mode === 'lesson') {
      P.handleTap(r, c);
      return;
    }
    if (mode === 'round') {
      onRoundTap(r, c);
    }
    // 'home', 'meet', 'mission' and 'won' cover the board with an opaque or
    // dimmed layer, so board taps are not expected to reach here in those
    // modes; ignoring them is a safe fallback either way.
  }

  /* ---------- first tap anywhere: unlock audio, greet once ---------- */

  function armFirstTapListener() {
    var done = false;
    function onFirst() {
      if (done) return;
      done = true;
      S.unlock();
      V.preloadAll();
      V.say('pick', function () {});
      document.removeEventListener('pointerdown', onFirst, true);
    }
    document.addEventListener('pointerdown', onFirst, true);
  }

  /* ---------- wiring ---------- */

  function wireTools() {
    dom.toolReplay.addEventListener('click', onReplay);
    dom.toolSkip.addEventListener('click', onSkip);
    dom.lang.addEventListener('click', onLangToggle);
    dom.homeLang.addEventListener('click', onLangToggle);
    dom.sound.addEventListener('click', onSoundToggle);
    dom.homeSound.addEventListener('click', onSoundToggle);
    dom.home.addEventListener('click', function () {
      S.unlock();
      showHomeScreen();
    });
    dom.card.addEventListener('click', onCardActivate);
    dom.card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onCardActivate();
      }
    });
  }

  /* ---------- start ---------- */

  function init() {
    V.setLang(parseLangFromUrl());
    B.init(onBoardTap);
    buildToolIcons();
    wireTools();
    updateLangButtons();
    updateSoundButtons();
    renderTiles();
    setPortrait(state.type);
    resetSlots();
    P.prepare(LS.get('hello'));
    showHomeScreen();
    armFirstTapListener();
  }

  init();
})();
