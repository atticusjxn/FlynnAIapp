# Flynn AI Production Testing - Quick Start

**Last Updated:** January 22, 2025

---

## ⚡ 5-Minute Setup Guide

Follow these steps to set up production testing for user `2704fmb@gmail.com`:

### Step 1: Deploy Backend API (30-60 minutes)

**Option A: Use Existing Backend (Recommended)**
If your backend at `https://flynnai-telephony.fly.dev` is already running:

1. Add the 6 new API endpoints from `/docs/BACKEND_API_REQUIREMENTS.md`
2. Deploy updated backend to Fly.dev
3. Test endpoints with curl:
```bash
curl -X POST https://flynnai-telephony.fly.dev/api/twilio/search-numbers \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{"countryCode":"US","limit":5}'
```

**Option B: Quick Deploy with Node.js**
```bash
cd backend/  # or create new directory
npm init -y
npm install express twilio @supabase/supabase-js

# Copy example implementation from BACKEND_API_REQUIREMENTS.md
# Add environment variables
# Deploy to Fly.dev/Railway/Heroku
```

### Step 2: Create Test User (5 minutes)

1. **Open Supabase Dashboard:** https://supabase.com/dashboard
2. **Navigate to:** Authentication → Users
3. **Click:** "Invite User"
4. **Enter:** `2704fmb@gmail.com`
5. **Set password:** Generate strong temporary password (save it!)
6. **Click:** "Send Invitation"
7. **Go to:** SQL Editor
8. **Run this query:**
```sql
-- Get user ID
SELECT id FROM auth.users WHERE email = '2704fmb@gmail.com';
```
9. **Copy the user ID** (UUID)
10. **Open:** `/docs/SETUP_TEST_USER.sql`
11. **Replace** `USER_ID_HERE` with actual UUID
12. **Run** the DO block (Step 3 in the SQL file)
13. **Verify:**
```sql
SELECT u.email, o.plan, o.call_allowance, om.role
FROM users u
JOIN org_members om ON u.id = om.user_id
JOIN organizations o ON o.id = om.org_id
WHERE u.email = '2704fmb@gmail.com';
```

**Expected Result:**
```
email                | plan       | call_allowance | role
---------------------|------------|----------------|------
2704fmb@gmail.com   | enterprise | 350            | owner
```

### Step 3: Build & Deploy App (20-30 minutes)

**For iOS:**
```bash
# Navigate to project
cd /Users/atticus/FlynnAI

# Build for TestFlight
eas build --platform ios --profile production

# Wait for build to complete (~15-20 min)
# Upload to App Store Connect
# Add 2704fmb@gmail.com as external tester
# Send TestFlight invitation
```

**For Android:**
```bash
eas build --platform android --profile production
# Share APK link with test user
```

### Step 4: Send Credentials to Test User (2 minutes)

**Email to:** 2704fmb@gmail.com

**Subject:** Flynn AI Testing - You're Ready!

**Body:**
```
Hi!

Your Flynn AI test account is ready:

📱 Install App:
[TestFlight Link] or [APK Link]

🔐 Login:
Email: 2704fmb@gmail.com
Password: [TEMP PASSWORD]

📋 Testing Guide:
https://github.com/[your-repo]/docs/TESTING_GUIDE.md

💰 Your Account:
Plan: Business ($149/month)
AI Calls: 350/month
No payment required!

Questions? Reply to this email or call [your phone].

Thanks!
```

---

## ✅ Verification Checklist

Before sending to test user:

### Backend
- [ ] `/api/twilio/search-numbers` returns 200
- [ ] `/api/twilio/purchase-number` returns 200
- [ ] `/api/twilio/send-sms` returns 200
- [ ] `/api/ai/extract-job` returns 200
- [ ] All endpoints require valid JWT (return 401 without token)

### Database
- [ ] User exists: `2704fmb@gmail.com`
- [ ] Org plan is `enterprise`
- [ ] Call allowance is `350`
- [ ] User role is `owner`
- [ ] `onboarding_complete` is `false`

### App
- [ ] App builds without errors
- [ ] Login works
- [ ] Backend API URL is correct in `.env`
- [ ] TestFlight invitation sent

---

## 🧪 Quick Test (Do This First!)

Before giving app to test user, do this 2-minute sanity check:

1. **Install app** on your own device
2. **Login** with test credentials
3. **Start onboarding**
4. **Verify Business plan** is active (no paywall on step 3)
5. **Try to provision number** (should work without payment)
6. **Stop before completing** (let test user finish)

**If this works, you're ready to hand off to test user!**

---

## 🐛 Common Issues & Quick Fixes

### "Backend API Error" during number provisioning
```bash
# Check backend is running
curl https://flynnai-telephony.fly.dev/health

# Check endpoint directly
curl -X POST https://flynnai-telephony.fly.dev/api/twilio/search-numbers \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"countryCode":"US","limit":5,"voiceEnabled":true}'
```

**Fix:** Deploy backend endpoints or check logs

### "Unauthorized" on API calls
```bash
# Verify JWT is being sent
# Check backend JWT verification logic
# Ensure SUPABASE_JWT_SECRET matches Supabase project
```

**Fix:** Update backend authentication middleware

### User doesn't have Business plan in app
```sql
-- Verify in database
SELECT o.plan FROM organizations o
JOIN org_members om ON o.id = om.org_id
JOIN users u ON u.id = om.user_id
WHERE u.email = '2704fmb@gmail.com';

-- Should return 'enterprise'
-- If not, run:
UPDATE organizations SET plan = 'enterprise', call_allowance = 350
WHERE id = (
  SELECT om.org_id FROM org_members om
  JOIN users u ON u.id = om.user_id
  WHERE u.email = '2704fmb@gmail.com'
);
```

---

## 📞 What to Tell Test User

**Critical instructions to emphasize:**

1. ✅ **You have the Business plan** - No payment needed, full access to everything
2. ✅ **Real phone number will be provisioned** - This costs ~$1-2/month (you'll cover it)
3. ✅ **Set up call forwarding** - Follow the in-app instructions exactly
4. ✅ **Test with real voicemail** - Have someone call and leave a message
5. ✅ **Report everything** - Bugs, confusing UX, missing features, crashes

**What NOT to worry about:**
- ❌ Don't try to pay/upgrade (already on highest plan)
- ❌ Don't worry about call limits (350 calls is plenty for testing)
- ❌ Don't skip steps (test the full onboarding flow)

---

## 📊 What Success Looks Like

After 1 week of testing, you should have:

✅ Test user completed onboarding
✅ Flynn number provisioned and forwarding works
✅ At least 3 test voicemails processed successfully
✅ Jobs created from voicemails with >80% accuracy
✅ Invoices created and Stripe links generated
✅ Detailed bug report from test user
✅ UX feedback and improvement suggestions

---

## 🚀 After Testing

1. **Review feedback** with test user (video call recommended)
2. **Fix critical bugs** (crashes, data loss, blocking issues)
3. **Prioritize UX improvements**
4. **Re-test fixes** with test user
5. **Prepare for launch!**

---

## 📚 Full Documentation

For detailed information, see:

- **Backend API Specs:** `/docs/BACKEND_API_REQUIREMENTS.md`
- **Test User Setup:** `/docs/SETUP_TEST_USER.sql`
- **Testing Guide:** `/docs/TESTING_GUIDE.md` (for test user)
- **Complete Summary:** `/docs/PRODUCTION_TESTING_SUMMARY.md`

---

## ⏱️ Time Investment

**Your time:**
- Backend deployment: 1-2 hours
- Test user setup: 10 minutes
- App build & deploy: 30 minutes
- Communication: 15 minutes
- **Total: ~2-3 hours**

**Test user time:**
- Installation & setup: 10 minutes
- Onboarding: 15-20 minutes
- Feature testing: 2-3 hours over 1 week
- Feedback compilation: 30 minutes
- **Total: ~3-4 hours over 1 week**

---

**You got this! 🎉**

Any questions? Review the full docs or test it yourself first.

---

**Next Action:** Deploy backend API → Create test user → Build app → Send invite
