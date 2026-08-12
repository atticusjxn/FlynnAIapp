/**
 * Twilio SMS sender for the reminder / chase path.
 *
 * `services/reminderScheduler.js` has always lazy-required this module from
 * `sendReminder()` and `sendOnTheWayNotification()`, but the file was never
 * written — so every scheduled reminder threw MODULE_NOT_FOUND, burned its
 * three retries and landed in `scheduled_reminders` as `failed`. The scheduler
 * runs on the 60s ticker in server.js, so this was failing silently in prod.
 *
 * Contract the scheduler depends on:
 *   - takes an object, not positional args: { to, body, from }
 *   - resolves to an object carrying `.sid` (written to `scheduled_reminders.
 *     twilio_sid` and `reminder_history.twilio_sid`)
 *   - THROWS on failure. The caller's catch block owns the retry/backoff ladder
 *     and the failure row, so swallowing the error here would mark unsent
 *     reminders as sent.
 *
 * Sender resolution: explicit `from` wins (the job's own Flynn number), then
 * TWILIO_MESSAGING_SERVICE_SID, then TWILIO_FROM_NUMBER.
 */

const twilio = require('twilio');

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Same transient classes smsLinkSender retries on.
const TRANSIENT_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

function buildOptions({ to, body, from }) {
  if (!to) throw new Error('sendSMS: `to` is required');
  if (!body) throw new Error('sendSMS: `body` is required');

  const options = { to, body };

  if (from) {
    options.from = from;
  } else if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
    options.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  } else if (process.env.TWILIO_FROM_NUMBER) {
    options.from = process.env.TWILIO_FROM_NUMBER;
  } else {
    throw new Error('sendSMS: no `from` number or messaging service configured');
  }

  return options;
}

/**
 * Send one SMS. Resolves to the Twilio message resource (`.sid` is what
 * callers persist); throws on failure after one retry on transient errors.
 */
async function sendSMS({ to, body, from }) {
  const options = buildOptions({ to, body, from });

  try {
    const message = await twilioClient.messages.create(options);
    console.log(`[TwilioService] Sent ${message.sid} to ${to}`);
    return message;
  } catch (err) {
    if (!TRANSIENT_STATUS_CODES.has(err.status)) {
      console.error(`[TwilioService] Send to ${to} failed:`, err.message);
      throw err;
    }

    console.warn(`[TwilioService] Transient ${err.status} sending to ${to}, retrying once`);
    const message = await twilioClient.messages.create(options);
    console.log(`[TwilioService] Sent ${message.sid} to ${to} on retry`);
    return message;
  }
}

module.exports = { sendSMS };
