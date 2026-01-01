/**
 * Quote Link Handler
 *
 * Handles sending quote links via SMS during IVR calls.
 * Integrates with existing IVR system and SMS sender.
 */

const { supabase } = require('./supabaseClient');
const twilio = require('twilio');

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Send quote link SMS to caller
 *
 * @param {string} toNumber - Recipient phone number
 * @param {string} fromNumber - Business Twilio number
 * @param {string} userId - User/org ID
 * @param {string} callSid - Twilio call SID
 * @returns {Promise<object>} - Twilio message object
 */
async function sendQuoteLinkSMS(toNumber, fromNumber, userId, callSid = null) {
  try {
    // Get user's business profile and quote form
    const { data: profile, error: profileError } = await supabase
      .from('business_profiles')
      .select('*, quote_form:business_quote_forms!quote_form_id(*)')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching business profile:', profileError);
      throw new Error('Business profile not found');
    }

    // Check if quote form exists and is published
    if (!profile.quote_form || !profile.quote_form.is_published) {
      console.error('No published quote form found for user:', userId);
      throw new Error('Quote form not configured');
    }

    const quoteForm = profile.quote_form;
    const businessName = profile.business_name || 'Us';

    // Generate quote link URL
    const quoteDomain = process.env.QUOTE_DOMAIN || 'flynnai.app';
    const quoteUrl = `https://${quoteDomain}/quote/${quoteForm.slug}`;

    // Create SMS message
    const message = `Hi, this is ${businessName}. Share your project details and photos here: ${quoteUrl}\n\nReply STOP to opt out.`;

    // Send SMS via Twilio
    const twilioMessage = await twilioClient.messages.create({
      body: message,
      from: fromNumber,
      to: toNumber,
    });

    console.log(`Quote link SMS sent to ${toNumber}:`, twilioMessage.sid);

    // Log event to database
    await logQuoteLinkEvent({
      userId,
      callSid,
      toNumber,
      quoteFormId: quoteForm.id,
      messageSid: twilioMessage.sid,
      status: 'sent',
    });

    // Track analytics event
    await supabase.from('quote_link_events').insert({
      form_id: quoteForm.id,
      org_id: profile.org_id,
      event_type: 'link_opened',
      event_data: {
        source: 'sms',
        call_sid: callSid,
        sent_to: toNumber,
      },
    });

    return {
      success: true,
      messageSid: twilioMessage.sid,
      quoteUrl,
    };
  } catch (error) {
    console.error('Error sending quote link SMS:', error);

    // Log failed event
    if (userId && callSid) {
      await logQuoteLinkEvent({
        userId,
        callSid,
        toNumber,
        status: 'failed',
        error: error.message,
      });
    }

    throw error;
  }
}

/**
 * Log quote link SMS event
 */
async function logQuoteLinkEvent(eventData) {
  try {
    await supabase.from('call_events').insert({
      user_id: eventData.userId,
      call_sid: eventData.callSid,
      event_type: 'quote_link_sent',
      event_data: {
        to_number: eventData.toNumber,
        quote_form_id: eventData.quoteFormId,
        message_sid: eventData.messageSid,
        status: eventData.status,
        error: eventData.error,
      },
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error logging quote link event:', error);
  }
}

/**
 * Get quote link for a user (for manual sharing)
 *
 * @param {string} userId - User/org ID
 * @returns {Promise<object>} - Quote form details and link
 */
async function getQuoteLink(userId) {
  try {
    const { data: profile, error } = await supabase
      .from('business_profiles')
      .select('*, quote_form:business_quote_forms!quote_form_id(*)')
      .eq('user_id', userId)
      .single();

    if (error || !profile || !profile.quote_form) {
      throw new Error('Quote form not found');
    }

    const quoteForm = profile.quote_form;
    const quoteDomain = process.env.QUOTE_DOMAIN || 'flynnai.app';
    const quoteUrl = `https://${quoteDomain}/quote/${quoteForm.slug}`;

    return {
      success: true,
      quoteForm: {
        id: quoteForm.id,
        title: quoteForm.title,
        slug: quoteForm.slug,
        is_published: quoteForm.is_published,
      },
      quoteUrl,
      smsMessage: `Hi, this is ${profile.business_name}. Share your project details and photos here: ${quoteUrl}\n\nReply STOP to opt out.`,
    };
  } catch (error) {
    console.error('Error getting quote link:', error);
    throw error;
  }
}

/**
 * Check if user has quote link configured
 *
 * @param {string} userId - User/org ID
 * @returns {Promise<boolean>}
 */
async function hasQuoteLinkConfigured(userId) {
  try {
    const { data: profile, error } = await supabase
      .from('business_profiles')
      .select('quote_form_id, quote_form:business_quote_forms!quote_form_id(is_published)')
      .eq('user_id', userId)
      .single();

    if (error || !profile || !profile.quote_form_id) {
      return false;
    }

    return profile.quote_form && profile.quote_form.is_published;
  } catch (error) {
    console.error('Error checking quote link configuration:', error);
    return false;
  }
}

/**
 * Update IVR menu to include quote link option
 * Integrates with existing ivrHandler.js
 *
 * @param {object} businessProfile - Business profile with quote link
 * @returns {string} - TwiML menu options text
 */
function generateQuoteLinkMenuOption(businessProfile) {
  const hasBookingLink = businessProfile.booking_link_enabled && businessProfile.booking_link_url;
  const hasQuoteLink =
    businessProfile.quote_form_id &&
    businessProfile.quote_form &&
    businessProfile.quote_form.is_published;

  if (!hasBookingLink && !hasQuoteLink) {
    return 'Press 1 to leave a message.';
  }

  let menuText = '';
  let optionNumber = 1;

  if (hasBookingLink) {
    menuText += `Press ${optionNumber} to receive a booking link. `;
    optionNumber++;
  }

  if (hasQuoteLink) {
    menuText += `Press ${optionNumber} to receive a quote form link. `;
    optionNumber++;
  }

  menuText += `Press ${optionNumber} to leave a voicemail.`;

  return menuText;
}

/**
 * Handle DTMF input for quote link option
 * Called from IVR handler when caller presses digit
 *
 * @param {string} digit - Pressed digit
 * @param {string} userId - User/org ID
 * @param {string} callSid - Twilio call SID
 * @param {string} callerNumber - Caller's phone number
 * @param {string} twilioNumber - Business Twilio number
 * @returns {Promise<string>} - TwiML response
 */
async function handleQuoteLinkDTMF(digit, userId, callSid, callerNumber, twilioNumber) {
  try {
    // Get business profile to determine menu layout
    const { data: profile, error } = await supabase
      .from('business_profiles')
      .select('*, quote_form:business_quote_forms!quote_form_id(*)')
      .eq('user_id', userId)
      .single();

    if (error || !profile) {
      throw new Error('Business profile not found');
    }

    const hasBookingLink = profile.booking_link_enabled && profile.booking_link_url;
    const hasQuoteLink =
      profile.quote_form_id && profile.quote_form && profile.quote_form.is_published;

    // Determine which digit corresponds to quote link
    let quoteDigit = null;
    if (hasBookingLink && hasQuoteLink) {
      quoteDigit = '2'; // Booking is 1, Quote is 2
    } else if (!hasBookingLink && hasQuoteLink) {
      quoteDigit = '1'; // Quote is 1
    }

    // Check if pressed digit is for quote link
    if (digit === quoteDigit) {
      await sendQuoteLinkSMS(callerNumber, twilioNumber, userId, callSid);

      // Return TwiML response
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say(
        {
          voice: 'Polly.Amy',
          language: 'en-US',
        },
        "Thanks! We've just sent you a text message with a link to our quote form. Check your phone and fill it out when you're ready. We'll respond with your quote shortly. Have a great day!"
      );
      twiml.hangup();

      return twiml.toString();
    }

    return null; // Not a quote link digit, let other handlers process it
  } catch (error) {
    console.error('Error handling quote link DTMF:', error);

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say(
      {
        voice: 'Polly.Amy',
        language: 'en-US',
      },
      "Sorry, we couldn't send the link right now. Please try calling back or visit our website. Goodbye!"
    );
    twiml.hangup();

    return twiml.toString();
  }
}

module.exports = {
  sendQuoteLinkSMS,
  getQuoteLink,
  hasQuoteLinkConfigured,
  generateQuoteLinkMenuOption,
  handleQuoteLinkDTMF,
};
