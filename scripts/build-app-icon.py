#!/usr/bin/env python3
"""
Regenerate the iOS app icon set from the vector mark.

The shipped icon had the mark at only 39% of the canvas width with 311px of
dead space either side, which reads as small and lost once iOS shrinks it to a
home-screen tile — and because the F is a heavy solid block while the dot is a
small floating circle, the composition read bottom-heavy even though its
bounding box was dead centre.

So: draw from the source geometry (brand/logo-concepts/app-icon-build/icon.html)
rather than upscaling the old PNG, scale the mark to fill properly, and balance
it on its optical centre instead of its bounding box.

Renders at 4x and downsamples with Lanczos for clean edges, and writes flat RGB
with no alpha channel — App Store icons are rejected for having one.

Usage:  python3 scripts/build-app-icon.py [--check]
        --check  renders only the 1024 master to /tmp for eyeballing
"""

import json
import os
import sys

from PIL import Image, ImageDraw

BG = (0x2C, 0x20, 0x18)
CREAM = (0xF5, 0xEB, 0xE0)
ORANGE = (0xFB, 0x5B, 0x1E)

# Mark geometry in the source SVG's user units (viewBox "38 38 436 436").
F_PATH = [
    (154.3, 159.8), (328.6, 159.8), (328.4, 213.6), (218.5, 213.9),
    (218.5, 268.3), (305.2, 268.3), (305.2, 322.6), (218.5, 322.9),
    (218.3, 429.8), (154.3, 429.8),
]
DOT_CX, DOT_CY, DOT_R = 324.4, 115.0, 33.1

# How much of the canvas the whole mark (F + dot) should span vertically. The
# old icon sat at 67%; Apple's own glyph-led icons run high-70s, and the extra
# presence is what stops it looking shrunken in the App Store grid.
MARK_HEIGHT_FRACTION = 0.78

# Vertically the lockup's centre of ink already lands within 3px of the canvas
# centre once the bounding box is centred, so no correction is needed — measured,
# not assumed. Horizontally it does not: the F's solid stem sits far left while
# the dot only reaches right, putting the centre of ink ~62px left of centre.
# Correcting that in full would make the bounding box look visibly right-shifted,
# so nudge roughly half way — the usual compromise between bounding-box centring
# and mass centring for an asymmetric lockup.
OPTICAL_LIFT_FRACTION = 0.0
OPTICAL_NUDGE_RIGHT_FRACTION = 0.028

SUPERSAMPLE = 4
ICONSET = "ios-native/FlynnAI/Resources/Assets.xcassets/AppIcon.appiconset"


def mark_bounds():
    """Bounding box of the full lockup in SVG units."""
    xs = [p[0] for p in F_PATH] + [DOT_CX - DOT_R, DOT_CX + DOT_R]
    ys = [p[1] for p in F_PATH] + [DOT_CY - DOT_R, DOT_CY + DOT_R]
    return min(xs), min(ys), max(xs), max(ys)


def render(size):
    """Render the icon at `size` px square, supersampled."""
    canvas = size * SUPERSAMPLE
    img = Image.new("RGB", (canvas, canvas), BG)
    draw = ImageDraw.Draw(img)

    min_x, min_y, max_x, max_y = mark_bounds()
    scale = (canvas * MARK_HEIGHT_FRACTION) / (max_y - min_y)

    # Place the lockup's bbox centre on the canvas centre, then lift.
    cx_svg, cy_svg = (min_x + max_x) / 2, (min_y + max_y) / 2
    off_x = canvas / 2 - cx_svg * scale + canvas * OPTICAL_NUDGE_RIGHT_FRACTION
    off_y = canvas / 2 - cy_svg * scale - canvas * OPTICAL_LIFT_FRACTION

    def to_canvas(x, y):
        return (off_x + x * scale, off_y + y * scale)

    draw.polygon([to_canvas(x, y) for x, y in F_PATH], fill=CREAM)

    dx, dy = to_canvas(DOT_CX, DOT_CY)
    r = DOT_R * scale
    draw.ellipse([dx - r, dy - r, dx + r, dy + r], fill=ORANGE)

    return img.resize((size, size), Image.LANCZOS)


def main():
    check_only = "--check" in sys.argv
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    if check_only:
        out = "/tmp/flynn-icon-check.png"
        render(1024).save(out)
        min_x, min_y, max_x, max_y = mark_bounds()
        width_frac = ((max_x - min_x) / (max_y - min_y)) * MARK_HEIGHT_FRACTION
        print(f"wrote {out}")
        print(f"mark spans {width_frac * 100:.1f}% wide, {MARK_HEIGHT_FRACTION * 100:.1f}% tall")
        return

    iconset = os.path.join(root, ICONSET)
    contents = json.load(open(os.path.join(iconset, "Contents.json")))

    # Every entry's pixel size is size x scale; render each natively rather than
    # downscaling one master, so the small tiles stay crisp.
    written = {}
    for entry in contents["images"]:
        filename = entry.get("filename")
        if not filename:
            continue
        base = float(entry["size"].split("x")[0])
        px = int(round(base * float(entry["scale"].rstrip("x"))))
        if filename not in written:
            render(px).save(os.path.join(iconset, filename))
            written[filename] = px

    for name, px in sorted(written.items(), key=lambda kv: kv[1]):
        print(f"  {px:>4}px  {name}")
    print(f"\n{len(written)} icons written to {ICONSET}")


if __name__ == "__main__":
    main()
