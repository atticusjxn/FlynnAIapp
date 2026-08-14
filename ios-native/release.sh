#!/usr/bin/env bash
#
# Archive, sign, validate and upload the iOS app to App Store Connect.
#
#   ./release.sh              archive -> export -> validate -> upload
#   ./release.sh --dry-run    stop after validate (no upload)
#
# Signing uses an App Store Connect API key with the ADMIN role. That matters:
# an App Manager key can upload builds but cannot use cloud-managed signing, so
# -exportArchive dies with "Cloud signing permission error / No signing
# certificate iOS Distribution found". Cloud signing is what lets a machine sign
# for distribution WITHOUT holding the certificate's private key in its keychain
# — which is the state this Mac is in (the distribution certs exist in the
# account, but their private keys were generated elsewhere).
#
# Credentials come from the gitignored FlynnAI/Config/AppStoreConnect.local.env;
# the .p8 itself lives in ~/.appstoreconnect/private_keys/ and is never in the
# repo. Bump MARKETING_VERSION / CURRENT_PROJECT_VERSION in project.yml before
# running — App Store Connect rejects a build number it has already seen.
set -euo pipefail
cd "$(dirname "$0")"

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

ENV_FILE="FlynnAI/Config/AppStoreConnect.local.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: $ENV_FILE not found. See the header of this script." >&2
  exit 1
fi
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8"
if [[ ! -f "$KEY_PATH" ]]; then
  echo "error: signing key not found at $KEY_PATH" >&2
  exit 1
fi

AUTH=(-authenticationKeyPath "$KEY_PATH"
      -authenticationKeyID "$ASC_KEY_ID"
      -authenticationKeyIssuerID "$ASC_ISSUER_ID")

VERSION=$(grep 'MARKETING_VERSION:' project.yml | head -1 | sed 's/.*"\(.*\)".*/\1/')
BUILD=$(grep 'CURRENT_PROJECT_VERSION:' project.yml | head -1 | sed 's/.*"\(.*\)".*/\1/')
echo "==> Releasing $VERSION ($BUILD)"

echo "==> Regenerating project"
xcodegen generate

echo "==> Archiving"
rm -rf build/FlynnAI.xcarchive build/export
xcodebuild archive \
  -project FlynnAI.xcodeproj -scheme FlynnAI \
  -destination 'generic/platform=iOS' \
  -archivePath build/FlynnAI.xcarchive \
  -allowProvisioningUpdates "${AUTH[@]}" \
  | grep -E "error:|ARCHIVE SUCCEEDED|ARCHIVE FAILED"

echo "==> Exporting"
xcodebuild -exportArchive \
  -archivePath build/FlynnAI.xcarchive \
  -exportPath build/export \
  -exportOptionsPlist ExportOptions.plist \
  -allowProvisioningUpdates "${AUTH[@]}" \
  | grep -E "error:|EXPORT SUCCEEDED|EXPORT FAILED"

echo "==> Validating"
xcrun altool --validate-app -f build/export/FlynnAI.ipa -t ios \
  --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"

if $DRY_RUN; then
  echo "==> --dry-run: stopping before upload"
  exit 0
fi

echo "==> Uploading"
xcrun altool --upload-app -f build/export/FlynnAI.ipa -t ios \
  --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"

echo "==> Done. Processing takes a few minutes before the build shows in TestFlight."
