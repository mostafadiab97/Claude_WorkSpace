// Builds the reqochet launch sting as self-contained animated SVGs (CSS inside, plays once, ends on the logo).
// Shapes come unchanged from resources/brand/logo/reqochet-logo-on-light.svg; only timing and colour are added here.
// Usage: node build-sting.mjs            -> ../reqochet-sting-{light,dark,ember}.svg
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '../../../../..')
const logo = readFileSync(join(repo, 'resources/brand/logo/reqochet-logo-on-light.svg'), 'utf8')
const d = logo.match(/<path d="([^"]+)"/)[1]

// The wordmark is one path; split it into letters by where each closed shape starts (x of its first point).
const LETTERS = [
  { id: 'r', to: 500 }, { id: 'e1', to: 1100 }, { id: 'q', to: 1850 }, { id: 'o', to: 2550 },
  { id: 'c', to: 3250 }, { id: 'h', to: 3950 }, { id: 'e2', to: 4620 }, { id: 't', to: 9999 },
]
const parts = Object.fromEntries(LETTERS.map((l) => [l.id, '']))
for (const sub of d.split(/(?=M)/)) {
  const x = parseFloat(sub.slice(1))
  parts[LETTERS.find((l) => x < l.to).id] += sub
}

export const THEMES = {
  light: { bg: '#ffffff', letters: '#1b1f27', eyes: '#1b1f27', red: '#D7262B', green: '#1F9D48' },
  dark: { bg: '#121519', letters: '#ffffff', eyes: '#ffffff', red: '#D7262B', green: '#1F9D48' },
  ember: { bg: '#14100d', letters: '#ff8a3d', eyes: '#f3ebe2', red: '#FF5C61', green: '#3CD873' },
}

export const DURATION = 6 // seconds, including the hold on the finished logo
const Q = { x: 1469.5, y: -273.5 }
const O = { x: 2217.5, y: -273.5 }
const R = 93.3
const LAND = 1.75 // both dots land in their letters at this moment

// Each dot hops over its side of the word; a letter pops up at the moment the dot touches it.
const RED = [
  { t: 0.25, x: -2650, y: -1500 },
  { t: 0.8, x: 250, y: -670, hit: 'r', h: 520 },
  { t: 1.25, x: 790, y: -668, hit: 'e1', h: 330 },
  { t: LAND, ...Q, hit: 'q', h: 560 },
]
const GREEN = [
  { t: 0.05, x: 7750, y: -1700 },
  { t: 0.5, x: 4818, y: -838, hit: 't', h: 420 },
  { t: 0.8, x: 4300, y: -668, hit: 'e2', h: 260 },
  { t: 1.1, x: 3387, y: -898, hit: 'h', h: 240 },
  { t: 1.4, x: 2935, y: -668, hit: 'c', h: 300 },
  { t: LAND, ...O, hit: 'o', h: 520 },
]

function hopKeyframes(name, pts, end) {
  const t0 = pts[0].t
  const t1 = pts[pts.length - 1].t
  const rows = []
  const step = 1 / 60
  for (let t = t0; t < t1 + 1e-6; t += step) {
    const i = Math.min(pts.length - 2, pts.findIndex((p, k) => k < pts.length - 1 && t >= p.t && t <= pts[k + 1].t + 1e-9))
    const a = pts[i], b = pts[i + 1]
    const s = Math.min(1, (t - a.t) / (b.t - a.t))
    const x = a.x + (b.x - a.x) * s
    const y = a.y + (b.y - a.y) * s - 4 * b.h * s * (1 - s)
    const pct = (((t - t0) / (t1 - t0)) * 100).toFixed(2)
    rows.push(`${pct}%{transform:translate(${(x - end.x).toFixed(1)}px,${(y - end.y).toFixed(1)}px)}`)
  }
  rows.push('100%{transform:translate(0,0)}')
  return `@keyframes ${name}{${rows.join('')}}`
}

/** The sting as an <svg> string. `id` prefixes every class and keyframe so several can live in one page. */
export function stingSvg(theme, { id = 'st', background = false } = {}) {
  const c = THEMES[theme]
  const delay = (s) => `calc(var(--t0, 0s) + ${s}s)`
  const hits = [...RED, ...GREEN].filter((p) => p.hit)
  const css = `
.${id}-l{transform-box:fill-box;transform-origin:50% 100%;animation:${id}-pop .42s cubic-bezier(.3,1.5,.5,1) both}
.${id}-ring{animation:${id}-ring .45s cubic-bezier(.3,1.6,.5,1) both}
${hits.map((p) => `.${id}-${p.hit}{animation-delay:${delay(p.t)}}`).join('\n')}
.${id}-hop{animation-timing-function:linear;animation-fill-mode:both}
.${id}-red{animation-name:${id}-red;animation-duration:${LAND - RED[0].t}s;animation-delay:${delay(RED[0].t)}}
.${id}-green{animation-name:${id}-green;animation-duration:${LAND - GREEN[0].t}s;animation-delay:${delay(GREEN[0].t)}}
.${id}-ghost{animation:${id}-ghost 0.01s linear both;animation-delay:${delay(LAND)}}
.${id}-look{animation:${id}-look 2.3s ease-in-out both;animation-delay:${delay(2.25)}}
.${id}-dot{transform-box:fill-box;transform-origin:50% 50%;animation:${id}-land .5s cubic-bezier(.3,1.6,.5,1) both,${id}-blink .7s linear both;animation-delay:${delay(LAND)},${delay(4.75)}}
@keyframes ${id}-pop{0%{opacity:0;transform:scale(.3,.1)}35%{opacity:1}100%{opacity:1;transform:scale(1,1)}}
@keyframes ${id}-ring{0%{opacity:0;transform:scale(.5)}40%{opacity:1}100%{opacity:1;transform:scale(1)}}
@keyframes ${id}-land{0%{transform:scale(1.35,.7)}100%{transform:scale(1,1)}}
@keyframes ${id}-ghost{0%{visibility:visible}100%{visibility:hidden}}
@keyframes ${id}-look{0%{transform:translate(0,0)}14%,34%{transform:translate(-46px,4px)}50%,72%{transform:translate(46px,4px)}88%,100%{transform:translate(0,0)}}
@keyframes ${id}-blink{0%,30%,50%,80%,100%{transform:scaleY(1)}15%,65%{transform:scaleY(.08)}}
${hopKeyframes(`${id}-red`, RED, Q)}
${hopKeyframes(`${id}-green`, GREEN, O)}
@media (prefers-reduced-motion: reduce){.${id} *{animation:none!important}.${id}-ghost{visibility:hidden}}`
  const letter = (l) => {
    const ring = l === 'q' || l === 'o'
    const fill = ring ? c.eyes : c.letters
    const path = (cls, extra = '') => `<path ${cls}${extra} d="${parts[l]}" fill="${fill}" stroke="${fill}" stroke-width="44" stroke-linejoin="round"/>`
    if (!ring) return path(`class="${id}-l ${id}-${l}"`)
    // q and o grow from the middle of their bowl, where the dot lands
    const m = l === 'q' ? Q : O
    return `<g transform="translate(${m.x} ${m.y})"><g class="${id}-ring ${id}-${l}">${path('', `transform="translate(${-m.x} ${-m.y})"`)}</g></g>`
  }
  const dot = (name, pts, fill) => {
    const end = name === 'red' ? Q : O
    const circle = (extra) => `<circle ${extra} cx="${end.x}" cy="${end.y}" r="${R}" fill="${fill}"/>`
    // two faint copies a moment behind the dot give it a short trail while it flies
    const ghost = (lag, op) =>
      `<g class="${id}-ghost"><g class="${id}-hop ${id}-${name}" style="animation-delay:${delay(pts[0].t + lag)}">${circle(`opacity="${op}"`)}</g></g>`
    return `${ghost(0.05, 0.16)}${ghost(0.025, 0.32)}<g class="${id}-hop ${id}-${name}"><g class="${id}-look">${circle(`class="${id}-dot"`)}</g></g>`
  }
  // 16:9 stage in logo units: the word is 52 % of the width and sits exactly in the middle
  const W = 9782, H = 5502.4, x0 = 2555.5 - W / 2, y0 = -273.5 - H / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" class="${id}" viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${W} ${H}" role="img" aria-label="reqochet">
<style>${css}
</style>
${background ? `<rect x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${W}" height="${H}" fill="${c.bg}"/>` : ''}
${LETTERS.map((l) => letter(l.id)).join('\n')}
${dot('red', RED, c.red)}
${dot('green', GREEN, c.green)}
</svg>
`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const theme of Object.keys(THEMES)) {
    const file = join(here, `../reqochet-sting-${theme}.svg`)
    writeFileSync(file, stingSvg(theme))
    console.log('wrote', file)
  }
}
