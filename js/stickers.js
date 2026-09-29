/*
 * Footprint Chess: sticker art and lists (stage 5).
 *
 * A sticker is a round badge with a gold rim holding one piece, drawn in one
 * theme's art on that theme's own background. The kinds are the six piece
 * types, plus the golden pawn and the golden king (see FC.store
 * STICKER_KINDS); the golden ones use gold instead of the piece's colour and
 * a soft, static glow. Used by the sticker pop in the side panel, the shelf
 * on Home, the Who's playing screen and the sticker book (js/book-ui.js).
 *
 * Stickers earned in this page load are kept in memory, per child, so the
 * book can ring them with a dashed line ("new"); nothing about that is
 * stored. No numbers are ever shown for stickers.
 *
 * Depends on FC.board, FC.sound, FC.themes and FC.store (loaded before this
 * file). DOM is built with createElement/textContent only (see SECURITY.md).
 */
(function () {
  'use strict';

  var FC = window.FC;
  var B = FC.board;
  var S = FC.sound;
  var TH = FC.themes;

  // Book order: the left page, then the right page.
  var KINDS = FC.store.STICKER_KINDS.slice();
  var GOLD = '#f5c518';
  var GOLD_ACC = '#b8862b';

  var store = null;
  var session = {};   // child id -> [{ theme, kind }], oldest first

  function init(theStore) { store = theStore; }

  function isGolden(kind) { return kind.indexOf('golden-') === 0; }
  // The piece a kind shows: 'golden-p' is a pawn, 'golden-k' a king.
  function pieceOf(kind) { return isGolden(kind) ? kind.slice(-1) : kind; }
  function keyOf(theme, kind) { return theme + ':' + kind; }

  // The sticker's art as a block that fills its container (the container
  // sets the size and the rim width; css/app.css .stk).
  function art(theme, kind) {
    var wrap = document.createElement('div');
    wrap.className = 'stk theme-' + theme + (isGolden(kind) ? ' golden' : '');
    // Golden stickers are drawn on the "other side" art so the theme's
    // per-piece colour rules for the child's own pieces do not override the
    // gold, which is set on the piece itself.
    var svg = B.themedPieceSvg(theme, pieceOf(kind), isGolden(kind) ? 'foe' : 'me');
    if (isGolden(kind)) {
      svg.style.setProperty('--pc', GOLD);
      svg.style.setProperty('--acc', GOLD_ACC);
    }
    wrap.appendChild(svg);
    return wrap;
  }

  // The sound for tapping an earned sticker: that theme's tap sound for the
  // piece, played without changing the app's theme; the golden ones play the
  // theme's capture sound.
  function playSound(theme, kind) {
    if (isGolden(kind)) S.play('capture', 1, theme);
    else S.play('pick', kind, theme);
  }

  function currentId() {
    var p = store ? store.current() : null;
    return p ? p.id : null;
  }

  /* ---------- earned this page load ---------- */

  function record(theme, kind) {
    var id = currentId();
    if (!id) return;
    var list = session[id] || (session[id] = []);
    var k = keyOf(theme, kind);
    session[id] = list.filter(function (e) { return keyOf(e.theme, e.kind) !== k; });
    session[id].push({ theme: theme, kind: kind });
  }

  function isNew(id, theme, kind) {
    var k = keyOf(theme, kind);
    return (session[id] || []).some(function (e) { return keyOf(e.theme, e.kind) === k; });
  }

  // Themes in book order: the given one first, then the registry order.
  function themeOrder(first) {
    var ids = TH.THEMES.map(function (t) { return t.id; });
    if (ids.indexOf(first) === -1) return ids;
    return [first].concat(ids.filter(function (id) { return id !== first; }));
  }

  // Up to max stickers of a child: earned this page load first (newest
  // first), then the others in book order (the current theme's page first).
  function listFor(id, progress, max) {
    var out = [];
    if (!progress) return out;
    var taken = {};
    function has(theme, kind) { return (progress.stickers[keyOf(theme, kind)] || 0) >= 1; }
    function add(theme, kind) {
      var k = keyOf(theme, kind);
      if (out.length >= max || taken[k] || !has(theme, kind)) return;
      taken[k] = true;
      out.push({ theme: theme, kind: kind });
    }
    (session[id] || []).slice().reverse().forEach(function (e) { add(e.theme, e.kind); });
    themeOrder(B.getTheme()).forEach(function (theme) {
      KINDS.forEach(function (kind) { add(theme, kind); });
    });
    return out;
  }

  /* ---------- the shelf on Home ---------- */

  function renderShelf(host) {
    if (!host || !store) return;
    host.textContent = '';
    var id = currentId();
    var list = id ? listFor(id, store.progress(), 4) : [];
    list.forEach(function (s) {
      var chip = document.createElement('div');
      chip.className = 'sticker-chip';
      chip.appendChild(art(s.theme, s.kind));
      host.appendChild(chip);
    });
    host.hidden = list.length === 0;
  }

  FC.stickers = {
    KINDS: KINDS,
    init: init,
    art: art,
    pieceOf: pieceOf,
    isGolden: isGolden,
    playSound: playSound,
    record: record,
    isNew: isNew,
    themeOrder: themeOrder,
    listFor: listFor,
    renderShelf: renderShelf
  };
})();
