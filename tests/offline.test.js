'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const OFF = require('../tools/make-offline.js');

const ROOT = path.join(__dirname, '..');
const swText = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

test('sw.js is up to date: run node tools/make-offline.js after changing any page, style, script or clip', () => {
  assert.equal(OFF.rebuild(swText), swText);
});

test('the offline list has every page, style, script and listed clip, each one a real file', () => {
  const files = OFF.offlineFiles();
  for (const f of ['index.html', 'help.html', 'check.html', 'css/app.css', 'js/app.js', 'js/games.js']) {
    assert.ok(files.includes(f), f);
  }
  const clips = require('../js/voice-clips.js');
  for (const lang of Object.keys(clips)) {
    for (const id of clips[lang]) assert.ok(files.includes(`audio/voice/${lang}/${id}.mp3`), `${lang}/${id}`);
  }
  for (const f of files) assert.ok(fs.existsSync(path.join(ROOT, f)), `${f} does not exist`);
  assert.equal(new Set(files).size, files.length, 'no file twice');
});

test('every script a page loads is in the offline list', () => {
  const files = OFF.offlineFiles();
  for (const page of ['index.html', 'help.html', 'check.html']) {
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    for (const m of html.matchAll(/(?:src|href)="((?:js|css)\/[^"]+)"/g)) {
      assert.ok(files.includes(m[1]), `${page} loads ${m[1]}, which is not kept offline`);
    }
  }
});

test('the version changes when any listed file changes', () => {
  const files = ['index.html', 'js/app.js'];
  const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'fc-off-'));
  fs.mkdirSync(path.join(tmp, 'js'));
  fs.writeFileSync(path.join(tmp, 'index.html'), 'a');
  fs.writeFileSync(path.join(tmp, 'js', 'app.js'), 'b');
  const v1 = OFF.versionOf(files, tmp);
  fs.writeFileSync(path.join(tmp, 'js', 'app.js'), 'c');
  assert.notEqual(OFF.versionOf(files, tmp), v1);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('sw.js defines VERSION and FILES, starting with the site root, and only reads this site\'s own files', () => {
  const block = swText.slice(swText.indexOf(OFF.BEGIN), swText.indexOf(OFF.END));
  const ctx = {};
  vm.runInNewContext(block, ctx);
  assert.match(ctx.VERSION, /^[0-9a-f]{12}$/);
  assert.equal(ctx.FILES[0], './');
  assert.ok(ctx.FILES.every(f => !/^[a-z]+:|^\/\//i.test(f)), 'every file is a relative path on this site');
  assert.match(swText, /origin !== self\.location\.origin\) return;/);
  assert.ok(!/importScripts|eval\(|new Function/.test(swText));
});
