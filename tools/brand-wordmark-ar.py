#!/usr/bin/env python3
"""Builds the Arabic name logo «ريكوشيه» (proposal 4 — the owner, 13 Nov 2026).

The word is set in Baloo Bhaijaan 2 (SIL OFL 1.1, github.com/google/fonts ofl/baloobhaijaan2 — a round, single-stroke
Arabic typeface) as outlines; the و is replaced by the q of the English logo and the final ه by its o, each with its
dot, copied unchanged from resources/brand/logo/reqochet-logo-on-light.svg (same units, same size). The Arabic letters
get the same 44-unit round outline as the English letters, at a weight and scale that give the same stroke thickness.

    pip install fonttools uharfbuzz
    python3 tools/brand-wordmark-ar.py "<folder>/BalooBhaijaan2[wght].ttf"
    node tools/brand-ember.mjs   # the 2000 px PNGs

Writes resources/brand/logo/reqochet-logo-ar-on-{light,dark,ember}.svg and the loading animations
resources/brand/motion/reqochet-loading-ar-on-{light,dark,ember}.svg (the two dots hop, as in the English one). The font file is not kept in the repository.
"""
import json
import math
import re
import sys
import tempfile

import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import DecomposingRecordingPen, RecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

BRAND = 'resources/brand'
WORD = 'ريكوشيه'
WEIGHT = float(sys.argv[2]) if len(sys.argv) > 2 else 400  # the font's weight axis
OUTLINE = 44  # the round outline of the English letters (stroke-width in the logo file)
STROKE = 134  # stroke thickness of the English q and o as seen (90 drawn + 44 outline)
GAP = 96  # clear space between letters that do not join (as seen), close to the English letter spacing
FILLET = 46  # radius that softens the corners where the baseline meets the q and the o
DOT_MAX = 200  # an outline smaller than this (font units) is a dot
JOIN_PIECE_MAX = 20
REH_SPACE = 80  # extra room before the ر, so that its tail stays clear of the dots of ي
THREE_DOTS_SHIFT = (-64, 40)  # the three dots of ش move this far left and up (as seen), clear of the teeth and the tall last stroke
DOT_SPREAD = 30  # how far each dot of a pair or a group of three moves away from the others (as seen)
MARGIN = 60  # around the drawing, as in the English file

# --- the English logo: the q and o outlines, their dots
logo = open(f'{BRAND}/logo/reqochet-logo-on-light.svg', encoding='utf8').read()
outlines = re.split(r'(?=M)', re.search(r'<path d="([^"]+)"', logo).group(1))
start = lambda o: float(re.match(r'M(-?[\d.]+)', o).group(1))
Q = ''.join(o for o in outlines if o and 1150 < start(o) < 1900)
O = ''.join(o for o in outlines if o and 1900 < start(o) < 2500)
(q_dot, o_dot) = [tuple(map(float, m)) for m in re.findall(r'<circle cx="([\d.-]+)" cy="([\d.-]+)" r="([\d.-]+)"', logo)]
Q_LEFT, Q_STEM_LEFT, Q_STEM_RIGHT, Q_BOTTOM = 1194, 1643, 1745, 234  # extremes of the q outline (before the 44 outline)
O_LEFT, O_RIGHT, O_TOP, O_BASE = 1942, 2493, -551, 4  # extremes of the o; its lowest point sits 4 below the baseline
RING = (O_RIGHT - O_LEFT) / 2 + OUTLINE / 2  # the o's outer radius as seen


def shift(d, dx):
    """Moves an outline of the logo sideways (its commands are absolute M, Q, L, H, V, Z)."""
    out = []
    for cmd, args in re.findall(r'([MQLHVZ])([^MQLHVZ]*)', d):
        n = [float(v) for v in args.split()]
        if cmd == 'H':
            n = [v + dx for v in n]
        elif cmd != 'V':
            n = [v + dx if i % 2 == 0 else v for i, v in enumerate(n)]
        out.append(cmd + ' '.join(f'{v:.1f}' for v in n))
    return ''.join(out)


# --- the Arabic letters, shaped by HarfBuzz at the chosen weight
font = instantiateVariableFont(TTFont(sys.argv[1]), {'wght': WEIGHT})
with tempfile.NamedTemporaryFile(suffix='.ttf') as tmp:
    font.save(tmp.name)
    hb_font = hb.Font(hb.Face(hb.Blob.from_file_path(tmp.name)))
buf = hb.Buffer()
buf.add_str(WORD)
buf.guess_segment_properties()
hb.shape(hb_font, buf)
glyphs = font.getGlyphSet()
order = font.getGlyphOrder()


def bounds(name):
    pen = BoundsPen(glyphs)
    glyphs[name].draw(pen)
    return pen.bounds


thickness = bounds('kashida.ar')[3]  # the baseline stroke of the typeface
scale = (STROKE - OUTLINE) / thickness
base = O_BASE  # the letters stand where the o stands
bar_top, bar_bottom = base - (STROKE - OUTLINE), base

# shaped glyphs, left to right: ه ي ش و ك ي ر — as [name, x, x-offset, advance]
run = []
x = 0
for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
    run.append([order[info.codepoint], x + pos.x_offset, pos.x_advance])
    x += pos.x_advance
heh, yeh2, sheen, waw, kaf, yeh1, reh = run
assert 'heh' in heh[0] and 'waw' in waw[0], [g[0] for g in run]


def contours(name):
    """A glyph's outlines one by one, as (pen commands, bounds)."""
    pen = DecomposingRecordingPen(glyphs)
    glyphs[name].draw(pen)
    out, current = [], []
    for step in pen.value:
        current.append(step)
        if step[0] in ('closePath', 'endPath'):
            box = BoundsPen(None)
            rec = RecordingPen()
            rec.value = current
            rec.replay(box)
            out.append((current, box.bounds))
            current = []
    return out


def letters(group, dx):
    """SVG path of some shaped glyphs, scaled, moved by dx (in logo units), standing on the o's base line.
    The dots of a letter are moved apart by the width of the outline, so that they stay as clear as in the typeface."""
    d = ''
    for name, gx, _adv in group:
        # the typeface's small joining pieces (10 units wide) are not needed: the outline closes every join
        parts = [(c, b) for c, b in contours(name) if b[2] - b[0] > JOIN_PIECE_MAX]
        dots = [b for _c, b in parts if b[2] - b[0] < DOT_MAX and b[3] - b[1] < DOT_MAX]
        cx = sum((b[0] + b[2]) / 2 for b in dots) / len(dots) if dots else 0
        cy = sum((b[1] + b[3]) / 2 for b in dots) / len(dots) if dots else 0
        for commands, b in parts:
            mx = my = 0.0
            if b in dots and len(dots) > 1:
                vx, vy = (b[0] + b[2]) / 2 - cx, (b[1] + b[3]) / 2 - cy
                mx, my = vx / math.hypot(vx, vy) * DOT_SPREAD / scale, vy / math.hypot(vx, vy) * DOT_SPREAD / scale
            if b in dots and len(dots) == 3:
                mx, my = mx + THREE_DOTS_SHIFT[0] / scale, my + THREE_DOTS_SHIFT[1] / scale
            pen = SVGPathPen(glyphs, ntos=lambda v: f'{v:.1f}')
            rec = RecordingPen()
            rec.value = commands
            rec.replay(TransformPen(pen, (scale, 0, 0, -scale, (gx + mx) * scale + dx, base - my * scale)))
            d += pen.getCommands()
    return d


rect = lambda x0, x1, y0, y1: f'M{x0:.1f} {y0:.1f}H{x1:.1f}V{y1:.1f}H{x0:.1f}Z'
half = OUTLINE / 2

# 1. the o stays where a ه would be, at the left; the bar from ي runs into its foot
o_dx = MARGIN + half - O_LEFT
o_cx, o_cy = o_dot[0] + o_dx, o_dot[1]
yeh2_origin = O_RIGHT + o_dx + 84  # where the ي starts: a cup as wide as the ones between the teeth of ش
left_dx = yeh2_origin - yeh2[1] * scale
bar_o = rect(o_cx, yeh2_origin + 4, bar_top, bar_bottom)
# 2. the q, one clear space right of ش
sheen_right = (sheen[1] + bounds(sheen[0])[2]) * scale + left_dx
q_dx = sheen_right + half + GAP + half - Q_LEFT
# 3. ك ي ر, joined to the q's stem by the baseline
kaf_origin = Q_STEM_RIGHT + q_dx + 84
right_dx = kaf_origin - kaf[1] * scale
bar_q = rect((Q_STEM_LEFT + Q_STEM_RIGHT) / 2 + q_dx, kaf_origin + 4, bar_top, bar_bottom)

arabic = letters([yeh2, sheen], left_dx) + letters([kaf, yeh1], right_dx) + letters([reh], right_dx + REH_SPACE) + bar_o + bar_q

# soft corners (drawn as seen, no outline): above and below the bar at the q's stem, above the bar at the o
top, bottom, r = bar_top - half, bar_bottom + half, FILLET
sx = Q_STEM_RIGHT + q_dx + half
fillets = f'M{sx - 4:.1f} {top + 4:.1f}V{top - r:.1f}H{sx:.1f}A{r} {r} 0 0 0 {sx + r:.1f} {top:.1f}V{top + 4:.1f}Z'
fillets += f'M{sx - 4:.1f} {bottom - 4:.1f}V{bottom + r:.1f}H{sx:.1f}A{r} {r} 0 0 1 {sx + r:.1f} {bottom:.1f}V{bottom - 4:.1f}Z'
fy = top - r  # centre of the circle that touches the bar and the ring
fx = o_cx + math.sqrt((RING + r) ** 2 - (fy - o_cy) ** 2)
tx, ty = o_cx + (fx - o_cx) * RING / (RING + r), o_cy + (fy - o_cy) * RING / (RING + r)
fillets += f'M{tx:.1f} {ty:.1f}A{r} {r} 0 0 0 {fx:.1f} {top:.1f}V{top + 6:.1f}H{tx - 30:.1f}Z'

# --- the files
reh_right = (reh[1] + bounds(reh[0])[2]) * scale + right_dx + REH_SPACE
width = reh_right + half + MARGIN
ys = [-(bounds(g[0])[3]) * scale + base for g in (yeh2, sheen, kaf, yeh1, reh)]
y_top = min(min(ys), O_TOP) - half - MARGIN
y_bottom = max(Q_BOTTOM, max(-(bounds(g[0])[1]) * scale + base for g in (yeh2, yeh1, reh))) + half + MARGIN
view = f'0 {y_top:.1f} {width:.1f} {y_bottom - y_top:.1f}'
ember = json.load(open(f'{BRAND}/brand-tokens.json', encoding='utf8'))['ember']


# the loading animation: the same drawing with the two dots hopping — style and head room as in the English file
loading = open(f'{BRAND}/motion/reqochet-loading-on-light.svg', encoding='utf8').read()
HOP_STYLE = re.search(r'<style>.*?</style>', loading, re.S).group(0)
HOP_ROOM = 330
view_loading = f'0 {y_top - HOP_ROOM:.1f} {width:.1f} {y_bottom - y_top + HOP_ROOM:.1f}'


def svg(letter_colour, eye_colour, red, green, moving=False):
    part = lambda d, c: f'<path d="{d}" fill="{c}" stroke="{c}" stroke-width="{OUTLINE}" stroke-linejoin="round"/>'
    dot = lambda cls: f'class="dot {cls}" ' if moving else ''
    head = f'viewBox="{view_loading}" role="img" aria-label="ريكوشيه">\n{HOP_STYLE}' if moving else f'viewBox="{view}" role="img" aria-label="ريكوشيه">'
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" {head}\n'
        f'<!-- The Arabic name (proposal 4, 13 Nov 2026): Baloo Bhaijaan 2 (SIL OFL 1.1) as outlines; the و is the q and the ه the o of the English logo, unchanged. Made by tools/brand-wordmark-ar.py — do not edit by hand. -->\n'
        f'{part(arabic, letter_colour)}\n<path d="{fillets}" fill="{letter_colour}"/>\n'
        f'{part(shift(Q, q_dx) + shift(O, o_dx), eye_colour)}\n'
        f'<circle {dot("r")}cx="{q_dot[0] + q_dx:.1f}" cy="{q_dot[1]}" r="{q_dot[2]}" fill="{red}"/>\n'
        f'<circle {dot("g")}cx="{o_cx:.1f}" cy="{o_cy}" r="{o_dot[2]}" fill="{green}"/>\n</svg>\n'
    )


for name, args in {
    'on-light': ('#1b1f27', '#1b1f27', '#D7262B', '#1F9D48'),
    'on-dark': ('#ffffff', '#ffffff', '#D7262B', '#1F9D48'),
    'on-ember': (ember['orange'], ember['warmWhite'], ember['requirementRed'], ember['verificationGreen']),
}.items():
    open(f'{BRAND}/logo/reqochet-logo-ar-{name}.svg', 'w', encoding='utf8').write(svg(*args))
    open(f'{BRAND}/motion/reqochet-loading-ar-{name}.svg', 'w', encoding='utf8').write(svg(*args, moving=True))
print(f'weight {WEIGHT:.0f}, scale {scale:.3f}, viewBox {view}, width / English width = {width / 5095:.4f}')
