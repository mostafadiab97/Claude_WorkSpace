// Contrast of two colours (WCAG 2): the theme editor warns when text gets hard to read (0.24.0). Same formula as the
// contrast test (tests/theme-contrast-0.15.test.ts).

/** #rgb or #rrggbb. */
export const isHexColour = (v: string): boolean => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim())

const six = (hex: string): string => {
  const h = hex.trim()
  return h.length === 4 ? '#' + h.slice(1).split('').map((c) => c + c).join('') : h
}

const luminance = (hex: string): number => {
  const h = six(hex)
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** 1 … 21; 4.5 is the usual minimum for text, 3 for large text, edges and icons. */
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number]
  return (x + 0.05) / (y + 0.05)
}
