/*
 * Footprint Chess: the pictures of the games (stage 6).
 *
 * Small word-free pictures built from the piece art: one per game (the
 * Games screen's cards, the Mission card, the Won card's "next game"
 * button) and one mark per row of the Games screen (js/game-list.js).
 * Used by js/games-ui.js.
 *
 * Depends on FC.board, FC.army and FC.gameList (loaded before this file).
 *
 * Classic script: exposes window.FC.gamePics. DOM is built with
 * createElement/textContent only (see SECURITY.md).
 */
(function () {
  'use strict';

  var FC = window.FC;
  var A = FC.army;
  var B = FC.board;
  var GL = FC.gameList;

  function el(tag, cls) { var n = document.createElement(tag); if (cls) n.className = cls; return n; }
  function textEl(tag, cls, str) { var n = el(tag, cls); n.textContent = str; return n; }

  // mini: a compact variant for small spots (the Won card's "next game"
  // button and the panel's mission box).
  function buildGamePic(id, mini) {
    var pic = el('div', mini ? 'game-pic game-pic-mini' : 'game-pic');
    if (id === 'turns') {
      // The "turns" lesson's panel picture: the two teams' pawns.
      pic.appendChild(B.pieceSvg('p', 'me'));
      pic.appendChild(B.pieceSvg('p', 'foe'));
    } else if (id === 'catch') {
      var hand = B.svgUse('ic-hand');
      hand.classList.add('ic-hand-static');
      pic.appendChild(hand);
      pic.appendChild(B.pieceSvg('n', 'foe'));
    } else if (id === 'race') {
      var stack = el('div', 'game-pic-stack');
      stack.appendChild(el('div', 'finish-flag'));
      var row = el('div', 'game-pic-row');
      row.appendChild(B.pieceSvg('p', 'me'));
      row.appendChild(B.pieceSvg('p', 'foe'));
      stack.appendChild(row);
      pic.appendChild(stack);
    } else if (id === 'chain') {
      // One piece, then pawns linked by footprint dots: capture after capture.
      pic.classList.add('game-pic-3');
      pic.classList.add('game-pic-chain');
      pic.appendChild(B.pieceSvg('q', 'me'));
      pic.appendChild(el('span', 'chain-dot'));
      pic.appendChild(B.pieceSvg('p', 'foe'));
      pic.appendChild(el('span', 'chain-dot'));
      pic.appendChild(B.pieceSvg('p', 'foe'));
    } else if (id === 'hop' || id === 'way') {
      // A finish flag over the piece (and, for Find the way, one of the
      // child's own pawns in its way).
      var stack2 = el('div', 'game-pic-stack');
      stack2.appendChild(el('div', 'finish-flag'));
      var row2 = el('div', 'game-pic-row');
      if (id === 'way') row2.appendChild(B.pieceSvg('p', 'me'));
      row2.appendChild(B.pieceSvg(id === 'hop' ? 'n' : 'r', 'me'));
      stack2.appendChild(row2);
      pic.appendChild(stack2);
    } else if (id === 'stop') {
      // An opponent pawn marching down onto the child's rook.
      var stack3 = el('div', 'game-pic-stack game-pic-tight');
      stack3.appendChild(B.pieceSvg('p', 'foe'));
      stack3.appendChild(B.pieceSvg('r', 'me'));
      pic.appendChild(stack3);
    } else if (id === 'safe') {
      // The king, with a shield ring, beside a watching opponent rook.
      var king = el('div', 'safe-king');
      king.appendChild(B.pieceSvg('k', 'me'));
      pic.appendChild(king);
      pic.appendChild(B.pieceSvg('r', 'foe'));
    } else if (id === 'run') {
      // The child's rook hurrying away from an opponent knight.
      pic.classList.add('game-pic-run');
      pic.appendChild(B.pieceSvg('n', 'foe'));
      pic.appendChild(el('span', 'speed-lines'));
      pic.appendChild(B.pieceSvg('r', 'me'));
    } else if (id === 'hands') {
      // The two hand prints: left orange, right blue.
      ['left', 'right'].forEach(function (side) {
        var palm = el('div', 'palm palm-' + side);
        palm.appendChild(B.svgUse('ic-palm'));
        pic.appendChild(palm);
      });
    } else if (id === 'theirs') {
      // Their pawn above its dark footprints, pointing toward your side.
      var st5 = el('div', 'game-pic-stack game-pic-tight');
      st5.appendChild(B.pieceSvg('p', 'foe'));
      var feet = el('div', 'whose-feet their-feet');
      feet.appendChild(el('span'));
      feet.appendChild(el('span'));
      st5.appendChild(feet);
      pic.appendChild(st5);
    } else if (id === 'danger') {
      // An opponent rook looking at the child's piece in a red ring.
      pic.appendChild(B.pieceSvg('r', 'foe'));
      var ring5 = el('div', 'king-ring');
      ring5.appendChild(B.pieceSvg('b', 'me'));
      pic.appendChild(ring5);
    } else if (id === 'mate') {
      // The opponent king in a red ring, the child's queen beside him.
      var cage = el('div', 'king-ring');
      cage.appendChild(B.pieceSvg('k', 'foe'));
      pic.appendChild(cage);
      pic.appendChild(B.pieceSvg('q', 'me'));
    } else if (id === 'escape') {
      // An opponent rook, a red line of danger, the child's king.
      var stack4 = el('div', 'game-pic-stack game-pic-tight game-pic-check');
      stack4.appendChild(B.pieceSvg('r', 'foe'));
      stack4.appendChild(el('div', 'check-line'));
      stack4.appendChild(B.pieceSvg('k', 'me'));
      pic.appendChild(stack4);
    } else if (A.isArmy(id)) {
      // The growing battle: the newest three kinds of piece in that
      // battle, the newest one first.
      var types = A.level(id).types.slice().reverse().slice(0, 3);
      if (types.length === 1) types = ['p', 'p', 'p'];
      pic.classList.add('game-pic-3');
      if (A.level(id).full) {
        // The full game: both kings, with the queen between them.
        pic.appendChild(B.pieceSvg('k', 'me'));
        pic.appendChild(B.pieceSvg('q', 'me'));
        pic.appendChild(B.pieceSvg('k', 'foe'));
      } else {
        types.forEach(function (t) { pic.appendChild(B.pieceSvg(t, 'me')); });
      }
    } else if (id === 'whose') {
      pic.appendChild(buildWhoseMark());
      pic.appendChild(B.pieceSvg('n', 'me'));
    } else if (id === 'games') {
      // Home's Games button: the three rows' marks side by side.
      pic.classList.add('game-pic-entry');
      GL.ROWS.forEach(function (row) { pic.appendChild(buildRowMark(row)); });
    } else {
      pic.classList.add('game-pic-3');
      pic.appendChild(B.pieceSvg('r', 'me'));
      pic.appendChild(B.pieceSvg('p', 'foe'));
      pic.appendChild(B.pieceSvg('p', 'foe'));
    }
    return pic;
  }

  // Two footprints and a question mark: the footprints quiz, and the mark of
  // the thinking row.
  function buildWhoseMark() {
    var mark = el('div', 'whose-mark');
    var feet = el('div', 'whose-feet');
    feet.appendChild(el('span'));
    feet.appendChild(el('span'));
    mark.appendChild(feet);
    mark.appendChild(textEl('div', 'whose-q', '?'));
    return mark;
  }

  // The picture at the start of each row of the Games screen (no words):
  // a pawn being captured, the finish flag, footprints with a question mark.
  function buildRowMark(row) {
    var mark = el('div', 'row-mark row-mark-' + row);
    if (row === 'capture') {
      mark.appendChild(el('div', 'row-burst'));
      mark.appendChild(B.pieceSvg('p', 'foe'));
    } else if (row === 'pond') {
      // The pond: a pawn and its upside-down reflection in still water.
      var water = el('div', 'pond-mark');
      water.appendChild(B.pieceSvg('p', 'foe'));
      var refl = B.pieceSvg('p', 'foe');
      refl.classList.add('pond-mark-ref');
      water.appendChild(refl);
      mark.appendChild(water);
    } else if (row === 'king') {
      // The king in a red ring: games about keeping him safe.
      var ring = el('div', 'king-ring');
      ring.appendChild(B.pieceSvg('k', 'me'));
      mark.appendChild(ring);
    } else if (row === 'army') {
      // The growing battle: a whole army, pawns in front of their pieces.
      mark.classList.add('row-mark-army');
      var back = el('div', 'army-mark-row');
      ['r', 'k', 'b'].forEach(function (t) { back.appendChild(B.pieceSvg(t, 'me')); });
      var front = el('div', 'army-mark-row');
      ['p', 'p', 'p'].forEach(function (t) { front.appendChild(B.pieceSvg(t, 'me')); });
      mark.appendChild(front);
      mark.appendChild(back);
    } else if (row === 'reach') {
      mark.appendChild(el('div', 'finish-flag'));
      mark.appendChild(B.pieceSvg('p', 'me'));
    } else {
      mark.appendChild(buildWhoseMark());
    }
    return mark;
  }

  FC.gamePics = {
    game: buildGamePic,
    rowMark: buildRowMark
  };
})();
