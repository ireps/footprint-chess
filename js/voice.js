/*
 * Footprint Chess: spoken lesson lines, in English (default) or Telugu.
 *
 * For the current language (see setLang/getLang), say(id, done) tries, in
 * order:
 *   1. a recorded clip in that language (audio/voice/<lang>/<id>.mp3,
 *      decoded through the shared AudioContext from js/sound.js). If the
 *      clip exists but is not decoded yet, say() waits for it (up to
 *      LOAD_WAIT_MS) instead of switching voice, so a lesson never mixes
 *      the recorded voice with a device voice;
 *   2. the device's speechSynthesis, speaking that language's text with a
 *      voice picked for that language;
 *   3. when the language is Telugu only, step 1 again in English;
 *   4. when the language is Telugu only, step 2 again in English;
 *   5. otherwise, silence, timed by the line's estimated length so the
 *      lesson keeps its pacing.
 * English never falls back to Telugu. Voice is always optional: nothing in
 * here may throw, and a caller's done callback is always called exactly
 * once, even if playback fails.
 *
 * Depends on FC.sound (context/output/isEnabled) and FC.lessons (LANGS,
 * DEFAULT_LANG, LINES), loaded before this file. Browser only script:
 * exposes window.FC.voice.
 */
(function (root) {
  'use strict';

  var FC = root.FC = root.FC || {};
  var S = FC.sound;

  // Device speech is deliberately slower and a touch higher than the
  // browser default: it reads calmer and less flat to a young child.
  var SPEECH_RATE = 0.85;
  var SPEECH_PITCH = 1.1;

  // Ordered by preference: the first English voice whose name matches an
  // earlier entry wins. Chosen for a warm, clearly-spoken tone rather than
  // a flat default voice.
  var EN_PREFERRED_NAMES = [
    /Google UK English Female/,
    /Google US English/,
    /Heera/,
    /Neerja/,
    /Zira/,
    /Samantha/,
    /Karen/,
    /Moira/,
    /Tessa/,
    /Salli|Joanna|Kendra|Kimberly|Ivy|Amy|Emma|Raveena|Aditi/
  ];
  var EN_MALE_NAMES = /David|Mark|Ravi|Male|Guy|Brian|Joey|Justin|Matthew|Russell/;

  // How long say() waits for a clip that is still loading before it gives
  // up and falls back. Long enough for a slow tablet on Wi-Fi.
  var LOAD_WAIT_MS = 6000;
  // Background preloading fetches this many clips at a time, so it does not
  // compete with the lesson on a slow device.
  var PRELOAD_CONCURRENCY = 2;

  var buffers = {};    // lang -> { id -> decoded AudioBuffer }
  var loading = {};    // "lang/id" -> [callbacks waiting for that clip]
  var token = 0;        // bumped by stop()/say() so stale callbacks are ignored
  var activeTimer = null;
  var activeSource = null;
  var activeUtterance = null;

  var currentLang = (FC.lessons && FC.lessons.DEFAULT_LANG) || 'en';
  var cachedVoices = null; // null until first read; speechSynthesis.getVoices()

  /* ---------- language ---------- */

  function setLang(lang) {
    var langs = (FC.lessons && FC.lessons.LANGS) || ['en'];
    var def = (FC.lessons && FC.lessons.DEFAULT_LANG) || 'en';
    var next = langs.indexOf(lang) !== -1 ? lang : def;
    if (next !== currentLang) {
      // Only the current language's clips are kept decoded, to save memory
      // on a 2 GB tablet (about 25 MB of decoded audio per language).
      var keep = {};
      keep[next] = buffers[next] || {};
      if (next === 'te' && buffers.en) keep.en = buffers.en;
      buffers = keep;
    }
    currentLang = next;
  }

  function getLang() {
    return currentLang;
  }

  /* ---------- device voice list ---------- */

  function refreshVoices() {
    try {
      cachedVoices = (root.speechSynthesis && root.speechSynthesis.getVoices()) || [];
    } catch (e) {
      cachedVoices = [];
    }
  }

  function getVoices() {
    if (!root.speechSynthesis || typeof root.speechSynthesis.getVoices !== 'function') return [];
    if (cachedVoices === null) refreshVoices();
    return cachedVoices || [];
  }

  // Voice lists on many browsers load asynchronously; getVoices() can
  // return [] on the very first call. Cache what we have and refresh it
  // when the browser says the list changed, without discarding a handler
  // some other script may already have set.
  (function watchVoicesChanged() {
    try {
      var synth = root.speechSynthesis;
      if (!synth) return;
      if (typeof synth.addEventListener === 'function') {
        synth.addEventListener('voiceschanged', refreshVoices);
      } else {
        var existing = synth.onvoiceschanged;
        synth.onvoiceschanged = function (ev) {
          refreshVoices();
          if (typeof existing === 'function') existing.call(this, ev);
        };
      }
    } catch (e) {
      // Optional feature; ignore.
    }
  })();

  function pickTeluguVoice(voices) {
    var candidates = voices.filter(function (v) {
      return v.lang && v.lang.slice(0, 2).toLowerCase() === 'te';
    });
    if (!candidates.length) return null;
    var female = candidates.filter(function (v) { return /female/i.test(v.name); });
    return female[0] || candidates[0];
  }

  function pickEnglishVoice(voices) {
    var en = voices.filter(function (v) {
      return v.lang && v.lang.slice(0, 2).toLowerCase() === 'en';
    });
    if (!en.length) return null;

    for (var i = 0; i < EN_PREFERRED_NAMES.length; i++) {
      var re = EN_PREFERRED_NAMES[i];
      for (var j = 0; j < en.length; j++) {
        if (re.test(en[j].name)) return en[j];
      }
    }

    var female = en.filter(function (v) { return /female/i.test(v.name); });
    if (female.length) return female[0];

    // Skip voices known to be male before preferring a region, so a deep
    // en-IN or en-GB voice never wins over a softer one.
    var notMale = en.filter(function (v) { return !EN_MALE_NAMES.test(v.name); });

    var enIN = notMale.filter(function (v) { return v.lang.toLowerCase() === 'en-in'; });
    if (enIN.length) return enIN[0];

    var enGB = notMale.filter(function (v) { return v.lang.toLowerCase() === 'en-gb'; });
    if (enGB.length) return enGB[0];

    if (notMale.length) return notMale[0];

    // Every English voice is on the avoid list: a voice is still better than silence.
    return en[0];
  }

  function pickVoice(lang) {
    var voices = getVoices();
    if (!voices.length) return null;
    return lang === 'te' ? pickTeluguVoice(voices) : pickEnglishVoice(voices);
  }

  /* ---------- playback plumbing ---------- */

  // Cancel whatever is currently sounding, without touching token or done.
  function clearActive() {
    if (activeTimer !== null) {
      root.clearTimeout(activeTimer);
      activeTimer = null;
    }
    if (activeSource) {
      try {
        activeSource.onended = null;
        activeSource.stop();
      } catch (e) {
        // Already stopped or never started; nothing to do.
      }
      activeSource = null;
    }
    if (activeUtterance) {
      try {
        activeUtterance.onend = null;
        activeUtterance.onerror = null;
        if (root.speechSynthesis) root.speechSynthesis.cancel();
      } catch (e) {
        // Optional feature; ignore.
      }
      activeUtterance = null;
    }
  }

  // Stop the current line without calling its done.
  function stop() {
    token += 1;
    clearActive();
  }

  function hasClip(lang, id) {
    var list = (FC.voiceClips || {})[lang] || [];
    return list.indexOf(id) !== -1;
  }

  function decoded(lang, id) {
    return !!(buffers[lang] && buffers[lang][id]);
  }

  /*
   * Fetches and decodes one clip once, however many callers ask for it.
   * cb(ok) is called when the clip is decoded (true) or failed (false).
   */
  function load(lang, id, cb) {
    cb = cb || function () {};
    if (decoded(lang, id)) { cb(true); return; }
    var ctx = S && S.context ? S.context() : null;
    if (!ctx || typeof root.fetch !== 'function' || typeof ctx.decodeAudioData !== 'function' || !hasClip(lang, id)) {
      cb(false);
      return;
    }
    var k = lang + '/' + id;
    if (loading[k]) { loading[k].push(cb); return; }
    loading[k] = [cb];
    function settle(ok) {
      var waiting = loading[k] || [];
      delete loading[k];
      waiting.forEach(function (fn) {
        try { fn(ok); } catch (e) { /* a caller's problem must not stop the others */ }
      });
    }
    try {
      root.fetch('audio/voice/' + lang + '/' + id + '.mp3').then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.arrayBuffer();
      }).then(function (data) {
        ctx.decodeAudioData(data, function (buf) {
          buffers[lang] = buffers[lang] || {};
          buffers[lang][id] = buf;
          settle(true);
        }, function () { settle(false); });
      }).catch(function () { settle(false); });
    } catch (e) {
      settle(false);
    }
  }

  // Loads the current language's clips for ids (and, in Telugu, English
  // clips for ids with no Telugu clip). done() when all have settled.
  function preload(ids, done) {
    done = done || function () {};
    var lang = currentLang;
    var wanted = [];
    (ids || []).forEach(function (id) {
      if (hasClip(lang, id)) wanted.push([lang, id]);
      else if (lang === 'te' && hasClip('en', id)) wanted.push(['en', id]);
    });
    var remaining = wanted.length;
    if (!remaining) { done(); return; }
    wanted.forEach(function (w) {
      load(w[0], w[1], function () {
        remaining -= 1;
        if (remaining === 0) done();
      });
    });
  }

  // Quietly loads every clip of the current language, a few at a time.
  // Called after the first tap (when audio is unlocked) and after a
  // language switch, so later lines never have to wait.
  function preloadAll() {
    var lang = currentLang;
    var queue = ((FC.voiceClips || {})[lang] || []).filter(function (id) { return !decoded(lang, id); });
    var running = 0;
    function pump() {
      while (running < PRELOAD_CONCURRENCY && queue.length && lang === currentLang) {
        running += 1;
        load(lang, queue.shift(), function () {
          running -= 1;
          pump();
        });
      }
    }
    pump();
  }

  // Tries to play a decoded clip for lang/id. Returns true if playback was
  // started (finish will be called later, by onended or the guard timer).
  function playClip(lang, id, ms, finish) {
    try {
      var ctx = S.context ? S.context() : null;
      var out = S.output ? S.output() : null;
      var buf = buffers[lang] && buffers[lang][id];
      if (ctx && out && buf) {
        var source = ctx.createBufferSource();
        source.buffer = buf;
        source.connect(out);
        activeSource = source;
        source.onended = finish;
        // Guard in case onended never fires; based on the real clip length.
        activeTimer = root.setTimeout(finish, Math.max(ms, buf.duration * 1000) + 1500);
        source.start(0);
        return true;
      }
    } catch (e) {
      clearActive();
    }
    return false;
  }

  // Tries device speech for lang/text. Returns true if playback was
  // started.
  function playSpeech(lang, text, ms, finish) {
    try {
      if (root.speechSynthesis && root.SpeechSynthesisUtterance && text) {
        var voice = pickVoice(lang);
        if (voice) {
          var utter = new root.SpeechSynthesisUtterance(text);
          utter.voice = voice;
          utter.lang = voice.lang;
          utter.rate = SPEECH_RATE;
          utter.pitch = SPEECH_PITCH;
          activeUtterance = utter;
          utter.onend = finish;
          utter.onerror = finish;
          activeTimer = root.setTimeout(finish, ms + 3000);
          root.speechSynthesis.speak(utter);
          return true;
        }
      }
    } catch (e) {
      clearActive();
    }
    return false;
  }

  function say(id, done) {
    done = done || function () {};
    stop();
    var myToken = token;
    var line = FC.lessons && FC.lessons.LINES ? FC.lessons.LINES[id] : null;
    var ms = line ? line.ms : 1500;
    var settled = false;

    function finish() {
      if (settled || myToken !== token) return;
      settled = true;
      clearActive();
      done();
    }

    if (!S || !S.isEnabled || !S.isEnabled()) {
      activeTimer = root.setTimeout(finish, ms);
      return;
    }

    var lang = currentLang;

    function fallBack() {
      if (myToken !== token) return;
      if (line && playSpeech(lang, line[lang], ms, finish)) return;
      if (lang === 'te') {
        if (playClip('en', id, ms, finish)) return;
        if (line && playSpeech('en', line.en, ms, finish)) return;
      }
      activeTimer = root.setTimeout(finish, ms);
    }

    if (!hasClip(lang, id)) {
      fallBack();
      return;
    }
    if (playClip(lang, id, ms, finish)) return;

    // The clip exists but is not decoded yet: wait for it rather than
    // switching to a different voice.
    var waited = false;
    var giveUp = root.setTimeout(function () {
      if (waited) return;
      waited = true;
      fallBack();
    }, LOAD_WAIT_MS);
    load(lang, id, function (ok) {
      if (waited || myToken !== token) return;
      waited = true;
      root.clearTimeout(giveUp);
      if (ok && playClip(lang, id, ms, finish)) return;
      fallBack();
    });
  }

  function release() {
    stop();
    buffers = {};
  }

  FC.voice = {
    setLang: setLang,
    getLang: getLang,
    preload: preload,
    preloadAll: preloadAll,
    say: say,
    stop: stop,
    release: release
  };
})(this);
