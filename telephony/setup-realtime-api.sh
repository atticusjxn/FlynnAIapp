#!/bin/bash

# OpenAI Realtime API Setup Script
# Helps configure your environment for ultra-low latency AI receptionist

set -e

echo "======================================================================"
echo "Flynn AI - OpenAI Realtime API Setup"
echo "======================================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${RED}✗ No .env file found${NC}"
    echo "Creating .env file from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✓ Created .env file${NC}"
    else
        touch .env
        echo -e "${YELLOW}⚠ Created empty .env file${NC}"
    fi
fi

# Check for required environment variables
echo "Checking configuration..."
echo ""

check_env_var() {
    local var_name=$1
    local var_value=$(grep "^${var_name}=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'")

    if [ -z "$var_value" ]; then
        echo -e "${RED}✗ ${var_name} not set${NC}"
        return 1
    else
        echo -e "${GREEN}✓ ${var_name} configured${NC}"
        return 0
    fi
}

ERRORS=0

# Check OpenAI API Key
if ! check_env_var "OPENAI_API_KEY"; then
    echo "  → Get your API key from: https://platform.openai.com/api-keys"
    ((ERRORS++))
fi

# Check Twilio credentials
if ! check_env_var "TWILIO_ACCOUNT_SID"; then
    echo "  → Get from: https://console.twilio.com/"
    ((ERRORS++))
fi

if ! check_env_var "TWILIO_AUTH_TOKEN"; then
    echo "  → Get from: https://console.twilio.com/"
    ((ERRORS++))
fi

if ! check_env_var "TWILIO_FROM_NUMBER"; then
    echo "  → Your Twilio phone number (e.g., +15551234567)"
    ((ERRORS++))
fi

# Check Server URL
if ! check_env_var "SERVER_PUBLIC_URL"; then
    echo "  → Set to your ngrok URL (e.g., https://abc123.ngrok-free.app)"
    ((ERRORS++))
fi

# Check Supabase
if ! check_env_var "SUPABASE_URL"; then
    echo "  → Get from: https://app.supabase.com/ → Project Settings"
    ((ERRORS++))
fi

if ! check_env_var "SUPABASE_SERVICE_ROLE_KEY"; then
    echo "  → Get from: https://app.supabase.com/ → Project Settings → API"
    ((ERRORS++))
fi

echo ""

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}✗ ${ERRORS} configuration error(s) found${NC}"
    echo ""
    echo "Please update your .env file with the missing variables and run this script again."
    exit 1
fi

echo -e "${GREEN}✓ All required configuration found${NC}"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠ node_modules not found, running npm install...${NC}"
    npm install
    echo ""
fi

# Check if WebSocket (ws) package is installed
if ! npm list ws > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Installing WebSocket (ws) package...${NC}"
    npm install ws
    echo ""
fi

echo "======================================================================"
echo "Setup Complete!"
echo "======================================================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Start your server:"
echo "   ${GREEN}node server.js${NC}"
echo ""
echo "2. Start ngrok (in another terminal):"
echo "   ${GREEN}ngrok http 3000${NC}"
echo ""
echo "3. Update Twilio webhook URL to:"
echo "   ${GREEN}\${SERVER_PUBLIC_URL}/telephony/realtime-inbound-voice${NC}"
echo ""
echo "4. Test by calling your Twilio number!"
echo ""
echo "Expected latency: ${GREEN}300-600ms${NC} (vs 5-10s with old system)"
echo ""
echo "For detailed documentation, see:"
echo "  telephony/REALTIME_API_MIGRATION.md"
echo ""
echo "======================================================================"
