#!/bin/zsh
# One-shot go-live for flynnai.app/start (web signup + trial). Run from anywhere.
# The DB migration is ALREADY applied (web_signups table exists).
set -euo pipefail
REPO=/Users/atticus/FlynnAIapp
APP=flynnai-telephony

# Flynn's live publishable key (public by design) from app.config.js
PK=$(grep -oE "pk_live_[A-Za-z0-9]+" "$REPO/app.config.js" | head -1)
[[ -n "$PK" ]] || { echo "No pk_live in app.config.js"; exit 1; }

echo "1/4 Fly login (browser opens)…"
fly auth whoami >/dev/null 2>&1 || fly auth login

echo "2/4 Secrets: publishable key + Australian male voice (Arlo)…"
EXTRA=()
[[ -n "${STRIPE_PRICE_RECEPTIONIST_MONTHLY:-}" ]] && EXTRA+=("STRIPE_PRICE_RECEPTIONIST_MONTHLY=$STRIPE_PRICE_RECEPTIONIST_MONTHLY")
fly secrets set -a "$APP" --stage STRIPE_PUBLISHABLE_KEY="$PK" CARTESIA_VOICE_AU_MALE=12e85709-099c-480a-ba3e-875c41a9611a "${EXTRA[@]}"

echo "3/4 Deploy backend (branch web-signup)…"
cd "$REPO" && fly deploy -a "$APP"

echo "4/4 Deploy website (Cloudflare)…"
cd "$REPO/flynn-ai-new-landingpage"
npx wrangler whoami >/dev/null 2>&1 || npx wrangler login
npx wrangler deploy

curl -s -o /dev/null -w "flynnai.app/start/bradley → %{http_code}\n" https://flynnai.app/start/bradley
echo "Done. Send Bradley: https://flynnai.app/start/bradley"
