# Theming ReqMan

All visual styling comes from **one file: `config/theme.json`**. UI components never contain colours,
fonts or radii — they reference named tokens, so restyling or rebranding is a one-file change.

## Where the file is

Themes are layered: **built-in defaults ← the app's theme ← your theme**.

- **Your theme:** `%APPDATA%\ReqMan\theme.json`. Click **Edit my theme…** in ReqMan to create it (it starts as a
  copy of the app's theme) and open its folder. Updates never touch this file. A custom logo file can be put
  in the same folder.
- The app's theme: `%LOCALAPPDATA%\Programs\ReqMan\resources\config\theme.json` (source: `config/theme.json`).
  It is replaced by every update, so don't edit it on a user PC.

Edit your file, save, and restart ReqMan. No rebuild needed.

## What you can change

| Group | Example keys | Becomes CSS variable |
| --- | --- | --- |
| `brand` | `name`, `logo` (file name in the `resources` folder: .svg, .png, .jpg) | — |
| `typography` | `fontFamily`, `fontSizeBase`, `fontWeightStrong` | `--rm-font-family`, `--rm-font-size-base` |
| `shape` | `buttonRadius`, `radiusLarge`, `borderWidth` | `--rm-shape-button-radius` |
| `spacing` | `xs` … `xl` | `--rm-space-md` |
| `modes.light` / `modes.dark` | `background`, `surface`, `text`, `primary`, `danger` … | `--rm-color-primary` (for the active mode) |

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
