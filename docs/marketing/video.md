# Videos (13 Nov 2026; A was made in the Fable review, B is still a plan)

| | What | State | Files |
| --- | --- | --- | --- |
| **A** | "The file and the window" — 48 s, drawn and animated, captions burnt in, a narrator and sound effects (round 2) | **Made** | `video/reqochet-45s.mp4` (1920×1080), `video/reqochet-45s-square.mp4` (1080×1080, LinkedIn feed), `video/reqochet-45s-poster.png` |
| **Sting** | The logo arriving — 6 s, on light, dark and Ember, with its own sound | **Made** | `video/sting/` (MP4 with sound, silent WebM with transparency, animated SVG, the sound alone) |
| **B** | "A day with reqochet" — about 2 minutes, recorded from the real app | Plan | — |

How A and the sting were made, and how to render them again: `video/README.md`.

**Rules for every video:** nothing that is not built. No names, accounts or real company data. Captions on screen
(LinkedIn plays without sound). Only assets whose licence allows commercial use, licence noted next to the file.
**Recorded videos (B)** show the real app on the public sample project — no mock-ups.
**The animated video (A)** is a drawing, and says so here: scenes 1–6 are drawn in the app's own colours and fonts
(simplified — a table of six rows, two people as two cards); scene 7 uses real screenshots. It shows only things the
app does today, with the app's own words ("suspect", "Keep", "Unlink", "1 gap"). It names no platform and no export
format, so it stays true at 1.0.

---

## A. "The file and the window" — 48 seconds (launch post) — as built

One example runs through the whole film: the requirement **Door lock** (`REQ-K7Q3XMB`). The viewer sees it as a file,
as a table row, being changed, being merged and being checked — one story instead of eight feature shots.

| # | Time | On screen | Caption |
| --- | --- | --- | --- |
| 1 | 0–3.7 s | The file `REQ-K7Q3XMB.md` is typed out: header, one sentence | **This is a requirement.** |
| 2 | 3.9–7.3 s | The file moves aside; the folder it lives in: `my-product / requirements / System /` next to `src` and `tests` | **A plain file in your own Git repository.** |
| 3 | 7.6–11.2 s | The reqochet window next to the file; title, status and ID light up in both | **reqochet is the window onto them.** |
| 4 | 11.4–14.9 s | The outline numbers 1, 1.1, 1.2 … light up one after the other | **One row per file. Outline numbers are calculated, never stored.** |
| 5 | 15–23.5 s | Door lock with its three links. "within 2 s" becomes "within 1 s"; the two links that point **to** it turn amber: "suspect · Keep · Unlink"; one is kept and turns green. The link Door lock itself has to its parent need stays calm — as in the app | **Change what a requirement says… …and every link to it turns suspect, until someone reviews it.** |
| 6 | 23.7–30.5 s | Alice and Bob, one Git repository between them. Alice sets Status, Bob sets Priority; push, pull; Bob's copy shows both: "Combined field by field. Nothing to decide." | **Commit, push and pull — from the window. Different fields are combined. Only real clashes ask.** |
| 7 | 30.7–34.7 s | Coverage: two rules, one bar stops at 97 %, the gap is named | **See what is covered — and what is not.** |
| 8 | 35–42 s | Real screenshots: Light → Dark → Ember (the whole film changes colour with them), then the five language names, ending on العربية and the mirrored window | **Light, Dark — and Ember, for long evenings. Five languages. One reads right to left.** |
| 9 | 42–48 s | End card: the logo arrives on **Light** (the sting), the tagline comes in; as the eyes look left the card turns **Dark** (45.0 s), as they look right **Ember** (45.8 s), and it rests on Ember | **Requirements as plain files in your own Git repository.** Offline · No server · No accounts · Free for teams and companies |

**What changed against the first concept, and why**
- **Suspect links replace "drag a requirement, numbers renumber".** Renumbering is neat but every tool does it;
  a change that flags the links pointing at it is what a requirements engineer has wished for. The calculated numbers
  kept one caption (scene 4).
- **Field-by-field merge replaces the Changes view.** It is the one thing only reqochet does (positioning.md); a
  45-second film must show it.
- **One example all the way through** instead of a new screen per scene.
- **No platform, no price detail, no link on the end card** — those change; the post carries them.
- **No music; a narrator and sound effects instead** (the owner's answer to F-3) — see "Sound" below.
- **The end card shows all three looks** (the owner's answer to F-1): Light while the logo arrives, then Dark, then
  Ember, each change a calm 0.3 s blend. It ends on Ember because the order Light → Dark → Ember is the one the film
  has just taught (scene 8) and Ember is the look only reqochet has; Light still gets the longest time (2.6 s).
- **Square (1080×1080) instead of 1080×1350** for the feed: it is the same film laid out again (larger captions under
  the picture), not a crop, and it also fits groups and comments.

### Sound (round 2, 13 Nov 2026)

**Effects** — all calculated by `video/src/sound.mjs` from sine waves and filtered noise; nothing recorded, nothing
downloaded, so they are the project's own: a tick when a line or a row appears, a pop when something lights up, a
click for each button press (Keep, Push, Pull), a soft low double note when a link turns suspect or a gap shows, a
small two-note bell when a link is confirmed or fields are combined, moving air between scenes, and in the sting a
round bounce per letter the dots touch (the notes climb) and two bell notes when they land. They sit about 15 dB
under the voice.

**Narrator** — Kokoro (an offline speech program; code MIT, voice model Apache 2.0 — both allow commercial use),
voice "af_heart", American English. Checked by machine, not by ear: a speech recogniser wrote the film's sound back
as text and got every line right except two small words. **The owner should listen once** — a computer voice can
stress a word oddly without any measurement showing it. If he prefers his own voice: read the lines below, one file
per line (`video/src/narration/01.flac` … or `.wav`), run `sound.mjs` and `render.mjs --sound-only`.
Without the narrator: `render.mjs --sound-only --no-voice`.

The captions stay on screen (LinkedIn plays muted); the voice says nearly the same words, a little more spoken.
104 words; times are when each line starts (`video/src/narration.json`).

| Starts | Narrator |
| --- | --- |
| 0.5 s | This is a requirement. |
| 4.0 s | A plain text file, in your own Git repository. |
| 7.8 s | reqochet is the window onto those files. *(said like "ricochet")* |
| 11.5 s | One row per file. The numbering is worked out for you. |
| 15.5 s | Change what a requirement says, |
| 18.9 s | and every link to it turns suspect, until someone has reviewed it. |
| 23.9 s | Commit, push and pull, right from the window. |
| 27.3 s | Different fields are combined. Only real clashes ask you. |
| 31.0 s | See at a glance what is covered, and what is not yet. |
| 35.1 s | Light, dark, and Ember, for long evenings. |
| 38.9 s | Five languages. One of them reads right to left. |
| 43.3 s | reqochet. Requirements as plain files. Free for teams and companies. *(the name is spoken as the dots land)* |

**Cuts that can be made from A without rendering again** (`ffmpeg -ss <start> -t <length> -i … -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac`):
suspect links 15.0–23.5 s (post 2 or a comment) · merge 23.6–30.5 s · looks and languages 34.9–42.1 s (post 3).

**Before posting at 1.0:** watch it once against the released app — colours, the words on the buttons, the five
languages. If a word changed, it is one line in `video/src/index.html` and a render of a few minutes.

---

## B. "A day with reqochet" — about 2 minutes (website and W+3)

**Story:** two engineers on one project, one change request, from edit to merged — the prototype journey from the
product definition, shown for real. Record with two clones of the sample project (as in the owner's two-folder trial)
so the pull and the decision window are genuine.

**Music mood:** light, optimistic, low in the mix; voice-over optional (captions carry the story either way).

| # | Time | Shot | Caption / voice-over |
| --- | --- | --- | --- |
| 1 | 0:00–0:10 | Explorer: repository with `src/` and `requirements/` | "Your requirements, in the same repository as your code. Plain files." |
| 2 | 0:10–0:25 | Open the folder in reqochet; documents bar; tree table; Show text on | "reqochet reads them as documents with numbered chapters." |
| 3 | 0:25–0:40 | New requirement under a chapter; set type and status; add a `verifies` link from a test case | "Write, structure and link. IDs are random — no clashes, even on branches." |
| 4 | 0:40–0:55 | Branch button → new branch `change-request-12`; edit two requirements | "A change request gets its own branch." |
| 5 | 0:55–1:05 | Changes → Commit → Push | "Review, commit and push — only the requirements folder, never forced." |
| 6 | 1:05–1:25 | Second window (colleague's clone): Pull; a clash on the same field; the decision window — choose "theirs" for one field | "Different fields are combined. Only real clashes ask." |
| 7 | 1:25–1:40 | A suspect link appears; open it; Keep | "When a linked requirement changes meaning, the link is marked for review." |
| 8 | 1:40–1:50 | Compare branch with main; then Versions → baseline | "Compare like a pull request. Mark a baseline." |
| 9 | 1:50–2:00 | Export → matrix to Excel; Excel opens it | "Hand the matrix to an auditor or a supplier." |
| 10 | 2:00–2:10 | End card | "reqochet. Free for teams and companies. Windows 11. Link below." |

**Recording notes for B** — free tools: OBS Studio (screen recording); Clipchamp (part of Windows 11; the free tier
exports 1080p), DaVinci Resolve, Shotcut or Kdenlive for cutting. Windows at 125 % scaling, a clean desktop,
notifications off, the app maximised, mouse highlight on. Start and end with the sting (`video/sting/`), so A and B
look like one family. At 1.0, add a Word-export shot before the end card (only once it is built).

**Cut-downs from B:** 15 s each for the "pull asks only what it must" scene (6) — it shows the real decision window,
which A only draws.

## Do not show

The owner's name, account, e-mail, GitHub user name or any real company repository (the privacy rule applies to
videos too — check the Git identity shown in Settings and in commit history before recording). Features not built:
approvals, in-app pull requests, and Word export until it is released.
