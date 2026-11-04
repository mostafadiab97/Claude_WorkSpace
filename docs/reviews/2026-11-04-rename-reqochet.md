# Rename to reqochet — discussion (4 Nov 2026)

The owner chose the name **reqochet** (4 Nov 2026) and sent a finished brand package (logo, Windows icon, loading
animation, assistant "eyes"), made in another session. Earlier rename decisions: `2026-10-31-rename-impact.md`
(section 5: clean switch — uninstall the old app, new app identity, copy the user's settings, `.reqman` folder renamed
by a Git rename the user commits). This file collects the open points for the rename version.

## What the brand package holds (F)

- `logo/` — the name as outlines (Comfortaa Bold, reworked), on-light (ink letters) and on-dark (white letters),
  SVG + 2000 px PNG. Red dot in the **q** (requirement), green dot in the **o** (verification).
- `icon/` — `reqochet.ico` (dark tile, 16–256 px inside) and a white-tile variant; SVG/PNG in all sizes; a heavier
  "small cut" for 16–24 px.
- `motion/` — loading animation (the two dots bounce, 1.4 s loop) for light and dark, a small busy icon, and the
  assistant "eyes" (idle / thinking / still). All are self-contained SVG with CSS, and stop when Windows animations
  are off.
- `brand-tokens.json`, `brand-sheet.png/html`, `README.md` (rules: never redraw or recolour; never mirror in Arabic;
  min. 100 px wide for the name, small-cut icon below 32 px; red/green are logo colours only, not status colours).
- Checked (F): no scripts or outside links in the SVGs; only the demo page `assistant-icon.html` has a button with a
  script — it is not shipped.

## Open points

| ID | Point | Recommendation | Owner |
| --- | --- | --- | --- |
| R-01 | How the name is written in the app, installer, Start menu, files | lower-case **reqochet** everywhere (as the logo); installer `reqochet-Setup-x.y.z.exe`; folders `.reqochet`, `%APPDATA%\reqochet` | **C: all lower case** |
| R-02 | The clean switch from 31 Oct still holds? (new app identity, old ReqMan removed by the new installer, settings copied, `.reqman` → `.reqochet` offered as one Git commit) | yes, as decided | **C: yes** |
| R-03 | Top bar | small-cut icon + the name (on-light / on-dark file by mode), replacing the "ReqMan" logo and text | **C: yes** |
| R-04 | Start screen and About | the full name logo (≈ 240 px) above the buttons; About line in Settings → Environment | **C: yes** |
| R-05 | Loading animation | at start (splash) and while a repository opens; the small busy icon for long waits (pull, push, self-test); small spinners elsewhere stay | **C: yes to all** — the owner has not seen the animation yet: a logo adjusting step may follow |
| R-06 | Assistant eyes | keep the files for the AI versions (last themes); not shown now — there is no assistant yet | **C: show them now** ("a beautiful interface") — where: see R-08 |
| R-07 | The owner's request 4 Nov: Changes, Pull, Push next to the branch button | in the rename version (one layout change of the top bar) | **C: in the rename version** |

| R-08 | Where the eyes appear (follows R-06) | the app's face in the top bar (small eyes instead of the plain icon): idle normally, **thinking** while the app works (opening, pull, push, self-test, import), still when the window is in the background; large eyes on the start screen beside the name | **C: yes** |
| R-09 | A brand / logo designer helper agent (owner 4 Nov) | yes: a fourth helper for brand work — reviews how logo, icon and motion sit in the app (sizes, clear space, light/dark, Arabic) and proposes adjustments; writes `docs/reviews/agents/<version>-brand.md`; runs for the rename version and when the brand changes | **C: yes** |
| R-10 | Two tools on one PC (follows the two-feeds decision): this repository's app is the **development tool** | it is named **reqochet dev** (own app identity, `%APPDATA%\reqochet-dev`, installer `reqochet-dev-Setup-x.y.z.exe`, a small "dev" mark beside the logo); the plain **reqochet** comes only from the public repository later; both read the same `.reqochet` project folders | open |

## Technical decisions (Claude, explained)

- Brand files are pictures, copied unchanged into the app (`resources/brand/`); the theme keeps pointing at the logo
  (`brand.logo`), so a company theme can still replace it. The red/green inside the SVGs are not theme colours —
  the theme rule (NFR-11) covers the app's own colours.
- `appId` changes (clean switch). The update path is tested by the CI acceptance run: install 0.15.x → update →
  reqochet installed, ReqMan gone, settings copied.
- ReqIF/Excel write the new tool name and attribute names; import reads the old ones forever.
- Code names (`window.reqman`, `ReqManApi`, package name, temp prefixes) are renamed in one mechanical commit, so a
  future team meets one name. `OLDEST_REVERT_TARGET` is raised to the rename version ("go back" across the identity
  change is not possible).

## Discussion log

- 4 Nov 2026 — name chosen: **reqochet**; brand package received.
- 4 Nov 2026 — R-01 all lower case; R-02 clean switch as decided 31 Oct; R-03 icon + name in the top bar; R-04 logo on
  the start screen; R-05 loading animation at start, while opening, small busy icon for long waits; R-06 eyes shown
  now; R-07 Changes / Pull / Push next to the branch button in the rename version. The owner has not seen the
  animation yet — a logo adjusting step may follow, with a brand helper agent (R-09).
- 4 Nov 2026 — R-08 eyes as the app's face (top bar, thinking while working; start screen) — yes. R-09 brand helper
  agent — yes. Public repository: **two tools** — the *development tool* built here updates from this repository's
  releases; the *release tool* built in the public repository updates from that repository's releases; the owner has
  both installed for manual tests; each tool's version list shows only its own repository's versions. Other public-repo
  questions later.
