/*
 * Footprint Chess: the theme registry (stage 4).
 *
 * A theme swaps the piece artwork and the board/panel colours; it never
 * changes vocabulary, rules or lesson content (see CLAUDE.md, "Design
 * decisions"). This file only lists the themes and validates an id; the
 * artwork lives in index.html's sprite <defs>, the colours in css/app.css,
 * and js/board.js applies a theme by setting a body class and rewriting
 * piece <use> hrefs (see FC.board.setTheme).
 *
 * "name" is English only, used for aria-labels and the grown-ups' guide; it
 * is never spoken or shown to the child (the theme row on the home screen
 * has no visible text at all, only the pieces' own colours).
 *
 * Classic script: exposes window.FC.themes in the browser and
 * module.exports in Node, like js/rules.js and js/levels.js. Keep to
 * ES2017 syntax (see README, "Browser support and coding rules").
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;

  var THEMES = [
    { id: 'robots', name: 'Robots' },
    { id: 'classic', name: 'Classic' },
    { id: 'space', name: 'Space' },
    { id: 'dinos', name: 'Dinosaurs' },
    { id: 'pirate', name: 'Pirate' }
  ];

  var DEFAULT_THEME = 'robots';

  function isTheme(id) {
    for (var i = 0; i < THEMES.length; i++) {
      if (THEMES[i].id === id) return true;
    }
    return false;
  }

  var api = {
    THEMES: THEMES,
    DEFAULT_THEME: DEFAULT_THEME,
    isTheme: isTheme
  };

  if (isNode) {
    module.exports = api;
  } else {
    root.FC = root.FC || {};
    root.FC.themes = api;
  }
})(this);
