/*
 * Footprint Chess: the grown-ups' corner (stage 5).
 *
 * A modal panel over a dim layer, opened by holding the ? button on Home (or
 * on the Who's playing screen) for two seconds, or by opening index.html
 * with #grownups in the address (the link at the end of help.html, which is
 * the way in for someone using a keyboard). A normal tap on ? still opens
 * help.html. The panel is for adults, so it is not a child target and does
 * not need to be spoken; it is in English, with all its text in
 * GROWNUP_TEXT, keyed by language, so it can be translated later (a language
 * without an entry uses the next language of its fallback chain).
 *
 * What it does:
 *   - Play settings: calm mode (fewer bursts, no bump or full-screen
 *     confetti, softer effects; the voice keeps its level) and the break
 *     reminder with its length.
 *   - Children: each child's picture and optional name, a picture picker, and
 *     removing a child (asks first). Up to four children.
 *   - What each child has done: the lessons started and not started yet,
 *     the games won (in any theme) and a next game to try, from the
 *     progress already stored (nothing new is stored).
 *   - Moving progress to another device: the backup code (FC.store
 *     exportCode) to copy, and a box to paste one and restore it (asks first).
 *   - Start over: clear everything (asks first).
 * A notice at the top says when the browser is not saving anything, or when
 * the saved progress belongs to a newer version of the app.
 *
 * Everything is a real control (buttons, a text box, text areas), reachable
 * with the keyboard with a visible focus, Escape closes, and Tab stays inside
 * the panel. Nothing is ever sent anywhere.
 *
 * Depends on FC.store, FC.board, FC.sound, FC.voice, FC.langs, FC.themes,
 * FC.lessons, FC.gameList and FC.profileUI (loaded before this file). DOM is built with
 * createElement/textContent only (see SECURITY.md).
 */
(function () {
  'use strict';

  var FC = window.FC;
  var B = FC.board;
  var S = FC.sound;
  var V = FC.voice;
  var TH = FC.themes;
  var LS = FC.lessons;
  var ST = FC.store;
  var PU = FC.profileUI;
  var GL = FC.gameList;

  var HOLD_MS = 2000;
  var BREAK_CHOICES = [10, 15, 20, 30];

  /*
   * The corner's text. Only English for now; to translate it, add a
   * property named with the language id (js/langs.js) with the same keys.
   */
  var GROWNUP_TEXT = {
    en: {
      title: 'Grown-ups',
      intro: 'Opened by holding the ? button for two seconds. Everything here is stored only on this device, in this browser; nothing is sent anywhere.',
      close: 'Close',
      notSaving: 'This browser is not saving progress on this device (private browsing or storage blocked). Progress lasts until the page is closed.',
      newerVersion: 'Progress was saved by a newer version of Footprint Chess and cannot be changed here.',
      secPlay: 'Play',
      calm: 'Calm mode',
      calmHelp: 'Fewer bursts and bumps, no full-screen confetti, softer sounds',
      breakOn: 'Break reminder',
      breakHelp: 'A calm card after this much play',
      breakLength: 'Break reminder length',
      minutes: 'min',
      secChildren: 'Children',
      nameOf: 'Name of child',
      namePlaceholder: 'Name (optional)',
      picture: 'Picture',
      remove: 'Remove',
      removeAsk: "Remove this child's progress?",
      yes: 'Yes',
      no: 'No',
      addChild: '+ Add a child',
      pickTitle: 'Pick a picture',
      pickTheme: 'Style',
      pickPiece: 'Piece',
      pickRing: 'Ring colour',
      done: 'Done',
      cancel: 'Cancel',
      secProgress: 'What each child has done',
      progressHelp: 'From what this device has saved. Lessons count once they have started; games count when won in any style.',
      child: 'Child',
      lessonsDone: 'Lessons started',
      lessonsLeft: 'Not started yet',
      gamesWon: 'Games won',
      nextGame: 'A game to try next',
      none: 'None yet',
      allDone: 'All of them',
      secBackup: 'Move progress to another device',
      backupHelp: 'Copy this code, then paste it into the grown-ups corner on the other device. The code includes any names, so share it only between your own devices.',
      codeLabel: 'Backup code',
      copyCode: 'Copy code',
      copied: 'Copied',
      copyFallback: 'Select the code and copy it',
      pasteLabel: 'Paste a code here',
      restore: 'Restore from code',
      restoreAsk: 'This replaces all children and stickers on this tablet. Restore?',
      pasteFirst: 'Paste a code first.',
      errFormat: 'That code is not complete. Copy the whole code and try again.',
      errChecksum: 'That code does not pass its check, so it was probably changed or damaged. Nothing was changed. Copy it again from the other device.',
      errVersion: 'That code was made by a different version of Footprint Chess and cannot be used here. Nothing was changed.',
      errData: 'That code could not be read. Nothing was changed.',
      secReset: 'Start over',
      resetHelp: 'Removes all children and stickers from this tablet. Asks again before it clears anything.',
      clearAll: 'Clear all progress',
      clearAsk: 'Clear everything on this tablet? This cannot be undone.'
    }
  };

  // The text for a key in the current language, else the next language of
  // its fallback chain (the default language ends every chain).
  function t(key) {
    var chain = FC.langs.fallbackChain(V.getLang());
    for (var i = 0; i < chain.length; i++) {
      var table = GROWNUP_TEXT[chain[i]];
      if (table && table[key] !== undefined) return table[key];
    }
    return '';
  }

  var store = null;
  var callbacks = null;    // { onClose, onReplaced }

  var root = document.getElementById('grownups');
  var panel = null;        // the dialog, rebuilt each time the corner opens
  var lastFocus = null;

  // Parts of the panel that change while it is open.
  var ui = null;

  /* ---------- small DOM helpers ---------- */

  function el(tag, cls) { var n = document.createElement(tag); if (cls) n.className = cls; return n; }
  function textEl(tag, cls, str) { var n = el(tag, cls); n.textContent = str; return n; }
  function clear(node) { node.textContent = ''; }

  function button(cls, label, onClick) {
    var b = el('button', cls);
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function section(title) { return textEl('h3', 'gu-sec', title); }

  /* ---------- settings that apply everywhere ---------- */

  // Calm mode reaches both the board effects and the sound effects (not the
  // voice); called at startup, after a restore and whenever the switch moves.
  function applySettings(settings) {
    var calm = !!(settings && settings.calm);
    B.setCalm(calm);
    S.setCalm(calm);
  }

  /* ---------- building the panel ---------- */

  function buildSwitch(label, help, get, set) {
    var row = el('div', 'gu-row');
    var text = el('div', 'gu-row-text');
    text.appendChild(textEl('b', null, label));
    text.appendChild(textEl('small', null, help));
    row.appendChild(text);
    var sw = el('button', 'gu-switch');
    sw.type = 'button';
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-label', label);
    sw.appendChild(el('span', 'gu-knob'));
    function sync() { sw.setAttribute('aria-checked', get() ? 'true' : 'false'); }
    sw.addEventListener('click', function () {
      set(!get());
      sync();
    });
    sync();
    row.appendChild(sw);
    return { row: row, sync: sync };
  }

  function buildPlay() {
    var box = el('div', 'gu-block');
    box.appendChild(section(t('secPlay')));

    var calm = buildSwitch(t('calm'), t('calmHelp'),
      function () { return store.settings().calm; },
      function (v) {
        store.setSetting('calm', v);
        applySettings(store.settings());
      });
    box.appendChild(calm.row);

    var brk = buildSwitch(t('breakOn'), t('breakHelp'),
      function () { return store.settings().breakOn; },
      function (v) {
        store.setSetting('breakOn', v);
        syncBreak();
      });
    box.appendChild(brk.row);

    var seg = el('div', 'gu-seg');
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', t('breakLength'));
    var segButtons = BREAK_CHOICES.map(function (mins) {
      var b = button('gu-chip', mins + ' ' + t('minutes'), function () {
        store.setSetting('breakMins', mins);
        syncBreak();
      });
      seg.appendChild(b);
      return { mins: mins, node: b };
    });
    box.appendChild(seg);

    function syncBreak() {
      var s = store.settings();
      brk.sync();
      segButtons.forEach(function (b) {
        var on = s.breakMins === b.mins;
        b.node.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.node.classList.toggle('on', on);
        b.node.disabled = !s.breakOn;
      });
    }
    syncBreak();
    return box;
  }

  /* ---------- children ---------- */

  function focusFirstIn(node) {
    var f = node.querySelector('input, button');
    if (f) f.focus();
  }

  function focusIn(node, selector) {
    var f = node.querySelector(selector);
    if (f) f.focus();
  }

  function renderChildren() {
    var list = ui.children;
    clear(list);
    var profiles = store.profiles();
    profiles.forEach(function (p, i) {
      var row = el('div', 'gu-kid');
      var av = PU.avatar(p.pic);
      av.classList.add('gu-kav');
      row.appendChild(av);

      if (ui.removing === p.id) {
        row.appendChild(textEl('div', 'gu-ask', t('removeAsk')));
        var yes = button('gu-link red', t('yes'), function () {
          ui.removing = null;
          store.removeProfile(p.id);
          renderChildren();
          refreshCode();
          focusFirstIn(list);
        });
        var no = button('gu-link', t('no'), function () {
          ui.removing = null;
          renderChildren();
          focusIn(list, '.gu-remove');
        });
        row.appendChild(yes);
        row.appendChild(no);
        list.appendChild(row);
        window.setTimeout(function () { no.focus(); }, 0);
        return;
      }

      var input = el('input', 'gu-name');
      input.type = 'text';
      input.maxLength = 20;
      input.value = p.name;
      input.placeholder = t('namePlaceholder');
      input.setAttribute('aria-label', t('nameOf') + ' ' + (i + 1));
      input.setAttribute('autocomplete', 'off');
      function saveName() {
        store.updateProfile(p.id, { name: input.value });
        refreshCode();
        renderProgress();
      }
      input.addEventListener('input', saveName);
      input.addEventListener('change', saveName);
      row.appendChild(input);

      var pic = button('gu-link', t('picture'), function () { openPicker(p.id); });
      pic.setAttribute('aria-label', t('picture') + ' ' + (i + 1));
      row.appendChild(pic);

      if (profiles.length > 1) {
        var rm = button('gu-link red gu-remove', t('remove'), function () {
          ui.removing = p.id;
          renderChildren();
        });
        rm.setAttribute('aria-label', t('remove') + ' ' + (i + 1));
        row.appendChild(rm);
      }
      list.appendChild(row);
    });
    ui.add.hidden = profiles.length >= ST.MAX_PROFILES;
    renderProgress();
  }

  function buildChildren() {
    var box = el('div', 'gu-block');
    box.appendChild(section(t('secChildren')));
    ui.children = el('div', 'gu-kids');
    box.appendChild(ui.children);
    ui.add = button('gu-btn ghost', t('addChild'), function () { openPicker(null); });
    box.appendChild(ui.add);
    renderChildren();
    return box;
  }

  /* ---------- what each child has done ---------- */

  // A game's English name: the first clause of its mission line (the same
  // words as the caption on its card).
  function gameName(g) {
    var line = LS.LINES[g.mission];
    var text = (line && line.en) || g.id;
    var m = /[!?]/.exec(text);
    return m ? text.slice(0, m[0] === '?' ? m.index + 1 : m.index).trim() : text.trim();
  }

  function listLine(label, items, empty) {
    var row = el('p', 'gu-prog');
    row.appendChild(textEl('b', null, label + ': '));
    row.appendChild(document.createTextNode(items.length ? items.join(', ') : empty));
    return row;
  }

  function buildProgress() {
    var box = el('div', 'gu-block');
    box.appendChild(section(t('secProgress')));
    box.appendChild(textEl('p', 'gu-tx', t('progressHelp')));
    ui.progress = el('div', 'gu-prog-list');
    box.appendChild(ui.progress);
    renderProgress();
    return box;
  }

  // Rebuilt whenever the children change (a name, a picture, one removed).
  function renderProgress() {
    if (!ui || !ui.progress) return;
    var list = ui.progress;
    clear(list);
    store.profiles().forEach(function (p, i) {
      var prog = store.progressOf(p.id);
      if (!prog) return;
      var kid = el('div', 'gu-prog-kid');
      var head = el('div', 'gu-kid');
      var av = PU.avatar(p.pic);
      av.classList.add('gu-kav');
      head.appendChild(av);
      head.appendChild(textEl('b', 'gu-prog-name', p.name || (t('child') + ' ' + (i + 1))));
      kid.appendChild(head);

      var started = [];
      var left = [];
      LS.LESSONS.forEach(function (lesson) {
        (prog.seen[lesson.id] ? started : left).push(lesson.title);
      });
      var won = {};
      Object.keys(prog.wins).forEach(function (k) { won[k.split(':')[1]] = true; });
      var wonNames = [];
      var next = null;
      GL.ROWS.forEach(function (row) {
        GL.inRow(row).forEach(function (g) {
          if (won[g.id]) wonNames.push(gameName(g));
          else if (!next) next = gameName(g);
        });
      });
      kid.appendChild(listLine(t('lessonsDone'), started, t('none')));
      kid.appendChild(listLine(t('lessonsLeft'), left, t('allDone')));
      kid.appendChild(listLine(t('gamesWon'), wonNames, t('none')));
      kid.appendChild(listLine(t('nextGame'), next ? [next] : [], t('allDone')));
      list.appendChild(kid);
    });
  }

  /* ---------- picture picker ---------- */

  // id: the child whose picture is changing, or null to add a child.
  function openPicker(id) {
    var profiles = store.profiles();
    var pic;
    if (id) {
      var p = profiles.filter(function (x) { return x.id === id; })[0];
      if (!p) return;
      pic = { theme: p.pic.theme, type: p.pic.type, ring: p.pic.ring };
    } else {
      pic = { theme: B.getTheme(), type: 'n', ring: ST.RINGS[profiles.length % ST.RINGS.length] };
    }
    var host = ui.picker;
    clear(host);
    host.appendChild(textEl('h3', 'gu-pick-title', t('pickTitle')));

    var themeButtons = [];
    var pieceButtons = [];
    var ringButtons = [];

    function sync() {
      themeButtons.forEach(function (b) {
        var on = b.id === pic.theme;
        b.node.classList.toggle('on', on);
        b.node.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      pieceButtons.forEach(function (b) {
        var on = b.type === pic.type;
        b.node.classList.toggle('on', on);
        b.node.setAttribute('aria-pressed', on ? 'true' : 'false');
        clear(b.node);
        b.node.appendChild(PU.avatar({ theme: pic.theme, type: b.type, ring: pic.ring }));
      });
      ringButtons.forEach(function (b) {
        var on = b.ring === pic.ring;
        b.node.classList.toggle('on', on);
        b.node.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    host.appendChild(textEl('div', 'gu-pick-label', t('pickTheme')));
    var themeRow = el('div', 'gu-pick-row');
    TH.THEMES.forEach(function (theme) {
      var b = el('button', 'gu-swatch theme-' + theme.id);
      b.type = 'button';
      b.setAttribute('aria-label', theme.name);
      b.appendChild(B.themedPieceSvg(theme.id, 'n', 'me'));
      b.addEventListener('click', function () { pic.theme = theme.id; sync(); });
      themeRow.appendChild(b);
      themeButtons.push({ id: theme.id, node: b });
    });
    host.appendChild(themeRow);

    host.appendChild(textEl('div', 'gu-pick-label', t('pickPiece')));
    var pieceRow = el('div', 'gu-pick-row');
    LS.TYPE_ORDER.forEach(function (type) {
      var b = el('button', 'gu-piece');
      b.type = 'button';
      b.setAttribute('aria-label', LS.PIECE_NAMES[LS.DEFAULT_LANG][type]);
      b.addEventListener('click', function () { pic.type = type; sync(); });
      pieceRow.appendChild(b);
      pieceButtons.push({ type: type, node: b });
    });
    host.appendChild(pieceRow);

    host.appendChild(textEl('div', 'gu-pick-label', t('pickRing')));
    var ringRow = el('div', 'gu-pick-row');
    ST.RINGS.forEach(function (ring, i) {
      var b = el('button', 'gu-ring');
      b.type = 'button';
      b.style.background = ring;
      b.setAttribute('aria-label', t('pickRing') + ' ' + (i + 1));
      b.addEventListener('click', function () { pic.ring = ring; sync(); });
      ringRow.appendChild(b);
      ringButtons.push({ ring: ring, node: b });
    });
    host.appendChild(ringRow);

    var actions = el('div', 'gu-pick-actions');
    actions.appendChild(button('gu-btn', t('done'), function () {
      if (id) store.updateProfile(id, { pic: pic });
      else store.addProfile(pic, '');
      closePicker(true);
    }));
    actions.appendChild(button('gu-btn ghost', t('cancel'), function () { closePicker(false); }));
    host.appendChild(actions);

    sync();
    ui.pickerFrom = document.activeElement;
    host.hidden = false;
    var first = host.querySelector('button');
    if (first) first.focus();
  }

  function closePicker(changed) {
    ui.picker.hidden = true;
    clear(ui.picker);
    if (changed) {
      renderChildren();
      refreshCode();
    }
    var back = ui.pickerFrom;
    if (back && root.contains(back) && !back.disabled) back.focus();
    else focusFirstIn(ui.children);
  }

  /* ---------- moving progress: the backup code ---------- */

  function refreshCode() {
    if (ui && ui.code) ui.code.value = store.exportCode();
  }

  function say(node, text) { node.textContent = text; }

  function copyCode() {
    var area = ui.code;
    var code = area.value;
    function fallback() {
      try {
        area.focus();
        area.select();
        if (area.setSelectionRange) area.setSelectionRange(0, code.length);
        area.scrollTop = 0;
        if (document.execCommand && document.execCommand('copy')) say(ui.copyStatus, t('copied'));
        else say(ui.copyStatus, t('copyFallback'));
      } catch (e) {
        say(ui.copyStatus, t('copyFallback'));
      }
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        navigator.clipboard.writeText(code).then(function () { say(ui.copyStatus, t('copied')); }, fallback);
      } catch (e) {
        fallback();
      }
    } else {
      fallback();
    }
  }

  var REASON_KEY = { format: 'errFormat', checksum: 'errChecksum', version: 'errVersion', data: 'errData' };

  // Replaces a button with "question? Yes / No" inside the panel. No
  // confirm(): it is a real dialog for the tablet and for a screen reader.
  function askInPanel(host, question, onYes) {
    var previous = host.firstChild;
    var box = el('div', 'gu-confirm');
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', question);
    box.appendChild(textEl('p', 'gu-ask', question));
    var row = el('div', 'gu-confirm-row');
    var no = button('gu-btn ghost', t('no'), function () {
      clear(host);
      host.appendChild(previous);
      if (previous.focus) previous.focus();
    });
    var yes = button('gu-btn', t('yes'), function () {
      clear(host);
      host.appendChild(previous);
      onYes();
    });
    row.appendChild(yes);
    row.appendChild(no);
    box.appendChild(row);
    clear(host);
    host.appendChild(box);
    no.focus();
  }

  function buildBackup() {
    var box = el('div', 'gu-block');
    box.appendChild(section(t('secBackup')));
    box.appendChild(textEl('p', 'gu-tx', t('backupHelp')));

    var code = el('textarea', 'gu-code');
    code.readOnly = true;
    code.rows = 4;
    code.setAttribute('aria-label', t('codeLabel'));
    code.setAttribute('spellcheck', 'false');
    code.addEventListener('focus', function () {
      code.select();
      code.scrollTop = 0;
    });
    ui.code = code;
    box.appendChild(code);

    var copyRow = el('div', 'gu-btns');
    copyRow.appendChild(button('gu-btn', t('copyCode'), copyCode));
    ui.copyStatus = textEl('span', 'gu-status', '');
    ui.copyStatus.setAttribute('role', 'status');
    copyRow.appendChild(ui.copyStatus);
    box.appendChild(copyRow);

    var paste = el('textarea', 'gu-paste');
    paste.rows = 3;
    paste.placeholder = t('pasteLabel');
    paste.setAttribute('aria-label', t('pasteLabel'));
    paste.setAttribute('spellcheck', 'false');
    paste.setAttribute('autocomplete', 'off');
    box.appendChild(paste);

    var restoreHost = el('div', 'gu-btns');
    var restoreBtn = button('gu-btn ghost', t('restore'), function () {
      say(ui.restoreStatus, '');
      if (!paste.value.replace(/\s+/g, '')) {
        say(ui.restoreStatus, t('pasteFirst'));
        paste.focus();
        return;
      }
      askInPanel(restoreHost, t('restoreAsk'), function () {
        var res = store.importCode(paste.value);
        if (!res.ok) {
          say(ui.restoreStatus, t(REASON_KEY[res.reason] || 'errData'));
          return;
        }
        replaced();
      });
    });
    restoreHost.appendChild(restoreBtn);
    box.appendChild(restoreHost);
    ui.restoreStatus = textEl('p', 'gu-status gu-error', '');
    ui.restoreStatus.setAttribute('role', 'alert');
    box.appendChild(ui.restoreStatus);
    refreshCode();
    return box;
  }

  function buildReset() {
    var box = el('div', 'gu-block');
    box.appendChild(section(t('secReset')));
    box.appendChild(textEl('p', 'gu-tx', t('resetHelp')));
    var host = el('div', 'gu-btns');
    host.appendChild(button('gu-btn danger', t('clearAll'), function () {
      askInPanel(host, t('clearAsk'), function () {
        store.clearAll();
        store.ensureProfile(ST.DEFAULT_PIC);
        replaced();
      });
    }));
    box.appendChild(host);
    return box;
  }

  /* ---------- open, close ---------- */

  function buildPanel() {
    ui = { removing: null, pickerFrom: null };
    clear(root);
    root.appendChild(el('div', 'gu-dim'));
    panel = el('div', 'gu-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'gu-title');
    panel.tabIndex = -1;

    var head = el('div', 'gu-head');
    var lock = B.svgUse('ic-lock');
    lock.classList.add('gu-lock');
    head.appendChild(lock);
    var titles = el('div', 'gu-titles');
    var h = textEl('h2', 'gu-title', t('title'));
    h.id = 'gu-title';
    titles.appendChild(h);
    titles.appendChild(textEl('p', 'gu-sub', t('intro')));
    head.appendChild(titles);
    var x = el('button', 'tool gu-x');
    x.type = 'button';
    x.setAttribute('aria-label', t('close'));
    x.appendChild(B.svgUse('ic-close'));
    x.addEventListener('click', function () { close(); });
    head.appendChild(x);
    panel.appendChild(head);

    var notices = el('div', 'gu-notices');
    notices.setAttribute('role', 'status');
    if (store.readOnlyNewer) notices.appendChild(textEl('p', 'gu-notice', t('newerVersion')));
    else if (!store.persistent) notices.appendChild(textEl('p', 'gu-notice', t('notSaving')));
    if (notices.children.length) panel.appendChild(notices);

    var cols = el('div', 'gu-cols');
    var left = el('div', 'gu-col');
    left.appendChild(buildPlay());
    left.appendChild(buildChildren());
    var right = el('div', 'gu-col');
    right.appendChild(buildProgress());
    right.appendChild(buildBackup());
    right.appendChild(buildReset());
    cols.appendChild(left);
    cols.appendChild(right);
    panel.appendChild(cols);

    root.appendChild(panel);

    // The picture picker is a card over the panel (a child of the corner,
    // not of the scrolling panel, so it stays centred).
    ui.picker = el('div', 'gu-picker');
    ui.picker.hidden = true;
    root.appendChild(ui.picker);
  }

  function isOpen() { return !root.hidden; }

  function open() {
    if (isOpen()) return;
    lastFocus = document.activeElement;
    buildPanel();
    root.hidden = false;
    panel.scrollTop = 0;
    var x = panel.querySelector('.gu-x');
    if (x) x.focus();
  }

  function teardown() {
    root.hidden = true;
    clear(root);
    panel = null;
    ui = null;
    if (lastFocus && document.body.contains(lastFocus) && lastFocus.focus) {
      try { lastFocus.focus(); } catch (e) { /* not focusable any more */ }
    }
    lastFocus = null;
  }

  // Close the corner and return to wherever it was opened from.
  function close() {
    if (!isOpen()) return;
    teardown();
    if (callbacks && callbacks.onClose) callbacks.onClose();
  }

  // After a restore or a clear-all: everything the app holds is stale.
  function replaced() {
    teardown();
    if (callbacks && callbacks.onReplaced) callbacks.onReplaced();
  }

  function visibleControls(scope) {
    var nodes = scope.querySelectorAll('button, input, textarea, a[href]');
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!n.disabled && (n.offsetWidth > 0 || n.offsetHeight > 0)) out.push(n);
    }
    return out;
  }

  function onKey(e) {
    if (!isOpen() || !panel) return;
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      if (ui && ui.picker && !ui.picker.hidden) closePicker(false);
      else close();
      return;
    }
    if (e.key !== 'Tab') return;
    // Keep Tab inside the panel (and inside the picker while it is open).
    var scope = (ui.picker && !ui.picker.hidden) ? ui.picker : panel;
    var items = visibleControls(scope);
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    var active = document.activeElement;
    if (items.indexOf(active) === -1) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  /* ---------- the openers ---------- */

  // Holding a ? button for two seconds opens the corner; a tap still
  // follows the link to help.html. While held, a ring fills around the button
  // (css/app.css .hold-ring; transform and opacity only).
  function wireOpener(link) {
    var timer = null;
    var fired = false;
    function cancel() {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      link.classList.remove('holding');
    }
    link.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      cancel();
      fired = false;
      link.classList.add('holding');
      timer = window.setTimeout(function () {
        timer = null;
        fired = true;
        link.classList.remove('holding');
        open();
      }, HOLD_MS);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (name) {
      link.addEventListener(name, cancel);
    });
    // The click that follows a long press must not follow the link.
    link.addEventListener('click', function (e) {
      if (fired) {
        e.preventDefault();
        fired = false;
      }
    });
    // A long press on a link would otherwise open the browser's own menu.
    link.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    link.addEventListener('dragstart', function (e) { e.preventDefault(); });
  }

  // index.html#grownups opens the corner (the keyboard-accessible route,
  // from the link at the end of help.html). The hash is dropped afterwards so
  // a reload does not reopen it.
  function openIfRequested() {
    if (window.location.hash !== '#grownups') return;
    open();
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch (e) {
      // Cosmetic only.
    }
  }

  function init(theStore, opts) {
    store = theStore;
    callbacks = opts;
    var links = document.querySelectorAll('.help-link');
    for (var i = 0; i < links.length; i++) wireOpener(links[i]);
    document.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', openIfRequested);
  }

  FC.grownupsUI = {
    init: init,
    open: open,
    close: close,
    isOpen: isOpen,
    openIfRequested: openIfRequested,
    applySettings: applySettings,
    GROWNUP_TEXT: GROWNUP_TEXT
  };
})();
