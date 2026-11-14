# Launch videos — files and how to render them again

Nothing here is published anywhere; the owner posts what he chooses. The scripts and reasons are in `../video.md`.

| File | What | Size |
| --- | --- | --- |
| `reqochet-45s.mp4` | "The file and the window", 48 s, 1920×1080, 30 fps, H.264, captions burnt in, **narrator and sound effects** (AAC 128 kbit/s stereo) | 3.4 MB |
| `reqochet-45s-square.mp4` | the same film laid out for 1080×1080 (LinkedIn feed) | 2.8 MB |
| `reqochet-45s-poster.png` | still at 10.9 s (the file next to the window) — cover picture, also the picture for post 2 | 0.2 MB |
| `sting/reqochet-sting-{light,dark,ember}.mp4` | the 6-second logo sting on each background, 1920×1080, **with its sound** | about 0.2 MB each |
| `sting/reqochet-sting-sound.m4a` | the sting's sound alone (to lay under the WebM or the SVG) | 0.1 MB |
| `sting/reqochet-sting-{light,dark,ember}.webm` | the same with a **transparent** background (VP9 with alpha), silent — to lay over other video | under 0.2 MB each |
| `sting/reqochet-sting-{light,dark,ember}.svg` | the same as a self-contained animated SVG (plays once, ends on the logo; stands still on the logo when the system asks for reduced motion) | 18 KB each |

Round 2 (13 Nov 2026, the owner's answers): the end card shows the three looks; the film has a narrator and
sound effects instead of music; the stings have sound. Round 3 (the owner listened: sounds, voice quality and words
fine): a **male** narrator (`am_michael`) and the end card in the order **Ember → Dark → Light**, resting on Light.

## How it is made

Every scene is an ordinary web page moved by CSS animations. A script opens the page in Chromium (Playwright), sets
the clock to each frame's time, takes a picture and hands the pictures to ffmpeg. So a change is a text edit, and
every render gives the same film.

```
src/index.html     the scenes and the captions (times are written next to each element)
src/video.css      looks and motion; colours are the app's (config/theme.json) and the brand's
src/player.js      wide / square layout, puts the sting into the end card, window.seek(seconds)
src/render.mjs     page -> MP4 (pictures + sound) and poster
src/sound.mjs      calculates every sound effect and lays the spoken lines over them -> src/audio/*.wav (not committed)
src/narration.json the narrator's lines and when each starts
src/narration/     the spoken lines, one small file each (kept, so the film can be built without the speech program)
src/narrate.py     speaks the lines again with Kokoro — only needed when a line changes
src/img/           four real app screenshots (copies of the website's product shots)
src/fonts/         Inter, DejaVu Sans Mono, DejaVu Sans (see FONTS.md)
sting/src/build-sting.mjs    writes the three animated SVGs from the logo file in resources/brand
sting/src/render-sting.mjs   SVG -> MP4 (with sound) and transparent WebM
```

```
node docs/marketing/video/src/sound.mjs                        # the sound of the film and the sting; prints the levels
node docs/marketing/video/src/render.mjs                       # both films and the poster (a few minutes each)
node docs/marketing/video/src/render.mjs --sound-only          # keep the pictures, only put the sound in again (seconds)
node docs/marketing/video/src/render.mjs --sound-only --no-voice   # effects without the narrator; --silent = no sound
node docs/marketing/video/src/render.mjs square                # one of them
node docs/marketing/video/src/render.mjs --stills 2,10.9,20    # look at single moments first (src/stills/, not committed)
node docs/marketing/video/src/render.mjs --serve               # watch it in a browser; add ?format=square or ?t=12.5
node docs/marketing/video/sting/src/build-sting.mjs            # the three SVGs
node docs/marketing/video/sting/src/render-sting.mjs [ember]   # their MP4 and WebM (--sound-only: only the sound again)
```

Needs Node, ffmpeg on the PATH, and Playwright with its Chromium (`playwright`, or the repository's
`playwright-core` with a Chromium installed). Nothing is downloaded while rendering.

**To change a caption or a time:** edit the line in `src/index.html` (`--in` / `--out` are seconds on the film's
clock; `--t0` is a scene's start and `--d` an element's delay after it), look at a still, render.
**To change the sting:** the hop points and times are the two lists `RED` and `GREEN` at the top of `build-sting.mjs`.
After a change to the sting, render the film again too — its end card is the three stings laid over each other
(Ember until 45.0 s, Dark until 45.8 s, then Light; the four numbers are explained in `video.css`, "scene F"), and
move the bounce times in `sound.mjs` (`sting()`) with it.

## Sound

- **Effects** are calculated in `sound.mjs` (sine waves and filtered noise with fixed "random" numbers, so every run
  gives the same file): tick, pop, click, bounce, bell, moving air, a rising note, a low double note. The list of
  what plays when is the function `film()` — one line per moment, times on the film's clock, next to a comment that
  names the scene. **When a time in `index.html` moves, move it there too.**
- **Narrator**: the lines and their start times are in `narration.json`; the spoken files are in `narration/`.
  To change a line: edit the text, then `python src/narrate.py <kokoro-v1.0.onnx> <voices-v1.0.bin> <line id>`
  (set-up: `pip install kokoro-onnx soundfile`; the two model files are on the kokoro-onnx GitHub releases page,
  tag `model-files-v1.0`, 340 MB together — not kept in this repository). "reqochet" is spelt "Ricochet" for the
  speech program (`say`) so it is said like the word.
- **The owner's own voice instead:** record each line of `narration.json` as `narration/01.wav`, `02.wav` … (a
  `.wav` next to a `.flac` — delete the `.flac`), run `sound.mjs` — it warns when a line is longer than its place —
  then `render.mjs --sound-only`.
- **Levels** (measured with ffmpeg on the finished MP4s): loudness −16.4 LUFS, highest peak −2.4 dB. The voice is on
  average 15 dB above the effects while it speaks (−26.3 dB against −41.4 dB before the common gain); the effects
  are loudest where nobody speaks over them for long — the logo's bounces and bells (peak about −6 dB). `render.mjs`
  measures the mix, adds one fixed gain for the whole film and holds the peaks with a limiter.
- **Voice choice (round 3):** eight male American voices of the model were spoken and written back by a speech
  recogniser (Whisper tiny, offline); `am_michael` kept the sentence pauses best, and it is among the male voices the model's authors rate highest
  (their voice list could not be opened from the build session — from memory, so check it if it matters). If the
  owner wants to compare: `am_adam` and `am_puck` fit every line at their own pace. It speaks more slowly than the
  first voice, so it runs at 1.06 × (`narration.json`), and three lines start a little earlier.
- **Heard by the owner:** round 2 (effects and the female voice). The male voice of round 3 was checked by machine
  only: all twelve lines came back from the recogniser, with "to it turns" and "plain" misheard by it.

## What is real and what is drawn

- Real: the logo and its colours (`resources/brand`, shapes untouched), the app's colours and serif font, the file
  format (user guide §15), the app's words (suspect, Keep, Unlink, 1 gap), the four screenshots in scene 8.
- Made by a program: the narrator's voice (Kokoro, see below) — say so if someone asks; all sound effects are
  calculated, none is a recording.
- Drawn: the file card, the folder list, the small table, the link picture, the two people and the coverage panel —
  simplified pictures of what the app shows, not recordings.
- The example data (Door lock, Alice, Bob, the IDs) is made up; no person, account or company appears.

## Assets and licences (all allow commercial use)

| Asset | From | Licence |
| --- | --- | --- |
| Logo, wordmark, eyes | `resources/brand` | the project's own |
| Screenshots | the app (e2e runs; the website's cropped copies) | the project's own |
| Source Serif 4 | `src/renderer/src/assets/fonts/source-serif-4` | SIL Open Font License 1.1 |
| Inter (Regular, Medium, SemiBold, Bold), unchanged files | The Inter Project Authors | SIL Open Font License 1.1 — `src/fonts/FONTS.md` |
| DejaVu Sans Mono, DejaVu Sans, unchanged files | DejaVu fonts (Bitstream Vera derivative) | Bitstream Vera licence; DejaVu changes public domain — `src/fonts/FONTS.md` |
| Folder and branch pictograms | drawn for this film in the style of the app's icon set | the project's own |
| Sound effects | calculated by `src/sound.mjs` | the project's own |
| Narrator's voice: speech program | kokoro-onnx 0.6.1 (`pip`), used as a tool, not shipped | MIT |
| Narrator's voice: voice model | Kokoro-82M v1.0, voice `am_michael` (round 2 used `af_heart`; every voice is part of the same model file, same licence), files `kokoro-v1.0.onnx` and `voices-v1.0.bin` from the kokoro-onnx GitHub releases (sha256 `7d5df8ec…36a6c5`, `bca610b8…fbf7d`) | Apache 2.0 — the model's own page: "Apache-licensed weights … can be deployed anywhere from production environments to personal projects" (read on GitHub, 13 Nov 2026: `hexgrad/kokoro` LICENSE and README, `thewh1teagle/kokoro-onnx` README "kokoro model: Apache 2.0") |
| (inside the speech program) espeak-ng turns letters into sounds | bundled with kokoro-onnx, used as a tool | GPL 3 — a tool's licence does not pass to what it produces; nothing of it is in the film or the repository |
| Music | none (the owner, 13 Nov 2026) | — |
