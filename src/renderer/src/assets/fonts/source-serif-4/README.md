# Source Serif 4 (headings of the Ember look)

- Typeface: Source Serif 4 by Adobe — licence: SIL Open Font License 1.1 (`OFL.txt` next to this file; commercial use
  and bundling allowed, the font files may not be sold by themselves).
- Files: the variable font (weights 200–900, upright), cut into the Latin and Latin Extended parts, as published in the
  npm package `@fontsource-variable/source-serif-4` 5.3.1 (unchanged).
- Used by: `@font-face` in `src/renderer/src/styles.css`; the theme token `typography.fontFamilyHeadingEmber`
  (`config/theme.json`) names it for headings while the Ember look is on. Arabic letters are not in it — they fall back
  to the interface font named after it in the token.
