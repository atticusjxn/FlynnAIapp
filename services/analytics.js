/**
 * PostHog, server side.
 *
 * Flynn had no product analytics and no crash reporting at all — one manual
 * Meta `Purchase` event was the entire instrumentation surface. A funnel that
 * leaks is a funnel you cannot see, and ads start Monday.
 *
 * Two rules this module exists to enforce:
 *
 *  1. `distinctId` is ALWAYS the Supabase user id, matching what the iOS client
 *     passes to PostHog.identify(). Server events (number assigned, call
 *     answered, invoice paid) and client events (paywall viewed, forwarding
 *     dialled) have to land on one person or the funnel splits in half and
 *     every conversion rate reads low.
 *
 *  2. Tracking never breaks the thing it is tracking. Every call is
 *     fire-and-forget and swallows its own errors, same contract as
 *     services/metaCapi.js.
 *
 * Events that happen before a user exists (a funnel call from an ad, an
 * anonymous landing-page hit) use `anonId()` off the caller's phone number, so
 * they can be aliased to the real user once they sign up.
 */

const crypto = require('crypto');

const API_KEY = process.env.POSTHOG_API_KEY || '';
const HOST = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';

let client = null;

if (API_KEY) {
  try {
    const { PostHog } = require('posthog-node');
    client = new PostHog(API_KEY, {
      host: HOST,
      // The 60s ticker and short-lived request handlers mean we cannot rely on
      // a big buffer draining on its own.
      flushAt: 20,
      flushInterval: 10000,
    });
    console.log(`[Analytics] PostHog enabled (${HOST})`);
  } catch (err) {
    console.error('[Analytics] Failed to initialise PostHog:', err.message);
  }
} else {
  console.log('[Analytics] POSTHOG_API_KEY unset — analytics disabled');
}

/**
 * The canonical event names. Import these rather than typing strings: a typo
 * silently creates a second event and the funnel step reads as 100% drop-off.
 */
const EVENTS = {
  // Acquisition / signup
  SIGNUP_STARTED: 'signup_started',
  SIGNUP_COMPLETED: 'signup_completed',

  // Onboarding
  ONBOARD_TRADE_SELECTED: 'onboard_trade_selected',
  ONBOARD_SERVICES_ENTERED: 'onboard_services_entered',
  ONBOARD_CALENDAR_CONNECTED: 'onboard_calendar_connected',

  // The demo call — the value moment
  DEMO_CALL_REQUESTED: 'demo_call_requested',
  DEMO_CALL_ANSWERED: 'demo_call_answered',
  DEMO_CALL_COMPLETED: 'demo_call_completed',
  DEMO_TRANSCRIPT_VIEWED: 'demo_transcript_viewed',

  // Money
  PAYWALL_VIEWED: 'paywall_viewed',
  PAYWALL_DISMISSED: 'paywall_dismissed',
  TRIAL_STARTED: 'trial_started',
  SUBSCRIPTION_PURCHASED: 'subscription_purchased',

  // Activation — the steps that decide whether Flynn ever answers a call
  NUMBER_ASSIGNED: 'number_assigned',
  FORWARDING_CODE_DIALLED: 'forwarding_code_dialled',
  FORWARDING_VERIFIED: 'forwarding_verified',

  // The product actually working
  CALL_ANSWERED: 'call_answered',
  JOB_BOOKED: 'job_booked',
  BOOKING_LINK_SENT: 'booking_link_sent',
  BOOKING_LINK_OPENED: 'booking_link_opened',
  BOOKING_MADE: 'booking_made',
  INVOICE_SENT: 'invoice_sent',
  INVOICE_PAID: 'invoice_paid',
  CHASE_SENT: 'chase_sent',
};

/**
 * Stable pseudonymous id for someone who has no account yet, derived from their
 * phone number so the same caller is the same person across a funnel call, the
 * magic link and the App Store bounce. Hashed so raw numbers stay out of the
 * analytics store.
 */
function anonId(phone) {
  if (!phone) return null;
  const normalised = String(phone).replace(/[^\d+]/g, '');
  return 'anon_' + crypto.createHash('sha256').update(normalised).digest('hex').slice(0, 32);
}

function capture(distinctId, event, properties = {}) {
  if (!client || !distinctId || !event) return;
  try {
    client.capture({
      distinctId: String(distinctId),
      event,
      properties: { ...properties, $lib: 'flynn-backend' },
    });
  } catch (err) {
    console.error(`[Analytics] capture(${event}) failed:`, err.message);
  }
}

function identify(distinctId, properties = {}) {
  if (!client || !distinctId) return;
  try {
    client.identify({ distinctId: String(distinctId), properties });
  } catch (err) {
    console.error('[Analytics] identify failed:', err.message);
  }
}

/**
 * Join an anonymous pre-signup identity to the real user id. Without this the
 * ad click, the funnel call and the eventual subscription are three different
 * people and install→paid can never be measured.
 */
function alias(anonymousId, userId) {
  if (!client || !anonymousId || !userId) return;
  try {
    client.alias({ distinctId: String(userId), alias: String(anonymousId) });
  } catch (err) {
    console.error('[Analytics] alias failed:', err.message);
  }
}

/** Flush pending events. Call before the process exits. */
async function shutdown() {
  if (!client) return;
  try {
    await client.shutdown();
  } catch (err) {
    console.error('[Analytics] shutdown failed:', err.message);
  }
}

module.exports = { EVENTS, anonId, capture, identify, alias, shutdown, isEnabled: () => !!client };
