#!/usr/bin/env bash
# Renders each html/*.html to a 1080x1920 PNG with headless Chrome (Play-compliant phone size).
set -euo pipefail
cd "$(dirname "$0")"

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
node generate.js

for f in html/*.html; do
  name="$(basename "${f%.html}")"
  out="$PWD/${name}.png"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --allow-file-access-from-files --window-size=1080,1920 \
    --screenshot="$out" "file://$PWD/$f" >/dev/null 2>&1
  echo "rendered $out"
done
