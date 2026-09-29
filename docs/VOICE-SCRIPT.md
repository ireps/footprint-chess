# Voice script

The lesson player speaks the lines below, in English (the default) or
Telugu (`?lang=te`). Ids and text must match `js/lessons.js`
(`FC.lessons.LINES`) exactly; `tests/lessons.test.js` checks this file
against that source in every language of the registry (`js/langs.js`). The
Lines table has one column per language, headed with the registry's English
name for it; adding a language adds a column (see [LANGUAGES.md](LANGUAGES.md)).

## How clips are used

A recorded clip lives at `audio/voice/<lang>/<id>.mp3`, one folder per
language (`audio/voice/en/` and `audio/voice/te/`, and one more folder for each further language in the registry). `js/voice-clips.js`
lists, per language, which ids actually have a file, so `js/voice.js` never
fetches a file that does not exist.

For the language currently selected, `js/voice.js` walks that language's
fallback chain (the registry's `fallback` links, ending at the default
language) and, for each language in it, tries a recorded clip and then the
device's speech synthesis speaking that language's text; after the whole
chain, silence, timed by the line's `ms` estimate, so the lesson keeps its
pacing. For Telugu (whose fallback is English) that is:

1. a recorded clip in Telugu;
2. the device's speech synthesis, speaking the Telugu text;
3. a recorded clip in **English**;
4. device speech in **English**;
5. silence.

English (the default) has no fallback, so it never falls back to Telugu. This means English clips are worth
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
| pick | Pick a fun chess piece to play with! | ఆడుకోవడానికి నీకు నచ్చిన పావుని ఎంచుకో! | Warm and inviting; said once, the first time the child taps anything on the home screen. |
| meet-r | Here is our rook! | ఇదిగో, మన ఏనుగు! | Plain introduction, said when the rook's meet card first appears. |
| meet-b | Here is our bishop! | ఇదిగో, మన ఒంటె! | Plain introduction, said when the bishop's meet card first appears. |
| meet-q | Here is our queen! | ఇదిగో, మన మంత్రి! | Plain introduction, said when the queen's meet card first appears. |
| meet-k | Here is our king! | ఇదిగో, మన రాజుగారు! | Plain introduction, said when the king's meet card first appears. |
| meet-n | Here is our playful knight! | ఇదిగో, మన అల్లరి గుర్రం! | Plain introduction, said when the knight's meet card first appears. |
| meet-p | Here is our little pawn! | ఇదిగో, మన చిన్న భటుడు! | Plain introduction, said when the pawn's meet card first appears. |
| hello-1 | Hello! Let's have fun and learn chess together. | హలో! సరదాగా చదరంగం నేర్చుకుందాం. | Warm, a little playful. This is the first thing the child ever hears from the app. |
| hello-2 | Tap your piece once to see where it can walk with its little footprints! | నీ పావుని ఒక్కసారి నొక్కు, అది ఎక్కడెక్కడ నడవగలదో అడుగుల గుర్తులు చూపిస్తుంది! | Plain and clear; this is the core mechanic of the whole app. |
| hello-3 | Tap a footprint, and off it goes with a skip! | ఆ అడుగు గుర్తు మీద నొక్కు చాలు, అది హుషారుగా అక్కడికి వెళ్తుంది! | Bright, a small "ta-da". |
| rook-1 | Our rook always moves in straight lines. | మన ఏనుగు ఎప్పుడూ తిన్నగానే అడుగు వేస్తుంది. | Matter-of-fact, introducing the rule. |
| rook-2 | It can slide all the way across toward the other side! | అవతలి వైపు దాకా చక్కగా దూసుకుపోగలదు! | Smooth delivery to match the glide across the board. |
| rook-3 | Or straight across, just as far. | లేదా అడ్డంగా కూడా అంతే దూరం సరదాగా వెళ్తుంది. | Same energy as rook-2; a second example, not a new idea. |
| bishop-1 | Our bishop always moves on slanty lines. | మన ఒంటె ఎప్పుడూ వాలుగానే నడుస్తుంది. | Matter-of-fact. |
| bishop-2 | It always stays on its own colour, look at that! | అది ఎప్పుడూ తన సొంత రంగు గడుల మీదే ఉంటుంది, చూశావా! | Gentle emphasis on "always". |
| bishop-3 | Watch it slide smoothly the other way! | చూడు, ఇప్పుడు చక్కగా ఇంకో వైపు జారుతుంది! | Playful, a little swoop in the voice on "slide". |
| queen-1 | Our queen is amazing! She moves like both the rook and the bishop together. | మన మంత్రి చాలా గొప్పది! ఏనుగు లాగా, ఒంటె లాగా రెండింటిలానూ వెళ్లగలదు. | Warm, a little impressed. |
| queen-2 | Straight lines, just like the rook. | ఏనుగు లాగా తిన్నగా వెళ్తుంది. | Quick, a reminder rather than new information. |
| queen-3 | And slanty lines, just like the bishop too! | అలాగే ఒంటె లాగా వాలుగా కూడా వెళ్తుంది! | Bright, matching queen-2's energy. |
| king-1 | Our king takes just one calm step at a time. | మన రాజుగారు చాలా ప్రశాంతంగా ఒక్క అడుగు మాత్రమే వేస్తారు. | Slow and steady. |
| king-2 | But he can step any way he likes with courage! | కానీ ఏ వైపుకైనా సరే ధైర్యంగా అడుగు వేయగలడు! | Still slow, a touch of surprise on "any way". |
| king-3 | Slow and careful, just like a real king. | నెమ్మదిగా, చాలా జాగ్రత్తగా, నిజమైన రాజు లాగా! | Calm and settled, closing the idea. |
| knight-1 | Our knight moves in a special, bouncy way! | మన గుర్రం చాలా ప్రత్యేకంగా, చురుగ్గా కదులుతుంది! | Bouncy, energetic. |
| knight-2 | Two steps, then one to the side. | రెండు గడులు ముందుకు వేసి, తర్వాత పక్కకి ఒకటి దూకుతుంది. | Springy rhythm: "two", then a light landing on "side". |
| knight-3 | Oh, it can even jump over other pieces! | అరె! అది వేరే పావుల మీదుగా కూడా సరదాగా దూకగలదు! | Excited; this is the surprising part of the rule. |
| pawn-1 | Our pawn marches like a brave soldier toward the other side. | మన భటుడు ఒక సైనికుడిలా అవతలి వైపుకి ముందుకు నడుస్తాడు. | Steady, marching rhythm. |
| pawn-2 | Its very first step can be two full steps! | తన మొదటి అడుగులో మాత్రం రెండు గడులు హుషారుగా వెళ్లగలడు! | Slight emphasis on "first" and "two". |
| pawn-3 | After that, always one small step at a time. | ఆ తర్వాత మాత్రం, ఎప్పుడూ ఒక్కోసారి ఒక్క అడుగే వేస్తాడు. | Calmer, settling into the regular pace. |
| capture-1 | Oh look, there is a pawn from the other side! | అయ్యో చూడు, అక్కడ శత్రువు భటుడు ఉన్నాడు! | A little surprised, pointing the child's attention at the new piece. |
| capture-2 | Move onto its space and capture it! | ఇప్పుడు నువ్వు దాని గడిలోకి వెళ్లి, దాన్ని పట్టుకో! | Plain instruction, the core of the lesson. |
| capture-3 | Successfully captured! Now it's off the board. | భలే పట్టేసుకుంది! ఇక ఆ పావు ఆటలో లేదు. | Bright, a small celebration; no fail state, so this is purely a "well done". |
| pawncap-1 | Our pawn captures on the slant, one step ahead! | మన భటుడు ముందు వాలుగా ఉన్న గడిలో శత్రువుని పట్టేసుకుంటాడు! | Plain, this is the special rule the lesson exists to teach. |
| pawncap-2 | But it cannot capture straight ahead, remember! | అంతే కానీ, తిన్నగా ఎదురుగా ఉన్నదాన్ని మాత్రం పట్టుకోలేడు సుమా! | Gentle emphasis on "cannot"; not a scolding, just a fact. |
| your-turn | Now it's your turn to try! | ఇప్పుడు నీ వంతు, నువ్వు చేసి చూపించు! | Encouraging, inviting, said at the start of every practice. |
| tap-piece | Tap your piece. | నీ పావుని ఒక్కసారి నొక్కు. | Plain hint, used if the child is idle before the first tap. |
| tap-footprint | Tap a footprint. | ఇప్పుడు ఆ అడుగు గుర్తుని నొక్కు. | Plain hint, used if the child is idle after selecting. |
| great | Great job! That was wonderful! | భలే చేశావు! చాలా చాలా బాగుంది! | Warm praise, said when a practice task is completed. |
| mission | Let's capture all three pawns! | సరే, ఇప్పుడు మనం ఈ మూడు భటులనీ పట్టుకోవాలి! | Clear and a little excited; states the round's goal before it starts. |
| hint-pawn | Follow the footprints all the way to the pawn. | అడుగుల గుర్తులు చూపించే దారిలోనే భటుడి దగ్గరికి వెళ్ళు. | Plain hint, used if the child is idle mid-round with a piece selected. |
| won | You captured them all! | అబ్బో, అందరినీ చక్కగా పట్టేసుకున్నావు! | Big and celebratory; the round's win line. |
| next | Play again, or pick the next piece to explore. | మళ్ళీ ఆడు, లేదా వేరే కొత్త పావుని ఎంచుకో. | Warm, inviting the child to choose what happens next. |
| team-robots-a | Humanoids! | మెరుపులు! | Bright and proud, said the moment the child picks this team. |
| team-robots-b | Androids! | పిడుగులు! | Bright and proud, said the moment the child picks this team. |
| team-classic-a | White! | తెల్ల పావులు! | Bright and proud, said the moment the child picks this team. |
| team-classic-b | Black! | నల్ల పావులు! | Bright and proud, said the moment the child picks this team. |
| team-space-a | Astronauts! | సూర్య జట్టు! | Bright and proud, said the moment the child picks this team. |
| team-space-b | Cosmonauts! | చంద్ర జట్టు! | Bright and proud, said the moment the child picks this team. |
| team-dinos-a | Theropods! | కొండ జట్టు! | Bright and proud, said the moment the child picks this team. |
| team-dinos-b | Sauropods! | అడవి జట్టు! | Bright and proud, said the moment the child picks this team. |
| team-pirate-a | Buccaneers! | సొరచేపలు! | Bright and proud, said the moment the child picks this team. |
| team-pirate-b | Corsairs! | తిమింగలాలు! | Bright and proud, said the moment the child picks this team. |
| pick-team | Pick your team! | నీ జట్టుని ఎంచుకో! | Warm and inviting, said once, on the Team card before a game. |
| turn-me | Your turn! | నీ వంతు! | Short and bright, said whenever control passes back to the child in a game or the turns lesson. |
| turn-foe | Their turn. | శత్రువు వంతు. | Calm and matter-of-fact, said whenever the other team's turn begins. |
| turns-1 | In chess, we take turns. | చదరంగంలో వంతుల వారీగా ఆడతాం. | Plain, introducing the idea; the first line of the turns lesson. |
| turns-2 | First your team moves. | ముందు నీ జట్టు కదులుతుంది. | Clear and simple, narrating the hero's move that follows. |
| turns-3 | Then their team moves. | తర్వాత శత్రువు జట్టు కదులుతుంది. | Clear and simple, narrating the opponent's move that follows. |
| turns-4 | Then it is your turn again! | మళ్ళీ నీ వంతు! | Bright, closing the idea on an upbeat note. |
| game-catch | Catch the knight! It hops away after every move. | గుర్రాన్ని పట్టుకో! ప్రతి సారీ అది దూకి పారిపోతుంది. | Playful and energetic; states the goal on the Mission card. |
| game-race | Pawn race! Get one pawn to the other side first. | భటుల పందెం! ముందుగా ఒక భటుడిని అవతలి వైపుకి చేర్చు. | Playful and energetic; states the goal on the Mission card. |
| game-battle | Capture all their pawns! | శత్రువు భటులందరినీ పట్టుకో! | Playful and energetic; states the goal on the Mission card. |
| knight-tired | The knight is getting tired! | గుర్రం అలసిపోతోంది! | Playful, signalling the knight will now try to be caught. |
| caught | You caught the knight! | గుర్రాన్ని పట్టేశావు! | Big and celebratory; the Catch game's win line. |
| race-won | Your pawn reached the other side! | నీ భటుడు అవతలి వైపుకి చేరాడు! | Big and celebratory; the Race game's win line. |
| piece-back | Your piece is back! | నీ పావు మళ్ళీ వచ్చింది! | Warm and reassuring; said when a captured child piece returns in Little battle. |
| golden | A golden pawn! | బంగారు భటుడు! | Excited, a little magical; said when a golden pawn appears. |
| sticker | You got a sticker! | నీకు ఒక స్టిక్కర్ వచ్చింది! | Big and celebratory; said when the capture jar fills. |
| break | Great playing! Time for a little break? | బాగా ఆడావు! కొంచెం విశ్రాంతి తీసుకుందామా? | Warm and gentle, never scolding; offered, not required. |
| who | Who's playing? | ఎవరు ఆడుతున్నారు? | Warm and curious, like asking a friend; said on the Who's playing screen, and shown there as its heading. |
| games-pick | Pick a game! | ఒక ఆట ఎంచుకో! | Warm and inviting; said when the Games screen opens. |
| game-chain | Capture chain! Capture every pawn, one after another. | గొలుసు ఆట! శత్రువు భటులను ఒకరి తర్వాత ఒకరిని పట్టుకో! | Playful and energetic; states the goal on the Mission card. |
| game-whose | Whose footprints? Tap the piece that made them! | ఎవరి అడుగులు? ఆ అడుగులు వేసిన పావుని నొక్కు! | Curious, like starting a guessing game; states the goal on the Mission card. |
| quiz-ask | Whose footprints are these? | ఈ అడుగుల గుర్తులు ఎవరివి? | Curious and gentle, a real question; said as each quiz question appears. |
| quiz-again | Its footprints look different. Try again! | దాని అడుగులు వేరేలా ఉంటాయి. మళ్ళీ చూడు! | Kind and encouraging, never "wrong"; said after the child taps a piece that is not the answer. |
| quiz-won | You know your pieces so well! | నీకు పావులన్నీ బాగా తెలుసు! | Big and celebratory; the quiz's win line. |
| tip-look | Here is a little tip! | ఇదిగో, ఒక చిన్న చిట్కా! | Friendly, like sharing a secret; said before a tip plays on the board after a game. |
| tip-catch | Get close to the knight, then watch where it can hop! | గుర్రం దగ్గరికి వెళ్ళు, అది ఎక్కడికి దూకగలదో చూడు! | Calm and clear, a tip rather than an instruction. |
| tip-race | A pawn's first step can be two squares. Zoom ahead! | భటుడి మొదటి అడుగు రెండు గడులు కావచ్చు. ముందుకు దూసుకుపో! | Calm, then bright on the last words. |
| tip-battle | Use all your pieces. Each one moves its own way! | నీ పావులన్నిటినీ వాడు. ఒక్కొక్కటి ఒక్కోలా కదులుతుంది! | Calm and clear, a tip rather than an instruction. |
| tip-chain | Before you capture, look for the next pawn! | పట్టుకునే ముందు, తర్వాతి భటుడు ఎక్కడున్నాడో చూడు! | Calm and clear, a tip rather than an instruction. |
| tip-whose | Straight lines, the rook. Slanty lines, the bishop. Both, the queen! | తిన్నగా అయితే ఏనుగు. వాలుగా అయితే ఒంటె. రెండూ అయితే మంత్రి! | Rhythmic, three short beats, like a rhyme to remember. |

## How the owner makes the clips

The owner generates the clips on their own computer with their own
scripts (Google text-to-speech through the `gTTS` Python package, sped up
slightly, trimmed and normalized, exported as mono 24 kHz 64 kbps MP3),
using the wording in the table above. That table is the source of truth
for every line: when a line is added or changed here, its clip needs to
be generated again under the same id. To add finished clips, copy them
into `audio/voice/en/` and `audio/voice/te/` and run
`node tools/make-voice.js --index-only` to rebuild `js/voice-clips.js`
(this does not contact any service).

`tools/make-voice.js` below remains an alternative way to generate clips.

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
