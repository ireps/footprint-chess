'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../tools/check.js');

test('every page passes the page checks', () => {
  assert.ok(C.PAGES.includes('index.html'));
  for (const page of C.PAGES) assert.deepEqual(C.checkPage(page), [], page);
});

test('the check script lists every script and the service worker', () => {
  assert.ok(C.SCRIPTS.includes('js/rules.js'));
  assert.ok(C.SCRIPTS.includes('sw.js'));
});
