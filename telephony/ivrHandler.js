/**
 * IVR Handler for Mode A (SMS Link Follow-Up)
 * Generates TwiML for IVR menus and handles DTMF input
 */

const twilio = require('twilio');
const { createClient } = require('@supabase/supabase-js');
const smsLinkSender = require('./smsLinkSender');
const quoteLinkHandler = require('./quoteLinkHandler');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Generate TwiML for SMS Link Follow-Up IVR menu
 * @param {Object} businessProfile - Business profile with link configuration
 * @param {string} callSid - Twilio call SID
 * @param {string} userId - User ID for logging
 * @returns {string} TwiML XML
 */
async function generateIVRTwiML(businessProfile, callSid, userId) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  // Validate configuration
  const hasBooking = businessProfile.booking_link_enabled && businessProfile.booking_link_url;
  const hasQuote = businessProfile.quote_form_id && businessProfile.quote_form && businessProfile.quote_form.is_published;

  // If neither link is enabled, fallback to voicemail
  if (!hasBooking && !hasQuote) {
    console.warn(`[IVR] Misconfiguration for user ${userId}: No links enabled, falling back to voicemail`);

    // Log error event
    await logCallEvent(userId, callSid, 'error', {
      error_type: 'misconfiguration',
      error_message: 'No booking or quote links enabled',
      outcome: 'voicemail_fallback'
    });

    response.say({
      voice: 'Polly.Joanna'
    }, "We're unable to take your call right now. Please leave a message after the tone.");

    response.record({
      maxLength: 300,
      transcribe: true,
      transcribeCallback: `/webhook/transcription/${userId}`
    });

    return response.toString();
  }

  // Get greeting script (custom or template)
  const greetingScript = await getGreetingScript(businessProfile);

  // Build IVR menu options
  const menuOptions = buildMenuOptions(hasBooking, hasQuote);

  // Main greeting
  response.say({
    voice: 'Polly.Joanna'
  }, greetingScript);

  // Gather DTMF input
  const gather = response.gather({
    numDigits: 1,
    timeout: 5,
    action: `/ivr/handle-dtmf`,
    method: 'POST',
    actionOnEmptyResult: true
  });

  // Read menu options
  gather.say({
    voice: 'Polly.Joanna'
  }, menuOptions);

  // If no input, redirect to timeout handler
  response.redirect('/ivr/timeout');

  return response.toString();
}

/**
 * Get greeting script from custom script or template
 * @param {Object} businessProfile
 * @returns {string} Greeting script with placeholders replaced
 */
async function getGreetingScript(businessProfile) {
  const businessName = businessProfile.business_name || 'us';

  // Use custom script if set
  if (businessProfile.ivr_custom_script) {
    return replacePlaceholders(businessProfile.ivr_custom_script, businessProfile);
  }

  // Use template if set
  if (businessProfile.ivr_greeting_template) {
    const { data: template } = await supabase
      .from('ivr_templates')
      .select('script_template')
      .eq('id', businessProfile.ivr_greeting_template)
      .single();

    if (template) {
      return replacePlaceholders(template.script_template, businessProfile);
    }
  }

  // Default fallback script
  return `Thank you for calling ${businessName}. We're unable to take your call right now.`;
}

/**
 * Replace placeholders in script template
 * @param {string} template - Template with placeholders
 * @param {Object} businessProfile
 * @returns {string} Script with placeholders replaced
 */
function replacePlaceholders(template, businessProfile) {
  const businessName = businessProfile.business_name || 'us';
  const hasBooking = businessProfile.booking_link_enabled && businessProfile.booking_link_url;
  const hasQuote = businessProfile.quote_form_id && businessProfile.quote_form && businessProfile.quote_form.is_published;

  // Define placeholder replacements
  const bookingOption = hasBooking ? ' Press 1 and we\'ll text you a booking link.' : '';
  const quoteOption = hasQuote ? ` Press ${hasBooking ? '2' : '1'} and we'll text you a quick quote form.` : '';
  const voicemailOption = ` Press ${hasBooking && hasQuote ? '3' : hasBooking || hasQuote ? '2' : '1'} to leave a message.`;

  return template
    .replace(/{business_name}/g, businessName)
    .replace(/{booking_option}/g, bookingOption)
    .replace(/{quote_option}/g, quoteOption)
    .replace(/{voicemail_option}/g, voicemailOption);
}

/**
 * Build menu options text based on enabled links
 * @param {boolean} hasBooking
 * @param {boolean} hasQuote
 * @returns {string} Menu options text
 */
function buildMenuOptions(hasBooking, hasQuote) {
  const options = [];

  if (hasBooking) {
    options.push("Press 1 to receive a booking link.");
  }

  if (hasQuote) {
    const digit = hasBooking ? '2' : '1';
    options.push(`Press ${digit} to receive a quote form link.`);
  }

  // Always include voicemail option
  const voicemailDigit = hasBooking && hasQuote ? '3' : hasBooking || hasQuote ? '2' : '1';
  options.push(`Press ${voicemailDigit} to leave a message.`);

  return options.join(' ');
}

/**
 * Handle DTMF input from caller
 * @param {string} digit - Pressed digit
 * @param {string} callSid - Twilio call SID
 * @param {string} userId - User ID
 * @param {string} callerNumber - Caller's phone number
 * @returns {Object} TwiML response and action taken
 */
async function handleDTMFInput(digit, callSid, userId, callerNumber) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  // Fetch business profile
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .single();

  const { data: businessProfile } = await supabase
    .from('business_profiles')
    .select('*, quote_form:business_quote_forms!quote_form_id(*)')
    .eq('user_id', userId)
    .single();

  if (!businessProfile) {
    console.error(`[IVR] No business profile found for user ${userId}`);
    response.say({ voice: 'Polly.Joanna' }, 'We\'re sorry, there was an error processing your request. Please try calling back.');
    response.hangup();
    return { twiml: response.toString(), action: 'error' };
  }

  const hasBooking = businessProfile.booking_link_enabled && businessProfile.booking_link_url;
  const hasQuote = businessProfile.quote_form_id && businessProfile.quote_form && businessProfile.quote_form.is_published;

  // Determine action based on digit pressed
  let action = 'invalid';
  let confirmationMessage = '';

  // Check if caller number is available
  const callerAvailable = callerNumber && callerNumber !== 'anonymous' && callerNumber !== '+266696687';

  if (digit === '1') {
    if (hasBooking) {
      action = 'booking_link';
      if (callerAvailable) {
        // Send booking link SMS immediately
        await smsLinkSender.sendBookingLinkSMS(
          callerNumber,
          businessProfile.business_name,
          businessProfile.booking_link_url,
          userId,
          callSid
        );
        confirmationMessage = "Thanks! We've just texted you a booking link. You can book into our calendar now.";
      } else {
        confirmationMessage = `We couldn't text you because your number is blocked. Please visit ${getShortUrl(businessProfile.booking_link_url)} to book.`;
      }
    } else if (hasQuote) {
      action = 'quote_link';
      if (callerAvailable) {
        const twilioNumber = businessProfile.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER;
        await quoteLinkHandler.sendQuoteLinkSMS(
          callerNumber,
          twilioNumber,
          userId,
          callSid
        );
        confirmationMessage = "Thanks! We've just texted you a quote link. Please add details and photos and we'll get back to you shortly.";
      } else {
        const quoteDomain = process.env.QUOTE_DOMAIN || 'flynnai.app';
        const quoteSlug = businessProfile.quote_form?.slug || 'quote';
        confirmationMessage = `We couldn't text you because your number is blocked. Please visit ${quoteDomain}/${quoteSlug} for a quote.`;
      }
    } else {
      // Voicemail if neither link is enabled
      action = 'voicemail';
      return handleVoicemail(response, userId);
    }
  } else if (digit === '2') {
    if (hasBooking && hasQuote) {
      action = 'quote_link';
      if (callerAvailable) {
        const twilioNumber = businessProfile.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER;
        await quoteLinkHandler.sendQuoteLinkSMS(
          callerNumber,
          twilioNumber,
          userId,
          callSid
        );
        confirmationMessage = "Thanks! We've just texted you a quote link. Please add details and photos and we'll get back to you shortly.";
      } else {
        const quoteDomain = process.env.QUOTE_DOMAIN || 'flynnai.app';
        const quoteSlug = businessProfile.quote_form?.slug || 'quote';
        confirmationMessage = `We couldn't text you because your number is blocked. Please visit ${quoteDomain}/${quoteSlug} for a quote.`;
      }
    } else if (hasBooking || hasQuote) {
      // Voicemail is option 2
      action = 'voicemail';
      return handleVoicemail(response, userId);
    } else {
      action = 'invalid';
    }
  } else if (digit === '3') {
    if (hasBooking && hasQuote) {
      // Voicemail is option 3
      action = 'voicemail';
      return handleVoicemail(response, userId);
    } else {
      action = 'invalid';
    }
  } else {
    action = 'invalid';
  }

  // Log DTMF event
  await logCallEvent(userId, callSid, 'dtmf_pressed', {
    dtmf_pressed: digit,
    dtmf_action: action,
    caller_number: callerNumber,
    caller_number_available: callerAvailable
  });

  if (action === 'invalid') {
    // Invalid input - give one more try
    response.say({ voice: 'Polly.Joanna' }, 'Sorry, that\'s not a valid option.');
    response.redirect('/ivr/voice');
    return { twiml: response.toString(), action: 'retry' };
  }

  // Play confirmation and end call
  response.say({ voice: 'Polly.Joanna' }, confirmationMessage);
  response.hangup();

  return { twiml: response.toString(), action };
}

/**
 * Handle voicemail recording
 * @param {Object} response - Twilio VoiceResponse object
 * @param {string} userId - User ID
 * @returns {Object} TwiML response
 */
function handleVoicemail(response, userId) {
  response.say({ voice: 'Polly.Joanna' }, 'Please leave your message after the tone. Press any key when finished.');

  response.record({
    maxLength: 300,
    transcribe: true,
    transcribeCallback: `/webhook/transcription/${userId}`,
    finishOnKey: '#'
  });

  response.say({ voice: 'Polly.Joanna' }, 'Thank you for your message. We\'ll get back to you soon. Goodbye.');

  return { twiml: response.toString(), action: 'voicemail' };
}

/**
 * Handle IVR timeout (caller pressed nothing)
 * @param {string} callSid - Twilio call SID
 * @param {string} userId - User ID
 * @returns {string} TwiML response
 */
async function handleIVRTimeout(callSid, userId) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  // Log timeout event
  await logCallEvent(userId, callSid, 'ivr_timeout', {
    outcome: 'call_abandoned'
  });

  response.say({ voice: 'Polly.Joanna' }, 'We didn\'t receive a response. Please call back when you\'re ready. Goodbye.');
  response.hangup();

  return response.toString();
}

/**
 * Get shortened URL for voice readability
 * @param {string} url - Full URL
 * @returns {string} Shortened or simplified URL
 */
function getShortUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname + urlObj.pathname;
  } catch {
    return url;
  }
}

/**
 * Log call event to database
 * @param {string} userId
 * @param {string} callSid
 * @param {string} eventType
 * @param {Object} metadata
 */
async function logCallEvent(userId, callSid, eventType, metadata = {}) {
  try {
    await supabase.rpc('log_call_event', {
      p_user_id: userId,
      p_call_sid: callSid,
      p_event_type: eventType,
      p_mode: 'sms_links',
      p_dtmf_pressed: metadata.dtmf_pressed || null,
      p_dtmf_action: metadata.dtmf_action || null,
      p_sms_sent: metadata.sms_sent || false,
      p_sms_type: metadata.sms_type || null,
      p_sms_to_number: metadata.sms_to_number || null,
      p_sms_status: metadata.sms_status || null,
      p_caller_number: metadata.caller_number || null,
      p_outcome: metadata.outcome || null,
      p_metadata: metadata.metadata || null
    });
  } catch (error) {
    console.error('[IVR] Failed to log call event:', error.message);
  }
}

module.exports = {
  generateIVRTwiML,
  handleDTMFInput,
  handleIVRTimeout,
  getGreetingScript,
  buildMenuOptions
};
