# Voice script

The lesson player speaks the lines below, in English (the default) or
Telugu (`?lang=te`). Ids and text must match `js/lessons.js`
(`FC.lessons.LINES`) exactly; `tests/lessons.test.js` checks this file
against that source in both languages.

## How clips are used

A recorded clip lives at `audio/voice/<lang>/<id>.mp3`, one folder per
language (`audio/voice/en/` and `audio/voice/te/`). `js/voice-clips.js`
lists, per language, which ids actually have a file, so `js/voice.js` never
fetches a file that does not exist.

For the language currently selected, `js/voice.js` tries, in order:

1. a recorded clip in that language;
2. the device's speech synthesis, speaking that language's text;
3. when the language is Telugu only, a recorded clip in **English**;
4. when the language is Telugu only, device speech in **English**;
5. otherwise, silence, timed by the line's `ms` estimate, so the lesson
   keeps its pacing.

English never falls back to Telugu. This means English clips are worth
recording first: they are also what a Telugu-speaking child hears if a
Telugu clip and Telugu device speech are both unavailable.

## Wording rules

Every line uses real chess terminology: rook, bishop, queen, king, knight,
pawn, capture. No robot names, no "bot" or "robot", no junk or junkyard, no
"bump". No "left", "right" or a square name (e.g. e4), in either language.
The two edges are "the other side" (row 0, the opponent's home) and "your
side" (row 7, the child's home); lines refer to them this way rather than
naming a direction.

## Lines

| id | English | Telugu | delivery note |
|----|---------|--------|----------------|
| pick | Pick a chess piece to play with! | ఆడుకోవడానికి ఒక పావుని ఎంచుకో! | Warm and inviting; said once, the first time the child taps anything on the home screen. |
| meet-r | This is the rook. | ఇది ఏనుగు. | Plain introduction, said when the rook's meet card first appears. |
| meet-b | This is the bishop. | ఇది ఒంటె. | Plain introduction, said when the bishop's meet card first appears. |
| meet-q | This is the queen. | ఇది మంత్రి. | Plain introduction, said when the queen's meet card first appears. |
| meet-k | This is the king. | ఇది రాజు. | Plain introduction, said when the king's meet card first appears. |
| meet-n | This is the knight. | ఇది గుర్రం. | Plain introduction, said when the knight's meet card first appears. |
| meet-p | This is the pawn. | ఇది భటుడు. | Plain introduction, said when the pawn's meet card first appears. |
| hello-1 | Hello! Let's learn chess. | హలో! చదరంగం నేర్చుకుందాం. | Warm, a little playful. This is the first thing the child ever hears from the app. |
| hello-2 | Tap your piece to see its footprints. | నీ పావుని నొక్కు, దాని అడుగుల గుర్తులు కనిపిస్తాయి. | Plain and clear; this is the core mechanic of the whole app. |
| hello-3 | Tap a footprint, and off it goes! | ఒక అడుగు గుర్తుని నొక్కు, అది అక్కడికి వెళ్తుంది! | Bright, a small "ta-da". |
| rook-1 | The rook moves in straight lines. | ఏనుగు తిన్నగా మాత్రమే వెళ్తుంది. | Matter-of-fact, introducing the rule. |
| rook-2 | It can go all the way toward the other side. | అది అవతలి వైపు దాకా వెళ్లగలదు. | Smooth delivery to match the glide across the board. |
| rook-3 | Or straight across, just as far. | లేదా అడ్డంగా కూడా అంతే దూరం వెళ్లగలదు. | Same energy as rook-2; a second example, not a new idea. |
| bishop-1 | The bishop moves on slanty lines. | ఒంటె వాలుగా మాత్రమే వెళ్తుంది. | Matter-of-fact. |
| bishop-2 | It always stays on its own colour. | అది ఎప్పుడూ తన రంగు గడుల మీదే ఉంటుంది. | Gentle emphasis on "always". |
| bishop-3 | Watch it slide the other way. | చూడు, ఇప్పుడు ఇంకో వైపు జారుతుంది! | Playful, a little swoop in the voice on "slide". |
| queen-1 | The queen moves like the rook and the bishop together. | మంత్రి ఏనుగు లాగా, ఒంటె లాగా కూడా వెళ్తుంది. | Warm, a little impressed. |
| queen-2 | Straight lines, like the rook. | ఏనుగు లాగా తిన్నగా. | Quick, a reminder rather than new information. |
| queen-3 | And slanty lines, like the bishop. | ఒంటె లాగా వాలుగా కూడా. | Bright, matching queen-2's energy. |
| king-1 | The king takes just one step. | రాజు ఒక్క అడుగు మాత్రమే వేస్తాడు. | Slow and steady. |
| king-2 | But it can step any way it likes. | కానీ ఏ వైపుకైనా వేయగలడు. | Still slow, a touch of surprise on "any way". |
| king-3 | Slow and careful, like a real king. | నెమ్మదిగా, జాగ్రత్తగా, నిజమైన రాజు లాగా. | Calm and settled, closing the idea. |
| knight-1 | The knight moves in a special way. | గుర్రం ప్రత్యేకంగా కదులుతుంది. | Bouncy, energetic. |
| knight-2 | Two squares, then one to the side. | రెండు గడులు, తర్వాత పక్కకి ఒకటి. | Springy rhythm: "two", then a light landing on "side". |
| knight-3 | It can even jump over other pieces! | అది వేరే పావుల మీదుగా కూడా దూకగలదు! | Excited; this is the surprising part of the rule. |
| pawn-1 | The pawn marches toward the other side. | భటుడు అవతలి వైపుకి ముందుకు నడుస్తాడు. | Steady, marching rhythm. |
| pawn-2 | Its very first step can be two squares. | మొదటి అడుగులో రెండు గడులు వెళ్లగలడు. | Slight emphasis on "first" and "two". |
| pawn-3 | After that, one small step at a time. | ఆ తర్వాత, ఒక్కోసారి ఒక్క అడుగే. | Calmer, settling into the regular pace. |
| capture-1 | Look, a pawn from the other side! | చూడు, అవతలి వైపు భటుడు! | A little surprised, pointing the child's attention at the new piece. |
| capture-2 | Move onto its square to capture it. | దాని గడిలోకి వెళ్ళి, దాన్ని పట్టుకో. | Plain instruction, the core of the lesson. |
| capture-3 | Captured! Now it is off the board. | పట్టేసింది! ఇప్పుడు అది బోర్డు మీద లేదు. | Bright, a small celebration; no fail state, so this is purely a "well done". |
| pawncap-1 | A pawn captures on the slant, one step ahead. | భటుడు ముందు వాలుగా ఉన్న గడిలో పట్టుకుంటాడు. | Plain, this is the special rule the lesson exists to teach. |
| pawncap-2 | It cannot capture straight ahead. | తిన్నగా ఎదురుగా ఉన్నదాన్ని పట్టుకోలేడు. | Gentle emphasis on "cannot"; not a scolding, just a fact. |
| your-turn | Now you try! | ఇప్పుడు నువ్వు చెయ్యి! | Encouraging, inviting, said at the start of every practice. |
| tap-piece | Tap your piece. | నీ పావుని నొక్కు. | Plain hint, used if the child is idle before the first tap. |
| tap-footprint | Tap a footprint. | ఒక అడుగు గుర్తుని నొక్కు. | Plain hint, used if the child is idle after selecting. |
| great | Great job! | భలే! చాలా బాగుంది! | Warm praise, said when a practice task is completed. |
| mission | Capture all three pawns! | మూడు భటులనీ పట్టుకో! | Clear and a little excited; states the round's goal before it starts. |
| hint-pawn | Follow the footprints to a pawn. | అడుగుల గుర్తుల దారిలో భటుడి దగ్గరికి వెళ్ళు. | Plain hint, used if the child is idle mid-round with a piece selected. |
| won | You captured them all! | అందరినీ పట్టేశావు! | Big and celebratory; the round's win line. |
| next | Play again, or pick the next piece. | మళ్ళీ ఆడు, లేదా తర్వాతి పావుని ఎంచుకో. | Warm, inviting the child to choose what happens next. |

## Generating clips with tools/make-voice.js

Clips are generated with Azure's neural text-to-speech, using
`te-IN-ShrutiNeural` for Telugu and `en-IN-NeerjaNeural` for English, both
slowed slightly and pitched slightly up to sound calmer for a young child.

1. Create an Azure account and a Speech resource (the free tier, F0, is
   enough for this project's line count). In the Azure Portal, open the
   Speech resource's "Keys and Endpoint" page and note a key and the
   region (for example `centralindia`).
2. Set the two environment variables the script reads. Never commit them
   or paste the key anywhere public.

   PowerShell:

   ```
   $env:AZURE_SPEECH_KEY = "<your key>"
   $env:AZURE_SPEECH_REGION = "centralindia"
   ```

   bash:

   ```
   export AZURE_SPEECH_KEY="<your key>"
   export AZURE_SPEECH_REGION="centralindia"
   ```

3. Run the script from the repo root:

   ```
   node tools/make-voice.js
   ```

   By default this generates every line in both languages, English first,
   skipping any id/language file that already exists (so a hand recording
   already in place is never overwritten). Useful options:

   - `--lang en` or `--lang te` — only that language (default: `all`).
   - `--only hello-1,hello-2` — only these line ids.
   - `--force` — regenerate files that already exist.
   - `--index-only` — rebuild `js/voice-clips.js` from whatever files are
     already in `audio/voice/`, without contacting Azure at all.

   Run `node tools/make-voice.js --help` for the full list.

## Replacing a clip with your own recording

Any clip, in either language, can be replaced by a recording made by the
parent:

1. Record the line, following the recording spec below.
2. Save it as `audio/voice/<lang>/<id>.mp3`, using the same language folder
   and id as the file it replaces (for example
   `audio/voice/en/hello-1.mp3`).
3. Run `node tools/make-voice.js --index-only` to rebuild
   `js/voice-clips.js` from the files now on disk. This makes no network
   request. Because file names are id-based, a later regeneration run
   leaves a hand recording alone unless `--force` is used.

## Recording spec

- Format: mono MP3, 22.05 kHz or 24 kHz sample rate, 48 to 64 kbps.
- Trim leading and trailing silence.
- Peak-normalise to about -1 dBFS.
- File name: `audio/voice/<lang>/<id>.mp3`, using the language (`en` or
  `te`) and id from the table above exactly (for example
  `audio/voice/en/hello-1.mp3` or `audio/voice/te/hello-1.mp3`).
- After adding a file by hand, run `node tools/make-voice.js --index-only`
  so `js/voice-clips.js` picks it up. An id left out of that file's list is
  treated as not yet recorded, even if the audio file exists.
