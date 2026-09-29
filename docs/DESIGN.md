# Design

## Audience

Children around six years old. This includes children who find left and right, reading, or changes of viewpoint difficult, and children with short attention spans.

## Principles

1. **Show direction, never name it.** The app never says left, right or a square name like e4. Tapping a piece marks every square it can reach with footprints.
2. **Fixed viewpoint.** The board never rotates. The child's side is always at the bottom.
3. **Real chess terms, everywhere, in every language.** Every piece is always named and spoken of by its real chess name (rook, bishop, queen, king, knight, pawn) and every capture is called a capture. The board's two edges are "your side" (row 7, the child's home edge) and "the other side" (row 0, the opponent's edge). Voice lines use them for direction ("toward the other side"; Telugu అవతలి వైపు) and never say left or right. The Telugu names are king రాజు, queen మంత్రి, rook ఏనుగు, bishop ఒంటె, knight గుర్రం, pawn భటుడు, and a chess piece generally is పావు. The robot theme is decoration, not vocabulary: no robot name (or word for robot, junk or bump) is ever said or written to the child, in any language.
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
6. **No fail states.** On a wrong tap the piece wiggles and the footprints pulse. After 5 seconds without a tap, a hint plays. An opponent pawn that can no longer be captured moves to a square where it can.
7. **Everything is open.** No level is locked.
8. **Calm by default.** Motion responds to the child's actions. Nothing loops or flashes while the child is thinking. The system reduced-motion setting is respected: it removes motion (animations finish at once, effects are skipped) but never changes pacing, so lesson pauses, the Meet card's minimum time, the opponent's thinking pause and similar timings stay the same. A calm mode is planned.
9. **Almost no text.** Instructions are short voice lines with pictures and animation.
10. **Original artwork only.** Themes do not use characters or artwork from existing books, films, games or brands.
11. **Always clear who is in control.** While the app is showing something, the board has a purple ring and a "Watch" badge (eye icon; Telugu చూడు), and taps on the board only wiggle the badge. When control passes to the child, the ring turns green and the badge pops to "Your turn!" (hand icon; Telugu నీ వంతు!) with a bright chime, followed by the "Now you try!" line. Rounds are always in the "Your turn" state; cards and the home screen show neither. Every future activity uses the same two signals.

## Flow

Every activity states its goal before it starts, in voice and in a picture, and has a clear ending.

- **Home.** Six piece cards (robot art, a real-piece badge, the name in the current language). Nothing is ever locked; the suggested card (the first piece not yet played this page load, rook at first) glows with a play badge, but any card can be tapped. Top-right: language, sound, and a "?" link to [help.html](../help.html) for grown-ups.
- **Meet.** The first time a piece is chosen, a card shows the real piece shape next to the robot character and says its name ("This is the rook."). Continues on a tap, or on its own once the line has finished and a couple of seconds have passed.
- **Lesson.** The piece's "watch, then do" lesson (see below), followed by a short lesson on capturing with that piece, the first time each is needed.
- **Mission.** Before every round, a card states the goal out loud and in pictures ("Capture all three pawns!") with three pawn pictures and a play button. Shown every time, even on a repeat round.
- **Round.** The child captures three opponent pawns with the chosen piece. A captured pawn fills a slot in the side panel's goal.
- **Won.** A short cheer and confetti, then a card: play the same piece again, try the next piece, or go home.
- **Games.** A second row of three game cards on Home (see "Games" below).

## Lessons

Each lesson teaches one idea as "watch, then do" on the real board.

- **Watch (10 to 18 seconds).** A short script of voice lines, moves, footprints, glowing squares and edge pulses. A ghost hand shows where to tap. Taps on the board are ignored during this part.
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

The voice lines are listed in [VOICE-SCRIPT.md](VOICE-SCRIPT.md), in English and Telugu. English is the default language; Telugu is chosen with `?lang=te` in the address bar, and a language button (on the home screen and in the side panel) switches at any time without losing a line already playing. The languages are listed in one registry, `js/langs.js` (id, names, button glyph, device-voice prefix and preferences, fallback language, Azure voice, the wording of "<team>'s turn"); every part of the app that depends on the set of languages reads it, so adding a language is mostly a data change (see [LANGUAGES.md](LANGUAGES.md)). With exactly two languages the button switches to the other one and shows that language's glyph; with three or more it opens a small language row like the theme row, one round button per language showing its glyph, with the current one ringed. `document.documentElement.lang` stays `en`, since the app's own labels are all English; only the spoken lines change.

For the current language, a line plays from a recorded clip if one exists, otherwise through the device's speech synthesis, otherwise, for a language with a fallback (Telugu, whose fallback is English), the same two steps again in the fallback language, otherwise silently with its estimated length so the pacing stays the same. The default language never falls back to another language. Device speech is deliberately soft: a slightly slow rate and a slightly raised pitch, with a voice chosen to sound less flat than the browser default where one is available. The sound button turns voice off together with the sound effects.

**Narration interrupts, announcements queue.** `FC.voice.say(id, done)` is for lesson narration and flow steps: it stops whatever is playing, drops the queue, and the interrupted line's `done` is never called. `FC.voice.sayAfter(id, done)` is for announcements that must not cut one another off ("A golden pawn!" then "You got a sticker!", the team name then the game's mission line, "The knight is getting tired!", "Your piece is back!", "Their turn." / "Your turn!", a sticker line then the win line). With nothing playing it behaves like `say`; otherwise the line waits in a queue of at most four and plays when the current line has finished and its `done` has run. A later `say` or `stop` drops the queue without calling its callbacks. When the queue is full the oldest item without a callback is dropped; an item whose callback drives the flow (a win line that then opens the Won card) is never dropped.

Voice clips are generated by the owner from the wording in [VOICE-SCRIPT.md](VOICE-SCRIPT.md), currently with their own local text-to-speech script; [tools/make-voice.js](../tools/make-voice.js) (Azure neural text-to-speech) is an alternative. See VOICE-SCRIPT.md for both workflows and for the recording spec that also applies to a parent's own recordings.

## Games

Three short games, each against a gentle opponent (`js/games.js`, tested for "the child always finishes"): **Catch the knight** (the last piece chosen on Home, not the pawn, chases a knight that hops away after every move and tires after six of the child's moves), **Pawn race** (three pawns each; the first to reach the other side wins; the opponent stays at least one row short of the child's side and never leaves the child with fewer than two pawns) and **Little battle** (the rook plus up to two other pieces whose lessons were seen this page load clear four opponent pawns; a captured piece returns on the child's back row). None has a score, lives or a timer. Every game states its goal on a Mission card, in voice and in a picture, and ends on a Won card (again, the next game, home).

Flow: game card, the "Taking turns" lesson (the first game after a page load only; Skip is available), the Team card (once per page load), the Mission card, the game, the Won card. The game's starting position is set up behind the Mission card, and the side panel shows the game's own goal picture instead of the capture round's three pawn slots.

**Turn-taking.** The "Taking turns" lesson uses two extra script steps: `{ turn }` lights one team bar and plays a soft tick (no voice; the next spoken line narrates, and the badge stays "Watch"), and `{ foeMove }` moves the opponent's pawn. Its first practice task has a `reply`: after the child's move the player shows the opponent's turn (badge "<team>'s turn", top bar lit, "Their turn."), waits, moves the opponent, then hands control back (chime, green ring, bottom bar lit, "Your turn!"). In games the opponent's turn follows the same pattern, with a 0.6 to 0.9 second pause before it moves; "Their turn." is spoken on every other opponent turn only, "Your turn!" every time.

**Teams.** Each theme has two teams (`js/themes.js` TEAMS): Humanoids and Androids, White and Black, Astronauts and Cosmonauts, Theropods and Sauropods, Buccaneers and Corsairs. Team a is the "White" side and moves first. The child picks either team; the chosen team always plays from the bottom (the board never rotates), so picking team b means the opponent moves first. The edge strips show a team bar (a pawn and the name), top for the other team and bottom for the child's, the active one lit and the other dimmed to 45% opacity, during games and the "Taking turns" lesson only. In Classic, playing Black swaps the two colour sets (the child's pieces black, the opponent's ivory); every other theme keeps the child's per-type colours whichever team is picked.

**Juice.** Every capture, in games and capture rounds, gives a burst of 8 to 12 particles at the square, a small board bump, a hop of the capturing piece, and a chime one semitone higher for each capture in a row (at most six steps; the run resets on a move that captures nothing and when a round or game ends).

**Jar and stickers.** Each captured pawn (not the knight) fills a jar in the panel's mission box, a picture with no numbers. A full jar (10) empties into a sticker: a spoken "You got a sticker!" and a round gold-rimmed badge. About one round or game in five has one golden pawn; capturing it is an instant sticker. Stickers earned show as a small row on Home. They live in memory only, until the page is reloaded; saving them is part of stage 5.

**Break reminder.** Active play time (lessons, rounds and games; not time on Home) is counted. After about 15 minutes, the next Won card is replaced by a calm Break card (a moon, "Great playing! Time for a little break?", keep playing or home). Keep playing resets the timer, as does Home. `?break=off` disables it. Test hooks: `?breakmins=<minutes>` changes the threshold and `?golden=1` forces a golden pawn; both are described in README.md and change nothing else.

## Themes

Five themes: Robots (the default), Classic, Space, Dinosaurs and Pirate (`js/themes.js`). Every theme keeps the same real-piece silhouettes, real chess names and badges (principle 3, above); only the piece artwork and the board/panel colours change. Chosen with `?theme=<id>` in the address bar, exactly like `?lang=`, or with a palette button on the home screen; an unrecognised id falls back to Robots, and nothing is stored on the device.

The world (board, frame, edge strips, background) and the other side's pieces get natural colours for each theme: one dark "other side" piece colour, and, apart from Classic, one accent colour for costume details (Pirate: also a gold, a stripe and a trouser colour, for its crew's shirts, sashes and trousers). The child's own pieces keep the same per-type colours as Robots in every theme except Classic (rook orange, bishop pink, queen purple, king yellow, knight teal, pawn green): distinct colours help a child tell their pieces apart, so only the costume (a sailor's stripes, a dinosaur's spikes, a space suit's ring) changes, not the body colour. Classic is the one exception throughout, a single natural pair (ivory for the child, black for the other side), matching real chess sets. Footprints follow the same rule: per-type in every theme but Classic, which uses its own single colour. Space adds a static star field and Pirate static wave marks to the background (CSS gradients only, no animation, matching principle 8). Pirate replaces the two edge strips entirely: instead of the eight real-piece silhouettes, each strip is a ship's hull with plank lines and cannon ports, the other side's dark hull above the board and the child's light hull below, so the two sides read as two ships facing off.

The theme picker itself never shows a theme's name or any other text, only each theme's own knight on its own background (a theme's English name exists only as an aria-label, for accessibility and the grown-ups' guide) - the same "no robot word to the child" rule the Robots theme already followed extends to every theme.

**Theme sounds.** Each theme also has its own sound cues (`js/sound.js`, `THEME_SOUNDS`), all synthesized with Web Audio, with no audio files. There is one cue for tapping each piece type (rook, bishop, queen, king, knight, pawn), one for a capture and one for a win. The capture cue rises by one semitone per capture in a row, up to six. Robots: beeps, servo whirrs and a spring boing; Classic: wooden clicks and the plain fanfare; Space: blips, lasers, a thruster whoosh and radar pings; Dinosaurs: roars, stomps, a honk and a chirp; Pirate: coins, a ship's bell, a cannon, a parrot, a whistle and a cutlass. The child's own taps play the piece cue (Home cards, side-panel tiles, and tapping one of their pieces on the board in lessons, capture rounds and games); the app's own demonstrations do not. Every cue is a one-shot under 1.5 seconds and nothing loops.

The turn signals are not themed. The Watch and Your turn sounds, and the smaller sounds (tick, nudge, wrong-tap bonk and the move sounds), are the same in every theme, so the child learns them once (principle on who is in control). A gentle limiter after the master volume keeps overlapping theme sounds from clipping.

## Roadmap

1. **Foundation (done).** Board, footprints, move animations, the Robots theme, capture rounds, device check page.
2. **Lesson player (done).** A home screen; Meet, Mission and Won cards; short scripted animations played on the real board ("watch, then do") for every piece and for capturing with it; a ghost hand that shows where to tap; replay and skip; lesson text in English and Telugu with a language switch; a grown-ups guide (`help.html`); and voice clips.
3. **Games (done).** Catch the knight, pawn race and little battle against a gentle opponent, teams, a "Taking turns" lesson, juice, a capture jar with stickers and a break reminder; see "Games" above.
4. **Themes (done).** Classic, Space, Dinosaurs and Pirate alongside Robots, chosen with `?theme=` or a home-screen palette button that can be used at any time; see "Themes" above.
5. **Profiles.** Picture profiles, a sticker book, and a parent corner with calm mode and a backup code. Progress is stored on the device only.
6. **Advanced.** Check and checkmate, Mirror Pond (the opponent's view), hand-print levels that introduce left and right, and offline mode with a service worker.

## Rules not yet implemented

Check, checkmate, castling, en passant and promotion. Pieces currently move without regard to the safety of their own king.
