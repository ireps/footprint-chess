#!/usr/bin/env node
'use strict';

/*
 * Footprint Chess: the project's rule checks, in one command.
 *
 * Node-only dev tool, no npm dependencies. Run before every commit (and in
 * continuous integration, .github/workflows/test.yml) together with the
 * tests:
 *   node tools/check.js
 *
 * Checks (see CONTRIBUTING.md, "Rules"):
 *   - no innerHTML, outerHTML, insertAdjacentHTML, document.write, eval( or
 *     new Function in js/*.js, sw.js or the pages;
 *   - no ?. or ?? in js/*.js or sw.js (the target browsers are older than
 *     those operators);
 *   - every page's first tag after <meta charset> is the Content Security
 *     Policy <meta>, which never allows 'unsafe-inline', 'unsafe-eval' or
 *     another origin;
 *   - no inline scripts, inline event handlers or style attributes in the
 *     pages;
 *   - js/*.js and sw.js parse as ES2017 (needs the acorn parser: install it
 *     with `npm install --no-save acorn`; skipped with a warning when it is
 *     missing, except in continuous integration, where it is required);
 *   - sw.js's offline file list is up to date (tools/make-offline.js).
 *
 * Exits 1 and lists every problem when any check fails.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function list(dir, ext) {
  return fs.readdirSync(path.join(ROOT, dir))
    .filter(f => f.endsWith(ext))
    .sort()
    .map(f => (dir === '.' ? f : dir + '/' + f));
}

const SCRIPTS = list('js', '.js').concat(['sw.js']);
const PAGES = list('.', '.html');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

/* Every line of `file` matching `re`, as "file:line: text". */
function matches(file, re) {
  const out = [];
  read(file).split('\n').forEach((line, i) => {
    if (re.test(line)) out.push(file + ':' + (i + 1) + ': ' + line.trim());
  });
  return out;
}

const CSP_ALLOWED = /^(default-src|script-src|style-src|font-src|media-src|connect-src) 'self'$|^img-src 'self' data:$|^object-src 'none'$|^base-uri 'none'$|^form-action 'none'$/;

function checkPage(file) {
  const problems = [];
  const html = read(file);
  const head = /<head>\s*<meta charset="utf-8">\s*<meta http-equiv="Content-Security-Policy" content="([^"]*)">/i.exec(html);
  if (!head) {
    problems.push(file + ': the Content Security Policy <meta> must come first in <head>, right after <meta charset>');
  } else {
    head[1].split(';').map(d => d.trim()).filter(Boolean).forEach(d => {
      if (!CSP_ALLOWED.test(d)) problems.push(file + ': Content Security Policy directive not allowed: ' + d);
    });
  }
  matches(file, /<script(?![^>]*\bsrc=)[^>]*>/i).forEach(m => problems.push(m + '  (inline script)'));
  matches(file, /<[a-z][^>]*\son[a-z]+\s*=/i).forEach(m => problems.push(m + '  (inline event handler)'));
  matches(file, /<[a-z][^>]*\sstyle\s*=/i).forEach(m => problems.push(m + '  (style attribute)'));
  return problems;
}

function parseCheck() {
  let acorn;
  try {
    acorn = require(require.resolve('acorn', { paths: [ROOT, process.cwd()] }));
  } catch (e) {
    return { skipped: true, problems: [] };
  }
  const problems = [];
  SCRIPTS.forEach(file => {
    try {
      acorn.parse(read(file), { ecmaVersion: 2017, sourceType: 'script' });
    } catch (e) {
      problems.push(file + ': not ES2017: ' + e.message);
    }
  });
  return { skipped: false, problems: problems };
}

function offlineCheck() {
  const tool = require('./make-offline.js');
  const current = read('sw.js');
  return tool.rebuild(current) === current ? [] : ['sw.js: the offline file list is out of date; run node tools/make-offline.js'];
}

function main() {
  const results = [];
  function run(name, problems, note) {
    results.push({ name: name, problems: problems, note: note });
  }

  const unsafe = /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function/;
  run('No unsafe DOM or code APIs', [].concat.apply([], SCRIPTS.concat(PAGES).map(f => matches(f, unsafe))));
  run('No ?. or ?? (ES2017 only)', [].concat.apply([], SCRIPTS.map(f => matches(f, /\?\.|\?\?/))));
  run('Pages: CSP first, no inline code or styles', [].concat.apply([], PAGES.map(checkPage)));

  const parsed = parseCheck();
  if (parsed.skipped) {
    if (process.env.CI) run('ES2017 parse', ['acorn is not installed (npm install --no-save acorn)']);
    else run('ES2017 parse', [], 'skipped: acorn is not installed (npm install --no-save acorn)');
  } else {
    run('ES2017 parse', parsed.problems);
  }

  run('Offline file list up to date', offlineCheck());

  let failed = 0;
  results.forEach(r => {
    const status = r.problems.length ? 'FAIL' : (r.note ? 'SKIP' : 'ok');
    console.log(status + '  ' + r.name + (r.note ? '  (' + r.note + ')' : ''));
    r.problems.forEach(p => console.log('      ' + p));
    if (r.problems.length) failed++;
  });
  if (failed) {
    console.log('\n' + failed + ' check(s) failed.');
    process.exit(1);
  }
}

module.exports = { checkPage, SCRIPTS, PAGES };

if (require.main === module) main();
