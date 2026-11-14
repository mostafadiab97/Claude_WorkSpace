# Theming reqochet

All visual styling comes from **one file: `config/theme.json`**. UI components never contain colours,
fonts or radii — they reference named tokens, so restyling or rebranding is a one-file change.

## The theme editor (0.24.0)

Settings → **Theme editor** edits the same file without typing JSON: every key below, colours per mode, live preview,
Reset per value, a contrast warning, and **Save my theme**, which writes only the values that differ from the app theme
(other keys of your file — `brand`, notes — are kept; the core checks the values and writes atomically). Editing the
file by hand still works; the editor shows what is in it.

## Where the file is

Themes are layered: **built-in defaults ← the app's theme ← your theme**.

- **Your theme:** `%APPDATA%\reqochet-dev\theme.json`. Click **Edit my theme…** in reqochet to create it and open its folder.
  It starts almost empty: add only the values you want to change, so later improvements to the app theme
  still reach every value you haven't changed. Updates never touch this file. A custom logo file can be put
  in the same folder.
- The app's theme: `%LOCALAPPDATA%\Programs\reqochet-dev\resources\config\theme.json` (source: `config/theme.json`).
  It is replaced by every update, so don't edit it on a user PC.

Edit your file, save, and restart reqochet. No rebuild needed.

## What you can change

| Group | Example keys | Becomes CSS variable |
| --- | --- | --- |
| `brand` | `name`, `logo` (file name in the `resources` folder: .svg, .png, .jpg) | — |
| `typography` | `fontFamily`, `fontSizeBase`, `fontWeightStrong` | `--rm-font-family`, `--rm-font-size-base` |
| `shape` | `buttonRadius`, `radiusLarge`, `borderWidth` | `--rm-shape-button-radius` |
| `spacing` | `xs` … `xxl` (0.22.0: `lg` 16, `xl` 24, `xxl` 32 px; a user theme that sets `lg`/`xl` keeps its own values) | `--rm-space-md` |
| `modes.light` / `modes.dark` / `modes.ember` (0.22.0: the warm dark mode; same keys as dark) | `background`, `surface`, `text`, `primary`, `danger`, `rowHover`, `selection`, `scrollbarThumb`, `scrollbarThumbHover`, `diffOldBg` / `diffNewBg` / `diffOldMark` / `diffNewMark` (the Changes view's red and green), `gap` (the coverage-gap dot, 0.20.1) … | `--rm-color-primary` (for the active mode) |

Added by the visual polish (12 Nov 2026): `borderStrong` (the edge of buttons and fields — `border` is for dividing
lines only), `successBg` / `warningBg` / `dangerBg` / `infoBg` (backgrounds of notes and bars), `fontSizeMedium` (16 px:
dialog and panel titles), `fontWeightMedium` (requirement titles), `fontSizeBaseArabic` / `fontSizeSmallArabic` (the
text sizes while the window is in Arabic), `controlHeight` / `controlHeightSmall` (the height of buttons, fields and
lists), `shadowPopover` / `shadowDialog` (offset and blur of the shadows; their colour is mixed from `text`), and the
spacing step `xxl` (the scale is now 4, 8, 12, 16, 24, 32).

Ember's headings (13 Nov 2026): `fontFamilyHeadingEmber` names the typeface of titles and headings while the Ember look
is on — Source Serif 4 (SIL OFL 1.1, bundled in `src/renderer/src/assets/fonts/source-serif-4`), then the interface
font, which also draws Arabic headings. Body text and controls keep `fontFamily`.

You only need to include the values you change; everything else falls back to the built-in defaults.
Invalid values are ignored and listed as warnings on the start screen, so a typo can never break the app.

## Example: change the brand colour in dark mode only

```json
{ "modes": { "dark": { "primary": "#ff8a3d", "primaryHover": "#ffa766" } } }
```

## For developers

- Tokens are applied in `src/renderer/src/theme/` (`tokens.ts` maps names, `applyTheme.ts` sets them).
- Use `var(--rm-...)` in styles. `tests/theme-tokens.test.ts` fails the build on literal colours in UI code.
- When adding a token, add it to `src/modules/theme/defaults.ts` and `config/theme.json` (a test checks they match).
