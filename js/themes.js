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
 * Games (stage 3) add one piece of theme vocabulary: each theme's two team
 * names (TEAMS below), shown on the team bars and said when the child picks
 * a team. Everything else about a theme is still just artwork and colour.
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

  /*
   * Games (stage 3): each theme's two teams, real group names in every
   * language (one property per language id in js/langs.js; never
   * "bot"/"robot"; see CLAUDE.md and tests/lessons.test.js for the
   * banned-word rules). A language's names are chosen for that language,
   * not translated or transliterated from the English ones. `of` is an
   * optional per-language possessive form, used by the language's turnOf
   * (js/langs.js) to build "<name>'s turn" (Telugu: the form before వంతు).
   * Team "a" is the "White" side and always moves first; the child's
   * default team is "a". The child can switch teams; whichever team they
   * pick always plays from the bottom (the board never rotates). The
   * spoken team-pick lines (with a trailing "!") live in js/lessons.js as
   * LINES['team-<id>-a'/'-b'].
   */
  var TEAMS = {
    robots: {
      a: { en: 'Humanoids', te: 'మెరుపులు', of: { te: 'మెరుపుల' } },
      b: { en: 'Androids', te: 'పిడుగులు', of: { te: 'పిడుగుల' } }
    },
    classic: {
      a: { en: 'White', te: 'తెల్ల పావులు', of: { te: 'తెల్ల పావుల' } },
      b: { en: 'Black', te: 'నల్ల పావులు', of: { te: 'నల్ల పావుల' } }
    },
    space: {
      a: { en: 'Astronauts', te: 'సూర్య జట్టు', of: { te: 'సూర్య జట్టు' } },
      b: { en: 'Cosmonauts', te: 'చంద్ర జట్టు', of: { te: 'చంద్ర జట్టు' } }
    },
    dinos: {
      a: { en: 'Theropods', te: 'కొండ జట్టు', of: { te: 'కొండ జట్టు' } },
      b: { en: 'Sauropods', te: 'అడవి జట్టు', of: { te: 'అడవి జట్టు' } }
    },
    pirate: {
      a: { en: 'Buccaneers', te: 'సొరచేపలు', of: { te: 'సొరచేపల' } },
      b: { en: 'Corsairs', te: 'తిమింగలాలు', of: { te: 'తిమింగలాల' } }
    }
  };

  var DEFAULT_TEAM = 'a';

  function isTheme(id) {
    for (var i = 0; i < THEMES.length; i++) {
      if (THEMES[i].id === id) return true;
    }
    return false;
  }

  var api = {
    THEMES: THEMES,
    DEFAULT_THEME: DEFAULT_THEME,
    TEAMS: TEAMS,
    DEFAULT_TEAM: DEFAULT_TEAM,
    isTheme: isTheme
  };

  if (isNode) {
    module.exports = api;
  } else {
    root.FC = root.FC || {};
    root.FC.themes = api;
  }
})(this);
