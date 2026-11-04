# reqochet brand package — instructions for the AI assistant placing it in the app

You are integrating the final reqochet logo, icon and motion into the reqochet desktop app
(Windows; English + Arabic right-to-left; light + dark mode). Everything here is final.
**Do not redraw, retype, recolour, re-space or regenerate any of these files.** Copy them in and reference them.

Open `brand-sheet.png` (or `brand-sheet.html`) first to see what everything looks like.
Machine-readable values are in `brand-tokens.json`.

## 1. What is in this folder

```
README.md                 ← this file
brand-sheet.html / .png   the visual brand sheet (self-contained)
brand-tokens.json         colours, sizes, file map
logo/
  reqochet-logo-on-light.svg      name, ink #1b1f27 letters, transparent bg
  reqochet-logo-on-dark.svg       name, white letters, transparent bg
  reqochet-logo-on-*-2000.png     same, 2000 px wide PNG
icon/
  reqochet.ico                    Windows app icon, dark tile (16,20,24,32,40,48,64,256) ← DEFAULT
  reqochet-light.ico              same, white tile
  reqochet-icon.svg               dark tile — use at ≥ 32 px
  reqochet-icon-small.svg         dark tile, heavier "small cut" — use at 16–24 px
  reqochet-icon-light(-small).svg white tile versions
  png/reqochet-icon[-light]-{16…512}.png
motion/
  reqochet-loading-on-light.svg   splash/loading: name with the two dots bouncing (1.4 s loop)
  reqochet-loading-on-dark.svg
  reqochet-loading-icon.svg       small busy indicator (icon with bouncing dots)
  reqochet-eyes-{idle|thinking}[-light|-small|-inline].svg   assistant avatar
  reqochet-assistant-icon.html    copy-paste CSS + inline SVG with data-state switching
```

All animated SVGs are self-contained (CSS inside the SVG), loop forever, and stop
automatically when the OS "show animations" setting is off (`prefers-reduced-motion`).

## 2. Where each file goes

| Place in the app | Use | Size |
|---|---|---|
| Executable / taskbar / Start / installer / shortcut icon | `icon/reqochet.ico` | all sizes inside |
| Custom-drawn window title bar (left in LTR, right in RTL) | `icon/reqochet-icon-small.svg` (or `png/reqochet-icon-16.png` / `-24.png`) | 16 px (24 px at 150 % scaling → use the 24 PNG) |
| About dialog, welcome/empty state, sign-in | `logo/reqochet-logo-on-light.svg` in Light mode, `…-on-dark.svg` in Dark mode | ≥ 160 px wide, never < 100 px |
| Splash / startup loading screen | `motion/reqochet-loading-on-light.svg` / `…-on-dark.svg` | 240–480 px wide, centred |
| Busy indicator inside a panel | `motion/reqochet-loading-icon.svg` | 24–48 px |
| AI assistant avatar / button | `motion/reqochet-eyes-*` or the component in `reqochet-assistant-icon.html` | 16–64 px |

Theme switching: pick the `on-light` / `on-dark` (or `-light` tile) file from the app's current mode
(the app theme has `modes.light` / `modes.dark`). Do not use CSS filters to invert the logo.

RTL (Arabic): **never mirror** the logo, icon or animations. The name stays in Latin letters.
Only its position follows the layout (e.g. title-bar icon moves to the right side).

## 3. How to embed (pick the one that matches the app's UI stack — check the repo first)

**Web-based UI (Electron, Tauri, WebView2, any HTML/CSS front end)**
- Static or animated: `<img src="…/reqochet-loading-on-light.svg" alt="Loading" width="320">`.
  Animations play inside `<img>`; no JS needed.
- Assistant avatar that changes state: paste the CSS block and the `<svg class="rq-eyes">` markup
  from `motion/reqochet-assistant-icon.html` (between the "copy from here / to here" comments).
  Set `data-state="idle" | "thinking" | "still"` from code. The letters use `currentColor`;
  set `color` from the theme text token (`#1b1f27` light, `#e7eaf0` dark). Dots stay red/green.
- Window/app icon: point the packager's icon setting (e.g. electron-builder `win.icon`,
  Tauri `bundle.icon`) at `icon/reqochet.ico`.

**Native UI (WPF, WinUI 3, WinForms, Qt)**
- App icon: set the project's ApplicationIcon / `.rc` icon to `icon/reqochet.ico`.
- Static images: use the PNGs from `icon/png/` and `logo/*-2000.png` (scale down), or the SVGs
  if the toolkit renders SVG.
- Animated SVG CSS does not run in native toolkits. Rebuild the motion in the toolkit's own
  animation system using the exact spec in section 4 (all values are in the SVG's own units;
  the icon viewBox is 1739.3 units wide, so 58 units ≈ 3.3 % of the icon width).

## 4. Motion spec (for porting)

Dot colours: red `#D7262B` (in the q), green `#1F9D48` (in the o).

**Loading** — loop 1.4 s. Each dot hops straight up and lands with a squash; green starts 0.7 s after red.
Transform origin = bottom centre of the dot.

| time | translateY | scale (x, y) | easing to next |
|---|---|---|---|
| 0 % | 0 | 1.18, 0.82 | ease-out |
| 8 % | 0 | 1, 1 | cubic-bezier(.2,.7,.3,1) |
| 26 % | −300 units (wordmark) / −230 (icon) | 0.94, 1.06 | cubic-bezier(.6,0,.85,.4) |
| 44 % | 0 | 1, 1 | ease-out |
| 48 % | 0 | 1.18, 0.82 | ease-in |
| 56–100 % | 0 | 1, 1 | — |

**Assistant eyes** — both pupils move together (one group); pupils are drawn at 86 % of the logo dot size.
- *idle*, loop 6 s: 0–38 % centre · 42–58 % look left (−58, +6) · 62–76 % centre · 80–90 % look up-right (+44, −40) · 94–100 % centre.
  Blink (scaleY 1 → 0.08 → 1, origin = pupil centre, ≈ 0.2 s): at 66–69.5 %, and a double blink at 92–94.5 % and 96–98.5 %.
- *thinking*, loop 1.6 s linear: pupils circle: (0,−54) → (54,0) → (0,54) → (−54,0) → back. Blink every 3.2 s (at 46–50 %).
- *still*: no motion (use when the assistant panel is closed or the window is inactive).

## 5. Rules (do not break)

- Use only these files. Never set the name in a font, never draw your own version.
- Never change the dot colours, swap them, or remove them. Never recolour the letters (only ink `#1b1f27` or white).
- Keep clear space around the name equal to the height of the letter "o". Minimum name width 100 px.
- Below 32 px use the `-small` icon cut. Never stretch or rotate anything.
- Don't place the name on mid-tone or busy backgrounds (e.g. the primary blue `#2f5bd3`); use the app's
  background/surface colours.
- Red/green here are logo colours only; do not use them for app status, and do not use the app's
  success/danger colours in the logo.
- Respect reduced motion: the animated files already do; ported animations must too.

## 6. Done checklist

- [ ] `.exe`, taskbar and installer show `reqochet.ico` (check 16 px and 32 px are crisp).
- [ ] Title bar shows the 16 px small-cut icon; correct side in Arabic; nothing mirrored.
- [ ] About/welcome uses the on-light / on-dark logo matching the current mode, ≥ 160 px wide.
- [ ] Splash shows the loading animation centred; switches with mode.
- [ ] Assistant avatar uses the eyes; `thinking` while a reply is being generated, `idle` otherwise, `still` when hidden.
- [ ] With Windows "Animation effects" off, nothing moves.
