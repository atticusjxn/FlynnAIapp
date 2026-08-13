/**
 * Voice front-door funnel: claim API.
 *
 * After the intake call, the prospect gets an SMS with a magic link + claim
 * code. They install the app, land signed-in (or OTP in), and the first-run
 * flow calls these endpoints to pull the config captured on the call and apply
 * it to their newly-created org. Recovery path: if they signed up on a
 * different number than they called from, the claim code resolves the session.
 */

const express = require('express');
const twilio = require('twilio');
const { createClient } = require('@supabase/supabase-js');
const authenticateJwt = require('../middleware/authenticateJwt');
const { calloutFeeToCents } = require('../telephony/funnelIntake');
const { hasVerifiedSubscription, syncOrgEntitlement } = require('../telephony/subscriptionService');
const analytics = require('../services/analytics');
const { ensureBookingPage } = require('../services/bookingPage');
const demoCallStore = require('../services/demoCallStore');
const forwardingVerifyStore = require('../services/forwardingVerifyStore');
const { randomUUID } = require('crypto');

const router = express.Router();

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = twilioAccountSid && twilioAuthToken ? twilio(twilioAccountSid, twilioAuthToken) : null;

// Gate 2.9 — off until validated on a real carrier (see server.js).
const FORWARDING_VERIFY_ENABLED = process.env.FLYNN_FORWARDING_VERIFY === '1';

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_SECRET;

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

const isClaimable = (session) =>
  session
  && !['claimed', 'receptionist_live', 'expired'].includes(session.state)
  && new Date(session.expires_at) >= new Date();

const loadUser = async (userId) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, phone, default_org_id, business_brain')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return data;

  // The whole claim hinges on matching the signup phone to the phone they rang
  // from. public.users.phone is mirrored from auth.users by trigger, but if that
  // mirror ever misses, the user sees "no session" and their call is lost — so
  // fall back to the auth record rather than failing the match.
  if (!data.phone) {
    const { data: authUser } = await supabase.auth.admin.getUserById(userId).catch(() => ({ data: null }));
    const authPhone = authUser?.user?.phone;
    if (authPhone) data.phone = authPhone.startsWith('+') ? authPhone : `+${authPhone}`;
  }
  return data;
};

const findSessionByPhone = async (phone) => {
  if (!phone) return null;
  const { data } = await supabase
    .from('voice_onboarding_sessions')
    .select('*')
    .eq('caller_phone', phone)
    .maybeSingle();
  return data || null;
};

const findSessionByCode = async (code) => {
  if (!code) return null;
  const { data } = await supabase
    .from('voice_onboarding_sessions')
    .select('*')
    .eq('claim_code', String(code).trim().toUpperCase())
    .maybeSingle();
  return data || null;
};

// First-run check: does this user have a staged receptionist config waiting?
router.get('/session', authenticateJwt, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'storage unavailable' });
  try {
    const user = await loadUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'user not found' });

    const session = await findSessionByPhone(user.phone);
    if (!isClaimable(session)) {
      return res.json({ found: false });
    }
    return res.json({
      found: true,
      state: session.state,
      business_config: session.business_config,
      call_count: session.call_count,
    });
  } catch (error) {
    console.error('[VoiceOnboarding] Session lookup failed.', { userId: req.user?.id, error: error.message });
    return res.status(500).json({ error: 'lookup failed' });
  }
});

// Apply the staged config to the user's org. Body: { code? } — code is the
// recovery path when the signup phone differs from the caller phone.
router.post('/claim', authenticateJwt, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'storage unavailable' });
  try {
    const user = await loadUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'user not found' });
    if (!user.default_org_id) return res.status(409).json({ error: 'no organization for user yet' });

    let session = await findSessionByPhone(user.phone);
    if (!isClaimable(session)) {
      session = req.body?.code ? await findSessionByCode(req.body.code) : null;
    }
    if (!isClaimable(session)) {
      return res.status(404).json({ error: 'no claimable session', code_required: Boolean(!req.body?.code) });
    }

    const config = session.business_config || {};
    const businessName = config.business_name
      || (config.owner_name && config.trade ? `${config.owner_name.split(' ')[0]}'s ${config.trade} services` : null);
    const serviceAreas = Array.isArray(config.service_areas) ? config.service_areas : [];
    const feeCents = calloutFeeToCents(config.callout_fee);

    const aiInstructionParts = [];
    if (config.hours) aiInstructionParts.push(`Working hours: ${config.hours}.`);
    if (config.after_hours_policy && config.after_hours_policy !== 'unsure') {
      const policyText = {
        take_message: 'For after-hours calls, take a message for the owner.',
        book_next_day: 'For after-hours calls, offer to book them in for the next working day.',
        flag_emergencies: 'For after-hours calls, take a message unless it is an emergency, in which case flag it to the owner immediately.',
      }[config.after_hours_policy];
      if (policyText) aiInstructionParts.push(policyText);
    }
    if (config.notes) aiInstructionParts.push(config.notes);

    const profileRow = {
      org_id: user.default_org_id,
      user_id: user.id,
      ...(businessName ? { business_name: businessName } : {}),
      ...(config.trade ? { business_type: config.trade } : {}),
      ...(serviceAreas.length > 0
        ? { service_areas: serviceAreas, service_area: serviceAreas.join(', ') }
        : {}),
      ...(config.callout_fee ? { pricing_notes: `Callout fee: ${config.callout_fee}` } : {}),
      ...(feeCents !== null ? { callout_fee_cents: feeCents } : {}),
      ...(aiInstructionParts.length > 0 ? { ai_instructions: aiInstructionParts.join(' ') } : {}),
      updated_at: new Date().toISOString(),
    };

    const { error: profileError } = await supabase
      .from('business_profiles')
      .upsert(profileRow, { onConflict: 'org_id' });
    if (profileError) {
      console.error('[VoiceOnboarding] Profile upsert failed.', { orgId: user.default_org_id, error: profileError.message });
      return res.status(500).json({ error: 'failed to apply profile' });
    }

    // Turn the receptionist on for this user and mirror the essentials into the
    // SMS agent's brain so both surfaces know the business from day one.
    const greeting = businessName
      ? `G'day, you've called ${businessName}!`
      : "G'day, thanks for calling!";
    const mergedBrain = {
      ...(user.business_brain || {}),
      ...(config.trade ? { business_type: config.trade } : {}),
      ...(businessName ? { business_name: businessName } : {}),
      ...(serviceAreas.length > 0 ? { service_area: serviceAreas.join(', ') } : {}),
      ...(feeCents !== null ? { callout_fee_cents: feeCents } : {}),
      ...(config.hours ? { hours: config.hours } : {}),
      currency: 'AUD',
    };

    const { error: userError } = await supabase
      .from('users')
      .update({
        receptionist_configured: true,
        call_handling_mode: 'ai_receptionist',
        receptionist_greeting: greeting,
        business_brain: mergedBrain,
      })
      .eq('id', user.id);
    if (userError) {
      console.error('[VoiceOnboarding] User receptionist update failed.', { userId: user.id, error: userError.message });
    }

    await supabase
      .from('voice_onboarding_sessions')
      .update({
        state: 'claimed',
        claimed_by: user.id,
        claimed_org_id: user.default_org_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    console.log('[VoiceOnboarding] Session claimed.', {
      sessionId: session.id,
      userId: user.id,
      orgId: user.default_org_id,
    });

    return res.json({
      claimed: true,
      business_config: config,
      business_name: businessName,
      // Number assignment (pool allocation) is the next onboarding step; the
      // client shows "pick your number" once this returns.
      receptionist_live: false,
    });
  } catch (error) {
    console.error('[VoiceOnboarding] Claim failed.', { userId: req.user?.id, error: error.message });
    return res.status(500).json({ error: 'claim failed' });
  }
});

// Allocate a pool number and flip the receptionist live. The number is the
// routing key: getReceptionistProfileByNumber matches users.twilio_phone_number
// on inbound calls, so writing that column IS go-live.
router.post('/assign-number', authenticateJwt, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'storage unavailable' });
  try {
    const user = await loadUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'user not found' });
    if (!user.default_org_id) return res.status(409).json({ error: 'no organization for user yet' });

    // Idempotent: already has a number → return it.
    const { data: fullUser } = await supabase
      .from('users')
      .select('twilio_phone_number')
      .eq('id', user.id)
      .maybeSingle();
    if (fullUser?.twilio_phone_number) {
      return res.json({ phone_number: fullUser.twilio_phone_number, already_assigned: true });
    }

    const { data: session } = await supabase
      .from('voice_onboarding_sessions')
      .select('id, state')
      .eq('claimed_by', user.id)
      .maybeSingle();
    if (!session || !['claimed', 'receptionist_live'].includes(session.state)) {
      return res.status(409).json({ error: 'claim your receptionist config first' });
    }

    // A rented number costs real money every month whether or not anyone
    // ever calls it, so this is the one place in the funnel that must not
    // hand one out for free. Two ways in: a verified StoreKit subscription
    // (the normal path — the client is expected to run the paywall right
    // before this call) or an org already entitled through the legacy
    // Stripe billing surface (services/billingGate.js), so existing paying
    // or trialing users on that path aren't newly locked out here.
    const { data: org } = await supabase
      .from('organizations')
      .select('billing_plan_id, subscription_status')
      .eq('id', user.default_org_id)
      .maybeSingle();
    const legacyEntitled = Boolean(org?.billing_plan_id)
      && org.billing_plan_id !== 'trial'
      && ['active', 'trialing'].includes(org?.subscription_status);
    const verified = legacyEntitled || await hasVerifiedSubscription(user.id);
    if (!verified) {
      return res.status(402).json({ error: 'subscription_required' });
    }
    // Cheap insurance: if this user is only entitled via a subscription that
    // hasn't been mirrored onto the org yet (a backfill gap, not the normal
    // path), bring it in sync before handing out the number so the inbound-
    // call check right after go-live sees the same truth.
    if (!legacyEntitled) {
      await syncOrgEntitlement(user.id);
    }

    const { data: phoneNumber, error: allocError } = await supabase.rpc('allocate_pool_number', {
      p_user_id: user.id,
      p_org_id: user.default_org_id,
    });
    if (allocError) {
      console.error('[VoiceOnboarding] Pool allocation RPC failed.', { userId: user.id, error: allocError.message });
      return res.status(500).json({ error: 'allocation failed' });
    }
    if (!phoneNumber) {
      console.error('[VoiceOnboarding] NUMBER POOL EMPTY — top up AU numbers in Twilio.', { userId: user.id });
      // Worth an event: a paying user who cannot be given a number is the most
      // expensive failure in the funnel, and it is invisible from the app side.
      analytics.capture(user.id, 'number_pool_empty', { org_id: user.default_org_id });
      return res.status(503).json({ error: 'pool_empty' });
    }

    const { error: userError } = await supabase
      .from('users')
      .update({ twilio_phone_number: phoneNumber })
      .eq('id', user.id);
    if (userError) {
      // Roll the allocation back so the number isn't stranded.
      await supabase
        .from('voice_number_pool')
        .update({ status: 'available', assigned_user_id: null, assigned_org_id: null, assigned_at: null })
        .eq('phone_number', phoneNumber);
      console.error('[VoiceOnboarding] Failed to write user number; allocation rolled back.', { userId: user.id, error: userError.message });
      return res.status(500).json({ error: 'assignment failed' });
    }

    await supabase
      .from('voice_onboarding_sessions')
      .update({ state: 'receptionist_live', updated_at: new Date().toISOString() })
      .eq('id', session.id);

    // Give them a booking page at the same moment they become reachable. The
    // receptionist tells every caller "I'll send you a booking link by SMS
    // right now", and until this existed there was no link to send: nothing
    // server-side ever created a booking_pages row.
    await ensureBookingPage({
      userId: user.id,
      orgId: user.default_org_id,
    });

    console.log('[VoiceOnboarding] Number assigned, receptionist live.', {
      userId: user.id,
      orgId: user.default_org_id,
      phoneNumber,
    });

    analytics.capture(user.id, analytics.EVENTS.NUMBER_ASSIGNED, {
      org_id: user.default_org_id,
      phone_number: phoneNumber,
    });

    return res.json({ phone_number: phoneNumber, receptionist_live: true });
  } catch (error) {
    console.error('[VoiceOnboarding] Assign-number failed.', { userId: req.user?.id, error: error.message });
    return res.status(500).json({ error: 'assignment failed' });
  }
});

/**
 * The onboarding value moment: ring the user's OWN verified mobile and connect
 * them to their AI receptionist, seeded from the business profile they just
 * entered, so they hear the product before the paywall.
 *
 * Security, learnt from the /api/call-me-back toll-fraud fix: the number dialled
 * is ALWAYS the authenticated user's own phone (an OTP-verified mobile mirrored
 * from auth.users), never a value from the request body. There is no way to make
 * this dial an arbitrary number.
 */
router.post('/demo-call', authenticateJwt, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'storage unavailable' });
  if (!twilioClient) {
    console.error('[DemoCall] Twilio not configured; cannot place demo call.');
    return res.status(503).json({ error: 'calling temporarily unavailable' });
  }
  if (!demoCallStore.isConfigured()) return res.status(503).json({ error: 'calling temporarily unavailable' });

  try {
    const user = await loadUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'user not found' });
    if (!user.phone) {
      // No verified mobile on file — nothing safe to call. (Email-only signup.)
      return res.status(400).json({ error: 'no_verified_phone' });
    }

    // Rate limit: one in flight at a time, and a small daily ceiling. Each call
    // costs real Twilio minutes, so this is a hard gate, not advisory.
    if (await demoCallStore.hasActiveDemoCall(user.id)) {
      return res.status(429).json({ error: 'demo_in_progress' });
    }
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    if (await demoCallStore.countDemoCallsSince(user.id, dayAgo) >= 5) {
      return res.status(429).json({ error: 'daily_limit' });
    }

    const baseUrl = process.env.PUBLIC_BASE_URL || process.env.SERVER_PUBLIC_URL;
    if (!baseUrl) {
      console.error('[DemoCall] No PUBLIC_BASE_URL / SERVER_PUBLIC_URL set.');
      return res.status(503).json({ error: 'calling temporarily unavailable' });
    }
    const fromNumber = process.env.TWILIO_DEMO_FROM || process.env.TWILIO_FLYNN_NUMBER || '+61480891471';

    // Create the tracking row first so the status callback has an id to update.
    const demo = await demoCallStore.createDemoCall({
      userId: user.id,
      orgId: user.default_org_id,
      callSid: null,
      toPhone: user.phone,
    });

    let call;
    try {
      call = await twilioClient.calls.create({
        to: user.phone,
        from: fromNumber,
        url: `${baseUrl}/telephony/demo-call-answer?userId=${encodeURIComponent(user.id)}`,
        method: 'POST',
        statusCallback: `${baseUrl}/telephony/demo-call-status?demoId=${encodeURIComponent(demo.id)}`,
        statusCallbackMethod: 'POST',
        statusCallbackEvent: ['answered', 'completed', 'no-answer', 'failed', 'busy'],
        // Ring for a sensible window then give up rather than hang on the user.
        timeout: 25,
      });
    } catch (err) {
      await demoCallStore.setDemoCallStatus(demo.id, 'failed');
      console.error('[DemoCall] Failed to place call.', { userId: user.id, error: err.message });
      return res.status(502).json({ error: 'call_failed' });
    }

    // Record the SID so the completion handler can find this call and divert it
    // out of the tenant pipeline. Set synchronously — the call takes seconds to
    // connect, so this always lands before completion.
    await supabase.from('demo_calls').update({ call_sid: call.sid }).eq('id', demo.id);

    analytics.capture(user.id, analytics.EVENTS.DEMO_CALL_REQUESTED, { demo_call_id: demo.id });
    console.log('[DemoCall] Placed.', { userId: user.id, demoId: demo.id, callSid: call.sid });

    return res.json({ demo_call_id: demo.id, status: 'ringing' });
  } catch (error) {
    console.error('[DemoCall] Trigger failed.', { userId: req.user?.id, error: error.message });
    return res.status(500).json({ error: 'demo_call_failed' });
  }
});

/** Poll for the demo call's status and payoff (transcript + extracted job). */
router.get('/demo-call/:id', authenticateJwt, async (req, res) => {
  if (!demoCallStore.isConfigured()) return res.status(503).json({ error: 'unavailable' });
  try {
    const demo = await demoCallStore.getDemoCallById(req.params.id);
    // Ownership check — never leak another user's demo transcript.
    if (!demo || demo.user_id !== req.user.id) return res.status(404).json({ error: 'not_found' });
    return res.json({
      id: demo.id,
      status: demo.status,
      transcript: demo.transcript || null,
      extracted_job: demo.extracted_job || null,
      created_at: demo.created_at,
      completed_at: demo.completed_at || null,
    });
  } catch (error) {
    console.error('[DemoCall] Status lookup failed.', { id: req.params.id, error: error.message });
    return res.status(500).json({ error: 'lookup_failed' });
  }
});

/**
 * Gate 2.9 — server-verified call forwarding. Place a test call to the user's
 * own mobile; if their conditional divert is live and they let it ring out, the
 * carrier forwards it to their Flynn number, and that inbound call (detected in
 * server.js) is the proof. Flag-gated OFF until validated on a real carrier —
 * while off, this returns `{ enabled: false }` and the app keeps advancing on
 * the user's own confirmation.
 */
router.post('/verify-forwarding', authenticateJwt, async (req, res) => {
  if (!FORWARDING_VERIFY_ENABLED) return res.json({ enabled: false });
  if (!supabase) return res.status(500).json({ error: 'storage unavailable' });
  if (!twilioClient) return res.status(503).json({ error: 'verification unavailable' });
  try {
    const user = await loadUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'user not found' });
    if (!user.phone) return res.status(400).json({ error: 'no_verified_phone' });

    const { data: numberRow } = await supabase
      .from('users').select('twilio_phone_number').eq('id', user.id).maybeSingle();
    const flynnNumber = numberRow?.twilio_phone_number;
    if (!flynnNumber) return res.status(409).json({ error: 'no_flynn_number' });

    const baseUrl = process.env.PUBLIC_BASE_URL || process.env.SERVER_PUBLIC_URL;
    if (!baseUrl) return res.status(503).json({ error: 'verification unavailable' });
    // A number distinct from the user's Flynn number is ideal so the forwarded
    // leg's caller id is unambiguous; falls back to the shared Flynn number.
    const verifyFrom = process.env.TWILIO_VERIFY_FROM || process.env.TWILIO_DEMO_FROM
      || process.env.TWILIO_FLYNN_NUMBER || '+61480891471';

    const id = randomUUID();
    forwardingVerifyStore.start({ id, userId: user.id, flynnNumber, userMobile: user.phone, verifyFrom });

    try {
      await twilioClient.calls.create({
        to: user.phone,
        from: verifyFrom,
        url: `${baseUrl}/telephony/forwarding-verify-answer?vid=${encodeURIComponent(id)}`,
        method: 'POST',
        statusCallback: `${baseUrl}/telephony/forwarding-verify-status?vid=${encodeURIComponent(id)}`,
        statusCallbackMethod: 'POST',
        statusCallbackEvent: ['completed', 'no-answer', 'failed', 'busy'],
        // Long enough to ring out and trigger the no-answer divert.
        timeout: 20,
      });
    } catch (err) {
      console.error('[ForwardingVerify] Failed to place test call.', { userId: user.id, error: err.message });
      return res.status(502).json({ error: 'call_failed' });
    }

    analytics.capture(user.id, analytics.EVENTS.FORWARDING_CODE_DIALLED, { verifying: true });
    return res.json({ enabled: true, verification_id: id, status: 'checking' });
  } catch (error) {
    console.error('[ForwardingVerify] Trigger failed.', { userId: req.user?.id, error: error.message });
    return res.status(500).json({ error: 'verify_failed' });
  }
});

/** Poll the verification result: checking | verified | not_forwarded | expired. */
router.get('/verify-forwarding/:id', authenticateJwt, async (req, res) => {
  if (!FORWARDING_VERIFY_ENABLED) return res.json({ enabled: false });
  const entry = forwardingVerifyStore.getById(req.params.id);
  if (!entry || entry.userId !== req.user.id) return res.status(404).json({ error: 'not_found' });
  return res.json({ enabled: true, status: entry.status });
});

module.exports = router;
