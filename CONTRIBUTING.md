# Contributing

Thank you for helping. Footprint Chess is a chess-learning app for young children, including children who find left and right, reading, changes of viewpoint or long tasks hard. Every change is judged by one question: does it help a young child learn chess, calmly and safely?

## License and your contribution

Footprint Chess is source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE), not an open source license. See [NOTICE](NOTICE). By opening a pull request you agree that your contribution may be distributed under this license and under any other license the copyright holder chooses for the project in future, including a commercial one. Only contribute work you wrote yourself, or work whose license allows this.

## Before you start

- For anything larger than a small fix, open an issue first and describe the idea. The project is built in planned stages that the maintainer tests on a real tablet with a child, so a large unplanned change may not fit even if it is good.
- Read [docs/DESIGN.md](docs/DESIGN.md) for how the app teaches, and the rules below.
- Be kind. The [Code of Conduct](CODE_OF_CONDUCT.md) applies everywhere in this project.

## Run it

The app is a static site with no build step and no dependencies.

```
python3 -m http.server 8000
```

Then open http://localhost:8000. Any static file server works.

## Test and check

```
npm test
```

This runs the tests (`node --test`, Node.js 20 or newer) and the rule checks (`node tools/check.js`). The ES2017 parse check needs the acorn parser; install it once with `npm install --no-save acorn` (it is not a dependency of the app). Every pull request runs the same commands on GitHub (`.github/workflows/test.yml`), and a pull request can only be merged when they pass.

After changing any page, style, script or voice clip, run `node tools/make-offline.js`: it rewrites the offline file list and version in `sw.js`, and the checks fail until it has been run.

The browser tests (`node e2e/run.js`, or `npm run e2e`) play the app in headless Chromium: Home and the Games screen at both tablet sizes, every game up to the child's first turn, and the pawn battle to its Won card, failing on any page error, console error or Content Security Policy report. They need Playwright, which is not a dependency of the app: `npm install --no-save playwright@1.56.1 && npx playwright install chromium`. They also run on every pull request (the **browser** check); screenshots of a failure are kept with the workflow run.

For a change to anything on screen, look at it in a browser at 1280x800 (landscape) and 800x1280 (portrait), with touch if you can, play it through to the end, and check the browser console for errors and Content Security Policy messages. Screenshots in the pull request help.

## Rules for code

The app runs on an old tablet (Amazon Fire HD 10, 7th generation, Silk browser, Chromium 65 to 108) and is shown to children, so:

- Classic `<script>` files only: no modules, bundler or build step.
- ES2017 syntax only: no `?.`, `??`, class fields or top-level await.
- No runtime dependencies, CDNs, third-party requests, analytics, advertising, embeds or web fonts. Tests use only Node.js built-in modules.
- The Content Security Policy `<meta>` stays first in `<head>` on every page. Never add `'unsafe-inline'`, `'unsafe-eval'` or another origin.
- No inline scripts, inline event handlers or `style` attributes in HTML. Setting `element.style` from JavaScript is fine.
- Build the page with `createElement` and `textContent`. Never use `innerHTML`, `outerHTML`, `insertAdjacentHTML` or `document.write`.
- Modules that touch no page elements (for example `js/rules.js`, `js/games.js`, `js/army.js`) work both in the browser (`window.FC.*`) and in Node.js (`module.exports`), and have tests.
- Animate only `transform` and `opacity`, and respect `prefers-reduced-motion`.
- Nothing stored on the device or pasted by a person (a backup code) is trusted: it goes through `js/store.js` only. Never collect or store anything about a child beyond what [PRIVACY.md](PRIVACY.md) describes.
- Documentation is plain and factual, with no marketing tone and no emojis.

## Rules for what children see and hear

These are tested where possible (`tests/lessons.test.js`), and reviewed by hand everywhere else.

- **Real chess words, always:** rook, bishop, queen, king, knight, pawn, capture, check, checkmate. The robot pictures are decoration: never a robot name, and never "bot" or "robot" in anything a child hears or reads.
- **Never left or right, and never square names like e4.** The one exception is the hand-print levels, whose lines are listed in `HAND_LINES` in `js/lessons.js`. Moves are shown with footprints. The only edges ever named are "your side" (the child's home row, at the bottom) and "the other side".
- **The board never turns round.** The child is always at the bottom.
- **No fail states:** no scores, lives, timers or "wrong". A wrong tap makes the piece wiggle and its footprints pulse. After five seconds of waiting, a hint plays.
- **Every activity states its goal** before it starts, in voice and in a picture, and has a clear ending. Keep rounds short.
- **Always show who is in control:** the purple "Watch" state while the app shows something, the green "Your turn!" state when the child acts (`FC.board.setMode`).
- **No locked levels.** A suggested next step may glow, but everything can be tapped.
- **Nothing moves while the child is thinking,** except in answer to what they do.
- **Original artwork only.** No copyrighted characters, and nothing that looks like an existing character.

## Voice lines and languages

- A new or changed line goes in `LINES` in `js/lessons.js` and in the table in [docs/VOICE-SCRIPT.md](docs/VOICE-SCRIPT.md), in every language, with a delivery note. English lines are at most 14 words. New text is written for children in each language, not translated word for word. Some Telugu words are fixed: king రాజు, queen మంత్రి, rook ఏనుగు, bishop ఒంటె, knight గుర్రం, pawn భటుడు, chess piece పావు, chess చదరంగం, check చెక్, checkmate చెక్‌మేట్; the opponent is always శత్రువు, and అవతలి వైపు is used only for the far edge of the board.
- Do not add voice clips unless you have the right to share them under this project's license (for example, your own recording). Text-to-speech output often has terms that do not allow this.
- To add a language, follow [docs/LANGUAGES.md](docs/LANGUAGES.md).

## Pull requests

- One idea per pull request, as small as it can be.
- Fill in the checklist in the pull request template.
- Update the documentation in the same pull request when behaviour changes: [README.md](README.md), [docs/DESIGN.md](docs/DESIGN.md), [help.html](help.html) (the grown-ups' guide), and [PRIVACY.md](PRIVACY.md) or [SECURITY.md](SECURITY.md) if they are affected.
- The maintainer reviews every pull request and may test it on the tablet before merging.

## Security

Do not report security problems in public issues. See [SECURITY.md](SECURITY.md).
