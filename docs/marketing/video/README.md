# Launch videos — files and how to render them again

Nothing here is published anywhere; the owner posts what he chooses. The scripts and reasons are in `../video.md`.

| File | What | Size |
| --- | --- | --- |
| `reqochet-45s.mp4` | "The file and the window", 48 s, 1920×1080, 30 fps, H.264, captions burnt in, no sound | 2.5 MB |
| `reqochet-45s-square.mp4` | the same film laid out for 1080×1080 (LinkedIn feed) | 2.0 MB |
| `reqochet-45s-poster.png` | still at 10.9 s (the file next to the window) — cover picture, also the picture for post 2 | 0.2 MB |
| `sting/reqochet-sting-{light,dark,ember}.mp4` | the 6-second logo sting on each background, 1920×1080 | about 0.1 MB each |
| `sting/reqochet-sting-{light,dark,ember}.webm` | the same with a **transparent** background (VP9 with alpha) — to lay over other video | under 0.2 MB each |
| `sting/reqochet-sting-{light,dark,ember}.svg` | the same as a self-contained animated SVG (plays once, ends on the logo; stands still on the logo when the system asks for reduced motion) | 18 KB each |

## How it is made

Every scene is an ordinary web page moved by CSS animations. A script opens the page in Chromium (Playwright), sets
the clock to each frame's time, takes a picture and hands the pictures to ffmpeg. So a change is a text edit, and
every render gives the same film.

```
src/index.html     the scenes and the captions (times are written next to each element)
src/video.css      looks and motion; colours are the app's (config/theme.json) and the brand's
src/player.js      wide / square layout, puts the sting into the end card, window.seek(seconds)
src/render.mjs     page -> MP4 and poster
src/img/           four real app screenshots (copies of the website's product shots)
src/fonts/         Inter, DejaVu Sans Mono, DejaVu Sans (see FONTS.md)
sting/src/build-sting.mjs    writes the three animated SVGs from the logo file in resources/brand
sting/src/render-sting.mjs   SVG -> MP4 and transparent WebM
```

```
node docs/marketing/video/src/render.mjs                       # both films and the poster (a few minutes each)
node docs/marketing/video/src/render.mjs square                # one of them
node docs/marketing/video/src/render.mjs --stills 2,10.9,20    # look at single moments first (src/stills/, not committed)
node docs/marketing/video/src/render.mjs --serve               # watch it in a browser; add ?format=square or ?t=12.5
node docs/marketing/video/sting/src/build-sting.mjs            # the three SVGs
node docs/marketing/video/sting/src/render-sting.mjs [ember]   # their MP4 and WebM
```

Needs Node, ffmpeg on the PATH, and Playwright with its Chromium (`playwright`, or the repository's
`playwright-core` with a Chromium installed). Nothing is downloaded while rendering.

**To change a caption or a time:** edit the line in `src/index.html` (`--in` / `--out` are seconds on the film's
clock; `--t0` is a scene's start and `--d` an element's delay after it), look at a still, render.
**To change the sting:** the hop points and times are the two lists `RED` and `GREEN` at the top of `build-sting.mjs`.
After a change to the sting, render the film again too — its end card is the Ember sting.

## What is real and what is drawn

- Real: the logo and its colours (`resources/brand`, shapes untouched), the app's colours and serif font, the file
  format (user guide §15), the app's words (suspect, Keep, Unlink, 1 gap), the four screenshots in scene 8.
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
| Music | none | — |
