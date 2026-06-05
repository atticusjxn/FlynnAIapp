#!/usr/bin/env python3
"""Cut the classic AppIcon filenames from the cream master straight into the
iOS asset catalog, and process the mascot poses to transparent PNGs that get
dropped into the app's Assets.xcassets as imagesets (@1x/@2x/@3x)."""
import os, json
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..')
BRAND = os.path.join(ROOT, 'brand', 'logo-concepts')
MASTER = os.path.join(BRAND, 'master', 'master.png')
POSES = os.path.join(BRAND, 'poses', 'raw')
ASSETS = os.path.join(ROOT, 'ios-native', 'FlynnAI', 'Resources', 'Assets.xcassets')
APPICON = os.path.join(ASSETS, 'AppIcon.appiconset')

master = Image.open(MASTER).convert('RGB')

def rs(size):
    return master.resize((size, size), Image.LANCZOS)

# ---- App icon: exact classic filenames the Contents.json already references ----
icon_files = {
    'Icon-20.png': 20, 'Icon-20@2x.png': 40, 'Icon-20@3x.png': 60,
    'Icon-20-ipad@2x.png': 40,
    'Icon-29.png': 29, 'Icon-29@2x.png': 58, 'Icon-29@3x.png': 87,
    'Icon-29-ipad@2x.png': 58,
    'Icon-40.png': 40, 'Icon-40@2x.png': 80, 'Icon-40@3x.png': 120,
    'Icon-40-ipad@2x.png': 80,
    'Icon-60@2x.png': 120, 'Icon-60@3x.png': 180,
    'Icon-76.png': 76, 'Icon-76@2x.png': 152,
    'Icon-83.5@2x.png': 167,
    'AppIcon-1024.png': 1024,
}
for name, size in icon_files.items():
    rs(size).save(os.path.join(APPICON, name))
print(f'app icon: wrote {len(icon_files)} sizes -> {os.path.relpath(APPICON, ROOT)}')

# ---- Mascot poses: white -> transparent, trim, drop into imagesets ----
def to_transparent(src):
    img = Image.open(src).convert('RGBA')
    w, h = img.size
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
                 (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
        ImageDraw.floodfill(img, seed, (0, 0, 0, 0), thresh=50)
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img

# Imageset base size (points). @3x asset = 3x this on the longest edge.
BASE = 160
pose_ids = ['wave', 'thumbsup', 'thinking', 'point', 'peek', 'write', 'sleep', 'phone']
mascot_dir = os.path.join(ASSETS, 'Mascots')
os.makedirs(mascot_dir, exist_ok=True)
for pid in pose_ids:
    src = os.path.join(POSES, f'{pid}.png')
    if not os.path.exists(src):
        print(f'  skip {pid} (missing)')
        continue
    t = to_transparent(src)
    name = f'mascot-{pid}'
    iset = os.path.join(mascot_dir, f'{name}.imageset')
    os.makedirs(iset, exist_ok=True)
    for scale in (1, 2, 3):
        edge = BASE * scale
        s = edge / max(t.size)
        r = t.resize((max(1, round(t.width * s)), max(1, round(t.height * s))), Image.LANCZOS)
        # square transparent canvas so SwiftUI sizing is predictable
        canvas = Image.new('RGBA', (edge, edge), (0, 0, 0, 0))
        canvas.alpha_composite(r, ((edge - r.width) // 2, (edge - r.height) // 2))
        canvas.save(os.path.join(iset, f'{name}@{scale}x.png'))
    contents = {"images": [
        {"filename": f'{name}@1x.png', "idiom": "universal", "scale": "1x"},
        {"filename": f'{name}@2x.png', "idiom": "universal", "scale": "2x"},
        {"filename": f'{name}@3x.png', "idiom": "universal", "scale": "3x"},
    ], "info": {"author": "xcode", "version": 1},
        "properties": {"preserves-vector-representation": False, "template-rendering-intent": "original"}}
    with open(os.path.join(iset, 'Contents.json'), 'w') as f:
        json.dump(contents, f, indent=2)
    print(f'  mascot-{pid}: imageset written')

print('done.')
