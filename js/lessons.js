/*
 * Footprint Chess: lesson content for the "watch, then do" player.
 *
 * A lesson has a short watch script that plays on the real board (voice
 * lines, a ghost hand, moves, glows and landmark pulses), then a practice
 * list of tap tasks played from the same start position. No DOM: this file
 * only describes content, board.js and player.js turn it into animation.
 *
 * Terminology rule for every voice line, in every language: real chess
 * names only (rook, bishop, queen, king, knight, pawn, capture); never a
 * robot name; never "left", "right", or a square name like e4 (Telugu
 * ఎడమ "left" and కుడి "right" are also banned); edges are "the other
 * side" (row 0) and "your side" (row 7), never named directly in a voice
 * line. Enforced by tests/lessons.test.js.
 *
 * Classic script: exposes window.FC.lessons in the browser and
 * module.exports in Node. Keep to ES2017 syntax (see README, "Browser
 * support and coding rules").
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var R = isNode ? require('./rules.js') : root.FC.rules;
  var Ls = isNode ? require('./langs.js') : root.FC.langs;

  /*
   * Languages the app can speak, from the registry in js/langs.js (English
   * is the default, the owner's decision; Telugu is the alternative, chosen
   * with ?lang=te). Anything that needs "the current language, else the app
   * default" should fall back to DEFAULT_LANG, not to LANGS[0], so the two
   * stay independent. Adding a language: docs/LANGUAGES.md.
   */
  var LANGS = Ls.ids();
  var DEFAULT_LANG = Ls.DEFAULT_LANG;

  /*
   * Real chess piece names, per language, keyed by the same one-letter
   * type used everywhere else in this app (see js/rules.js).
   */
  var PIECE_NAMES = {
    en: { r: 'Rook', b: 'Bishop', q: 'Queen', k: 'King', n: 'Knight', p: 'Pawn' },
    te: { r: 'ఏనుగు', b: 'ఒంటె', q: 'మంత్రి', k: 'రాజు', n: 'గుర్రం', p: 'భటుడు' }
  };

  /* The order pieces are introduced in, and the order "next piece" cycles through. */
  var TYPE_ORDER = ['r', 'b', 'q', 'k', 'n', 'p'];

  /*
   * Every voice line's text, one property per language id in the registry
   * (js/langs.js; today English and Telugu), exactly as agreed with the
   * owner (docs/VOICE-SCRIPT.md carries the same text, plus a delivery note
   * per line, and tests/lessons.test.js checks the two files match). A
   * language's text is written natively for children, never translated
   * word for word.
   */
  var RAW_LINES = {
    /* used outside lessons, by js/app.js (see APP_LINES below) */
    'pick': { en: 'Pick a fun chess piece to play with!', te: 'ఆడుకోవడానికి నీకు నచ్చిన పావుని ఎంచుకో!' },
    'meet-r': { en: 'Here is our rook!', te: 'ఇదిగో, మన ఏనుగు!' },
    'meet-b': { en: 'Here is our bishop!', te: 'ఇదిగో, మన ఒంటె!' },
    'meet-q': { en: 'Here is our queen!', te: 'ఇదిగో, మన మంత్రి!' },
    'meet-k': { en: 'Here is our king!', te: 'ఇదిగో, మన రాజుగారు!' },
    'meet-n': { en: 'Here is our playful knight!', te: 'ఇదిగో, మన అల్లరి గుర్రం!' },
    'meet-p': { en: 'Here is our little pawn!', te: 'ఇదిగో, మన చిన్న భటుడు!' },

    /* hello */
    'hello-1': { en: "Hello! Let's have fun and learn chess together.", te: 'హలో! సరదాగా చదరంగం నేర్చుకుందాం.' },
    'hello-2': { en: 'Tap your piece once to see where it can walk with its little footprints!', te: 'నీ పావుని ఒక్కసారి నొక్కు, అది ఎక్కడెక్కడ నడవగలదో అడుగుల గుర్తులు చూపిస్తుంది!' },
    'hello-3': { en: 'Tap a footprint, and off it goes with a skip!', te: 'ఆ అడుగు గుర్తు మీద నొక్కు చాలు, అది హుషారుగా అక్కడికి వెళ్తుంది!' },

    /* rook */
    'rook-1': { en: 'Our rook always moves in straight lines.', te: 'మన ఏనుగు ఎప్పుడూ తిన్నగానే అడుగు వేస్తుంది.' },
    'rook-2': { en: 'It can slide all the way across toward the other side!', te: 'అవతలి వైపు దాకా చక్కగా దూసుకుపోగలదు!' },
    'rook-3': { en: 'Or straight across, just as far.', te: 'లేదా అడ్డంగా కూడా అంతే దూరం సరదాగా వెళ్తుంది.' },

    /* bishop */
    'bishop-1': { en: 'Our bishop always moves on slanty lines.', te: 'మన ఒంటె ఎప్పుడూ వాలుగానే నడుస్తుంది.' },
    'bishop-2': { en: 'It always stays on its own colour, look at that!', te: 'అది ఎప్పుడూ తన సొంత రంగు గడుల మీదే ఉంటుంది, చూశావా!' },
    'bishop-3': { en: 'Watch it slide smoothly the other way!', te: 'చూడు, ఇప్పుడు చక్కగా ఇంకో వైపు జారుతుంది!' },

    /* queen */
    'queen-1': { en: 'Our queen is amazing! She moves like both the rook and the bishop together.', te: 'మన మంత్రి చాలా గొప్పది! ఏనుగు లాగా, ఒంటె లాగా రెండింటిలానూ వెళ్లగలదు.' },
    'queen-2': { en: 'Straight lines, just like the rook.', te: 'ఏనుగు లాగా తిన్నగా వెళ్తుంది.' },
    'queen-3': { en: 'And slanty lines, just like the bishop too!', te: 'అలాగే ఒంటె లాగా వాలుగా కూడా వెళ్తుంది!' },

    /* king */
    'king-1': { en: 'Our king takes just one calm step at a time.', te: 'మన రాజుగారు చాలా ప్రశాంతంగా ఒక్క అడుగు మాత్రమే వేస్తారు.' },
    'king-2': { en: 'But he can step any way he likes with courage!', te: 'కానీ ఏ వైపుకైనా సరే ధైర్యంగా అడుగు వేయగలడు!' },
    'king-3': { en: 'Slow and careful, just like a real king.', te: 'నెమ్మదిగా, చాలా జాగ్రత్తగా, నిజమైన రాజు లాగా!' },

    /* knight */
    'knight-1': { en: 'Our knight moves in a special, bouncy way!', te: 'మన గుర్రం చాలా ప్రత్యేకంగా, చురుగ్గా కదులుతుంది!' },
    'knight-2': { en: 'Two steps, then one to the side.', te: 'రెండు గడులు ముందుకు వేసి, తర్వాత పక్కకి ఒకటి దూకుతుంది.' },
    'knight-3': { en: 'Oh, it can even jump over other pieces!', te: 'అరె! అది వేరే పావుల మీదుగా కూడా సరదాగా దూకగలదు!' },

    /* pawn */
    'pawn-1': { en: 'Our pawn marches like a brave soldier toward the other side.', te: 'మన భటుడు ఒక సైనికుడిలా అవతలి వైపుకి ముందుకు నడుస్తాడు.' },
    'pawn-2': { en: 'Its very first step can be two full steps!', te: 'తన మొదటి అడుగులో మాత్రం రెండు గడులు హుషారుగా వెళ్లగలడు!' },
    'pawn-3': { en: 'After that, always one small step at a time.', te: 'ఆ తర్వాత మాత్రం, ఎప్పుడూ ఒక్కోసారి ఒక్క అడుగే వేస్తాడు.' },

    /* capturing, shared by every capture-<type> lesson */
    'capture-1': { en: 'Oh look, there is a pawn from the other side!', te: 'అయ్యో చూడు, అక్కడ శత్రువు భటుడు ఉన్నాడు!' },
    'capture-2': { en: 'Move onto its space and capture it!', te: 'ఇప్పుడు నువ్వు దాని గడిలోకి వెళ్లి, దాన్ని పట్టుకో!' },
    'capture-3': { en: "Successfully captured! Now it's off the board.", te: 'భలే పట్టేసుకుంది! ఇక ఆ పావు ఆటలో లేదు.' },

    /* pawn capturing, its own special case */
    'pawncap-1': { en: 'Our pawn captures on the slant, one step ahead!', te: 'మన భటుడు ముందు వాలుగా ఉన్న గడిలో శత్రువుని పట్టేసుకుంటాడు!' },
    'pawncap-2': { en: 'But it cannot capture straight ahead, remember!', te: 'అంతే కానీ, తిన్నగా ఎదురుగా ఉన్నదాన్ని మాత్రం పట్టుకోలేడు సుమా!' },

    /* generic practice-flow lines, reused by every lesson, and by the app outside lessons */
    'your-turn': { en: "Now it's your turn to try!", te: 'ఇప్పుడు నీ వంతు, నువ్వు చేసి చూపించు!' },
    'tap-piece': { en: 'Tap your piece.', te: 'నీ పావుని ఒక్కసారి నొక్కు.' },
    'tap-footprint': { en: 'Tap a footprint.', te: 'ఇప్పుడు ఆ అడుగు గుర్తుని నొక్కు.' },
    'great': { en: 'Great job! That was wonderful!', te: 'భలే చేశావు! చాలా చాలా బాగుంది!' },

    /* used outside lessons, by js/app.js */
    'mission': { en: "Let's capture all three pawns!", te: 'సరే, ఇప్పుడు మనం ఈ మూడు భటులనీ పట్టుకోవాలి!' },
    'hint-pawn': { en: 'Follow the footprints all the way to the pawn.', te: 'అడుగుల గుర్తులు చూపించే దారిలోనే భటుడి దగ్గరికి వెళ్ళు.' },
    'won': { en: 'You captured them all!', te: 'అబ్బో, అందరినీ చక్కగా పట్టేసుకున్నావు!' },
    'next': { en: 'Play again, or pick the next piece to explore.', te: 'మళ్ళీ ఆడు, లేదా వేరే కొత్త పావుని ఎంచుకో.' },

    /*
     * Games (stage 3). Team names, said when the child picks a team (see
     * js/themes.js TEAMS for the same names without the "!", used on the
     * team bars). Real group names per theme, never "bot"/"robot".
     */
    'team-robots-a': { en: 'Humanoids!', te: 'మెరుపులు!' },
    'team-robots-b': { en: 'Androids!', te: 'పిడుగులు!' },
    'team-classic-a': { en: 'White!', te: 'తెల్ల పావులు!' },
    'team-classic-b': { en: 'Black!', te: 'నల్ల పావులు!' },
    'team-space-a': { en: 'Astronauts!', te: 'సూర్య జట్టు!' },
    'team-space-b': { en: 'Cosmonauts!', te: 'చంద్ర జట్టు!' },
    'team-dinos-a': { en: 'Theropods!', te: 'కొండ జట్టు!' },
    'team-dinos-b': { en: 'Sauropods!', te: 'అడవి జట్టు!' },
    'team-pirate-a': { en: 'Buccaneers!', te: 'సొరచేపలు!' },
    'team-pirate-b': { en: 'Corsairs!', te: 'తిమింగలాలు!' },
    'pick-team': { en: 'Pick your team!', te: 'నీ జట్టుని ఎంచుకో!' },

    /*
     * Turn-taking. turn-me/turn-foe are said by the player whenever a
     * { turn: 'me' | 'foe' } step (in a watch script or a practice reply)
     * changes whose turn is shown; turns-1..4 are the 'turns' lesson's own
     * watch script narration (see LESSONS below).
     */
    'turn-me': { en: 'Your turn!', te: 'నీ వంతు!' },
    'turn-foe': { en: 'Their turn.', te: 'శత్రువు వంతు.' },
    'turns-1': { en: 'In chess, we take turns.', te: 'చదరంగంలో వంతుల వారీగా ఆడతాం.' },
    'turns-2': { en: 'First your team moves.', te: 'ముందు నీ జట్టు కదులుతుంది.' },
    'turns-3': { en: 'Then their team moves.', te: 'తర్వాత శత్రువు జట్టు కదులుతుంది.' },
    'turns-4': { en: 'Then it is your turn again!', te: 'మళ్ళీ నీ వంతు!' },

    /* the three games' mission lines, said on each game's Mission card */
    'game-catch': { en: 'Catch the knight! It hops away after every move.', te: 'గుర్రాన్ని పట్టుకో! ప్రతి సారీ అది దూకి పారిపోతుంది.' },
    'game-race': { en: 'Pawn race! Get one pawn to the other side first.', te: 'భటుల పందెం! ముందుగా ఒక భటుడిని అవతలి వైపుకి చేర్చు.' },
    'game-battle': { en: 'Capture all their pawns!', te: 'శత్రువు భటులందరినీ పట్టుకో!' },

    /* game event lines */
    'knight-tired': { en: 'The knight is getting tired!', te: 'గుర్రం అలసిపోతోంది!' },
    'caught': { en: 'You caught the knight!', te: 'గుర్రాన్ని పట్టేశావు!' },
    'race-won': { en: 'Your pawn reached the other side!', te: 'నీ భటుడు అవతలి వైపుకి చేరాడు!' },
    'piece-back': { en: 'Your piece is back!', te: 'నీ పావు మళ్ళీ వచ్చింది!' },
    'golden': { en: 'A golden pawn!', te: 'బంగారు భటుడు!' },
    'sticker': { en: 'You got a sticker!', te: 'నీకు ఒక స్టిక్కర్ వచ్చింది!' },
    'break': { en: 'Great playing! Time for a little break?', te: 'బాగా ఆడావు! కొంచెం విశ్రాంతి తీసుకుందామా?' },

    /* profiles (stage 5): said on the Who's playing screen, and shown there as its heading */
    'who': { en: "Who's playing?", te: 'ఎవరు ఆడుతున్నారు?' },

    /* more games (stage 6): the Games screen, two new games, the quiz and the tips after a game */
    'games-pick': { en: 'Pick a game!', te: 'ఒక ఆట ఎంచుకో!' },

    /* check (stage 7): the "check" lesson and the Get out of check game */
    'check-1': { en: 'Check! The rook could capture your king.', te: 'చెక్! ఏనుగు నీ రాజుని పట్టుకోగలదు.' },
    'check-2': { en: 'Move your king out of danger!', te: 'నీ రాజుని ప్రమాదం నుంచి తప్పించు!' },
    'check-3': { en: 'Your king is safe now!', te: 'ఇప్పుడు నీ రాజు క్షేమంగా ఉన్నాడు!' },
    'game-escape': { en: 'Get out of check! Save your king every time.', te: 'చెక్ నుంచి తప్పించుకో! ప్రతిసారీ నీ రాజుని కాపాడు.' },
    'escape-ask': { en: 'Check! Save your king.', te: 'చెక్! నీ రాజుని కాపాడు.' },
    'escape-won': { en: 'You kept your king safe every time!', te: 'ప్రతిసారీ నీ రాజుని కాపాడావు!' },
    'game-run': { en: 'Run away! Stay where the other piece cannot capture you.', te: 'పారిపో! శత్రువు పావు పట్టుకోలేని చోట ఉండు.' },
    'run-danger': { en: 'Not there! It could capture you there.', te: 'అక్కడ వద్దు! అక్కడ అది నిన్ను పట్టుకోగలదు.' },
    'run-won': { en: 'You got away safely!', te: 'సురక్షితంగా తప్పించుకున్నావు!' },
    'tip-run': { en: 'Look at its footprints, and stand where they are not!', te: 'దాని అడుగుల గుర్తులు చూడు, అవి లేని చోట నిలబడు!' },
    'mate-1': { en: 'This king is stuck behind his own pawns.', te: 'ఈ రాజు తన సొంత భటుల వెనక ఇరుక్కుపోయాడు.' },
    'mate-2': { en: 'Slide the rook all the way to the other side!', te: 'ఏనుగుని అవతలి వైపు దాకా దూసుకుపోనివ్వు!' },
    'mate-3': { en: 'Checkmate! The king has nowhere to go.', te: 'చెక్‌మేట్! రాజుకి ఎక్కడికీ వెళ్ళే దారి లేదు.' },
    'game-mate': { en: 'Checkmate in one! Trap the king with one move.', te: 'ఒక్క ఎత్తులో చెక్‌మేట్! ఒకే కదలికతో రాజుని బంధించు.' },
    'mate-ask': { en: 'Find the checkmate!', te: 'చెక్‌మేట్ కనుక్కో!' },
    'mate-nearly': { en: 'Nearly! The king can still escape.', te: 'దాదాపు! రాజు ఇంకా తప్పించుకోగలడు.' },
    'mate-won': { en: 'You found every checkmate!', te: 'అన్ని చెక్‌మేట్లూ కనుక్కున్నావు!' },
    'tip-mate': { en: 'Check the king, and cover every square he could run to!', te: 'రాజుకి చెక్ పెట్టు, అతను పారిపోయే ప్రతి గడినీ కాపు కాయి!' },
    'game-mate2': { en: 'Checkmate in two! Give check first, then checkmate.', te: 'రెండు ఎత్తుల్లో చెక్‌మేట్! ముందు చెక్ పెట్టు, తర్వాత చెక్‌మేట్.' },
    'mate2-ask': { en: 'Give check first!', te: 'ముందు చెక్ పెట్టు!' },
    'mate2-nearly': { en: 'Nearly! Find the check that traps him next move.', te: 'దాదాపు! తర్వాతి ఎత్తులో రాజుని బంధించే చెక్ కనుక్కో.' },
    'mate2-won': { en: 'You found every checkmate in two!', te: 'రెండు ఎత్తుల్లో చెక్‌మేట్లు అన్నీ కనుక్కున్నావు!' },
    'tip-mate2': { en: 'Give check so the king must move. Then checkmate him!', te: 'రాజు కదలక తప్పని చెక్ పెట్టు. తర్వాత చెక్‌మేట్ పెట్టు!' },
    'pond-1': { en: 'Your pawns march toward the other side.', te: 'నీ భటులు అవతలి వైపుకి నడుస్తారు.' },
    'pond-2': { en: 'Their pawns march toward your side!', te: 'శత్రువు భటులు నీ వైపుకి నడుస్తారు!' },
    'pond-3': { en: 'Their footprints point toward your side.', te: 'శత్రువు అడుగుల గుర్తులు నీ వైపుకే ఉంటాయి.' },
    'game-theirs': { en: 'Their footprints! Tap where their piece can go.', te: 'శత్రువు అడుగులు! శత్రువు పావు వెళ్ళగలిగే గడిని నొక్కు.' },
    'theirs-ask': { en: 'Where can their piece go?', te: 'శత్రువు పావు ఎక్కడికి వెళ్ళగలదు?' },
    'theirs-again': { en: 'Look at how it moves, then try again.', te: 'అది ఎలా కదులుతుందో చూడు, మళ్ళీ ప్రయత్నించు.' },
    'theirs-won': { en: 'You can see their moves now!', te: 'ఇప్పుడు శత్రువు ఎత్తులు నీకు కనిపిస్తున్నాయి!' },
    'tip-theirs': { en: 'Their pawns march toward your side, and capture on the slant.', te: 'శత్రువు భటులు నీ వైపుకి నడుస్తారు, వాలుగా పట్టుకుంటారు.' },
    'game-danger': { en: 'Which piece is in danger? Find it, then move it to safety.', te: 'ఏ పావుకి ప్రమాదం? కనుక్కుని, దాన్ని సురక్షిత చోటుకి తీసుకెళ్ళు.' },
    'danger-ask': { en: 'Which of your pieces could they capture?', te: 'శత్రువు నీ ఏ పావుని పట్టుకోగలదు?' },
    'danger-yes': { en: 'Yes! Now move it somewhere safe.', te: 'అవును! ఇప్పుడు దాన్ని సురక్షిత చోటుకి కదుపు.' },
    'danger-safe': { en: 'That one is safe. Try another!', te: 'అది క్షేమంగానే ఉంది. ఇంకోటి చూడు!' },
    'danger-won': { en: 'You kept your pieces safe!', te: 'నీ పావులన్నిటినీ కాపాడావు!' },
    'tip-danger': { en: 'Look at their footprints. Is one of your pieces on them?', te: 'శత్రువు అడుగుల గుర్తులు చూడు. వాటి మీద నీ పావు ఏదైనా ఉందా?' },
    'hands-1': { en: 'Hold up your hands and look at them.', te: 'నీ చేతులు పైకెత్తి చూసుకో.' },
    'hands-2': { en: 'This hand print is your left hand.', te: 'ఈ చేతి ముద్ర నీ ఎడమ చేయి.' },
    'hands-3': { en: 'This one is your right hand.', te: 'ఇది నీ కుడి చేయి.' },
    'hands-4': { en: 'The rook slides toward your left hand.', te: 'ఏనుగు నీ ఎడమ చేయి వైపుకి జారుతుంది.' },
    'game-hands': { en: 'Left or right? Move the way I say!', te: 'ఎడమ, కుడి! నేను చెప్పిన వైపుకి కదుపు!' },
    'hands-left': { en: 'Move to your left!', te: 'నీ ఎడమ వైపుకి కదుపు!' },
    'hands-right': { en: 'Move to your right!', te: 'నీ కుడి వైపుకి కదుపు!' },
    'hands-yes-left': { en: 'Yes! That is your left.', te: 'అవును! అది నీ ఎడమ వైపు.' },
    'hands-yes-right': { en: 'Yes! That is your right.', te: 'అవును! అది నీ కుడి వైపు.' },
    'hands-not-left': { en: 'That way is your right. Try your left!', te: 'అది నీ కుడి వైపు. ఎడమ వైపు ప్రయత్నించు!' },
    'hands-not-right': { en: 'That way is your left. Try your right!', te: 'అది నీ ఎడమ వైపు. కుడి వైపు ప్రయత్నించు!' },
    'hands-won': { en: 'You know your left and right!', te: 'నీకు ఎడమ, కుడి బాగా తెలుసు!' },
    'tip-hands': { en: 'Look at the hand prints: this one is left, that one is right.', te: 'చేతి ముద్రలు చూడు: ఇది ఎడమ, అది కుడి.' },
    'tip-escape': { en: 'Step away, block the line, or capture the attacker!', te: 'పక్కకి తప్పుకో, దారికి అడ్డం పెట్టు, లేదా దాడి చేసే పావుని పట్టుకో!' },
    'game-chain': { en: 'Capture chain! Capture every pawn, one after another.', te: 'గొలుసు ఆట! శత్రువు భటులను ఒకరి తర్వాత ఒకరిని పట్టుకో!' },
    'game-whose': { en: 'Whose footprints? Tap the piece that made them!', te: 'ఎవరి అడుగులు? ఆ అడుగులు వేసిన పావుని నొక్కు!' },
    'quiz-ask': { en: 'Whose footprints are these?', te: 'ఈ అడుగుల గుర్తులు ఎవరివి?' },
    'quiz-again': { en: 'Its footprints look different. Try again!', te: 'దాని అడుగులు వేరేలా ఉంటాయి. మళ్ళీ చూడు!' },
    'quiz-won': { en: 'You know your pieces so well!', te: 'నీకు పావులన్నీ బాగా తెలుసు!' },
    'tip-look': { en: 'Here is a little tip!', te: 'ఇదిగో, ఒక చిన్న చిట్కా!' },
    'how-look': { en: 'Watch how to play!', te: 'ఎలా ఆడాలో చూడు!' },
    'how-catch-1': { en: 'The knight can hop to these squares.', te: 'గుర్రం ఈ గడులకి దూకగలదు.' },
    'how-catch-2': { en: 'Stand where your footprints cover its hops.', te: 'దాని దూకే గడుల మీద నీ అడుగుల గుర్తులు పడేలా నిలబడు.' },
    'how-catch-3': { en: 'It landed on your footprints. Capture it!', te: 'అది నీ అడుగుల గుర్తు మీద దిగింది. పట్టుకో!' },
    'tip-race': { en: "A pawn's first step can be two squares. Zoom ahead!", te: 'భటుడి మొదటి అడుగు రెండు గడులు కావచ్చు. ముందుకు దూసుకుపో!' },
    'tip-battle': { en: 'Use all your pieces. Each one moves its own way!', te: 'నీ పావులన్నిటినీ వాడు. ఒక్కొక్కటి ఒక్కోలా కదులుతుంది!' },
    'tip-chain': { en: 'Before you capture, look for the next pawn!', te: 'పట్టుకునే ముందు, తర్వాతి భటుడు ఎక్కడున్నాడో చూడు!' },
    'tip-whose': { en: 'Straight lines, the rook. Slanty lines, the bishop. Both, the queen!', te: 'తిన్నగా అయితే ఏనుగు. వాలుగా అయితే ఒంటె. రెండూ అయితే మంత్రి!' },
    'game-hop': { en: 'Knight hop! Hop your knight to the other side.', te: 'గుర్రం గెంతులు! నీ గుర్రాన్ని అవతలి వైపుకి దూకించు.' },
    'game-way': { en: 'Find the way! Get your piece to the other side.', te: 'దారి వెతుకు! నీ పావుని అవతలి వైపుకి చేర్చు.' },
    'game-stop': { en: 'Stop the pawns! Capture them as they march toward you.', te: 'శత్రువు భటులను ఆపు! అవి నీ వైపు నడిచి వస్తుంటే పట్టుకో.' },
    'game-safe': { en: 'Keep the king safe! Walk him to the other side.', te: 'రాజుని కాపాడు! అతన్ని అవతలి వైపుకి నడిపించు.' },
    'reach-won': { en: 'You reached the other side!', te: 'అవతలి వైపుకి చేరుకున్నావు!' },
    'king-danger': { en: 'Not there! That square is not safe for the king.', te: 'అక్కడ వద్దు! ఆ గడిలో రాజుకి ప్రమాదం.' },
    'tip-hop': { en: 'Pick the footprints closest to the other side!', te: 'అవతలి వైపుకి దగ్గరగా ఉన్న అడుగు గుర్తుని ఎంచుకో!' },
    'tip-way': { en: 'Your own pieces block the way. Go around them!', te: 'నీ పావులే దారికి అడ్డం. వాటి చుట్టూ తిరిగి వెళ్ళు!' },
    'tip-stop': { en: 'A pawn cannot walk through you. Stand in front of it!', te: 'శత్రువు భటుడు నిన్ను దాటి నడవలేడు. అతని ముందు నిలబడు!' },
    'tip-safe': { en: 'The king never steps where the other side could capture him.', te: 'శత్రువు పట్టుకోగలిగే గడిలోకి రాజు ఎప్పుడూ అడుగు పెట్టడు.' },

    /* the growing battle (stage 8), js/army.js */
    'game-army1': { en: 'Pawn battle! Get one of your pawns to the other side.', te: 'భటుల యుద్ధం! నీ భటుల్లో ఒకరిని అవతలి వైపుకి చేర్చు.' },
    'game-army2': { en: 'Pawns and rooks! Capture all their pawns, or reach the other side.', te: 'భటులు, ఏనుగులు! శత్రువు భటులందరినీ పట్టుకో, లేదా అవతలి వైపుకి చేరు.' },
    'game-army3': { en: 'Pawns, rooks and bishops! Capture all their pawns, or reach the other side.', te: 'భటులు, ఏనుగులు, ఒంటెలు! శత్రువు భటులందరినీ పట్టుకో, లేదా అవతలి వైపుకి చేరు.' },
    'army-won': { en: 'You won the battle!', te: 'యుద్ధంలో నువ్వు గెలిచావు!' },
    'army-danger': { en: 'Careful! One of your pieces could be captured.', te: 'జాగ్రత్త! శత్రువు నీ పావుల్లో ఒకదాన్ని పట్టుకోగలదు.' },
    'tip-army1': { en: 'Pawns keep each other safe. If one is captured, the other captures back!', te: 'భటులు ఒకరినొకరు కాపాడుకుంటారు. ఒకరిని పట్టుకుంటే, ఇంకొకరు తిరిగి పట్టుకుంటారు!' },
    'tip-army2': { en: 'Find a pawn that nobody protects, and capture it with your rook!', te: 'ఎవరూ కాపు కాయని భటుడిని వెతికి, నీ ఏనుగుతో పట్టుకో!' },
    'tip-army3': { en: 'Your bishop is stuck behind the pawns. Move a pawn, and out it comes!', te: 'నీ ఒంటె భటుల వెనక ఇరుక్కుపోయింది. ఒక భటుడిని కదుపు, అది బయటకు వస్తుంది!' },
    'game-army4': { en: 'Knights join in! Capture all their pawns, or reach the other side.', te: 'గుర్రాలు కూడా వచ్చాయి! శత్రువు భటులందరినీ పట్టుకో, లేదా అవతలి వైపుకి చేరు.' },
    'game-army5': { en: 'The queens join in! Capture all their pawns, or reach the other side.', te: 'మంత్రులు కూడా వచ్చారు! శత్రువు భటులందరినీ పట్టుకో, లేదా అవతలి వైపుకి చేరు.' },
    'game-army6': { en: 'The whole army, kings too! Checkmate their king to win.', te: 'మొత్తం సైన్యం, రాజులతో సహా! శత్రువు రాజుకి చెక్‌మేట్ పెట్టి గెలువు.' },
    'army-mate-won': { en: 'Checkmate! You won the whole battle!', te: 'చెక్‌మేట్! మొత్తం యుద్ధం నువ్వే గెలిచావు!' },
    'army-check': { en: 'Check! Their king must get out of check.', te: 'చెక్! శత్రువు రాజు చెక్ నుంచి తప్పించుకోవాలి.' },
    'army-queen': { en: 'Your pawn reached the other side. Now it is a queen!', te: 'నీ భటుడు అవతలి వైపుకి చేరాడు. ఇప్పుడు అతను మంత్రి!' },
    'army-draw': { en: 'Stalemate! Their king cannot move, but nobody wins this time.', te: 'స్టేల్‌మేట్! శత్రువు రాజు కదలలేడు, కానీ ఈసారి ఎవరూ గెలవలేదు.' },
    'tip-army4': { en: 'Knights jump over pieces. One knight can attack two pieces at once!', te: 'గుర్రాలు పావుల మీదుగా దూకుతాయి. ఒక్క గుర్రం ఒకేసారి రెండు పావుల మీద దాడి చేయగలదు!' },
    'tip-army5': { en: 'Your queen is strong. Never let her be captured for a pawn!', te: 'నీ మంత్రి చాలా బలమైనది. ఒక భటుడి కోసం ఆమెని పోగొట్టుకోకు!' },
    'tip-army6': { en: 'Keep your king safe, and trap theirs!', te: 'నీ రాజుని కాపాడుకో, శత్రువు రాజుని బంధించు!' },
    'army-how-1': { en: 'Check! Their bishop could capture your king.', te: 'చెక్! శత్రువు ఒంటె నీ రాజుని పట్టుకోగలదు.' },
    'army-how-2': { en: 'Your pawn steps in the way. Your king is safe again.', te: 'నీ భటుడు దారికి అడ్డం వచ్చాడు. నీ రాజు మళ్ళీ క్షేమం.' },
    'army-how-3': { en: 'Now your queen and rook work together to trap their king.', te: 'ఇప్పుడు నీ మంత్రి, ఏనుగు కలిసి శత్రువు రాజుని బంధిస్తాయి.' },
    'game-army7': { en: 'The full game! Every rule of chess. Checkmate their king to win.', te: 'పూర్తి ఆట! చదరంగంలోని ప్రతి నియమం. శత్రువు రాజుకి చెక్‌మేట్ పెట్టి గెలువు.' },
    'tip-army7': { en: 'Castling: the king steps two squares, and the rook jumps beside him!', te: 'క్యాస్లింగ్: రాజు రెండు గడులు కదులుతాడు, ఏనుగు అతని పక్కకి దూకుతుంది!' },
    'army-castle': { en: 'Castling! The king and rook moved together.', te: 'క్యాస్లింగ్! రాజు, ఏనుగు కలిసి కదిలారు.' },
    'army-passant': { en: 'En passant! A pawn captured the pawn that rushed past it.', te: 'ఆన్ పసాంట్! పక్క నుంచి దూసుకెళ్ళిన భటుడిని ఇంకో భటుడు పట్టుకున్నాడు.' },
    'army-foe-queen': { en: 'Their pawn reached your side. Now it is a queen!', te: 'శత్రువు భటుడు నీ వైపుకి చేరాడు. ఇప్పుడు అది మంత్రి!' },
    'army-draw-kings': { en: 'Only the two kings remain. Nobody wins this time.', te: 'ఇద్దరు రాజులే మిగిలారు. ఈసారి ఎవరూ గెలవలేదు.' },
    'army-undo': { en: 'Taken back. Try another move!', te: 'వెనక్కి తీసుకున్నాం. ఇంకో ఎత్తు వేసి చూడు!' }
  };

  /*
   * Estimated spoken length in ms (not a recording length): used to pace
   * the watch script before real recordings exist, and as a guard timer
   * once they do. texts maps a language id to that language's text. Each
   * language has its own rate (the registry's msPerChar: about 60ms per
   * English character, 75ms per Telugu character, which is usually longer
   * spoken); the line uses whichever estimate is longest, with a minimum of
   * 1100ms. Shared by every language, since it only paces the animation.
   */
  function estimateLineMs(texts) {
    var ms = 1100;
    LANGS.forEach(function (lang) {
      var text = texts[lang];
      if (typeof text !== 'string') return;
      ms = Math.max(ms, Math.round(text.length * Ls.get(lang).msPerChar));
    });
    return ms;
  }

  var LINES = {};
  Object.keys(RAW_LINES).forEach(function (id) {
    var line = RAW_LINES[id];
    var entry = {};
    LANGS.forEach(function (lang) { entry[lang] = line[lang]; });
    entry.ms = estimateLineMs(entry);
    LINES[id] = entry;
  });

  var PRACTICE_LINES = ['your-turn', 'tap-piece', 'tap-footprint', 'great'];

  /*
   * Ids of lines the app speaks outside of a lesson's watch script (home
   * screen, meet card, mission card, round idle hints, won card). Kept
   * here, next to LINES, so tests/lessons.test.js can confirm every line
   * in LINES is said by something - a lesson's watch script, a practice
   * task, or the app itself.
   */
  var APP_LINES = [
    'pick', 'meet-r', 'meet-b', 'meet-q', 'meet-k', 'meet-n', 'meet-p',
    'mission', 'hint-pawn', 'won', 'next', 'tap-piece', 'tap-footprint'
  ];

  /*
   * Games (stage 3): ids of lines said by js/app.js / js/player.js outside
   * of any lesson's watch script - team picking, the turn-indicator lines
   * (said whenever a { turn: 'me' | 'foe' } step fires, in a watch script
   * or a practice reply), each game's mission line, and game events. Kept
   * separate from APP_LINES so a reviewer can see at a glance which lines
   * are stage-2 (lessons/rounds) versus stage-3 (games). Included in
   * tests/lessons.test.js's line-coverage test alongside APP_LINES.
   */
  var GAME_LINES = [
    'team-robots-a', 'team-robots-b',
    'team-classic-a', 'team-classic-b',
    'team-space-a', 'team-space-b',
    'team-dinos-a', 'team-dinos-b',
    'team-pirate-a', 'team-pirate-b',
    'pick-team', 'turn-me', 'turn-foe',
    'game-catch', 'game-race', 'game-battle',
    'knight-tired', 'caught', 'race-won', 'piece-back',
    'golden', 'sticker', 'break'
  ];

  /*
   * Profiles (stage 5): ids of lines said by js/app.js outside of any
   * lesson - the Who's playing screen's prompt, which is also that screen's
   * heading text. Included in tests/lessons.test.js's line-coverage test.
   */
  var PROFILE_LINES = ['who'];

  /*
   * More games (stage 6): ids of lines said by js/games-ui.js - the Games
   * screen's prompt, the new games' mission lines, the quiz, and the tips
   * after a game (js/game-list.js names which tip belongs to which game).
   * Included in tests/lessons.test.js's line-coverage test.
   */
  var MORE_GAME_LINES = [
    'games-pick', 'game-chain', 'game-whose',
    'quiz-ask', 'quiz-again', 'quiz-won',
    'tip-look', 'how-look', 'how-catch-1', 'how-catch-2', 'how-catch-3', 'tip-race', 'tip-battle', 'tip-chain', 'tip-whose',
    'game-hop', 'game-way', 'game-stop', 'game-safe', 'reach-won', 'king-danger',
    'tip-hop', 'tip-way', 'tip-stop', 'tip-safe',
    'game-escape', 'escape-ask', 'escape-won', 'tip-escape',
    'game-run', 'run-danger', 'run-won', 'tip-run',
    'game-mate', 'mate-ask', 'mate-nearly', 'mate-won', 'tip-mate',
    'game-mate2', 'mate2-ask', 'mate2-nearly', 'mate2-won', 'tip-mate2',
    'game-theirs', 'theirs-ask', 'theirs-again', 'theirs-won', 'tip-theirs',
    'game-danger', 'danger-ask', 'danger-yes', 'danger-safe', 'danger-won', 'tip-danger',
    'game-hands', 'hands-left', 'hands-right', 'hands-yes-left', 'hands-yes-right',
    'hands-not-left', 'hands-not-right', 'hands-won', 'tip-hands'
  ];

  /*
   * The growing battle (stage 8): ids of lines said by js/games-ui.js for
   * the whole-army battles (js/army.js). Included in tests/lessons.test.js's
   * line-coverage test.
   */
  var ARMY_LINES = [
    'game-army1', 'game-army2', 'game-army3', 'army-won', 'army-danger',
    'tip-army1', 'tip-army2', 'tip-army3',
    'game-army4', 'game-army5', 'game-army6', 'army-mate-won', 'army-check', 'army-queen', 'army-draw',
    'tip-army4', 'tip-army5', 'tip-army6', 'army-how-1', 'army-how-2', 'army-how-3',
    'game-army7', 'tip-army7', 'army-castle', 'army-passant', 'army-foe-queen', 'army-draw-kings', 'army-undo'
  ];

  /*
   * Hand-print levels (stage 7): the only lines that may say left or right
   * (ఎడమ, కుడి). Every other line keeps the "never left or right" rule
   * (tests/lessons.test.js).
   */
  var HAND_LINES = [
    'hands-1', 'hands-2', 'hands-3', 'hands-4',
    'game-hands', 'hands-left', 'hands-right', 'hands-yes-left', 'hands-yes-right',
    'hands-not-left', 'hands-not-right', 'hands-won', 'tip-hands'
  ];

  var LESSONS = [
    {
      id: 'hello',
      type: 'r',
      title: 'Say hello',
      setup: { hero: [7, 4], foes: [] },
      watch: [
        { wait: 600 },
        { say: 'hello-1' },
        { waitVoice: true },
        { wait: 300 },
        { say: 'hello-2' },
        { hand: [7, 4] },
        { select: true },
        { waitVoice: true },
        { wait: 400 },
        { say: 'hello-3' },
        { hand: [5, 4] },
        { move: [5, 4] },
        { waitVoice: true },
        { select: true },
        { hand: [5, 1] },
        { move: [5, 1] },
        { wait: 600 },
        { reset: true }
      ],
      practice: [
        { to: [5, 4], accept: 'any' }
      ]
    },
    {
      id: 'rook',
      type: 'r',
      title: 'Rook',
      setup: { hero: [7, 1], foes: [] },
      watch: [
        { say: 'rook-1' },
        { waitVoice: true },
        { select: true },
        { say: 'rook-2' },
        { landmark: 'far' },
        { waitVoice: true },
        { hand: [1, 1] },
        { move: [1, 1] },
        { wait: 300 },
        { reset: true },
        { select: true },
        { say: 'rook-3' },
        { waitVoice: true },
        { hand: [7, 6] },
        { move: [7, 6] }
      ],
      practice: [
        { to: [1, 1], accept: 'any' }
      ]
    },
    {
      id: 'bishop',
      type: 'b',
      title: 'Bishop',
      setup: { hero: [7, 2], foes: [] },
      watch: [
        { say: 'bishop-1' },
        { waitVoice: true },
        { select: true },
        { glow: [[6, 3], [5, 4], [4, 5], [3, 6], [2, 7], [6, 1], [5, 0]] },
        { say: 'bishop-2' },
        { waitVoice: true },
        { hand: [4, 5] },
        { move: [4, 5] },
        { wait: 300 },
        { reset: true },
        { select: true },
        { say: 'bishop-3' },
        { waitVoice: true },
        { hand: [5, 0] },
        { move: [5, 0] }
      ],
      practice: [
        { to: [4, 5], accept: 'any' }
      ]
    },
    {
      id: 'queen',
      type: 'q',
      title: 'Queen',
      setup: { hero: [7, 3], foes: [] },
      watch: [
        { say: 'queen-1' },
        { waitVoice: true },
        { select: true },
        { say: 'queen-2' },
        { waitVoice: true },
        { hand: [2, 3] },
        { move: [2, 3] },
        { wait: 300 },
        { reset: true },
        { select: true },
        { say: 'queen-3' },
        { waitVoice: true },
        { hand: [4, 0] },
        { move: [4, 0] }
      ],
      practice: [
        { to: [2, 3], accept: 'any' },
        { to: [4, 1], accept: 'any' }
      ]
    },
    {
      id: 'king',
      type: 'k',
      title: 'King',
      setup: { hero: [7, 4], foes: [] },
      watch: [
        { say: 'king-1' },
        { waitVoice: true },
        { select: true },
        { hand: [6, 4] },
        { move: [6, 4] },
        { wait: 300 },
        { reset: true },
        { say: 'king-2' },
        { waitVoice: true },
        { select: true },
        { hand: [6, 5] },
        { move: [6, 5] },
        { say: 'king-3' },
        { waitVoice: true }
      ],
      practice: [
        { to: [6, 4], accept: 'any' }
      ]
    },
    {
      id: 'knight',
      type: 'n',
      title: 'Knight',
      setup: { hero: [7, 1], foes: [[6, 1]] },
      watch: [
        { say: 'knight-1' },
        { waitVoice: true },
        { select: true },
        { wait: 400 },
        { say: 'knight-2' },
        { hand: [5, 2] },
        { move: [5, 2] },
        { waitVoice: true },
        { wait: 300 },
        { reset: true },
        { select: true },
        { say: 'knight-3' },
        { waitVoice: true },
        { hand: [5, 0] },
        { move: [5, 0] }
      ],
      practice: [
        { to: [5, 2], accept: 'any' }
      ]
    },
    {
      id: 'pawn',
      type: 'p',
      title: 'Pawn',
      setup: { hero: [6, 3], foes: [] },
      watch: [
        { say: 'pawn-1' },
        { waitVoice: true },
        { select: true },
        { landmark: 'far' },
        { say: 'pawn-2' },
        { waitVoice: true },
        { hand: [4, 3] },
        { move: [4, 3] },
        { wait: 300 },
        { say: 'pawn-3' },
        { waitVoice: true },
        { select: true },
        { hand: [3, 3] },
        { move: [3, 3] }
      ],
      practice: [
        { to: [4, 3], accept: 'any' },
        { to: [3, 3], accept: 'any' }
      ]
    }
  ];

  /*
   * capture-<type> lessons: the hero starts a single legal move away from
   * a foe pawn, and the watch script narrates capturing it, once. Every
   * lesson built from this template shares the same three voice lines, so
   * they all take the same time to watch (js/app.js shows one of them per
   * child: the idea is the same for every piece, so a later piece goes
   * straight to its Mission card). The capture is shown once, not repeated:
   * the practice task asks the child for it next.
   */
  var CAPTURE_POSITIONS = {
    r: { hero: [7, 3], foe: [4, 3] },
    b: { hero: [7, 2], foe: [4, 5] },
    q: { hero: [7, 3], foe: [4, 6] },
    k: { hero: [7, 4], foe: [6, 4] },
    n: { hero: [7, 1], foe: [5, 2] }
  };
  function makeCaptureLesson(type, hero, foe) {
    return {
      id: 'capture-' + type,
      type: type,
      title: 'Capture: ' + PIECE_NAMES[DEFAULT_LANG][type],
      setup: { hero: hero, foes: [foe] },
      watch: [
        { wait: 500 },
        { say: 'capture-1' },
        { glow: [foe] },
        { waitVoice: true },
        { select: true },
        { say: 'capture-2' },
        { hand: foe },
        { move: foe },
        { waitVoice: true },
        { say: 'capture-3' },
        { waitVoice: true },
        { wait: 400 },
        { reset: true }
      ],
      practice: [
        { to: foe, accept: 'only' }
      ]
    };
  }

  TYPE_ORDER.filter(function (t) { return t !== 'p'; }).forEach(function (type) {
    var pos = CAPTURE_POSITIONS[type];
    LESSONS.push(makeCaptureLesson(type, pos.hero, pos.foe));
  });

  LESSONS.push({
    id: 'pawn-capture',
    type: 'p',
    title: 'Pawn capture',
    setup: { hero: [6, 3], foes: [[5, 3], [5, 4]] },
    watch: [
      { say: 'pawncap-1' },
      { select: true },
      { glow: [[5, 2], [5, 4]] },
      { waitVoice: true },
      { say: 'pawncap-2' },
      { glow: [[5, 3]] },
      { waitVoice: true },
      { glow: [] },
      { hand: [5, 4] },
      { move: [5, 4] },
      { say: 'capture-3' },
      { waitVoice: true },
      { wait: 400 },
      { reset: true }
    ],
    practice: [
      { to: [5, 4], accept: 'only' }
    ]
  });

  /*
   * Taking turns (stage 3): teaches turn-taking before the child meets any
   * game. Two new step types, a contract with js/player.js:
   *   { turn: 'me' | 'foe' } sets whose turn is shown (team bars + mode
   *     badge; the player says turn-me/turn-foe when this fires, in a
   *     watch script or a practice reply - see GAME_LINES above).
   *   { foeMove: [[fr, fc], [tr, tc]] } moves an opponent piece with its
   *     own animation (must be legal for team foe; never a capture in this
   *     lesson - the foe pawn never lands on the hero).
   * Practice tasks gain an optional `reply`: [[fr, fc], [tr, tc]], a foe
   * move the player plays right after the child completes that task (foe
   * turn shown, then control returns to the child). The reply on the first
   * task is chosen to be legal no matter which of the hero pawn's two
   * legal first moves (one or two squares) the child taps, since
   * accept: 'any' lets either complete the task.
   */
  LESSONS.push({
    id: 'turns',
    type: 'p',
    title: 'Taking turns',
    setup: { hero: [6, 3], foes: [[1, 4]] },
    watch: [
      { wait: 1000 },
      { say: 'turns-1' },
      { waitVoice: true },
      { turn: 'me' },
      { wait: 800 },
      { say: 'turns-2' },
      { hand: [4, 3] },
      { move: [4, 3] },
      { waitVoice: true },
      { turn: 'foe' },
      { wait: 800 },
      { say: 'turns-3' },
      { foeMove: [[1, 4], [3, 4]] },
      { waitVoice: true },
      { turn: 'me' },
      { say: 'turns-4' },
      { waitVoice: true },
      { wait: 1000 },
      { reset: true }
    ],
    practice: [
      { to: [5, 3], accept: 'any', reply: [[1, 4], [2, 4]] },
      { to: [4, 3], accept: 'any' }
    ]
  });

  /*
   * Check (stage 7): the king is in check from a rook on his line; the line
   * glows red ({ glow, color: 'danger' }), he steps out of it. Played
   * before the "Get out of check" game, the first time (js/game-list.js
   * `lesson`). Footprints in lessons only ever show legal moves
   * (FC.rules.legalMoves), so the king never offers a square in check.
   */
  LESSONS.push({
    id: 'check',
    type: 'k',
    title: 'Check',
    setup: { hero: [7, 4], foes: [{ at: [3, 4], type: 'r' }] },
    watch: [
      { wait: 600 },
      { glow: [[4, 4], [5, 4], [6, 4]], color: 'danger' },
      { say: 'check-1' },
      { waitVoice: true },
      { select: true },
      { say: 'check-2' },
      { hand: [6, 5] },
      { move: [6, 5] },
      { glow: [] },
      { waitVoice: true },
      { say: 'check-3' },
      { waitVoice: true },
      { wait: 400 },
      { reset: true }
    ],
    practice: [
      { to: [6, 5], accept: 'any' }
    ]
  });

  /*
   * Checkmate (stage 7): an opponent king stuck behind his own pawns; the
   * rook slides to the far row and his last squares glow red. Played
   * before the child's first Checkmate in one game.
   */
  LESSONS.push({
    id: 'checkmate',
    type: 'r',
    title: 'Checkmate',
    setup: { hero: [7, 0], foes: [{ at: [0, 6], type: 'k' }, [1, 5], [1, 6], [1, 7]] },
    watch: [
      { wait: 600 },
      { say: 'mate-1' },
      { glow: [[1, 5], [1, 6], [1, 7]] },
      { waitVoice: true },
      { glow: [] },
      { select: true },
      { say: 'mate-2' },
      { hand: [0, 0] },
      { move: [0, 0] },
      { waitVoice: true },
      { glow: [[0, 5], [0, 6], [0, 7]], color: 'danger' },
      { say: 'mate-3' },
      { waitVoice: true },
      { wait: 400 },
      { reset: true }
    ],
    practice: [
      { to: [0, 0], accept: 'only' }
    ]
  });

  /*
   * Their side (stage 7, Mirror Pond): the child's pawn marches up, the
   * opponent's pawn marches down, and its footprints show pointing toward
   * the child's side ({ foePrints: [r, c] }, a step js/player.js draws in
   * the other side's dark colour). Played before the first of the Mirror
   * Pond games (js/game-list.js).
   */
  LESSONS.push({
    id: 'theirside',
    type: 'p',
    title: 'Their side',
    setup: { hero: [6, 3], foes: [[1, 4]] },
    watch: [
      { wait: 600 },
      { say: 'pond-1' },
      { select: true },
      { hand: [5, 3] },
      { move: [5, 3] },
      { waitVoice: true },
      { foeMove: [[1, 4], [2, 4]] },
      { say: 'pond-2' },
      { waitVoice: true },
      { foePrints: [2, 4] },
      { say: 'pond-3' },
      { waitVoice: true },
      { wait: 600 },
      { reset: true }
    ],
    practice: [
      { to: [5, 3], accept: 'any' }
    ]
  });

  /*
   * Your hands (stage 7): the hand prints at the two ends of the child's
   * strip glow in turn ({ handPrint: 'left' | 'right' }, drawn by
   * js/board.js), then the rook slides toward the left hand. Played before
   * the child's first Left or right? game.
   */
  LESSONS.push({
    id: 'yourhands',
    type: 'r',
    title: 'Your hands',
    setup: { hero: [4, 4], foes: [] },
    watch: [
      { wait: 600 },
      { say: 'hands-1' },
      { waitVoice: true },
      { handPrint: 'left' },
      { say: 'hands-2' },
      { waitVoice: true },
      { handPrint: 'right' },
      { say: 'hands-3' },
      { waitVoice: true },
      { select: true },
      { say: 'hands-4' },
      { handPrint: 'left' },
      { hand: [4, 1] },
      { move: [4, 1] },
      { waitVoice: true },
      { wait: 400 },
      { reset: true }
    ],
    practice: [
      { to: [4, 1], accept: 'only' }
    ]
  });

  var STEP_MS = { hand: 900, move: 700, select: 300, unselect: 300, reset: 300, foeMove: 700 };

  function get(id) {
    for (var i = 0; i < LESSONS.length; i++) {
      if (LESSONS[i].id === id) return LESSONS[i];
    }
    return null;
  }

  /* A lesson's opponent pieces as [{ at: [r, c], type }]. A setup lists
   * each as [r, c] (a pawn) or { at: [r, c], type } (any piece; the
   * "check" lesson's rook). */
  function foesOf(lesson) {
    return (lesson.setup.foes || []).map(function (f) {
      return Array.isArray(f) ? { at: f, type: 'p' } : { at: f.at, type: f.type };
    });
  }

  /* Fresh { board, hero } built from a lesson's setup, for FC.rules. */
  function boardFor(lesson) {
    var board = R.emptyBoard();
    var hero = lesson.setup.hero;
    board[hero[0]][hero[1]] = { type: lesson.type, team: 'me' };
    foesOf(lesson).forEach(function (f) {
      board[f.at[0]][f.at[1]] = { type: f.type, team: 'foe' };
    });
    return { board: board, hero: hero.slice() };
  }

  /*
   * Simulated watch duration in ms: t is "wall clock" time, voiceEnd is when
   * the most recently started line finishes. say sets voiceEnd but does not
   * itself advance t (voice plays while other things happen); waitVoice
   * catches t up to voiceEnd. Everything else has a fixed cost.
   */
  function estimateWatchMs(lesson) {
    var t = 0;
    var voiceEnd = 0;
    lesson.watch.forEach(function (step) {
      if (step.say) {
        var line = LINES[step.say];
        voiceEnd = t + (line ? line.ms : 0);
      } else if (step.waitVoice) {
        t = Math.max(t, voiceEnd);
      } else if (typeof step.wait === 'number') {
        t += step.wait;
      } else if (step.hand) {
        t += STEP_MS.hand;
      } else if (step.move) {
        t += STEP_MS.move;
      } else if (step.select) {
        t += STEP_MS.select;
      } else if (step.unselect) {
        t += STEP_MS.unselect;
      } else if (step.reset) {
        t += STEP_MS.reset;
      } else if (step.foeMove) {
        t += STEP_MS.foeMove;
      }
      // handAway, glow, landmark and turn steps have no time cost.
    });
    return Math.max(t, voiceEnd);
  }

  /*
   * [r, c]: preferred if it is a legal move for the hero, else a legal
   * capture, else the legal move closest to row 0 (the far edge). Ties are
   * broken by column so the result is deterministic.
   */
  function suggestMove(board, hero, preferred) {
    var moves = R.legalMoves(board, hero[0], hero[1]);
    if (!moves.length) return null;
    if (preferred) {
      for (var i = 0; i < moves.length; i++) {
        if (moves[i].r === preferred[0] && moves[i].c === preferred[1]) {
          return [preferred[0], preferred[1]];
        }
      }
    }
    var sorted = moves.slice().sort(function (a, b) {
      return a.r - b.r || a.c - b.c;
    });
    var captures = sorted.filter(function (m) { return m.capture; });
    var pick = captures.length ? captures[0] : sorted[0];
    return [pick.r, pick.c];
  }

  /* Ids of the voice lines a lesson's watch script says, in first-use order. */
  function lineIds(lesson) {
    var ids = [];
    lesson.watch.forEach(function (step) {
      if (step.say && ids.indexOf(step.say) === -1) ids.push(step.say);
    });
    return ids;
  }

  /* 'rook' | 'bishop' | 'queen' | 'king' | 'knight' | 'pawn', the id of a type's introductory lesson. */
  var LESSON_FOR = { r: 'rook', b: 'bishop', q: 'queen', k: 'king', n: 'knight', p: 'pawn' };
  function lessonFor(type) {
    return LESSON_FOR[type] || null;
  }

  /* 'capture-<type>', or 'pawn-capture' for the pawn, the id of a type's capturing lesson. */
  function captureLessonFor(type) {
    return type === 'p' ? 'pawn-capture' : 'capture-' + type;
  }

  // Badge labels for who is in control (see FC.board.setMode).
  var UI_TEXT = {
    watch: { en: 'Watch', te: 'చూడు' },
    turn: { en: 'Your turn!', te: 'నీ వంతు!' }
  };

  var api = {
    UI_TEXT: UI_TEXT,
    LANGS: LANGS,
    DEFAULT_LANG: DEFAULT_LANG,
    PIECE_NAMES: PIECE_NAMES,
    TYPE_ORDER: TYPE_ORDER,
    LINES: LINES,
    PRACTICE_LINES: PRACTICE_LINES,
    APP_LINES: APP_LINES,
    GAME_LINES: GAME_LINES,
    PROFILE_LINES: PROFILE_LINES,
    MORE_GAME_LINES: MORE_GAME_LINES,
    HAND_LINES: HAND_LINES,
    ARMY_LINES: ARMY_LINES,
    LESSONS: LESSONS,
    get: get,
    boardFor: boardFor,
    foesOf: foesOf,
    estimateWatchMs: estimateWatchMs,
    suggestMove: suggestMove,
    lineIds: lineIds,
    lessonFor: lessonFor,
    captureLessonFor: captureLessonFor
  };

  if (isNode) {
    module.exports = api;
  } else {
    root.FC = root.FC || {};
    root.FC.lessons = api;
  }
})(this);
