# Design

## Audience

Children around six years old. This includes children who find left and right, reading, or changes of viewpoint difficult, and children with short attention spans.

## Principles

1. **Show direction, never name it.** The app never says left, right or a square name like e4. Tapping a piece marks every square it can reach with footprints.
2. **Fixed viewpoint.** The board never rotates. The child's side is always at the bottom.
3. **Landmarks instead of directions.** The home edge and the far edge each have a theme landmark. In the Robots theme, the charging station is at home and the junkyard is across the board. "Forward" means toward the far landmark.
4. **Characters whose movement matches the rule.**

   | Piece  | Robots theme | Movement animation |
   |--------|--------------|--------------------|
   | Rook   | Rail bot     | Glides along straight lines |
   | Bishop | Slide bot    | Swooshes along diagonals |
   | Queen  | Star bot     | Glides either way and leaves sparkles |
   | King   | Sleepy bot   | Shuffles one square |
   | Knight | Spring bot   | Two hops: two squares, then one to the side |
   | Pawn   | Mini bot     | Marches forward, captures diagonally |

   The robot shapes keep the real chess silhouettes, such as battlements, mitre, crown, cross, horse head and round head, so children can recognise them on a real board later.

5. **Short rounds.** Each round lasts about 60 to 90 seconds and has one goal. Feedback arrives within about 100 ms of a tap.
6. **No fail states.** On a wrong tap the piece wiggles and the footprints pulse. After 5 seconds without a tap, a hint plays. A star that can no longer be reached moves to a square that can.
7. **Everything is open.** No level is locked.
8. **Calm by default.** Motion responds to the child's actions. Nothing loops or flashes while the child is thinking. The system reduced-motion setting is respected, and a calm mode is planned.
9. **Almost no text.** Instructions are short voice lines with pictures and animation.
10. **Original artwork only.** Themes do not use characters or artwork from existing books, films, games or brands.

## Lessons

Each lesson teaches one idea as "watch, then do" on the real board.

- **Watch (10 to 15 seconds).** A short script of voice lines, moves, footprints, glowing squares and landmark pulses. A ghost hand shows where to tap. Taps on the board are ignored during this part.
- **Do.** The child repeats it on the same position, following the ghost hand: tap the robot, then the footprint the hand rests on. Any legal move counts unless the lesson needs a specific square (the bump lesson). Wrong taps make the piece wiggle and the footprints pulse, with no voice. After 5 seconds idle, a short voice hint plays and the hand taps once.
- **Replay and Skip.** Replay is always in the side bar; outside a lesson it plays the current character's lesson. Skip appears during a lesson and goes straight to that piece's star round.

| Lesson | Idea | When it plays |
|--------|------|---------------|
| Hello | Tap your robot, footprints appear, tap a footprint | First tap after the page loads |
| Rail bot | Straight lines, as far as it likes | After Hello, or on the first tap of that character |
| Slide bot | Slanted lines, always on its own colour | First tap of that character |
| Star bot | Rail and Slide together | First tap of that character |
| Sleepy bot | One step, any way | First tap of that character |
| Spring bot | Two, then one to the side; jumps over things | First tap of that character |
| Bump! | Landing on a junk bot clears it away | After the first star round won with a piece other than the pawn |
| Mini bot | Marches toward the junkyard; the first step can be two | First tap of that character |

"First tap" means the first time since the page was loaded. Nothing is stored, so lessons play again after a reload.

### Voice

The voice lines are listed in [VOICE-SCRIPT.md](VOICE-SCRIPT.md), in English and Telugu. English is the default language; Telugu is chosen with `?lang=te` in the address bar, and a language button in the side bar switches at any time without losing a line already playing. `document.documentElement.lang` stays `en`, since the app's own labels are all English; only the spoken lesson lines change.

For the current language, a line plays from a recorded clip if one exists, otherwise through the device's speech synthesis, otherwise, when the language is Telugu, the same two steps again in English, otherwise silently with its estimated length so the pacing stays the same. English never falls back to Telugu. Device speech is deliberately soft: a slightly slow rate and a slightly raised pitch, with a voice chosen to sound less flat than the browser default where one is available. The sound button in the side bar turns voice off together with the sound effects.

Voice clips are generated with Azure's neural text-to-speech using [tools/make-voice.js](../tools/make-voice.js); see VOICE-SCRIPT.md for how to run it and for the recording spec that also applies to a parent's own recordings.

## Roadmap

1. **Foundation (done).** Board, footprints, move animations, Robots theme, star rounds, device check page.
2. **Lesson player (done, voice clips pending).** Short scripted animations played on the real board ("watch, then do"), a ghost hand that shows where to tap, replay and skip, lesson text in English and Telugu with a language switch, and voice clips.
3. **Games.** Catch the mouse, pawn race, and small games against a simple bot using only the pieces met so far.
4. **Themes.** Space, Dinosaurs and Adventure, with a theme switcher that can be used at any time.
5. **Profiles.** Picture profiles, a sticker book, and a parent corner with calm mode and a backup code. Progress is stored on the device only.
6. **Advanced.** Check and checkmate, Mirror Pond (the opponent's view), hand-print levels that introduce left and right, and offline mode with a service worker.

## Rules not yet implemented

Check, checkmate, castling, en passant and promotion. Pieces currently move without regard to the safety of their own king.
