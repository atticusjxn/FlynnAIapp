# Production Pricing Implementation Guide

## Overview
This guide documents the complete implementation plan for production-ready pricing in Flynn AI, including free tier limitations, paid plan gating, and app store deployment.

## Pricing Structure (AUD)

### Cost Analysis (per call)
- **Gemini 2.5 Flash LLM**: $0.001 USD (~$0.0015 AUD)
- **Deepgram STT**: $0.011 USD (~$0.017 AUD)
- **ElevenLabs TTS**: $0.20 USD (~$0.30 AUD)
- **Twilio Voice + SMS**: $0.029 USD (~$0.045 AUD)
- **Total Cost**: ~$0.40 AUD per call (including overhead)

### Pricing Tiers (4-5x markup = healthy SaaS margin)

#### **Free Tier** (Trial)
- ✅ In-app test calls only (using device mic/speaker)
- ❌ No AI receptionist setup
- ❌ No phone number provisioning
- ❌ No real call handling
- **Purpose**: Let users test the AI quality before committing

#### **Starter - $29/month**
- 50 AI receptionist calls included
- Dedicated phone number provisioning
- Voice customization
- Job card creation
- $0.80 per additional call
- **Target**: Small salons, solo tradespeople (20-30 calls/month expected)

#### **Professional - $79/month**
- 150 AI receptionist calls included
- All Starter features
- Priority support
- Advanced analytics
- $0.70 per additional call
- **Target**: Busy plumbers, multi-stylist salons (40-60 calls/month expected)

#### **Business - $149/month**
- 350 AI receptionist calls included
- All Professional features
- Dedicated support
- Custom integrations
- $0.60 per additional call
- **Target**: Event hire companies, larger businesses (100+ calls/month expected)

## Database Schema Changes Required

### 1. Add Billing Columns to Organizations Table

```sql
-- Migration: Add billing and subscription tracking to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS billing_plan_id TEXT DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS billing_cycle_start TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS billing_cycle_end TIMESTAMP WITH TIME ZONE;

-- Add check constraint for valid billing plans
ALTER TABLE public.organizations
  ADD CONSTRAINT valid_billing_plan
  CHECK (billing_plan_id IN ('trial', 'starter', 'growth', 'enterprise'));

-- Add check constraint for valid subscription statuses
ALTER TABLE public.organizations
  ADD CONSTRAINT valid_subscription_status
  CHECK (subscription_status IN ('inactive', 'active', 'past_due', 'canceled', 'incomplete', 'trialing'));

-- Add index for subscription lookups
CREATE INDEX IF NOT EXISTS idx_organizations_billing
  ON public.organizations(billing_plan_id, subscription_status);
```

### 2. Create Call Usage Tracking

```sql
-- Migration: Track AI receptionist call usage for billing
CREATE TABLE IF NOT EXISTS public.ai_call_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_sid TEXT NOT NULL,
  call_duration_seconds INT,
  call_cost_cents INT, -- in cents (AUD)
  billing_period_month DATE NOT NULL, -- First day of the billing month
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(call_sid)
);

-- Index for billing period queries
CREATE INDEX IF NOT EXISTS idx_call_usage_billing_period
  ON public.ai_call_usage(organization_id, billing_period_month);

-- RLS policies
ALTER TABLE public.ai_call_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's call usage"
  ON public.ai_call_usage FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );
```

## Backend Implementation

### 1. Billing Service (`src/services/BillingService.ts`)
✅ **Created** - See `/Users/atticus/FlynnAI/src/services/BillingService.ts`

Key functions:
- `getSubscriptionStatus(userId)` - Get user's plan, calls used, remaining
- `canSetupReceptionist(userId)` - Check if user can configure AI receptionist (requires paid plan)
- `canMakeTestCall(userId)` - Check test call permissions (free = in-app only, paid = real number)

### 2. Server-Side Gating (`server.js`)

Add subscription checks to critical endpoints:

```javascript
// In /telephony/voice webhook
app.post('/telephony/voice', async (req, res) => {
  const toNumber = req.body.To;
  const fromNumber = req.body.From;

  // Look up receptionist profile
  const profile = await lookupReceptionistProfile(toNumber);

  if (!profile) {
    return res.send(voicemailTwiML());
  }

  // **NEW: Check subscription status**
  const { data: org } = await supabase
    .from('organizations')
    .select('billing_plan_id, subscription_status')
    .eq('id', profile.organization_id)
    .single();

  const isPaid = org?.billing_plan_id !== 'trial';
  const isActive = org?.subscription_status === 'active' || org?.subscription_status === 'trialing';

  if (!isPaid || !isActive) {
    console.log('[Telephony] User subscription inactive, falling back to voicemail');
    return res.send(voicemailTwiML());
  }

  // Proceed with AI receptionist
  return res.send(realtimeStreamTwiML(callSid, userId));
});
```

### 3. Call Usage Tracking

After each AI receptionist call completes, log usage:

```javascript
// In handleRealtimeConversationComplete()
async function logCallUsage(callSid, userId, orgId, durationSeconds) {
  const callCostCents = Math.ceil(40); // $0.40 AUD = 40 cents
  const billingMonth = new Date();
  billingMonth.setDate(1); // First day of month
  billingMonth.setHours(0, 0, 0, 0);

  await supabase.from('ai_call_usage').insert({
    organization_id: orgId,
    user_id: userId,
    call_sid: callSid,
    call_duration_seconds: durationSeconds,
    call_cost_cents: callCostCents,
    billing_period_month: billingMonth.toISOString(),
  });
}
```

## Mobile App Implementation

### 1. Paywall Component (`src/components/billing/PaywallModal.tsx`)

```tsx
import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { FlynnButton } from '../ui/FlynnButton';
import { billingPlans } from '../../data/billingPlans';
import { useNavigation } from '@react-navigation/native';

export const PaywallModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}> = ({ visible, onClose, title, message }) => {
  const navigation = useNavigation();

  const handleUpgrade = () => {
    onClose();
    // @ts-ignore
    navigation.navigate('Settings', { screen: 'Billing' });
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>
            {title || 'Upgrade Required'}
          </Text>
          <Text style={styles.message}>
            {message || 'This feature requires a paid plan. Upgrade to unlock full AI receptionist capabilities.'}
          </Text>

          <View style={styles.plansList}>
            {billingPlans.map(plan => (
              <View key={plan.id} style={styles.planCard}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planPrice}>{plan.priceText}</Text>
                <Text style={styles.planCalls}>{plan.callAllowanceLabel}</Text>
              </View>
            ))}
          </View>

          <FlynnButton
            title="Upgrade Now"
            onPress={handleUpgrade}
            variant="primary"
            fullWidth
          />
          <FlynnButton
            title="Maybe Later"
            onPress={onClose}
            variant="secondary"
            fullWidth
          />
        </View>
      </View>
    </Modal>
  );
};
```

### 2. Update TestCallModal (`src/components/receptionist/TestCallModal.tsx`)

```tsx
// Add to imports
import { BillingService } from '../../services/BillingService';
import { Linking } from 'react-native';

// Add state
const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null);
const [loadingBilling, setLoadingBilling] = useState(true);

// Load subscription status on mount
useEffect(() => {
  if (visible && user) {
    loadSubscriptionStatus();
  }
}, [visible, user]);

const loadSubscriptionStatus = async () => {
  if (!user) return;

  setLoadingBilling(true);
  try {
    const status = await BillingService.getSubscriptionStatus(user.id);
    setSubscriptionStatus(status);
  } catch (error) {
    console.error('[TestCall] Failed to load billing status:', error);
  } finally {
    setLoadingBilling(false);
  }
};

// Update startTestCall logic
const startTestCall = async () => {
  if (!user) {
    Alert.alert('Error', 'You must be logged in to start a test call');
    return;
  }

  const testPermission = await BillingService.canMakeTestCall(user.id);

  if (!testPermission.allowed) {
    Alert.alert(
      'Subscription Required',
      'Your subscription is not active. Please update your billing to use the AI receptionist.',
      [
        { text: 'Update Billing', onPress: () => {/* Navigate to billing */} },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
    return;
  }

  if (testPermission.isInAppOnly) {
    // Free tier: in-app test call only
    Alert.alert(
      'Test Call',
      'As a free user, you can test the AI receptionist using your device microphone. To forward real calls, upgrade to a paid plan.',
      [
        { text: 'Continue Test', onPress: () => startInAppTestCall() },
        { text: 'Upgrade', onPress: () => {/* Navigate to billing */} },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
    return;
  }

  // Paid tier: offer choice between in-app test or calling real number
  Alert.alert(
    'Test Your AI Receptionist',
    'How would you like to test?',
    [
      { text: 'In-App Test', onPress: () => startInAppTestCall() },
      { text: 'Call My Number', onPress: () => callRealNumber() },
      { text: 'Cancel', style: 'cancel' },
    ]
  );
};

const startInAppTestCall = async () => {
  // Existing in-app test call logic
  // ... your WebSocket-based test call code
};

const callRealNumber = async () => {
  // Get user's provisioned Twilio number
  const { data: profile } = await supabase
    .from('receptionist_profiles')
    .select('twilio_phone_number')
    .eq('user_id', user.id)
    .single();

  if (!profile?.twilio_phone_number) {
    Alert.alert('No Number', 'You haven\'t provisioned a Flynn number yet. Please complete setup first.');
    return;
  }

  Alert.alert(
    'Call Your AI Receptionist',
    `Call ${profile.twilio_phone_number} from your phone to test your live AI receptionist.`,
    [
      { text: 'Call Now', onPress: () => Linking.openURL(`tel:${profile.twilio_phone_number}`) },
      { text: 'Close', style: 'cancel' },
    ]
  );
};
```

### 3. Gate Receptionist Setup (`src/screens/onboarding/ReceptionistSetupScreen.tsx`)

```tsx
import { BillingService } from '../../services/BillingService';
import { PaywallModal } from '../../components/billing/PaywallModal';

// Add state
const [showPaywall, setShowPaywall] = useState(false);
const [canSetup, setCanSetup] = useState(false);

// Check on mount
useEffect(() => {
  checkSetupPermission();
}, []);

const checkSetupPermission = async () => {
  if (!user) return;

  const allowed = await BillingService.canSetupReceptionist(user.id);
  setCanSetup(allowed);

  if (!allowed) {
    setShowPaywall(true);
  }
};

// Render paywall if not allowed
if (showPaywall) {
  return (
    <PaywallModal
      visible={showPaywall}
      onClose={() => {
        setShowPaywall(false);
        onBack(); // Go back to previous screen
      }}
      title="Upgrade to Setup AI Receptionist"
      message="Setting up your AI receptionist requires a paid plan. Choose a plan to get started."
    />
  );
}
```

## Stripe Integration Updates

### 1. Create New Stripe Products

Create three new Stripe products/prices for the updated tiers:

```bash
# Starter - $29/month (50 calls)
stripe products create \
  --name="Flynn AI Starter" \
  --description="50 AI receptionist calls/month"

stripe prices create \
  --product=prod_XXX \
  --unit-amount=2900 \
  --currency=aud \
  --recurring interval=month

# Professional - $79/month (150 calls)
stripe products create \
  --name="Flynn AI Professional" \
  --description="150 AI receptionist calls/month"

stripe prices create \
  --product=prod_YYY \
  --unit-amount=7900 \
  --currency=aud \
  --recurring interval=month

# Business - $149/month (350 calls)
stripe products create \
  --name="Flynn AI Business" \
  --description="350 AI receptionist calls/month"

stripe prices create \
  --product=prod_ZZZ \
  --unit-amount=14900 \
  --currency=aud \
  --recurring interval=month
```

### 2. Update Environment Variables

```bash
# .env
STRIPE_STARTER_PRICE_ID=price_starter_xxx
STRIPE_PROFESSIONAL_PRICE_ID=price_professional_yyy
STRIPE_BUSINESS_PRICE_ID=price_business_zzz

# Expo public vars
EXPO_PUBLIC_STRIPE_STARTER_LINK=https://buy.stripe.com/xxx
EXPO_PUBLIC_STRIPE_PROFESSIONAL_LINK=https://buy.stripe.com/yyy
EXPO_PUBLIC_STRIPE_BUSINESS_LINK=https://buy.stripe.com/zzz
```

### 3. Stripe Webhook Handler (`server.js`)

```javascript
app.post('/webhooks/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdate(event.data.object);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionCanceled(event.data.object);
      break;

    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;
  }

  res.json({ received: true });
});

async function handleSubscriptionUpdate(subscription) {
  const customerId = subscription.customer;
  const status = subscription.status; // active, past_due, canceled, etc.
  const priceId = subscription.items.data[0].price.id;

  // Map Stripe price ID to billing plan
  const planMap = {
    [process.env.STRIPE_STARTER_PRICE_ID]: 'starter',
    [process.env.STRIPE_PROFESSIONAL_PRICE_ID]: 'growth',
    [process.env.STRIPE_BUSINESS_PRICE_ID]: 'enterprise',
  };

  const billingPlanId = planMap[priceId] || 'trial';

  // Update organization
  await supabase
    .from('organizations')
    .update({
      billing_plan_id: billingPlanId,
      stripe_subscription_id: subscription.id,
      subscription_status: status,
      billing_cycle_start: new Date(subscription.current_period_start * 1000).toISOString(),
      billing_cycle_end: new Date(subscription.current_period_end * 1000).toISOString(),
    })
    .eq('stripe_customer_id', customerId);
}

async function handleSubscriptionCanceled(subscription) {
  await supabase
    .from('organizations')
    .update({
      billing_plan_id: 'trial',
      subscription_status: 'canceled',
    })
    .eq('stripe_subscription_id', subscription.id);
}

async function handlePaymentFailed(invoice) {
  // Send notification to user about failed payment
  // Mark subscription as past_due
}
```

## Testing Checklist

### Before Production Deployment

- [ ] **Database migrations applied** to production Supabase
- [ ] **Stripe products created** with correct pricing (AUD)
- [ ] **Stripe webhook** configured and tested
- [ ] **Environment variables** updated with new price IDs
- [ ] **Free tier users** can only do in-app test calls
- [ ] **Paid tier users** can call their provisioned numbers
- [ ] **Receptionist setup** requires paid plan
- [ ] **Call usage tracking** logs correctly to database
- [ ] **Billing cycle resets** on month boundaries
- [ ] **Overage charges** calculated correctly
- [ ] **Subscription cancellation** downgrades to free tier
- [ ] **Payment failures** handled gracefully

## App Store Deployment

### iOS (App Store Connect)

```bash
# 1. Update app.json version
# Increment build number and version

# 2. Build iOS production binary
eas build --platform ios --profile production

# 3. Submit to App Store
eas submit --platform ios --latest
```

### Android (Google Play)

```bash
# 1. Update app.json version
# Increment versionCode and version

# 2. Build Android production binary
eas build --platform android --profile production

# 3. Submit to Google Play
eas submit --platform android --latest
```

### Pre-Submission Checklist

- [ ] **App Store screenshots** updated with new pricing
- [ ] **Privacy policy** updated with billing/subscription clauses
- [ ] **Terms of service** include refund policy
- [ ] **In-app purchase** configuration (if using IAP instead of Stripe)
- [ ] **App review notes** mention test account credentials
- [ ] **Subscription management** link added to settings

## Post-Launch Monitoring

### Key Metrics to Track

1. **Conversion Rate**: Free → Paid upgrades
2. **Churn Rate**: Monthly subscription cancellations
3. **Average Calls/User**: Actual usage vs. plan limits
4. **Overage Revenue**: Additional call charges
5. **Support Tickets**: Billing-related issues

### Cost Monitoring

- **Actual cost per call** vs. projected $0.40 AUD
- **Margin per tier** (should maintain 4-5x markup)
- **API costs** (Gemini, Deepgram, ElevenLabs, Twilio)

## Rollback Plan

If issues arise post-launch:

1. **Disable paywall**: Set all users to 'enterprise' plan temporarily
2. **Pause Stripe webhooks**: Prevent automated billing changes
3. **Communicate**: Email users about temporary billing freeze
4. **Fix and redeploy**: Address issues and re-enable

---

**Status**: This document outlines the full implementation. Files created so far:
- ✅ `/Users/atticus/FlynnAI/src/services/BillingService.ts`
- ✅ `/Users/atticus/FlynnAI/src/data/billingPlans.ts` (updated)

**Next Steps**: Review this plan, then implement remaining components systematically with thorough testing before production deployment.
