# Footprint Chess

A chess-learning web app for young children. It is a static site served by GitHub Pages and is built to run on older tablets. The target device is an Amazon Fire HD 10 (7th generation, Fire OS 5, Silk browser).

Live site: https://ireps.github.io/footprint-chess/

## How it teaches

- Real chess terms only: rook, bishop, queen, king, knight, pawn, capture. No left, right or square names. Tapping a piece shows footprints on every square it can reach.
- The board never rotates. The child's side is always at the bottom ("your side"); the opponent's side is always at the top ("the other side").
- Each piece is drawn as a robot character whose movement animation matches its rule, but every piece is always named and shown with its real chess shape; the robot theme is decoration, not vocabulary.
- Short rounds: capture three opponent pawns. Instant feedback, no fail states, no locked levels.
- A Games screen with nine short games in three picture-marked rows: catch the knight, little battle and capture chain; pawn race, knight hop and find the way; "Whose footprints?" (a voice quiz about how each piece moves), stop the pawns and keep the king safe. The team games are against a gentle opponent, with two named teams per theme and a "taking turns" lesson. After a win the board can show a short tip, and a capture jar earns stickers; there is an optional break reminder. See "Games" in [docs/DESIGN.md](docs/DESIGN.md).
- Picture profiles for up to four children, a sticker book, and a grown-ups' corner. No login, no tracking, and nothing is sent anywhere: progress is saved only in this browser, on this device.

Details are in [docs/DESIGN.md](docs/DESIGN.md).

## Language

English is the default. Telugu is available at `?lang=te` (for example
`https://ireps.github.io/footprint-chess/?lang=te`), so it can be
bookmarked (it wins over the language a child last chose, for that visit). A language button in the side
bar switches at any time: with two languages it shows the *other* language's
glyph ('అ' in English, 'A' in Telugu) and updates the address bar to match.
Lines already playing when you switch are not interrupted.

The languages are listed in one registry, `js/langs.js`, which everything
else reads. With three or more languages the button opens a small row of
round buttons, one per language, like the theme row. Adding a language is
mostly a data change: see [docs/LANGUAGES.md](docs/LANGUAGES.md).

## Themes

Five themes: Robots (the default), Classic, Space, Dinosaurs and Pirate. Every
theme keeps the same real chess silhouettes, names and badges; only the piece
artwork and colours change. The board, frame and the other side's pieces get
natural colours for each theme; the child's own pieces keep the same
per-type colours as Robots in every theme except Classic, which uses a
single ivory-and-black pair for both. Choose a theme with `?theme=<id>` (for example
`https://ireps.github.io/footprint-chess/?theme=pirate`), the same way as
`?lang=`, or with the palette button on the home screen, which shows each
theme only as its own knight on its own colours, with no text. The theme
and the language a child chooses are saved for that child (see Profiles).

## Profiles, stickers and the grown-ups' corner

Each child has a picture profile (a piece in a theme's artwork with a coloured ring, and an optional name), saved in this browser's local storage on this device, under the key `footprint-chess`. A first-time child goes straight to the home screen; with two or more children the app starts on "Who's playing?". The child's picture at the top left of Home opens that screen. For each child the app remembers lessons seen, pieces played (a green tick on their Home card), stickers, the capture jar, the team picked in each theme, games won, language and theme.

The book button on Home opens the sticker book: a tab per theme, and two pages of four slots (rook, bishop, queen, king; knight, pawn, golden pawn, golden king). A full jar earns a sticker of the piece being played, a golden pawn earns a golden pawn, and winning three different games in a theme for the first time earns its golden king. No numbers are shown anywhere.

Holding the "?" button on Home for two seconds opens the grown-ups' corner (a tap still opens `help.html`; `index.html#grownups` opens it too, from a link on the help page): calm mode, the break reminder and its length, the children (pictures, names, adding and removing), a backup code to move progress to another device, and clearing everything. It is in English. All progress goes through `js/store.js`, which treats stored data and backup codes as untrusted. See [PRIVACY.md](PRIVACY.md).

## Status

Stages 1 to 5 are complete (stages 3 and 5, the games and the profiles, await tablet testing), and so is stage 6 (more games, a quiz and tips; awaiting tablet testing). Stage 7 has begun with offline mode: after the first visit the app works with no internet. So far: a home screen, board, tap-to-move, footprints for all six pieces, five themes (Robots, Classic, Space, Dinosaurs, Pirate; decoration only, every piece is always named and shown with its real chess shape), capture rounds (capture three opponent pawns), sound effects (with per-theme sounds for tapping a piece, a capture and a win), a device check page (`check.html`), a lesson player with a "watch, then do" lesson and a capturing lesson for every piece, nine games with teams, turn-taking, a footprints quiz, tips after a game, a capture jar and stickers, and a break reminder (see below), a grown-ups guide (`help.html`), and lesson text in English and Telugu with a language switch button. Every voice line has a clip in both languages (see [docs/VOICE-SCRIPT.md](docs/VOICE-SCRIPT.md)); if a clip is missing, the app falls back to the device's speech synthesis, or to silence. The roadmap is in [docs/DESIGN.md](docs/DESIGN.md#roadmap).

## Games

The Games button on the home screen opens the Games screen: five rows, each marked with a picture (capture games, reach-the-other-side games, thinking games, the other side's view, king games). The games are catch the knight, little battle, capture chain (capture four still pawns, each capture landing one move from the next), pawn race, knight hop (the knight reaches the other side), find the way (one piece reaches the other side around the child's own pawns), "Whose footprints?" (a quiz: tap the piece that makes the footprints shown), stop the pawns (capture three pawns marching toward you), their footprints and which piece is in danger? (the other side's view, with a pond showing their pieces reflected), run away (stay where a chasing piece of another kind cannot capture you), keep the king safe (walk the king to the other side, never onto a square an opponent piece could capture on) get out of check (five small puzzles after a short "Check" lesson) and checkmate in one (five puzzles after a short "Checkmate" lesson; stage 7). In the team games each theme has two teams; the child picks one, and the picked team always plays from the bottom. The first team game a child plays starts with a "Taking turns" lesson. The Team card always shows when a team game is started from the Games screen, with the team chosen last time in that theme ringed; "play again" and the next game skip it. Each game starts, the first time a child plays it, with a short "watch how to play" example on the board (Catch the knight shows how to catch a piece that moves differently from yours); the light bulb on the Mission and finished-game cards replays it. After a win, a piece's rule plays again if the child kept tapping squares it cannot reach. Stickers go in the child's sticker book.

Query parameters, all read once at page load:

- `?break=off` turns off the break reminder for that visit (a calm card shown at the next "won" card after about 15 minutes of play; the corner has the same switch and the length). It is documented for grown-ups in `help.html`.
- `?golden=1` and `?breakmins=<minutes>` are test hooks. `?golden=1` makes one target in every capture round and game a golden pawn, instead of a 1-in-5 chance. `?breakmins=0.1` sets the break length to a fraction of a minute instead of the corner's setting; it never turns the reminder on. Neither changes anything else.

## Run locally

Serve the folder with any static web server:

```
python3 -m http.server 8000
```

Open http://localhost:8000. To try it on the tablet, open `http://<computer-ip>:8000` on the same Wi-Fi network.

Opening `index.html` directly from disk is not supported.

## Tests

Requires Node.js 18 or later. There is nothing to install.

```
node --test
```

The tests cover the movement rules (`js/rules.js`), the offline file list (`sw.js` must match `tools/make-offline.js`; run `node tools/make-offline.js` after changing any page, style, script or clip), capture round generation (`js/levels.js`), the games and their opponent (`js/games.js`), the footprints quiz (`js/quiz.js`), the other side's view games (`js/pond.js`), the game list and its tip choice (`js/game-list.js`), the lesson scripts (`js/lessons.js`), the theme registry (`js/themes.js`), the language registry (`js/langs.js`), the progress store and backup code (`js/store.js`), the sound effects (`js/sound.js`) and the voice clip generator (`tools/make-voice.js`): every move is legal, timings fit, every line uses real chess terms and never a robot name, left, right or a square name in either language, every theme has a sprite symbol for every piece type and a colour rule in `css/app.css`, and the clip-generating tool's SSML, argument parsing and file indexing behave correctly (its Azure network call is never exercised by the tests).

## Deploy

See [docs/SETUP.md](docs/SETUP.md).

## Project layout

```
index.html        The app. Piece artwork is an inline SVG sprite.
help.html         A grown-up's guide to the app; linked from the "?" button.
check.html        Device check page for the tablet.
css/app.css       App styles and animations.
css/help.css      Help page styles.
css/check.css     Device check page styles.
js/rules.js       Movement rules. No DOM access. Tested.
js/levels.js      Capture round generation. No DOM access. Tested.
js/games.js       Rules for the board games and the gentle opponent. No DOM access. Tested.
js/quiz.js        The footprints quiz ("Whose footprints?"). No DOM access. Tested.
js/pond.js        The other side's view games (Their footprints, Which piece is in danger?). No DOM access. Tested.
js/game-list.js   The list of games: rows, lines, teams, and the tip after a win. No DOM access. Tested.
js/langs.js       Language registry: ids, names, glyphs, speech and voice settings, fallback chain, turn wording. No DOM access. Tested.
js/lessons.js     Lesson scripts, piece names and voice line text (English and Telugu). No DOM access. Tested.
js/themes.js      Theme ids, English names (for aria-labels) and team names. No DOM access. Tested.
js/sound.js       Sound effects generated with the Web Audio API, including per-theme sounds.
js/voice-clips.js Ids of the voice lines that have a recorded clip, per language.
js/voice.js       Plays voice clips, with per-language speech and silent fallbacks.
js/board.js       Board view: pieces, footprints, animations, ghost hand.
js/player.js      Lesson player: runs a lesson's watch and practice parts.
js/games-ui.js    Games screens and flow (Games button and screen, team card, games, quiz, tips, break card), capture juice, jar and stickers.
js/store.js       The progress store: children, progress, stickers, settings, backup code. Sanitizes everything it loads. No DOM access. Tested.
js/stickers.js    Sticker art (a gold-rimmed badge in a theme's artwork), the Home shelf, stickers earned this visit.
js/profile-ui.js  A child's picture, and the Who's playing screen.
js/book-ui.js     The sticker book.
js/grownups-ui.js The grown-ups' corner (hold "?" for two seconds).
js/app.js         Screen flow: who, home, book, meet, lesson, mission, round, won; side panel; language, theme and sound; loads and saves the current child's progress.
audio/voice/en/   English voice clips (MP3).
audio/voice/te/   Telugu voice clips (MP3).
js/check.js       Device check page logic, including the speech voice list.
sw.js             Service worker for offline play: keeps every file of the app in a versioned cache.
tools/make-voice.js  Dev tool: generates voice clips with Azure text-to-speech. Not loaded by the site.
tools/make-offline.js  Dev tool: writes the offline file list and version into sw.js.
tests/            Node test files.
docs/             Design notes, setup instructions, the voice script and how to add a language.
```

## Browser support and coding rules

The target engine is Chromium 108 (Silk 108 on Fire OS 5). Silk builds as old as Chromium 65 have been seen on the same device, so:

- Use classic `<script>` files. No ES modules, no bundler, no build step.
- Use ES2017 syntax. Do not use optional chaining (`?.`), nullish coalescing (`??`), class fields or top-level `await`.
- Do not add runtime dependencies, CDN links or requests to other origins.
- Do not put inline scripts, inline event handlers or `style` attributes in HTML. The Content Security Policy blocks them. Setting `element.style` from JavaScript is allowed.
- Build DOM with `createElement` and `textContent`. Do not use `innerHTML` or similar APIs.
- Animate only `transform` and `opacity`.
- Chromium before 84 ignores `gap` on flex containers, so items would touch. `js/app.js` checks once at startup and, if `gap` is not supported, adds the class `no-flexgap` to `<html>`. `css/app.css` then gives every flex container that uses `gap` the equivalent margins. When you add `gap` to a flex container, add its fallback rule at the end of `css/app.css` (grid `gap` needs none), or space the items with margins instead, as the stage 5 screens do.
- Use `FC.board.later(fn, ms)` only to wait for an animation or visual effect to end (it is shortened under reduced motion). Use `FC.board.wait(fn, ms)`, a plain timer, for anything that sets the pace of a lesson, a turn or a card.

## Security and privacy

See [SECURITY.md](SECURITY.md) and [PRIVACY.md](PRIVACY.md).

## License

MIT. See [LICENSE](LICENSE).
