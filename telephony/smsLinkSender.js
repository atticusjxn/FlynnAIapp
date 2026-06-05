/**
 * SMS Link Sender — Mode A (SMS Link Follow-Up).
 *
 * Sends booking and quote links via the Twilio Messaging API. Twilio is Flynn's
 * sole telephony provider (inbound calls + the AI receptionist already run on
 * Twilio Media Streams); the previous Telnyx path was removed.
 *
 * Aligned to the Supabase schema:
 *   business_profiles.{booking_link_url, booking_link_enabled,
 *                      quote_link_url, quote_link_enabled,
 *                      sms_booking_template, sms_quote_template,
 *                      business_name}
 *   users.twilio_phone_number (falls back to env TWILIO_FROM_NUMBER)
 *
 * Event logging writes directly to `call_events` via costTracker.logCallEvent.
 *
 * NOTE: the `callSid` argument is stored on the call row via costTracker's
 * `telnyxCallControlId` field — that column name is legacy; it now carries a
 * Twilio CallSid (any opaque per-call correlation id works).
 */

const { supabase } = require('./supabaseClient');
const twilio = require('twilio');
const { ensureCallRow, logCallEvent } = require('./costTracker');

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Twilio surfaces HTTP status on err.status; retry the same transient classes.
const TRANSIENT_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

function defaultBookingTemplate(businessName, url) {
  return `Hi, this is ${businessName}. Book your appointment here: ${url}\n\nReply STOP to opt out.`;
}

function defaultQuoteTemplate(businessName, url) {
  return `Hi, this is ${businessName}. Share your project details and photos here: ${url}\n\nWe'll get back to you shortly. Reply STOP to opt out.`;
}

function renderTemplate(template, { businessName, url }) {
  if (!template) return null;
  return template
    .replace(/\{business_name\}/g, businessName || 'us')
    .replace(/\{link\}/g, url || '')
    .replace(/\{url\}/g, url || '');
}

async function resolveFromNumber(userId) {
  const { data: user } = await supabase
    .from('users')
    .select('twilio_phone_number')
    .eq('id', userId)
    .maybeSingle();
  return user?.twilio_phone_number || process.env.TWILIO_FROM_NUMBER || null;
}

const FALLBACK_APOLOGY_PREFIX = "Sorry we just missed you — ";

async function sendLinkSMS({
  linkType,              // 'booking_link' | 'quote_link'
  toNumber,
  userId,
  callSid,               // Twilio CallSid (or any per-call correlation id)
  businessProfile,       // { business_name, sms_booking_template, sms_quote_template, ... }
  linkUrl,
  fallbackApology = false,
}) {
  const callId = await ensureCallRow({
    telnyxCallControlId: callSid,
    userId,
    fromNumber: toNumber,
    toNumber: null,
    handlingMode: 'sms_links',
  });

  const template =
    linkType === 'booking_link'
      ? businessProfile.sms_booking_template
      : businessProfile.sms_quote_template;

  const fallback =
    linkType === 'booking_link' ? defaultBookingTemplate : defaultQuoteTemplate;

  const businessName = businessProfile.business_name || 'us';
  const renderedBody =
    renderTemplate(template, { businessName, url: linkUrl }) ||
    fallback(businessName, linkUrl);
  const messageBody = fallbackApology
    ? FALLBACK_APOLOGY_PREFIX + renderedBody
    : renderedBody;

  const fromNumber = await resolveFromNumber(userId);
  if (!fromNumber) {
    await logCallEvent({
      callId,
      userId,
      eventType: 'sms_sent',
      eventData: {
        success: false,
        error: 'no_sender_number',
        link_type: linkType,
        to: toNumber,
      },
    });
    return { success: false, error: 'No Twilio sender number configured' };
  }

  try {
    console.log(`[SMS] Sending ${linkType} to ${toNumber} from ${fromNumber}`);
    const result = await twilioClient.messages.create({
      to: toNumber,
      from: fromNumber,
      body: messageBody,
    });
    const messageId = result?.sid || null;

    await logCallEvent({
      callId,
      userId,
      eventType: 'sms_sent',
      eventData: {
        success: true,
        link_type: linkType,
        to: toNumber,
        from: fromNumber,
        link: linkUrl,
        twilio_message_sid: messageId,
      },
    });

    return { success: true, messageId };
  } catch (err) {
    console.error('[SMS] Send failed:', err.message);
    const transient = TRANSIENT_STATUS_CODES.has(err.status);

    if (transient) {
      try {
        console.log('[SMS] Retrying after transient error...');
        const retry = await twilioClient.messages.create({
          to: toNumber,
          from: fromNumber,
          body: messageBody,
        });
        await logCallEvent({
          callId,
          userId,
          eventType: 'sms_sent',
          eventData: {
            success: true,
            retried: true,
            link_type: linkType,
            to: toNumber,
            link: linkUrl,
            twilio_message_sid: retry?.sid || null,
          },
        });
        return { success: true, messageId: retry?.sid, retried: true };
      } catch (retryErr) {
        console.error('[SMS] Retry failed:', retryErr.message);
      }
    }

    await logCallEvent({
      callId,
      userId,
      eventType: 'sms_sent',
      eventData: {
        success: false,
        link_type: linkType,
        to: toNumber,
        error: err.message,
        status: err.status || null,
      },
    });
    return { success: false, error: err.message };
  }
}

// Public wrappers. The trailing correlation-id arg is a Twilio CallSid.

async function sendBookingLinkSMS(toNumber, businessName, bookingUrl, userId, callSid, opts = {}) {
  const { data: profile } = await supabase
    .from('business_profiles')
    .select('business_name, sms_booking_template')
    .eq('user_id', userId)
    .maybeSingle();

  return sendLinkSMS({
    linkType: 'booking_link',
    toNumber,
    userId,
    callSid,
    businessProfile: profile || { business_name: businessName },
    linkUrl: bookingUrl,
    fallbackApology: !!opts.fallbackApology,
  });
}

async function sendQuoteLinkSMS(toNumber, businessName, quoteUrl, userId, callSid, opts = {}) {
  const { data: profile } = await supabase
    .from('business_profiles')
    .select('business_name, sms_quote_template')
    .eq('user_id', userId)
    .maybeSingle();

  return sendLinkSMS({
    linkType: 'quote_link',
    toNumber,
    userId,
    callSid,
    businessProfile: profile || { business_name: businessName },
    linkUrl: quoteUrl,
    fallbackApology: !!opts.fallbackApology,
  });
}

async function sendTestSMS(toNumber, userId, linkType = 'booking') {
  const { data: profile, error } = await supabase
    .from('business_profiles')
    .select('business_name, booking_link_url, quote_link_url, sms_booking_template, sms_quote_template')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !profile) {
    return { success: false, error: 'Business profile not found' };
  }

  const url =
    linkType === 'booking' ? profile.booking_link_url : profile.quote_link_url;
  if (!url) {
    return { success: false, error: `No ${linkType} link configured` };
  }

  return sendLinkSMS({
    linkType: linkType === 'booking' ? 'booking_link' : 'quote_link',
    toNumber,
    userId,
    callSid: `test-${Date.now()}`,
    businessProfile: profile,
    linkUrl: url,
  });
}

module.exports = {
  sendBookingLinkSMS,
  sendQuoteLinkSMS,
  sendTestSMS,
  sendLinkSMS,
};
