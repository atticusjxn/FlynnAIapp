#!/usr/bin/env bash
# Renders each html/*.html to a 1290x2796 PNG (iPhone 6.7") with headless Chrome.
# Renders at 2x device-scale-factor (retina supersampling) then downscales back
# to the exact target — this is what made the standalone landing-page hero
# render crisper than the first pass of these screenshots, which rendered at
# 1x and looked visibly softer by comparison.
set -euo pipefail
cd "$(dirname "$0")"

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
node generate.js

W=1290
H=2796

for f in html/*.html; do
  name="$(basename "${f%.html}")"
  out="$PWD/${name}.png"
  raw="$PWD/${name}.raw.png"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --allow-file-access-from-files --window-size=$W,$H \
    --screenshot="$raw" "file://$PWD/$f" >/dev/null 2>&1
  sips -z $H $W "$raw" --out "$out" >/dev/null 2>&1
  rm -f "$raw"
  echo "rendered $out"
done
