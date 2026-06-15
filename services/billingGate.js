/**
 * Paywall gate for the iMessage agent (the strategy's "stop doing, fire a Stripe
 * link at the value moment" mechanic).
 *
 * Flynn always keeps CHATTING for free. What it meters is the "doing" surface
 * (registry.METERED_TOOLS): everyone gets a generous free budget of money/admin
 * actions so the receipt-loop activation wow always lands free, then a metered
 * call past the budget returns a textable Stripe Checkout link with the
 * unfinished task as the hook instead of executing.
 *
 * OFF by default. Set FLYNN_PAYWALL=1 to enable. With it off, isEntitled always
 * returns true, so current users are unaffected.
 *
 * Free budget counts successful metered tool calls from tool_call_events, so it
 * survives restarts and isn't gameable by retrying failures.
 */

const FREE_ACTION_LIMIT = Number(process.env.FLYNN_FREE_ACTION_LIMIT || 25);
const ENABLED = process.env.FLYNN_PAYWALL === '1';
const ENTITLED_STATUSES = new Set(['active', 'trialing']);

let _stripe = null;
function stripe() {
  if (_stripe) return _stripe;
  if (!process.env.STRIPE_SECRET_KEY) return null;
  _stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}

function paidPriceId() {
  return process.env.STRIPE_STARTER_PRICE_ID
    || process.env.STRIPE_BASIC_PRICE_ID
    || 'price_1SbiXoRm2tMRBfxYrZE2tD4o';
}

/**
 * Has this user already paid / is on trial? Reads the columns the Stripe routes
 * already maintain on the users row.
 */
function hasSubscription(user) {
  return ENTITLED_STATUSES.has(String(user?.subscription_status || '').toLowerCase());
}

/**
 * Count this user's successful metered (doing) actions to date.
 */
async function meteredActionCount(supabase, phone) {
  if (!supabase) return 0;
  const registry = require('./agent/toolRegistry');
  const { count } = await supabase
    .from('tool_call_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_phone', phone)
    .eq('success', true)
    .in('tool_name', [...registry.METERED_TOOLS]);
  return count || 0;
}

/**
 * Decide whether a metered tool call is allowed right now.
 * @returns {Promise<{entitled: boolean, reason?: string}>}
 */
async function isEntitled({ user, phone, supabase, toolName }) {
  if (!ENABLED) return { entitled: true };
  const registry = require('./agent/toolRegistry');
  if (!registry.METERED_TOOLS.has(toolName)) return { entitled: true }; // free tool
  if (hasSubscription(user)) return { entitled: true };
  const used = await meteredActionCount(supabase, phone);
  if (used < FREE_ACTION_LIMIT) return { entitled: true };
  return { entitled: false, reason: 'free_limit_reached' };
}

/**
 * Build a one-tap Stripe Checkout link (Apple Pay surfaces automatically in the
 * hosted page) to unlock paid use. Returns null if Stripe isn't configured.
 */
async function checkoutLink({ user, phone }) {
  const s = stripe();
  if (!s) return null;
  const successUrl = `${process.env.SERVER_URL || 'https://flynnai-telephony.fly.dev'}/billing/thanks`;
  const cancelUrl = `${process.env.SERVER_URL || 'https://flynnai-telephony.fly.dev'}/billing/cancelled`;
  try {
    const session = await s.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: paidPriceId(), quantity: 1 }],
      ...(user?.stripe_customer_id ? { customer: user.stripe_customer_id } : {}),
      client_reference_id: user?.id || phone,
      subscription_data: { metadata: { user_phone: phone, user_id: user?.id || '' } },
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
    });
    return session.url;
  } catch (err) {
    console.warn('[billingGate] checkout link failed:', err?.message);
    return null;
  }
}

/**
 * The message Flynn sends when a metered action is blocked — keeps Flynn's
 * voice, names the unfinished task as the hook, ends with the unlock link.
 */
async function upsellBubble({ user, phone, taskHook }) {
  const link = await checkoutLink({ user, phone });
  const hook = taskHook ? `want me to ${taskHook}?` : 'want me to keep doing this stuff for you?';
  if (!link) {
    return `${hook} you're past the free runs. flynn's $49/mo to keep handling the admin. i'll send the link in a sec`;
  }
  return `${hook} you've used up your free runs. it's $49/mo to keep me doing your admin, tap to unlock and i'll finish it: ${link}`;
}

module.exports = { ENABLED, isEntitled, checkoutLink, upsellBubble, hasSubscription, meteredActionCount };
