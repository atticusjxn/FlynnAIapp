#!/usr/bin/env bash
#
# Set up the Flynn GTM dashboard to auto-open every time you log in to your Mac.
#
# What this does:
#   1. Sets Chrome's "On startup → Open a specific page" to the dashboard URL.
#   2. Adds Google Chrome to macOS Login Items so it launches at login.
#
# Run once:
#   ./gtm-dashboard/setup-mac-autostart.sh https://gtm.flynn.ai
#
# To revert: run with `--remove`, or System Settings → General → Login Items.

set -euo pipefail

DEFAULT_URL="https://gtm.flynn.ai"
URL="${1:-$DEFAULT_URL}"

if [[ "$URL" == "--remove" ]]; then
  echo "Removing Google Chrome from Login Items…"
  osascript -e 'tell application "System Events" to delete login item "Google Chrome"' 2>/dev/null || true
  echo "Done. Restart not required."
  exit 0
fi

if [[ ! "$URL" =~ ^https?:// ]]; then
  echo "URL must start with http:// or https://. Got: $URL" >&2
  exit 1
fi

echo "Configuring Chrome startup tab → $URL"

# Chrome stores managed startup-URL settings under
# ~/Library/Application Support/Google/Chrome/Default/Preferences (JSON).
# Easier: set them via Chrome's command-line on first launch through Login Items.
# Even easier: set the policy file. We use the Preferences-edit approach so it
# survives Chrome restarts without requiring a profile-policy install.

PREFS="$HOME/Library/Application Support/Google/Chrome/Default/Preferences"
if [[ ! -f "$PREFS" ]]; then
  echo "Chrome preferences not found at $PREFS"
  echo "Open Chrome at least once, then re-run this script."
  exit 1
fi

# Use python (always available on macOS) to merge the settings.
python3 - "$PREFS" "$URL" <<'PY'
import json, sys
prefs_path, url = sys.argv[1], sys.argv[2]
with open(prefs_path) as f:
    p = json.load(f)
session = p.setdefault("session", {})
session["restore_on_startup"] = 4   # 4 = "Open specific pages"
session["startup_urls"] = [url]
with open(prefs_path, "w") as f:
    json.dump(p, f)
print(f"Set Chrome startup_urls = {url}")
PY

echo
echo "Adding Google Chrome to Login Items…"
osascript <<'AS'
tell application "System Events"
  if not (exists login item "Google Chrome") then
    make login item at end with properties {path:"/Applications/Google Chrome.app", hidden:false}
    return "added"
  else
    return "already present"
  end if
end tell
AS

echo
echo "✅ Done. Next time you log in, Chrome will open with the dashboard as its first tab."
echo "   Test now: pkill 'Google Chrome' || true; open -a 'Google Chrome'"
