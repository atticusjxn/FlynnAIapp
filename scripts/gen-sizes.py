#!/usr/bin/env python3
"""Cut the Apple + Android icon sizes from the centered cream master."""
import os, json
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'brand', 'logo-concepts')
MASTER = os.path.join(ROOT, 'master', 'master.png')
CHAR = os.path.join(ROOT, 'master', 'character-transparent.png')
OUT = os.path.join(ROOT, 'app-icon')
CREAM = (244, 230, 206)

master = Image.open(MASTER).convert('RGB')
char = Image.open(CHAR).convert('RGBA')

def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)

def rs(size):
    return master.resize((size, size), Image.LANCZOS)

# ---- iOS ----
ios_sizes = [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024]
for s in ios_sizes:
    save(rs(s), os.path.join(OUT, 'ios', f'Icon-{s}.png'))
# Single-size universal AppIcon (modern Xcode) Contents.json
save(rs(1024), os.path.join(OUT, 'ios', 'AppIcon.appiconset', 'icon-1024.png'))
contents = {
    "images": [{"filename": "icon-1024.png", "idiom": "universal",
                "platform": "ios", "size": "1024x1024"}],
    "info": {"author": "xcode", "version": 1},
}
with open(os.path.join(OUT, 'ios', 'AppIcon.appiconset', 'Contents.json'), 'w') as f:
    json.dump(contents, f, indent=2)

# ---- Android ----
android = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
for dens, s in android.items():
    save(rs(s), os.path.join(OUT, 'android', f'mipmap-{dens}', 'ic_launcher.png'))
    save(rs(s), os.path.join(OUT, 'android', f'mipmap-{dens}', 'ic_launcher_round.png'))
save(rs(512), os.path.join(OUT, 'android', 'playstore-icon-512.png'))

# Adaptive icon: foreground = character on transparent within the 66/108 safe zone.
FG = 432  # 108dp @ xxxhdpi
safe = int(FG * 0.60)
cb = char.getbbox()
c = char.crop(cb)
sc = safe / max(c.size)
c = c.resize((round(c.width * sc), round(c.height * sc)), Image.LANCZOS)
fg = Image.new('RGBA', (FG, FG), (0, 0, 0, 0))
fg.alpha_composite(c, ((FG - c.width) // 2, (FG - c.height) // 2))
save(fg, os.path.join(OUT, 'android', 'adaptive', 'ic_launcher_foreground.png'))
save(Image.new('RGB', (FG, FG), CREAM), os.path.join(OUT, 'android', 'adaptive', 'ic_launcher_background.png'))
with open(os.path.join(OUT, 'android', 'adaptive', 'ic_launcher_background_color.txt'), 'w') as f:
    f.write('#F4E6CE\n')

print('iOS sizes:', ios_sizes)
print('Android densities:', list(android.values()), '+ 512 + adaptive 432')
print('Output ->', OUT)
