#!/usr/bin/env bash
# Configure Chrome to open the Flynn GTM dashboard every time you launch it.
#
# What it does:
#   - Sets restore_on_startup = 4 (open specific pages)
#   - Sets startup_urls = [dashboard URL]
#   - Sets startup_urls_migration_time so Chrome doesn't overwrite
#
# Run: bash gtm-automation/scripts/set-chrome-startup.sh
# Undo: bash gtm-automation/scripts/set-chrome-startup.sh --undo

set -euo pipefail

DASHBOARD_URL="https://flynn-gtm-dashboard.atticusjxn.workers.dev"
PREFS="$HOME/Library/Application Support/Google/Chrome/Default/Preferences"
SECURE_PREFS="$HOME/Library/Application Support/Google/Chrome/Default/Secure Preferences"

if [[ ! -f "$PREFS" ]]; then
  echo "❌ Chrome Preferences not found at: $PREFS"
  echo "   Is Chrome installed in a non-default location, or using a different profile?"
  exit 1
fi

if pgrep -x "Google Chrome" > /dev/null; then
  echo "⚠️  Chrome is currently running."
  echo "   Chrome rewrites Preferences on shutdown, so we need to quit it cleanly first."
  read -r -p "   Quit Chrome and re-open with the dashboard? [y/N] " yn
  case "$yn" in
    [Yy]*) ;;
    *) echo "Cancelled. Edit Chrome Settings → On startup → Open a specific page → add $DASHBOARD_URL"; exit 0 ;;
  esac
  osascript -e 'tell application "Google Chrome" to quit'
  for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 0.5
    if ! pgrep -x "Google Chrome" > /dev/null; then break; fi
  done
  if pgrep -x "Google Chrome" > /dev/null; then
    echo "❌ Chrome didn't quit. Force-close it (Cmd+Q) and re-run this script."
    exit 1
  fi
fi

if [[ "${1:-}" == "--undo" ]]; then
  echo "Restoring previous startup behavior (continue where you left off)..."
  python3 - <<EOF
import json
p = "$PREFS"
with open(p) as f: d = json.load(f)
sess = d.setdefault("session", {})
sess["restore_on_startup"] = 1   # 1 = continue where you left off
sess["startup_urls"] = []
with open(p, "w") as f: json.dump(d, f, separators=(",", ":"))
print("✅ Reverted to 'Continue where you left off'")
EOF
  echo "   Reopen Chrome — it'll restore your last session as before."
  exit 0
fi

echo "Setting Chrome to open the GTM dashboard on every launch..."
python3 - <<EOF
import json
p = "$PREFS"
with open(p) as f: d = json.load(f)
sess = d.setdefault("session", {})
sess["restore_on_startup"] = 4   # 4 = open specific pages
sess["startup_urls"] = ["$DASHBOARD_URL"]
# Make Chrome trust the change (otherwise it sometimes flags as "modified externally")
import time
sess["startup_urls_migration_time"] = str(int(time.time() * 1_000_000))
with open(p, "w") as f: json.dump(d, f, separators=(",", ":"))
print("✅ Chrome will open $DASHBOARD_URL on every launch")
EOF

echo ""
echo "Reopening Chrome..."
open -a "Google Chrome"
echo ""
echo "Done. From now on, every time you open Chrome the GTM dashboard loads first."
echo "To revert: bash $0 --undo"
