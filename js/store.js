/*
 * Footprint Chess: the progress store (stage 5).
 *
 * Saves each child's picture profile, progress and stickers, and the
 * grown-ups' settings, in this browser's local storage on this device, under
 * one key (STORAGE_KEY). There is no login, no cookie and no backend; the
 * only way data leaves the device is a backup code the parent copies by hand
 * (exportCode / importCode). See PRIVACY.md.
 *
 * Stored data and backup codes are untrusted (they may be edited, corrupted
 * or written by a newer version), so every load and import is rebuilt field
 * by field from known keys and allowed values only (sanitize). Nothing here
 * throws: if storage is missing, blocked or full, the store keeps working in
 * memory and `persistent` reads false.
 *
 * The storage backend is injected: FC.store.create(FC.store.localBackend())
 * in the browser, a plain object in the tests.
 *
 * Classic script: exposes window.FC.store in the browser and module.exports
 * in Node, like js/themes.js. No DOM. Load after js/themes.js and
 * js/langs.js. Keep to ES2017 syntax.
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var TH = isNode ? require('./themes.js') : root.FC.themes;

  var VERSION = 1;
  var STORAGE_KEY = 'footprint-chess';
  var CODE_PREFIX = 'FC1';
  var MAX_PROFILES = 4;
  var NAME_MAX = 20;
  var MAX_SEEN = 200;
  var MAX_CODE_LENGTH = 200000;

  var TYPES = ['r', 'b', 'q', 'k', 'n', 'p'];
  var STICKER_KINDS = TYPES.concat(['golden-p', 'golden-k']);
  var GAME_IDS = ['catch', 'race', 'battle'];
  // Ring colours for a child's picture. Purple and bright green are left
  // out on purpose: they are the Watch and Your turn colours.
  var RINGS = ['#36c2ce', '#f59e2e', '#ec5f99', '#f5d23b', '#4d8fe0', '#e0604d', '#a0703c', '#5a6488'];

  var LESSON_RE = /^[a-z0-9-]{1,32}$/;
  var PROFILE_RE = /^p[0-9a-z]{1,12}$/;
  var BAD_KEYS = { '__proto__': true, 'constructor': true, 'prototype': true };
  // Control characters and bidirectional overrides are removed from names.
  var NAME_STRIP = /[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g;

  /* ---------- small helpers ---------- */

  function own(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }
  function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
  function dict() { return Object.create(null); }
  function copy(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }
  function goodKey(k) { return typeof k === 'string' && !BAD_KEYS[k]; }

  // Own keys of an untrusted object, never the dangerous ones.
  function keysOf(obj) {
    if (!isObj(obj)) return [];
    return Object.keys(obj).filter(goodKey);
  }

  function clampInt(v, lo, hi, def) {
    if (typeof v !== 'number' || !isFinite(v)) return def;
    return Math.min(hi, Math.max(lo, Math.round(v)));
  }

  function isTheme(id) { return typeof id === 'string' && TH.isTheme(id); }
  function isType(t) { return TYPES.indexOf(t) !== -1; }

  // The language registry (js/langs.js) when present; English and Telugu
  // otherwise. Kept in one place so it follows the registry.
  function langs() {
    if (isNode) {
      try { return require('./langs.js'); } catch (e) { return null; }
    }
    return (root.FC && root.FC.langs) || null;
  }
  function isLang(id) {
    if (typeof id !== 'string') return false;
    var L = langs();
    if (L && typeof L.isLang === 'function') return L.isLang(id);
    if (L && typeof L.ids === 'function') return L.ids().indexOf(id) !== -1;
    return id === 'en' || id === 'te';
  }

  function cleanName(s) {
    if (typeof s !== 'string') return '';
    var t = s.replace(NAME_STRIP, '').replace(/\s+/g, ' ').trim();
    return Array.from(t).slice(0, NAME_MAX).join('').trim();
  }

  /* ---------- the document ---------- */

  function defaultSettings() { return { calm: false, breakOn: true, breakMins: 15 }; }

  function defaults() {
    return { v: VERSION, settings: defaultSettings(), current: null, profiles: [], progress: dict() };
  }

  function emptyProgress() {
    return { seen: dict(), met: dict(), stickers: dict(), jar: 0, teams: dict(), wins: dict(), lang: null, theme: null };
  }

  var DEFAULT_PIC = { theme: 'robots', type: 'n', ring: RINGS[0] };

  function sanitizePic(p) {
    var src = isObj(p) ? p : {};
    return {
      theme: isTheme(src.theme) ? src.theme : DEFAULT_PIC.theme,
      type: isType(src.type) ? src.type : DEFAULT_PIC.type,
      ring: RINGS.indexOf(src.ring) !== -1 ? src.ring : DEFAULT_PIC.ring
    };
  }

  function sanitizeSettings(s) {
    var out = defaultSettings();
    if (!isObj(s)) return out;
    if (typeof s.calm === 'boolean') out.calm = s.calm;
    if (typeof s.breakOn === 'boolean') out.breakOn = s.breakOn;
    out.breakMins = clampInt(s.breakMins, 5, 60, out.breakMins);
    return out;
  }

  function sanitizeProgress(p) {
    var out = emptyProgress();
    if (!isObj(p)) return out;
    var n = 0;
    keysOf(p.seen).forEach(function (k) {
      if (n < MAX_SEEN && LESSON_RE.test(k) && p.seen[k] === true) { out.seen[k] = true; n++; }
    });
    keysOf(p.met).forEach(function (k) {
      if (isType(k) && p.met[k] === true) out.met[k] = true;
    });
    keysOf(p.stickers).forEach(function (k) {
      var parts = k.split(':');
      if (parts.length !== 2 || !isTheme(parts[0]) || STICKER_KINDS.indexOf(parts[1]) === -1) return;
      var count = clampInt(p.stickers[k], 0, 999, 0);
      if (count >= 1) out.stickers[k] = count;
    });
    out.jar = clampInt(p.jar, 0, 9, 0);
    keysOf(p.teams).forEach(function (k) {
      if (isTheme(k) && (p.teams[k] === 'a' || p.teams[k] === 'b')) out.teams[k] = p.teams[k];
    });
    keysOf(p.wins).forEach(function (k) {
      var parts = k.split(':');
      if (parts.length === 2 && isTheme(parts[0]) && GAME_IDS.indexOf(parts[1]) !== -1 && p.wins[k] === true) out.wins[k] = true;
    });
    out.lang = isLang(p.lang) ? p.lang : null;
    out.theme = isTheme(p.theme) ? p.theme : null;
    return out;
  }

  // Only version 1 exists; later versions add steps here.
  function migrate(doc) {
    return doc;
  }

  // Rebuilds a document from untrusted input, keeping only known keys and
  // allowed values. Always returns a valid version-1 document.
  function sanitize(input) {
    var out = defaults();
    if (!isObj(input)) return out;
    var doc = migrate(input);
    out.settings = sanitizeSettings(doc.settings);
    var list = Array.isArray(doc.profiles) ? doc.profiles.slice(0, 50) : [];
    var ids = dict();
    list.forEach(function (p) {
      if (out.profiles.length >= MAX_PROFILES || !isObj(p)) return;
      if (typeof p.id !== 'string' || !PROFILE_RE.test(p.id) || ids[p.id]) return;
      ids[p.id] = true;
      out.profiles.push({
        id: p.id,
        name: cleanName(p.name),
        pic: sanitizePic(p.pic),
        created: (typeof p.created === 'number' && isFinite(p.created)) ? p.created : 0
      });
    });
    var progress = isObj(doc.progress) ? doc.progress : {};
    out.profiles.forEach(function (p) {
      out.progress[p.id] = sanitizeProgress(own(progress, p.id) ? progress[p.id] : null);
    });
    if (typeof doc.current === 'string' && ids[doc.current]) {
      out.current = doc.current;
    } else {
      out.current = out.profiles.length ? out.profiles[0].id : null;
    }
    return out;
  }

  /* ---------- backup code: FC1.<base64url of UTF-8 JSON>.<FNV-1a> ---------- */

  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

  // A string of UTF-8 bytes (one char per byte) from a JS string.
  function toUtf8Bytes(str) {
    var enc = encodeURIComponent(str);
    var out = '';
    for (var i = 0; i < enc.length; i++) {
      if (enc.charAt(i) === '%') {
        out += String.fromCharCode(parseInt(enc.substr(i + 1, 2), 16));
        i += 2;
      } else {
        out += enc.charAt(i);
      }
    }
    return out;
  }

  // Throws (URIError) on bytes that are not valid UTF-8.
  function fromUtf8Bytes(bytes) {
    var enc = '';
    for (var i = 0; i < bytes.length; i++) {
      var h = bytes.charCodeAt(i).toString(16);
      enc += '%' + (h.length < 2 ? '0' + h : h);
    }
    return decodeURIComponent(enc);
  }

  function b64urlEncode(bytes) {
    var out = '';
    for (var i = 0; i < bytes.length; i += 3) {
      var a = bytes.charCodeAt(i);
      var b = i + 1 < bytes.length ? bytes.charCodeAt(i + 1) : -1;
      var c = i + 2 < bytes.length ? bytes.charCodeAt(i + 2) : -1;
      out += B64.charAt(a >> 2);
      out += B64.charAt(((a & 3) << 4) | (b === -1 ? 0 : b >> 4));
      if (b !== -1) out += B64.charAt(((b & 15) << 2) | (c === -1 ? 0 : c >> 6));
      if (c !== -1) out += B64.charAt(c & 63);
    }
    return out;
  }

  // Returns null for characters outside the alphabet or an impossible length.
  function b64urlDecode(str) {
    if (str.length % 4 === 1) return null;
    var out = '';
    var bits = 0;
    var value = 0;
    for (var i = 0; i < str.length; i++) {
      var idx = B64.indexOf(str.charAt(i));
      if (idx === -1) return null;
      value = ((value << 6) | idx) & 0xffffff;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        out += String.fromCharCode((value >> bits) & 255);
      }
    }
    return out;
  }

  function fnv1a(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  function encodeCode(doc) {
    var payload = b64urlEncode(toUtf8Bytes(JSON.stringify(sanitize(doc))));
    return CODE_PREFIX + '.' + payload + '.' + fnv1a(payload);
  }

  // { ok: true, doc } or { ok: false, reason: 'format' | 'checksum' | 'version' | 'data' }.
  function decodeCode(code) {
    if (typeof code !== 'string') return { ok: false, reason: 'format' };
    var s = code.replace(/\s+/g, '');
    if (!s || s.length > MAX_CODE_LENGTH) return { ok: false, reason: 'format' };
    var other = /^FC(\d+)\./.exec(s);
    if (other && other[1] !== '1') return { ok: false, reason: 'version' };
    var m = /^FC1\.([A-Za-z0-9_-]+)\.([0-9a-f]{8})$/.exec(s);
    if (!m) return { ok: false, reason: 'format' };
    if (fnv1a(m[1]) !== m[2]) return { ok: false, reason: 'checksum' };
    var parsed;
    try {
      var bytes = b64urlDecode(m[1]);
      if (bytes === null) return { ok: false, reason: 'data' };
      parsed = JSON.parse(fromUtf8Bytes(bytes));
    } catch (e) {
      return { ok: false, reason: 'data' };
    }
    if (!isObj(parsed)) return { ok: false, reason: 'data' };
    if (typeof parsed.v === 'number' && parsed.v > VERSION) return { ok: false, reason: 'version' };
    var doc = sanitize(parsed);
    if (!doc.profiles.length) return { ok: false, reason: 'data' };
    return { ok: true, doc: doc };
  }

  /* ---------- browser storage backend ---------- */

  // A thin wrapper over window.localStorage, or null if it is missing or
  // refuses a test write (private browsing, blocked site data).
  function localBackend() {
    try {
      var ls = root.localStorage;
      if (!ls) return null;
      var probe = STORAGE_KEY + '.probe';
      ls.setItem(probe, '1');
      ls.removeItem(probe);
      return {
        get: function (k) { return ls.getItem(k); },
        set: function (k, v) { ls.setItem(k, v); },
        remove: function (k) { ls.removeItem(k); }
      };
    } catch (e) {
      return null;
    }
  }

  /* ---------- the store ---------- */

  function newId(taken) {
    for (var i = 0; i < 20; i++) {
      var id = ('p' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36)).slice(0, 13);
      if (PROFILE_RE.test(id) && !taken[id]) return id;
    }
    return ('p' + Math.floor(Math.random() * 1e12).toString(36)).slice(0, 13);
  }

  function create(backend) {
    var persistent = !!backend;
    var readOnlyNewer = false;
    var listeners = [];
    var doc = defaults();

    // Load.
    var raw = null;
    if (backend) {
      try { raw = backend.get(STORAGE_KEY); } catch (e) { persistent = false; raw = null; }
    }
    if (typeof raw === 'string') {
      var parsed = null;
      try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
      if (isObj(parsed) && typeof parsed.v === 'number' && parsed.v > VERSION) {
        // Saved by a newer version: never overwrite it from here.
        readOnlyNewer = true;
        persistent = false;
      } else {
        doc = sanitize(parsed);
      }
    }

    function save() {
      if (!persistent || readOnlyNewer || !backend) return;
      try {
        backend.set(STORAGE_KEY, JSON.stringify(doc));
      } catch (e) {
        persistent = false;
      }
    }

    function notify() {
      listeners.slice().forEach(function (fn) {
        try { fn(); } catch (e) { /* a listener's problem must not stop the store */ }
      });
    }

    function changed() {
      save();
      notify();
    }

    function findProfile(id) {
      for (var i = 0; i < doc.profiles.length; i++) {
        if (doc.profiles[i].id === id) return doc.profiles[i];
      }
      return null;
    }

    function cur() {
      return doc.current ? doc.progress[doc.current] : null;
    }

    function takenIds() {
      var t = dict();
      doc.profiles.forEach(function (p) { t[p.id] = true; });
      return t;
    }

    var api = {
      settings: function () { return copy(doc.settings); },
      setSetting: function (key, value) {
        var next = copy(doc.settings);
        next[key] = value;
        var clean = sanitizeSettings(next);
        if (JSON.stringify(clean) === JSON.stringify(doc.settings)) return;
        doc.settings = clean;
        changed();
      },

      profiles: function () { return copy(doc.profiles); },
      current: function () {
        var p = findProfile(doc.current);
        return p ? copy(p) : null;
      },
      setCurrent: function (id) {
        if (!findProfile(id) || doc.current === id) return;
        doc.current = id;
        changed();
      },
      addProfile: function (pic, name) {
        if (doc.profiles.length >= MAX_PROFILES) return null;
        var p = { id: newId(takenIds()), name: cleanName(name), pic: sanitizePic(pic), created: Date.now() };
        doc.profiles.push(p);
        doc.progress[p.id] = emptyProgress();
        if (!doc.current) doc.current = p.id;
        changed();
        return copy(p);
      },
      updateProfile: function (id, fields) {
        var p = findProfile(id);
        if (!p || !isObj(fields)) return;
        if (own(fields, 'name')) p.name = cleanName(fields.name);
        if (own(fields, 'pic')) p.pic = sanitizePic(fields.pic);
        changed();
      },
      removeProfile: function (id) {
        var i = -1;
        doc.profiles.forEach(function (p, j) { if (p.id === id) i = j; });
        if (i === -1) return;
        doc.profiles.splice(i, 1);
        delete doc.progress[id];
        if (doc.current === id) doc.current = doc.profiles.length ? doc.profiles[0].id : null;
        changed();
      },
      ensureProfile: function (defaultPic) {
        if (!doc.profiles.length) api.addProfile(defaultPic || DEFAULT_PIC, '');
        return api.current();
      },

      progress: function () {
        var p = cur();
        return p ? copy(p) : null;
      },
      markSeen: function (lessonId) {
        var p = cur();
        if (!p || typeof lessonId !== 'string' || !LESSON_RE.test(lessonId) || BAD_KEYS[lessonId] || p.seen[lessonId]) return;
        if (Object.keys(p.seen).length >= MAX_SEEN) return;
        p.seen[lessonId] = true;
        changed();
      },
      markMet: function (type) {
        var p = cur();
        if (!p || !isType(type) || p.met[type]) return;
        p.met[type] = true;
        changed();
      },
      addSticker: function (theme, kind) {
        var p = cur();
        if (!p || !isTheme(theme) || STICKER_KINDS.indexOf(kind) === -1) return 0;
        var k = theme + ':' + kind;
        p.stickers[k] = Math.min(999, (p.stickers[k] || 0) + 1);
        changed();
        return p.stickers[k];
      },
      setJar: function (n) {
        var p = cur();
        if (!p) return;
        var v = clampInt(n, 0, 9, 0);
        if (v === p.jar) return;
        p.jar = v;
        changed();
      },
      setTeam: function (theme, side) {
        var p = cur();
        if (!p || !isTheme(theme) || (side !== 'a' && side !== 'b') || p.teams[theme] === side) return;
        p.teams[theme] = side;
        changed();
      },
      // True exactly when this call completes all three games in the theme
      // for the first time (the caller then awards the golden king).
      markWin: function (theme, gameId) {
        var p = cur();
        if (!p || !isTheme(theme) || GAME_IDS.indexOf(gameId) === -1) return false;
        var k = theme + ':' + gameId;
        if (p.wins[k]) return false;
        p.wins[k] = true;
        changed();
        return GAME_IDS.every(function (g) { return p.wins[theme + ':' + g] === true; });
      },
      setLang: function (id) {
        var p = cur();
        if (!p || !isLang(id) || p.lang === id) return;
        p.lang = id;
        changed();
      },
      setTheme: function (id) {
        var p = cur();
        if (!p || !isTheme(id) || p.theme === id) return;
        p.theme = id;
        changed();
      },

      exportCode: function () { return encodeCode(doc); },
      importCode: function (code) {
        var res = decodeCode(code);
        if (!res.ok) return { ok: false, reason: res.reason };
        doc = res.doc;
        readOnlyNewer = false;
        persistent = !!backend;
        changed();
        return { ok: true };
      },
      clearAll: function () {
        doc = defaults();
        readOnlyNewer = false;
        persistent = !!backend;
        if (backend) {
          try { backend.remove(STORAGE_KEY); } catch (e) { persistent = false; }
        }
        notify();
      },

      // fn runs after every change; returns a function that unsubscribes.
      onChange: function (fn) {
        if (typeof fn !== 'function') return function () {};
        listeners.push(fn);
        return function () {
          listeners = listeners.filter(function (f) { return f !== fn; });
        };
      }
    };

    Object.defineProperty(api, 'persistent', { get: function () { return persistent; }, enumerable: true });
    Object.defineProperty(api, 'readOnlyNewer', { get: function () { return readOnlyNewer; }, enumerable: true });
    return api;
  }

  var exported = {
    VERSION: VERSION,
    STORAGE_KEY: STORAGE_KEY,
    MAX_PROFILES: MAX_PROFILES,
    RINGS: RINGS,
    STICKER_KINDS: STICKER_KINDS,
    GAME_IDS: GAME_IDS,
    DEFAULT_PIC: DEFAULT_PIC,
    create: create,
    localBackend: localBackend,
    sanitize: sanitize,
    encodeCode: encodeCode,
    decodeCode: decodeCode
  };

  if (isNode) {
    module.exports = exported;
  } else {
    root.FC = root.FC || {};
    root.FC.store = exported;
  }
})(this);
