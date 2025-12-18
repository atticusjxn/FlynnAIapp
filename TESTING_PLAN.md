# Flynn AI Complete Testing Plan

## Overview

This document outlines a comprehensive end-to-end testing strategy for Flynn AI, from account creation through receptionist testing with your existing test phone number. This plan covers both the **ideal production flow** and a **streamlined test mode** for development.

---

## Current State Analysis

### What Exists Now

#### Onboarding Flow
1. **Account Creation** → Sign up with Google OAuth (Supabase Auth)
2. **Business Profile** → Select business type, add goals
3. **Phone Setup** → Enter phone number for call forwarding
4. **Receptionist Config** → Voice selection, greeting, questions, mode
5. **Billing Paywall** → Must subscribe to provision phone number
6. **Twilio Provisioning** → Backend provisions Twilio number, creates forwarding

#### Billing System
- **Stripe Checkout Links** → Opens external payment page
- **Webhook Handler** → `POST /stripe/webhook` for `checkout.session.completed`
- **Plan Assignment** → Updates `organizations.plan` field in Supabase
- **Plans**: Trial (free), Starter ($29), Professional ($79), Business ($149)

#### Phone Provisioning
- **TwilioService.ts** → Handles backend API calls
- **No direct Twilio API** → Provisioning happens server-side only
- **Database Tables**:
  - `phone_numbers` → Stores provisioned numbers
  - `organizations` → Links to phone numbers via `org_id`

#### Receptionist Testing
- **LocalTestModal** → In-app mic/speaker testing (NEW)
- **TestCallModal** → Real WebSocket call testing (OLD)
- **Test Call Endpoint** → `/realtime/twilio?isTestCall=true`

### Gaps Identified

1. **No test mode bypass for billing** → Always requires Stripe payment
2. **No auto-provision for test accounts** → Manual provisioning needed
3. **No "unprovision" concept** → Numbers stay provisioned indefinitely
4. **No Stripe test card simulation** → Real payment required
5. **Your test number** → Not auto-assigned to new test accounts

---

## 🎯 Testing Strategy: Two-Track Approach

### Track 1: Production-Like Testing (Stripe Test Mode)

Full end-to-end flow using Stripe's test mode with fake cards.

### Track 2: Development Testing (Bypass Mode)

Streamlined flow that skips billing and auto-assigns your test number.

---

## Track 1: Production-Like Testing Plan

### Prerequisites

```bash
# Stripe Test Mode Environment Variables
STRIPE_SECRET_KEY=sk_test_...        # Stripe test secret key
STRIPE_WEBHOOK_SECRET=whsec_test_... # Test webhook secret
STRIPE_STARTER_LINK=https://buy.stripe.com/test/...
STRIPE_PROFESSIONAL_LINK=https://buy.stripe.com/test/...
STRIPE_BUSINESS_LINK=https://buy.stripe.com/test/...

# Test Twilio Number (Your Existing)
TEST_TWILIO_NUMBER=+61491234567      # Your test number
TEST_TWILIO_NUMBER_SID=PNxxx...      # Twilio Phone Number SID
```

### Step-by-Step Test Flow

#### 1. Account Creation
```
Action: Open Flynn AI app → Sign in with Google
Result: New user created in Supabase auth.users
Database:
  - auth.users (new row)
  - public.users (auto-created via trigger)
  - public.organizations (auto-created with owner)
```

#### 2. Business Profile Onboarding
```
Screen: BusinessGoalsScreen
Actions:
  - Select business type: "Plumber"
  - Add website: https://yoursite.com (optional)
  - Tap "Continue"

Database Updates:
  - organizations.metadata { businessType: "plumber" }
  - business_profiles.metadata { businessType: "plumber" }
```

#### 3. Phone Number Entry
```
Screen: TwilioProvisioningScreen
Actions:
  - Enter your mobile: +61 491 234 567
  - Carrier auto-detected (e.g., Telstra)
  - Tap "Continue"

Database Updates:
  - users.phone_number = "+61491234567"
```

#### 4. Receptionist Configuration
```
Screen: ReceptionistSetupScreen
Actions:
  - Select voice: "Avery — Warm & Friendly"
  - Keep default greeting
  - Keep default questions
  - Mode: "AI handles missed calls"
  - Tap "Finish onboarding"

Database Updates:
  - receptionist_configs (new row with greeting, questions)
  - users.receptionist_configured = true
```

#### 5. Billing Paywall
```
Screen: BillingPaywallModal (auto-shown)
Actions:
  - Tap "Starter - $29/mo" card
  - Opens Stripe Checkout in browser

Stripe Test Cards:
  ✅ Success: 4242 4242 4242 4242
  ❌ Decline: 4000 0000 0000 0002
  🧪 3D Secure: 4000 0025 0000 3155

  Use any future expiry (e.g., 12/25)
  Use any 3-digit CVC (e.g., 123)
  Use any ZIP (e.g., 12345)
```

#### 6. Stripe Webhook Processing
```
Webhook: checkout.session.completed
Server: POST /stripe/webhook

Logic:
  1. Verify webhook signature
  2. Extract plan from line_items
  3. Get client_reference_id (orgId)
  4. Update organizations.plan = "starter"
  5. Set organizations.status = "active"

Database Updates:
  - organizations.plan = "starter"
  - organizations.status = "active"
  - organizations.onboarded_at = now()
```

#### 7. Phone Number Provisioning
```
Automatic after successful payment

Server Logic:
  1. Check user has paid plan
  2. Search Twilio for available number in user's country
  3. Purchase number via Twilio API
  4. Create phone_numbers row:
     - e164_number = "+61XXXXXXXXX"
     - connected_number = user.phone_number
     - org_id = user.org_id
     - is_primary = true
     - status = "active"
  5. Configure Twilio webhook URLs

Twilio Configuration:
  - Voice URL: https://your-server.fly.dev/voice
  - Status Callback: https://your-server.fly.dev/voice/status
  - Voice Method: POST
```

#### 8. Testing Receptionist (In-App)
```
Screen: ReceptionistScreen → "START TEST CALL"
Modal: LocalTestModal

Actions:
  1. Grant microphone permission
  2. Hear greeting via device speaker
  3. Speak: "Hi, I need a plumber for a leak"
  4. Tap mic button to send
  5. Hear Flynn response
  6. Continue conversation (3-5 exchanges)
  7. View extracted job details

Uses:
  - POST /ai/transcribe (Whisper)
  - POST /ai/chat (GPT-4o-mini)
  - POST /ai/extract-job (job extraction)
  - Expo Speech (device TTS)
```

#### 9. Testing Real Calls (With Your Test Number)
```
Setup:
  1. Configure call forwarding on your mobile
     - iPhone: Settings → Phone → Call Forwarding
     - Forward to: Flynn provisioned number
     - Or use conditional forwarding codes

  2. Call your mobile from another phone
  3. Don't answer → Goes to Flynn

Expected Flow:
  - Twilio receives call
  - POST /voice webhook triggered
  - Greeting plays via TTS
  - WebSocket opens: /realtime/twilio
  - Conversation handled by AI
  - Transcript saved to database
  - Job card auto-created
  - Push notification sent to app

Database:
  - calls (new row with recording URL)
  - transcriptions (transcript text)
  - jobs (extracted booking details)
```

#### 10. Verify in App
```
Tab: Dashboard
  - See new call notification
  - View call transcript

Tab: Calendar
  - See auto-created job/event
  - Review extracted details

Tab: Clients
  - See new client created
  - Contact info populated
```

---

## Track 2: Development Testing Plan (RECOMMENDED)

### Goal
Skip billing, auto-assign your test number, enable instant testing.

### Implementation Requirements

#### A. Add Test Mode Flag

**Environment Variable:**
```bash
TESTING_MODE=true
TEST_USER_EMAIL=your-test-email@gmail.com
TEST_TWILIO_NUMBER=+61491234567
TEST_TWILIO_NUMBER_SID=PNxxx...
```

**Code Changes Needed:**

##### 1. Bypass Billing Paywall
```typescript
// src/components/billing/BillingPaywallModal.tsx
// OR src/screens/onboarding/TwilioProvisioningScreen.tsx

const isTestMode = process.env.EXPO_PUBLIC_TESTING_MODE === 'true';
const testUserEmail = process.env.EXPO_PUBLIC_TEST_USER_EMAIL;

// In TwilioProvisioningScreen:
const shouldShowPaywall = !hasPaidPlan && !isTestUser;

const isTestUser = useMemo(() => {
  return isTestMode && user?.email === testUserEmail;
}, [user, isTestMode, testUserEmail]);
```

##### 2. Auto-Assign Test Number
```javascript
// server.js - Add new endpoint
app.post('/api/testing/provision-test-number', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;

  // Only allow in test mode
  if (process.env.TESTING_MODE !== 'true') {
    return res.status(403).json({ error: 'Test mode not enabled' });
  }

  // Only allow for test user
  const testUserEmail = process.env.TEST_USER_EMAIL;
  const { data: userProfile } = await supabase
    .from('users')
    .select('email, default_org_id')
    .eq('id', userId)
    .single();

  if (userProfile.email !== testUserEmail) {
    return res.status(403).json({ error: 'Not authorized for test provisioning' });
  }

  const orgId = userProfile.default_org_id;

  // Assign test number
  const { data: existingNumber } = await supabase
    .from('phone_numbers')
    .select('*')
    .eq('org_id', orgId)
    .single();

  if (existingNumber) {
    return res.json({
      success: true,
      number: existingNumber.e164_number,
      alreadyProvisioned: true
    });
  }

  // Create phone_numbers entry with test number
  const { data: phoneNumber, error } = await supabase
    .from('phone_numbers')
    .insert({
      org_id: orgId,
      e164_number: process.env.TEST_TWILIO_NUMBER,
      twilio_number_sid: process.env.TEST_TWILIO_NUMBER_SID,
      connected_number: userProfile.phone_number,
      status: 'active',
      verification_state: 'verified',
      forwarding_type: 'call_forwarding',
      is_primary: true,
      capabilities: {},
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({
    success: true,
    number: phoneNumber.e164_number
  });
});
```

##### 3. Grant Test User Paid Plan
```javascript
// server.js - Add to user creation or onboarding completion
const grantTestPlan = async (userId, email) => {
  const isTestMode = process.env.TESTING_MODE === 'true';
  const testUserEmail = process.env.TEST_USER_EMAIL;

  if (!isTestMode || email !== testUserEmail) {
    return false;
  }

  // Get user's org
  const { data: userProfile } = await supabase
    .from('users')
    .select('default_org_id')
    .eq('id', userId)
    .single();

  if (!userProfile?.default_org_id) {
    return false;
  }

  // Grant starter plan
  await supabase
    .from('organizations')
    .update({
      plan: 'starter',
      status: 'active',
      onboarded_at: new Date().toISOString(),
    })
    .eq('id', userProfile.default_org_id);

  console.log('[Testing] Granted starter plan to test user:', email);
  return true;
};

// Call this after user profile creation
// Or in handleCheckoutSessionCompleted with a bypass
```

##### 4. Frontend Auto-Provision
```typescript
// src/services/TwilioService.ts
export const provisionTestNumber = async (): Promise<boolean> => {
  try {
    const response = await apiClient.post('/api/testing/provision-test-number');
    return response.data.success;
  } catch (error) {
    console.error('[TwilioService] Test provisioning failed:', error);
    return false;
  }
};

// src/screens/onboarding/TwilioProvisioningScreen.tsx
const handleTestProvision = async () => {
  setIsProvisioning(true);

  const success = await TwilioService.provisionTestNumber();

  if (success) {
    await refreshOnboarding();
    onNext();
  } else {
    setError('Failed to provision test number');
  }

  setIsProvisioning(false);
};

// In render:
{isTestUser && (
  <FlynnButton
    title="Use Test Number (Dev Mode)"
    onPress={handleTestProvision}
    variant="secondary"
  />
)}
```

#### B. Unprovisioning Capability

**Purpose:** Reset test account to unpaid state for re-testing.

```javascript
// server.js
app.post('/api/testing/unprovision', authenticateJwt, async (req, res) => {
  if (process.env.TESTING_MODE !== 'true') {
    return res.status(403).json({ error: 'Test mode not enabled' });
  }

  const userId = req.user?.id;

  const { data: userProfile } = await supabase
    .from('users')
    .select('email, default_org_id')
    .eq('id', userId)
    .single();

  if (userProfile.email !== process.env.TEST_USER_EMAIL) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const orgId = userProfile.default_org_id;

  // Remove phone number
  await supabase
    .from('phone_numbers')
    .delete()
    .eq('org_id', orgId);

  // Downgrade plan
  await supabase
    .from('organizations')
    .update({
      plan: 'trial',
      status: 'onboarding'
    })
    .eq('id', orgId);

  // Reset user flags
  await supabase
    .from('users')
    .update({
      phone_setup_complete: false,
      twilio_phone_number: null,
    })
    .eq('id', userId);

  return res.json({ success: true });
});
```

#### C. Environment Setup

**`.env` additions:**
```bash
# Testing Mode
TESTING_MODE=true
TEST_USER_EMAIL=atticus@flynn.ai
TEST_TWILIO_NUMBER=+61491234567
TEST_TWILIO_NUMBER_SID=PNxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Stripe Test Mode
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_test_xxxxx
```

**`.env.example` additions:**
```bash
# Testing Mode (Development Only)
TESTING_MODE=false
TEST_USER_EMAIL=your-test-email@gmail.com
TEST_TWILIO_NUMBER=+1234567890
TEST_TWILIO_NUMBER_SID=PNxxx

# Stripe Test Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
```

---

## 🧪 Complete Test Workflow (Track 2 - Development Mode)

### Prerequisites
1. Set `TESTING_MODE=true` in `.env`
2. Set `TEST_USER_EMAIL=your-email@gmail.com`
3. Set `TEST_TWILIO_NUMBER` and `TEST_TWILIO_NUMBER_SID`
4. Restart server

### Step-by-Step

#### 1. Create Test Account
```
1. Open Flynn AI app
2. Sign in with Google (use TEST_USER_EMAIL)
3. Complete business profile onboarding
4. Complete receptionist setup
```

#### 2. Auto-Provision (Bypasses Billing)
```
Screen: TwilioProvisioningScreen

IF isTestUser:
  - See "Use Test Number (Dev Mode)" button
  - Tap button
  - Backend auto-assigns TEST_TWILIO_NUMBER
  - Skip billing paywall entirely
  - Continue to dashboard

ELSE:
  - Show normal billing paywall
```

#### 3. Test In-App Receptionist
```
Tab: Receptionist
Action: Tap "START TEST CALL"
Flow: (Same as Track 1, Step 8)
```

#### 4. Test Real Calls
```
Setup call forwarding to TEST_TWILIO_NUMBER
Call your mobile
Don't answer
Flynn receptionist picks up
```

#### 5. Reset for Re-Testing (Optional)
```
Add reset button in Settings (dev mode only)

Settings → Developer → "Reset Test Account"
  - Calls /api/testing/unprovision
  - Removes phone number
  - Downgrades to trial
  - Clears onboarding flags
  - Can re-test entire flow
```

---

## 🎯 Recommended Test Cases

### Onboarding Tests
- [ ] New account creation
- [ ] Business profile with website scraping
- [ ] Receptionist voice/greeting/questions customization
- [ ] Billing paywall displays correctly
- [ ] Stripe test card payment succeeds
- [ ] Webhook updates organization plan
- [ ] Phone number auto-provisions after payment

### Receptionist Tests
- [ ] In-app test call (LocalTestModal)
  - [ ] Microphone permission granted
  - [ ] Greeting plays correctly
  - [ ] Speech transcription works
  - [ ] AI responds naturally
  - [ ] Job extraction shows details
- [ ] Real call forwarding
  - [ ] Call routes to Flynn number
  - [ ] Greeting plays
  - [ ] Conversation recorded
  - [ ] Transcript saved
  - [ ] Job card created
  - [ ] Push notification sent

### Accent Tests (Location-Based)
- [ ] Australian business → Australian accent
- [ ] UK business → British accent
- [ ] US business → American accent
- [ ] Default (no location) → No accent specified

### Error Handling
- [ ] Declined payment → User stays on paywall
- [ ] Twilio provisioning failure → Error message shown
- [ ] Microphone permission denied → Clear error message
- [ ] Network error during test call → Graceful fallback

---

## 📋 Database Test Account Setup

### Option A: SQL Script (One-Time Setup)

```sql
-- Run this in Supabase SQL Editor for quick test account setup

-- 1. Find your test user
SELECT id, email, default_org_id
FROM auth.users
WHERE email = 'your-test-email@gmail.com';

-- 2. Grant paid plan to test org
UPDATE organizations
SET
  plan = 'starter',
  status = 'active',
  onboarded_at = now()
WHERE id = (
  SELECT default_org_id
  FROM users
  WHERE email = 'your-test-email@gmail.com'
);

-- 3. Assign test phone number
INSERT INTO phone_numbers (
  org_id,
  e164_number,
  twilio_number_sid,
  connected_number,
  status,
  verification_state,
  forwarding_type,
  is_primary,
  capabilities
)
VALUES (
  (SELECT default_org_id FROM users WHERE email = 'your-test-email@gmail.com'),
  '+61491234567',  -- Your test number
  'PNxxx...',       -- Your Twilio SID
  '+61491234567',   -- Connected number
  'active',
  'verified',
  'call_forwarding',
  true,
  '{}'::jsonb
)
ON CONFLICT (org_id)
DO UPDATE SET
  e164_number = EXCLUDED.e164_number,
  status = 'active',
  verification_state = 'verified';

-- 4. Verify setup
SELECT
  u.email,
  o.plan,
  o.status,
  pn.e164_number,
  pn.status as phone_status
FROM users u
JOIN organizations o ON u.default_org_id = o.id
LEFT JOIN phone_numbers pn ON o.id = pn.org_id
WHERE u.email = 'your-test-email@gmail.com';
```

### Option B: Backend Endpoint (Reusable)

Already covered in "Track 2" implementation above.

---

## 🔧 Debugging Tools

### Check User Plan Status
```bash
# In Supabase SQL Editor
SELECT
  u.email,
  u.phone_setup_complete,
  u.receptionist_configured,
  o.plan,
  o.status,
  o.onboarded_at,
  pn.e164_number,
  pn.status as phone_status,
  pn.verification_state
FROM users u
JOIN organizations o ON u.default_org_id = o.id
LEFT JOIN phone_numbers pn ON o.id = pn.org_id
WHERE u.email = 'your-test-email@gmail.com';
```

### Check Recent Calls
```bash
SELECT
  call_sid,
  from_number,
  to_number,
  status,
  created_at,
  recording_url
FROM calls
WHERE org_id = (
  SELECT default_org_id
  FROM users
  WHERE email = 'your-test-email@gmail.com'
)
ORDER BY created_at DESC
LIMIT 10;
```

### Check Stripe Webhooks
```bash
# Server logs
docker logs -f your-container-name | grep -i stripe
# Or
pm2 logs | grep -i stripe
```

---

## 🚀 Summary: Best Testing Approach

### For Quick Iteration (Recommended)
✅ **Use Track 2: Development Mode**
- Add test mode flags
- Auto-assign your test number
- Skip billing entirely
- Rapid testing cycles

### For Production Validation
✅ **Use Track 1: Stripe Test Mode**
- Full billing flow with test cards
- Real provisioning simulation
- Validates webhook handling
- Tests complete user journey

### Hybrid Approach
✅ **Best of Both Worlds**
- Use Track 2 for receptionist logic testing
- Use Track 1 periodically for billing QA
- Maintain both code paths
- Toggle via environment variable

---

## 📝 Next Steps

1. **Decide on approach** (Track 1, Track 2, or Hybrid)
2. **Implement chosen track** (code changes documented above)
3. **Set up environment variables**
4. **Create test account**
5. **Run through complete flow**
6. **Document any issues encountered**
7. **Iterate and refine**

Let me know which track you'd like to implement first, and I can help with the specific code changes!
