/*
 * Footprint Chess: screen flow (who's playing, home, sticker book, meet,
 * lesson, mission, round, won), the side panel, capture rounds, and the
 * progress store (js/store.js: the children, their progress and settings).
 * Depends on FC.rules, FC.levels, FC.lessons, FC.store, FC.sound, FC.voice,
 * FC.board, FC.player, FC.stickers, FC.profileUI, FC.bookUI and
 * FC.grownupsUI (loaded before this file).
 * DOM is built with createElement/textContent only (see SECURITY.md).
 */
(function () {
  'use strict';

  var FC = window.FC;
  var R = FC.rules;
  var L = FC.levels;
  var LS = FC.lessons;
  var TH = FC.themes;
  var LG = FC.langs;
  var S = FC.sound;
  var V = FC.voice;
  var B = FC.board;
  var P = FC.player;
  var PATH = FC.path;

  var TYPE_ORDER = LS.TYPE_ORDER;
  var svgUse = B.svgUse;
  var pieceSvg = B.pieceSvg;
  var place = B.place;
  var replay = B.replay;
  var later = B.later;
  var animate = B.animate;
  var pos = B.pos;

  var IDLE_MS = 5000;

  var STORE = FC.store;

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
    bookToggle: byId('book-toggle'),
    themeToggle: byId('theme-toggle'),
    themeRow: byId('theme-row'),
    langRow: byId('lang-row')
  };

  // Bumped by stopRound(): every callback a round schedules (a move's
  // landing, the pause before the next turn, the win line) captures the
  // value when it is scheduled and does nothing if it has changed, so
  // leaving a round (Home, another piece, Replay, Skip, a game) can never be
  // followed by a stray move, hint or Won card.
  var roundToken = 0;

  var state = {
    type: 'r',
    round: null,
    hero: null,     // hero DOM node (round)
    items: {},       // "r,c" -> DOM node, round targets
    moves: [],
    selected: false,
    busy: false,
    collected: 0,
    goldenKey: null,
    idleTimer: null
  };

  // 'home' | 'meet' | 'lesson' | 'mission' | 'round' | 'won'. ('home' also
  // covers Who's playing and the sticker book.)
  var mode = 'home';
  var store = null;         // the progress store (js/store.js), made at startup
  var activeProfileId = null; // the child whose language, theme and progress are loaded
  var EMPTY_PROGRESS = { seen: {}, met: {}, stickers: {}, jar: 0, teams: {}, wins: {}, done: {}, last: null, practise: {}, lang: null, theme: null };
  // A copy of the current child's progress, refreshed after every change
  // to the store: seen (lesson id -> true) and met (piece type -> true) are
  // read from here.
  var progress = EMPTY_PROGRESS;
  var pendingType = null;   // the type the current meet/lesson step is ultimately leading to
  var cardTap = null;        // fn called when the open card is tapped, or null
  var rerenderCard = null;    // fn that rebuilds the open card's content (language switch)

  /* ---------- helpers ---------- */

  function byId(id) { return document.getElementById(id); }
  function key(r, c) { return r + ',' + c; }

  // decodeURIComponent throws on malformed input such as "%E0" or "%"; a
  // bad address must never stop the app starting, so it reads as "absent".
  function safeDecode(str) {
    try {
      return decodeURIComponent(str);
    } catch (e) {
      return null;
    }
  }
  function clear(node) { node.textContent = ''; }

  function refreshProgress() {
    progress = (store && store.progress()) || EMPTY_PROGRESS;
  }
  function isSeen(id) { return !!progress.seen[id]; }
  function markSeen(id) { store.markSeen(id); }

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
  // The default language's name, used for aria-labels and the Meet card's sub-name.
  function pieceNameEn(type) { return LS.PIECE_NAMES[LS.DEFAULT_LANG][type]; }

  /* ---------- language ---------- */

  // Simple, dependency-free ?lang= reader: no URLSearchParams needed. The
  // default language (English) is used for no param or an unrecognised
  // value; ?lang=<id> bookmarks any language of the registry (js/langs.js),
  // for example ?lang=te for Telugu. FC.voice.setLang falls back to the
  // default for anything else.
  function parseLangFromUrl() {
    var m = /[?&]lang=([^&]*)/.exec(window.location.search || '');
    return m ? safeDecode(m[1]) : null;
  }

  // With exactly two languages the language button switches to the other
  // one, so its glyph shows the language you would switch to. With three or
  // more it opens the language row (see buildLangRow), so its glyph shows
  // the current language. The aria-label is always "Language: <name>" of the
  // current language.
  function langButtonGlyph(lang) {
    var shown = LG.LANGUAGES.length === 2 ? LG.get(LG.next(lang)) : LG.get(lang);
    return shown ? shown.glyph : '';
  }

  function langName(lang) {
    var entry = LG.get(lang);
    return entry ? entry.name : lang;
  }

  function updateLangButtons() {
    var lang = V.getLang();
    var glyph = langButtonGlyph(lang);
    var label = 'Language: ' + langName(lang);
    dom.langGlyph.textContent = glyph;
    dom.homeLangGlyph.textContent = glyph;
    dom.lang.setAttribute('aria-label', label);
    dom.homeLang.setAttribute('aria-label', label);
    markLangRow();
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

  // The language row (three or more languages only): one round button per
  // registry language showing its glyph, with the language's name as an
  // aria-label; the current one is ringed. Built afresh each time it opens.
  function buildLangRow() {
    clear(dom.langRow);
    LG.LANGUAGES.forEach(function (lang) {
      var btn = el('button', 'lang-choice');
      btn.type = 'button';
      btn.setAttribute('aria-label', lang.name);
      btn.appendChild(textEl('span', 'lang-glyph', lang.glyph));
      btn.addEventListener('click', function () { onLangChoose(lang.id); });
      dom.langRow.appendChild(btn);
    });
    markLangRow();
  }

  function markLangRow() {
    var current = V.getLang();
    var kids = dom.langRow.children;
    for (var i = 0; i < kids.length; i++) {
      var on = LG.LANGUAGES[i] && LG.LANGUAGES[i].id === current;
      kids[i].classList.toggle('selected', !!on);
      kids[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  function hideLangRow() {
    dom.langRow.hidden = true;
  }

  function onLangToggle() {
    S.unlock();
    if (LG.LANGUAGES.length > 2) {
      // The language row and the theme row share a spot: one at a time.
      var hidden = dom.langRow.hidden;
      if (hidden) buildLangRow();
      dom.langRow.hidden = !hidden;
      if (hidden) dom.themeRow.hidden = true;
      return;
    }
    switchLang(LG.next(V.getLang()));
  }

  function onLangChoose(id) {
    S.unlock();
    hideLangRow();
    if (id === V.getLang()) {
      S.play('select');
      return;
    }
    switchLang(id);
  }

  function switchLang(next) {
    V.setLang(next);
    store.setLang(V.getLang());
    updateLangButtons();
    if (B.getMode() !== 'none') B.setMode(B.getMode(), modeText(B.getMode()));
    setUrlLang(next);
    renderTiles();
    if (!dom.homescreen.hidden) FC.pathUI.refresh();
    if (rerenderCard) rerenderCard();
    if (FC.gamesUI && FC.gamesUI.onLangChange) FC.gamesUI.onLangChange();
    // Load the current lesson's lines first, then everything else.
    var lesson = P.active() ? P.lesson() : null;
    if (lesson) {
      V.preload(LS.lineIds(lesson).concat(LS.PRACTICE_LINES), function () {});
    }
    V.preloadAll();
    S.play('select');
  }

  /* ---------- theme ---------- */

  // Same approach as parseLangFromUrl/setUrlLang: ?theme=<id> is read once
  // at startup and rewritten in place when it changes, keeping any other
  // query parameters. An unknown or missing id falls back to the default
  // theme (B.setTheme already does this); nothing is ever stored.
  function parseThemeFromUrl() {
    var m = /[?&]theme=([^&]*)/.exec(window.location.search || '');
    return m ? safeDecode(m[1]) : null;
  }

  function setUrlTheme(id) {
    if (!window.history || typeof window.history.replaceState !== 'function') return;
    try {
      var raw = window.location.search ? window.location.search.slice(1) : '';
      var kept = raw.split('&').filter(function (p) {
        return p && p.split('=')[0] !== 'theme';
      });
      if (id !== TH.DEFAULT_THEME) {
        kept.push('theme=' + encodeURIComponent(id));
      }
      var search = kept.length ? '?' + kept.join('&') : '';
      window.history.replaceState(null, '', window.location.pathname + search + window.location.hash);
    } catch (e) {
      // Bookmarkable URL is a nicety, not required; ignore failures.
    }
  }

  // The theme row: one round swatch per theme, each showing that theme's
  // knight (side me) on that theme's own background. No text anywhere (a
  // theme's English name is an aria-label only, never shown), so the row
  // can be built once and just re-marked for the selected ring afterwards.
  function buildThemeRow() {
    clear(dom.themeRow);
    TH.THEMES.forEach(function (theme) {
      var sw = el('button', 'theme-swatch theme-' + theme.id);
      sw.type = 'button';
      sw.setAttribute('aria-label', theme.name);
      var knight = B.themedPieceSvg(theme.id, 'n', 'me');
      sw.appendChild(knight);
      sw.addEventListener('click', function () { onThemeChoose(theme.id); });
      dom.themeRow.appendChild(sw);
    });
    markThemeRow();
  }

  function markThemeRow() {
    var current = B.getTheme();
    var kids = dom.themeRow.children;
    for (var i = 0; i < kids.length; i++) {
      kids[i].classList.toggle('selected', kids[i].classList.contains('theme-' + current));
    }
  }

  function onThemeToggle() {
    S.unlock();
    var hidden = dom.themeRow.hidden;
    if (hidden && !dom.themeRow.children.length) buildThemeRow();
    dom.themeRow.hidden = !hidden;
    if (!dom.themeRow.hidden) {
      markThemeRow();
      hideLangRow();
    }
  }

  function onThemeChoose(id) {
    S.unlock();
    B.setTheme(id);
    S.setTheme(B.getTheme());
    store.setTheme(B.getTheme());
    setUrlTheme(B.getTheme());
    dom.themeRow.hidden = true;
    S.play('select');
    if (FC.gamesUI && FC.gamesUI.onThemeChange) FC.gamesUI.onThemeChange();
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
    dom.themeToggle.appendChild(svgUse('ic-palette'));
    dom.bookToggle.appendChild(svgUse('ic-book'));
  }

  function updateToolButtons() {
    dom.toolSkip.hidden = !(mode === 'meet' || mode === 'lesson');
  }

  /* ---------- side panel: mission box ---------- */

  function setPortrait(type) {
    clear(dom.portrait);
    dom.portrait.className = 'portrait type-' + type;
    dom.portrait.appendChild(pieceSvg(type, 'me'));
  }

  function resetSlots() {
    clear(dom.goal);
    for (var i = 0; i < L.TARGET_COUNT; i++) {
      var slot = el('div', 'cap-slot');
      slot.appendChild(pieceSvg('p', 'foe'));
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
      var bot = pieceSvg(type, 'me');
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

  // Starts a step of the learning journey (js/path.js), from Home or from a
  // Won card's "next" button. A piece plays its lessons (the first time)
  // and its capture round; Taking turns plays that lesson and then Catch the
  // knight; a game starts the usual way (its lesson the first time, the Team
  // card for a team game, the Mission card).
  function startStop(id) {
    S.unlock();
    if (PATH.kindOf(id) === 'piece') {
      hideOverlay();
      hideHomeScreen();
      choosePiece(id);
    } else if (FC.gamesUI && FC.gamesUI.openFromPath) {
      hideOverlay();
      stopRound();
      FC.gamesUI.openFromPath(id);
    }
  }

  // Stops whatever is going on (a game, a lesson, a round, a card) before
  // a full-screen screen (Home, Who's playing, the sticker book) shows.
  function goIdle() {
    if (FC.gamesUI && FC.gamesUI.stop) FC.gamesUI.stop();
    B.setMode('none');
    P.stop();
    stopRound();
    B.hideHand();
    hideOverlay();
    mode = 'home';
    updateToolButtons();
    hideLangRow();
    dom.themeRow.hidden = true;
  }

  function hideScreens() {
    FC.pathUI.leave();
    dom.homescreen.hidden = true;
    FC.profileUI.hide();
    FC.bookUI.close();
  }

  function showHomeScreen() {
    goIdle();
    hideScreens();
    FC.profileUI.renderChip();
    dom.homescreen.hidden = false;
    // Drawn once Home is visible, so the path can measure its area.
    FC.pathUI.render();
    if (FC.gamesUI && FC.gamesUI.onEnterHome) FC.gamesUI.onEnterHome();
  }

  // Who's playing: at startup when there are two or more children, and from
  // the child's picture on Home. Said aloud once audio is unlocked (the very
  // first tap of the page unlocks it; see armFirstTapListener).
  function showWho() {
    goIdle();
    hideScreens();
    FC.profileUI.show();
    if (FC.gamesUI && FC.gamesUI.onEnterHome) FC.gamesUI.onEnterHome();
    if (S.context()) V.say('who', function () {});
  }

  function showBook() {
    S.unlock();
    dom.homescreen.hidden = true;
    dom.themeRow.hidden = true;
    hideLangRow();
    FC.bookUI.open();
  }

  function onChip() {
    S.unlock();
    showWho();
  }

  function hideHomeScreen() {
    FC.pathUI.leave();
    dom.homescreen.hidden = true;
    dom.themeRow.hidden = true;
    hideLangRow();
    if (FC.gamesUI && FC.gamesUI.onLeaveHome) FC.gamesUI.onLeaveHome();
  }

  // A minimal custom card, reusing the same #overlay/#card machinery as the
  // Meet/Mission/Won cards above, so js/games-ui.js's Team/Mission/Won/Break
  // cards stay tappable (the card's one click/keydown listener, wired once
  // in wireTools, always calls whatever onCardActivate finds in cardTap)
  // without games-ui.js needing to know anything about that machinery.
  // build() returns a fresh DocumentFragment/Node each time it is called
  // (also used to rebuild the card on a language switch, see rerenderCard).
  function showCustomCard(build, onTap) {
    hideOverlay();
    function rebuild() {
      clear(dom.card);
      dom.card.appendChild(build());
    }
    rebuild();
    rerenderCard = rebuild;
    // Matches every other card above (showMeet's advance, showMission's
    // start): the tap that activates the card hides it first, then runs
    // the callback, so games-ui.js's callbacks don't each have to remember
    // to hide the overlay themselves.
    cardTap = onTap ? function () { hideOverlay(); onTap(); } : null;
    showOverlay();
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
    portrait.appendChild(pieceSvg(type, 'me'));
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
    // Pacing (the card stays up long enough to read), so reduced motion
    // must not shorten it.
    B.wait(function () { minWaited = true; maybeAuto(); }, MEET_MIN_MS);
  }

  /* ---------- mission card ---------- */

  function missionContent(type) {
    var frag = document.createDocumentFragment();
    var row = el('div', 'card-row');
    var portrait = el('div', 'portrait card-portrait type-' + type);
    portrait.appendChild(pieceSvg(type, 'me'));
    row.appendChild(portrait);
    row.appendChild(textEl('div', 'plus', '+'));
    var pawns = el('div', 'pawns3');
    for (var i = 0; i < L.TARGET_COUNT; i++) pawns.appendChild(pieceSvg('p', 'foe'));
    row.appendChild(pawns);
    frag.appendChild(row);

    frag.appendChild(textEl('div', 'caption', LS.LINES.mission[V.getLang()]));

    var go = el('button', 'go-btn');
    go.type = 'button';
    go.setAttribute('aria-label', LS.LINES.mission[LS.DEFAULT_LANG]);
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

  function wonContent(type, nextId) {
    var frag = document.createDocumentFragment();
    var trophy = el('div', 'trophy');
    trophy.appendChild(el('div', 'ray'));
    trophy.appendChild(pieceSvg(type, 'me'));
    frag.appendChild(trophy);

    var pawns = el('div', 'pawns3');
    for (var i = 0; i < L.TARGET_COUNT; i++) pawns.appendChild(pieceSvg('p', 'foe'));
    frag.appendChild(pawns);

    var row = el('div', 'btn-row');
    var again = el('button', 'rbtn rbtn-again');
    again.type = 'button';
    again.setAttribute('aria-label', 'Play again');
    again.appendChild(svgUse('again'));
    row.appendChild(again);

    var next = el('button', 'rbtn rbtn-path');
    next.type = 'button';
    next.setAttribute('aria-label', 'Next: ' + FC.pathUI.captionEn(nextId));
    next.appendChild(FC.pathUI.stopPic(nextId, true));
    var play = el('div', 'stop-play');
    play.appendChild(svgUse('play-tri'));
    next.appendChild(play);
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
    // Break reminder (js/games-ui.js): shared by piece rounds and games -
    // at the next Won card after about 15 minutes of active play, a calm
    // Break card shows instead; "keep playing" resets the timer and shows
    // this same Won card.
    if (FC.gamesUI && FC.gamesUI.dueForBreak && FC.gamesUI.dueForBreak()) {
      FC.gamesUI.showBreakCard(function () { showWon(type); });
      return;
    }
    B.setMode('none');
    mode = 'won';
    updateToolButtons();
    // This piece's step on the path is done (a won capture round).
    store.markDone(type);
    var nextId = PATH.nextAfter(store.progress(), type);

    function build() {
      clear(dom.card);
      var parts = wonContent(type, nextId);
      dom.card.appendChild(parts.frag);
      parts.again.addEventListener('click', function (e) {
        e.stopPropagation();
        onWonAgain(type);
      });
      parts.next.addEventListener('click', function (e) {
        e.stopPropagation();
        onWonNext(nextId);
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

  function onWonNext(id) {
    startStop(id);
  }

  function onWonHome() {
    S.unlock();
    hideOverlay();
    showHomeScreen();
  }

  /* ---------- piece flow: home/tile tap -> hello -> meet -> lesson -> capture lesson -> mission -> round ---------- */

  function choosePiece(type) {
    S.unlock();
    // The child tapped a piece card or tile: that theme's sound for the piece.
    S.play('pick', type);
    if (FC.gamesUI && FC.gamesUI.stop) FC.gamesUI.stop();
    stopRound();
    pendingType = type;
    if (!isSeen('hello')) {
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
    if (!isSeen(lessonId)) {
      showMeet(type, function () {
        playLessonScreen(LS.get(lessonId), function () { afterPieceLesson(type); });
      });
    } else {
      afterPieceLesson(type);
    }
  }

  // The capture idea is the same for every piece but the pawn (its capture
  // is on the slant, its own lesson), so the generic capture lesson plays
  // once per child: once any of them has been seen, the rest are skipped.
  function captureLessonNeeded(type) {
    if (type === 'p') return !isSeen(LS.captureLessonFor('p'));
    return !TYPE_ORDER.some(function (t) {
      return t !== 'p' && isSeen(LS.captureLessonFor(t));
    });
  }

  function afterPieceLesson(type) {
    var capId = LS.captureLessonFor(type);
    if (captureLessonNeeded(type)) {
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
    markSeen(lesson.id);
    P.start(lesson, { onDone: onDone });
  }

  function onReplay() {
    S.unlock();
    if (FC.gamesUI && FC.gamesUI.active()) {
      if (FC.gamesUI.onReplay) FC.gamesUI.onReplay();
      return;
    }
    stopRound();
    // A lesson may be running (Replay is offered during one): stop it, or it
    // would keep speaking and moving behind the Meet card.
    P.stop();
    var type = state.type;
    showMeet(type, function () {
      playLessonScreen(LS.get(LS.lessonFor(type)), function () { afterPieceLesson(type); });
    });
  }

  function onSkip() {
    if (FC.gamesUI && FC.gamesUI.active()) {
      S.unlock();
      if (FC.gamesUI.onSkip) FC.gamesUI.onSkip();
      return;
    }
    if (mode !== 'meet' && mode !== 'lesson') return;
    S.unlock();
    stopRound();
    var type = pendingType || state.type;
    P.stop();
    hideOverlay();
    markSeen(LS.lessonFor(type));
    markSeen(LS.captureLessonFor(type));
    if (type !== state.type) {
      state.type = type;
      renderTiles();
      setPortrait(type);
    }
    showMissionThenRound(type);
  }

  /* ---------- capture rounds ---------- */

  // Ends the current round and cancels everything it scheduled: the idle
  // hint timer, and (through roundToken) any move, pause or voice callback
  // still waiting to run. Safe to call at any time, also with no round.
  function stopRound() {
    roundToken += 1;
    clearIdle();
    state.round = null;
    state.busy = false;
    state.selected = false;
    state.moves = [];
    state.goldenKey = null;
  }

  function startRound(type) {
    stopRound();
    mode = 'round';
    updateToolButtons();
    store.markMet(type);
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
    // Golden pawn (games and capture rounds alike; js/games-ui.js): about
    // 1 in 5 rounds, one target is golden - captured, it is worth an
    // instant sticker instead of only filling the jar. state.goldenKey
    // records which target square it is, checked by captureAt below.
    var goldenIdx = (FC.gamesUI && FC.gamesUI.maybeGoldenIndex) ? FC.gamesUI.maybeGoldenIndex(state.round.targets.length, Math.random) : -1;
    state.goldenKey = null;
    state.round.targets.forEach(function (t, i) {
      var node = B.addItem(t[0], t[1]);
      node.classList.add('round-target');
      if (i === goldenIdx) {
        if (FC.gamesUI && FC.gamesUI.markGolden) FC.gamesUI.markGolden(node);
        state.goldenKey = key(t[0], t[1]);
      }
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
    if (!silent) S.play('pick', state.type);
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

    var myToken = roundToken;
    B.moveHero(state.hero, state.type, from, to, function () {
      if (myToken !== roundToken) return;
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
    } else if (FC.gamesUI && FC.gamesUI.resetStreak) {
      FC.gamesUI.resetStreak();
    }

    if (state.round.targets.length === 0) {
      celebrate();
      return;
    }

    var changes = L.relocateStranded(state.round);
    changes.forEach(moveItem);

    // Waits for the relocation animation to end (nothing to wait for under
    // reduced motion), so this is animation clean-up, not pacing.
    var myToken = roundToken;
    later(function () {
      if (myToken !== roundToken) return;
      state.busy = false;
      select(true);
      armIdle();
    }, changes.length ? 650 : 120);
  }

  function captureAt(r, c) {
    var node = state.items[key(r, c)];
    var wasGolden = state.goldenKey === key(r, c);
    delete state.items[key(r, c)];
    if (node) B.poof(node);
    state.collected += 1;
    updateSlots(state.collected - 1);
    if (FC.gamesUI && FC.gamesUI.captureJuice) {
      FC.gamesUI.captureJuice(r, c, { isPawn: true, golden: wasGolden, node: state.hero });
    } else {
      B.sparkle(r, c, 0);
      S.play('capture');
    }
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
    if (FC.gamesUI && FC.gamesUI.resetStreak) FC.gamesUI.resetStreak();
    replay(state.hero, 'cheer');
    S.play('win');
    B.confetti(28);
    var type = state.type;
    var myToken = roundToken;
    // Queued behind any sticker/golden line that is still playing.
    V.sayAfter('won', function () {
      if (myToken !== roundToken) return;
      showWon(type);
    });
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
    if (FC.gamesUI && FC.gamesUI.active()) {
      if (FC.gamesUI.handleTap) FC.gamesUI.handleTap(r, c);
      return;
    }
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
    function onFirst(e) {
      if (done) return;
      done = true;
      S.unlock();
      V.preloadAll();
      // On Who's playing the first tap says its prompt; a tap on a child's
      // picture is the answer, and Home (next) greets instead.
      var answering = e && e.target && e.target.closest && e.target.closest('.who');
      V.say(FC.profileUI.isVisible() && !answering ? 'who' : FC.pathUI.greetingLine(), function () {});
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
    dom.themeToggle.addEventListener('click', onThemeToggle);
    dom.bookToggle.addEventListener('click', showBook);
    dom.card.addEventListener('click', onCardActivate);
    dom.card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onCardActivate();
      }
    });
  }

  /* ---------- exposed for js/games-ui.js ---------- */

  // The last piece type chosen on Home, excluding the pawn (default rook):
  // js/games-ui.js's 'catch' game gives the child this piece to chase the
  // knight with.
  function lastNonPawnType() {
    return state.type === 'p' ? 'r' : state.type;
  }

  // Non-pawn, non-rook types whose own lesson the current child has seen,
  // in TYPE_ORDER: js/games-ui.js's 'battle' game adds up to two of these to
  // the rook, which is always included.
  function seenNonPawnTypes() {
    return TYPE_ORDER.filter(function (t) { return t !== 'p' && t !== 'r' && isSeen(LS.lessonFor(t)); });
  }

  // The piece of the capture round (or lesson) in progress, or the last one
  // chosen: a full jar earns a sticker of it (js/games-ui.js).
  function roundType() {
    return state.type;
  }

  FC.app = {
    goHome: showHomeScreen,
    startStop: startStop,
    stopRound: stopRound,
    showWho: showWho,
    showCustomCard: showCustomCard,
    hideCard: hideOverlay,
    lastNonPawnType: lastNonPawnType,
    seenNonPawnTypes: seenNonPawnTypes,
    roundType: roundType
  };

  /* ---------- start ---------- */

  // Chromium before 84 ignores "gap" on flex containers, so items touch.
  // Detected once, at startup, and css/app.css then adds margins under
  // html.no-flexgap for every flex container that uses gap.
  function detectFlexGap() {
    try {
      var probe = document.createElement('div');
      probe.style.display = 'flex';
      probe.style.flexDirection = 'column';
      probe.style.rowGap = '1px';
      probe.style.position = 'absolute';
      probe.style.visibility = 'hidden';
      probe.appendChild(document.createElement('div'));
      probe.appendChild(document.createElement('div'));
      document.body.appendChild(probe);
      var supported = probe.scrollHeight === 1;
      document.body.removeChild(probe);
      if (!supported) document.documentElement.classList.add('no-flexgap');
    } catch (e) {
      // Cosmetic only; leave spacing as it is.
    }
  }

  /* ---------- children: whose language, theme and progress are loaded ---------- */

  // Language and theme for the page load: a valid ?lang= / ?theme= in the
  // address wins, then the current child's own choice, then the defaults.
  function startLang() {
    var fromUrl = parseLangFromUrl();
    if (LG.isLang(fromUrl)) return fromUrl;
    return LG.isLang(progress.lang) ? progress.lang : LS.DEFAULT_LANG;
  }

  function startTheme() {
    var fromUrl = parseThemeFromUrl();
    if (TH.isTheme(fromUrl)) return fromUrl;
    return TH.isTheme(progress.theme) ? progress.theme : TH.DEFAULT_THEME;
  }

  // Applies a language and theme after the child changed (and rewrites the
  // address to match, as a switch does).
  function applyPrefs(lang, theme) {
    V.setLang(lang);
    B.setTheme(theme);
    S.setTheme(B.getTheme());
    updateLangButtons();
    markThemeRow();
    setUrlLang(V.getLang());
    setUrlTheme(B.getTheme());
    renderTiles();
    setPortrait(state.type);
    if (FC.gamesUI && FC.gamesUI.onLangChange) FC.gamesUI.onLangChange();
    if (FC.gamesUI && FC.gamesUI.onThemeChange) FC.gamesUI.onThemeChange();
    if (S.context()) V.preloadAll();
  }

  // Loads everything that belongs to the current child, after a different
  // child was chosen, the current one was removed, or everything was
  // replaced (a restore or clear-all in the grown-ups' corner).
  function syncProfile() {
    var cur = store.current();
    activeProfileId = cur ? cur.id : null;
    refreshProgress();
    state.type = 'r';
    applyPrefs(LG.isLang(progress.lang) ? progress.lang : LS.DEFAULT_LANG,
      TH.isTheme(progress.theme) ? progress.theme : TH.DEFAULT_THEME);
    if (FC.gamesUI && FC.gamesUI.onProfileChange) FC.gamesUI.onProfileChange();
    FC.grownupsUI.applySettings(store.settings());
  }

  function onWhoPick(id) {
    S.unlock();
    store.setCurrent(id);
    syncProfile();
    showHomeScreen();
  }

  // The corner closed: a picture, a name or the current child may have
  // changed (removing the current child makes another one current).
  function onGrownupsClosed() {
    var cur = store.current();
    if (!cur || cur.id !== activeProfileId) syncProfile();
    if (FC.profileUI.isVisible() && store.profiles().length < 2) {
      showHomeScreen();
    } else if (FC.profileUI.isVisible()) {
      FC.profileUI.show();
    } else if (!dom.homescreen.hidden) {
      showHomeScreen();
    }
  }

  function onProgressReplaced() {
    syncProfile();
    if (store.profiles().length >= 2) showWho();
    else showHomeScreen();
  }

  // Offline mode (stage 7): sw.js keeps every file of the app on the
  // device after the first visit. Service workers need https (or
  // localhost); a browser without them simply stays online-only.
  function registerOffline() {
    if (!('serviceWorker' in navigator)) return;
    var loc = window.location;
    if (loc.protocol !== 'https:' && loc.hostname !== 'localhost' && loc.hostname !== '127.0.0.1') return;
    try {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    } catch (e) {
      // Offline mode is a nicety; the app works without it.
    }
  }

  function init() {
    detectFlexGap();
    store = STORE.create(STORE.localBackend());
    store.ensureProfile({ theme: 'robots', type: 'n', ring: STORE.RINGS[0] });
    refreshProgress();
    store.onChange(refreshProgress);
    activeProfileId = store.current().id;
    V.setLang(startLang());
    B.setTheme(startTheme());
    S.setTheme(B.getTheme());
    FC.grownupsUI.applySettings(store.settings());
    B.init(onBoardTap);
    buildToolIcons();
    wireTools();
    updateLangButtons();
    updateSoundButtons();
    renderTiles();
    setPortrait(state.type);
    resetSlots();
    P.prepare(LS.get('hello'));
    FC.stickers.init(store);
    FC.profileUI.init(store, { onPick: onWhoPick, onChip: onChip });
    FC.bookUI.init(store, { onHome: showHomeScreen });
    FC.pathUI.init(store, { onStart: startStop });
    FC.grownupsUI.init(store, { onClose: onGrownupsClosed, onReplaced: onProgressReplaced });
    if (FC.gamesUI && FC.gamesUI.init) FC.gamesUI.init(store);
    if (store.profiles().length >= 2) showWho();
    else showHomeScreen();
    armFirstTapListener();
    FC.grownupsUI.openIfRequested();
    registerOffline();
  }

  init();
})();
