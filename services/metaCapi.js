/**
 * Meta Conversions API (server-side) — fires the two go-to-market events the
 * ad strategy optimises on instead of raw link clicks:
 *
 *   MessagedFlynn  a cold visitor tapped "Message Flynn" on the landing page.
 *                  Fired twice with ONE shared event_id so Meta dedups them:
 *                  once by the browser Pixel (full attribution), once here via
 *                  CAPI (survives iOS / ad-blockers). action_source 'website'.
 *   Activated      they reached first value in iMessage (first successful
 *                  "doing" action). action_source 'business_messaging',
 *                  attributed by bridging the browser's fbp/fbc through a ref
 *                  token captured at the button tap (see trackingRoutes.js).
 *
 * No-op until configured. Set META_CAPI_PIXEL_ID + META_CAPI_ACCESS_TOKEN to
 * enable; META_CAPI_TEST_EVENT_CODE routes to the Events Manager test tab.
 * Event names are overridable so they can be mapped to custom conversions.
 *
 * Match quality: we pass fbp/fbc (raw, as Meta requires), client IP + user
 * agent (raw) and a SHA-256 hashed phone. Failures are swallowed — tracking
 * must never break a reply.
 */

const crypto = require('crypto');

const PIXEL_ID = process.env.META_CAPI_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;
const TEST_CODE = process.env.META_CAPI_TEST_EVENT_CODE || null;
const API_VERSION = process.env.META_CAPI_API_VERSION || 'v21.0';
const DEFAULT_SOURCE_URL = process.env.META_CAPI_SOURCE_URL || 'https://flynnai.app/';

const EVENT_MESSAGED = process.env.META_CAPI_EVENT_MESSAGED || 'MessagedFlynn';
const EVENT_ACTIVATED = process.env.META_CAPI_EVENT_ACTIVATED || 'Activated';
// Standard Meta event fired alongside MessagedFlynn so the ad can optimise on it.
// Custom events (MessagedFlynn) aren't selectable as an optimisation/conversion
// event until they accrue volume; the standard Lead event is selectable instantly
// and has rich optimisation signal. Same event_id => dedups with the browser Lead.
const EVENT_LEAD = process.env.META_CAPI_EVENT_LEAD || 'Lead';

function isConfigured() {
  return Boolean(PIXEL_ID && ACCESS_TOKEN);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex');
}

// E.164 -> Meta's expected hashed phone (digits only, no leading +).
function hashedPhone(phone) {
  const digits = String(phone || '').replace(/[^\d]/g, '');
  return digits ? sha256(digits) : null;
}

/**
 * Post one server event.
 * @param {string} eventName
 * @param {object} opts
 *   phone           E.164, hashed before send
 *   eventId         dedup key shared with the browser Pixel event
 *   actionSource    'website' | 'business_messaging' (default 'website')
 *   eventSourceUrl  the page the journey started on (for website events)
 *   fbp, fbc        Meta browser cookies, sent RAW (not hashed)
 *   fbclid          click id; synthesised into fbc if fbc is absent
 *   clientIp, userAgent  raw, improve match quality
 *   customData      optional custom_data object
 */
async function track(eventName, opts = {}) {
  if (!isConfigured()) return { skipped: 'not_configured' };
  const {
    phone, eventId, actionSource = 'website', eventSourceUrl,
    fbp, fbc, fbclid, clientIp, userAgent, customData,
  } = opts;

  const ph = hashedPhone(phone);
  // Synthesise fbc from fbclid when the cookie wasn't captured.
  const fbcValue = fbc || (fbclid ? `fb.1.${Math.floor(Date.now() / 1000)}.${fbclid}` : null);

  const userData = {};
  if (ph) userData.ph = [ph];
  if (fbp) userData.fbp = fbp;
  if (fbcValue) userData.fbc = fbcValue;
  if (clientIp) userData.client_ip_address = clientIp;
  if (userAgent) userData.client_user_agent = userAgent;

  const event = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    action_source: actionSource,
    ...(eventId ? { event_id: eventId } : {}),
    ...(actionSource === 'website' ? { event_source_url: eventSourceUrl || DEFAULT_SOURCE_URL } : {}),
    user_data: userData,
    ...(customData ? { custom_data: customData } : {}),
  };
  const body = { data: [event], ...(TEST_CODE ? { test_event_code: TEST_CODE } : {}) };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(ACCESS_TOKEN)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(`[metaCapi] ${eventName} failed (${res.status}): ${text.slice(0, 200)}`);
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.warn(`[metaCapi] ${eventName} error:`, err?.message);
    return { ok: false };
  }
}

// MessagedFlynn — the CAPI mirror of the landing-page button tap. `ids` carries
// the browser identifiers captured at the tap (event_id, fbp, fbc, fbclid, ip,
// ua, source url) so this dedups against and reinforces the Pixel event.
//
// Fires TWO events with the SAME event_id (Meta dedups per event_name, so reusing
// the id across names is fine): the custom MessagedFlynn (granular reporting) and
// the standard Lead (selectable as the ad's optimisation event). Each dedups with
// its matching browser Pixel event.
function trackMessagedFlynn(ids = {}) {
  const common = {
    eventId: ids.eventId,
    actionSource: 'website',
    eventSourceUrl: ids.eventSourceUrl,
    fbp: ids.fbp,
    fbc: ids.fbc,
    fbclid: ids.fbclid,
    clientIp: ids.clientIp,
    userAgent: ids.userAgent,
    phone: ids.phone,
  };
  return Promise.all([
    track(EVENT_MESSAGED, common),
    track(EVENT_LEAD, { ...common, customData: { content_name: 'message_flynn' } }),
  ]);
}

// Activated — first value, fired from the iMessage side. `bridge` is the stored
// browser identity (fbp/fbc/fbclid/source url) so the off-site conversion still
// attributes to the original ad click.
function trackActivated(phone, bridge = {}, customData) {
  return track(EVENT_ACTIVATED, {
    phone,
    actionSource: 'business_messaging',
    eventSourceUrl: bridge.event_source_url,
    fbp: bridge.fbp,
    fbc: bridge.fbc,
    fbclid: bridge.fbclid,
    customData,
  });
}

module.exports = { isConfigured, track, trackMessagedFlynn, trackActivated };
