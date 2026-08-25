#!/usr/bin/env python3
"""Generate the app icon + splash screen assets from assets/images/logo.png.

The source lockup is a small raster (911x220), so a plain resize to 1024 comes
out soft. Every shape in it is a single flat colour defined purely by its alpha
channel, which means we can rebuild each shape as a signed distance field,
scale the *field*, and re-threshold — that gives near-vector edges at any size.

    nvm use && python3 scripts/generate-app-assets.py

Outputs (all under assets/):
    icon.png                     iOS/default app icon      1024
    ios-icon-dark.png            iOS dark appearance        1024
    ios-icon-tinted.png          iOS tinted appearance      1024
    android-icon-foreground.png  adaptive foreground        1024
    android-icon-background.png  adaptive background        1024
    android-icon-monochrome.png  themed-icon layer          1024
    favicon.png                  web favicon                 256
    splash-logo-light.png        full lockup, violet
    splash-logo-dark.png         full lockup, white wordmark
    splash-mark.png              P mark only (Android)      1024
"""

from __future__ import annotations

import math
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'images', 'logo.png')
OUT = os.path.join(ROOT, 'assets')

# Brand palette — mirrors src/theme/colors.ts (fixed across light and dark).
VIOLET = (90, 79, 220)           # brand.violet       #5A4FDC
VIOLET_BRIGHT = (123, 108, 246)  # brand.violetBright #7B6CF6
WHITE = (255, 255, 255)

# The circular "P" mark sits at the left of the lockup, then a gap of empty
# columns at x=176..189, then the wordmark.
MARK_BOX = (27, 36, 176, 186)
WORDMARK_X = 182


# ---------------------------------------------------------------------------
# Signed distance field scaling
# ---------------------------------------------------------------------------

BIG = 10 ** 6


def _edt(w, h, seed):
    """8SSEDT — euclidean distance from every pixel to the nearest seed."""
    grid = [[(0, 0) if seed(x, y) else (BIG, BIG) for x in range(w)] for y in range(h)]

    def norm(p):
        return p[0] * p[0] + p[1] * p[1]

    def compare(row, x, y, ox, oy):
        nx, ny = x + ox, y + oy
        if 0 <= nx < w and 0 <= ny < h:
            n = grid[ny][nx]
            cand = (n[0] + ox, n[1] + oy)
            if norm(cand) < norm(row[x]):
                row[x] = cand

    for y in range(h):
        row = grid[y]
        for x in range(w):
            for ox, oy in ((-1, 0), (0, -1), (-1, -1), (1, -1)):
                compare(row, x, y, ox, oy)
        for x in range(w - 1, -1, -1):
            compare(row, x, y, 1, 0)
    for y in range(h - 1, -1, -1):
        row = grid[y]
        for x in range(w - 1, -1, -1):
            for ox, oy in ((1, 0), (0, 1), (1, 1), (-1, 1)):
                compare(row, x, y, ox, oy)
        for x in range(w):
            compare(row, x, y, -1, 0)

    return [[math.sqrt(norm(px)) for px in row] for row in grid]


PAD = 3


def scale_mask(mask: Image.Image, size) -> Image.Image:
    """Resize an 8-bit coverage mask through a signed distance field.

    Straight interpolation blurs the edge by roughly the scale factor;
    rebuilding the field and re-thresholding keeps it one pixel wide however
    far we scale.
    """
    # Pad first so shapes touching the border keep their antialiasing.
    src = Image.new('L', (mask.size[0] + PAD * 2, mask.size[1] + PAD * 2))
    src.paste(mask, (PAD, PAD))
    w, h = src.size
    px = src.load()
    inside = [[px[x, y] >= 128 for x in range(w)] for y in range(h)]

    d_out = _edt(w, h, lambda x, y: inside[y][x])      # 0 inside, grows outward
    d_in = _edt(w, h, lambda x, y: not inside[y][x])   # 0 outside, grows inward

    field = Image.new('F', (w, h))
    fp = field.load()
    for y in range(h):
        for x in range(w):
            cov = px[x, y] / 255.0
            if 0.0 < cov < 1.0:
                # An antialiased source pixel's coverage *is* the sub-pixel
                # position of the edge — better than the quantised distance.
                fp[x, y] = 0.5 - cov
            elif inside[y][x]:
                fp[x, y] = -(d_in[y][x] - 0.5)
            else:
                fp[x, y] = d_out[y][x] - 0.5

    scale = size[0] / mask.size[0]
    pad_t = int(round(PAD * scale))
    target = (size[0] + pad_t * 2, size[1] + pad_t * 2)
    field = field.resize(target, Image.BICUBIC)

    big = Image.new('L', target)
    bp, fp = big.load(), field.load()
    for y in range(target[1]):
        for x in range(target[0]):
            v = 0.5 - fp[x, y] * scale
            bp[x, y] = 0 if v <= 0 else 255 if v >= 1 else int(v * 255 + 0.5)
    return big.crop((pad_t, pad_t, pad_t + size[0], pad_t + size[1]))


# ---------------------------------------------------------------------------
# Pulling the pieces out of the lockup
# ---------------------------------------------------------------------------

def source_masks():
    """Return flat 8-bit masks for each shape in the logo.

    `disc`/`glyph`/`wordmark` are all full-canvas and stay registered with each
    other, so the dark lockup can recolour them independently.
    """
    logo = Image.open(SRC).convert('RGBA')
    w, h = logo.size
    alpha = logo.split()[3]
    ap = alpha.load()

    # Flood the transparent surround of the mark so we can tell it apart from
    # the knocked-out "P" counter that the disc encloses.
    mark = alpha.crop(MARK_BOX)
    padded = Image.new('L', (mark.size[0] + 4, mark.size[1] + 4))
    padded.paste(mark, (2, 2))
    surround = padded.point(lambda v: 255 if v >= 128 else 0)
    ImageDraw.floodfill(surround, (0, 0), 128, thresh=0)
    sp = surround.load()

    disc = Image.new('L', (w, h))       # the mark as a solid filled circle
    glyph = Image.new('L', (w, h))      # just the P counter
    dp, gp = disc.load(), glyph.load()
    mx, my = MARK_BOX[0], MARK_BOX[1]

    # Core of the counter: transparent, yet enclosed by the disc.
    core = set()
    for y in range(mark.size[1]):
        for x in range(mark.size[0]):
            outside = sp[x + 2, y + 2] == 128
            a = ap[mx + x, my + y]
            dp[mx + x, my + y] = a if outside else 255
            if not outside and a < 128:
                core.add((x, y))

    # Only pixels touching that core carry the counter's antialiasing. Without
    # this the disc's own semi-transparent outer rim would read as part of the
    # glyph and leave a faint ghost ring around it.
    region = set(core)
    for x, y in core:
        for ox in (-1, 0, 1):
            for oy in (-1, 0, 1):
                region.add((x + ox, y + oy))
    for x, y in region:
        if not (0 <= x < mark.size[0] and 0 <= y < mark.size[1]):
            continue
        if sp[x + 2, y + 2] == 128:
            continue
        a = ap[mx + x, my + y]
        if a < 255:
            gp[mx + x, my + y] = 255 - a

    wordmark = Image.new('L', (w, h))
    wp = wordmark.load()
    for y in range(h):
        for x in range(WORDMARK_X, w):
            wp[x, y] = ap[x, y]

    return {
        'canvas': (w, h),
        'bbox': alpha.getbbox(),
        'lockup': alpha,
        'disc': disc,
        'glyph': glyph,
        'wordmark': wordmark,
    }


# ---------------------------------------------------------------------------
# Composition helpers
# ---------------------------------------------------------------------------

def gradient(size, a, b) -> Image.Image:
    """Diagonal brand gradient — matches GradientButton (bright -> violet)."""
    w, h = size
    img = Image.new('RGB', size)
    p = img.load()
    for y in range(h):
        ty = y / max(h - 1, 1)
        for x in range(w):
            t = (x / max(w - 1, 1) + ty) / 2
            p[x, y] = (int(a[0] + (b[0] - a[0]) * t + 0.5),
                       int(a[1] + (b[1] - a[1]) * t + 0.5),
                       int(a[2] + (b[2] - a[2]) * t + 0.5))
    return img


def tint(mask: Image.Image, color) -> Image.Image:
    layer = Image.new('RGBA', mask.size, color + (255,))
    layer.putalpha(mask)
    return layer


def place(canvas: Image.Image, mask: Image.Image, color, height_ratio, dy=0):
    """Trim `mask`, scale it to a fraction of the canvas height, paste centred."""
    m = mask.crop(mask.getbbox())
    ch = int(round(canvas.size[1] * height_ratio))
    cw = max(1, int(round(ch * m.size[0] / m.size[1])))
    scaled = scale_mask(m, (cw, ch))
    x = (canvas.size[0] - cw) // 2
    y = (canvas.size[1] - ch) // 2 + dy
    canvas.paste(tint(scaled, color), (x, y), scaled)


def save(img: Image.Image, name, flatten=None):
    if flatten is not None:
        bg = Image.new('RGB', img.size, flatten)
        bg.paste(img, (0, 0), img)
        img = bg
    img.save(os.path.join(OUT, name))
    print(f'  {name:<30} {img.size[0]}x{img.size[1]}  {img.mode}')


# ---------------------------------------------------------------------------

def main():
    print('reading', os.path.relpath(SRC, ROOT))
    m = source_masks()

    S = 1024
    print('icons')

    # Default / iOS light: full-bleed brand gradient with the white P.
    icon = gradient((S, S), VIOLET_BRIGHT, VIOLET).convert('RGBA')
    place(icon, m['glyph'], WHITE, 0.58)
    save(icon, 'icon.png', flatten=VIOLET)

    # iOS dark: transparent surround so the system backdrop shows, but the
    # violet coin keeps the brand colour.
    dark = Image.new('RGBA', (S, S))
    place(dark, m['disc'], VIOLET, 0.88)
    place(dark, m['glyph'], WHITE, 0.56)
    save(dark, 'ios-icon-dark.png')

    # iOS tinted: the system maps luminance onto the user's tint colour.
    tinted = Image.new('RGBA', (S, S))
    place(tinted, m['glyph'], WHITE, 0.58)
    save(tinted, 'ios-icon-tinted.png')

    # Android adaptive: content stays inside the inner 66% safe circle.
    fg = Image.new('RGBA', (S, S))
    place(fg, m['glyph'], WHITE, 0.46)
    save(fg, 'android-icon-foreground.png')
    save(gradient((S, S), VIOLET_BRIGHT, VIOLET).convert('RGBA'),
         'android-icon-background.png', flatten=VIOLET)

    mono = Image.new('RGBA', (S, S))
    place(mono, m['glyph'], WHITE, 0.46)
    save(mono, 'android-icon-monochrome.png')

    fav = gradient((256, 256), VIOLET_BRIGHT, VIOLET).convert('RGBA')
    place(fav, m['glyph'], WHITE, 0.58)
    save(fav, 'favicon.png', flatten=VIOLET)

    print('splash')
    x0, y0, x1, y1 = m['bbox']
    lw = 1600
    ratio = lw / (x1 - x0)
    lh = int(round((y1 - y0) * ratio))

    def piece(mask):
        return scale_mask(mask.crop((x0, y0, x1, y1)), (lw, lh))

    light = Image.new('RGBA', (lw, lh))
    lock = piece(m['lockup'])
    light.paste(tint(lock, VIOLET), (0, 0), lock)
    save(light, 'splash-logo-light.png')

    # Dark lockup: white wordmark, and the counter is *filled* white rather
    # than knocked out — otherwise the dark background shows through the P.
    dark_lock = Image.new('RGBA', (lw, lh))
    for mask, color in ((m['disc'], VIOLET), (m['glyph'], WHITE), (m['wordmark'], WHITE)):
        s = piece(mask)
        dark_lock.paste(tint(s, color), (0, 0), s)
    save(dark_lock, 'splash-logo-dark.png')

    # Android masks the splash icon into a circle, so it gets the mark alone.
    mark = Image.new('RGBA', (S, S))
    place(mark, m['disc'], VIOLET, 0.80)
    place(mark, m['glyph'], WHITE, 0.50)
    save(mark, 'splash-mark.png')

    print('done')


if __name__ == '__main__':
    main()
