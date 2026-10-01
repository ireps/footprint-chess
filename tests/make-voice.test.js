'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const MV = require('../tools/make-voice.js');

/*
 * Only tests MV's exported pure helpers, and --index-only via
 * buildClipIndex/rebuildVoiceClipsFile against a temp directory. Never
 * calls anything that reaches the network (requestSpeech/main are not
 * exported, and this file never sets AZURE_SPEECH_KEY).
 */

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fc-make-voice-'));
}

/* ---------- escapeXml ---------- */

test('escapeXml escapes & < > " \'', () => {
  assert.equal(MV.escapeXml('& < > " \''), '&amp; &lt; &gt; &quot; &apos;');
  assert.equal(MV.escapeXml('Rail bot & Slide bot'), 'Rail bot &amp; Slide bot');
  assert.equal(MV.escapeXml('plain text'), 'plain text');
});

/* ---------- buildSsml ---------- */

test('buildSsml picks the right voice and xml:lang for each language', () => {
  const en = MV.buildSsml('en', 'Meet your robot.');
  assert.match(en, /xml:lang="en-IN"/);
  assert.match(en, /voice name="en-IN-NeerjaExpressiveNeural"/);
  assert.match(en, /Meet your robot\./);

  const te = MV.buildSsml('te', 'ఇదిగో, నీ రోబో!');
  assert.match(te, /xml:lang="te-IN"/);
  assert.match(te, /voice name="te-IN-ShrutiNeural"/);
  assert.match(te, /ఇదిగో, నీ రోబో!/);
});

test('buildSsml applies the softer prosody and escapes its text', () => {
  const ssml = MV.buildSsml('en', 'Rail bot & Slide bot say "hi"');
  assert.match(ssml, /<prosody rate="-10%" pitch="\+2%">/);
  assert.match(ssml, /Rail bot &amp; Slide bot say &quot;hi&quot;/);
  assert.ok(!ssml.includes('& '), 'raw & must not appear in the SSML body');
});

test('buildSsml rejects an unsupported language', () => {
  assert.throws(() => MV.buildSsml('fr', 'Bonjour'), /Unsupported language/);
});

/* ---------- parseArgs ---------- */

test('parseArgs defaults to --lang all, no --only, not forced, not index-only', () => {
  assert.deepEqual(MV.parseArgs([]), { lang: 'all', only: null, force: false, indexOnly: false, help: false });
});

test('parseArgs reads --lang as a separate argument or with =', () => {
  assert.equal(MV.parseArgs(['--lang', 'te']).lang, 'te');
  assert.equal(MV.parseArgs(['--lang=en']).lang, 'en');
});

test('parseArgs reads --only as a comma-separated list, trimming whitespace', () => {
  assert.deepEqual(MV.parseArgs(['--only', 'hello-1, hello-2,rook-1']).only, ['hello-1', 'hello-2', 'rook-1']);
  assert.deepEqual(MV.parseArgs(['--only=hello-1,hello-2']).only, ['hello-1', 'hello-2']);
});

test('parseArgs reads --force and --index-only as flags', () => {
  const args = MV.parseArgs(['--force', '--index-only']);
  assert.equal(args.force, true);
  assert.equal(args.indexOnly, true);
});

test('parseArgs rejects an unknown --lang value', () => {
  assert.throws(() => MV.parseArgs(['--lang', 'fr']), /--lang must be en, te or all/);
});

test('parseArgs rejects an unknown argument', () => {
  assert.throws(() => MV.parseArgs(['--nope']), /Unknown argument/);
});

/* ---------- buildClipIndex ---------- */

test('buildClipIndex lists .mp3 ids per language, sorted, from a temp directory', () => {
  const root = tmpDir();
  fs.mkdirSync(path.join(root, 'audio', 'voice', 'en'), { recursive: true });
  fs.mkdirSync(path.join(root, 'audio', 'voice', 'te'), { recursive: true });
  fs.writeFileSync(path.join(root, 'audio', 'voice', 'en', 'rook-1.mp3'), '');
  fs.writeFileSync(path.join(root, 'audio', 'voice', 'en', 'hello-1.mp3'), '');
  fs.writeFileSync(path.join(root, 'audio', 'voice', 'en', 'notes.txt'), 'not audio');
  fs.writeFileSync(path.join(root, 'audio', 'voice', 'te', 'hello-1.mp3'), '');

  const index = MV.buildClipIndex(root, ['en', 'te']);
  assert.deepEqual(index.en, ['hello-1', 'rook-1']);
  assert.deepEqual(index.te, ['hello-1']);
});

test('buildClipIndex returns an empty array for a language with no directory yet', () => {
  const root = tmpDir();
  const index = MV.buildClipIndex(root, ['en', 'te']);
  assert.deepEqual(index.en, []);
  assert.deepEqual(index.te, []);
});

/* ---------- rebuildVoiceClipsFile ---------- */

const STUB_VOICE_CLIPS = [
  '/*',
  ' * Footprint Chess: ids of recorded voice clips, per language.',
  ' * (header comment, kept as-is by rebuildVoiceClipsFile)',
  ' */',
  '(function (root) {',
  "  'use strict';",
  '',
  '  var voiceClips = {',
  '    en: [],',
  '    te: []',
  '  };',
  '',
  '  if (typeof module !== \'undefined\' && module.exports) {',
  '    module.exports = voiceClips;',
  '  } else {',
  '    root.FC = root.FC || {};',
  '    root.FC.voiceClips = voiceClips;',
  '  }',
  '})(this);',
  ''
].join('\n');

test('rebuildVoiceClipsFile rewrites only the voiceClips block, keeping the header comment', () => {
  const root = tmpDir();
  const file = path.join(root, 'voice-clips.js');
  fs.writeFileSync(file, STUB_VOICE_CLIPS);

  const next = MV.rebuildVoiceClipsFile(file, { en: ['hello-1', 'rook-1'], te: ['hello-1'] }, ['en', 'te']);

  assert.match(next, /header comment, kept as-is by rebuildVoiceClipsFile/);
  assert.match(next, /en: \[\s*\n\s*"hello-1",\s*\n\s*"rook-1"\s*\n\s*\]/);
  assert.match(next, /te: \[\s*\n\s*"hello-1"\s*\n\s*\]/);
  assert.equal(fs.readFileSync(file, 'utf8'), next);

  // Still valid, requireable Node source.
  delete require.cache[require.resolve(file)];
  const loaded = require(file);
  assert.deepEqual(loaded, { en: ['hello-1', 'rook-1'], te: ['hello-1'] });
});

test('rebuildVoiceClipsFile writes [] for a language with no clips', () => {
  const root = tmpDir();
  const file = path.join(root, 'voice-clips.js');
  fs.writeFileSync(file, STUB_VOICE_CLIPS);

  MV.rebuildVoiceClipsFile(file, { en: [], te: [] }, ['en', 'te']);

  delete require.cache[require.resolve(file)];
  const loaded = require(file);
  assert.deepEqual(loaded, { en: [], te: [] });
});

test('rebuildVoiceClipsFile throws a clear error when the block is not found', () => {
  const root = tmpDir();
  const file = path.join(root, 'voice-clips.js');
  fs.writeFileSync(file, '// no voiceClips object here\n');
  assert.throws(() => MV.rebuildVoiceClipsFile(file, { en: [], te: [] }, ['en', 'te']), /Could not find/);
});

/* ---------- index-only end to end (no network) ---------- */

test('buildClipIndex + rebuildVoiceClipsFile together reproduce --index-only, with no network access', () => {
  const root = tmpDir();
  fs.mkdirSync(path.join(root, 'audio', 'voice', 'en'), { recursive: true });
  fs.writeFileSync(path.join(root, 'audio', 'voice', 'en', 'great.mp3'), '');
  const file = path.join(root, 'voice-clips.js');
  fs.writeFileSync(file, STUB_VOICE_CLIPS);

  const index = MV.buildClipIndex(root, ['en', 'te']);
  MV.rebuildVoiceClipsFile(file, index, ['en', 'te']);

  delete require.cache[require.resolve(file)];
  const loaded = require(file);
  assert.deepEqual(loaded, { en: ['great'], te: [] });
});
