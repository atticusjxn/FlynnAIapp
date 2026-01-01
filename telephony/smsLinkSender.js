/**
 * SMS Link Sender for Mode A (SMS Link Follow-Up)
 * Sends booking and quote links immediately during calls
 */

const twilio = require('twilio');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Send booking link SMS to caller
 * @param {string} toNumber - Caller's phone number
 * @param {string} businessName - Business name
 * @param {string} bookingUrl - Booking page URL
 * @param {string} userId - User ID for logging
 * @param {string} callSid - Twilio call SID
 * @returns {Promise<Object>} SMS result
 */
async function sendBookingLinkSMS(toNumber, businessName, bookingUrl, userId, callSid) {
  try {
    // Get business Twilio phone number (sender)
    const { data: user } = await supabase
      .from('users')
      .select('twilio_phone_number, phone')
      .eq('id', userId)
      .single();

    const fromNumber = user?.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER;

    // Construct SMS message
    const message = `Hi, this is ${businessName}. Book your appointment here: ${bookingUrl}\n\nReply STOP to opt out.`;

    console.log(`[SMS] Sending booking link to ${toNumber} from ${fromNumber}`);

    // Send SMS via Twilio
    const smsResult = await twilioClient.messages.create({
      body: message,
      from: fromNumber,
      to: toNumber
    });

    console.log(`[SMS] Booking link sent successfully. SID: ${smsResult.sid}`);

    // Log successful SMS event
    await logSMSEvent(userId, callSid, {
      sms_sent: true,
      sms_type: 'booking_link',
      sms_to_number: toNumber,
      sms_status: 'sent',
      outcome: 'link_sent',
      link_sent: bookingUrl,
      metadata: {
        twilio_sms_sid: smsResult.sid,
        from_number: fromNumber
      }
    });

    return {
      success: true,
      sid: smsResult.sid,
      message: 'Booking link sent'
    };

  } catch (error) {
    console.error('[SMS] Failed to send booking link:', error.message);

    // Log failed SMS event
    await logSMSEvent(userId, callSid, {
      sms_sent: false,
      sms_type: 'booking_link',
      sms_to_number: toNumber,
      sms_status: 'failed',
      sms_error: error.message,
      outcome: 'error',
      error_type: 'sms_send_failure',
      error_message: error.message
    });

    // Retry once on transient errors
    if (isTransientError(error)) {
      console.log('[SMS] Retrying booking link send...');
      try {
        const retryResult = await twilioClient.messages.create({
          body: message,
          from: fromNumber,
          to: toNumber
        });

        await logSMSEvent(userId, callSid, {
          sms_sent: true,
          sms_type: 'booking_link',
          sms_to_number: toNumber,
          sms_status: 'sent',
          outcome: 'link_sent',
          link_sent: bookingUrl,
          metadata: {
            twilio_sms_sid: retryResult.sid,
            retry: true
          }
        });

        return {
          success: true,
          sid: retryResult.sid,
          message: 'Booking link sent (retry)'
        };
      } catch (retryError) {
        console.error('[SMS] Retry failed:', retryError.message);
      }
    }

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send quote link SMS to caller
 * @param {string} toNumber - Caller's phone number
 * @param {string} businessName - Business name
 * @param {string} quoteUrl - Quote intake form URL
 * @param {string} userId - User ID for logging
 * @param {string} callSid - Twilio call SID
 * @returns {Promise<Object>} SMS result
 */
async function sendQuoteLinkSMS(toNumber, businessName, quoteUrl, userId, callSid) {
  try {
    // Get business Twilio phone number (sender)
    const { data: user } = await supabase
      .from('users')
      .select('twilio_phone_number, phone')
      .eq('id', userId)
      .single();

    const fromNumber = user?.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER;

    // Construct SMS message
    const message = `Hi, this is ${businessName}. Share your project details and photos here: ${quoteUrl}\n\nWe'll get back to you shortly. Reply STOP to opt out.`;

    console.log(`[SMS] Sending quote link to ${toNumber} from ${fromNumber}`);

    // Send SMS via Twilio
    const smsResult = await twilioClient.messages.create({
      body: message,
      from: fromNumber,
      to: toNumber
    });

    console.log(`[SMS] Quote link sent successfully. SID: ${smsResult.sid}`);

    // Log successful SMS event
    await logSMSEvent(userId, callSid, {
      sms_sent: true,
      sms_type: 'quote_link',
      sms_to_number: toNumber,
      sms_status: 'sent',
      outcome: 'link_sent',
      link_sent: quoteUrl,
      metadata: {
        twilio_sms_sid: smsResult.sid,
        from_number: fromNumber
      }
    });

    return {
      success: true,
      sid: smsResult.sid,
      message: 'Quote link sent'
    };

  } catch (error) {
    console.error('[SMS] Failed to send quote link:', error.message);

    // Log failed SMS event
    await logSMSEvent(userId, callSid, {
      sms_sent: false,
      sms_type: 'quote_link',
      sms_to_number: toNumber,
      sms_status: 'failed',
      sms_error: error.message,
      outcome: 'error',
      error_type: 'sms_send_failure',
      error_message: error.message
    });

    // Retry once on transient errors
    if (isTransientError(error)) {
      console.log('[SMS] Retrying quote link send...');
      try {
        const retryResult = await twilioClient.messages.create({
          body: message,
          from: fromNumber,
          to: toNumber
        });

        await logSMSEvent(userId, callSid, {
          sms_sent: true,
          sms_type: 'quote_link',
          sms_to_number: toNumber,
          sms_status: 'sent',
          outcome: 'link_sent',
          link_sent: quoteUrl,
          metadata: {
            twilio_sms_sid: retryResult.sid,
            retry: true
          }
        });

        return {
          success: true,
          sid: retryResult.sid,
          message: 'Quote link sent (retry)'
        };
      } catch (retryError) {
        console.error('[SMS] Retry failed:', retryError.message);
      }
    }

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check if error is transient and should be retried
 * @param {Error} error - Twilio error
 * @returns {boolean} True if error is transient
 */
function isTransientError(error) {
  const transientCodes = [
    20429, // Too many requests (rate limit)
    21610, // Message blocked (temporary)
    30001, // Queue overflow
    30002, // Account suspended (temporary)
    30003, // Unreachable destination (temporary)
    30004, // Message blocked (carrier)
    30005, // Unknown destination
    30006, // Landline or unreachable carrier
  ];

  return error.code && transientCodes.includes(error.code);
}

/**
 * Log SMS event to call_events table
 * @param {string} userId
 * @param {string} callSid
 * @param {Object} metadata
 */
async function logSMSEvent(userId, callSid, metadata = {}) {
  try {
    await supabase.rpc('log_call_event', {
      p_user_id: userId,
      p_call_sid: callSid,
      p_event_type: 'sms_sent',
      p_mode: 'sms_links',
      p_sms_sent: metadata.sms_sent || false,
      p_sms_type: metadata.sms_type || null,
      p_sms_to_number: metadata.sms_to_number || null,
      p_sms_status: metadata.sms_status || null,
      p_outcome: metadata.outcome || null,
      p_metadata: {
        ...metadata.metadata,
        link_sent: metadata.link_sent,
        error_type: metadata.error_type,
        error_message: metadata.error_message,
        sms_error: metadata.sms_error
      }
    });
  } catch (error) {
    console.error('[SMS] Failed to log SMS event:', error.message);
  }
}

/**
 * Send test SMS to verify configuration
 * @param {string} toNumber - Test phone number
 * @param {string} userId - User ID
 * @param {string} linkType - 'booking' or 'quote'
 * @returns {Promise<Object>} Test result
 */
async function sendTestSMS(toNumber, userId, linkType = 'booking') {
  try {
    const { data: businessProfile } = await supabase
      .from('business_profiles')
      .select('business_name, booking_link_url, quote_link_url')
      .eq('user_id', userId)
      .single();

    if (!businessProfile) {
      return { success: false, error: 'Business profile not found' };
    }

    if (linkType === 'booking') {
      return await sendBookingLinkSMS(
        toNumber,
        businessProfile.business_name,
        businessProfile.booking_link_url,
        userId,
        'test-call-sid'
      );
    } else {
      return await sendQuoteLinkSMS(
        toNumber,
        businessProfile.business_name,
        businessProfile.quote_link_url,
        userId,
        'test-call-sid'
      );
    }
  } catch (error) {
    console.error('[SMS] Test SMS failed:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendBookingLinkSMS,
  sendQuoteLinkSMS,
  sendTestSMS
};
