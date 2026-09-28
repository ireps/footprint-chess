# Voice script

The lesson player (stage 2) speaks the lines below. Ids and text must match
`js/lessons.js` (`FC.lessons.LINES`) exactly; `tests/lessons.test.js` checks
this file against that source.

Until a line is recorded, the app falls back to the device's speech
synthesis, or to silence timed by the `ms` estimate in `js/lessons.js`. A
line becomes an actual recording only once its id is added to
`js/voice-clips.js` and its file exists at `audio/voice/<id>.mp3`.

## Lines

| id | line | delivery note |
|----|------|----------------|
| hello-1 | Meet your robot. | Warm, a little playful. This is the first thing the child ever hears from the app. |
| hello-2 | Tap your robot to see its footprints. | Plain and clear; this is the core mechanic of the whole app. |
| hello-3 | Tap a footprint, and off it goes! | Bright, a small "ta-da". |
| rook-1 | Rail bot only moves in straight lines. | Matter-of-fact, introducing the character. |
| rook-2 | It can glide all the way toward the junkyard. | Smooth delivery to match the glide. |
| rook-3 | Or it can glide straight across, just as far. | Same energy as rook-2; a second example, not a new idea. |
| bishop-1 | Slide bot only moves on slanty lines. | Matter-of-fact. |
| bishop-2 | It always stays on its own colour. | Gentle emphasis on "always". |
| bishop-3 | Watch it swoosh the other way. | Playful, a little swoop in the voice on "swoosh". |
| queen-1 | Star bot moves like Rail bot and Slide bot together. | Warm, a little impressed. |
| queen-2 | Straight lines, just like Rail bot. | Quick, a reminder rather than new information. |
| queen-3 | And slanty lines too, with sparkles! | Bright on "sparkles". |
| king-1 | Sleepy bot only takes one little step. | Slow, sleepy, a small yawn in the delivery. |
| king-2 | But it can step any way it likes. | Still sleepy, a touch of surprise on "any way". |
| king-3 | Then it needs a little rest. | Trails off, matching the sleepy character. |
| knight-1 | Spring bot hops in a special shape. | Bouncy, energetic. |
| knight-2 | It hops two, then one to the side. | Springy rhythm: "two", then a light landing on "side". |
| knight-3 | It can even jump over junk bots! | Excited; this is the surprising part of the rule. |
| bump-1 | Uh oh, a junk bot is in the way! | Mock-worried, not actually alarming; no fail state in this game. |
| bump-2 | Land on it, and bump! It is gone. | Playful "bump" with a little emphasis, like a sound effect. |
| bump-3 | See? The way is clear now. | Calm and pleased. |
| pawn-1 | Mini bot marches straight toward the junkyard. | Steady, marching rhythm. |
| pawn-2 | Its very first step can be two squares. | Slight emphasis on "first" and "two". |
| pawn-3 | After that, just one small step at a time. | Calmer, settling into the regular pace. |
| your-turn | Now you try! | Encouraging, inviting, said at the start of every practice. |
| tap-robot | Tap your robot. | Plain hint, used if the child is idle before the first tap. |
| tap-footprint | Tap a footprint. | Plain hint, used if the child is idle after selecting. |
| great | Great job! | Warm praise, said when a practice task is completed. |

## Recording spec

- Format: mono MP3, 22.05 kHz or 24 kHz sample rate, 48 to 64 kbps.
- Trim leading and trailing silence.
- Peak-normalise to about -1 dBFS.
- File name: `audio/voice/<id>.mp3`, using the id from the table above
  exactly (for example `audio/voice/hello-1.mp3`).
- After adding a file, add its id to the `voiceClips` list in
  `js/voice-clips.js` so the app knows to fetch it. An id left out of that
  list is treated as not yet recorded, even if the file exists.
- Voice can be recorded by the parent, or generated with an external
  text-to-speech tool from this script. Either way the file goes through
  the same recording spec above before it is added.
