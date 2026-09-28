/*
 * Footprint Chess: device check page.
 * Reports browser features the app relies on. Output uses textContent only.
 */
(function () {
  'use strict';

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
  yesNo('Service worker (offline mode, later stage)', 'serviceWorker' in navigator);

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

  function reportVoices() {
    var voices = window.speechSynthesis.getVoices() || [];
    var english = voices.filter(function (v) { return /^en[-_]/i.test(v.lang); });
    voiceCell.textContent = voices.length + ' voices, ' + english.length + ' English' +
      (english.length ? ' (' + english.slice(0, 3).map(function (v) { return v.name; }).join(', ') + ')' : '');
    voiceCell.className = english.length ? 'ok' : 'warn';
  }

  /* ---------- speech voice list ---------- */

  var voiceListBody = document.getElementById('voice-list');
  var EN_TEST_LINE = 'Hop, hop, turn!';
  var TE_TEST_LINE = 'ఇదిగో, నీ రోబో!';

  function testLineFor(voice) {
    var lang = (voice.lang || '').slice(0, 2).toLowerCase();
    return lang === 'te' ? TE_TEST_LINE : EN_TEST_LINE;
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
      var u = new SpeechSynthesisUtterance('Hop, hop, turn!');
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
})();
