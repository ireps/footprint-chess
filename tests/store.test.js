'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ST = require('../js/store.js');

const PIC = { theme: 'dinos', type: 'r', ring: ST.RINGS[1] };

function memBackend(initial) {
  const map = Object.assign({}, initial || {});
  return {
    map,
    get: (k) => (Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null),
    set: (k, v) => { map[k] = v; },
    remove: (k) => { delete map[k]; }
  };
}

function saved(backend) {
  return JSON.parse(backend.map[ST.STORAGE_KEY]);
}

/* ---------- defaults and profiles ---------- */

test('a new store has default settings, no profiles and no current child', () => {
  const s = ST.create(memBackend());
  assert.deepEqual(s.settings(), { calm: false, breakOn: true, breakMins: 15 });
  assert.deepEqual(s.profiles(), []);
  assert.equal(s.current(), null);
  assert.equal(s.progress(), null);
  assert.equal(s.persistent, true);
  assert.equal(s.readOnlyNewer, false);
});

test('ensureProfile creates exactly one unnamed profile and makes it current', () => {
  const b = memBackend();
  const s = ST.create(b);
  const p = s.ensureProfile(PIC);
  assert.equal(p.name, '');
  assert.deepEqual(p.pic, PIC);
  assert.match(p.id, /^p[0-9a-z]{1,12}$/);
  assert.equal(s.ensureProfile(PIC).id, p.id);
  assert.equal(s.profiles().length, 1);
  assert.equal(saved(b).current, p.id);
});

test('up to four profiles; the fifth is refused', () => {
  const s = ST.create(memBackend());
  const ids = [];
  for (let i = 0; i < 4; i++) ids.push(s.addProfile(PIC, 'Child ' + i).id);
  assert.equal(new Set(ids).size, 4);
  assert.equal(s.addProfile(PIC, 'Five'), null);
  assert.equal(s.profiles().length, 4);
  assert.equal(s.current().id, ids[0]);
});

test('removing the current profile moves current to the first remaining one, and drops its progress', () => {
  const b = memBackend();
  const s = ST.create(b);
  const a = s.addProfile(PIC, 'A');
  const c = s.addProfile(PIC, 'C');
  s.markMet('r');
  s.removeProfile(a.id);
  assert.equal(s.current().id, c.id);
  assert.equal(saved(b).progress[a.id], undefined);
  s.removeProfile(c.id);
  assert.equal(s.current(), null);
});

test('updateProfile changes only the name and picture, both sanitized', () => {
  const s = ST.create(memBackend());
  const p = s.addProfile(PIC, 'A');
  s.updateProfile(p.id, { name: '  Big\u0007 sister‮ ', pic: { theme: 'nope', type: 'q', ring: '#000000' }, id: 'pevil' });
  const q = s.current();
  assert.equal(q.id, p.id);
  assert.equal(q.name, 'Big sister');
  assert.deepEqual(q.pic, { theme: 'robots', type: 'q', ring: ST.RINGS[0] });
});

test('names keep Telugu, drop control characters and stop at 20 characters', () => {
  const s = ST.create(memBackend());
  assert.equal(s.addProfile(PIC, 'అక్క').name, 'అక్క');
  assert.equal(s.addProfile(PIC, 'x'.repeat(50)).name, 'x'.repeat(20));
  assert.equal(s.addProfile(PIC, 42).name, '');
});

/* ---------- progress ---------- */

test('progress belongs to the current child and stays separate when switching', () => {
  const s = ST.create(memBackend());
  const a = s.addProfile(PIC, 'A');
  const b = s.addProfile(PIC, 'B');
  s.markSeen('rook');
  s.markMet('r');
  s.addSticker('dinos', 'p');
  s.setJar(4);
  s.setTeam('pirate', 'b');
  s.setLang('te');
  s.setTheme('space');
  const pa = s.progress();
  assert.equal(pa.seen.rook, true);
  assert.equal(pa.met.r, true);
  assert.equal(pa.stickers['dinos:p'], 1);
  assert.equal(pa.jar, 4);
  assert.equal(pa.teams.pirate, 'b');
  assert.equal(pa.lang, 'te');
  assert.equal(pa.theme, 'space');
  s.setCurrent(b.id);
  const pb = s.progress();
  assert.deepEqual(Object.keys(pb.seen), []);
  assert.deepEqual(Object.keys(pb.stickers), []);
  assert.equal(pb.jar, 0);
  assert.equal(pb.lang, null);
  s.setCurrent(a.id);
  assert.equal(s.progress().jar, 4);
});

test('invalid progress values are ignored', () => {
  const s = ST.create(memBackend());
  s.addProfile(PIC, 'A');
  s.markSeen('Rook!');
  s.markSeen('constructor');
  s.markMet('x');
  assert.equal(s.addSticker('mars', 'p'), 0);
  assert.equal(s.addSticker('robots', 'golden-q'), 0);
  s.setTeam('robots', 'c');
  s.setLang('xx');
  s.setTheme('adventure');
  const p = s.progress();
  assert.deepEqual(p.seen, {});
  assert.deepEqual(p.met, {});
  assert.deepEqual(p.stickers, {});
  assert.deepEqual(p.teams, {});
  assert.equal(p.lang, null);
  assert.equal(p.theme, null);
});

test('sticker counts add up and stop at 999; the jar stays within 0..9', () => {
  const s = ST.create(memBackend());
  s.addProfile(PIC, 'A');
  assert.equal(s.addSticker('robots', 'golden-p'), 1);
  assert.equal(s.addSticker('robots', 'golden-p'), 2);
  for (let i = 0; i < 1100; i++) s.addSticker('robots', 'r');
  assert.equal(s.progress().stickers['robots:r'], 999);
  s.setJar(15);
  assert.equal(s.progress().jar, 9);
  s.setJar(-3);
  assert.equal(s.progress().jar, 0);
});

test('markWin returns true exactly once, when the third game in a theme is first won', () => {
  const s = ST.create(memBackend());
  s.addProfile(PIC, 'A');
  assert.equal(s.markWin('pirate', 'catch'), false);
  assert.equal(s.markWin('pirate', 'catch'), false);
  assert.equal(s.markWin('pirate', 'race'), false);
  assert.equal(s.markWin('robots', 'battle'), false);
  assert.equal(s.markWin('pirate', 'battle'), true);
  assert.equal(s.markWin('pirate', 'battle'), false);
  assert.equal(s.markWin('pirate', 'chess'), false);
});

test('progress calls without a current child do nothing', () => {
  const s = ST.create(memBackend());
  s.markSeen('rook');
  assert.equal(s.addSticker('robots', 'p'), 0);
  assert.equal(s.markWin('robots', 'catch'), false);
  assert.equal(s.progress(), null);
});

test('settings are validated and clamped', () => {
  const s = ST.create(memBackend());
  s.setSetting('calm', true);
  s.setSetting('breakOn', 'yes');
  s.setSetting('breakMins', 500);
  s.setSetting('evil', 1);
  assert.deepEqual(s.settings(), { calm: true, breakOn: true, breakMins: 60 });
  s.setSetting('breakMins', 2);
  assert.equal(s.settings().breakMins, 5);
});

test('returned objects are copies: changing them does not change the store', () => {
  const s = ST.create(memBackend());
  s.addProfile(PIC, 'A');
  s.progress().met.r = true;
  s.profiles()[0].name = 'Hacked';
  s.settings().calm = true;
  assert.equal(s.progress().met.r, undefined);
  assert.equal(s.current().name, 'A');
  assert.equal(s.settings().calm, false);
});

/* ---------- loading untrusted data ---------- */

test('data survives a reload through the backend', () => {
  const b = memBackend();
  const s1 = ST.create(b);
  s1.addProfile(PIC, 'అక్క');
  s1.markMet('b');
  s1.addSticker('space', 'n');
  const s2 = ST.create(b);
  assert.equal(s2.current().name, 'అక్క');
  assert.equal(s2.progress().met.b, true);
  assert.equal(s2.progress().stickers['space:n'], 1);
});

test('corrupted JSON falls back to defaults without throwing', () => {
  for (const raw of ['{', 'null', '[]', '42', '"x"', '{"v":1,"profiles":"no"}']) {
    const s = ST.create(memBackend({ [ST.STORAGE_KEY]: raw }));
    assert.deepEqual(s.profiles(), [], raw);
    assert.deepEqual(s.settings(), { calm: false, breakOn: true, breakMins: 15 }, raw);
  }
});

test('hostile documents are cleaned and never pollute Object.prototype', () => {
  const hostile = '{"v":1,"__proto__":{"polluted":1},"constructor":{"prototype":{"polluted":2}},' +
    '"settings":{"calm":"yes","breakOn":0,"breakMins":"9","__proto__":{"polluted":3}},' +
    '"current":"pzz","profiles":[' +
    '{"id":"pa","name":"' + 'n'.repeat(5000) + '","pic":{"theme":"mars","type":"x","ring":"red"},"created":"now"},' +
    '{"id":"pa","name":"dup"},{"id":"__proto__"},{"id":"pB"},"str",null,' +
    '{"id":"pb","pic":{"theme":"pirate","type":"k","ring":"' + ST.RINGS[2] + '"},"created":5}],' +
    '"progress":{"__proto__":{"polluted":4},"pa":{"seen":{"rook":true,"__proto__":true,"constructor":true,"BAD":true,"x":"yes"},' +
    '"met":{"r":true,"z":true},"stickers":{"robots:p":5,"robots:golden-k":1e9,"mars:p":3,"robots:p:x":1,"robots:q":-4},' +
    '"jar":"7","teams":{"robots":"b","mars":"a","pirate":"c"},"wins":{"robots:catch":true,"robots:chess":true,"robots:race":1},' +
    '"lang":"fr","theme":"dinos"}}}';
  const s = ST.create(memBackend({ [ST.STORAGE_KEY]: hostile }));
  assert.equal({}.polluted, undefined);
  assert.equal(Object.prototype.polluted, undefined);
  assert.deepEqual(s.settings(), { calm: false, breakOn: true, breakMins: 15 });
  const profiles = s.profiles();
  assert.deepEqual(profiles.map((p) => p.id), ['pa', 'pb']);
  assert.equal(profiles[0].name.length, 20);
  assert.deepEqual(profiles[0].pic, { theme: 'robots', type: 'n', ring: ST.RINGS[0] });
  assert.equal(profiles[0].created, 0);
  assert.deepEqual(profiles[1].pic, { theme: 'pirate', type: 'k', ring: ST.RINGS[2] });
  assert.equal(s.current().id, 'pa');
  const p = s.progress();
  assert.deepEqual(p.seen, { rook: true });
  assert.deepEqual(p.met, { r: true });
  assert.deepEqual(p.stickers, { 'robots:p': 5, 'robots:golden-k': 999 });
  assert.equal(p.jar, 0);
  assert.deepEqual(p.teams, { robots: 'b' });
  assert.deepEqual(p.wins, { 'robots:catch': true });
  assert.equal(p.lang, null);
  assert.equal(p.theme, 'dinos');
});

test('fifty profiles are cut to four', () => {
  const profiles = [];
  for (let i = 0; i < 50; i++) profiles.push({ id: 'p' + i, pic: PIC });
  const s = ST.create(memBackend({ [ST.STORAGE_KEY]: JSON.stringify({ v: 1, profiles }) }));
  assert.equal(s.profiles().length, 4);
});

test('a document from a newer version is left untouched (read-only)', () => {
  const raw = JSON.stringify({ v: 2, profiles: [{ id: 'pa' }], future: true });
  const b = memBackend({ [ST.STORAGE_KEY]: raw });
  const s = ST.create(b);
  assert.equal(s.readOnlyNewer, true);
  assert.equal(s.persistent, false);
  s.ensureProfile(PIC);
  s.markMet('r');
  assert.equal(b.map[ST.STORAGE_KEY], raw);
  assert.equal(s.progress().met.r, true); // still works in memory
});

/* ---------- storage that fails ---------- */

test('a backend that throws on write keeps working in memory with persistent false', () => {
  const b = memBackend();
  b.set = () => { throw new Error('QuotaExceededError'); };
  const s = ST.create(b);
  assert.equal(s.persistent, true);
  s.addProfile(PIC, 'A');
  assert.equal(s.persistent, false);
  s.markMet('q');
  assert.equal(s.progress().met.q, true);
});

test('a backend that throws on read, or no backend at all, works in memory', () => {
  const b = memBackend();
  b.get = () => { throw new Error('SecurityError'); };
  for (const backend of [b, null]) {
    const s = ST.create(backend);
    assert.equal(s.persistent, false);
    s.ensureProfile(PIC);
    s.markMet('k');
    assert.equal(s.progress().met.k, true);
  }
});

test('localBackend returns null outside a browser', () => {
  assert.equal(ST.localBackend(), null);
});

/* ---------- backup codes ---------- */

function filledStore(backend) {
  const s = ST.create(backend || memBackend());
  s.addProfile(PIC, 'అక్క');
  s.markSeen('rook');
  s.addSticker('pirate', 'golden-p');
  s.setLang('te');
  s.addProfile({ theme: 'space', type: 'b', ring: ST.RINGS[3] }, 'Ravi');
  s.setSetting('breakMins', 20);
  return s;
}

test('export then import restores everything, including Telugu names', () => {
  const code = filledStore().exportCode();
  assert.match(code, /^FC1\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/);
  const b = memBackend();
  const t = ST.create(b);
  t.ensureProfile(PIC);
  assert.deepEqual(t.importCode(code), { ok: true });
  assert.deepEqual(t.profiles().map((p) => p.name), ['అక్క', 'Ravi']);
  assert.equal(t.progress().stickers['pirate:golden-p'], 1);
  assert.equal(t.progress().lang, 'te');
  assert.equal(t.settings().breakMins, 20);
  assert.equal(saved(b).profiles.length, 2);
});

test('whitespace and line breaks inside a pasted code are ignored', () => {
  const code = filledStore().exportCode();
  const messy = '  ' + code.slice(0, 10) + '\n' + code.slice(10, 30) + ' \r\n\t' + code.slice(30) + '\n';
  assert.equal(ST.create(null).importCode(messy).ok, true);
});

test('a tampered code fails its checksum and changes nothing', () => {
  const code = filledStore().exportCode();
  const i = code.indexOf('.') + 5;
  const tampered = code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1);
  const b = memBackend();
  const t = ST.create(b);
  t.ensureProfile(PIC);
  const before = b.map[ST.STORAGE_KEY];
  assert.deepEqual(t.importCode(tampered), { ok: false, reason: 'checksum' });
  assert.equal(b.map[ST.STORAGE_KEY], before);
});

// Signs any text the way the store does, so tests can build codes whose
// checksum is valid but whose content is not.
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return ('00000000' + h.toString(16)).slice(-8);
}
function signed(text) {
  const payload = Buffer.from(text, 'utf8').toString('base64url');
  return 'FC1.' + payload + '.' + fnv1a(payload);
}

test('the store encoder matches standard base64url of UTF-8 JSON', () => {
  const code = filledStore().exportCode();
  const payload = code.split('.')[1];
  const doc = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  assert.equal(doc.profiles[0].name, 'అక్క');
  assert.equal(signed(JSON.stringify(doc)), code);
});

test('bad codes give a reason: format, version or data', () => {
  const s = ST.create(null);
  assert.equal(s.importCode('hello').reason, 'format');
  assert.equal(s.importCode('').reason, 'format');
  assert.equal(s.importCode(null).reason, 'format');
  assert.equal(s.importCode('FC1.abc').reason, 'format');
  assert.equal(s.importCode('FC2.abc.00000000').reason, 'version');
  // Valid checksums around content that is not usable.
  assert.equal(s.importCode(signed('not json')).reason, 'data');
  assert.equal(s.importCode(signed('[1,2]')).reason, 'data');
  assert.equal(s.importCode(signed('{"v":1,"profiles":[]}')).reason, 'data');
  assert.equal(s.importCode(signed('{"v":2,"profiles":[{"id":"pa"}]}')).reason, 'version');
  assert.equal(s.importCode(signed('{"v":1,"profiles":[{"id":"pa"}]}')).ok, true);
  assert.equal(s.importCode(signed('{"v":1,"profiles":[{"id":"pa","name":"\\u0000x"}],"__proto__":{"polluted":1}}')).ok, true);
  assert.equal({}.polluted, undefined);
});

test('clearAll removes the saved data and resets to no profiles', () => {
  const b = memBackend();
  const s = filledStore(b);
  s.clearAll();
  assert.equal(b.map[ST.STORAGE_KEY], undefined);
  assert.deepEqual(s.profiles(), []);
  assert.equal(s.current(), null);
  assert.deepEqual(s.settings(), { calm: false, breakOn: true, breakMins: 15 });
});

test('onChange runs after changes and can be unsubscribed', () => {
  const s = ST.create(memBackend());
  let n = 0;
  const off = s.onChange(() => { n++; });
  s.addProfile(PIC, 'A');
  s.markMet('r');
  s.markMet('r'); // no change, no call
  assert.equal(n, 2);
  off();
  s.markMet('b');
  assert.equal(n, 2);
});

test('the module adds no globals', () => {
  const before = new Set(Object.keys(globalThis));
  delete require.cache[require.resolve('../js/store.js')];
  require('../js/store.js');
  const added = Object.keys(globalThis).filter((k) => !before.has(k));
  assert.deepEqual(added, []);
});

/* ---------- progressOf (stage 5 UI) ---------- */

test('progressOf returns a copy of any child\'s progress, and null for an unknown id', () => {
  const s = ST.create(memBackend());
  const a = s.addProfile(PIC, 'A');
  const b = s.addProfile(PIC, 'B');
  s.addSticker('robots', 'p');
  s.setCurrent(b.id);
  s.addSticker('dinos', 'golden-p');
  assert.deepEqual(s.progressOf(a.id).stickers, { 'robots:p': 1 });
  assert.deepEqual(s.progressOf(b.id).stickers, { 'dinos:golden-p': 1 });
  assert.deepEqual(s.progressOf(b.id), s.progress());
  s.progressOf(a.id).stickers['robots:r'] = 5; // a copy: changing it changes nothing
  assert.deepEqual(s.progressOf(a.id).stickers, { 'robots:p': 1 });
  for (const bad of ['pnope', '', null, undefined, 7, '__proto__', 'constructor']) {
    assert.equal(s.progressOf(bad), null, String(bad));
  }
});
