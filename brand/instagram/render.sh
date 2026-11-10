#!/usr/bin/env bash
# Renders each html/*.html to a 1080x1350 PNG (IG 4:5 feed ratio) with headless
# Chrome, at 2x device-scale-factor then downscaled back for crisp text/edges.
set -euo pipefail
cd "$(dirname "$0")"

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
node generate.js

W=1080
H=1350

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
