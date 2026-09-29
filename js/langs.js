/*
 * Footprint Chess: the language registry (stage 5, part A1).
 *
 * The one place that lists the languages the app speaks. Everything that
 * depends on the set of languages (js/lessons.js text tables, js/voice.js,
 * the language button in js/app.js, the team names, the device check page,
 * tools/make-voice.js and the tests) reads this list instead of naming a
 * language itself, so adding a language is a data change (see
 * docs/LANGUAGES.md). No DOM.
 *
 * Fields of a LANGUAGES entry:
 *   id          short id, also the ?lang= value and the audio/voice/<id>/ folder.
 *   name        English name of the language; the button's aria-label only.
 *   nativeName  the language's own name for itself.
 *   glyph       one character the language button and language row show.
 *   speech      BCP-47 prefix used to pick a device speech voice.
 *   fallback    the next language to try for a line with no clip and no device
 *               speech in this one, or null. A chain that always ends at
 *               DEFAULT_LANG (see fallbackChain); the default language itself
 *               never falls back to another language.
 *   script      optional test hint: every text in this language must contain
 *               this script (tests/lessons.test.js), or null.
 *   msPerChar   milliseconds of speech per character, used by js/lessons.js to
 *               estimate how long a line takes (pacing only).
 *   azureVoice  Azure neural voice name used by tools/make-voice.js; its first
 *               two dash-separated parts are the SSML xml:lang.
 *   voicePrefs  optional device-voice preferences (js/voice.js pickVoice):
 *               { preferNames: [RegExp, ...] in order, avoidNames: RegExp,
 *               preferRegions: [lowercase lang tags, ...] }, or null.
 *   turnOf(name, ofForm)  the mode badge text "<team>'s turn" for this
 *               language; ofForm is the team's optional possessive form (see
 *               js/themes.js TEAMS).
 *
 * Classic script: exposes window.FC.langs in the browser and module.exports
 * in Node, like js/themes.js. Keep to ES2017 syntax (see README, "Browser
 * support and coding rules").
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;

  /*
   * English is the default (the owner's decision); Telugu is the
   * alternative. English voice preferences: ordered by preference, the
   * first English voice whose name matches an earlier entry wins. Chosen for
   * a warm, clearly-spoken tone rather than a flat default voice.
   */
  var LANGUAGES = [
    {
      id: 'en',
      name: 'English',
      nativeName: 'English',
      glyph: 'A',
      speech: 'en',
      fallback: null,
      script: null,
      msPerChar: 60,
      azureVoice: 'en-IN-NeerjaNeural',
      voicePrefs: {
        preferNames: [
          /Google UK English Female/,
          /Google US English/,
          /Heera/,
          /Neerja/,
          /Zira/,
          /Samantha/,
          /Karen/,
          /Moira/,
          /Tessa/,
          /Salli|Joanna|Kendra|Kimberly|Ivy|Amy|Emma|Raveena|Aditi/
        ],
        avoidNames: /David|Mark|Ravi|Male|Guy|Brian|Joey|Justin|Matthew|Russell/,
        // Among the voices that are not avoided, en-IN then en-GB come first.
        preferRegions: ['en-in', 'en-gb']
      },
      // "Androids’ turn" (a plural ending in s takes a bare apostrophe),
      // "Buccaneers’ turn", "White’s turn".
      turnOf: function (name, ofForm) {
        void ofForm;
        return /s$/.test(name) ? (name + '’ turn') : (name + '’s turn');
      }
    },
    {
      id: 'te',
      name: 'Telugu',
      nativeName: 'తెలుగు',
      glyph: 'అ',
      speech: 'te',
      fallback: 'en',
      script: /[ఀ-౿]/,
      msPerChar: 75,
      azureVoice: 'te-IN-ShrutiNeural',
      voicePrefs: null,
      // "<team> వంతు": the possessive form when the team has one
      // (మెరుపుల వంతు, not మెరుపులు వంతు).
      turnOf: function (name, ofForm) {
        return (ofForm || name) + ' వంతు';
      }
    }
  ];

  var DEFAULT_LANG = 'en';

  function ids() {
    return LANGUAGES.map(function (l) { return l.id; });
  }

  // The entry for id, or null.
  function get(id) {
    for (var i = 0; i < LANGUAGES.length; i++) {
      if (LANGUAGES[i].id === id) return LANGUAGES[i];
    }
    return null;
  }

  function isLang(id) {
    return get(id) !== null;
  }

  /*
   * The languages to try, in order, for a line in `id`: id itself, then its
   * fallback, and so on, always ending at DEFAULT_LANG. Guards against a
   * cycle in the fallback links. An unknown id gives just the default.
   */
  function fallbackChain(id) {
    var chain = [];
    var cur = get(id);
    while (cur && chain.indexOf(cur.id) === -1) {
      chain.push(cur.id);
      cur = cur.fallback ? get(cur.fallback) : null;
    }
    if (chain.indexOf(DEFAULT_LANG) === -1) chain.push(DEFAULT_LANG);
    return chain;
  }

  // The next language in list order after id, wrapping round. An unknown id
  // gives the default.
  function next(id) {
    for (var i = 0; i < LANGUAGES.length; i++) {
      if (LANGUAGES[i].id === id) return LANGUAGES[(i + 1) % LANGUAGES.length].id;
    }
    return DEFAULT_LANG;
  }

  var api = {
    LANGUAGES: LANGUAGES,
    DEFAULT_LANG: DEFAULT_LANG,
    ids: ids,
    get: get,
    isLang: isLang,
    fallbackChain: fallbackChain,
    next: next
  };

  if (isNode) {
    module.exports = api;
  } else {
    root.FC = root.FC || {};
    root.FC.langs = api;
  }
})(this);
