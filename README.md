# Footprint Chess

A chess-learning web app for young children. It is a static site served by GitHub Pages and is built to run on older tablets. The target device is an Amazon Fire HD 10 (7th generation, Fire OS 5, Silk browser).

Live site: https://ireps.github.io/footprint-chess/

## How it teaches

- Real chess terms only: rook, bishop, queen, king, knight, pawn, capture. No left, right or square names. Tapping a piece shows footprints on every square it can reach.
- The board never rotates. The child's side is always at the bottom ("your side"); the opponent's side is always at the top ("the other side").
- Each piece is drawn as a robot character whose movement animation matches its rule, but every piece is always named and shown with its real chess shape; the robot theme is decoration, not vocabulary.
- Short rounds: capture three opponent pawns. Instant feedback, no fail states, no locked levels.
- No login, no tracking, no data collection.

Details are in [docs/DESIGN.md](docs/DESIGN.md).

## Language

English is the default. Telugu is available at `?lang=te` (for example
`https://ireps.github.io/footprint-chess/?lang=te`), so it can be
bookmarked; nothing is stored on the device. A language button in the side
bar switches at any time: it shows the *other* language's glyph ('అ' in
English, 'A' in Telugu) and updates the address bar to match. Lines already
playing when you switch are not interrupted.

## Status

Stages 1 and 2 of 6 are complete: a home screen, board, tap-to-move, footprints for all six pieces, the Robots theme (decoration only; every piece is always named and shown with its real chess shape), capture rounds (capture three opponent pawns), sound effects, a device check page (`check.html`), a lesson player with a "watch, then do" lesson and a capturing lesson for every piece, a grown-ups guide (`help.html`), and lesson text in English and Telugu with a language switch button. Every voice line has a clip in both languages (see [docs/VOICE-SCRIPT.md](docs/VOICE-SCRIPT.md)); if a clip is missing, the app falls back to the device's speech synthesis, or to silence. The roadmap is in [docs/DESIGN.md](docs/DESIGN.md#roadmap).

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

The tests cover the movement rules (`js/rules.js`), capture round generation (`js/levels.js`), the lesson scripts (`js/lessons.js`) and the voice clip generator (`tools/make-voice.js`): every move is legal, timings fit, every line uses real chess terms and never a robot name, left, right or a square name in either language, and the clip-generating tool's SSML, argument parsing and file indexing behave correctly (its Azure network call is never exercised by the tests).

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
js/lessons.js     Lesson scripts, piece names and voice line text (English and Telugu). No DOM access. Tested.
js/sound.js       Sound effects generated with the Web Audio API.
js/voice-clips.js Ids of the voice lines that have a recorded clip, per language.
js/voice.js       Plays voice clips, with per-language speech and silent fallbacks.
js/board.js       Board view: pieces, footprints, animations, ghost hand.
js/player.js      Lesson player: runs a lesson's watch and practice parts.
js/app.js         Screen flow: home, meet, lesson, mission, round, won; side panel; language and sound.
audio/voice/en/   English voice clips (MP3).
audio/voice/te/   Telugu voice clips (MP3).
js/check.js       Device check page logic, including the speech voice list.
tools/make-voice.js  Dev tool: generates voice clips with Azure text-to-speech. Not loaded by the site.
tests/            Node test files.
docs/             Design notes, setup instructions and the voice script.
```

## Browser support and coding rules

The target engine is Chromium 108 (Silk 108 on Fire OS 5). Silk builds as old as Chromium 65 have been seen on the same device, so:

- Use classic `<script>` files. No ES modules, no bundler, no build step.
- Use ES2017 syntax. Do not use optional chaining (`?.`), nullish coalescing (`??`), class fields or top-level `await`.
- Do not add runtime dependencies, CDN links or requests to other origins.
- Do not put inline scripts, inline event handlers or `style` attributes in HTML. The Content Security Policy blocks them. Setting `element.style` from JavaScript is allowed.
- Build DOM with `createElement` and `textContent`. Do not use `innerHTML` or similar APIs.
- Animate only `transform` and `opacity`.

## Security and privacy

See [SECURITY.md](SECURITY.md) and [PRIVACY.md](PRIVACY.md).

## License

MIT. See [LICENSE](LICENSE).
