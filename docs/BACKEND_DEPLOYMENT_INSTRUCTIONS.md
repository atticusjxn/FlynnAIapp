# Backend API Deployment Instructions

## Summary

I've created secure API endpoints for your Flynn AI mobile app, but they need to be added to your backend source code and properly deployed to Fly.dev.

**Status:** ⚠️ Code created but NOT yet deployed permanently

---

## What Was Done

### 1. Security Fixes in Mobile App ✅
- Removed exposed Twilio credentials from `/Users/atticus/FlynnAI/.env`
- Updated `/Users/atticus/FlynnAI/src/services/TwilioService.ts` to use backend proxy
- Mobile app is now secure and ready

### 2. Backend API Code Created ✅
- Created `/tmp/secureApiRoutes.js` - A complete module with 6 secure endpoints
- Module is ready to be added to your backend project

### 3. Deployment ⚠️ NOT COMPLETE
- Temporary upload to Fly.dev was successful but lost on restart
- Fly.dev restarts from Docker image, which doesn't have our changes
- Need to add code to source repository and redeploy

---

## What You Need to Do

### Step 1: Locate Your Backend Source Code

Your backend is deployed at `https://flynnai-telephony.fly.dev` but I couldn't find the source code locally.

**Find it by searching:**
```bash
# Search for the backend project folder
find ~ -name "fly.toml" -type f 2>/dev/null | grep telephony

# Or search for server.js
find ~ -name "server.js" -type f 2>/dev/null | grep -v node_modules | head -5
```

Common locations:
- `~/flynn-backend/`
- `~/flynnai-backend/`
- `~/telephony/`
- `~/flynnai-telephony/`
- Separate Git repository

###  Step 2: Add the Secure API Routes Module

**File to create:** `secureApiRoutes.js` in your backend project root

Copy the file from: `/tmp/secureApiRoutes.js`

```bash
# Example (adjust path to your backend folder):
cp /tmp/secureApiRoutes.js ~/your-backend-folder/secureApiRoutes.js
```

**File contents:** See `/tmp/secureApiRoutes.js` (11KB file)

This module exports a function that attaches 6 secure API endpoints:
1. `POST /api/twilio/search-numbers`
2. `POST /api/twilio/purchase-number`
3. `DELETE /api/twilio/release-number`
4. `POST /api/twilio/send-sms`
5. `POST /api/ai/extract-job`
6. `POST /api/twilio/lookup-carrier`
7. `GET /api/health` (health check)

### Step 3: Load the Module in server.js

**Find this section in your `server.js`:**
```javascript
// ============================================================================
// Reminder System API Endpoints
// ============================================================================
```

**Add BEFORE that section:**
```javascript
// ============================================================================
// SECURE API ENDPOINTS FOR MOBILE APP
// ============================================================================

const attachSecureApiRoutes = require('./secureApiRoutes');
attachSecureApiRoutes(app, {
  twilioAccountSid,
  twilioAuthToken,
  twilioSmsFromNumber,
  authenticateJwt,
  getLLMClient,
  twilio,
});
```

### Step 4: Deploy to Fly.dev

```bash
cd ~/your-backend-folder

# Deploy the updated code
fly deploy --app flynnai-telephony

# Or if using Git-based deployment:
git add secureApiRoutes.js server.js
git commit -m "Add secure API endpoints for mobile app"
git push origin main
fly deploy
```

### Step 5: Verify Deployment

**Test the health endpoint:**
```bash
curl -s https://flynnai-telephony.fly.dev/api/health | python3 -m json.tool
```

**Expected response:**
```json
{
  "status": "ok",
  "service": "Flynn AI Secure API",
  "timestamp": "2025-01-22T...",
  "endpoints": {
    "POST /api/twilio/search-numbers": "Search available numbers",
    "POST /api/twilio/purchase-number": "Purchase phone number",
    "DELETE /api/twilio/release-number": "Release phone number",
    "POST /api/twilio/send-sms": "Send SMS message",
    "POST /api/ai/extract-job": "Extract job from transcript",
    "POST /api/twilio/lookup-carrier": "Lookup carrier info (optional)"
  }
}
```

**Test authenticated endpoint:**
```bash
# Get a JWT token from your Supabase project
# Then test:
curl -X POST https://flynnai-telephony.fly.dev/api/twilio/search-numbers \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"countryCode":"US","limit":5,"voiceEnabled":true}'
```

**Expected response:**
```json
{
  "availableNumbers": [
    {
      "phone_number": "+15551234567",
      "friendly_name": "US Local Number",
      "capabilities": { "voice": true, "sms": true, "fax": false },
      ...
    }
  ]
}
```

---

## Alternative: Manual Deployment (If You Can't Find Source)

If you can't locate your backend source code, you can manually update the running server:

### Quick Manual Update (Temporary - Lost on Restart)

```bash
# 1. Upload the module
fly ssh sftp put /tmp/secureApiRoutes.js /app/secureApiRoutes.js --app flynnai-telephony

# 2. SSH into the server
fly ssh console --app flynnai-telephony

# 3. Edit server.js (find line ~3151, before Reminder System section)
vi /app/server.js

# Add these lines before "// ============================================================================\n// Reminder System API Endpoints":
const attachSecureApiRoutes = require('./secureApiRoutes');
attachSecureApiRoutes(app, {
  twilioAccountSid,
  twilioAuthToken,
  twilioSmsFromNumber,
  authenticateJwt,
  getLLMClient,
  twilio,
});

# Save and exit (:wq)

# 4. Restart Node.js
pkill -f 'node server.js'
exit

# 5. Test
curl https://flynnai-telephony.fly.dev/api/health
```

**⚠️ WARNING:** This manual method is temporary! Changes will be lost when:
- Fly.dev restarts the app
- You deploy new code
- The machine crashes

### Permanent Solution: Rebuild Docker Image

If you have the `Dockerfile`:

```bash
# 1. Add secureApiRoutes.js to your project
# 2. Update server.js to require it
# 3. Rebuild and push Docker image

docker build -t flynnai-telephony .
fly deploy --app flynnai-telephony
```

---

## Testing Checklist

After deployment, verify each endpoint:

- [ ] `GET /api/health` returns 200 with endpoint list
- [ ] `POST /api/twilio/search-numbers` (with JWT) returns available numbers
- [ ] `POST /api/twilio/purchase-number` (with JWT) can purchase a test number
- [ ] `POST /api/twilio/send-sms` (with JWT) sends SMS successfully
- [ ] `POST /api/ai/extract-job` (with JWT) extracts job from transcript
- [ ] All endpoints return 401 without JWT token
- [ ] Mobile app can provision numbers without crashes
- [ ] Mobile app can send SMS via backend proxy

---

## Troubleshooting

### Issue: "Cannot GET /api/health"
**Cause:** Routes not loaded or server not restarted
**Fix:**
1. Verify `secureApiRoutes.js` exists in `/app/`
2. Verify `require('./secureApiRoutes')` is in server.js
3. Restart server or redeploy

### Issue: "Module not found: secureApiRoutes"
**Cause:** File not in correct location
**Fix:**
1. Check file path: `ls -la /app/secureApiRoutes.js`
2. Ensure it's in same directory as server.js
3. Use `./secureApiRoutes` (with ./) in require()

### Issue: "twilioAccountSid is not defined"
**Cause:** Variables not passed to module correctly
**Fix:** Verify the attachSecureApiRoutes call passes all required parameters

### Issue: "Unauthorized" on all requests
**Cause:** JWT authentication failing
**Fix:**
1. Verify `authenticateJwt` middleware is working
2. Check Supabase JWT secret is correct
3. Test with fresh JWT token from Supabase

---

## Environment Variables Required

Ensure these are set on Fly.dev:

```bash
# Twilio (already configured)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_SMS_FROM_NUMBER=+61363588413
SERVER_PUBLIC_URL=https://flynnai-telephony.fly.dev

# Supabase (already configured)
SUPABASE_URL=https://zvfeafmmtfplzpnocyjw.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=...

# LLM (already configured)
GROK_API_KEY=xai-...
OPENAI_API_KEY=sk-proj-...
GEMINI_API_KEY=AIzaSy...
```

Check with:
```bash
fly secrets list --app flynnai-telephony
```

---

## Summary

**What's Ready:**
- ✅ Mobile app updated (secure)
- ✅ Backend API code written
- ✅ Documentation complete
- ✅ Test user setup SQL ready

**What You Need To Do:**
1. Find your backend source code folder
2. Copy `/tmp/secureApiRoutes.js` to backend folder
3. Add `require('./secureApiRoutes')` to server.js
4. Deploy: `fly deploy --app flynnai-telephony`
5. Test: `curl https://flynnai-telephony.fly.dev/api/health`
6. Create test user in Supabase (see `SETUP_TEST_USER.sql`)
7. Send app + credentials to test user

**Estimated Time:** 15-30 minutes (once you locate backend source)

---

## Need Help?

If you can't find your backend source code:
1. Check your GitHub/GitLab repositories
2. Search your computer: `find ~ -name "fly.toml" -type f 2>/dev/null`
3. Check if backend is deployed from a different machine
4. Consider extracting code from running Fly.dev machine and creating new repo

---

**File Locations for Reference:**
- Backend module: `/tmp/secureApiRoutes.js` (copy this!)
- Mobile app changes: Already done in `/Users/atticus/FlynnAI/`
- Documentation: `/Users/atticus/FlynnAI/docs/`
- Test user SQL: `/Users/atticus/FlynnAI/docs/SETUP_TEST_USER.sql`

**Next Steps:** Find backend source → Add module → Deploy → Test → Launch! 🚀
