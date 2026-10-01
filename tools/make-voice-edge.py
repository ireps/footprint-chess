"""Footprint Chess: make the voice clips with Microsoft's neural voices through the edge-tts package.

One MP3 per line and language, at audio/voice/<lang>/<id>.mp3, from the text in js/lessons.js (FC.lessons.LINES,
kept identical to docs/VOICE-SCRIPT.md by the tests). Each language's voice, speed and pitch come from the registry
(js/langs.js azureVoice, voiceRate, voicePitch): English en-IN-NeerjaExpressiveNeural at -10% and +15Hz, Telugu
te-IN-ShrutiNeural at -5% and +25Hz. Then js/voice-clips.js is rebuilt with node tools/make-voice.js --index-only.

Setup (once):  uv venv .venv && uv pip install --python .venv edge-tts   (or pip install edge-tts; Python 3.8+)
Run (from the repo root):
    .venv/Scripts/python tools/make-voice-edge.py --only hello-1 great     try two lines first and listen
    .venv/Scripts/python tools/make-voice-edge.py                          every missing clip, every language
    .venv/Scripts/python tools/make-voice-edge.py --force                  remake every clip (replaces recordings)
    .venv/Scripts/python tools/make-voice-edge.py --lang en --voice en-IN-NeerjaNeural --force

It uses Microsoft Edge's online read-aloud voices, so it needs the internet while it runs; no key is needed. The site
itself never goes online for audio. Dev only; never shipped, and not loaded by any page. An existing clip is left
alone unless --force is given, so a parent's own recording is never replaced by accident. With ffmpeg on the PATH,
the long silence edge-tts leaves at the end of a clip is cut to 0.2 s (stream copy, no re-encoding), so a lesson
does not wait on silence.
"""
import argparse
import asyncio
import json
import os
import re
import subprocess
import sys

try:
    import edge_tts
except ImportError:
    sys.exit("This needs the edge-tts package: pip install edge-tts")

TAIL_MS = 200
DUMP = (
    "const L=require('./js/lessons.js'),G=require('./js/langs.js');"
    "const v={},p={};G.LANGUAGES.forEach(l=>{v[l.id]=l.azureVoice;p[l.id]=[l.voiceRate,l.voicePitch];});"
    "process.stdout.write(JSON.stringify({lines:L.LINES,voices:v,prosody:p}));"
)


def load(root):
    """{lines, voices} from the app's own classic scripts, through Node."""
    out = subprocess.run(["node", "-e", DUMP], cwd=root, capture_output=True, check=True)
    return json.loads(out.stdout.decode("utf-8"))


def trim_tail(path):
    """Cuts trailing silence to TAIL_MS. Returns True when cut; quietly does nothing without ffmpeg."""
    try:
        r = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "silencedetect=noise=-50dB:d=0.15",
                            "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    except FileNotFoundError:
        return False
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", r.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r.stderr)]
    dur = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    if not starts or not dur:
        return False
    total = int(dur.group(1)) * 3600 + int(dur.group(2)) * 60 + float(dur.group(3))
    last = starts[-1]
    # Trailing only: the last silence never ends, or ends at the end of the file.
    if len(ends) == len(starts) and ends[-1] < total - 0.05:
        return False
    if total - last <= TAIL_MS / 1000 + 0.05:
        return False
    tmp = path + ".trim.mp3"
    c = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", path, "-t", "%.3f" % (last + TAIL_MS / 1000),
                        "-c", "copy", tmp])
    if c.returncode != 0:
        if os.path.exists(tmp):
            os.remove(tmp)
        return False
    os.replace(tmp, path)
    return True


async def make(text, voice, rate, pitch, dest):
    tmp = dest + ".part"
    comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    with open(tmp, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
    if os.path.getsize(tmp) == 0:
        os.remove(tmp)
        raise RuntimeError("no audio")
    os.replace(tmp, dest)
    return trim_tail(dest)


async def main():
    ap = argparse.ArgumentParser(description="Make Footprint Chess voice clips with Microsoft neural voices (edge-tts).")
    ap.add_argument("--root", default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))), help="repo folder")
    ap.add_argument("--lang", default="all", help="a language id from js/langs.js, or all (default)")
    ap.add_argument("--only", nargs="*", help="make just these line ids, e.g. --only hello-1 great")
    ap.add_argument("--voice", help="use this voice instead of the registry's (needs a single --lang)")
    ap.add_argument("--rate", help="speaking speed for every language, e.g. -10%% (default: the registry's voiceRate)")
    ap.add_argument("--pitch", help="voice pitch for every language, e.g. +15Hz (default: the registry's voicePitch)")
    ap.add_argument("--force", action="store_true", help="remake clips that already exist")
    ap.add_argument("--out", help="folder holding one folder per language (default: audio/voice in the repo)")
    ap.add_argument("--jobs", type=int, default=4, help="clips made at the same time")
    ap.add_argument("--no-index", action="store_true", help="do not rebuild js/voice-clips.js afterwards")
    args = ap.parse_args()
    root = os.path.abspath(args.root)
    default_out = os.path.join(root, "audio", "voice")
    out_dir = os.path.abspath(args.out) if args.out else default_out

    data = load(root)
    voices = data["voices"]
    prosody = {l: [args.rate or r or "+0%", args.pitch or p or "+0Hz"] for l, (r, p) in data["prosody"].items()}
    langs = list(voices) if args.lang == "all" else [args.lang]
    for lang in langs:
        if lang not in voices:
            sys.exit("Unknown language %r; expected one of %s or all" % (lang, ", ".join(voices)))
    if args.voice:
        if len(langs) != 1:
            sys.exit("--voice needs a single --lang")
        voices = dict(voices, **{langs[0]: args.voice})
    unknown = [i for i in (args.only or []) if i not in data["lines"]]
    if unknown:
        sys.exit("Unknown line ids: " + ", ".join(unknown))

    todo = []
    for lang in langs:
        folder = os.path.join(out_dir, lang)
        os.makedirs(folder, exist_ok=True)
        for line_id, line in data["lines"].items():
            if args.only and line_id not in args.only:
                continue
            text = line.get(lang)
            if not text:
                continue
            dest = os.path.join(folder, line_id + ".mp3")
            if os.path.exists(dest) and not args.force:
                continue
            todo.append((lang, line_id, text, dest))

    print("Voices: %s. %d clips to make in %s." % (
        "; ".join("%s %s (rate %s, pitch %s)" % (l, voices[l], prosody[l][0], prosody[l][1]) for l in langs),
        len(todo), out_dir))
    sem = asyncio.Semaphore(max(1, args.jobs))
    failed, made, trimmed = [], [0], [0]

    async def one(lang, line_id, text, dest):
        async with sem:
            for attempt in range(4):
                try:
                    if await make(text, voices[lang], prosody[lang][0], prosody[lang][1], dest):
                        trimmed[0] += 1
                    made[0] += 1
                    return
                except Exception as e:  # network hiccups: wait and try again
                    if attempt == 3:
                        failed.append("%s/%s (%s)" % (lang, line_id, e))
                    else:
                        await asyncio.sleep(2 ** (attempt + 1))

    await asyncio.gather(*(one(*t) for t in todo))
    print("Made %d clips (%d with long end silence cut)." % (made[0], trimmed[0]))
    if failed:
        print("%d failed (run again to retry): %s" % (len(failed), ", ".join(failed[:10])))
    if not args.no_index and out_dir == default_out:
        subprocess.run(["node", "tools/make-voice.js", "--index-only"], cwd=root, check=False)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
