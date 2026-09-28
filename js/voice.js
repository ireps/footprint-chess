/*
 * Footprint Chess: spoken lesson lines.
 *
 * Plays a recorded clip (audio/voice/<id>.mp3, decoded through the shared
 * AudioContext from js/sound.js) when one is available, falls back to
 * speechSynthesis when it is not, and otherwise stays silent but keeps the
 * lesson's pacing using the estimated line length in FC.lessons.LINES.
 * Voice is always optional: nothing in here may throw, and a caller's done
 * callback is always called exactly once, even if playback fails.
 *
 * Depends on FC.sound (context/output/isEnabled) and FC.lessons.LINES,
 * loaded before this file. Browser only script: exposes window.FC.voice.
 */
(function (root) {
  'use strict';

  var FC = root.FC = root.FC || {};
  var S = FC.sound;

  var buffers = {};   // id -> decoded AudioBuffer
  var token = 0;       // bumped by stop()/say() so stale callbacks are ignored
  var activeTimer = null;
  var activeSource = null;
  var activeUtterance = null;

  function englishVoice() {
    if (!root.speechSynthesis || typeof root.speechSynthesis.getVoices !== 'function') return null;
    var voices = root.speechSynthesis.getVoices() || [];
    for (var i = 0; i < voices.length; i++) {
      var lang = voices[i] && voices[i].lang;
      if (lang && lang.slice(0, 2).toLowerCase() === 'en') return voices[i];
    }
    return null;
  }

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

  function preload(ids, done) {
    done = done || function () {};
    try {
      var ctx = S && S.context ? S.context() : null;
      if (!ctx || typeof root.fetch !== 'function' || typeof ctx.decodeAudioData !== 'function') {
        done();
        return;
      }
      var clips = FC.voiceClips || [];
      var list = (ids || []).filter(function (id) {
        return clips.indexOf(id) !== -1 && !buffers[id];
      });
      if (!list.length) {
        done();
        return;
      }
      var remaining = list.length;
      var settled = false;
      function settle() {
        remaining -= 1;
        if (remaining <= 0 && !settled) {
          settled = true;
          done();
        }
      }
      list.forEach(function (id) {
        try {
          root.fetch('audio/voice/' + id + '.mp3').then(function (res) {
            return res.arrayBuffer();
          }).then(function (data) {
            try {
              ctx.decodeAudioData(data, function (buf) {
                buffers[id] = buf;
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

    try {
      var ctx = S.context ? S.context() : null;
      var out = S.output ? S.output() : null;
      if (ctx && out && buffers[id]) {
        var source = ctx.createBufferSource();
        source.buffer = buffers[id];
        source.connect(out);
        activeSource = source;
        source.onended = finish;
        activeTimer = root.setTimeout(finish, ms + 3000);
        source.start(0);
        return;
      }
    } catch (e) {
      clearActive();
    }

    try {
      if (root.speechSynthesis && root.SpeechSynthesisUtterance && line) {
        var voice = englishVoice();
        if (voice) {
          var utter = new root.SpeechSynthesisUtterance(line.text);
          utter.voice = voice;
          utter.rate = 0.9;
          activeUtterance = utter;
          utter.onend = finish;
          utter.onerror = finish;
          activeTimer = root.setTimeout(finish, ms + 3000);
          root.speechSynthesis.speak(utter);
          return;
        }
      }
    } catch (e) {
      clearActive();
    }

    activeTimer = root.setTimeout(finish, ms);
  }

  function release() {
    stop();
    buffers = {};
  }

  FC.voice = {
    preload: preload,
    say: say,
    stop: stop,
    release: release
  };
})(this);
