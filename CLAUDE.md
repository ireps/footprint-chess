# CLAUDE.md

Context for Claude Code. Read this before making changes.

## Project

Footprint Chess: a chess-learning web app for a 6-year-old, and for young children generally, including those who struggle with left/right, reading or changes of viewpoint, and those with short attention spans. It is a static site on GitHub Pages (https://ireps.github.io/footprint-chess/) and runs in Silk on an Amazon Fire HD 10 (7th gen, Fire OS 5.x, Android 5.1).

The public docs are README.md, SECURITY.md, PRIVACY.md, docs/DESIGN.md and docs/SETUP.md. Keep them accurate when behaviour changes.

## Target platform facts (researched)

- Silk on Fire OS 5 appears to top out at Silk 108 / Chromium 108. Older builds (Chromium 65 to 94) have been seen on the same model, so write code that degrades gracefully.
- speechSynthesis on Silk / Fire OS 5 is unverified. Plan on recorded audio clips, one set per language (`audio/voice/en/`, `audio/voice/te/`), generated with `tools/make-voice.js` and optionally replaced by the parent's own recording; treat text-to-speech as an optional fallback, not the primary path.
- Android 5.1 does not trust Let's Encrypt's ISRG Root X1. Keep using the github.io address and avoid custom domains.
- If full chess rules are ever needed, chess.js 0.10.3 (classic UMD `chess.min.js`, global `Chess`) is the version that runs on old browsers. Vendor it into the repo; never load it from a CDN. Extending `js/rules.js` is preferred over adding a dependency.
- Hardware: 2 GB RAM, 1280x800 CSS pixels in landscape. Animate only transform and opacity. Do not use Stockfish or WASM engines.

## Coding rules (enforced by design)

- Classic `<script>` files. No ES modules, bundler or build step.
- ES2017 syntax. No `?.`, `??`, class fields or top-level await.
- No runtime dependencies, CDNs, third-party requests, analytics or web fonts.
- The Content Security Policy `<meta>` stays first in `<head>` on every page. Never add `'unsafe-inline'`, `'unsafe-eval'` or other origins.
- No inline scripts, inline event handlers or `style` attributes in HTML. Setting `element.style` from JavaScript is fine.
- Build DOM with `createElement` and `textContent`. Never use `innerHTML`, `outerHTML`, `insertAdjacentHTML` or `document.write`.
- Modules that touch no DOM (`js/rules.js`, `js/levels.js`) work in both the browser (`window.FC.*`) and Node (`module.exports`), and have tests.
- Documentation is plain and factual, with no marketing tone and no emojis.

## Design decisions (agreed with the owner)

- Never say left, right or square names like e4. Show moves with footprints. The board never rotates, and the child is always at the bottom.
- Landmarks replace directions: each theme has a home edge and a far edge (Robots: charging station at home, junkyard across). "Forward" means toward the far landmark.
- Each piece is a character whose animation matches its rule (Robots theme): rook = Rail bot glides; bishop = Slide bot swooshes; queen = Star bot glides and leaves sparkles; king = Sleepy bot shuffles; knight = Spring bot hops twice (two squares, then one); pawn = Mini bot marches. Silhouettes keep the real chess shapes.
- Short rounds (60 to 90 seconds), one goal each, no fail states. A wrong tap makes the piece wiggle and the footprints pulse. After 5 seconds idle, a hint plays.
- No locked levels, ever. The suggested next level can glow, but everything can be tapped.
- Motion answers the child's actions. Nothing loops while the child is thinking. Respect prefers-reduced-motion. A calm mode is planned for the parent corner.
- Lessons are animated "watch, then do": a 10 to 15 second scripted animation on the real board (a small script of moves, highlights and voice cues, not video), a ghost hand showing where to tap, and replay and skip buttons. One idea per lesson.
- Themes switchable at any time: Robots (done), Space, Dinosaurs, and Adventure (an original comic-adventure explorer). No copyrighted characters; Tintin was requested and declined. Artwork must be original and not resemble existing characters.
- Progress: no login and no cookies. Picture-based profiles (tap your avatar) stored in localStorage on the device. Show progress as a collection (characters met, sticker book), not scores. Include an optional backup code for moving progress between devices. No backend.
- Sound effects are synthesized with Web Audio (`js/sound.js`), so there are no sound-effect files. Lesson voice lines are the only audio files: `audio/voice/<lang>/<id>.mp3` (one folder per language), listed per language in `js/voice-clips.js`, with the text in `docs/VOICE-SCRIPT.md` and `js/lessons.js`.
- English is the default language; Telugu is the alternative, chosen with `?lang=te` (nothing is stored on the device). A side-bar button switches language at any time. `js/lessons.js` exports `LANGS` and `DEFAULT_LANG`; `js/voice.js` falls back from a clip in the current language to device speech in the current language to, for Telugu only, the same two steps in English, to silence. English never falls back to Telugu.

## Status and roadmap

1. Foundation: done (stage 1).
2. Lesson player: done (stage 2), awaiting tablet testing. Eight lessons (hello, the six pieces, bump) in `js/lessons.js`, run by `js/player.js` on `js/board.js`, each with English (default) and Telugu (`?lang=te`) text and a language switch button. Voice: the owner chose clips generated with `tools/make-voice.js` (Azure neural TTS) from `docs/VOICE-SCRIPT.md`, possibly re-recorded by the parent later under the same file names. No clips exist yet in either language; until then the player falls back to speechSynthesis, then to silence with estimated timings. Claude cannot record audio or call Azure on the owner's behalf.
3. Games: catch the mouse, pawn race, mini-games against a simple bot (random legal moves with a preference for captures).
4. Themes: Space, Dinosaurs, Adventure, plus a theme switcher.
5. Profiles: picture profiles, sticker book, parent corner (long-press to open; calm mode; backup code). Update PRIVACY.md in the same change.
6. Advanced: check, checkmate, Mirror Pond (opponent's view), hand-print left/right levels, offline mode via service worker.

Not implemented in the rules yet: check, checkmate, castling, en passant, promotion.

## Workflow

- Plan each stage before coding and get the owner's approval. Build in stages; after each one, the owner tests on the tablet and with the child, and that feedback shapes the next stage.
- Before every commit, run `node --test`. All tests must pass.
- Before every commit, run these checks:
  - `grep -nE "innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function" js/*.js *.html` must find nothing.
  - `grep -nE "\?\.|\?\?" js/*.js` must find nothing.
  - Confirm the ES2017 parse still succeeds (acorn with `ecmaVersion: 2017`, if available).
- For UI changes, review screenshots in headless Chromium (Playwright) at 1280x800 and 800x1280 with touch enabled. Check for console errors and CSP violations, and play through a round.
- The owner prefers cost-effective model use: a stronger model for planning and review, a cheaper one for routine implementation.

## Pending owner actions

- Enable Pages, Enforce HTTPS, private vulnerability reporting, and secret scanning with push protection (docs/SETUP.md).
- Open check.html on the Fire HD and report the results, especially Chromium version, speech voices and sound.
- Generate the voice clips from docs/VOICE-SCRIPT.md and add them (recording spec in that file).
- Create an Azure Speech key. Do not generate clips until the voice lines are rewritten with real chess terminology (planned next); then run tools/make-voice.js.
- Test stage 2 on the tablet and with the child.
