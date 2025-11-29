# Flynn AI Deployment Guide

## Production Readiness Checklist

### ✅ Backend Setup Complete
- [x] Website scraping service with cheerio + turndown
- [x] AI-powered business profile generator
- [x] Greeting script and intake questions generator
- [x] API endpoints for scraping and config application
- [x] Integration with AI receptionist system prompt
- [x] Error handling and validation

### ✅ Frontend Setup Complete
- [x] WebsiteScraperSetup component with full UI
- [x] TypeScript types for all API responses
- [x] API client integration with auth
- [x] Loading states and error handling
- [x] Success/failure user feedback

---

## Required Environment Variables

### Server (.env)

```bash
# Required: Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Required: LLM Provider (choose one)
# Option 1: Grok/xAI
XAI_API_KEY=xai-your-api-key-here
LLM_PROVIDER=grok

# Option 2: OpenAI
OPENAI_API_KEY=sk-your-api-key-here
LLM_PROVIDER=openai

# Optional: Model overrides
PROFILE_GENERATION_MODEL=grok-2-1212  # or gpt-4o-mini
JOB_EXTRACTION_MODEL=grok-4-fast      # or gpt-4o-mini

# Required: Twilio (for phone calls)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Optional: Azure TTS (for voice synthesis)
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=eastus

# Optional: Deepgram (for transcription)
DEEPGRAM_API_KEY=your_deepgram_api_key

# Required: JWT Secret
JWT_SECRET=your_super_secret_jwt_key_here

# Required: Port
PORT=3000

# Optional: Voicemail settings
VOICEMAIL_SIGNED_URL_TTL_SECONDS=3600
VOICEMAIL_RETENTION_DAYS=30
```

### Mobile App (.env)

```bash
# Required: API Base URL
APP_BASE_URL=https://your-backend-url.com

# Required: Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here

# Optional: Expo Configuration
EXPO_PUBLIC_API_URL=https://your-backend-url.com
```

---

## Pre-Deployment Steps

### 1. Install Dependencies

```bash
# Install new dependencies
npm install axios cheerio turndown

# Verify all dependencies are installed
npm install
```

### 2. Verify Environment Variables

```bash
# Check server environment
node -e "require('dotenv').config(); console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✓' : '✗'); console.log('XAI_API_KEY or OPENAI_API_KEY:', (process.env.XAI_API_KEY || process.env.OPENAI_API_KEY) ? '✓' : '✗'); console.log('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID ? '✓' : '✗');"
```

### 3. Test Locally

```bash
# Start backend
npm run dev

# In another terminal, test endpoints
curl -X POST http://localhost:3000/health

# Test scraping endpoint (requires auth token)
curl -X POST http://localhost:3000/api/scrape-website \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"url":"https://example.com"}'
```

### 4. Database Migration Check

Ensure your `users` table has these columns:
- `receptionist_greeting` (text)
- `receptionist_questions` (jsonb)
- `receptionist_business_profile` (jsonb)

If not, run:
```sql
ALTER TABLE users
ADD COLUMN IF NOT EXISTS receptionist_greeting TEXT,
ADD COLUMN IF NOT EXISTS receptionist_questions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS receptionist_business_profile JSONB;
```

---

## Expo Production Build Commands

### Option 1: Build Both Platforms (Recommended)

```bash
# Build for iOS and Android simultaneously
npx eas build --profile production --platform all
```

### Option 2: Build Individually

```bash
# Build for iOS only
npx eas build --profile production --platform ios

# Build for Android only
npx eas build --profile production --platform android
```

### Option 3: Build and Submit

```bash
# Build and automatically submit to stores
npx eas build --profile production --platform all
npx eas submit --profile production --platform all --latest
```

---

## EAS Build Configuration

Ensure your `eas.json` has the production profile:

```json
{
  "build": {
    "production": {
      "node": "20.18.2",
      "channel": "production",
      "distribution": "store",
      "ios": {
        "resourceClass": "m-medium",
        "buildConfiguration": "Release"
      },
      "android": {
        "buildType": "app-bundle",
        "gradleCommand": ":app:bundleRelease"
      },
      "env": {
        "APP_BASE_URL": "https://your-production-backend.com",
        "EXPO_PUBLIC_API_URL": "https://your-production-backend.com"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "your-app-store-connect-app-id",
        "appleTeamId": "YOUR_APPLE_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./android/service-account.json",
        "track": "internal"
      }
    }
  }
}
```

---

## Over-The-Air (OTA) Updates

For quick updates that don't change native code:

```bash
# Publish update to production channel
npx eas update --branch production --message "Add website scraping feature"

# Check update status
npx eas update:list --branch production
```

---

## Build Monitoring

```bash
# Check build status
npx eas build:list --status in-progress

# View build logs
npx eas build:view <BUILD_ID>

# Cancel a build
npx eas build:cancel <BUILD_ID>
```

---

## Troubleshooting

### Build Fails with "Missing Dependencies"

```bash
# Clear npm cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Expo cache
npx expo start --clear
```

### "axios not found" or "cheerio not found"

```bash
# Ensure dependencies are in package.json (not devDependencies)
npm install --save axios cheerio turndown
```

### API Endpoints Return 401 Unauthorized

- Verify JWT token is being sent correctly
- Check `authenticateJwt` middleware is working
- Ensure `JWT_SECRET` environment variable is set on server

### TypeScript Errors in Component

```bash
# Ensure types file exists
ls src/types/receptionist.ts

# Clear TypeScript cache
rm -rf .expo
npx expo start --clear
```

---

## Post-Deployment Verification

### 1. Test Backend Endpoints

```bash
# Health check
curl https://your-backend.com/health

# Test authenticated endpoint (replace TOKEN)
curl -X POST https://your-backend.com/api/scrape-website \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

### 2. Test Mobile App

1. Install the app from TestFlight (iOS) or internal track (Android)
2. Navigate to Settings → Receptionist Setup
3. Add WebsiteScraperSetup component
4. Enter a test website URL
5. Verify generation works
6. Apply configuration
7. Make a test call to verify new greeting

### 3. Monitor Logs

```bash
# Server logs (Railway/Heroku/etc)
railway logs --tail

# EAS logs
npx eas build:list
npx eas update:list
```

---

## Rollback Procedure

### If New Build Has Issues

```bash
# Revert to previous version via OTA
npx eas update --branch production --message "Rollback to stable version"

# Or republish previous build
npx eas submit --id <PREVIOUS_BUILD_ID>
```

### If Backend Has Issues

1. Revert Git commit
2. Redeploy previous version
3. Verify functionality restored

---

## Success Criteria

✅ Build completes without errors
✅ App launches on both iOS and Android
✅ Website scraping generates valid config
✅ Config applies successfully to user settings
✅ AI receptionist uses new greeting on test call
✅ No crashes or errors in production logs

---

## Support

If you encounter issues:

1. Check logs: `npx eas build:view <BUILD_ID>`
2. Verify environment variables are set
3. Test backend endpoints directly with curl
4. Clear caches and rebuild: `npx expo start --clear`
5. Check Railway/backend deployment logs

---

**Last Updated:** January 2025
**Version:** 1.1.0 (Website Scraping Feature)
