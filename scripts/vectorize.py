#!/usr/bin/env python3
"""Vectorize the icon master + character to SVG (run with the vtracer venv)."""
import os, vtracer

ROOT = os.path.join(os.path.dirname(__file__), '..', 'brand', 'logo-concepts')
M = os.path.join(ROOT, 'master')

jobs = [
    (os.path.join(M, 'master.png'), os.path.join(M, 'flynn-icon.svg')),
    (os.path.join(M, 'character-transparent.png'), os.path.join(M, 'flynn-character.svg')),
]
for src, out in jobs:
    vtracer.convert_image_to_svg_py(
        src, out,
        colormode='color', hierarchical='stacked', mode='spline',
        filter_speckle=6, color_precision=7, layer_difference=16,
        corner_threshold=60, length_threshold=4.0, splice_threshold=45,
        path_precision=8,
    )
    print('wrote', os.path.relpath(out), '(%.0f KB)' % (os.path.getsize(out) / 1024))
