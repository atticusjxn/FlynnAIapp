/**
 * Twilio IVR Handler — Mode A (SMS Link Follow-Up).
 *
 * Builds Twilio TwiML for the booking/quote DTMF menu and handles the caller's
 * key-press: sends the booking or quote link via SMS during the call, or routes
 * to voicemail. Replaces the removed Telnyx Call Control IVR (Twilio is now
 * Flynn's sole telephony provider).
 *
 * Flow:
 *   inbound-voice (sms_links) → generateIVRTwiML  → <Gather> one digit
 *   caller presses key        → handleDTMFInput   → send SMS + confirm / voicemail
 *   no input                  → handleIVRTimeout  → voicemail fallback
 *
 * Menu script resolution (provider-agnostic, mirrors the previous handler):
 *   business_profiles.ivr_custom_script (preferred) →
 *   ivr_templates.script_body (via ivr_template_id) → AU fallback.
 *
 * Voicemail recordings reuse the existing `/telephony/recording-complete`
 * callback so press-3 voicemails flow through the same transcription pipeline.
 */

const twilio = require('twilio');
const { supabase } = require('./supabaseClient');
const smsLinkSender = require('./smsLinkSender');

const IVR_VOICE = process.env.TWILIO_IVR_VOICE || 'Polly.Olivia-Neural'; // AU English
const IVR_LANG = process.env.TWILIO_IVR_LANG || 'en-AU';
const VOICEMAIL_MAX_LENGTH = 300;

const AU_FALLBACK_SCRIPT =
  "You've reached {business_name}. Sorry we missed you.{booking_option}{quote_option}";

// ---------------------------------------------------------------------------
// Menu rendering (pure helpers)
// ---------------------------------------------------------------------------

function digitForAction(digitMap, action) {
  return Object.entries(digitMap).find(([, v]) => v === action)?.[0] || '';
}

function buildMenu(profile) {
  const hasBooking = !!(profile?.booking_link_enabled && profile?.booking_link_url);
  const hasQuote = !!(profile?.quote_link_enabled && profile?.quote_link_url);

  const digitMap = {};
  let nextDigit = 1;
  if (hasBooking) { digitMap[String(nextDigit)] = 'booking'; nextDigit++; }
  if (hasQuote) { digitMap[String(nextDigit)] = 'quote'; nextDigit++; }
  digitMap[String(nextDigit)] = 'voicemail';

  const bookingOption = hasBooking
    ? ` Press ${digitForAction(digitMap, 'booking')} and we'll text you a booking link.`
    : '';
  const quoteOption = hasQuote
    ? ` Press ${digitForAction(digitMap, 'quote')} and we'll text you a quote form.`
    : '';
  const voicemailOption = ` Press ${digitForAction(digitMap, 'voicemail')} to leave a voicemail.`;

  return { digitMap, hasBooking, hasQuote, bookingOption, quoteOption, voicemailOption };
}

function renderPrompt(script, profile, menu) {
  const businessName = profile?.business_name || 'us';
  return script
    .replace(/\{business_name\}/g, businessName)
    .replace(/\{booking_option\}/g, menu.bookingOption)
    .replace(/\{quote_option\}/g, menu.quoteOption);
}

async function resolveScript(profile) {
  if (profile?.ivr_custom_script) return profile.ivr_custom_script;
  if (profile?.ivr_template_id) {
    const { data: tmpl } = await supabase
      .from('ivr_templates')
      .select('script_body')
      .eq('id', profile.ivr_template_id)
      .maybeSingle();
    if (tmpl?.script_body) return tmpl.script_body;
  }
  return AU_FALLBACK_SCRIPT;
}

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

async function getBusinessProfileByUserId(userId) {
  if (!userId) return null;
  const { data } = await supabase
    .from('business_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data || null;
}

// ---------------------------------------------------------------------------
// TwiML builders
// ---------------------------------------------------------------------------

function sayVoicemail(response, message, actionBaseUrl) {
  response.say({ voice: IVR_VOICE, language: IVR_LANG }, message);
  response.record({
    // Matches buildRecordingCallbackUrl() in server.js — keeps press-3 voicemails
    // on the same recording → transcription pipeline as the default flow.
    action: `${actionBaseUrl || ''}/telephony/recording-complete`,
    method: 'POST',
    playBeep: true,
    maxLength: VOICEMAIL_MAX_LENGTH,
  });
}

/**
 * Build the menu TwiML (a <Gather> collecting one digit). Falls back to
 * voicemail when neither a booking nor a quote link is configured.
 *
 * @param {object} args
 * @param {object} args.businessProfile  business_profiles row
 * @param {string} args.userId           owner user id (threaded into callbacks)
 * @param {string} args.actionBaseUrl    origin for callback URLs ('' = relative)
 * @returns {Promise<string>} TwiML
 */
async function generateIVRTwiML({ businessProfile, userId, actionBaseUrl = '' }) {
  const response = new twilio.twiml.VoiceResponse();
  const menu = buildMenu(businessProfile);

  // No links configured → straight to voicemail so the lead is still captured.
  if (!menu.hasBooking && !menu.hasQuote) {
    sayVoicemail(response, 'Sorry we missed you. Please leave a message after the tone.', actionBaseUrl);
    return response.toString();
  }

  const script = await resolveScript(businessProfile);
  const prompt = renderPrompt(script, businessProfile, menu) + menu.voicemailOption;

  const gather = response.gather({
    input: 'dtmf',
    numDigits: 1,
    timeout: 6,
    action: `${actionBaseUrl}/ivr/handle-dtmf?userId=${encodeURIComponent(userId || '')}`,
    method: 'POST',
  });
  gather.say({ voice: IVR_VOICE, language: IVR_LANG }, prompt);

  // No key pressed within the Gather timeout → fall through to the timeout route.
  response.redirect(
    { method: 'POST' },
    `${actionBaseUrl}/ivr/timeout?userId=${encodeURIComponent(userId || '')}`
  );

  return response.toString();
}

/**
 * Handle a DTMF key-press: send the requested link via SMS during the call, or
 * route the caller to voicemail.
 *
 * @returns {Promise<{ twiml: string, action: string }>}
 */
async function handleDTMFInput({ digits, businessProfile, userId, callSid, fromNumber, actionBaseUrl = '' }) {
  const response = new twilio.twiml.VoiceResponse();
  const menu = buildMenu(businessProfile);
  const action = menu.digitMap[digits];

  if (!action) {
    response.say({ voice: IVR_VOICE, language: IVR_LANG }, "Sorry, that's not a valid option. Goodbye.");
    response.hangup();
    return { twiml: response.toString(), action: 'invalid' };
  }

  if (action === 'voicemail') {
    sayVoicemail(response, 'No worries. Please leave a message after the tone.', actionBaseUrl);
    return { twiml: response.toString(), action };
  }

  const businessName = businessProfile?.business_name || 'us';
  const linkUrl =
    action === 'booking' ? businessProfile?.booking_link_url : businessProfile?.quote_link_url;

  if (!linkUrl) {
    response.say({ voice: IVR_VOICE, language: IVR_LANG }, "Sorry, that option isn't set up. Goodbye.");
    response.hangup();
    return { twiml: response.toString(), action };
  }

  // Blocked / withheld caller ID → can't SMS; read out the link instead.
  const callerAvailable =
    fromNumber &&
    !['anonymous', 'unavailable', 'restricted', 'unknown'].includes(String(fromNumber).toLowerCase());

  if (!callerAvailable) {
    let spoken = linkUrl;
    try { const u = new URL(linkUrl); spoken = `${u.host}${u.pathname}`; } catch { /* keep raw */ }
    response.say(
      { voice: IVR_VOICE, language: IVR_LANG },
      `We couldn't text you because your number is withheld. Please visit ${spoken}. Goodbye.`
    );
    response.hangup();
    return { twiml: response.toString(), action };
  }

  try {
    if (action === 'booking') {
      await smsLinkSender.sendBookingLinkSMS(fromNumber, businessName, linkUrl, userId, callSid);
      response.say({ voice: IVR_VOICE, language: IVR_LANG },
        "Thanks! We've just texted you a booking link. Talk soon.");
    } else {
      await smsLinkSender.sendQuoteLinkSMS(fromNumber, businessName, linkUrl, userId, callSid);
      response.say({ voice: IVR_VOICE, language: IVR_LANG },
        "Thanks! We've just texted you a quote link. Pop in your details and we'll be in touch.");
    }
  } catch (err) {
    console.error('[TwilioIVR] SMS send failed:', err.message);
    response.say({ voice: IVR_VOICE, language: IVR_LANG },
      "Sorry, we had trouble sending that text. We'll give you a call back shortly.");
  }
  response.hangup();
  return { twiml: response.toString(), action };
}

/**
 * No key pressed before the Gather timeout — route to voicemail so the lead is
 * still captured rather than dropping the call.
 */
async function handleIVRTimeout({ actionBaseUrl = '' } = {}) {
  const response = new twilio.twiml.VoiceResponse();
  sayVoicemail(
    response,
    "We didn't catch a selection. Please leave a quick message after the tone and we'll get back to you.",
    actionBaseUrl
  );
  return response.toString();
}

module.exports = {
  generateIVRTwiML,
  handleDTMFInput,
  handleIVRTimeout,
  getBusinessProfileByUserId,
  // Pure helpers (no network) for unit tests.
  buildMenu,
  renderPrompt,
  resolveScript,
  AU_FALLBACK_SCRIPT,
};
