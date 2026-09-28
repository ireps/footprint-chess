/*
 * Footprint Chess: the lesson player. Runs one lesson (watch, then practice)
 * on FC.board, using a lesson-local board (FC.lessons.boardFor) and
 * FC.rules.movesFor for legality. No round/rail logic lives here; see
 * js/app.js for when a lesson starts and what happens after it.
 *
 * Every async callback (timers, hand/move/voice "done") checks a run token
 * bumped by stop(), so Skip, Replay or a character tap mid-lesson never
 * leaves a stray animation, sound or state change behind.
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
  var junkNodes = {};    // "r,c" -> DOM node, for junk bots in the lesson

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
  function heroColor() { return B.TYPES[current.type].color; }

  function placeSetup(lesson, animateEnter) {
    heroNode = B.addPiece(lesson.type, lesson.setup.hero[0], lesson.setup.hero[1]);
    junkNodes = {};
    (lesson.setup.junk || []).forEach(function (sq) {
      junkNodes[key(sq[0], sq[1])] = B.addPiece('x', sq[0], sq[1]);
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

  // Update the lesson-local board after a move; poof + sparkle + capture
  // sound if it landed on a junk bot.
  function land(from, to) {
    var board = local.board;
    var tokey = key(to[0], to[1]);
    var captured = junkNodes[tokey];
    board[to[0]][to[1]] = board[from[0]][from[1]];
    board[from[0]][from[1]] = null;
    local.hero = to.slice();
    if (captured) {
      delete junkNodes[tokey];
      B.poof(captured);
      B.sparkle(to[0], to[1], 0);
      S.play('capture');
    }
  }

  /* ---------- stop / prepare ---------- */

  // Cancels everything (timers, voice, hand, glow). Does not clear pieces;
  // the caller is always about to start something else (another lesson, the
  // star round, or the ready state).
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
      B.later(next, step.wait);
      return;
    }
    if (step.select) {
      var hero = local.hero;
      var wmoves = R.movesFor(local.board, hero[0], hero[1]);
      heroNode.classList.add('selected');
      B.replay(heroNode, 'bounce');
      B.showFootprints(lesson.type, hero, wmoves, {});
      S.play('select');
      B.later(next, STEP_MS);
      return;
    }
    if (step.unselect) {
      B.hideFootprints({});
      heroNode.classList.remove('selected');
      B.later(next, STEP_MS);
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
      B.hideFootprints({});
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
      B.glow(step.glow, heroColor());
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
      B.later(next, STEP_MS);
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
    moves = R.movesFor(local.board, hero[0], hero[1]);
    heroNode.classList.add('selected');
    B.replay(heroNode, 'bounce');
    B.showFootprints(current.type, hero, moves, {});
    S.play('select');
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
    B.hideFootprints({});
    heroNode.classList.remove('selected');
    selected = false;
    busy = true;
    hintSq = null;
    var from = local.hero.slice();
    var to = [mv.r, mv.c];
    B.moveHero(heroNode, current.type, from, to, function () {
      if (myToken !== token) return;
      land(from, to);
      busy = false;
      taskIndex += 1;
      if (taskIndex < current.practice.length) {
        rest(local.hero[0], local.hero[1]);
        armIdle(myToken);
      } else {
        finishPractice(myToken);
      }
    });
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

  function handleTap(r, c) {
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
    sayLine(selected ? 'tap-footprint' : 'tap-robot', myToken);
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
