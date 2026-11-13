"""Speaks the lines of narration.json with Kokoro (offline) and saves one file per line in narration/.

    python narrate.py <kokoro-v1.0.onnx> <voices-v1.0.bin> [line id ...]

Needs: pip install kokoro-onnx soundfile; the two model files come from the kokoro-onnx GitHub releases
(model-files-v1.0). Licences: see ../README.md. The film itself is built without this script - the spoken
lines are kept in narration/ - so it is only needed when a line changes.
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

here = Path(__file__).parent
plan = json.loads((here / "narration.json").read_text(encoding="utf-8"))
voice = plan["voice"]
kokoro = Kokoro(sys.argv[1], sys.argv[2])
only = set(sys.argv[3:])
(here / "narration").mkdir(exist_ok=True)
for line in plan["lines"]:
    if only and line["id"] not in only:
        continue
    samples, rate = kokoro.create(line.get("say", line["text"]), voice=voice["name"], speed=line.get("speed", voice["speed"]), lang=voice["language"])
    # cut the silence before and after (below -45 dB), keep 20 ms of air
    loud = np.flatnonzero(np.abs(samples) > 10 ** (-45 / 20))
    samples = samples[max(0, loud[0] - rate // 50) : loud[-1] + rate // 50]
    sf.write(here / "narration" / f"{line['id']}.flac", samples, rate, subtype="PCM_16")
    room = line["until"] - line["at"]
    length = len(samples) / rate
    print(f"{line['id']}  {length:4.2f} s of {room:4.2f} s  {'TOO LONG' if length > room else 'ok'}  {line['text']}")
