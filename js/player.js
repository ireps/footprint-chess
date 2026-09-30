/*
 * Footprint Chess: the lesson player. Runs one lesson (watch, then practice)
 * on FC.board, using a lesson-local board (FC.lessons.boardFor) and
 * FC.rules.movesFor for legality. No round/screen-flow logic lives here;
 * see js/app.js for when a lesson starts and what happens after it.
 *
 * Every async callback (timers, hand/move/voice "done") checks a run token
 * bumped by stop(), so Skip, Replay or a piece tap mid-lesson never leaves
 * a stray animation, sound or state change behind.
 *
 * Depends on FC.rules, FC.lessons, FC.voice, FC.sound and FC.board (all
 * loaded before this file). DOM is built with createElement/textContent
 * only, entirely inside js/board.js; this file never touches the DOM.
 */
(function () {
  'use strict';

  var FC = window.FC;
  var R = FC.rules;
  var LS = FC.lessons;
  var V = FC.voice;
  var S = FC.sound;
  var B = FC.board;

  var IDLE_MS = 5000;
  var STEP_MS = 300; // select/unselect/reset pacing, matching FC.lessons' estimate model

  var token = 0;        // bumped by stop(); every async callback checks it first
  var current = null;    // the lesson being watched or practiced, or null
  var hooks = null;
  var local = null;      // { board, hero } from FC.lessons.boardFor
  var heroNode = null;
  var foeNodes = {};     // "r,c" -> DOM node, for the lesson's opponent pawns

  var practicing = false;
  var taskIndex = 0;
  var selected = false;
  var busy = false;      // true while the hero is moving in practice
  var moves = [];        // legal moves for the hero, set when selected in practice
  var restSq = null;     // [r, c] the ghost hand currently rests on/near
  var hintSq = null;      // [r, c] the practice task's hint square, while selected

  var voiceActive = false;
  var voiceWait = null;  // queued "continue" for a pending waitVoice step
  var idleTimer = null;

  /* ---------- helpers ---------- */

  function key(r, c) { return r + ',' + c; }
  var DANGER = '#e0604d';
  var FOE_PRINT = '#3b4a5a';
  function heroColor() { return B.TYPES[current.type].color; }

  function placeSetup(lesson, animateEnter) {
    heroNode = B.addPiece(lesson.type, lesson.setup.hero[0], lesson.setup.hero[1]);
    foeNodes = {};
    LS.foesOf(lesson).forEach(function (f) {
      foeNodes[key(f.at[0], f.at[1])] = B.addItem(f.at[0], f.at[1], f.type);
    });
    if (animateEnter) B.replay(heroNode, 'enter');
  }

  function resetToSetup(lesson, animateEnter) {
    B.clearAll();
    local = LS.boardFor(lesson);
    placeSetup(lesson, animateEnter);
  }

  function clearIdle() {
    window.clearTimeout(idleTimer);
  }

  function armIdle(myToken) {
    clearIdle();
    idleTimer = window.setTimeout(function () { onIdle(myToken); }, IDLE_MS);
  }

  function rest(r, c) {
    B.handRest(r, c);
    restSq = [r, c];
  }

  // Moves an opponent piece (the "turns" lesson's { foeMove } watch step
  // and a practice task's { reply }): updates the lesson-local board and
  // foeNodes the same way land() does for the hero, then plays that
  // piece's own move animation. Never a capture in this lesson (see
  // js/lessons.js LESSONS['turns']), so no poof/sparkle handling here.
  function moveFoe(from, to, done) {
    var fromKey = key(from[0], from[1]);
    var node = foeNodes[fromKey];
    if (!node) { if (done) done(); return; }
    var board = local.board;
    var piece = board[from[0]][from[1]];
    delete foeNodes[fromKey];
    board[to[0]][to[1]] = piece;
    board[from[0]][from[1]] = null;
    foeNodes[key(to[0], to[1])] = node;
    B.moveHero(node, piece ? piece.type : 'p', from, to, done);
  }

  // Update the lesson-local board after a move; poof + sparkle + capture
  // sound if it landed on an opponent pawn.
  function land(from, to) {
    var board = local.board;
    var tokey = key(to[0], to[1]);
    var captured = foeNodes[tokey];
    board[to[0]][to[1]] = board[from[0]][from[1]];
    board[from[0]][from[1]] = null;
    local.hero = to.slice();
    if (captured) {
      delete foeNodes[tokey];
      B.poof(captured);
      B.sparkle(to[0], to[1], 0);
      S.play('capture');
    }
  }

  /* ---------- stop / prepare ---------- */

  // Cancels everything (timers, voice, hand, glow). Does not clear pieces;
  // the caller is always about to start something else (another lesson, a
  // capture round, or the ready state).
  function stop() {
    token += 1;
    current = null;
    hooks = null;
    practicing = false;
    selected = false;
    busy = false;
    moves = [];
    hintSq = null;
    restSq = null;
    voiceActive = false;
    voiceWait = null;
    clearIdle();
    V.stop();
    B.hideHand();
    B.glow([]);
    B.hideTeamBars();
    B.showHandPrints(false);
  }

  // The page-load "ready" state: the hello lesson's start position, hand
  // resting on the hero, nothing playing (no audio is possible before the
  // first tap unlocks it).
  function prepare(lesson) {
    stop();
    resetToSetup(lesson, false);
    rest(lesson.setup.hero[0], lesson.setup.hero[1]);
  }

  /* ---------- watch ---------- */

  function start(lesson, h) {
    stop();
    var myToken = token;
    hooks = h || {};
    current = lesson;
    resetToSetup(lesson, true);
    B.setMode('watch', modeText('watch'));
    S.play('watch');

    // The "turns" lesson (and no other) shows team bars for its whole
    // watch + practice run, teaching turn-taking before the child meets
    // any game; see FC.themes.TEAMS (default team 'a' for the child, since
    // no game/team choice exists yet at this point) and js/board.js
    // showTeamBars/hideTeamBars (cleared by stop(), above).
    if (lesson.id === 'turns') {
      var theme = B.getTheme();
      B.showTeamBars({
        home: { name: B.teamName(theme, 'a'), pawnSide: 'me' },
        far: { name: B.teamName(theme, 'b'), pawnSide: 'foe' },
        active: 'home'
      });
    }

    var ids = LS.lineIds(lesson).concat(LS.PRACTICE_LINES);
    var started = false;
    function go() {
      if (started || myToken !== token) return;
      started = true;
      runWatch(0, myToken);
    }
    V.preload(ids, go);
    window.setTimeout(go, 1500);
  }

  function sayLine(id, myToken) {
    voiceActive = true;
    V.say(id, function () {
      if (myToken !== token) return;
      voiceActive = false;
      if (voiceWait) {
        var w = voiceWait;
        voiceWait = null;
        w();
      }
    });
  }

  function runWatch(i, myToken) {
    if (myToken !== token) return;
    var lesson = current;
    if (i >= lesson.watch.length) {
      startPractice(myToken);
      return;
    }
    var step = lesson.watch[i];
    function next() { runWatch(i + 1, myToken); }

    if (step.say) {
      sayLine(step.say, myToken);
      next();
      return;
    }
    if (step.waitVoice) {
      if (voiceActive) {
        voiceWait = next;
      } else {
        next();
      }
      return;
    }
    if (typeof step.wait === 'number') {
      B.wait(next, step.wait);
      return;
    }
    if (step.select) {
      var hero = local.hero;
      var wmoves = R.legalMoves(local.board, hero[0], hero[1]);
      heroNode.classList.add('selected');
      B.replay(heroNode, 'bounce');
      B.showFootprints(lesson.type, hero, wmoves, foeNodes);
      S.play('select');
      B.wait(next, STEP_MS);
      return;
    }
    if (step.unselect) {
      B.hideFootprints(foeNodes);
      heroNode.classList.remove('selected');
      B.wait(next, STEP_MS);
      return;
    }
    if (step.hand) {
      B.hand(step.hand[0], step.hand[1], function () {
        if (myToken !== token) return;
        restSq = step.hand.slice();
        next();
      });
      return;
    }
    if (step.handAway) {
      B.hideHand();
      restSq = null;
      next();
      return;
    }
    if (step.move) {
      B.hideFootprints(foeNodes);
      heroNode.classList.remove('selected');
      var from = local.hero.slice();
      var to = step.move;
      B.moveHero(heroNode, lesson.type, from, to, function () {
        if (myToken !== token) return;
        land(from, to);
        next();
      });
      return;
    }
    if (step.glow) {
      // color 'danger': the red of squares a king may not step to.
      B.glow(step.glow, step.color === 'danger' ? DANGER : heroColor());
      next();
      return;
    }
    if (step.landmark) {
      B.landmark(step.landmark);
      next();
      return;
    }
    if (step.reset) {
      resetToSetup(lesson, true);
      B.wait(next, STEP_MS);
      return;
    }
    if (step.turn) {
      // Visuals only (team bars) plus a soft tick: the script's own next
      // { say } line (turns-2/3/4) does the narration, so this must not
      // also speak, or the two would collide (see the "turns" lesson).
      B.setActiveTeamBar(step.turn === 'me' ? 'home' : 'far');
      S.play('tick');
      next();
      return;
    }
    if (step.handPrint) {
      // Hand-print lessons: that hand print glows.
      B.showHandPrints(true);
      B.flashHandPrint(step.handPrint);
      next();
      return;
    }
    if (step.foePrints) {
      // An opponent piece's footprints, in the other side's dark colour.
      var fsq = step.foePrints;
      var fp = local.board[fsq[0]][fsq[1]];
      if (fp) B.showFootprints(fp.type, fsq, R.movesFor(local.board, fsq[0], fsq[1]), {}, FOE_PRINT);
      next();
      return;
    }
    if (step.foeMove) {
      moveFoe(step.foeMove[0], step.foeMove[1], function () {
        if (myToken !== token) return;
        next();
      });
      return;
    }
    // Unknown step shape: skip it rather than stall the lesson.
    next();
  }

  /* ---------- practice ---------- */

  function startPractice(myToken) {
    if (myToken !== token) return;
    var lesson = current;
    taskIndex = 0;
    selected = false;
    resetToSetup(lesson, true);
    B.glow([]);
    // Hand control to the child: green ring, "Your turn!" badge, chime.
    B.setMode('play', modeText('play'));
    S.play('your-turn');
    sayLine('your-turn', myToken);
    rest(local.hero[0], local.hero[1]);
    practicing = true;
    armIdle(myToken);
  }

  function hintFor(task, hero, taskMoves) {
    for (var i = 0; i < taskMoves.length; i++) {
      if (taskMoves[i].r === task.to[0] && taskMoves[i].c === task.to[1]) return task.to.slice();
    }
    var suggested = LS.suggestMove(local.board, hero, task.to);
    return suggested || task.to.slice();
  }

  function selectPractice(myToken) {
    var hero = local.hero;
    selected = true;
    moves = R.legalMoves(local.board, hero[0], hero[1]);
    heroNode.classList.add('selected');
    B.replay(heroNode, 'bounce');
    B.showFootprints(current.type, hero, moves, foeNodes);
    S.play('pick', current.type);
    var task = current.practice[taskIndex];
    hintSq = hintFor(task, hero, moves);
    rest(hintSq[0], hintSq[1]);
    armIdle(myToken);
  }

  function findMove(r, c) {
    for (var i = 0; i < moves.length; i++) {
      if (moves[i].r === r && moves[i].c === c) return moves[i];
    }
    return null;
  }

  function completeTask(mv, myToken) {
    B.hideHand();
    restSq = null;
    B.hideFootprints(foeNodes);
    heroNode.classList.remove('selected');
    selected = false;
    busy = true;
    hintSq = null;
    var task = current.practice[taskIndex];
    var from = local.hero.slice();
    var to = [mv.r, mv.c];
    B.moveHero(heroNode, current.type, from, to, function () {
      if (myToken !== token) return;
      land(from, to);
      taskIndex += 1;
      if (task.reply) {
        playReply(task.reply, myToken);
      } else {
        afterTask(myToken);
      }
    });
  }

  // busy stays true (taps ignored) until this runs, whether a task
  // completed on its own or after a practice reply.
  function afterTask(myToken) {
    if (myToken !== token) return;
    busy = false;
    if (taskIndex < current.practice.length) {
      rest(local.hero[0], local.hero[1]);
      armIdle(myToken);
    } else {
      finishPractice(myToken);
    }
  }

  // A practice task's { reply }: after the child's own move lands, the
  // foe replies before control comes back. Mirrors the { turn: 'foe' }
  // then { turn: 'me' } pair a watch script would use, but since no script
  // step drives it here, this says turn-foe/turn-me itself.
  function playReply(reply, myToken) {
    var theme = B.getTheme();
    B.setMode('watch', B.turnBadgeText(theme, 'b'));
    B.setActiveTeamBar('far');
    var proceeded = false;
    function proceed() {
      if (proceeded || myToken !== token) return;
      proceeded = true;
      B.wait(function () {
        if (myToken !== token) return;
        moveFoe(reply[0], reply[1], function () {
          if (myToken !== token) return;
          B.setActiveTeamBar('home');
          B.setMode('play', modeText('play'));
          S.play('your-turn');
          // Queued, so a "Their turn." still playing is not cut off.
          V.sayAfter('turn-me');
          afterTask(myToken);
        });
      }, 600 + Math.floor(Math.random() * 300)); // 600-900ms "thinking" pause
    }
    // Proceed once the line finishes, or after about 700ms, whichever
    // comes first - a slow device should never stall the reply on voice.
    V.say('turn-foe', proceed);
    B.wait(proceed, 700);
  }

  function finishPractice(myToken) {
    clearIdle();
    practicing = false;
    B.hideHand();
    restSq = null;
    B.replay(heroNode, 'cheer');
    B.confetti(12);
    // sayLine() always resolves asynchronously (js/voice.js never calls its
    // done callback synchronously), so voiceActive is true right here and
    // queuing onDone as the waitVoice continuation always fires it once,
    // exactly when the line ends.
    sayLine('great', myToken);
    voiceWait = function () {
      if (myToken !== token) return;
      if (hooks && hooks.onDone) hooks.onDone();
    };
  }

  function modeText(m) {
    return LS.UI_TEXT[m === 'play' ? 'turn' : 'watch'][V.getLang()];
  }

  function handleTap(r, c) {
    if (current && !practicing && B.getMode() === 'watch') {
      B.nudgeMode();
      S.play('nudge');
      return;
    }
    if (!current || !practicing || busy) return;
    var myToken = token;
    armIdle(myToken);

    var hero = local.hero;
    if (r === hero[0] && c === hero[1]) {
      selectPractice(myToken);
      return;
    }

    if (!selected) {
      B.replay(heroNode, 'nudge');
      S.play('nudge');
      return;
    }

    var task = current.practice[taskIndex];
    var mv = findMove(r, c);
    var completes = false;
    if (mv) {
      completes = task.accept === 'only'
        ? (hintSq && r === hintSq[0] && c === hintSq[1])
        : true;
    }

    if (mv && completes) {
      completeTask(mv, myToken);
    } else {
      B.replay(heroNode, 'wiggle');
      B.pulseFootprints();
      S.play('bonk');
    }
  }

  /* ---------- idle hint ---------- */

  function onIdle(myToken) {
    if (myToken !== token || !practicing || busy) return;
    sayLine(selected ? 'tap-footprint' : 'tap-piece', myToken);
    if (restSq) {
      B.hand(restSq[0], restSq[1], function () {
        if (myToken !== token) return;
        armIdle(myToken);
      });
    } else {
      armIdle(myToken);
    }
  }

  /* ---------- start ---------- */

  FC.player = {
    prepare: prepare,
    start: start,
    stop: stop,
    handleTap: handleTap,
    active: function () { return !!current; },
    lesson: function () { return current; }
  };
})();
