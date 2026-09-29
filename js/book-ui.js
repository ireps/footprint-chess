/*
 * Footprint Chess: the sticker book (stage 5).
 *
 * A full-screen book opened from the book button on Home. One tab per theme
 * (that theme's pawn on its own background); the current theme's page is
 * selected when the book opens. Each theme has two pages of four slots: the
 * rook, bishop, queen and king on the left page; the knight, the pawn, the
 * golden pawn and the golden king on the right. An earned slot shows its
 * sticker; an empty slot shows a faint outline of the piece. Stickers earned
 * in this page load get a dashed ring. Tapping an earned sticker plays that
 * theme's sound for the piece (without changing the app's theme). There are
 * no numbers anywhere: a sticker earned twice looks the same as once.
 *
 * In portrait the two pages stack; the slot size is worked out from the
 * window (layout) so nothing scrolls.
 *
 * Depends on FC.board, FC.sound, FC.themes, FC.lessons, FC.profileUI and
 * FC.stickers (loaded before this file). DOM is built with
 * createElement/textContent only (see SECURITY.md).
 */
(function () {
  'use strict';

  var FC = window.FC;
  var B = FC.board;
  var S = FC.sound;
  var TH = FC.themes;
  var LS = FC.lessons;
  var PU = FC.profileUI;
  var ST = FC.stickers;

  var store = null;
  var onHome = null;
  var activeTheme = null;

  var dom = {
    screen: document.getElementById('bookscreen'),
    home: document.getElementById('book-home'),
    me: document.getElementById('book-me'),
    tabs: document.getElementById('book-tabs'),
    book: document.getElementById('book')
  };

  function el(tag, cls) { var n = document.createElement(tag); if (cls) n.className = cls; return n; }
  function clear(node) { node.textContent = ''; }

  function init(theStore, opts) {
    store = theStore;
    onHome = opts.onHome;
    dom.home.appendChild(B.svgUse('house'));
    dom.home.addEventListener('click', function () {
      S.unlock();
      onHome();
    });
    window.addEventListener('resize', layout);
    window.addEventListener('orientationchange', layout);
  }

  function isOpen() { return !dom.screen.hidden; }

  function open() {
    activeTheme = B.getTheme();
    clear(dom.me);
    var p = store.current();
    if (p) dom.me.appendChild(PU.avatar(p.pic));
    render();
    dom.screen.hidden = false;
    layout();
  }

  function close() { dom.screen.hidden = true; }

  function render() {
    renderTabs();
    renderPages();
  }

  function renderTabs() {
    clear(dom.tabs);
    TH.THEMES.forEach(function (theme) {
      var tab = el('button', 'book-tab theme-' + theme.id + (theme.id === activeTheme ? ' on' : ''));
      tab.type = 'button';
      tab.setAttribute('aria-label', theme.name + ' stickers');
      tab.setAttribute('aria-pressed', theme.id === activeTheme ? 'true' : 'false');
      tab.appendChild(B.themedPieceSvg(theme.id, 'p', 'me'));
      tab.addEventListener('click', function () {
        S.unlock();
        S.play('select');
        activeTheme = theme.id;
        render();
        layout();
      });
      dom.tabs.appendChild(tab);
    });
  }

  function kindLabel(kind) {
    var name = ST.isGolden(kind) ? 'Golden ' : '';
    return name + LS.PIECE_NAMES[LS.DEFAULT_LANG][ST.pieceOf(kind)].toLowerCase();
  }

  function slot(theme, kind, progress, id) {
    var earned = (progress.stickers[theme + ':' + kind] || 0) >= 1;
    if (!earned) {
      var empty = el('div', 'slot empty');
      empty.setAttribute('role', 'img');
      empty.setAttribute('aria-label', kindLabel(kind) + ' sticker, not earned yet');
      var ghost = B.svgUse('cl-' + ST.pieceOf(kind));
      ghost.classList.add('ghost');
      empty.appendChild(ghost);
      return empty;
    }
    var btn = el('button', 'slot' + (ST.isGolden(kind) ? ' golden' : '') + (ST.isNew(id, theme, kind) ? ' fresh' : ''));
    btn.type = 'button';
    btn.setAttribute('aria-label', kindLabel(kind) + ' sticker');
    var art = ST.art(theme, kind);
    btn.appendChild(art);
    btn.addEventListener('click', function () {
      S.unlock();
      ST.playSound(theme, kind);
      B.replay(art, 'tapped');
    });
    return btn;
  }

  function renderPages() {
    clear(dom.book);
    var progress = store.progress();
    var p = store.current();
    if (!progress || !p) return;
    [ST.KINDS.slice(0, 4), ST.KINDS.slice(4)].forEach(function (kinds, i) {
      var leaf = el('div', 'leaf ' + (i === 0 ? 'leaf-left' : 'leaf-right'));
      var grid = el('div', 'slot-grid');
      kinds.forEach(function (kind) { grid.appendChild(slot(activeTheme, kind, progress, p.id)); });
      leaf.appendChild(grid);
      dom.book.appendChild(leaf);
    });
  }

  // The slot size that fits two columns and two rows in each page, in both
  // orientations, so the book never scrolls (css/app.css .bookscreen uses the
  // same margins).
  function layout() {
    if (!isOpen()) return;
    var w = window.innerWidth;
    var h = window.innerHeight;
    var pad = 24;
    var leafW;
    var leafH;
    if (h > w) {
      leafW = w - 40;
      leafH = (h - 150 - 20 - 10) / 2;
    } else {
      leafW = (w - 340) / 2;
      leafH = h - 128 - 40;
    }
    var size = Math.min((leafW - pad * 2) / 2 - 16, (leafH - pad * 2) / 2 - 20);
    size = Math.max(60, Math.min(220, Math.floor(size)));
    dom.book.style.setProperty('--slot', size + 'px');
  }

  FC.bookUI = { init: init, open: open, close: close, isOpen: isOpen };
})();
