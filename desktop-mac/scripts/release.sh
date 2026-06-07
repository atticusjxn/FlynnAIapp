#!/usr/bin/env bash
# One-command release: build + notarize the DMG, publish it to flynnai.app, verify the link.
#
# Usage:
#   ./scripts/release.sh 1.0.1
#   ./scripts/release.sh            # defaults to the version in project.yml
#
# Prereqs (already set up once):
#   - Developer ID Application cert in keychain (team 69T5H7R46N)
#   - Notary profile "flynnai-notary" stored via `xcrun notarytool store-credentials`
#   - create-dmg installed (brew install create-dmg)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LANDING_DIR="$(cd "$PROJECT_DIR/../flynn-ai-new-landingpage" && pwd)"
DOWNLOAD_DEST="$LANDING_DIR/public/download/Flynn.dmg"
PUBLIC_URL="https://flynnai.app/download/Flynn.dmg"

TEAM_ID="${TEAM_ID:-69T5H7R46N}"

# Version: first arg, else env, else current value in project.yml
if [[ "${1:-}" != "" ]]; then
  VERSION="$1"
elif [[ "${VERSION:-}" != "" ]]; then
  VERSION="$VERSION"
else
  VERSION="$(grep -m1 'CFBundleShortVersionString:' "$PROJECT_DIR/project.yml" | sed -E 's/.*"([^"]+)".*/\1/')"
fi

echo "=== Flynn Desktop release ==="
echo "Version:  $VERSION"
echo "Team:     $TEAM_ID"
echo "Publish:  $PUBLIC_URL"
echo ""

# 1. Build + notarize + staple + package the DMG
VERSION="$VERSION" TEAM_ID="$TEAM_ID" "$SCRIPT_DIR/build-dmg.sh"

DMG_PATH="$PROJECT_DIR/build/dmg/FlynnDesktop-${VERSION}.dmg"
if [[ ! -f "$DMG_PATH" ]]; then
  echo "❌  Expected DMG not found at $DMG_PATH"
  exit 1
fi

# 2. Publish into the landing page and deploy
echo ""
echo "→ Publishing DMG to landing page..."
mkdir -p "$(dirname "$DOWNLOAD_DEST")"
cp "$DMG_PATH" "$DOWNLOAD_DEST"

echo "→ Deploying site to Cloudflare..."
pushd "$LANDING_DIR" > /dev/null
npm run cf:deploy
popd > /dev/null

# 3. Verify the public link
echo ""
echo "→ Verifying $PUBLIC_URL ..."
sleep 2
HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' "$PUBLIC_URL")"
if [[ "$HTTP_CODE" == "200" ]]; then
  echo ""
  echo "✅  Released $VERSION"
  echo "   $PUBLIC_URL"
else
  echo "⚠️  Link returned HTTP $HTTP_CODE — deploy may still be propagating. Re-check in a minute."
fi
