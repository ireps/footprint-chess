/*
 * Footprint Chess: spoken lesson lines, in any language of the registry in
 * js/langs.js (English by default).
 *
 * For the current language (see setLang/getLang), say(id, done) walks that
 * language's fallback chain (FC.langs.fallbackChain: the language itself,
 * then its fallback, ending at the default language) and, for each language
 * in it, tries in order:
 *   1. a recorded clip in that language (audio/voice/<lang>/<id>.mp3,
 *      decoded through the shared AudioContext from js/sound.js). If the
 *      clip exists but is not decoded yet, say() waits for it (up to
 *      LOAD_WAIT_MS) instead of switching voice, so a lesson never mixes
 *      the recorded voice with a device voice;
 *   2. the device's speechSynthesis, speaking that language's text with a
 *      voice picked for that language;
 * and, once every language in the chain has been tried, silence, timed by
 * the line's estimated length so the lesson keeps its pacing. Today that
 * gives, for Telugu: Telugu clip, Telugu speech, English clip, English
 * speech, silence; for English: English clip, English speech, silence. The
 * default language never falls back to another language. Voice is always
 * optional: nothing in here may throw, and a caller's done callback is
 * always called exactly once, even if playback fails (unless a later
 * say()/stop() cancels the line first, which drops its callback).
 *
 * Two ways to speak:
 *   say(id, done)       narration: interrupts whatever is playing (and
 *                       clears the queue below); the interrupted line's
 *                       done is never called.
 *   sayAfter(id, done)  announcement: plays at once when nothing is
 *                       playing, otherwise waits its turn in a short queue
 *                       and plays when the current line has settled. A
 *                       later say() or stop() cancels the queue without
 *                       calling the queued callbacks.
 *
 * Depends on FC.sound (context/output/isEnabled), FC.langs (the language
 * registry) and FC.lessons (LINES), loaded before this file. Browser only
 * script: exposes window.FC.voice.
 */
(function (root) {
  'use strict';

  var FC = root.FC = root.FC || {};
  var S = FC.sound;
  var Ls = FC.langs;

  // Device speech is deliberately slower and a touch higher than the
  // browser default: it reads calmer and less flat to a young child.
  var SPEECH_RATE = 0.85;
  var SPEECH_PITCH = 1.1;

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
var playing = false;     // a line is sounding or waiting for its clip to load
var queue = [];          // sayAfter items waiting: { id, done, real }
var QUEUE_MAX = 4;

  var currentLang = Ls.DEFAULT_LANG;
  var cachedVoices = null; // null until first read; speechSynthesis.getVoices()

  /* ---------- language ---------- */

  function setLang(lang) {
    var next = Ls.isLang(lang) ? lang : Ls.DEFAULT_LANG;
    if (next !== currentLang) {
      // Only the current language's clips are kept decoded, to save memory
      // on a 2 GB tablet (about 25 MB of decoded audio per language).
      // Clips of a fallback language (English, for Telugu) are loaded on
      // demand (see say()), not kept.
      var keep = {};
      keep[next] = buffers[next] || {};
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

  // True if a voice's language tag is the registry's speech prefix, alone or
  // followed by a region ("en", "en-US", "te_IN").
  function voiceMatches(voice, prefix) {
    if (!voice.lang) return false;
    var tag = voice.lang.toLowerCase();
    return tag === prefix || tag.indexOf(prefix + '-') === 0 || tag.indexOf(prefix + '_') === 0;
  }

  /*
   * A device voice for lang: those whose language tag starts with the
   * registry's speech prefix, then that language's voicePrefs if it has any:
   * preferred names in order, then any name containing "female", then
   * voices not on the avoid list (with the preferred regions first), then
   * any. A language with no voicePrefs just gets a "female" voice if there
   * is one, else the first.
   */
  function pickVoice(lang) {
    var voices = getVoices();
    if (!voices.length) return null;
    var entry = Ls.get(lang);
    var prefix = (entry ? entry.speech : String(lang)).toLowerCase();
    var candidates = voices.filter(function (v) { return voiceMatches(v, prefix); });
    if (!candidates.length) return null;
    var prefs = (entry && entry.voicePrefs) || {};

    var names = prefs.preferNames || [];
    for (var i = 0; i < names.length; i++) {
      for (var j = 0; j < candidates.length; j++) {
        if (names[i].test(candidates[j].name)) return candidates[j];
      }
    }

    var female = candidates.filter(function (v) { return /female/i.test(v.name); });
    if (female.length) return female[0];

    // Skip voices known to be male before preferring a region, so a deep
    // en-IN or en-GB voice never wins over a softer one.
    var allowed = prefs.avoidNames
      ? candidates.filter(function (v) { return !prefs.avoidNames.test(v.name); })
      : candidates;

    var regions = prefs.preferRegions || [];
    for (var k = 0; k < regions.length; k++) {
      var inRegion = allowed.filter(function (v) { return v.lang.toLowerCase() === regions[k]; });
      if (inRegion.length) return inRegion[0];
    }

    if (allowed.length) return allowed[0];

    // Every voice is on the avoid list: a voice is still better than silence.
    return candidates[0];
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

  // Cancel the current line without calling its done. Leaves the queue
  // alone (say() clears it; the queue drain must not).
  function cancelCurrent() {
    token += 1;
    playing = false;
    clearActive();
  }

  // Stop the current line and drop the queue, calling no callbacks.
  function stop() {
    queue = [];
    cancelCurrent();
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

  // Loads, for each id, the clip in the first language of the current
  // language's fallback chain that has one (so, in Telugu, an English clip
  // for an id with no Telugu clip). done() when all have settled.
  function preload(ids, done) {
    done = done || function () {};
    var chain = Ls.fallbackChain(currentLang);
    var wanted = [];
    (ids || []).forEach(function (id) {
      for (var i = 0; i < chain.length; i++) {
        if (hasClip(chain[i], id)) { wanted.push([chain[i], id]); return; }
      }
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

  // Plays one line (cancelling any current line, but not the queue).
  function play(id, done) {
    done = typeof done === 'function' ? done : function () {};
    cancelCurrent();
    var myToken = token;
    playing = true;
    var line = FC.lessons && FC.lessons.LINES ? FC.lessons.LINES[id] : null;
    var ms = line ? line.ms : 1500;
    var settled = false;

    function finish() {
      if (settled || myToken !== token) return;
      settled = true;
      clearActive();
      playing = false;
      try {
        done();
      } finally {
        drain();
      }
    }

    // Silence, timed by the line's estimated length so pacing holds.
    function silence() {
      if (myToken !== token) return;
      activeTimer = root.setTimeout(finish, ms);
    }

    if (!S || !S.isEnabled || !S.isEnabled()) {
      silence();
      return;
    }

    // Recorded clip in lang; if it exists but is not decoded yet, wait for
    // it (up to LOAD_WAIT_MS) rather than switching voice. next() runs if
    // there is no such clip or it failed to load.
    function tryClip(lang, next) {
      if (myToken !== token) return;
      if (!hasClip(lang, id)) { next(); return; }
      if (playClip(lang, id, ms, finish)) return;
      var waited = false;
      var giveUp = root.setTimeout(function () {
        if (waited || myToken !== token) return;
        waited = true;
        next();
      }, LOAD_WAIT_MS);
      load(lang, id, function (ok) {
        if (waited || myToken !== token) return;
        waited = true;
        root.clearTimeout(giveUp);
        if (ok && playClip(lang, id, ms, finish)) return;
        next();
      });
    }

    function trySpeech(lang, next) {
      if (myToken !== token) return;
      if (line && playSpeech(lang, line[lang], ms, finish)) return;
      next();
    }

    // For each language in the fallback chain: its clip, then its speech;
    // then silence. (Telugu: te clip, te speech, en clip, en speech,
    // silence. English: en clip, en speech, silence.)
    var chain = Ls.fallbackChain(currentLang);
    function step(i) {
      if (i >= chain.length) { silence(); return; }
      var lang = chain[i];
      tryClip(lang, function () {
        trySpeech(lang, function () { step(i + 1); });
      });
    }
    step(0);
  }

  // Interrupts the current line and drops the queue. done is called when
  // the line ends, unless a later say()/stop() cancels it first.
  function say(id, done) {
    queue = [];
    play(id, done);
  }

  // Plays after the current line (and anything already queued) instead of
  // interrupting it. With nothing playing and nothing waiting it is exactly
  // say(). The queue holds at most QUEUE_MAX items: when full, the oldest
  // item with no callback is dropped to make room; an item whose done drives
  // a flow is never dropped (so the queue can exceed the cap only with such
  // items), and a new callback-less item is dropped when nothing can be.
  function sayAfter(id, done) {
    var real = typeof done === 'function';
    if (!playing && !queue.length) {
      say(id, done);
      return;
    }
    if (queue.length >= QUEUE_MAX) {
      var drop = -1;
      for (var i = 0; i < queue.length; i++) {
        if (!queue[i].real) { drop = i; break; }
      }
      if (drop !== -1) {
        queue.splice(drop, 1);
      } else if (!real) {
        return;
      }
    }
    queue.push({ id: id, done: done, real: real });
  }

  // Called when a line has settled and its done has run: plays the next
  // queued item, if any, without clearing the rest of the queue.
  function drain() {
    if (playing || !queue.length) return;
    var item = queue.shift();
    play(item.id, item.done);
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
    sayAfter: sayAfter,
    stop: stop,
    release: release
  };
})(this);
