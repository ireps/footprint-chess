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

## Lines

| id | English | Telugu | delivery note |
|----|---------|--------|----------------|
| hello-1 | Meet your robot. | ఇదిగో, నీ రోబో! | Warm, a little playful. This is the first thing the child ever hears from the app. |
| hello-2 | Tap your robot to see its footprints. | నీ రోబోని నొక్కు, దాని అడుగుల గుర్తులు కనిపిస్తాయి. | Plain and clear; this is the core mechanic of the whole app. |
| hello-3 | Tap a footprint, and off it goes! | ఒక అడుగు గుర్తుని నొక్కు, అది అక్కడికి వెళ్తుంది! | Bright, a small "ta-da". |
| rook-1 | Rail bot only moves in straight lines. | రైల్ బాట్ ఎప్పుడూ తిన్నగానే వెళ్తుంది. | Matter-of-fact, introducing the character. |
| rook-2 | It can glide all the way toward the junkyard. | అది జంక్ యార్డ్ వైపు సాఫీగా చాలా దూరం వెళ్లగలదు. | Smooth delivery to match the glide. |
| rook-3 | Or it can glide straight across, just as far. | లేదా అడ్డంగా కూడా అంతే దూరం వెళ్లగలదు. | Same energy as rook-2; a second example, not a new idea. |
| bishop-1 | Slide bot only moves on slanty lines. | స్లైడ్ బాట్ ఎప్పుడూ వాలుగానే వెళ్తుంది. | Matter-of-fact. |
| bishop-2 | It always stays on its own colour. | అది ఎప్పుడూ తన రంగు గడుల మీదే ఉంటుంది. | Gentle emphasis on "always". |
| bishop-3 | Watch it swoosh the other way. | చూడు, ఇప్పుడు ఇంకో వైపు జారుతుంది! | Playful, a little swoop in the voice on "swoosh". |
| queen-1 | Star bot moves like Rail bot and Slide bot together. | స్టార్ బాట్ రైల్ బాట్ లాగా, స్లైడ్ బాట్ లాగా కూడా వెళ్తుంది. | Warm, a little impressed. |
| queen-2 | Straight lines, just like Rail bot. | రైల్ బాట్ లాగా తిన్నగా. | Quick, a reminder rather than new information. |
| queen-3 | And slanty lines too, with sparkles! | వాలుగా కూడా, మెరుపులతో! | Bright on "sparkles". |
| king-1 | Sleepy bot only takes one little step. | స్లీపీ బాట్ ఒక్క చిన్న అడుగు మాత్రమే వేస్తుంది. | Slow, sleepy, a small yawn in the delivery. |
| king-2 | But it can step any way it likes. | కానీ ఏ వైపుకైనా వేయగలదు. | Still sleepy, a touch of surprise on "any way". |
| king-3 | Then it needs a little rest. | తర్వాత దానికి కొంచెం విశ్రాంతి కావాలి. | Trails off, matching the sleepy character. |
| knight-1 | Spring bot hops in a special shape. | స్ప్రింగ్ బాట్ ప్రత్యేకంగా గెంతుతుంది. | Bouncy, energetic. |
| knight-2 | It hops two, then one to the side. | రెండు గడులు గెంతి, తర్వాత పక్కకి ఒకటి. | Springy rhythm: "two", then a light landing on "side". |
| knight-3 | It can even jump over junk bots! | అది జంక్ బాట్ల మీదుగా కూడా దూకగలదు! | Excited; this is the surprising part of the rule. |
| bump-1 | Uh oh, a junk bot is in the way! | అయ్యో, దారిలో ఒక జంక్ బాట్ ఉంది! | Mock-worried, not actually alarming; no fail state in this game. |
| bump-2 | Land on it, and bump! It is gone. | దాని మీదకి వెళ్ళు, ఢాం! అది మాయం. | Playful "bump" with a little emphasis, like a sound effect. |
| bump-3 | See? The way is clear now. | చూశావా? ఇప్పుడు దారి ఖాళీ. | Calm and pleased. |
| pawn-1 | Mini bot marches straight toward the junkyard. | మినీ బాట్ జంక్ యార్డ్ వైపు తిన్నగా నడుస్తుంది. | Steady, marching rhythm. |
| pawn-2 | Its very first step can be two squares. | మొదటి అడుగులో రెండు గడులు వెళ్లగలదు. | Slight emphasis on "first" and "two". |
| pawn-3 | After that, just one small step at a time. | ఆ తర్వాత, ఒక్కోసారి ఒక్క చిన్న అడుగే. | Calmer, settling into the regular pace. |
| your-turn | Now you try! | ఇప్పుడు నువ్వు చెయ్యి! | Encouraging, inviting, said at the start of every practice. |
| tap-robot | Tap your robot. | నీ రోబోని నొక్కు. | Plain hint, used if the child is idle before the first tap. |
| tap-footprint | Tap a footprint. | ఒక అడుగు గుర్తుని నొక్కు. | Plain hint, used if the child is idle after selecting. |
| great | Great job! | భలే! చాలా బాగుంది! | Warm praise, said when a practice task is completed. |

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
