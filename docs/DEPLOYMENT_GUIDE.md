# Flynn AI Production Deployment Guide

## Overview
This guide covers secure deployment of Flynn AI's backend telephony server to Fly.io with proper secrets management.

## Prerequisites

- Fly.io CLI installed (`brew install flyctl` or see https://fly.io/docs/hands-on/install-flyctl/)
- Access to Flynn AI git repository
- All required API credentials (see below)

## Required Secrets

### 1. Supabase Configuration
```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
APP_BASE_URL=https://flynnai-telephony.fly.dev
VOICEMAIL_STORAGE_BUCKET=voicemails
VOICEMAIL_SIGNED_URL_TTL_SECONDS=3600
VOICEMAIL_RETENTION_DAYS=30
```

### 2. LLM Provider (OpenAI)
```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-proj-...
RECEPTIONIST_MODEL=gpt-4o-realtime-preview-2024-12-17
JOB_EXTRACTION_MODEL=gpt-4o
```

### 3. Twilio Configuration
```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
SERVER_PUBLIC_URL=https://flynnai-telephony.fly.dev
```

### 4. Push Notifications

**Firebase (Android):**
```bash
FIREBASE_PROJECT_ID=your-firebase-project-id
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...",...}'
```

**Apple Push Notifications (iOS):**
```bash
APNS_KEY_ID=ABC1234567
APNS_TEAM_ID=XYZ9876543
APNS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
APNS_BUNDLE_ID=com.flynnai.app
APNS_HOST=https://api.push.apple.com
```

### 5. Voice Synthesis (ElevenLabs)
```bash
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
ELEVENLABS_VOICE_KOALA_WARM_ID=voice_id_1
ELEVENLABS_VOICE_KOALA_EXPERT_ID=voice_id_2
ELEVENLABS_VOICE_KOALA_HYPE_ID=voice_id_3
VOICE_PROFILE_BUCKET=voice-profiles
```

## Deployment Steps

### Step 1: Login to Fly.io
```bash
flyctl auth login
```

### Step 2: Navigate to Project
```bash
cd /path/to/FlynnAI
```

### Step 3: Set Secrets (CRITICAL - One at a Time)

**Note:** Never commit secrets to git. Always use Fly.io secrets management.

#### Set Basic Configuration
```bash
# Supabase
flyctl secrets set EXPO_PUBLIC_SUPABASE_URL="https://your-project.supabase.co" --app flynnai-telephony
flyctl secrets set EXPO_PUBLIC_SUPABASE_ANON_KEY="eyJhbGc..." --app flynnai-telephony
flyctl secrets set APP_BASE_URL="https://flynnai-telephony.fly.dev" --app flynnai-telephony
flyctl secrets set VOICEMAIL_STORAGE_BUCKET="voicemails" --app flynnai-telephony
flyctl secrets set VOICEMAIL_SIGNED_URL_TTL_SECONDS="3600" --app flynnai-telephony
flyctl secrets set VOICEMAIL_RETENTION_DAYS="30" --app flynnai-telephony

# LLM Provider
flyctl secrets set LLM_PROVIDER="openai" --app flynnai-telephony
flyctl secrets set OPENAI_API_KEY="sk-proj-..." --app flynnai-telephony
flyctl secrets set RECEPTIONIST_MODEL="gpt-4o-realtime-preview-2024-12-17" --app flynnai-telephony
flyctl secrets set JOB_EXTRACTION_MODEL="gpt-4o" --app flynnai-telephony

# Twilio
flyctl secrets set TWILIO_ACCOUNT_SID="ACxxxx..." --app flynnai-telephony
flyctl secrets set TWILIO_AUTH_TOKEN="your_token" --app flynnai-telephony
flyctl secrets set SERVER_PUBLIC_URL="https://flynnai-telephony.fly.dev" --app flynnai-telephony

# Firebase (Android Push)
flyctl secrets set FIREBASE_PROJECT_ID="your-project-id" --app flynnai-telephony
flyctl secrets set GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}' --app flynnai-telephony

# Apple Push (iOS)
flyctl secrets set APNS_KEY_ID="ABC1234567" --app flynnai-telephony
flyctl secrets set APNS_TEAM_ID="XYZ9876543" --app flynnai-telephony
flyctl secrets set APNS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----" --app flynnai-telephony
flyctl secrets set APNS_BUNDLE_ID="com.flynnai.app" --app flynnai-telephony
flyctl secrets set APNS_HOST="https://api.push.apple.com" --app flynnai-telephony

# ElevenLabs Voice
flyctl secrets set ELEVENLABS_API_KEY="your_key" --app flynnai-telephony
flyctl secrets set ELEVENLABS_MODEL_ID="eleven_multilingual_v2" --app flynnai-telephony
flyctl secrets set ELEVENLABS_VOICE_KOALA_WARM_ID="voice_id_1" --app flynnai-telephony
flyctl secrets set ELEVENLABS_VOICE_KOALA_EXPERT_ID="voice_id_2" --app flynnai-telephony
flyctl secrets set ELEVENLABS_VOICE_KOALA_HYPE_ID="voice_id_3" --app flynnai-telephony
flyctl secrets set VOICE_PROFILE_BUCKET="voice-profiles" --app flynnai-telephony
```

#### Alternative: Set Secrets from .env File
```bash
# Create a temporary secrets file (DO NOT COMMIT)
cat > /tmp/flynn-secrets.txt << 'EOF'
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
# ... (all other secrets)
EOF

# Import secrets (Fly.io will restart the app automatically)
flyctl secrets import < /tmp/flynn-secrets.txt --app flynnai-telephony

# Delete temporary file
rm /tmp/flynn-secrets.txt
```

### Step 4: Verify Secrets
```bash
# List all set secrets (values are hidden)
flyctl secrets list --app flynnai-telephony
```

### Step 5: Deploy Application
```bash
# Deploy to Fly.io (uses Dockerfile)
flyctl deploy --app flynnai-telephony

# Monitor deployment
flyctl status --app flynnai-telephony
```

### Step 6: Verify Health
```bash
# Check health endpoint
curl https://flynnai-telephony.fly.dev/health

# Expected response:
# {"status":"healthy","timestamp":"2025-01-27T..."}

# View logs
flyctl logs --app flynnai-telephony
```

## Security Checklist

- [ ] `.env` file is in `.gitignore` (already done ✓)
- [ ] All secrets set via `flyctl secrets` (not in code)
- [ ] Twilio signature validation enabled (see below)
- [ ] HTTPS enforced (Fly.io does this automatically)
- [ ] Supabase RLS policies enabled
- [ ] API keys rotated if previously exposed
- [ ] Private keys stored securely (never in git)
- [ ] Production secrets separate from development

## Enable Twilio Signature Validation

**CRITICAL:** Currently disabled (`TWILIO_VALIDATE_SIGNATURE=false`). Enable for production:

1. Set the secret to `true`:
```bash
flyctl secrets set TWILIO_VALIDATE_SIGNATURE="true" --app flynnai-telephony
```

2. Ensure `server.js` validates all Twilio webhooks:
```javascript
// Already implemented in server.js around line 1670
if (process.env.TWILIO_VALIDATE_SIGNATURE === 'true') {
  const signature = req.headers['x-twilio-signature'];
  const url = `${process.env.SERVER_PUBLIC_URL}${req.originalUrl}`;
  const isValid = twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN,
    signature,
    url,
    req.body
  );
  if (!isValid) {
    return res.status(403).json({ error: 'Invalid Twilio signature' });
  }
}
```

## Monitoring & Alerts

### View Real-Time Logs
```bash
flyctl logs --app flynnai-telephony
```

### Check Machine Status
```bash
flyctl status --app flynnai-telephony
```

### Scale Resources (if needed)
```bash
# Increase memory for heavy loads
flyctl scale memory 512 --app flynnai-telephony

# Add more machines for redundancy
flyctl scale count 2 --app flynnai-telephony
```

### Set Up Alerts
- Configure Fly.io monitoring in dashboard: https://fly.io/apps/flynnai-telephony
- Add Sentry for error tracking (see Phase 5 of roadmap)

## Rollback Procedure

If deployment fails or issues occur:

```bash
# View release history
flyctl releases --app flynnai-telephony

# Rollback to previous version
flyctl releases rollback --app flynnai-telephony
```

## Environment-Specific Configurations

### Development
- Use `.env.local` for local development
- Point to staging Supabase project
- Use sandbox APNS host
- Enable debug logging

### Staging
- Separate Fly.io app: `flynnai-telephony-staging`
- Use test Twilio numbers
- Lower resource limits

### Production
- App: `flynnai-telephony`
- Production Twilio numbers
- Signature validation enabled
- Proper resource limits (scale as needed)

## Troubleshooting

### Issue: App won't start
**Solution:** Check logs for missing environment variables
```bash
flyctl logs --app flynnai-telephony | grep -i error
```

### Issue: Twilio webhooks failing
**Solution:** Verify signature validation and public URL
```bash
# Check SERVER_PUBLIC_URL is correct
flyctl secrets list --app flynnai-telephony | grep SERVER_PUBLIC_URL

# Test webhook endpoint
curl -X POST https://flynnai-telephony.fly.dev/telephony/inbound-voice
```

### Issue: Push notifications not sending
**Solution:** Verify Firebase and APNS credentials
- Check GOOGLE_SERVICE_ACCOUNT_KEY is valid JSON
- Ensure APNS_PRIVATE_KEY includes newlines (`\n`)
- Verify APNS_HOST is production URL

### Issue: Voice synthesis not working
**Solution:** Check ElevenLabs API key and voice IDs
```bash
# Test ElevenLabs API
curl -X GET "https://api.elevenlabs.io/v1/voices" \
  -H "xi-api-key: your_elevenlabs_api_key"
```

## Cost Optimization

### Current Configuration
- VM: `shared-cpu-1x` with 256MB RAM
- Region: Sydney (`syd`) for low latency to Australia
- Min machines: 1 (always running)

### Recommendations
- Monitor CPU/memory usage via Fly.io metrics
- Scale up if call quality degrades under load
- Consider multiple regions if serving global users
- Use auto-stop for staging environments to save costs

## Next Steps

1. ✅ Deploy backend with secrets configured
2. ⏳ Set up Sentry error monitoring (Phase 5)
3. ⏳ Configure custom domain (optional)
4. ⏳ Set up CI/CD pipeline for automated deployments
5. ⏳ Load test with 100+ concurrent calls

## Support

- Fly.io Docs: https://fly.io/docs/
- Twilio Docs: https://www.twilio.com/docs
- Flynn AI Issues: https://github.com/your-org/flynnai/issues

---

Last updated: 2025-01-27
