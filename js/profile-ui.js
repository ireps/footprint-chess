/*
 * Footprint Chess: pictures for the children who play, and the Who's
 * playing screen (stage 5).
 *
 * A child's picture is one piece in one theme's art on a light tint, ringed
 * in a colour the grown-up chose (a profile's `pic`, see js/store.js). Home
 * shows the current child's picture top-left; tapping it opens the Who's
 * playing screen. That screen has one big picture per child, with up to
 * three of that child's stickers under it, and the optional name small
 * beneath the picture. It has no add or remove controls: those are in the
 * grown-ups' corner (js/grownups-ui.js).
 *
 * Depends on FC.board, FC.lessons, FC.voice and FC.stickers (loaded before
 * this file). DOM is built with createElement/textContent only (see
 * SECURITY.md).
 */
(function () {
  'use strict';

  var FC = window.FC;
  var B = FC.board;
  var LS = FC.lessons;
  var V = FC.voice;
  var ST = FC.stickers;

  var WHO_STICKERS = 3;

  var store = null;
  var onPick = null;

  var dom = {
    chip: document.getElementById('me-chip'),
    screen: document.getElementById('whoscreen'),
    title: document.getElementById('who-title'),
    row: document.getElementById('who-row')
  };

  function el(tag, cls) { var n = document.createElement(tag); if (cls) n.className = cls; return n; }
  function clear(node) { node.textContent = ''; }

  // A child's picture: a round frame ringed in the chosen colour, tinted by
  // the theme, holding the piece in that theme's art (the child's own,
  // per-type colours). Sized by its container's CSS.
  function avatar(pic) {
    var node = el('div', 'avatar theme-' + pic.theme);
    node.style.borderColor = pic.ring;
    node.appendChild(B.themedPieceSvg(pic.theme, pic.type, 'me'));
    return node;
  }

  function init(theStore, opts) {
    store = theStore;
    onPick = opts.onPick;
    dom.chip.addEventListener('click', opts.onChip);
  }

  // The current child's picture on Home.
  function renderChip() {
    clear(dom.chip);
    var p = store.current();
    if (p) dom.chip.appendChild(avatar(p.pic));
  }

  // The heading, in the current language (every language has the line).
  function titleText() {
    var line = LS.LINES.who;
    var chain = FC.langs.fallbackChain(V.getLang());
    for (var i = 0; i < chain.length; i++) {
      if (line[chain[i]]) return line[chain[i]];
    }
    return '';
  }

  function render() {
    clear(dom.row);
    dom.title.textContent = titleText();
    var profiles = store.profiles();
    dom.row.className = 'who-row who-n' + profiles.length;
    profiles.forEach(function (p, i) {
      var btn = el('button', 'who');
      btn.type = 'button';
      btn.setAttribute('aria-label', p.name || ('Player ' + (i + 1)));
      var av = avatar(p.pic);
      av.classList.add('who-av');
      btn.appendChild(av);
      if (p.name) {
        var name = el('div', 'who-name');
        name.textContent = p.name;
        btn.appendChild(name);
      }
      var shelf = el('div', 'who-st');
      ST.listFor(p.id, store.progressOf(p.id), WHO_STICKERS).forEach(function (s) {
        var chip = el('div', 'sticker-chip who-chip');
        chip.appendChild(ST.art(s.theme, s.kind));
        shelf.appendChild(chip);
      });
      btn.appendChild(shelf);
      btn.addEventListener('click', function () { onPick(p.id); });
      dom.row.appendChild(btn);
    });
  }

  function show() {
    render();
    dom.screen.hidden = false;
  }

  function hide() { dom.screen.hidden = true; }
  function isVisible() { return !dom.screen.hidden; }

  FC.profileUI = {
    init: init,
    avatar: avatar,
    renderChip: renderChip,
    render: render,
    show: show,
    hide: hide,
    isVisible: isVisible
  };
})();
