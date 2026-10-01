# Adding a language

Every part of the app that depends on the set of languages reads one
registry, `js/langs.js`. Adding a language is mostly a data change. This is
the checklist; run `node --test` at the end, and the tests will point at
anything that was missed.

The owner's rule for Telugu applies to every language: write the text
natively for children in that language. Do not translate the English word for
word, and do not transliterate it. Use the real chess terms for the pieces
and for capture, as the children will hear them at a real board (see
"Design decisions" in [CLAUDE.md](../CLAUDE.md)). Never use a robot name,
never say left or right, never use a square name such as e4.

## 1. Registry entry

Add an entry to `LANGUAGES` in `js/langs.js`, after the existing ones (the
list order is the order of the language row and of `--lang all`). Fields:

- `id`: a short lowercase code. It is also the `?lang=` value and the clip
  folder name.
- `name`: the English name of the language. It becomes the language
  button's `aria-label` ("Language: <name>") and the column header in
  `docs/VOICE-SCRIPT.md`.
- `nativeName`: the language's own name for itself.
- `glyph`: one character shown on the language button and in the language
  row. It must differ from the other languages' glyphs.
- `speech`: the BCP-47 prefix used to pick a device speech voice (for example
  `hi` for `hi-IN`).
- `fallback`: the id of the language to try next for a line with no clip and
  no device speech in this language, or `null`. Chains end at the default
  language (English), which has no fallback. Use `'en'` unless another
  language is a better second choice for the same children.
- `script`: a regular expression for the language's writing system (for
  example `/[\u0900-\u097F]/` for Devanagari), or `null`. The tests require
  every text in the language to contain it.
- `msPerChar`: milliseconds of speech per character, used only to pace
  lessons before and around recorded clips. Start with 75 and adjust from the
  clip lengths.
- `voiceRate`, `voicePitch`: the speed and pitch `tools/make-voice-edge.py` gives that voice (for example `-10%` and `+15Hz`); try a few by ear with `--rate` and `--pitch` first.
- `azureVoice`: the Microsoft neural voice name used by `tools/make-voice-edge.py` and `tools/make-voice.js`,
  for example `hi-IN-SwaraNeural`. The SSML language is its first two
  parts.
- `voicePrefs`: `null`, or preferred device voices (`preferNames`,
  `avoidNames`, `preferRegions`) as `js/langs.js` does for English.
- `turnOf(name, ofForm)`: returns the mode badge text for "<team>'s turn" in
  this language. `ofForm` is the team's optional possessive form from
  `js/themes.js` (step 2); ignore it if the language does not need one.

## 2. Text

Add the language's text, under its id, to:

- every line in `RAW_LINES` in `js/lessons.js`;
- `PIECE_NAMES` (all six pieces; confirm the names with the owner, because
  regional usage varies);
- `UI_TEXT` (the "Watch" and "Your turn!" badges);
- `TEAMS` in `js/themes.js` (both teams of every theme), plus an `of` entry
  for the language (`of: { <id>: '<possessive form>' }`) if the language
  needs a special form of the team name before "turn".

The spoken team-pick lines (`team-<theme>-a` and `-b` in `RAW_LINES`) are the
team names followed by "!", and a test checks that they match `TEAMS`.

## 3. Voice script

Add a column to the Lines table in `docs/VOICE-SCRIPT.md`, headed with the
registry `name` of the language, between the existing language columns and
"delivery note". Fill it with exactly the text from `js/lessons.js`. The test
matches columns to languages by that header, and fails if any registry
language has no column.

## 4. Clips

Put the clips in `audio/voice/<id>/<line id>.mp3`. Generate them with
`tools/make-voice-edge.py --lang <id>` (Microsoft neural voices through
edge-tts, using the registry entry's `azureVoice`, `voiceRate` and
`voicePitch`; no key needed, see [VOICE-SCRIPT.md](VOICE-SCRIPT.md)), or with
`node tools/make-voice.js --lang <id>` (Azure, needs `AZURE_SPEECH_KEY` and
`AZURE_SPEECH_REGION`), or have the parent record them under the same file
names. Then rebuild the clip index, which lists the ids
that have a file:

    node tools/make-voice.js --index-only

Until a clip exists, the app falls back to device speech in the language, then
through the language's fallback chain, then to silence with the estimated
timing.

## 5. Content rules (optional)

`tests/lessons.test.js` has a `CONTENT_RULES` table keyed by language id:
patterns the language's lines must not contain (left and right, square names,
robot-theme words) and an optional word limit. A language with no entry only
gets the generic checks (text present, and its script if the registry lists
one). Add an entry with the language's own banned words, especially the words
for "left", "right" and "robot".

## 6. The grown-ups' corner (optional)

The grown-ups' corner (`js/grownups-ui.js`) is in English only. All its text is in the `GROWNUP_TEXT` table there, keyed by language id; a language with no entry uses the next language of its fallback chain, so nothing is needed for a new language. To translate the corner, add an entry with the same keys as `en`. The children's Who's playing screen needs nothing beyond the `who` line (step 2).

## 7. Test

Run `node --test`. Then open `?lang=<id>` and play a lesson. With three or
more languages the language button opens a row of buttons, one per language.
