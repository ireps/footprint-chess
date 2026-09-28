# Footprint Chess

A chess-learning web app for young children. It is a static site served by GitHub Pages and is built to run on older tablets. The target device is an Amazon Fire HD 10 (7th generation, Fire OS 5, Silk browser).

Live site: https://ireps.github.io/footprint-chess/

## How it teaches

- No left, right or square names. Tapping a piece shows footprints on every square it can reach.
- The board never rotates. The child's side is always at the bottom, next to a home landmark.
- Each piece is a character whose movement animation matches its rule.
- Short rounds, instant feedback, no fail states, no locked levels.
- No login, no tracking, no data collection.

Details are in [docs/DESIGN.md](docs/DESIGN.md).

## Status

Stages 1 and 2 of 6 are complete: board, tap-to-move, footprints for all six pieces, the Robots theme, star-collecting rounds, sound effects, a device check page (`check.html`), and a lesson player with eight "watch, then do" lessons. Voice clips for the lessons have not been recorded yet (see [docs/VOICE-SCRIPT.md](docs/VOICE-SCRIPT.md)). The roadmap is in [docs/DESIGN.md](docs/DESIGN.md#roadmap).

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

The tests cover the movement rules (`js/rules.js`), round generation (`js/levels.js`) and the lesson scripts (`js/lessons.js`): every move is legal, timings fit, and no line says left, right or a square name.

## Deploy

See [docs/SETUP.md](docs/SETUP.md).

## Project layout

```
index.html        The app. Piece artwork is an inline SVG sprite.
check.html        Device check page for the tablet.
css/app.css       App styles and animations.
css/check.css     Device check page styles.
js/rules.js       Movement rules. No DOM access. Tested.
js/levels.js      Round generation. No DOM access. Tested.
js/lessons.js     Lesson scripts and voice line text. No DOM access. Tested.
js/sound.js       Sound effects generated with the Web Audio API.
js/voice-clips.js Ids of the voice lines that have a recorded clip.
js/voice.js       Plays voice clips, with speech and silent fallbacks.
js/board.js       Board view: pieces, footprints, animations, ghost hand.
js/player.js      Lesson player: runs a lesson's watch and practice parts.
js/app.js         App flow: lessons, star rounds, side bar.
audio/voice/      Lesson voice clips (MP3), once recorded.
js/check.js       Device check page logic.
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
