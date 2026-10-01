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
"bump". No "left", "right" or a square name (e.g. e4), in either language, except in the hand-print levels: the lines whose ids start with `hands-` (and `game-hands`, `tip-hands`) are the only ones that name left and right (ఎడమ, కుడి).
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
| hello-1 | Hello, let's have fun and learn chess together! | హలో, సరదాగా చదరంగం నేర్చుకుందాం! | Warm, a little playful. This is the first thing the child ever hears from the app. |
| hello-2 | Tap your piece once, and see where it can walk with its little footprints! | నీ పావుని ఒక్కసారి నొక్కు, అది ఎక్కడెక్కడ నడవగలదో అడుగుల గుర్తులు చూపిస్తుంది! | Plain and clear; this is the core mechanic of the whole app. |
| hello-3 | Tap a footprint, and off it goes with a skip! | ఆ అడుగు గుర్తు మీద నొక్కు చాలు, అది హుషారుగా అక్కడికి వెళ్తుంది! | Bright, a small "ta-da". |
| rook-1 | Our rook always moves in straight lines. | మన ఏనుగు ఎప్పుడూ తిన్నగానే అడుగు వేస్తుంది. | Matter-of-fact, introducing the rule. |
| rook-2 | It can slide all the way across, toward the other side! | అవతలి వైపు దాకా చక్కగా దూసుకుపోగలదు! | Smooth delivery to match the glide across the board. |
| rook-3 | Or straight across, just as far! | లేదా అడ్డంగా కూడా అంతే దూరం సరదాగా వెళ్తుంది. | Same energy as rook-2; a second example, not a new idea. |
| bishop-1 | Our bishop always moves on slanty lines. | మన ఒంటె ఎప్పుడూ వాలుగానే నడుస్తుంది. | Matter-of-fact. |
| bishop-2 | It always stays on its own colour. Look at that! | అది ఎప్పుడూ తన సొంత రంగు గడుల మీదే ఉంటుంది, చూశావా! | Gentle emphasis on "always". |
| bishop-3 | Watch it slide smoothly, the other way! | చూడు, ఇప్పుడు చక్కగా ఇంకో వైపు జారుతుంది! | Playful, a little swoop in the voice on "slide". |
| queen-1 | Our queen is amazing! She moves like both the rook and the bishop, together. | మన మంత్రి చాలా గొప్పది! ఏనుగు లాగా, ఒంటె లాగా రెండింటిలానూ వెళ్లగలదు. | Warm, a little impressed. |
| queen-2 | Straight lines, just like the rook. | ఏనుగు లాగా తిన్నగా వెళ్తుంది. | Quick, a reminder rather than new information. |
| queen-3 | And slanty lines, just like the bishop too! | అలాగే ఒంటె లాగా వాలుగా కూడా వెళ్తుంది! | Bright, matching queen-2's energy. |
| king-1 | Our king takes just one calm step at a time. | మన రాజుగారు చాలా ప్రశాంతంగా, ఒక్క అడుగు మాత్రమే వేస్తారు. | Slow and steady. |
| king-2 | But he can step any way he likes, with courage! | కానీ ఏ వైపుకైనా సరే ధైర్యంగా అడుగు వేయగలడు! | Still slow, a touch of surprise on "any way". |
| king-3 | Slow and careful, just like a real king. | నెమ్మదిగా, చాలా జాగ్రత్తగా, నిజమైన రాజు లాగా! | Calm and settled, closing the idea. |
| knight-1 | Our knight moves in a special, bouncy way! | మన గుర్రం చాలా ప్రత్యేకంగా, చురుగ్గా కదులుతుంది! | Bouncy, energetic. |
| knight-2 | Two steps... then one to the side. | రెండు గడులు ముందుకు వేసి, తర్వాత పక్కకి ఒకటి దూకుతుంది. | Springy rhythm: "two", then a light landing on "side". |
| knight-3 | Oh, it can even jump over other pieces! | అరె, అది వేరే పావుల మీదుగా కూడా సరదాగా దూకగలదు! | Excited; this is the surprising part of the rule. |
| pawn-1 | Our pawn marches like a brave soldier, toward the other side. | మన భటుడు ఒక సైనికుడిలా, అవతలి వైపుకి ముందుకు నడుస్తాడు. | Steady, marching rhythm. |
| pawn-2 | Its very first step can be two whole squares! | తన మొదటి అడుగులో మాత్రం రెండు గడులు హుషారుగా వెళ్లగలడు! | Slight emphasis on "first" and "two". |
| pawn-3 | After that, always one small step at a time. | ఆ తర్వాత మాత్రం, ఎప్పుడూ ఒక్కోసారి ఒక్క అడుగే వేస్తాడు. | Calmer, settling into the regular pace. |
| capture-1 | Oh look, there's a pawn from the other side! | అయ్యో చూడు, అక్కడ శత్రువు భటుడు ఉన్నాడు! | A little surprised, pointing the child's attention at the new piece. |
| capture-2 | Move onto its space, and capture it! | ఇప్పుడు నువ్వు దాని గడిలోకి వెళ్లి, దాన్ని పట్టుకో! | Plain instruction, the core of the lesson. |
| capture-3 | Successfully captured! Now, it's off the board. | భలే పట్టేసుకుంది! ఇక ఆ పావు ఆటలో లేదు. | Bright, a small celebration; no fail state, so this is purely a "well done". |
| pawncap-1 | Our pawn captures on the slant, one step ahead! | మన భటుడు, ముందు వాలుగా ఉన్న గడిలో శత్రువుని పట్టేసుకుంటాడు! | Plain, this is the special rule the lesson exists to teach. |
| pawncap-2 | But it cannot capture straight ahead, remember! | అంతే కానీ, తిన్నగా ఎదురుగా ఉన్నదాన్ని మాత్రం పట్టుకోలేడు సుమా! | Gentle emphasis on "cannot"; not a scolding, just a fact. |
| your-turn | Now, it's your turn to try! | ఇప్పుడు నీ వంతు, నువ్వు చేసి చూపించు! | Encouraging, inviting, said at the start of every practice. |
| tap-piece | Tap your piece. | నీ పావుని ఒక్కసారి నొక్కు. | Plain hint, used if the child is idle before the first tap. |
| tap-footprint | Tap a footprint. | ఇప్పుడు ఆ అడుగు గుర్తుని నొక్కు. | Plain hint, used if the child is idle after selecting. |
| great | Great job, that was wonderful! | భలే చేశావు, చాలా చాలా బాగుంది! | Warm praise, said when a practice task is completed. |
| mission | Let's capture all three pawns! | సరే, ఇప్పుడు మనం ఈ మూడు భటులనీ పట్టుకోవాలి! | Clear and a little excited; states the round's goal before it starts. |
| hint-pawn | Follow the footprints, all the way to the pawn. | అడుగుల గుర్తులు చూపించే దారిలోనే, భటుడి దగ్గరికి వెళ్ళు. | Plain hint, used if the child is idle mid-round with a piece selected. |
| won | Wow, you captured them all! | అబ్బో, అందరినీ చక్కగా పట్టేసుకున్నావు! | Big and celebratory; the round's win line. |
| next | Play again, or try the next one! | మళ్ళీ ఆడు, లేదా తర్వాతి దానికి వెళ్దాం! | Warm, inviting the child to choose what happens next. |
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
| pick-team | Now, pick your team! | ఇప్పుడు, నీ జట్టుని ఎంచుకో! | Warm and inviting, said once, on the Team card before a game. |
| turn-me | Your turn! | నీ వంతు! | Short and bright, said whenever control passes back to the child in a game or the turns lesson. |
| turn-foe | Their turn. | శత్రువు వంతు. | Calm and matter-of-fact, said whenever the other team's turn begins. |
| turns-1 | In chess, we always take turns. | చదరంగంలో, ఎప్పుడూ వంతుల వారీగా ఆడతాం. | Plain, introducing the idea; the first line of the turns lesson. |
| turns-2 | First, your team moves. | ముందు, నీ జట్టు కదులుతుంది. | Clear and simple, narrating the hero's move that follows. |
| turns-3 | Then, their team moves. | తర్వాత, శత్రువు జట్టు కదులుతుంది. | Clear and simple, narrating the opponent's move that follows. |
| turns-4 | And then... it's your turn again! | ఆ తర్వాత... మళ్ళీ నీ వంతు! | Bright, closing the idea on an upbeat note. |
| game-catch | Catch the knight! But watch out, it hops away after every move. | గుర్రాన్ని పట్టుకో! కానీ జాగ్రత్త, ప్రతి సారీ అది దూకి పారిపోతుంది. | Playful and energetic; states the goal on the Mission card. |
| game-race | Pawn race! Be the first to get a pawn to the other side! | భటుల పందెం! ముందుగా, ఒక భటుడిని అవతలి వైపుకి చేర్చు. | Playful and energetic; states the goal on the Mission card. |
| game-battle | Little battle! Can you capture all their pawns? | చిన్న యుద్ధం! శత్రువు భటులందరినీ పట్టుకోగలవా? | Playful and energetic; states the goal on the Mission card. |
| knight-tired | Oh, the knight is getting tired! | అరె, గుర్రం అలసిపోతోంది! | Playful, signalling the knight will now try to be caught. |
| caught | Yay, you caught the knight! | భలే, గుర్రాన్ని పట్టేశావు! | Big and celebratory; the Catch game's win line. |
| race-won | Hooray, your pawn reached the other side! | అబ్బో, నీ భటుడు అవతలి వైపుకి చేరాడు! | Big and celebratory; the Race game's win line. |
| piece-back | Look, your piece is back! | చూడు, నీ పావు మళ్ళీ వచ్చింది! | Warm and reassuring; said when a captured child piece returns in Little battle. |
| golden | Wow, a golden pawn! | ఆహా, బంగారు భటుడు! | Excited, a little magical; said when a golden pawn appears. |
| sticker | Yay, you got a sticker! | భలే, నీకు ఒక స్టిక్కర్ వచ్చింది! | Big and celebratory; said when the capture jar fills. |
| break | Great playing! How about a little break? | బాగా ఆడావు! కొంచెం విశ్రాంతి తీసుకుందామా? | Warm and gentle, never scolding; offered, not required. |
| who | Who's playing today? | ఈ రోజు ఎవరు ఆడుతున్నారు? | Warm and curious, like asking a friend; said on the Who's playing screen, and shown there as its heading. |
| games-pick | Pick a game! | ఒక ఆట ఎంచుకో! | Warm and inviting; said when the Games screen opens. |
| check-1 | Check! The rook could capture your king. | చెక్! ఏనుగు నీ రాజుని పట్టుకోగలదు. | Clear and a little urgent, not scary; the red line on the board shows the danger. |
| check-2 | Move your king out of danger! | నీ రాజుని ప్రమాదం నుంచి తప్పించు! | Calm instruction; the king then steps out of the line. |
| check-3 | Your king is safe now! | ఇప్పుడు నీ రాజు క్షేమంగా ఉన్నాడు! | Relieved and warm; also said after each solved Get out of check puzzle. |
| game-escape | Get out of check! Save your king every time. | చెక్ నుంచి తప్పించుకో! ప్రతిసారీ నీ రాజుని కాపాడు. | Brave and energetic; states the goal on the Mission card. |
| escape-ask | Check! Save your king. | చెక్! నీ రాజుని కాపాడు. | Clear, a little urgent; said as each Get out of check puzzle appears. |
| escape-won | You kept your king safe every time! | ప్రతిసారీ నీ రాజుని కాపాడావు! | Big and celebratory; the Get out of check win line. |
| tip-escape | Step away, block the line, or capture the attacker! | పక్కకి తప్పుకో, దారికి అడ్డం పెట్టు, లేదా దాడి చేసే పావుని పట్టుకో! | Three clear beats, one per way out, in time with the scene. |
| hands-1 | Hold up your hands and look at them. | నీ చేతులు పైకెత్తి చూసుకో. | Warm and playful; the child really holds up their hands. |
| hands-2 | This hand print is your left hand. | ఈ చేతి ముద్ర నీ ఎడమ చేయి. | Slow and clear; the orange hand print glows. |
| hands-3 | This one is your right hand. | ఇది నీ కుడి చేయి. | Slow and clear; the blue hand print glows. |
| hands-4 | The rook slides toward your left hand. | ఏనుగు నీ ఎడమ చేయి వైపుకి జారుతుంది. | Smooth, matching the glide; the left hand print glows again. |
| game-hands | Left or right? Move the way I say! | ఎడమ, కుడి! నేను చెప్పిన వైపుకి కదుపు! | Playful, like a game of Simon says; states the goal on the Mission card. |
| hands-left | Move to your left! | నీ ఎడమ వైపుకి కదుపు! | Clear and bright, a little emphasis on "left". |
| hands-right | Move to your right! | నీ కుడి వైపుకి కదుపు! | Clear and bright, a little emphasis on "right". |
| hands-yes-left | Yes, that's your left! | అవును, అది నీ ఎడమ వైపు! | Happy, naming the side once more. |
| hands-yes-right | Yes, that's your right! | అవును, అది నీ కుడి వైపు! | Happy, naming the side once more. |
| hands-not-left | That way is your right. Try your left! | అది నీ కుడి వైపు. ఎడమ వైపు ప్రయత్నించు! | Kind, never "wrong"; the piece slides back and the orange print glows. |
| hands-not-right | That way is your left. Try your right! | అది నీ ఎడమ వైపు. కుడి వైపు ప్రయత్నించు! | Kind, never "wrong"; the piece slides back and the blue print glows. |
| hands-won | You know your left and right! | నీకు ఎడమ, కుడి బాగా తెలుసు! | Big and proud; the Left or right? win line. |
| tip-hands | Look at the hand prints: this one is left, that one is right. | చేతి ముద్రలు చూడు: ఇది ఎడమ, అది కుడి. | Calm, in time with the two prints glowing one after the other. |
| pond-1 | Your pawns march toward the other side. | నీ భటులు అవతలి వైపుకి నడుస్తారు. | Steady, marching rhythm; the child's pawn steps up the board. |
| pond-2 | Their pawns march toward your side! | శత్రువు భటులు నీ వైపుకి నడుస్తారు! | A small surprise on "your side"; the opponent's pawn steps down the board. |
| pond-3 | Their footprints point toward your side. | శత్రువు అడుగుల గుర్తులు నీ వైపుకే ఉంటాయి. | Calm, pointing at the dark footprints. |
| game-theirs | Their footprints! Tap where their piece can go. | శత్రువు అడుగులు! శత్రువు పావు వెళ్ళగలిగే గడిని నొక్కు. | Curious and playful; states the goal on the Mission card. |
| theirs-ask | Where can their piece go? | శత్రువు పావు ఎక్కడికి వెళ్ళగలదు? | A real question, gentle; said as each question appears. |
| theirs-again | Look at how it moves, then try again. | అది ఎలా కదులుతుందో చూడు, మళ్ళీ ప్రయత్నించు. | Kind and encouraging, never "wrong"; its footprints show for a moment. |
| theirs-won | You can see their moves now! | ఇప్పుడు శత్రువు ఎత్తులు నీకు కనిపిస్తున్నాయి! | Big and proud; the Their footprints win line. |
| tip-theirs | Their pawns march toward your side, and capture on the slant. | శత్రువు భటులు నీ వైపుకి నడుస్తారు, వాలుగా పట్టుకుంటారు. | Calm and clear, the one thing to remember about their pawns. |
| game-danger | Which piece is in danger? Find it, then move it to safety. | ఏ పావుకి ప్రమాదం? కనుక్కుని, దాన్ని సురక్షిత చోటుకి తీసుకెళ్ళు. | Brave and caring; states the goal on the Mission card. |
| danger-ask | Which of your pieces could they capture? | శత్రువు నీ ఏ పావుని పట్టుకోగలదు? | A real question, a little serious; said as each position appears. |
| danger-yes | Yes, now move it somewhere safe! | అవును, ఇప్పుడు దాన్ని సురక్షిత చోటుకి కదుపు! | Bright, then a calm instruction. |
| danger-safe | That one is safe. Try another! | అది క్షేమంగానే ఉంది. ఇంకోటి చూడు! | Friendly and light; the tapped piece gets a green ring. |
| danger-won | You kept your pieces safe! | నీ పావులన్నిటినీ కాపాడావు! | Big and warm; the Which piece is in danger? win line. |
| tip-danger | Look at their footprints. Is one of your pieces on them? | శత్రువు అడుగుల గుర్తులు చూడు. వాటి మీద నీ పావు ఏదైనా ఉందా? | Calm, a question to ask yourself before every move. |
| mate-1 | This king is stuck behind his own pawns. | ఈ రాజు తన సొంత భటుల వెనక ఇరుక్కుపోయాడు. | Curious, pointing at the glowing pawns in front of the king. |
| mate-2 | Slide the rook all the way to the other side! | ఏనుగుని అవతలి వైపు దాకా దూసుకుపోనివ్వు! | Bright, matching the rook's long glide. |
| mate-3 | Checkmate! The king has nowhere to go. | చెక్‌మేట్! రాజుకి ఎక్కడికీ వెళ్ళే దారి లేదు. | Big and proud; also said after each solved Checkmate in one puzzle. |
| game-mate | Checkmate in one! Trap the king with one move. | ఒక్క ఎత్తులో చెక్‌మేట్! ఒకే కదలికతో రాజుని బంధించు. | Excited, like a treasure hunt; states the goal on the Mission card. |
| mate-ask | Find the checkmate! | చెక్‌మేట్ కనుక్కో! | Inviting, a small puzzle to solve; said as each puzzle appears. |
| mate-nearly | Nearly, but the king can still escape! | దాదాపు, కానీ రాజు ఇంకా తప్పించుకోగలడు! | Warm and encouraging, never "wrong"; the squares he could reach glow red. |
| mate-won | You found every checkmate! | అన్ని చెక్‌మేట్లూ కనుక్కున్నావు! | Big and celebratory; the Checkmate in one win line. |
| tip-mate | Check the king, and cover every square he could run to! | రాజుకి చెక్ పెట్టు, అతను పారిపోయే ప్రతి గడినీ కాపు కాయి! | Calm and clear, the whole idea of checkmate in one line. |
| game-mate2 | Checkmate in two! Give check first, then checkmate. | రెండు ఎత్తుల్లో చెక్‌మేట్! ముందు చెక్ పెట్టు, తర్వాత చెక్‌మేట్. | Excited, a bigger puzzle than before; states the goal on the Mission card. |
| mate2-ask | Give check first! | ముందు చెక్ పెట్టు! | Inviting; said as each Checkmate in two puzzle appears. |
| mate2-nearly | Nearly, now find the check that traps him on the next move. | దాదాపు, ఇప్పుడు తర్వాతి ఎత్తులో రాజుని బంధించే చెక్ కనుక్కో. | Warm and encouraging, never "wrong"; said when a first move is taken back. |
| mate2-won | You found every checkmate in two! | రెండు ఎత్తుల్లో చెక్‌మేట్లు అన్నీ కనుక్కున్నావు! | Big and celebratory; the Checkmate in two win line. |
| tip-mate2 | Give check so the king must move. Then checkmate him! | రాజు కదలక తప్పని చెక్ పెట్టు. తర్వాత చెక్‌మేట్ పెట్టు! | Calm and clear, the idea of checkmate in two in one line. |
| game-value | Which capture is best? Take the biggest prize you can keep. | ఏది పట్టుకుంటే మంచిది? నువ్వు ఉంచుకోగలిగే పెద్ద బహుమతిని పట్టుకో. | Curious, a treasure hunt; states the goal on the Mission card. |
| value-ask | Which capture is best? | ఏది పట్టుకుంటే మంచిది? | Inviting; said as each Which capture is best? puzzle appears. |
| value-find | Find a capture! | పట్టుకోగలిగేది కనుక్కో! | Gentle; said when a move that captures nothing is taken back. |
| value-bigger | A bigger prize is waiting! | ఇంకా పెద్ద బహుమతి ఎదురు చూస్తోంది! | Warm and teasing, never "wrong"; said when a smaller capture is taken back. |
| value-back | Careful, they could capture it back! | జాగ్రత్త, శత్రువు దాన్ని తిరిగి పట్టుకోగలదు! | Gentle and protective; the pieces that could capture it back glow red. |
| value-yes | Great capture! | భలే పట్టావు! | Proud and bright; said after each solved puzzle. |
| value-won | You found every best capture! | ప్రతిసారీ మంచి పట్టు కనుక్కున్నావు! | Big and celebratory; the Which capture is best? win line. |
| tip-value | Take the biggest prize they cannot capture back! | శత్రువు తిరిగి పట్టుకోలేని పెద్ద బహుమతిని పట్టుకో! | Calm and clear, the whole idea in one line. |
| how-value-1 | A pawn is a small prize. The queen is the biggest! | భటుడు చిన్న బహుమతి. మంత్రి అన్నిటికంటే పెద్దది! | Playful, as the pieces line up from small to big. |
| game-stale | Checkmate, not stalemate! Trap the king with check. | చెక్‌మేట్, స్టేల్‌మేట్ కాదు! చెక్ పెట్టి రాజుని బంధించు. | Bright and a little mysterious; states the goal on the Mission card. |
| stale-ask | Find the checkmate, not the stalemate! | స్టేల్‌మేట్ కాదు, చెక్‌మేట్ కనుక్కో! | Inviting; said as each Checkmate, not stalemate puzzle appears. |
| stale-oops | Stalemate! He cannot move, but he is not in check. | స్టేల్‌మేట్! రాజు కదలలేడు, కానీ అతనికి చెక్ లేదు. | Surprised and gentle, never "wrong"; the move slides back and the king glows. |
| stale-won | Checkmate every time, well done! | ప్రతిసారీ చెక్‌మేట్, శభాష్! | Big and celebratory; the Checkmate, not stalemate win line. |
| tip-stale | Always give check. No check and no moves is stalemate. | ఎప్పుడూ చెక్ పెట్టు. చెక్ లేకుండా కదలలేకపోతే స్టేల్‌మేట్. | Calm and clear, the difference in one line. |
| game-opening | Wake up your army! Bring your pieces out, then castle. | నీ సైన్యాన్ని నిద్రలేపు! పావుల్ని బయటకు తెచ్చి, తర్వాత క్యాస్లింగ్ చెయ్యి. | Bright and energetic, like a morning call; states the goal on the Mission card. |
| open-queen | Keep the queen at home for now. | ఇప్పటికి మంత్రిని తన చోటులోనే ఉంచు. | Gentle and wise, never "wrong"; the queen slides back. |
| open-rook | The rooks wait until the king is safe. | రాజు సురక్షితంగా ఉండే వరకు ఏనుగులు ఆగుతాయి. | Calm; the rook slides back. |
| open-king | Keep the king at home, then castle! | రాజుని తన చోటులోనే ఉంచు, తర్వాత క్యాస్లింగ్! | Warm; the king slides back. |
| open-ready | Good, that piece is ready! | బాగుంది, ఆ పావు సిద్ధం! | Pleased; said when a middle pawn, knight or bishop comes out for the first time. |
| open-won | Your army is awake, and your king is safe! | నీ సైన్యం మేల్కొంది, నీ రాజు సురక్షితం! | Big and proud; the Wake up your army win line. |
| tip-opening | A middle pawn, knights and bishops out, then castle! | మధ్య భటుడు ముందుకు, గుర్రాలు ఒంటెలు బయటకు, తర్వాత క్యాస్లింగ్! | Calm and clear, the whole plan in one line. |
| game-run | Run away! Stay where the other piece cannot capture you. | పారిపో! శత్రువు పావు పట్టుకోలేని చోట ఉండు. | Playful and a little breathless; states the goal on the Mission card. |
| run-danger | Not there, it could capture you there! | అక్కడ వద్దు, అక్కడ అది నిన్ను పట్టుకోగలదు! | Gentle and protective, never scolding; said when the child taps a square the chaser watches. |
| run-won | You got away safely! | సురక్షితంగా తప్పించుకున్నావు! | Big and relieved; the Run away win line. |
| tip-run | Look at its footprints, and stand where they are not! | దాని అడుగుల గుర్తులు చూడు, అవి లేని చోట నిలబడు! | Calm and clear, the key idea of the game. |
| game-chain | Capture chain! Capture every pawn, one after another. | గొలుసు ఆట! శత్రువు భటులను ఒకరి తర్వాత ఒకరిని పట్టుకో! | Playful and energetic; states the goal on the Mission card. |
| game-whose | Whose footprints? Tap the piece that made them! | ఎవరి అడుగులు? ఆ అడుగులు వేసిన పావుని నొక్కు! | Curious, like starting a guessing game; states the goal on the Mission card. |
| quiz-ask | Whose footprints are these? | ఈ అడుగుల గుర్తులు ఎవరివి? | Curious and gentle, a real question; said as each quiz question appears. |
| quiz-again | Its footprints look different. Try again! | దాని అడుగులు వేరేలా ఉంటాయి. మళ్ళీ చూడు! | Kind and encouraging, never "wrong"; said after the child taps a piece that is not the answer. |
| quiz-won | You know your pieces so well! | నీకు పావులన్నీ బాగా తెలుసు! | Big and celebratory; the quiz's win line. |
| tip-look | Here's a little tip! | ఇదిగో, ఒక చిన్న చిట్కా! | Friendly, like sharing a secret; said before a tip plays on the board after a game. |
| how-look | Watch how to play! | ఎలా ఆడాలో చూడు! | Friendly and inviting; said before a game's "watch how to play" scene. |
| how-catch-1 | The knight can hop to these squares. | గుర్రం ఈ గడులకి దూకగలదు. | Calm, pointing at the knight's footprints on the board. |
| how-catch-2 | Stand where your footprints cover its hops. | దాని దూకే గడుల మీద నీ అడుగుల గుర్తులు పడేలా నిలబడు. | Clear and slow, the key idea of the game. |
| how-catch-3 | It landed on your footprints. Capture it! | అది నీ అడుగుల గుర్తు మీద దిగింది. పట్టుకో! | Excited, a small "gotcha" on the capture. |
| tip-race | A pawn's first step can be two squares. Zoom ahead! | భటుడి మొదటి అడుగు రెండు గడులు కావచ్చు. ముందుకు దూసుకుపో! | Calm, then bright on the last words. |
| tip-battle | Use all your pieces. Each one moves its own way! | నీ పావులన్నిటినీ వాడు. ఒక్కొక్కటి ఒక్కోలా కదులుతుంది! | Calm and clear, a tip rather than an instruction. |
| tip-chain | Before you capture, look for the next pawn! | పట్టుకునే ముందు, తర్వాతి భటుడు ఎక్కడున్నాడో చూడు! | Calm and clear, a tip rather than an instruction. |
| tip-whose | Straight lines, the rook. Slanty lines, the bishop. Both, the queen! | తిన్నగా అయితే ఏనుగు. వాలుగా అయితే ఒంటె. రెండూ అయితే మంత్రి! | Rhythmic, three short beats, like a rhyme to remember. |
| game-hop | Knight hop! Hop your knight to the other side. | గుర్రం గెంతులు! నీ గుర్రాన్ని అవతలి వైపుకి దూకించు. | Bouncy and playful; states the goal on the Mission card. |
| game-way | Find the way! Get your piece to the other side. | దారి వెతుకు! నీ పావుని అవతలి వైపుకి చేర్చు. | Curious, like the start of a small puzzle; states the goal on the Mission card. |
| game-stop | Stop the pawns! Capture them as they march toward you. | శత్రువు భటులను ఆపు! అవి నీ వైపు నడిచి వస్తుంటే పట్టుకో. | Brave and energetic; states the goal on the Mission card. |
| game-safe | Keep the king safe! Walk him to the other side. | రాజుని కాపాడు! అతన్ని అవతలి వైపుకి నడిపించు. | Calm and careful; states the goal on the Mission card. |
| reach-won | You reached the other side! | అవతలి వైపుకి చేరుకున్నావు! | Big and celebratory; the win line of Knight hop, Find the way and Keep the king safe. |
| king-danger | Not there, that square isn't safe for the king! | అక్కడ వద్దు, ఆ గడిలో రాజుకి ప్రమాదం! | Gentle and protective, never scolding; said when the child taps a square the king may not step to. |
| tip-hop | Pick the footprints closest to the other side! | అవతలి వైపుకి దగ్గరగా ఉన్న అడుగు గుర్తుని ఎంచుకో! | Calm and clear, a tip rather than an instruction. |
| tip-way | Your own pieces block the way. Go around them! | నీ పావులే దారికి అడ్డం. వాటి చుట్టూ తిరిగి వెళ్ళు! | Calm and clear, a tip rather than an instruction. |
| tip-stop | A pawn cannot walk through you. Stand in front of it! | శత్రువు భటుడు నిన్ను దాటి నడవలేడు. అతని ముందు నిలబడు! | Calm, with a little triumph at the end. |
| tip-safe | The king never steps where the other side could capture him. | శత్రువు పట్టుకోగలిగే గడిలోకి రాజు ఎప్పుడూ అడుగు పెట్టడు. | Calm and serious, the one rule that matters most for the king. |
| game-army1 | Pawn battle! Get one of your pawns to the other side. | భటుల యుద్ధం! నీ భటుల్లో ఒకరిని అవతలి వైపుకి చేర్చు. | Excited, a big game beginning; states the goal on the Mission card of the first battle. |
| game-army2 | Pawns and rooks! Capture all their pawns, or reach the other side. | భటులు, ఏనుగులు! శత్రువు భటులందరినీ పట్టుకో, లేదా అవతలి వైపుకి చేరు. | Excited, a little bigger than the pawn battle; two ways to win, clearly apart. |
| game-army3 | Pawns, rooks and bishops! Capture all their pawns, or reach the other side. | భటులు, ఏనుగులు, ఒంటెలు! శత్రువు భటులందరినీ పట్టుకో, లేదా అవతలి వైపుకి చేరు. | Excited, like the army growing; two ways to win, clearly apart. |
| army-won | You won the battle! | యుద్ధంలో నువ్వు గెలిచావు! | Big and proud; the win line of every battle. |
| army-danger | Careful, one of your pieces could be captured! | జాగ్రత్త, శత్రువు నీ పావుల్లో ఒకదాన్ని పట్టుకోగలదు! | Calm warning, never scary; the piece in danger has a red ring. |
| tip-army1 | Pawns keep each other safe. If one is captured, the other captures back! | భటులు ఒకరినొకరు కాపాడుకుంటారు. ఒకరిని పట్టుకుంటే, ఇంకొకరు తిరిగి పట్టుకుంటారు! | Warm, like teamwork; in time with the capture and the capture back. |
| tip-army2 | Find a pawn that nobody protects, and capture it with your rook! | ఎవరూ కాపు కాయని భటుడిని వెతికి, నీ ఏనుగుతో పట్టుకో! | Clever and playful; the protected pawn glows red, the free one gold. |
| tip-army3 | Your bishop is stuck behind the pawns. Move a pawn, and out it comes! | నీ ఒంటె భటుల వెనక ఇరుక్కుపోయింది. ఒక భటుడిని కదుపు, అది బయటకు వస్తుంది! | A small "oh no" on stuck, then bright as the bishop comes out. |
| game-army4 | Knights join in! Capture all their pawns, or reach the other side. | గుర్రాలు కూడా వచ్చాయి! శత్రువు భటులందరినీ పట్టుకో, లేదా అవతలి వైపుకి చేరు. | Excited, the army growing again; two ways to win, clearly apart. |
| game-army5 | The queens join in! Capture all their pawns, or reach the other side. | మంత్రులు కూడా వచ్చారు! శత్రువు భటులందరినీ పట్టుకో, లేదా అవతలి వైపుకి చేరు. | Excited and a little grand for the queens; two ways to win, clearly apart. |
| game-army6 | The whole army, kings too! Checkmate their king to win. | మొత్తం సైన్యం, రాజులతో సహా! శత్రువు రాజుకి చెక్‌మేట్ పెట్టి గెలువు. | Big and proud, a real game at last; states the goal on the Mission card. |
| army-mate-won | Checkmate! You won the whole battle! | చెక్‌మేట్! మొత్తం యుద్ధం నువ్వే గెలిచావు! | The biggest celebration in the app; the win line of the battle with kings. |
| army-check | Check! Their king must get out of check. | చెక్! శత్రువు రాజు చెక్ నుంచి తప్పించుకోవాలి. | Bright and pleased; said when the child gives check. |
| army-queen | Your pawn reached the other side. Now it's a queen! | నీ భటుడు అవతలి వైపుకి చేరాడు. ఇప్పుడు అతను మంత్రి! | Delighted surprise on "queen"; the pawn turns into a queen with sparkles. |
| army-draw | Stalemate! Their king cannot move, but nobody wins this time. | స్టేల్‌మేట్! శత్రువు రాజు కదలలేడు, కానీ ఈసారి ఎవరూ గెలవలేదు. | Calm and kind, never disappointed; a game that ends with nobody winning. |
| tip-army4 | Knights jump over pieces. One knight can attack two pieces at once! | గుర్రాలు పావుల మీదుగా దూకుతాయి. ఒక్క గుర్రం ఒకేసారి రెండు పావుల మీద దాడి చేయగలదు! | Playful on "jump", then impressed on "two at once", in time with the scene. |
| tip-army5 | Your queen is strong. Never let her be captured for a pawn! | నీ మంత్రి చాలా బలమైనది. ఒక భటుడి కోసం ఆమెని పోగొట్టుకోకు! | Proud of the queen, then a gentle warning; the protected pawn glows red. |
| tip-army6 | Keep your king safe, and trap theirs! | నీ రాజుని కాపాడుకో, శత్రువు రాజుని బంధించు! | Brave, the whole idea of chess in one line; starts the check and checkmate scene. |
| army-how-1 | Check! Their bishop could capture your king. | చెక్! శత్రువు ఒంటె నీ రాజుని పట్టుకోగలదు. | A little urgent; the bishop's line to the king glows red. |
| army-how-2 | Your pawn steps in the way. Your king is safe again. | నీ భటుడు దారికి అడ్డం వచ్చాడు. నీ రాజు మళ్ళీ క్షేమం. | Relieved; the pawn steps into the line. |
| army-how-3 | Now your queen and rook work together to trap their king. | ఇప్పుడు నీ మంత్రి, ఏనుగు కలిసి శత్రువు రాజుని బంధిస్తాయి. | Clever teamwork; the rook moves first, then the queen. |
| game-army7 | The full game! Every rule of chess. Checkmate their king to win. | పూర్తి ఆట! చదరంగంలోని ప్రతి నియమం. శత్రువు రాజుకి చెక్‌మేట్ పెట్టి గెలువు. | Grand and proud, the top of the ladder; states the goal on the Mission card. |
| tip-army7 | Castling: the king steps two squares, and the rook jumps beside him! | క్యాస్లింగ్: రాజు రెండు గడులు కదులుతాడు, ఏనుగు అతని పక్కకి దూకుతుంది! | Clear and a little magical, in time with the king and rook moving together. |
| army-castle | Castling! The king and rook moved together. | క్యాస్లింగ్! రాజు, ఏనుగు కలిసి కదిలారు. | Bright; said whenever either side castles. |
| army-passant | En passant! A pawn captured the pawn that rushed past it. | ఆన్ పసాంట్! పక్క నుంచి దూసుకెళ్ళిన భటుడిని ఇంకో భటుడు పట్టుకున్నాడు. | Surprised and delighted by a rare rule; said whenever either side captures en passant. |
| army-foe-queen | Their pawn reached your side. Now it's a queen! | శత్రువు భటుడు నీ వైపుకి చేరాడు. ఇప్పుడు అది మంత్రి! | Calm, a fact not a threat; the opponent's pawn turns into a queen. |
| army-draw-kings | Only the two kings remain. Nobody wins this time. | ఇద్దరు రాజులే మిగిలారు. ఈసారి ఎవరూ గెలవలేదు. | Calm and kind; a game that ends with nobody winning. |
| army-undo | Taken back, try another move! | వెనక్కి తీసుకున్నాం, ఇంకో ఎత్తు వేసి చూడు! | Warm and encouraging, never "wrong"; said after the Undo button. |

## How the clips are made

The table above is the source of truth for every line: when a line is
added or changed here, its clip needs to be generated again under the same
id. The wording is written to be spoken: a comma, not a full stop, after a
short opener ("Yes, ...", "Careful, ...", "Oh, ..."), because a stop there
makes the voice pause for almost a second; a "..." only where the pause
means something. Keep that when editing a line.

The clips are generated with Microsoft's neural voices through the free
`edge-tts` Python package, by [tools/make-voice-edge.py](../tools/make-voice-edge.py):
English with `en-IN-NeerjaExpressiveNeural` (the livelier Neerja) at
`-10%` speed and `+15Hz` pitch, and Telugu with `te-IN-ShrutiNeural` at
`-5%` and `+25Hz` (the registry's `azureVoice`, `voiceRate` and
`voicePitch` in `js/langs.js`, chosen by the owner by ear). No key is
needed; the script needs the internet only while it runs, and the site
itself never goes online for audio. With ffmpeg on the PATH it cuts the
long silence edge-tts leaves at the end of a clip to 0.2 s, so a lesson
does not wait on silence. Afterwards it rebuilds `js/voice-clips.js`;
then run `node tools/make-offline.js` so the offline file list includes
the new clips.

```
uv venv .venv
uv pip install --python .venv edge-tts
.venv\Scripts\python tools/make-voice-edge.py --only hello-1 great     # try two lines and listen
.venv\Scripts\python tools/make-voice-edge.py                          # every missing clip, both languages
.venv\Scripts\python tools/make-voice-edge.py --only next --force      # remake a changed line
```

Options: `--lang en` or `--lang te` (default: all), `--voice` to try
another voice for one language (for example
`--lang en --voice en-IN-NeerjaNeural`), `--rate` and `--pitch` to
override the registry's speed and pitch, and `--force` to replace clips
that already exist (without it, an existing clip, such as a parent's own
recording, is left alone).

Earlier clips were made with Google text-to-speech (`gTTS`). Azure with a
key, through `tools/make-voice.js` below, remains an alternative.

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
