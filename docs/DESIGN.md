# Design

## Audience

Children around six years old. This includes children who find left and right, reading, or changes of viewpoint difficult, and children with short attention spans.

## Principles

1. **Show direction, never name it.** The app never says left, right or a square name like e4. Tapping a piece marks every square it can reach with footprints.
2. **Fixed viewpoint.** The board never rotates. The child's side is always at the bottom.
3. **Real chess terms, everywhere, in every language.** Every piece is always named and spoken of by its real chess name (rook, bishop, queen, king, knight, pawn) and every capture is called a capture. The board's two edges are "your side" (row 7, the child's home edge) and "the other side" (row 0, the opponent's edge); a voice line never names an edge directly, and never says left or right. The Telugu names are king రాజు, queen మంత్రి, rook ఏనుగు, bishop ఒంటె, knight గుర్రం, pawn భటుడు, and a chess piece generally is పావు. The robot theme is decoration, not vocabulary: no robot name (or word for robot, junk or bump) is ever said or written to the child, in any language.
4. **Characters whose movement matches the rule.** The robot theme is a costume over the real piece: every robot is always shown with a small badge of the real piece's silhouette, and always named with its real chess name (see the terminology rule above), never the robot's own nickname.

   | Piece  | Movement animation | Robot look |
   |--------|--------------------|------------|
   | Rook   | Glides along straight lines | Battlements |
   | Bishop | Swooshes along diagonals | Mitre |
   | Queen  | Glides either way and leaves sparkles | Crown with sparkles |
   | King   | Shuffles one square | Crown with a cross |
   | Knight | Two hops: two squares, then one to the side | Horse head |
   | Pawn   | Marches forward, captures diagonally | Round head |

   Opponent pawns (the capture rounds' targets) are the same pawn robot in dark colours, standing in for "the other side"; they are still always called pawns.

5. **Short rounds.** Each round lasts about 60 to 90 seconds and has one goal. Feedback arrives within about 100 ms of a tap.
6. **No fail states.** On a wrong tap the piece wiggles and the footprints pulse. After 5 seconds without a tap, a hint plays. A star that can no longer be reached moves to a square that can.
7. **Everything is open.** No level is locked.
8. **Calm by default.** Motion responds to the child's actions. Nothing loops or flashes while the child is thinking. The system reduced-motion setting is respected, and a calm mode is planned.
9. **Almost no text.** Instructions are short voice lines with pictures and animation.
10. **Original artwork only.** Themes do not use characters or artwork from existing books, films, games or brands.

## Flow

Every activity states its goal before it starts, in voice and in a picture, and has a clear ending.

- **Home.** Six piece cards (robot art, a real-piece badge, the name in the current language). Nothing is ever locked; the suggested card (the first piece not yet played this page load, rook at first) glows with a play badge, but any card can be tapped. Top-right: language, sound, and a "?" link to [help.html](../help.html) for grown-ups.
- **Meet.** The first time a piece is chosen, a card shows the real piece shape next to the robot character and says its name ("This is the rook."). Continues on a tap, or on its own once the line has finished and a couple of seconds have passed.
- **Lesson.** The piece's "watch, then do" lesson (see below), followed by a short lesson on capturing with that piece, the first time each is needed.
- **Mission.** Before every round, a card states the goal out loud and in pictures ("Capture all three pawns!") with three pawn pictures and a play button. Shown every time, even on a repeat round.
- **Round.** The child captures three opponent pawns with the chosen piece. A captured pawn fills a slot in the side panel's goal.
- **Won.** A short cheer and confetti, then a card: play the same piece again, try the next piece, or go home.

## Lessons

Each lesson teaches one idea as "watch, then do" on the real board.

- **Watch (10 to 15 seconds).** A short script of voice lines, moves, footprints, glowing squares and edge pulses. A ghost hand shows where to tap. Taps on the board are ignored during this part.
- **Do.** The child repeats it on the same position, following the ghost hand: tap the piece, then the footprint the hand rests on. Any legal move counts unless the lesson needs a specific square (every capturing lesson). Wrong taps make the piece wiggle and the footprints pulse, with no voice. After 5 seconds idle, a short voice hint plays and the hand taps once.
- **Replay and Skip.** Replay plays the current piece's lesson again, from the Meet card. Skip appears only during a Meet card or a lesson, and goes straight to that piece's Mission card.

| Lesson | Idea | When it plays |
|--------|------|---------------|
| Hello | Tap your piece, footprints appear, tap a footprint | The first piece ever chosen, before its own lesson |
| Rook | Straight lines, as far as it likes | The first time the rook is chosen |
| Bishop | Slanted lines, always on its own colour | The first time the bishop is chosen |
| Queen | Straight and slanted together | The first time the queen is chosen |
| King | One step, any way | The first time the king is chosen |
| Knight | Two squares, then one to the side; jumps over things | The first time the knight is chosen |
| Pawn | Marches toward the other side; the first step can be two | The first time the pawn is chosen |
| Capture: rook / bishop / queen / king / knight | Move onto an opponent pawn's square to capture it | Right after that piece's own lesson, the first time |
| Pawn capture | A pawn captures on the slant, one step ahead, never straight ahead | Right after the pawn's own lesson, the first time |

"The first time" means the first time since the page was loaded. Nothing is stored, so lessons play again after a reload.

### Voice

The voice lines are listed in [VOICE-SCRIPT.md](VOICE-SCRIPT.md), in English and Telugu. English is the default language; Telugu is chosen with `?lang=te` in the address bar, and a language button (on the home screen and in the side panel) switches at any time without losing a line already playing. `document.documentElement.lang` stays `en`, since the app's own labels are all English; only the spoken lines change.

For the current language, a line plays from a recorded clip if one exists, otherwise through the device's speech synthesis, otherwise, when the language is Telugu, the same two steps again in English, otherwise silently with its estimated length so the pacing stays the same. English never falls back to Telugu. Device speech is deliberately soft: a slightly slow rate and a slightly raised pitch, with a voice chosen to sound less flat than the browser default where one is available. The sound button turns voice off together with the sound effects.

Voice clips are generated with Azure's neural text-to-speech using [tools/make-voice.js](../tools/make-voice.js); see VOICE-SCRIPT.md for how to run it and for the recording spec that also applies to a parent's own recordings.

## Roadmap

1. **Foundation (done).** Board, footprints, move animations, the Robots theme, capture rounds, device check page.
2. **Lesson player (done).** A home screen; Meet, Mission and Won cards; short scripted animations played on the real board ("watch, then do") for every piece and for capturing with it; a ghost hand that shows where to tap; replay and skip; lesson text in English and Telugu with a language switch; a grown-ups guide (`help.html`); and voice clips.
3. **Games.** Catch the mouse, pawn race, and small games against a simple bot using only the pieces met so far.
4. **Themes.** Space, Dinosaurs and Adventure, with a theme switcher that can be used at any time.
5. **Profiles.** Picture profiles, a sticker book, and a parent corner with calm mode and a backup code. Progress is stored on the device only.
6. **Advanced.** Check and checkmate, Mirror Pond (the opponent's view), hand-print levels that introduce left and right, and offline mode with a service worker.

## Rules not yet implemented

Check, checkmate, castling, en passant and promotion. Pieces currently move without regard to the safety of their own king.
