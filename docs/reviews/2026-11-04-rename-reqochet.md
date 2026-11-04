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
| R-01 | How the name is written in the app, installer, Start menu, files | lower-case **reqochet** everywhere (as the logo); installer `reqochet-Setup-x.y.z.exe`; folders `.reqochet`, `%APPDATA%\reqochet` | open |
| R-02 | The clean switch from 31 Oct still holds? (new app identity, old ReqMan removed by the new installer, settings copied, `.reqman` → `.reqochet` offered as one Git commit) | yes, as decided | open |
| R-03 | Top bar | small-cut icon + the name (on-light / on-dark file by mode), replacing the "ReqMan" logo and text | open |
| R-04 | Start screen and About | the full name logo (≈ 240 px) above the buttons; About line in Settings → Environment | open |
| R-05 | Loading animation | at start (splash) and while a repository opens; the small busy icon for long waits (pull, push, self-test); small spinners elsewhere stay | open |
| R-06 | Assistant eyes | keep the files for the AI versions (last themes); not shown now — there is no assistant yet | open |
| R-07 | The owner's request 4 Nov: Changes, Pull, Push next to the branch button | in the rename version (one layout change of the top bar) | open |

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
