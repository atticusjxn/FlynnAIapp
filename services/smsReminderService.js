// SMS Reminder Service using Twilio
// Sends booking confirmations and reminders via SMS

const twilio = require('twilio');

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioMessagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
const twilioSmsFromNumber = process.env.TWILIO_SMS_FROM_NUMBER || process.env.TWILIO_FROM_NUMBER;

let twilioClient;
if (twilioAccountSid && twilioAuthToken) {
  twilioClient = twilio(twilioAccountSid, twilioAuthToken);
}

/**
 * Send booking confirmation SMS to customer
 */
async function sendConfirmationSMS(booking, businessName) {
  if (!twilioClient) {
    console.warn('[SMS] Twilio not configured, skipping SMS');
    return null;
  }

  const startDate = new Date(booking.start_time);
  const message = formatConfirmationMessage(booking, businessName, startDate);

  return await sendSMS(booking.customer_phone, message, booking.org_id);
}

/**
 * Send reminder SMS to customer
 */
async function sendReminderSMS(booking, businessName, hoursUntil) {
  if (!twilioClient) {
    console.warn('[SMS] Twilio not configured, skipping SMS');
    return null;
  }

  const startDate = new Date(booking.start_time);
  const message = formatReminderMessage(booking, businessName, startDate, hoursUntil);

  return await sendSMS(booking.customer_phone, message, booking.org_id);
}

/**
 * Internal: Send SMS via Twilio.
 *
 * `orgId` picks the sender. These go to the business's own customer, so they
 * must come from that business's Flynn number — a confirmation the customer
 * can reply to is how the number gets into their phone, and a reply to a
 * shared platform number can't be attributed back to an org. See
 * services/orgSmsSender.js.
 */
async function sendSMS(to, body, orgId = null) {
  try {
    const messageOptions = {
      to,
      body,
    };

    const { resolveSenderNumber } = require('./orgSmsSender');
    const from = await resolveSenderNumber({ orgId });

    if (from) {
      messageOptions.from = from;
    } else if (twilioMessagingServiceSid) {
      messageOptions.messagingServiceSid = twilioMessagingServiceSid;
    } else if (twilioSmsFromNumber) {
      messageOptions.from = twilioSmsFromNumber;
    } else {
      throw new Error('No Twilio messaging service or from number configured');
    }

    const message = await twilioClient.messages.create(messageOptions);
    console.log('[SMS] Message sent:', message.sid);

    // Seeding half of the number metric (services/smsSeeding.js).
    require('./smsSeeding')
      .recordClientSend({ to, body, fromNumber: messageOptions.from, orgId })
      .catch(() => {});

    return message.sid;
  } catch (error) {
    console.error('[SMS] Failed to send message:', error);
    return null;
  }
}

// Message Formatters

function formatConfirmationMessage(booking, businessName, startDate) {
  const dateStr = formatDate(startDate);
  const timeStr = formatTime(startDate);
  const confirmationCode = booking.id.substring(0, 8).toUpperCase();

  return `✅ Appointment Confirmed!

${businessName}
${dateStr} at ${timeStr}

Confirmation: ${confirmationCode}

You'll receive a reminder before your appointment.

Reply STOP to unsubscribe.`;
}

function formatReminderMessage(booking, businessName, startDate, hoursUntil) {
  const dateStr = formatDate(startDate);
  const timeStr = formatTime(startDate);
  const timeUntil = hoursUntil === 24 ? 'Tomorrow' : 'In 1 Hour';

  return `⏰ Appointment Reminder - ${timeUntil}

${businessName}
${dateStr} at ${timeStr}

${booking.customer_name}, see you soon!

Need to reschedule? Contact ${businessName} directly.`;
}

// Helper functions

function formatDate(date) {
  const options = { weekday: 'short', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

module.exports = {
  sendConfirmationSMS,
  sendReminderSMS,
};
