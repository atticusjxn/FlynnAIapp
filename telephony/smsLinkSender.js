/**
 * SMS Link Sender — Mode A (SMS Link Follow-Up).
 *
 * Sends booking and quote links via Telnyx Messaging API (v2 /messages).
 * Aligned to the new Supabase schema:
 *   business_profiles.{booking_link_url, booking_link_enabled,
 *                      quote_link_url, quote_link_enabled,
 *                      sms_booking_template, sms_quote_template,
 *                      business_name}
 *   users.telnyx_phone_number (falls back to env TELNYX_PHONE_NUMBER)
 *
 * Event logging writes directly to `call_events` via costTracker.logCallEvent;
 * there's no more `log_call_event` RPC.
 */

const { supabase } = require('./supabaseClient');
const telnyx = require('./telnyxClient');
const { ensureCallRow, logCallEvent } = require('./costTracker');

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
    .select('telnyx_phone_number')
    .eq('id', userId)
    .maybeSingle();
  return user?.telnyx_phone_number || process.env.TELNYX_PHONE_NUMBER || null;
}

const FALLBACK_APOLOGY_PREFIX = "Sorry we just missed you — ";

async function sendLinkSMS({
  linkType,              // 'booking_link' | 'quote_link'
  toNumber,
  userId,
  telnyxCallControlId,   // required for event correlation
  businessProfile,       // { business_name, sms_booking_template, sms_quote_template, ... }
  linkUrl,
  fallbackApology = false,
}) {
  const callId = await ensureCallRow({
    telnyxCallControlId,
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
    return { success: false, error: 'No Telnyx sender number configured' };
  }

  try {
    console.log(`[SMS] Sending ${linkType} to ${toNumber} from ${fromNumber}`);
    const result = await telnyx.sendSMS({
      to: toNumber,
      from: fromNumber,
      text: messageBody,
    });
    const messageId = result?.data?.id || null;

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
        telnyx_message_id: messageId,
      },
    });

    return { success: true, messageId };
  } catch (err) {
    console.error('[SMS] Send failed:', err.message);
    const transient = TRANSIENT_STATUS_CODES.has(err.status);

    if (transient) {
      try {
        console.log('[SMS] Retrying after transient error...');
        const retry = await telnyx.sendSMS({
          to: toNumber,
          from: fromNumber,
          text: messageBody,
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
            telnyx_message_id: retry?.data?.id || null,
          },
        });
        return { success: true, messageId: retry?.data?.id, retried: true };
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

// Public wrappers kept API-compatible with the old Twilio version so the rest
// of the codebase can swap without churn.

async function sendBookingLinkSMS(toNumber, businessName, bookingUrl, userId, telnyxCallControlId, opts = {}) {
  const { data: profile } = await supabase
    .from('business_profiles')
    .select('business_name, sms_booking_template')
    .eq('user_id', userId)
    .maybeSingle();

  return sendLinkSMS({
    linkType: 'booking_link',
    toNumber,
    userId,
    telnyxCallControlId,
    businessProfile: profile || { business_name: businessName },
    linkUrl: bookingUrl,
    fallbackApology: !!opts.fallbackApology,
  });
}

async function sendQuoteLinkSMS(toNumber, businessName, quoteUrl, userId, telnyxCallControlId, opts = {}) {
  const { data: profile } = await supabase
    .from('business_profiles')
    .select('business_name, sms_quote_template')
    .eq('user_id', userId)
    .maybeSingle();

  return sendLinkSMS({
    linkType: 'quote_link',
    toNumber,
    userId,
    telnyxCallControlId,
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
    telnyxCallControlId: `test-${Date.now()}`,
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
