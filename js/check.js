/*
 * Footprint Chess: device check page.
 * Reports browser features the app relies on. Output uses textContent only.
 * The speech checks go through the language registry (js/langs.js, loaded
 * first), so a new language shows up here without changes to this file
 * beyond an optional test line in TEST_LINES.
 */
(function () {
  'use strict';

  var LG = window.FC.langs;

  var tbody = document.getElementById('results');
  var status = document.getElementById('action-result');

  function row(label, value, level) {
    var tr = document.createElement('tr');
    var th = document.createElement('th');
    var td = document.createElement('td');
    th.textContent = label;
    td.textContent = value;
    if (level) td.className = level;
    tr.appendChild(th);
    tr.appendChild(td);
    tbody.appendChild(tr);
    return td;
  }

  function yesNo(label, ok, note) {
    row(label, (ok ? 'Yes' : 'No') + (note ? ' (' + note + ')' : ''), ok ? 'ok' : 'bad');
  }

  var ua = navigator.userAgent;
  var chrome = /Chrome\/(\d+)/.exec(ua);
  var silk = /Silk\/([\d.]+)/.exec(ua);
  var chromeMajor = chrome ? parseInt(chrome[1], 10) : 0;

  row('User agent', ua);
  row('Silk version', silk ? silk[1] : 'Not Silk');
  row('Chromium version', chrome ? String(chromeMajor) : 'Unknown',
    chromeMajor >= 108 ? 'ok' : (chromeMajor >= 80 ? 'warn' : 'bad'));
  row('Screen (CSS pixels)', window.innerWidth + ' x ' + window.innerHeight +
    ', pixel ratio ' + (window.devicePixelRatio || 1));

  yesNo('Secure connection (HTTPS)', !!window.isSecureContext);
  yesNo('CSS grid', !!(window.CSS && CSS.supports && CSS.supports('display', 'grid')));
  yesNo('Pointer events', 'PointerEvent' in window);
  yesNo('Web Animations', typeof document.documentElement.animate === 'function');
  yesNo('Web Audio', !!(window.AudioContext || window.webkitAudioContext));
  yesNo('Service worker (offline mode)', 'serviceWorker' in navigator);

  var storageOk = false;
  try {
    var k = '__fc_check__';
    window.localStorage.setItem(k, '1');
    storageOk = window.localStorage.getItem(k) === '1';
    window.localStorage.removeItem(k);
  } catch (e) {
    storageOk = false;
  }
  yesNo('Local storage (progress, later stage)', storageOk);

  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  row('Reduced motion setting', reduced ? 'On (animations shortened)' : 'Off');

  var hasSpeech = 'speechSynthesis' in window;
  var voiceCell = row('Speech voices', hasSpeech ? 'Checking...' : 'Speech not available', hasSpeech ? '' : 'warn');

  // True if a voice's language tag is the registry's speech prefix, alone or
  // followed by a region ("en", "en-US", "te_IN").
  function voiceIsLang(voice, entry) {
    var tag = (voice.lang || '').toLowerCase();
    return tag === entry.speech || tag.indexOf(entry.speech + '-') === 0 || tag.indexOf(entry.speech + '_') === 0;
  }

  // One count per registry language ("2 English (a, b, c), 0 Telugu"); the
  // cell is green when the default language has a voice.
  function reportVoices() {
    var voices = window.speechSynthesis.getVoices() || [];
    var parts = [];
    var defaultCount = 0;
    LG.LANGUAGES.forEach(function (entry) {
      var matching = voices.filter(function (v) { return voiceIsLang(v, entry); });
      if (entry.id === LG.DEFAULT_LANG) defaultCount = matching.length;
      parts.push(matching.length + ' ' + entry.name +
        (matching.length && entry.id === LG.DEFAULT_LANG
          ? ' (' + matching.slice(0, 3).map(function (v) { return v.name; }).join(', ') + ')'
          : ''));
    });
    voiceCell.textContent = voices.length + ' voices, ' + parts.join(', ');
    voiceCell.className = defaultCount ? 'ok' : 'warn';
  }

  /* ---------- speech voice list ---------- */

  var voiceListBody = document.getElementById('voice-list');
  // A short sentence per language id. A language with no entry here is
  // tested with the default language's line.
  var TEST_LINES = {
    en: 'Hello! Let\'s learn chess.',
    te: 'హలో! చదరంగం నేర్చుకుందాం.'
  };

  function testLineFor(voice) {
    for (var i = 0; i < LG.LANGUAGES.length; i++) {
      var entry = LG.LANGUAGES[i];
      if (voiceIsLang(voice, entry) && TEST_LINES[entry.id]) return TEST_LINES[entry.id];
    }
    return TEST_LINES[LG.DEFAULT_LANG];
  }

  function speakVoice(voice) {
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(testLineFor(voice));
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 0.85;
      u.pitch = 1.1;
      u.onend = function () { status.textContent = 'Finished: ' + voice.name + '.'; };
      u.onerror = function (ev) { status.textContent = 'Voice error (' + voice.name + '): ' + (ev.error || 'unknown'); };
      window.speechSynthesis.speak(u);
      status.textContent = 'Speaking: ' + voice.name + '...';
    } catch (e) {
      status.textContent = 'Voice test failed: ' + e.message;
    }
  }

  function buildVoiceRow(voice) {
    var tr = document.createElement('tr');
    var nameTd = document.createElement('td');
    nameTd.textContent = voice.name;
    var langTd = document.createElement('td');
    langTd.textContent = voice.lang;
    var sourceTd = document.createElement('td');
    sourceTd.textContent = voice.localService ? 'Local' : 'Network';
    var actionTd = document.createElement('td');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Test';
    btn.addEventListener('click', function () { speakVoice(voice); });
    actionTd.appendChild(btn);
    tr.appendChild(nameTd);
    tr.appendChild(langTd);
    tr.appendChild(sourceTd);
    tr.appendChild(actionTd);
    voiceListBody.appendChild(tr);
  }

  function buildVoiceList() {
    while (voiceListBody.firstChild) voiceListBody.removeChild(voiceListBody.firstChild);
    var voices = hasSpeech ? (window.speechSynthesis.getVoices() || []) : [];
    if (!voices.length) {
      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.setAttribute('colspan', '4');
      td.textContent = hasSpeech
        ? 'No voices reported (headless browsers often report zero; a real device may need a moment).'
        : 'Speech is not available in this browser.';
      tr.appendChild(td);
      voiceListBody.appendChild(tr);
      return;
    }
    voices.forEach(buildVoiceRow);
  }

  if (hasSpeech) {
    window.speechSynthesis.onvoiceschanged = function () {
      reportVoices();
      buildVoiceList();
    };
    window.setTimeout(function () {
      reportVoices();
      buildVoiceList();
    }, 1500);
  }
  buildVoiceList();

  document.getElementById('test-sound').addEventListener('click', function () {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      status.textContent = 'Web Audio is not available.';
      return;
    }
    try {
      var ctx = new AC();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.frequency.value = 660;
      gain.gain.value = 0.15;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
      status.textContent = 'Test sound played. If you heard nothing, check the tablet volume.';
    } catch (e) {
      status.textContent = 'Sound failed: ' + e.message;
    }
  });

  document.getElementById('test-speech').addEventListener('click', function () {
    if (!hasSpeech) {
      status.textContent = 'Speech is not available in this browser.';
      return;
    }
    try {
      var u = new SpeechSynthesisUtterance("Hello! Let's learn chess.");
      u.lang = 'en-US';
      u.onend = function () { status.textContent = 'Speech finished.'; };
      u.onerror = function (ev) { status.textContent = 'Speech error: ' + (ev.error || 'unknown'); };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      status.textContent = 'Speaking...';
    } catch (e) {
      status.textContent = 'Speech failed: ' + e.message;
    }
  });

  // Game speed (js/speed.js): the growing battle's opponent and hints, one
  // move at a time with a short pause between, so the page stays usable.
  var speedBtn = document.getElementById('test-speed');
  var speedOut = document.getElementById('speed-result');
  if (speedBtn && window.FC.speed && window.FC.army) {
    speedBtn.addEventListener('click', function () {
      var SP = window.FC.speed;
      var clock = (window.performance && performance.now) ? function () { return performance.now(); } : function () { return Date.now(); };
      var run = SP.createRun(window.FC.army, clock);
      var moves = 0;
      speedBtn.disabled = true;
      speedOut.className = '';
      speedOut.textContent = 'Running...';
      function tick() {
        var more = run.step();
        moves++;
        if (more) {
          speedOut.textContent = 'Running... ' + moves + ' moves';
          window.setTimeout(tick, 30);
          return;
        }
        var res = run.result();
        var bot = SP.summary(res.bot);
        var hint = SP.summary(res.hint);
        var ok = bot.max <= SP.LIMITS.bot && hint.max <= SP.LIMITS.hint;
        speedOut.className = ok ? 'ok' : 'warn';
        speedOut.textContent = 'Other side\'s move: typically ' + bot.median + ' ms, longest ' + bot.max + ' ms (limit ' + SP.LIMITS.bot + '). ' +
          'Hint: typically ' + hint.median + ' ms, longest ' + hint.max + ' ms (limit ' + SP.LIMITS.hint + '). ' +
          (ok ? 'Fast enough.' : 'Slower than it should be: please report these numbers.');
        speedBtn.disabled = false;
      }
      window.setTimeout(tick, 30);
    });
  }
})();
