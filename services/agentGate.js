/**
 * Who Flynn's agent is allowed to talk to.
 *
 * The inbound routes used to engage anyone who messaged them, and create a
 * user record on first contact. On the BlueBubbles relay that meant the agent
 * read the operator's personal iMessage and replied to their own contacts: 27
 * people were ingested and 12 got replies over seven weeks, including a real
 * client trying to book work and a gym's automated billing line, whose support
 * desk then replied to Flynn. This module is the gate that stops that.
 *
 * Default deny. Only three signals are trusted, because they are the only ones
 * that actually prove provenance:
 *
 *   1. FLYNN_AGENT_ALLOWLIST - numbers the operator explicitly nominated.
 *   2. users.is_demo - accounts deliberately provisioned for reviewers.
 *   3. A voice_onboarding_sessions row - a funnel lead Flynn itself rang.
 *
 * Two tempting signals are deliberately NOT trusted:
 *
 *   - users.signup_source. ensureAuthUser() mints the row through auth and it
 *     lands stamped 'app' whatever the real channel was, so a gym billing desk
 *     that only ever sent one SMS reads as an app signup.
 *   - users.business_brain. Brain setup ran against ordinary conversations, so
 *     11 of the operator's personal contacts - including two junk phone values
 *     ('+' and '+321') and numbers in the US, UK and Brazil - have one. Any
 *     rule keyed on it would re-admit most of the people this gate exists to
 *     exclude.
 *
 * A new acquisition channel must therefore add its own explicit signal here
 * rather than assume it inherits access.
 */

const { normalizePhone } = require('./authLink');

const parseAllowlist = () =>
  (process.env.FLYNN_AGENT_ALLOWLIST || '')
    .split(',')
    .map((entry) => normalizePhone(entry.trim()))
    .filter(Boolean);

/**
 * @returns {Promise<{allowed: boolean, reason: string}>} reason is for logging,
 *   so a silent drop is always explainable after the fact.
 */
const isAgentAllowed = async ({ phone, supabase }) => {
  // iMessage handles can be Apple IDs rather than numbers; those normalise to
  // null and are denied, which is the correct default for an unknown sender.
  const normalized = normalizePhone(phone);
  if (!normalized) return { allowed: false, reason: 'unparseable_sender' };

  if (parseAllowlist().includes(normalized)) {
    return { allowed: true, reason: 'allowlist' };
  }

  // Fail closed: without storage we cannot verify anything, and replying to an
  // unverified stranger is the exact failure this gate exists to prevent.
  if (!supabase) return { allowed: false, reason: 'no_storage' };

  const { data: user } = await supabase
    .from('users')
    .select('is_demo')
    .eq('phone', normalized)
    .maybeSingle();
  if (user?.is_demo) return { allowed: true, reason: 'demo_account' };

  const { data: session } = await supabase
    .from('voice_onboarding_sessions')
    .select('id')
    .eq('caller_phone', normalized)
    .maybeSingle();
  if (session) return { allowed: true, reason: 'funnel_lead' };

  return { allowed: false, reason: 'not_registered' };
};

module.exports = { isAgentAllowed, parseAllowlist };
