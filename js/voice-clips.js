/*
 * Footprint Chess: ids of recorded voice clips.
 *
 * Lists only the ids that have a matching file at audio/voice/<id>.mp3, so
 * js/voice.js never fetches a file that does not exist (a 404 request would
 * still cost a network round trip, and the device may be offline). Every id
 * here must also be a key in FC.lessons.LINES (tests/lessons.test.js checks
 * both directions). Starts empty: until recordings are added, js/voice.js
 * falls back to speechSynthesis, or to silence with correct pacing.
 *
 * To add a recording: record it per docs/VOICE-SCRIPT.md, save it as
 * audio/voice/<id>.mp3, then add the id to this list.
 *
 * Classic script: exposes window.FC.voiceClips in the browser and
 * module.exports in Node.
 */
(function (root) {
  'use strict';

  var voiceClips = [];

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = voiceClips;
  } else {
    root.FC = root.FC || {};
    root.FC.voiceClips = voiceClips;
  }
})(this);
