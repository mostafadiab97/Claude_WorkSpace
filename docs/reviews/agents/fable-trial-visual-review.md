# Visual review of reqochet-dev 0.21.3 (trial, 12 Nov 2026)

**Scope.** Commit 7b01fc6 (0.21.3). A visual review only: layout, colour, typography, spacing, icons, logo and brand, Arabic. I looked once at 20 screenshots from today's run in `e2e/out` (start screen light and dark, `01`, `04`, `05`, `07`, `08`, `10`, `10b`, `11`, `12`, `branches-1`, `history-0.18-baselines`, `history-0.19-version`, the three `trace-0.20-*`, `health-3-guide`, `language-1-arabic`) and at `resources/brand/brand-sheet.png`. I read `config/theme.json`, `docs/THEMING.md`, the brand README, `Brand.tsx` and the matching rules in `src/renderer/src/styles.css`. Contrast numbers are calculated with the WCAG formula from the theme values. Items already listed in `whole-project-0.21-ui-ux-reviewer.md` are not repeated; where one touches a finding here I name its ID.

**Limits.** The other 29 screenshots were not opened (import, export, Excel, health report, privacy, groups, branch review). Dark mode was seen on three screens only (start, table, settings); there is no dark or Arabic picture of Changes, Traceability or the dialogs. The screenshots were made on Linux, where the text falls back to a font that is not Segoe UI Variable, so remarks on type are about sizes and weights, not letter shapes. The logo variant was drawn pixel by pixel with a script at 16, 20, 24, 32 and 48 px; the SVG file is valid XML but was not opened in a browser here.

F = checked (line, picture or calculation). I = likely, not proven. Effort: S = hours, M = a day or two, L = more.

## 1. Verdict

**What looks professional.** The structure is right for an engineering tool: a calm two-pane layout, one accent colour, restrained use of red and amber, and a consistent tab and dialog pattern. The token system holds: there are no literal font sizes in the stylesheet, and text contrast is at AA almost everywhere (body text 15.4:1, muted text 4.85:1 or better on every fill). The start screen and the empty-project card are clear and well worded. The wordmark is distinctive and well drawn. Right-to-left mirroring is thorough.

**What looks unfinished.** Four things would make a designer say "prototype":

1. **There is no icon set.** Every icon is a typed character (gear, boxed plus, branch sign, triangles, arrows). They differ in weight and size and sit next to native drop-down arrows.
2. **Buttons and fields have no clear edge.** The default button is a grey fill at 1.06:1 against the page, and field borders are at 1.36:1. An enabled button and a disabled one look nearly the same.
3. **The hierarchy is inverted.** The data (table rows) sits on the grey page colour while the chrome around it is white. Four rows of controls (180 px) come before the first requirement, and the top bar is a line of six identical pills.
4. **The app icon is weak at 16 px and on a dark taskbar.** Its outline costs a pixel on every side, the dots blur into the letters, and the dark tile is 1.01:1 against a dark taskbar.

None of this needs a redesign. Most of it is token values and about a dozen CSS rules.

## 2. Findings

### Layout and hierarchy

| ID | Where | Severity | Effort | What is wrong | Fix |
| --- | --- | --- | --- | --- | --- |
| V-01 | `04-table-and-editor.png`; `styles.css:720` (row), `:1215` (editor) | High | S | F: table rows are drawn on the page grey (`background`), while the top bar, toolbar and editor are white (`surface`). The content is the dullest area of the screen. | `.table__scroll { background: var(--rm-color-surface) }`. The header keeps `surfaceAlt`. Hover and selection tokens stay. |
| V-02 | `04`, `10`; top bar | High | M | F: branch, Pull, Push, Changes, Versions, Traceability are six equal grey pills followed by a status in typewriter font. Actions (Pull, Push) and views (Changes, Versions, Traceability) are not told apart. | Two groups with a divider between (1 px `border`, 16 px tall, margin `sm`). Group 1: branch, Pull, Push, then the sync state. Group 2: the three views as quiet buttons (transparent, no border; active = `selection` fill and `primary` text). |
| V-03 | `App.tsx:114-115`; every workspace screenshot | Medium | S | F: the top bar shows the icon and the 112 px name. Both contain the same "qo", and together they take about 190 px of the most crowded row, so the repository name is cut ("…journey-repo-…"). | With a repository open, show the icon and "DEV" only. Keep the name for the start and settings screens. Frees about 120 px. |
| V-04 | `00-start-screen-light.png`, `-dark.png` | Medium | S | F: the brand appears three times on one screen (top-bar icon, top-bar name, hero tile and name). The content hangs at the top with about 400 px empty below. | Hide the top-bar brand on the start screen. Push the hero column down: `margin-block-start: 12vh`. |
| V-05 | `04`: top bar 39 px, document row 28, toolbar 2 × 38, header 37 | Medium | M | F: 180 px of controls (21 % of an 860 px window) come before the first row. This builds on B-01 of the earlier report. | One toolbar row: document picker first, then search, Filters, Columns, Show text; Import and Export in one "More" menu; insert position and New item at the end. |
| V-06 | `11-history.png`, editor History tab | Medium | S | F: the "What changed" table is wider than the panel. The After column is off screen and the panel gets a horizontal scrollbar. | Use the stacked (old above new) layout whenever the panel is under 520 px. `table-layout: fixed; inline-size: 100%`. |
| V-07 | `04`; `styles.css:1213` | Medium | S | F: with the editor open (32vw) the Title column stays 240 px and wraps to three lines, while Links, Owner and Tags are empty and the table scrolls sideways. | Title column `minmax(280px, 1fr)` so it takes the free width. Editor `clamp(360px, 28vw, 480px)`. |
| V-08 | `08-settings-wide.png`, `health-3-guide.png` | Medium | S | F: "Back" is the only solid blue element on the screen, so the way out is stronger than the content. | Plain `.btn` with the arrow icon. |
| V-09 | `styles.css:987-995` vs `:763` | Medium | S | F: dialogs have a border but no shadow, while pop-ups have one and the toast has a glow. The top layer looks the flattest. | New token `shadowDialog: 0 16px 48px` of `text` at 24 %, used on `.modal__panel`. |
| V-10 | `trace-0.20-coverage.png` | Low | S | F: a boxed "warning" chip sits on every rule, including the 100 % green one, and reads as a state. Four empty rules fill most of the screen. | Show the level as muted text ("level: warning") and only when the rule has gaps. Fold empty rules into one line ("4 rules have no items yet"). |
| V-11 | `trace-0.20-coverage.png` status bar | Low | S | F: the hint "Drag a row onto another row…" is shown in Traceability, where there are no rows to drag. | Show it in the table view only. |

### Colour

| ID | Where | Severity | Effort | What is wrong | Fix |
| --- | --- | --- | --- | --- | --- |
| V-12 | `theme.json` `border`; all fields | High | S | F: field borders are 1.36:1 on white (light) and 1.39:1 (dark). WCAG 1.4.11 asks 3:1 for the edge of a control. | New token `borderStrong`: light `#7f8898` (3.57:1 on surface, 3.24 on page), dark `#6b7587` (3.55:1). Use it on inputs, selects, text areas, check boxes and default buttons. `border` stays for dividers. |
| V-13 | `styles.css:298-338`; `01-empty-repo.png` (Export… beside Import…) | High | S | F: the default button fill is 1.06:1 against the page, and disabled is the same button at 50 % opacity. Enabled and disabled differ only by text darkness. | `.btn`: `surface` fill, `borderStrong` border, hover `surfaceAlt`. Disabled: `surfaceAlt` fill, `textMuted` text, `border` edge, no opacity. |
| V-14 | `08-settings-wide.png` (selected item), `07-dark.png` (Show text) | Medium | S | F: dark `primary` text on `selection` is 4.35:1, below 4.5. | Dark `primary` `#7c9cff`, `selection` `#25345a`: 4.69:1. |
| V-15 | `theme.json` dark `diffNewMark` | Medium | S | F: dark text on the green word mark is 4.43:1. | `diffNewMark` `#1a6b40` (5.41:1), `diffOldMark` `#7a2a30` (7.92:1). |
| V-16 | `04` selected row | Low | S | F: the amber gap dot is 2.9:1 on the selected row (3:1 needed for a graphic). | Light `gap` `#c96a00`: 3.09:1 on selection, 3.79 on white. |
| V-17 | `trace-0.20-coverage.png` | Medium | S | F: the unfinished bar is filled with the amber text colour (`#8f5600`), which as a fill reads as brown. | Fill with `gap`, not `warning`. `warning` is for text. |
| V-18 | `styles.css`: 18 `color-mix` uses, e.g. `:2725`, `:3986` | Medium | M | F: status backgrounds are mixed ad hoc. The read-only bar is beige, the schema note is amber text on a grey box, the toast is grey. | Four tokens `successBg`, `warningBg`, `dangerBg`, `infoBg` (values in section 3), used for every banner, note and toast. |
| V-19 | `10b-split-difference.png` | Medium | S | F: removed text has three signals at once (strike-through, pink word mark, pink line), so a long removed sentence is hard to read. Added and removed differ by colour only when the strike is ignored. | No strike-through in multi-line text; keep it for single values. Add a narrow sign column ("−" / "+") so the meaning does not rest on colour. |
| V-20 | `styles.css:2725-2727`; `07`, `11` | Medium | S | F: the toast has a 2 px coloured frame, a 3 px ring and a 28 px coloured glow on a grey fill. It is the loudest element in the app, and in light mode the grey fill looks like a disabled field. The look is an owner decision (0.13.1 / 0.14.1), so see question 2. | Calmer recipe: `successBg` fill, 1 px `success` border, neutral shadow, a check icon, text at the start. |

### Typography

| ID | Where | Severity | Effort | What is wrong | Fix |
| --- | --- | --- | --- | --- | --- |
| V-21 | `styles.css:1509-1512`; `04` top bar and editor header; `language-1-arabic.png` | Medium | S | F: the typewriter font is used for prose ("not pushed yet", which in Arabic renders in a typewriter fallback) and at 18 px bold for the ID in the editor header. | Typewriter font for IDs, hashes and paths only. `.gitbar__sync { font-family: inherit; font-size: var(--rm-font-size-small) }`. Editor header: ID at 14 px normal weight, outline number muted. |
| V-22 | `theme.json` typography; `10-changes-view.png` | Medium | S | F: the scale is 12 / 14 / 18 / 24 with no step between 14 and 18. On Changes three 18 px bold headings compete ("Changes", each item title, "Commit"). | New token `fontSizeMedium: 16px` for item titles in cards, dialog titles and panel titles. One 18 px title per screen. |
| V-23 | `10` card header | Low | S | F: one line mixes five styles (letter badge, typewriter number, typewriter ID, 18 px bold title, 14 px muted type). | Title at 16 px semibold; ID and type together on a 12 px muted line below. |
| V-24 | `04`, `trace-0.20-impact.png` | Low | S | F: every title in the table is semibold, so a heading row ("Chapter 1 — Heating") looks like a requirement. | New token `fontWeightMedium: 500` for requirement titles; headings keep 600. |
| V-25 | `styles.css:2970` (only use) | Low | S | F: equal-width digits are set in one place only. Outline numbers and counts shift in width. | `font-variant-numeric: tabular-nums` on the number column, the status bar and count chips. |
| V-26 | all screenshots | Low | S | I: local screenshots use a fallback font, so they do not show what the owner sees on Windows. | Judge type on the CI (Windows) screenshots, or name the font used in the screenshot run. |

### Spacing and density

| ID | Where | Severity | Effort | What is wrong | Fix |
| --- | --- | --- | --- | --- | --- |
| V-27 | `styles.css`: 187 lines with literal `px` (`grep -c`) | Medium | M | F: literal sizes bypass the scale (24 px 12 times, 28 px 8 times, 3 px 11 times, 6 px 7 times, plus 22 and 30). The scale jumps from 12 to 20 with no 16. | Spacing `xs 4, sm 8, md 12, lg 16, xl 24, xxl 32` (today `lg` is 20 and `xl` 32). Replace literal paddings and gaps with tokens. Widths of panels may stay literal. |
| V-28 | `04` toolbar row; `styles.css:298-350` | Medium | S | F: controls in one row have different heights (button about 31 px from padding, icon button 30 px, input and select about 32 px, small button 24 px). | New tokens `controlHeight: 32px` and `controlHeightSmall: 24px` as `min-block-size` on buttons, inputs, selects and icon buttons. |
| V-29 | `04`, `08`: radii 0, 4, 6, 8, 12 and pill | Low | S | F: six corner shapes in one view. The segmented switch has an 8 px shell with 4 px items, which is not concentric with 2 px padding. | `radiusLarge` 10 px. Segmented items `buttonRadius` (6 px). Inputs take `buttonRadius`. |
| V-30 | `styles.css:1001`, `:1020` | Low | S | F: dialog header and footer have 12 px above and below but 20 px at the sides, tight against a 12 px corner. | 16 px block padding (`lg` in the new scale). |

### Icons and graphics

| ID | Where | Severity | Effort | What is wrong | Fix |
| --- | --- | --- | --- | --- | --- |
| V-31 | `App.tsx:146` (gear), `Toolbar.tsx:49` (boxed plus), `GitPanels.tsx:142` (branch sign), `ChangeView.tsx:30` (undo arrow); no `<svg` in any `.tsx` (`grep`) | High | M | F: every icon is a text character taken from whatever font has it. Sizes and weights differ, and the gear, the only way to Settings, is a 12 px grey mark. I: the branch sign may be missing from the Windows fonts and show as an empty box. | One open-source set as inline SVG components, 16 px, `currentColor`, 1.5 px line: Fluent UI System Icons (MIT, matches Windows 11) or Lucide (ISC). About 16 icons: settings, expand all, collapse all, chevron down and right, close, arrow up and down, branch, undo, warning, plus, back, filter, columns, search. |
| V-32 | `04` second toolbar row | Medium | S | F: three kinds of drop-down arrow sit side by side: the native one ("At the end"), a typed triangle ("Columns ▾") and the split button. | The set's chevron everywhere. Selects with `appearance: none` and the chevron as a masked background at the inline end. |
| V-33 | `04`: "At the end" (grey) vs Type and Status in the editor (white) | Low | S | F: the same control has two looks. | One select style: `surface` fill, `borderStrong` edge. |
| V-34 | `trace-0.20-matrix.png` | Low | S | F: the link marks are 10 px arrows in the success green, which suggests "passed" and not "linked". Visual side of UW-07. | 14 px arrow icons in `text`; amber only for suspect. |

### Logo and brand

| ID | Where | Severity | Effort | What is wrong | Fix |
| --- | --- | --- | --- | --- | --- |
| V-35 | `resources/brand/icon/png/reqochet-icon-16.png`, `-light-16.png` (enlarged 6 times) | Medium | M | F: at 16 px the outline takes one pixel on each side. The letters are about 1.9 px thick with a 3 px opening that holds a 1.8 px dot, so 0.6 px is left around the dot. The dots blur into the letters, and the white tile turns to a grey smudge. | See the variant in section 4. Without a redesign: drop the outline from the 16 and 20 px images only, and enlarge the letters to fill the tile. |
| V-36 | brand README; calculated | Medium | M | F: the dark tile is 1.01:1 on a dark taskbar and the white tile 1.11:1 on a light one. Each is seen only by its outline (4.34:1 dark; 2.29:1 light, below 3). Windows cannot swap a program's icon by taskbar colour, so one of the two cases is always weak. | A mark that carries both tones itself (section 4). |
| V-37 | `App.tsx:114` (state `idle`); brand sheet "Motion" | Medium | S | F: the top-bar icon glances and blinks on a 6 s loop all day. The brand sheet says "Use the eyes only for the assistant". Movement at the edge of sight tires people in an all-day tool. | Still icon in the top bar; `thinking` only while the app works. See question 3. |
| V-38 | `00-start-screen-dark.png`; `StartScreen.tsx:92` | Medium | S | F: in dark mode the 88 px white tile is the brightest thing on the screen. | On dark surfaces at 48 px and above, use the letters without a tile (the `-inline` drawings exist). |
| V-39 | `App.tsx:115` | Low | S | F: the name is 112 px wide, just above the brand minimum of 100 px, where the dots are about 3 px. | Solved by V-03. |
| V-40 | brand colours | Low | — | F: the red and the green are 1.42:1 against each other and close in lightness, so a red-green colour-blind user sees two similar dots. Position (q, o) carries the meaning, which is enough. | Never let the dot colour alone carry meaning in the app. |

### Arabic (right to left)

| ID | Where | Severity | Effort | What is wrong | Fix |
| --- | --- | --- | --- | --- | --- |
| V-41 | `language-1-arabic.png`: labels, table header, tabs | Medium | S | I: Arabic letters are smaller in the body than Latin ones at the same size. The 12 px labels and headers are hard to read. | Under `[dir='rtl']`: `--rm-font-size-small: 13px; --rm-font-size-base: 15px`, line height 1.6. |
| V-42 | same, table header | Low | S | I: semibold Arabic at 12 px closes up. | Header weight normal in Arabic with `text` colour (not muted), so it still stands out. |
| V-43 | same, top bar | Medium | S | F: the sync state is Arabic set in the typewriter font. | Same fix as V-21. |
| V-44 | not available | Medium | S | F: there is one Arabic screenshot (table and editor). Changes, Traceability and the dialogs were never seen in Arabic, nor Arabic in dark. | Add four pictures to the language scenario: Changes, matrix, one dialog, the table in dark. |

## 3. Proposed palette

Only tokens where a change helps. Every text pair stays at AA (4.5:1) or better. Numbers in brackets are calculated ratios.

### Light

| Token | Current | Proposed | Why |
| --- | --- | --- | --- |
| `background` | `#f6f7f9` | `#f2f4f7` | White panels and the white table stand out more (1.08 → 1.10); text 14.98:1 |
| `surfaceAlt` | `#eef0f4` | `#e9ecf1` | Headers and hover fills separate from white (1.14 → 1.18) |
| `textMuted` | `#5d6676` | `#566070` | Stays AA on the deeper fills (5.77 page, 5.37 surfaceAlt, 5.18 selection) |
| `border` | `#d9dde5` | `#d5dae2` | Dividers only |
| `borderStrong` (new) | — | `#7f8898` | Edges of controls (3.57 on surface, 3.24 on page, 3.02 on surfaceAlt) |
| `selection` | `#e3ebff` | `#dfe8ff` | Slightly clearer selected row; primary text on it 4.81 |
| `success` | `#15803d` | `#137a39` | 4.68 → 4.92 on the page; further from the logo green |
| `warning` | `#8f5600` | `#8a5300` | 5.74 on the page, 5.8 on `warningBg` |
| `gap` | `#cf7200` | `#c96a00` | 3:1 on the selected row (3.09); also the fill of coverage bars |
| `danger` | `#c23934` | `#b9322d` | 4.68 → 4.99 on surfaceAlt; white on it 5.9 |
| `successBg` (new) | mixed | `#e6f6ec` | Done notes, toast (success text 4.85) |
| `warningBg` (new) | mixed | `#fff4de` | Read-only bar, schema note (warning text 5.8) |
| `dangerBg` (new) | mixed | `#fdecec` | Error notes (danger text 5.17) |
| `infoBg` (new) | mixed | `#eaf0ff` | Questions and offers (primaryHover text 6.93) |

Unchanged: `surface`, `text`, `primary` (5.9 on white), `primaryHover`, `primaryText`, `focus`, `rowHover`, scrollbar and diff tokens.

### Dark

| Token | Current | Proposed | Why |
| --- | --- | --- | --- |
| `background` | `#14171c` | `#121519` | One more step between page and panels |
| `surface` | `#1c2027` | `#1b1f27` | The brand ink itself, so the logo's dark and the UI's dark are one colour |
| `surfaceAlt` | `#252a33` | `#262b35` | Follows the surface |
| `textMuted` | `#9aa3b2` | `#a3acba` | 4.92 → 5.34 on selection; 6.2 on surfaceAlt |
| `border` | `#323844` | `#343b48` | Dividers only |
| `borderStrong` (new) | — | `#6b7587` | Edges of controls (3.55 surface, 3.94 page, 3.06 surfaceAlt) |
| `primary` | `#6f93ff` | `#7c9cff` | 4.35 → 4.69 on selection; dark text on it 7.15 |
| `primaryHover` | `#8aa8ff` | `#94afff` | Follows primary (dark text 8.73) |
| `selection` | `#263352` | `#25345a` | With the new primary |
| `danger` | `#ff6b65` | `#ff7a74` | 5.17 → 5.6 on surfaceAlt (the Delete button) |
| `diffOldMark` | `#8c3036` | `#7a2a30` | Text on it 6.72 → 7.92 |
| `diffNewMark` | `#1e7a48` | `#1a6b40` | Text on it 4.43 → 5.41 |
| `successBg` (new) | mixed | `#15301f` | success text 6.51 |
| `warningBg` (new) | mixed | `#3a2c12` | warning text 6.65 |
| `dangerBg` (new) | mixed | `#3a1d20` | danger text 6.02 |
| `infoBg` (new) | mixed | `#1d2946` | primary text 5.53 |

Unchanged: `text`, `primaryText`, `success`, `warning`, `gap`, `focus`, `rowHover`, scrollbar tokens, `diffOldBg`, `diffNewBg`.

### Other tokens

| Token | Current | Proposed |
| --- | --- | --- |
| `typography.fontSizeMedium` (new) | — | `16px` |
| `typography.fontWeightMedium` (new) | — | `500` |
| `spacing` | `4, 8, 12, 20, 32` | `xs 4, sm 8, md 12, lg 16, xl 24, xxl 32` |
| `shape.radiusLarge` | `12px` | `10px` |
| `shape.controlHeight` / `controlHeightSmall` (new) | — | `32px` / `24px` |
| `shape.shadowPopover` / `shadowDialog` (new) | literal in 5 places / none | `0 6px 24px` / `0 16px 48px`, of `text` at 18 % / 24 % |

## 4. Logo variant

**File:** `docs/reviews/agents/fable-trial/logo-variant.svg`. It holds three symbols (`rq-mark`, `rq-mark-small`, `rq-mark-dark`) and a preview on a light and a dark taskbar grey.

**The idea.** Keep what is recognisable (the q and the o with the red and the green dot, the "eyes") and remove what causes the small-size problems (the tile and its outline). The letters are drawn free-form from circles and one straight line: ink rings, white insides, and a thin white keyline (a rim) around the whole shape. On a light background the eye sees the ink letters; on a dark background it sees the white insides and the rim. One file serves both taskbars, which is how most Windows 11 icons work. The dots always sit on white, so one red and one green are enough (`#D7262B`, `#1F9D48`); the lighter pair is needed only for the app's own dark surfaces.

**How it reads (script render, compared with the current PNG files at the same size).**

| Size | Current icon | Variant |
| --- | --- | --- |
| 16 px | Letters about 9.5 px tall inside the outline; dots blur into the letters | Letters use the full 16 px width; 7 px rings, 4 px white insides, 2 px dots on whole pixels with 1 px of white around. Clearly sharper. The tail of the q is 1.5 px wide and is the weakest part. |
| 32 px | Clean on both tiles; on a dark taskbar the dark tile is seen only by its outline | Clean. 13 px rings, 4 px dots. It covers less area than a tile, so it has less weight in a row of icons. |
| On dark | Dark tile 1.01:1 against the taskbar; white tile fine | The white insides and dots carry it. At 32 px and above the rim is clear and the shape reads as "qo". At 16 px the rim is half a pixel, so it reads as two white eyes with coloured pupils and a faint tail. |

**Honest weak points.** It is lighter than a tile and less of a "button". At 16 px on dark the q is weaker than at larger sizes. The wordmark is unchanged and is not part of this proposal. The current brand rules forbid redrawing, so this is a decision for the owner (question 1), not a fix.

## 5. Top 5 changes for the biggest visual win

1. **One icon set** in place of typed characters (V-31, V-32). Effort M.
2. **Clear edges for buttons and fields:** `borderStrong`, white default button, a real disabled style (V-12, V-13), with the palette of section 3. Effort S.
3. **Table on white, top bar in two groups** (V-01, V-02). Effort S + M.
4. **One toolbar row and the brand once** (V-03, V-04, V-05). Effort M.
5. **Type and size tokens:** a 16 px step, 32 px control height, the typewriter font only for IDs (V-21, V-22, V-28). Effort S.

## Questions for the owner

1. **Icon.** Keep the tile and only repair the 16 and 20 px images (recommended as the first step, small), or go to the free-form variant of section 4 for the Windows icon?
2. **Toast.** Keep the strong frame and glow you chose in 0.13.1 (recommended only if notes were being missed), or the calmer recipe in V-20 now that the note also stays 9 s?
3. **Moving eyes in the top bar.** Still icon while idle (recommended; the brand sheet reserves the eyes for the assistant), or keep the glancing?
4. **Brand in the top bar.** Icon only when a repository is open (recommended, frees 120 px), or icon and name as today?

## Checked, nothing found

- Body and muted text contrast, light and dark: all pairs 4.85:1 or better.
- Primary button: white on blue 5.9:1 (light), dark text on blue 6.48:1 (dark).
- Status words (success, warning, danger) on the page and on `surfaceAlt`, both modes: 4.68:1 or better.
- Literal font sizes or colours in `styles.css`: none found.
- Small buttons in the top bar: 24 px high, which meets the 24 px target minimum.
- Focus ring: 2 px, 5.07:1 on white, visible on the field in `05-fields-dialog.png`.
- Brand in Arabic: icon and name not mirrored, placed at the right, "DEV" on the correct side.
- Arabic mirroring of selects, split button, tabs, scrollbars and the status bar in `language-1-arabic.png`.
- Wordmark and icon files against the brand README: the app uses them unchanged and picks light or dark by mode (`Brand.tsx`).
- Start screen and empty-project card: wording, button order and hierarchy.
- Pull-decision dialog and Fields dialog: alignment and grouping.
