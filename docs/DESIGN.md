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
9. **Almost no text.** Instructions will be short audio clips with pictures.
10. **Original artwork only.** Themes do not use characters or artwork from existing books, films, games or brands.

## Roadmap

1. **Foundation (done).** Board, footprints, move animations, Robots theme, star rounds, device check page.
2. **Lesson player.** Short scripted animations played on the real board ("watch, then do"), a ghost hand that shows where to tap, replay and skip, and voice clips.
3. **Games.** Catch the mouse, pawn race, and small games against a simple bot using only the pieces met so far.
4. **Themes.** Space, Dinosaurs and Adventure, with a theme switcher that can be used at any time.
5. **Profiles.** Picture profiles, a sticker book, and a parent corner with calm mode and a backup code. Progress is stored on the device only.
6. **Advanced.** Check and checkmate, Mirror Pond (the opponent's view), hand-print levels that introduce left and right, and offline mode with a service worker.

## Rules not yet implemented

Check, checkmate, castling, en passant and promotion. Pieces currently move without regard to the safety of their own king.
