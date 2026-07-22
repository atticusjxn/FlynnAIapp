#!/usr/bin/env bash
# Renders each html/*.html to a 1080x1920 PNG (Play-compliant phone size) with
# headless Chrome, at 2x device-scale-factor (retina supersampling) then
# downscaled back to the exact target for crisp text/edges.
set -euo pipefail
cd "$(dirname "$0")"

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
node generate.js

for f in html/*.html; do
  name="$(basename "${f%.html}")"
  out="$PWD/${name}.png"
  raw="$PWD/${name}.raw.png"
  if [ "$name" = "feature-graphic" ]; then
    w=1024
    h=500
  else
    w=1080
    h=1920
  fi
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --allow-file-access-from-files --window-size=$w,$h \
    --screenshot="$raw" "file://$PWD/$f" >/dev/null 2>&1
  sips -z $h $w "$raw" --out "$out" >/dev/null 2>&1
  rm -f "$raw"
  echo "rendered $out"
done
