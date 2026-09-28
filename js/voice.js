/*
 * Footprint Chess: spoken lesson lines, in English (default) or Telugu.
 *
 * For the current language (see setLang/getLang), say(id, done) tries, in
 * order:
 *   1. a recorded clip in that language (audio/voice/<lang>/<id>.mp3,
 *      decoded through the shared AudioContext from js/sound.js);
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

  var buffers = {};    // lang -> { id -> decoded AudioBuffer }
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
    currentLang = langs.indexOf(lang) !== -1 ? lang : def;
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

  /*
   * Preloads the current language's clips for ids, and, when the current
   * language is Telugu, also the English clips for ids that have no
   * Telugu clip (so the fallback in say() does not need a network round
   * trip the first time it is needed).
   */
  function preload(ids, done) {
    done = done || function () {};
    try {
      var ctx = S && S.context ? S.context() : null;
      if (!ctx || typeof root.fetch !== 'function' || typeof ctx.decodeAudioData !== 'function') {
        done();
        return;
      }
      var lang = currentLang;
      var clipsByLang = FC.voiceClips || {};
      var langClips = clipsByLang[lang] || [];
      var wanted = [];

      (ids || []).forEach(function (id) {
        if (langClips.indexOf(id) !== -1 && !(buffers[lang] && buffers[lang][id])) {
          wanted.push({ lang: lang, id: id });
        }
      });

      if (lang === 'te') {
        var enClips = clipsByLang.en || [];
        (ids || []).forEach(function (id) {
          if (langClips.indexOf(id) === -1 && enClips.indexOf(id) !== -1 &&
              !(buffers.en && buffers.en[id])) {
            wanted.push({ lang: 'en', id: id });
          }
        });
      }

      if (!wanted.length) {
        done();
        return;
      }
      var remaining = wanted.length;
      var settled = false;
      function settle() {
        remaining -= 1;
        if (remaining <= 0 && !settled) {
          settled = true;
          done();
        }
      }
      wanted.forEach(function (w) {
        try {
          root.fetch('audio/voice/' + w.lang + '/' + w.id + '.mp3').then(function (res) {
            return res.arrayBuffer();
          }).then(function (data) {
            try {
              ctx.decodeAudioData(data, function (buf) {
                buffers[w.lang] = buffers[w.lang] || {};
                buffers[w.lang][w.id] = buf;
                settle();
              }, function () { settle(); });
            } catch (e) {
              settle();
            }
          }).catch(function () { settle(); });
        } catch (e) {
          settle();
        }
      });
    } catch (e) {
      done();
    }
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
        activeTimer = root.setTimeout(finish, ms + 3000);
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

    if (playClip(lang, id, ms, finish)) return;
    if (line && playSpeech(lang, line[lang], ms, finish)) return;

    if (lang === 'te') {
      if (playClip('en', id, ms, finish)) return;
      if (line && playSpeech('en', line.en, ms, finish)) return;
    }

    activeTimer = root.setTimeout(finish, ms);
  }

  function release() {
    stop();
    buffers = {};
  }

  FC.voice = {
    setLang: setLang,
    getLang: getLang,
    preload: preload,
    say: say,
    stop: stop,
    release: release
  };
})(this);
