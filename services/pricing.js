/**
 * The single source of truth for what Flynn costs.
 *
 * This exists because the price had drifted into six different places and none
 * of them agreed. The funnel agent told every ad caller "$79 a month after a
 * 7 day free trial" while StoreKit shipped three tiers at $29/$79/$179 on
 * 14-day trials, the App Store push said "14 days free", and Stripe created
 * subscriptions with trial_period_days: 14. Quoting a price on a recorded sales
 * call that the checkout does not honour is an Australian Consumer Law problem,
 * not just an inconsistency.
 *
 * Anything that states a price or a trial length — voice prompts, SMS copy,
 * push notifications, Stripe params, the landing page build — reads it here.
 *
 * The Apple product IDs must stay in sync with
 * ios-native/FlynnAI/Resources/FlynnAI.storekit and the `plans` table's
 * `apple_product_id` column.
 */

const TRIAL_DAYS = 7;

const CURRENCY = 'AUD';

const TIERS = {
  link: {
    slug: 'link',
    name: 'Flynn Link',
    priceMonthly: 29,
    appleProductId: 'com.flynnai.link.monthly',
    // Missed call auto-sends the branded booking link. No AI answering.
    blurb: 'the booking link, invoices and quotes',
  },
  receptionist: {
    slug: 'receptionist',
    name: 'Flynn Receptionist',
    priceMonthly: 69,
    appleProductId: 'com.flynnai.receptionist.monthly',
    // Flynn actually answers and books, plus everything in Link.
    blurb: 'Flynn answers your calls and books the job, plus everything in Link',
  },
};

/** The tier the ads and the funnel call sell. */
const HEADLINE_TIER = TIERS.receptionist;

function formatPrice(tier) {
  return `$${tier.priceMonthly}`;
}

/**
 * The price sentence the voice agent says out loud. Kept as one short spoken
 * line — the agent is told to answer straight and get back to the conversation.
 */
function spokenPriceLine(tier = HEADLINE_TIER) {
  return `It is ${formatPrice(tier)} a month after a ${TRIAL_DAYS} day free trial, card required for the trial, cancel any time.`;
}

/** The line used in trial-started push copy and SMS. */
function trialBlurb() {
  return `${TRIAL_DAYS} days free — we'll remind you before it converts to a paid plan.`;
}

module.exports = {
  TRIAL_DAYS,
  CURRENCY,
  TIERS,
  HEADLINE_TIER,
  formatPrice,
  spokenPriceLine,
  trialBlurb,
};
