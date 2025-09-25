const express = require('express');
const twilio = require('twilio');
const dotenv = require('dotenv');

dotenv.config();

if (process.env.SERVER_PUBLIC_URL) {
  console.log('[Telephony] SERVER_PUBLIC_URL configured:', process.env.SERVER_PUBLIC_URL);
} else {
  console.log('[Telephony] SERVER_PUBLIC_URL not set; recording callback URLs will mirror the incoming request host.');
}

const app = express();
const port = process.env.PORT || 3000;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const shouldValidateSignature = process.env.TWILIO_VALIDATE_SIGNATURE !== 'false';

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const buildRecordingCallbackUrl = (req) => {
  const callbackPath = '/telephony/recording-complete';
  const baseUrl = process.env.SERVER_PUBLIC_URL ? process.env.SERVER_PUBLIC_URL.trim() : undefined;

  if (baseUrl) {
    try {
      const callbackUrl = new URL(callbackPath, baseUrl).toString();
      return callbackUrl;
    } catch (error) {
      console.warn('[Telephony] Failed to build recording callback URL from SERVER_PUBLIC_URL:', error);
    }
  }

  const fallbackUrl = `${req.protocol}://${req.get('host')}${callbackPath}`;
  return fallbackUrl;
};

app.post('/telephony/inbound-voice', (req, res) => {
  console.log('[Telephony] Inbound voice webhook request received.');

  if (shouldValidateSignature && twilioAuthToken) {
    const signature = req.headers['x-twilio-signature'];
    if (!signature) {
      console.warn('[Telephony] Missing X-Twilio-Signature header on inbound request.');
      return res.status(403).send('Twilio signature missing');
    }

    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const isValid = twilio.validateRequest(twilioAuthToken, signature, url, req.body);

    if (!isValid) {
      console.warn('[Telephony] Twilio signature validation failed for inbound voice webhook.', {
        url,
        signature,
      });
      return res.status(403).send('Twilio signature validation failed');
    }
  } else if (!twilioAuthToken) {
    console.warn('[Telephony] TWILIO_AUTH_TOKEN is not set; skipping signature validation.');
  } else {
    console.warn('[Telephony] Twilio signature validation disabled via TWILIO_VALIDATE_SIGNATURE=false.');
  }

  console.log('[Telephony] Request body:', req.body);

  const response = new twilio.twiml.VoiceResponse();
  response.say('Hi, you\'ve reached FlynnAI. Please leave a message after the tone.');
  response.record({
    action: buildRecordingCallbackUrl(req),
    method: 'POST',
    playBeep: true,
  });

  res.type('text/xml');
  res.send(response.toString());
});

app.listen(port, () => {
  console.log(`FlynnAI telephony server listening on port ${port}`);
});
