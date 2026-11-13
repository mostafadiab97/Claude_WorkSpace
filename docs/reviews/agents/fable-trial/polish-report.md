# Visual polish of reqochet-dev — what was built (trial, 12–13 Nov 2026)

Branch `fable-visual-polish` (a worktree, not pushed), on top of `b542318` (0.21.3 + the visual review). It builds
the owner's decisions of 12 Nov 2026 on `fable-trial-visual-review.md`. No version bump, no release: the owner has
not seen it yet. Main has moved on meanwhile (0.21.4); this branch was **not** merged with it — the files touched are
listed at the end so the merge can be planned.

## 1. The owner's seven points

| # | Decision | What was done |
| --- | --- | --- |
| 1 | Keep the tile; repair the small icon sizes | New drawings for **16 px and 20 px only**, on the pixel grid: `resources/brand/icon/reqochet-icon-16.svg`, `-20.svg` and `reqochet-icon-light-outlined-16.svg`, `-20.svg`. The dots are whole pixels (2 × 2) with ink around them, the outline is exactly one pixel, lighter on the dark tile (`#aab3c2`) and darker on the white one (`#6b7587`) so the tile reads on both taskbars. `tools/brand-icons.mjs` uses a size's own drawing when there is one; the PNG and both `.ico` files were remade. 24 px and above are unchanged (they were already clean). Enlarged picture: `icon-small-sizes.png`. The drawings inside the app are untouched. |
| 2 | Toast: no change in the app, a comparison picture | `toast-compare.png`: today's note and the calmer V-20 recipe, light and dark, a "done" and a "problem" note each. The app's toast rules were not touched. |
| 3 | Logo eyes still while idle | The top-bar face is the still icon; it moves only while the app works (`App.tsx`). |
| 4 | Top bar keeps icon + name | Unchanged. |
| 5 | The top 5 and the palette | See section 2. |
| 6 | Changes view: title on a shaded bar | Each requirement's card starts with a bar on `surfaceAlt` (rounded top, a line below), the title at normal size, the difference right under it — like the file-name bar of a pull request. It stays at the top while the card scrolls. Checked in light, dark and Arabic (`after/10b-split-difference*.png`, `after/language-2-arabic-changes*.png`). |
| 7 | Arabic wordmark, proposal only | `wordmark-ar.svg` (and `wordmark-ar-on-dark.svg`), preview next to the English one: `wordmark-ar-preview.png`. Letter outlines from **Baloo Bhaijaan 2**, weight 600 (Copyright 2019 The Baloo 2 Project Authors, **SIL Open Font License 1.1**), converted to paths; a red dot in the eye of the و and a green dot in the bowl of the ه, read right to left (red first, as in "qo"). Weak point, said plainly: the ه of this font has no open counter, so the green dot sits on ink without a white ring; a hand-drawn ه with an open eye would match the "o" better. Not used anywhere in the app. |

## 2. The top 5 and the palette

**One icon set (V-31, V-32).** `src/renderer/src/components/icons.tsx`: 18 icons as inline SVG (`<Icon name=… />`,
`<Chevron open=… />`), 16 px, drawn in the text colour. They replace every typed character that was used as an icon:
gear, close crosses, expand / collapse all, branch sign, open / closed triangles, sort arrows, up / down arrows, undo
arrow, warning sign, bin, drag handle; Filters, Columns and Back got an icon beside their word. Buttons keep their
accessible names (`aria-label`), so screen readers and the e2e tests find them as before. Arrows that follow the
reading direction are mirrored in Arabic by CSS. Every drop-down list now has the same arrow, drawn in CSS with the
list's own text colour (no native arrow beside typed triangles).

**Icon licence.** The paths are from **Lucide** (lucide.dev), **ISC licence** (parts from Feather, MIT), copied
unchanged; the full licence notice is at the top of `icons.tsx`. No npm package was added. Commercial use is allowed.

**Clear edges (V-12, V-13, V-33).** New token `borderStrong` (3:1 or better against white, page and header shade) on
buttons, fields, lists and the segmented switch; `border` is now for dividing lines only. The default button is white
with that edge; hover goes one shade down. Disabled is a look of its own (flat `surfaceAlt`, muted words, quiet edge,
no transparency) — also for the primary button and the lists.

**Table on white, top bar in two groups (V-01, V-02).** Rows sit on the panel white, the header one shade down.
The Git bar: branch, Pull, Push and the sync state; a divider; then Changes, Versions, Traceability as quiet buttons
(the open one is filled with the selection colour). The owner's order of 10 Nov is kept.

**One work bar (V-05).** The document picker, its links and the toolbar are one line of controls that wraps as one.
At 1400 px with the editor open this is two rows where there were three (document row + two toolbar rows); on a wide
window without the editor it is one. The 0.21.1 behaviour is kept: the bar wraps, and "+ New item" stays with
"At the end" in `.toolbar__group`.

**Type and size tokens (V-21, V-22, V-28).** `fontSizeMedium` (16 px) for dialog and panel titles;
`controlHeight` 32 px / `controlHeightSmall` 24 px for buttons, fields, lists and icon buttons; the typewriter font is
kept for IDs and paths only (the sync state is a normal sentence now, also in Arabic); the editor's ID is not bold.

**Palette (section 3 of the review).** All proposed values are in `config/theme.json` and
`src/modules/theme/defaults.ts`: the light and dark colour changes, `borderStrong`, the four status backgrounds
(`successBg`, `warningBg`, `dangerBg`, `infoBg`), `fontSizeMedium`, `fontWeightMedium`, spacing `4 / 8 / 12 / 16 / 24 /
32` (new step `xxl`), `radiusLarge` 10 px, the control heights and the two shadow tokens. Two more tokens were needed:
`fontSizeBaseArabic` (15 px) and `fontSizeSmallArabic` (13 px). `docs/THEMING.md` lists them.
A user theme that sets `spacing.lg` or `xl` keeps its own values.

## 3. Findings: done and not done

| Finding | State | Note |
| --- | --- | --- |
| V-01, V-02 | Done | |
| V-03 | Not done | Owner's decision 4: icon and name stay. |
| V-04 | Partly | The start content sits lower (8 % of the window height). The brand in the top bar stays (decision 4). |
| V-05 | Done, differently | One flowing bar instead of a "More" menu: Import and Export stay visible buttons (the e2e tests and the user guide name them). |
| V-06 | Not done | Needs a change of the History tab's layout code, not a token — left for a version of its own. |
| V-07 | Partly | The editor is narrower (`clamp(360px, 28vw, 480px)`). The Title column width is set in code (column widths the user can drag) — not changed. |
| V-08 | Done | Back is a plain button with an arrow icon. Its text is now "Back" (the typed arrow is gone), Arabic too. |
| V-09, V-30 | Done | Dialog shadow token; 16 px above and below dialog header and footer. |
| V-10 | Not done | Needs new texts (English + Arabic) and a product decision on folding empty rules. |
| V-11 | Done | The drag hint is not shown in Traceability. |
| V-12 – V-17 | Done | Palette and `borderStrong`; the unfinished coverage bar uses the amber `gap` colour. |
| V-18 | Partly | Notes (`notice--ok / --warn / --error`), the old-version bar and the folder / document notices use the four background tokens. The settings panel shade and a few other mixed colours stay. |
| V-19 | Partly | No strike-through on removed words in running text (single values keep it). The sign column was not added. |
| V-20 | Not done in the app | Owner's decision 2 — mock-up only. |
| V-21, V-22, V-28 | Done | |
| V-23 | Done with point 6 | Title at normal size in the bar; ID and type stay on the same line. |
| V-24 | Done | Requirement titles weight 500, headings 600. |
| V-25 | Done | Equal-width digits in the number column, counts and the status bar. |
| V-26 | Open | Judge type on the Windows (CI) screenshots; the pictures here are from Linux with a fallback font. |
| V-27 | Partly | The scale is in the tokens; the literal `px` values in old rules were not all replaced (many are widths). |
| V-29 | Done | `radiusLarge` 10 px; switch items and fields take the button corner. |
| V-31 – V-33 | Done | |
| V-34 | Partly | Link marks in the matrix are in the text colour, amber only for suspect. They are still typed arrows (the legend text and the Excel export use the same characters). |
| V-35, V-36 | Done as decided | Small sizes repaired, tile kept (point 1). |
| V-37 | Done | Point 3. |
| V-38 | Not done | The tile stays (the owner found the tile-less mark creepy). |
| V-39 | Not applicable | Follows V-03. |
| V-40 | Nothing to do | A rule for later work. |
| V-41, V-42, V-43 | Done | Arabic: 15 / 13 px, line height 1.6, table headers by colour instead of weight, sync state in the normal font. |
| V-44 | Partly | New pictures: Arabic table in dark, Arabic Changes view light and dark, Changes view dark. Matrix and dialogs in Arabic are still missing. |

## 4. Checks

- `npm run check`: green (typecheck, ESLint, unit tests). Two tests asserted old visuals and were updated:
  `tests/apply-theme.test.ts` (spacing `lg` is 16 px) and `tests/ui/keys-0.21.1.test.ts` (the typed closed triangle
  no longer exists — the icon is mirrored by CSS).
- `npm run build`: green.
- `xvfb-run -a npm run test:e2e`: all scenarios pass. Selectors changed: the Back buttons are found as "Back"
  (exact) and "Back to Traceability"; the journey and language scenarios take the extra dark and Arabic pictures.
- Not checked: Windows itself (fonts, the real taskbar), the installer, a user theme made before this change.

## 5. Pictures

- `after/` — start screen (light, dark), table with editor, Changes view (light, dark), Versions, Traceability
  (coverage, matrix, impact), settings, dark table, Arabic (table light and dark, Changes light and dark).
- `before/` — the same screens from `b542318` where the picture existed then.
- `toast-compare.png`, `icon-small-sizes.png`, `wordmark-ar.svg`, `wordmark-ar-on-dark.svg`, `wordmark-ar-preview.png`.

## 6. Things to know before merging

- **Texts changed:** `settings.back`, `trace.backToTrace`, `columnsMenu.button`, `workspace.problemCount` lost their
  typed arrows / triangles (English and Arabic); `problemCount` takes one argument now.
- **`closedMark()` was removed** from `lib/keys.ts` (replaced by `<Chevron />`).
- **`DocumentBar` and `Toolbar` are wrapped in `<div className="workbar">`** in `WorkspaceScreen.tsx` and are laid out
  with `display: contents`. Main's 0.21.4 "Delete document" button in `DocumentBar.tsx` will simply flow in the bar;
  `DocumentBar.tsx` itself was not edited here.
- The spacing steps `lg` (20 → 16 px) and `xl` (32 → 24 px) changed for the whole app; `xxl` is the old `xl`.

## 7. Files touched

See the commit (`git diff --stat b542318..fable-visual-polish`). In short: `config/theme.json`,
`src/modules/theme/defaults.ts`, `src/shared/text.ts`, `src/shared/text-ar.ts`, `src/renderer/src/styles.css`,
`src/renderer/src/components/icons.tsx` (new), `src/renderer/src/lib/keys.ts`, `src/renderer/src/app/App.tsx`,
the three screens in `src/renderer/src/screens/`, in `src/renderer/src/workspace/`: `BranchMenu`, `ChangeView`,
`ChangesView`, `ExportDialog`, `FieldsPanel`, `GitPanels`, `HistoryDialog`, `ImpactView`, `ImportDialog`, `ItemEditor`,
`ItemTable`, `LinksSection`, `RulesPanel`, `SuspectLinksDialog`, `TraceabilityView`, `TypesPanel`, `screen/Problems`,
`screen/Toolbar`; `tests/apply-theme.test.ts`, `tests/ui/keys-0.21.1.test.ts`; e2e scenarios `health`, `journey`,
`language`, `trace-0.20`; `tools/brand-icons.mjs`, `tools/README.md`; `resources/brand/` (4 new drawings, 4 PNG, 2 ICO,
README); `docs/THEMING.md`, `docs/ARCHITECTURE.md`; this folder.
