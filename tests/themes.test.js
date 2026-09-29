'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const TH = require('../js/themes.js');
const L = require('../js/lessons.js');
const LG = require('../js/langs.js');

const ROOT = path.join(__dirname, '..');
const TYPES = ['r', 'b', 'q', 'k', 'n', 'p'];

/* ---------- the registry itself ---------- */

test('THEMES lists robots first, in the agreed order, each with an id and an English name', () => {
  const ids = TH.THEMES.map(t => t.id);
  assert.deepEqual(ids, ['robots', 'classic', 'space', 'dinos', 'pirate']);
  for (const t of TH.THEMES) {
    assert.equal(typeof t.id, 'string');
    assert.equal(typeof t.name, 'string');
    assert.ok(t.name.length > 0, `${t.id}: name is empty`);
  }
});

test('DEFAULT_THEME is robots, and is one of THEMES', () => {
  assert.equal(TH.DEFAULT_THEME, 'robots');
  assert.ok(TH.THEMES.some(t => t.id === TH.DEFAULT_THEME));
});

test('isTheme accepts every listed id and rejects anything else', () => {
  for (const t of TH.THEMES) {
    assert.equal(TH.isTheme(t.id), true, t.id);
  }
  for (const bad of ['adventure', 'robot', 'Classic', '', null, undefined, 'space ']) {
    assert.equal(TH.isTheme(bad), false, String(bad));
  }
});

/* ---------- games: team names (stage 3) ---------- */

test('TEAMS has a and b team names, in every registry language, for every theme, and nothing extra', () => {
  assert.deepEqual(Object.keys(TH.TEAMS).sort(), TH.THEMES.map(t => t.id).sort());
  for (const theme of TH.THEMES) {
    const teams = TH.TEAMS[theme.id];
    assert.ok(teams, `TEAMS.${theme.id} is missing`);
    assert.deepEqual(Object.keys(teams).sort(), ['a', 'b'], `TEAMS.${theme.id} should have exactly teams a and b`);
    for (const side of ['a', 'b']) {
      const t = teams[side];
      for (const lang of LG.ids()) {
        assert.ok(t && typeof t[lang] === 'string' && t[lang].trim().length > 0, `TEAMS.${theme.id}.${side}.${lang} missing`);
        const script = LG.get(lang).script;
        if (script) {
          assert.match(t[lang], script, `TEAMS.${theme.id}.${side}.${lang} should contain the ${lang} script`);
        }
      }
      // The optional possessive forms are per language, and each is in that language's script.
      if (t.of !== undefined) {
        for (const [lang, form] of Object.entries(t.of)) {
          assert.ok(LG.isLang(lang), `TEAMS.${theme.id}.${side}.of has unknown language "${lang}"`);
          assert.ok(typeof form === 'string' && form.trim().length > 0, `TEAMS.${theme.id}.${side}.of.${lang} is empty`);
          const script = LG.get(lang).script;
          if (script) assert.match(form, script, `TEAMS.${theme.id}.${side}.of.${lang} should contain the ${lang} script`);
        }
      }
    }
    assert.notEqual(teams.a[LG.DEFAULT_LANG], teams.b[LG.DEFAULT_LANG], `${theme.id}: team a and b should have different ${LG.DEFAULT_LANG} names`);
  }
});

test('DEFAULT_TEAM is "a", team a of every theme is the White (moves-first) side', () => {
  assert.equal(TH.DEFAULT_TEAM, 'a');
  assert.ok(TH.TEAMS[TH.DEFAULT_THEME]);
});

test('TEAMS matches the agreed group names exactly', () => {
  assert.deepEqual(TH.TEAMS, {
    robots: { a: { en: 'Humanoids', te: 'మెరుపులు', of: { te: 'మెరుపుల' } }, b: { en: 'Androids', te: 'పిడుగులు', of: { te: 'పిడుగుల' } } },
    classic: { a: { en: 'White', te: 'తెల్ల పావులు', of: { te: 'తెల్ల పావుల' } }, b: { en: 'Black', te: 'నల్ల పావులు', of: { te: 'నల్ల పావుల' } } },
    space: { a: { en: 'Astronauts', te: 'సూర్య జట్టు', of: { te: 'సూర్య జట్టు' } }, b: { en: 'Cosmonauts', te: 'చంద్ర జట్టు', of: { te: 'చంద్ర జట్టు' } } },
    dinos: { a: { en: 'Theropods', te: 'కొండ జట్టు', of: { te: 'కొండ జట్టు' } }, b: { en: 'Sauropods', te: 'అడవి జట్టు', of: { te: 'అడవి జట్టు' } } },
    pirate: { a: { en: 'Buccaneers', te: 'సొరచేపలు', of: { te: 'సొరచేపల' } }, b: { en: 'Corsairs', te: 'తిమింగలాలు', of: { te: 'తిమింగలాల' } } }
  });
});

test('every TEAMS name matches its team-<theme>-<a|b> voice line in js/lessons.js, with a trailing "!"', () => {
  for (const theme of TH.THEMES) {
    for (const side of ['a', 'b']) {
      const line = L.LINES['team-' + theme.id + '-' + side];
      assert.ok(line, `LINES missing team-${theme.id}-${side}`);
      const team = TH.TEAMS[theme.id][side];
      for (const lang of LG.ids()) {
        assert.equal(line[lang], team[lang] + '!', `team-${theme.id}-${side}: ${lang} text does not match TEAMS`);
      }
    }
  }
});

/* ---------- artwork: index.html's sprite <defs> ---------- */

test('index.html has a sprite symbol for every theme x piece type, and no leftover robots-p-dark', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const theme of TH.THEMES) {
    for (const type of TYPES) {
      const id = theme.id + '-' + type;
      assert.ok(
        new RegExp('<symbol id="' + id + '"').test(html),
        'missing sprite symbol #' + id
      );
    }
  }
  assert.ok(!/robots-p-dark/.test(html), 'robots-p-dark should have been removed (see THEMES-SPEC)');
});

test('index.html has an ic-palette icon symbol for the theme tool button', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(/<symbol id="ic-palette"/.test(html));
});

test('index.html loads js/langs.js first, before js/rules.js and every other script', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = html.match(/<script src="[^"]+"><\/script>/g) || [];
  assert.equal(scripts[0], '<script src="js/langs.js"></script>');
  assert.ok(html.indexOf('<script src="js/langs.js">') < html.indexOf('<script src="js/rules.js">'));
});

test('index.html has a #lang-row container (the language picker for three or more languages), hidden at first', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(/<div class="lang-row" id="lang-row" hidden><\/div>/.test(html));
});

test('index.html loads js/themes.js before js/board.js', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const themesAt = html.indexOf('<script src="js/themes.js">');
  const boardAt = html.indexOf('<script src="js/board.js">');
  assert.ok(themesAt !== -1, 'js/themes.js is not loaded');
  assert.ok(boardAt !== -1, 'js/board.js is not loaded');
  assert.ok(themesAt < boardAt, 'js/themes.js must load before js/board.js');
});

/* ---------- colours: css/app.css ---------- */

test('css/app.css has a .theme-<id> rule for every non-default theme', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css', 'app.css'), 'utf8');
  for (const theme of TH.THEMES) {
    if (theme.id === TH.DEFAULT_THEME) continue;
    assert.ok(
      new RegExp('\\.theme-' + theme.id + '\\s*\\{').test(css),
      'missing .theme-' + theme.id + ' rule'
    );
  }
});

test('css/app.css sets --pc directly on side-foe (a single "other side" colour) for every theme', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css', 'app.css'), 'utf8');
  for (const theme of TH.THEMES) {
    const re = new RegExp('\\.theme-' + theme.id + '\\s+\\.side-foe\\s*\\{[^}]*--pc\\s*:');
    assert.ok(re.test(css), '.theme-' + theme.id + ' .side-foe does not set --pc');
  }
});

test('css/app.css gives the child\'s pieces (side-me) the same per-type body colour in every theme but Classic', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css', 'app.css'), 'utf8');
  // Classic: one single colour for every type, set directly on .side-me.
  assert.ok(
    /\.theme-classic\s+\.side-me\s*\{[^}]*--pc\s*:/.test(css),
    '.theme-classic .side-me does not set --pc'
  );
  // Robots: no override at all; each robots-<type> symbol supplies its own
  // per-type colour as a var(--pc, <hex>) fallback (index.html).
  assert.ok(
    !/\.theme-robots\s+\.side-me\s*\{[^}]*--pc\s*:/.test(css),
    '.theme-robots .side-me should not set --pc (see the per-symbol fallback)'
  );
  // Space, Dinosaurs and Pirate: distinct colours help a child tell the
  // pieces apart, so each costume gets Robots' per-type colour. The rule is
  // keyed to the costume (the <use> href) rather than the page theme, so the
  // theme picker's swatches keep their own colours in any theme.
  const COLORS = { r: '#f59e2e', b: '#ec5f99', q: '#9a6ce0', k: '#f5d23b', n: '#36c2ce', p: '#6ccb5f' };
  for (const theme of ['space', 'dinos', 'pirate']) {
    for (const type of TYPES) {
      const sel = '.side-me use[data-pt="' + type + '"][href^="#' + theme + '-"]';
      const at = css.indexOf(sel);
      assert.ok(at !== -1, sel + ' is missing');
      const rule = css.slice(at, css.indexOf('}', at));
      assert.ok(rule.toLowerCase().includes('--pc: ' + COLORS[type]), sel + ' should set --pc: ' + COLORS[type]);
    }
  }
});

/* ---------- pirate: crew symbols with a clip path per piece ---------- */

test('every pirate-<type> symbol has its own uniquely-named clip path and uses --stripe/--trouser/--gold/--band, never --acc', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const type of TYPES) {
    const m = new RegExp('<symbol id="pirate-' + type + '"[\\s\\S]*?</symbol>').exec(html);
    assert.ok(m, 'pirate-' + type + ' symbol not found');
    const body = m[0];
    assert.ok(body.indexOf('<clipPath id="pirate-' + type + '-clip">') !== -1, 'pirate-' + type + ' has no clip path');
    assert.ok(!/var\(--acc\)/.test(body), 'pirate-' + type + ' still references --acc');
  }
  // Every clipPath id in the whole file is unique (SVG ids must be).
  const clipIds = html.match(/<clipPath id="[^"]+"/g) || [];
  assert.equal(new Set(clipIds).size, clipIds.length, 'duplicate <clipPath> id in index.html');
});

test('css/app.css sets --stripe/--trouser/--gold/--band for pirate side-me and side-foe', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css', 'app.css'), 'utf8');
  for (const side of ['side-me', 'side-foe']) {
    const re = new RegExp('\\.theme-pirate\\s+\\.' + side + '\\s*\\{([^}]*)\\}');
    const m = re.exec(css);
    assert.ok(m, '.theme-pirate .' + side + ' rule not found');
    for (const v of ['--stripe', '--trouser', '--gold', '--band']) {
      assert.ok(m[1].indexOf(v + ':') !== -1, '.theme-pirate .' + side + ' does not set ' + v);
    }
  }
});
