#!/usr/bin/env python3
"""Build a centered, exact-cream app-icon master from the locked character.
Removes the pale background, recenters the character on a true warm-cream canvas."""
import os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..', 'brand', 'logo-concepts')
SRC = os.path.join(ROOT, 'lock', '5-cream-no-hand.png')
OUT = os.path.join(ROOT, 'master')
os.makedirs(OUT, exist_ok=True)

CREAM = (244, 230, 206)   # #F4E6CE — clearly warm cream, not white
CANVAS = 1024
MARGIN = 0.13             # character occupies ~74% of the frame

img = Image.open(SRC).convert('RGBA')
w, h = img.size

# Knock out the near-uniform background to transparent via flood fill from the
# four corners (the character has a bold dark outline, so the fill stops at it).
for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
    ImageDraw.floodfill(img, seed, (0, 0, 0, 0), thresh=60)

# Drop any remaining fully-creamish stray pixels that the flood missed (corners only).
# (kept conservative; the outline protects the character)

# Crop to the character.
bbox = img.getbbox()
char = img.crop(bbox)
cw, ch = char.size
scale = (CANVAS * (1 - 2 * MARGIN)) / max(cw, ch)
char = char.resize((max(1, round(cw * scale)), max(1, round(ch * scale))), Image.LANCZOS)

# Compose dead-center on a solid cream canvas.
canvas = Image.new('RGBA', (CANVAS, CANVAS), CREAM + (255,))
cx = (CANVAS - char.width) // 2
cy = (CANVAS - char.height) // 2
canvas.alpha_composite(char, (cx, cy))

master = canvas.convert('RGB')
master.save(os.path.join(OUT, 'master.png'))
# Also keep a transparent-character version for vectorizing / compositing later.
char_only = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
char_only.alpha_composite(char, (cx, cy))
char_only.save(os.path.join(OUT, 'character-transparent.png'))
print('wrote master.png and character-transparent.png to', OUT)
