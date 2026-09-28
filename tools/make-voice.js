#!/usr/bin/env node
'use strict';

/*
 * Footprint Chess: generate lesson voice clips with Azure neural
 * text-to-speech, or rebuild the clip index without contacting Azure.
 *
 * Node-only dev tool. Not loaded by the site (see CLAUDE.md: no runtime
 * dependency may reach outside index.html/check.html), so it is free to use
 * modern Node syntax; it still has no npm dependencies, only Node's own
 * fs/path/https modules.
 *
 * Usage (run from the repo root):
 *   node tools/make-voice.js                       generate every line, both languages
 *   node tools/make-voice.js --lang en              generate English only
 *   node tools/make-voice.js --lang te --force      regenerate Telugu, overwriting files
 *   node tools/make-voice.js --only hello-1,hello-2 generate just these ids
 *   node tools/make-voice.js --index-only           rebuild js/voice-clips.js from disk, no network
 *
 * Requires the environment variables AZURE_SPEECH_KEY and
 * AZURE_SPEECH_REGION (for example centralindia) for anything that talks to
 * Azure. The key is read from the environment and used only in a request
 * header; it is never logged or written to a file.
 *
 * By default, an id/language pair whose audio file already exists is left
 * alone, so a hand recording is never clobbered by a regeneration run. Pass
 * --force to overwrite anyway.
 *
 * At the end of a generating run, and for --index-only, js/voice-clips.js
 * is rebuilt from whatever files actually exist under audio/voice/<lang>/,
 * sorted, keeping that file's header comment.
 *
 * Exports its building-block functions (SSML, arg parsing, the clip index
 * builder) for tests/make-voice.test.js. main() runs only when this file is
 * executed directly (require.main === module), so requiring it never makes
 * a network request or touches disk.
 */

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

// Azure neural voice per language, and the xml:lang the SSML declares for
// it. Matches the languages in js/lessons.js (FC.lessons.LANGS).
const VOICE_NAMES = { en: 'en-IN-NeerjaNeural', te: 'te-IN-ShrutiNeural' };
const XML_LANGS = { en: 'en-IN', te: 'te-IN' };

const DELAY_BETWEEN_REQUESTS_MS = 300;

/* ---------- pure helpers (tested directly) ---------- */

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// A calmer, slightly higher delivery than the neural default, matching the
// softer device-speech settings in js/voice.js.
function buildSsml(lang, text) {
  const xmlLang = XML_LANGS[lang];
  const voiceName = VOICE_NAMES[lang];
  if (!xmlLang || !voiceName) {
    throw new Error(`Unsupported language "${lang}"; expected one of ${Object.keys(VOICE_NAMES).join(', ')}`);
  }
  const escaped = escapeXml(text);
  return '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="' + xmlLang + '">' +
    '<voice name="' + voiceName + '">' +
    '<prosody rate="-10%" pitch="+2%">' + escaped + '</prosody>' +
    '</voice></speak>';
}

function parseArgs(argv) {
  const args = { lang: 'all', only: null, force: false, indexOnly: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    if (raw === '--force') { args.force = true; continue; }
    if (raw === '--index-only') { args.indexOnly = true; continue; }
    if (raw === '--help' || raw === '-h') { args.help = true; continue; }
    if (raw === '--lang') {
      const value = argv[++i];
      if (!value) throw new Error('--lang requires a value: en, te or all');
      args.lang = value;
      continue;
    }
    if (raw.startsWith('--lang=')) { args.lang = raw.slice('--lang='.length); continue; }
    if (raw === '--only') {
      const value = argv[++i];
      if (!value) throw new Error('--only requires a comma-separated list of ids');
      args.only = value.split(',').map((s) => s.trim()).filter(Boolean);
      continue;
    }
    if (raw.startsWith('--only=')) {
      args.only = raw.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean);
      continue;
    }
    throw new Error(`Unknown argument: ${raw}`);
  }
  if (!['en', 'te', 'all'].includes(args.lang)) {
    throw new Error(`--lang must be en, te or all (got "${args.lang}")`);
  }
  return args;
}

// Ids that have a file at <root>/audio/voice/<lang>/<id>.mp3, sorted, for
// each language in langs, in that order.
function buildClipIndex(root, langs) {
  const index = {};
  for (const lang of langs) {
    const dir = path.join(root, 'audio', 'voice', lang);
    let files;
    try {
      files = fs.readdirSync(dir);
    } catch (e) {
      files = [];
    }
    index[lang] = files
      .filter((name) => name.toLowerCase().endsWith('.mp3'))
      .map((name) => name.slice(0, -4))
      .sort();
  }
  return index;
}

function formatLangArray(ids) {
  if (!ids || !ids.length) return '[]';
  const items = ids.map((id) => '      ' + JSON.stringify(id)).join(',\n');
  return '[\n' + items + '\n    ]';
}

// Rewrites the "var voiceClips = { ... };" block in the file at filePath to
// match index, for each language in langs (in that order), leaving
// everything else in the file - including its header comment - untouched.
function rebuildVoiceClipsFile(filePath, index, langs) {
  const current = fs.readFileSync(filePath, 'utf8');
  const block = /var voiceClips = \{[\s\S]*?\n  \};/;
  if (!block.test(current)) {
    throw new Error(`Could not find "var voiceClips = { ... };" in ${filePath}`);
  }
  const body = langs
    .map((lang) => '    ' + lang + ': ' + formatLangArray((index && index[lang]) || []))
    .join(',\n');
  const next = current.replace(block, 'var voiceClips = {\n' + body + '\n  };');
  fs.writeFileSync(filePath, next);
  return next;
}

function sleep(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

/* ---------- network (never exercised by tests) ---------- */

// Posts SSML to Azure's TTS REST endpoint and resolves with the MP3 bytes.
// The subscription key is used only in a request header; it is never
// logged, and no part of the response is logged except its byte length.
function requestSpeech(region, key, ssml) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(ssml, 'utf8');
    const req = https.request({
      hostname: region + '.tts.speech.microsoft.com',
      path: '/cognitiveservices/v1',
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'footprint-chess',
        'Content-Length': body.length
      }
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error('Azure TTS request failed: HTTP ' + res.statusCode +
            (res.statusMessage ? ' ' + res.statusMessage : '')));
          return;
        }
        resolve(Buffer.concat(chunks));
      });
    });
    req.on('error', (err) => reject(new Error('Azure TTS request failed: ' + err.message)));
    req.write(body);
    req.end();
  });
}

/* ---------- CLI ---------- */

function printHelp() {
  console.log([
    'Usage: node tools/make-voice.js [options]',
    '',
    '  --lang en|te|all   Language(s) to generate (default: all, English first)',
    '  --only id1,id2     Only these line ids',
    '  --force            Overwrite files that already exist (default: skip them)',
    '  --index-only       Rebuild js/voice-clips.js from audio/voice/ and exit; no network',
    '  --help             Show this message',
    '',
    'Requires AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in the environment,',
    'unless --index-only is given. See docs/VOICE-SCRIPT.md.'
  ].join('\n'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const root = path.join(__dirname, '..');
  const lessons = require(path.join(root, 'js', 'lessons.js'));
  const clipsFile = path.join(root, 'js', 'voice-clips.js');

  if (args.indexOnly) {
    const index = buildClipIndex(root, lessons.LANGS);
    rebuildVoiceClipsFile(clipsFile, index, lessons.LANGS);
    console.log('Rebuilt js/voice-clips.js from audio/voice/ (no network requests made).');
    return;
  }

  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    throw new Error('Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION first (see docs/VOICE-SCRIPT.md). ' +
      'Use --index-only if you only want to rebuild js/voice-clips.js from existing files.');
  }

  // English first, then Telugu, matching FC.lessons.LANGS.
  const langs = args.lang === 'all' ? lessons.LANGS.slice() : [args.lang];
  const ids = args.only || Object.keys(lessons.LINES).sort();

  for (const lang of langs) {
    for (const id of ids) {
      const line = lessons.LINES[id];
      if (!line) {
        console.error('Skipping unknown line id "' + id + '".');
        continue;
      }
      const text = line[lang];
      if (!text) {
        console.error('Skipping "' + id + '": no ' + lang + ' text in js/lessons.js.');
        continue;
      }
      const outDir = path.join(root, 'audio', 'voice', lang);
      const outFile = path.join(outDir, id + '.mp3');
      if (fs.existsSync(outFile) && !args.force) {
        console.log('Skipping ' + lang + '/' + id + ' (already exists; use --force to overwrite).');
        continue;
      }
      fs.mkdirSync(outDir, { recursive: true });
      try {
        const audio = await requestSpeech(region, key, buildSsml(lang, text));
        fs.writeFileSync(outFile, audio);
        console.log('Wrote ' + lang + '/' + id + '.mp3 (' + audio.length + ' bytes).');
      } catch (e) {
        console.error('Failed ' + lang + '/' + id + ': ' + e.message);
      }
      await sleep(DELAY_BETWEEN_REQUESTS_MS);
    }
  }

  const index = buildClipIndex(root, lessons.LANGS);
  rebuildVoiceClipsFile(clipsFile, index, lessons.LANGS);
  console.log('Rebuilt js/voice-clips.js from audio/voice/.');
}

module.exports = {
  VOICE_NAMES,
  XML_LANGS,
  escapeXml,
  buildSsml,
  parseArgs,
  buildClipIndex,
  formatLangArray,
  rebuildVoiceClipsFile
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
