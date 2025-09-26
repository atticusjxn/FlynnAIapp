const express = require('express');
const twilio = require('twilio');
const dotenv = require('dotenv');
const { randomUUID } = require('crypto');
const OpenAI = require('openai');
const { toFile } = require('openai');

const {
  upsertCallRecord,
  getTranscriptByCallSid,
  insertTranscription,
  updateCallTranscriptionStatus,
} = require('./supabaseMcpClient');

dotenv.config();

if (process.env.SERVER_PUBLIC_URL) {
  console.log('[Telephony] SERVER_PUBLIC_URL configured:', process.env.SERVER_PUBLIC_URL);
} else {
  console.log('[Telephony] SERVER_PUBLIC_URL not set; recording callback URLs will mirror the incoming request host.');
}

const app = express();
const port = process.env.PORT || 3000;
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const shouldValidateSignature = process.env.TWILIO_VALIDATE_SIGNATURE !== 'false';
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!twilioAccountSid || !twilioAuthToken) {
  console.warn('[Telephony] Twilio credentials are incomplete; recording downloads will fail until configured.');
}

if (!openaiApiKey) {
  console.warn('[Telephony] OPENAI_API_KEY is not configured; transcription will fail until set.');
}

const openaiClient = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

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

const isAudioResponse = (response, url) => {
  if (!response) {
    return false;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.toLowerCase().startsWith('audio/')) {
    return true;
  }

  return /\.(mp3|wav)(\?|$)/i.test(url);
};

const downloadTwilioRecording = async (recordingUrl) => {
  if (!recordingUrl) {
    throw new Error('RecordingUrl is required to download audio.');
  }

  if (!twilioAccountSid || !twilioAuthToken) {
    throw new Error('Twilio credentials are not configured.');
  }

  const authHeader = `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64')}`;
  const candidateUrls = [recordingUrl];

  if (!/\.(mp3|wav)(\?|$)/i.test(recordingUrl)) {
    candidateUrls.push(`${recordingUrl}.mp3`);
    candidateUrls.push(`${recordingUrl}.wav`);
  }

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: authHeader,
        },
      });

      if (response.ok && isAudioResponse(response, url)) {
        return { response, resolvedUrl: url };
      }

      response.body?.cancel?.().catch(() => {});

      console.warn('[Telephony] Twilio recording fetch returned unexpected response.', {
        url,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
      });
    } catch (error) {
      console.warn('[Telephony] Failed to download recording from Twilio URL.', {
        url,
        error,
      });
    }
  }

  throw new Error('Unable to download recording from Twilio.');
};

const inferAudioExtension = (resolvedUrl, response) => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('wav')) {
    return 'wav';
  }

  if (contentType.includes('mpeg') || contentType.includes('mp3')) {
    return 'mp3';
  }

  const urlMatch = resolvedUrl.match(/\.([a-z0-9]+)(?:\?|$)/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1].toLowerCase();
  }

  return 'mp3';
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

app.post('/telephony/recording-complete', async (req, res) => {
  console.log('[Telephony] Recording complete webhook request received.');

  try {
    if (shouldValidateSignature && twilioAuthToken) {
      const signature = req.headers['x-twilio-signature'];
      if (!signature) {
        console.warn('[Telephony] Missing X-Twilio-Signature header on recording complete request.');
        return res.status(403).send('Twilio signature missing');
      }

      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const isValid = twilio.validateRequest(twilioAuthToken, signature, url, req.body);

      if (!isValid) {
        console.warn('[Telephony] Twilio signature validation failed for recording complete webhook.', {
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

    const {
      CallSid,
      From,
      To,
      RecordingSid,
      RecordingUrl,
      RecordingDuration,
      Timestamp,
    } = req.body || {};

    if (!CallSid) {
      console.warn('[Telephony] Recording complete payload missing CallSid.');
      return res.status(400).json({ error: 'CallSid is required' });
    }

    console.log('[Telephony] Recording metadata received:', {
      CallSid,
      From,
      To,
      RecordingSid,
      RecordingUrl,
      RecordingDuration,
      Timestamp,
    });

    const durationSec = Number.isFinite(Number(RecordingDuration)) ? Number(RecordingDuration) : null;
    const recordedAt = Timestamp || new Date().toISOString();

    await upsertCallRecord({
      callSid: CallSid,
      fromNumber: From,
      toNumber: To,
      recordingUrl: RecordingUrl,
      durationSec,
      recordedAt,
    });

    const existingTranscript = await getTranscriptByCallSid(CallSid);
    if (existingTranscript) {
      console.log('[Telephony] Transcript already exists for call; skipping regeneration.');
      await updateCallTranscriptionStatus({ callSid: CallSid, status: 'completed' });
      return res.status(200).json({ status: 'transcribed' });
    }

    if (!RecordingUrl) {
      console.warn('[Telephony] RecordingUrl missing from webhook payload.');
      await updateCallTranscriptionStatus({ callSid: CallSid, status: 'failed' });
      return res.status(400).json({ error: 'RecordingUrl is required' });
    }

    if (!openaiClient) {
      console.error('[Telephony] OpenAI client not configured; cannot transcribe.');
      await updateCallTranscriptionStatus({ callSid: CallSid, status: 'failed' });
      return res.status(500).json({ error: 'Transcription service unavailable' });
    }

    await updateCallTranscriptionStatus({ callSid: CallSid, status: 'processing' });

    try {
      const { response: recordingResponse, resolvedUrl } = await downloadTwilioRecording(RecordingUrl);
      const extension = inferAudioExtension(resolvedUrl, recordingResponse);
      const contentType = recordingResponse.headers.get('content-type') || undefined;
      const fileNameBase = RecordingSid || CallSid || 'recording';
      const fileName = extension ? `${fileNameBase}.${extension}` : fileNameBase;

      const audioFile = await toFile(recordingResponse, fileName, contentType ? { type: contentType } : undefined);

      const transcriptionResponse = await openaiClient.audio.transcriptions.create({
        file: audioFile,
        model: 'gpt-4o-mini-transcribe',
      });

      const transcriptText = (transcriptionResponse && transcriptionResponse.text) ? transcriptionResponse.text.trim() : '';
      const transcriptLanguage = transcriptionResponse && transcriptionResponse.language
        ? transcriptionResponse.language
        : 'en';

      if (!transcriptText) {
        throw new Error('Transcription response did not include text.');
      }

      await insertTranscription({
        id: randomUUID(),
        callSid: CallSid,
        engine: 'whisper',
        text: transcriptText,
        confidence: 0.8,
        language: transcriptLanguage,
      });

      await updateCallTranscriptionStatus({ callSid: CallSid, status: 'completed' });

      console.log('[Telephony] Transcription stored successfully for call.', { callSid: CallSid });

      return res.status(200).json({ status: 'transcribed' });
    } catch (transcriptionError) {
      console.error('[Telephony] Failed to transcribe recording.', {
        callSid: CallSid,
        error: transcriptionError,
      });
      await updateCallTranscriptionStatus({ callSid: CallSid, status: 'failed' });
      return res.status(500).json({ error: 'Failed to transcribe recording' });
    }
  } catch (error) {
    console.error('[Telephony] Failed to handle recording complete webhook:', error);
    return res.status(500).json({ error: 'Failed to process recording' });
  }
});

app.listen(port, () => {
  console.log(`FlynnAI telephony server listening on port ${port}`);
});
