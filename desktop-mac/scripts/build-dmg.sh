#!/usr/bin/env bash
# Build, notarize, and package Flynn Desktop into a distributable DMG.
#
# Prerequisites:
#   brew install create-dmg
#   xcode-select --install
#   Developer ID Application certificate in keychain
#   Apple ID notarization credentials stored in keychain:
#     xcrun notarytool store-credentials "flynnai-notary" \
#       --apple-id "YOUR_APPLE_ID" \
#       --team-id "YOUR_TEAM_ID" \
#       --password "APP_SPECIFIC_PASSWORD"
#
# Usage:
#   VERSION=1.0.0 TEAM_ID=XXXXXXXXXX ./scripts/build-dmg.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_DIR/build"
ARCHIVE_PATH="$BUILD_DIR/FlynnDesktop.xcarchive"
EXPORT_DIR="$BUILD_DIR/export"
DMG_DIR="$BUILD_DIR/dmg"

VERSION="${VERSION:-1.0.0}"
TEAM_ID="${TEAM_ID:-}"
SIGNING_IDENTITY="${SIGNING_IDENTITY:-Developer ID Application}"
NOTARY_PROFILE="${NOTARY_PROFILE:-flynnai-notary}"

APP_NAME="Flynn Desktop"
BUNDLE_ID="com.flynnai.desktop"

echo "=== Flynn Desktop build ==="
echo "Version: $VERSION"
echo "Build dir: $BUILD_DIR"

mkdir -p "$BUILD_DIR" "$EXPORT_DIR" "$DMG_DIR"

# Step 0: Generate Xcode project from project.yml (requires xcodegen)
if command -v xcodegen &>/dev/null; then
  echo "→ Generating Xcode project with xcodegen..."
  pushd "$PROJECT_DIR" > /dev/null
  xcodegen generate
  popd > /dev/null
else
  echo "⚠️  xcodegen not found — assuming FlynnDesktop.xcodeproj already exists"
fi

# Step 1: Archive
echo "→ Archiving..."
xcodebuild archive \
  -project "$PROJECT_DIR/FlynnDesktop.xcodeproj" \
  -scheme FlynnDesktop \
  -configuration Release \
  -archivePath "$ARCHIVE_PATH" \
  -destination "generic/platform=macOS" \
  CURRENT_PROJECT_VERSION="$VERSION" \
  MARKETING_VERSION="$VERSION" \
  ${TEAM_ID:+DEVELOPMENT_TEAM="$TEAM_ID"} \
  CODE_SIGN_IDENTITY="$SIGNING_IDENTITY" \
  CODE_SIGN_STYLE=Manual

# Step 2: Export
echo "→ Exporting..."
cat > "$BUILD_DIR/ExportOptions.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>developer-id</string>
    <key>teamID</key>
    <string>${TEAM_ID}</string>
    <key>signingStyle</key>
    <string>manual</string>
    <key>signingCertificate</key>
    <string>${SIGNING_IDENTITY}</string>
</dict>
</plist>
EOF

xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist "$BUILD_DIR/ExportOptions.plist"

# Auto-detect the exported .app (product is FlynnDesktop.app, not "Flynn Desktop.app")
APP_PATH="$(find "$EXPORT_DIR" -maxdepth 1 -name '*.app' | head -1)"
APP_BASENAME="$(basename "$APP_PATH")"
echo "   Exported: $APP_PATH"

# Step 3: Notarize the app (notarytool needs a zip, not a raw .app)
echo "→ Notarizing app (this takes 1–3 minutes)..."
ZIP_PATH="$BUILD_DIR/FlynnDesktop-notarize.zip"
rm -f "$ZIP_PATH"
ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"
xcrun notarytool submit "$ZIP_PATH" \
  --keychain-profile "$NOTARY_PROFILE" \
  --wait

# Step 4: Staple the ticket onto the .app
echo "→ Stapling notarization ticket..."
xcrun stapler staple "$APP_PATH"

# Step 5: Verify
echo "→ Verifying..."
spctl --assess --type exec --verbose "$APP_PATH"

# Step 6: Create DMG
echo "→ Creating DMG..."
DMG_NAME="FlynnDesktop-${VERSION}.dmg"
DMG_PATH="$DMG_DIR/$DMG_NAME"

rm -f "$DMG_PATH"
create-dmg \
  --volname "$APP_NAME $VERSION" \
  --window-size 660 400 \
  --icon-size 128 \
  --icon "$APP_BASENAME" 180 170 \
  --app-drop-link 480 170 \
  --no-internet-enable \
  "$DMG_PATH" \
  "$APP_PATH"

# Notarize and staple the DMG itself (so the download is trusted, not just the app)
echo "→ Notarizing DMG..."
xcrun notarytool submit "$DMG_PATH" --keychain-profile "$NOTARY_PROFILE" --wait
xcrun stapler staple "$DMG_PATH"

echo ""
echo "✅  Build complete!"
echo "   DMG: $DMG_PATH"
echo "   Size: $(du -sh "$DMG_PATH" | cut -f1)"
