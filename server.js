const express = require('express');
const twilio = require('twilio');
const dotenv = require('dotenv');
const { randomUUID } = require('crypto');
const OpenAI = require('openai');
const { toFile } = require('openai');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const { ensureJobForTranscript } = require('./telephony/jobCreation');
const { handleInboundCall, handleConversationContinue, handleRecordingStatus } = require('./telephony/conversationHandler');
const { extractBusinessContext } = require('./telephony/businessContextService');
const authenticateJwt = require('./middleware/authenticateJwt');

const {
  upsertCallRecord,
  getTranscriptByCallSid,
  insertTranscription,
  updateCallTranscriptionStatus,
  getCallBySid,
  getJobByCallSid,
  listJobsForUser,
  getJobForUser,
  updateJobStatusForUser,
  getJobById,
  insertJob,
  upsertNotificationToken,
  findExpiredRecordingCalls,
  markCallRecordingExpired,
  updateCallRecordingSignedUrl,
  updateBusinessContext,
  getBusinessContext,
} = require('./supabaseMcpClient');
const { sendJobCreatedNotification } = require('./notifications/pushService');

dotenv.config();

const decodeSupabaseRole = (key) => {
  if (!key) {
    console.warn('[Supabase] SUPABASE_SERVICE_ROLE_KEY is not set');
    return;
  }

  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    console.log('[Supabase] Service key role detected:', payload?.role || 'unknown');
  } catch (error) {
    console.warn('[Supabase] Failed to decode service key role', error);
  }
};

decodeSupabaseRole(process.env.SUPABASE_SERVICE_ROLE_KEY);

if (process.env.SERVER_PUBLIC_URL) {
  console.log('[Telephony] SERVER_PUBLIC_URL configured:', process.env.SERVER_PUBLIC_URL);
} else {
  console.log('[Telephony] SERVER_PUBLIC_URL not set; recording callback URLs will mirror the incoming request host.');
}

const app = express();
app.set('trust proxy', true); // ensure req.protocol honors X-Forwarded-Proto from ngrok/Twilio
const port = process.env.PORT || 3000;
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const shouldValidateSignature = process.env.TWILIO_VALIDATE_SIGNATURE !== 'false';
const openaiApiKey = process.env.OPENAI_API_KEY;
const twilioMessagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
const twilioSmsFromNumber = process.env.TWILIO_SMS_FROM_NUMBER || process.env.TWILIO_FROM_NUMBER;
const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_KEY
  || process.env.SUPABASE_SECRET;

const parseIntegerEnv = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const voicemailBucket = process.env.VOICEMAIL_STORAGE_BUCKET || 'voicemails';
const voicemailSignedUrlTtlSeconds = parseIntegerEnv(process.env.VOICEMAIL_SIGNED_URL_TTL_SECONDS, 3600);
const voicemailRetentionDays = parseIntegerEnv(process.env.VOICEMAIL_RETENTION_DAYS, 30);

const supabaseClientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    headers: {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
    },
  },
};

const supabaseStorageClient = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, supabaseClientOptions)
  : null;

if (!twilioAccountSid || !twilioAuthToken) {
  console.warn('[Telephony] Twilio credentials are incomplete; recording downloads will fail until configured.');
}

if (!openaiApiKey) {
  console.warn('[Telephony] OPENAI_API_KEY is not configured; transcription will fail until set.');
}

if (!supabaseStorageClient) {
  console.warn('[Telephony] Supabase storage client is not configured; voicemail uploads will fail.');
}

const openaiClient = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
const twilioMessagingClient = twilioAccountSid && twilioAuthToken
  ? twilio(twilioAccountSid, twilioAuthToken)
  : null;

const voiceProfileBucket = process.env.VOICE_PROFILE_BUCKET || 'voice-profiles';
const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
const elevenLabsModelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
const presetReceptionistVoices = {
  koala_warm: process.env.ELEVENLABS_VOICE_KOALA_WARM_ID,
  koala_expert: process.env.ELEVENLABS_VOICE_KOALA_EXPERT_ID,
  koala_hype: process.env.ELEVENLABS_VOICE_KOALA_HYPE_ID,
};

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const JOB_STATUS_VALUES = new Set(['new', 'in_progress', 'completed']);

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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const buildVoicemailStoragePath = ({ callSid, recordingSid, extension }) => {
  const now = new Date();
  const dateFolder = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
  ].join('/');

  const baseName = (recordingSid || callSid || randomUUID()).replace(/[^a-zA-Z0-9-_]/g, '');
  return `${dateFolder}/${baseName}.${extension}`;
};

const createSignedUrlForPath = async (storagePath, ttlSeconds = voicemailSignedUrlTtlSeconds) => {
  if (!supabaseStorageClient) {
    throw new Error('Supabase storage client is not configured.');
  }

  const expiresIn = Math.max(60, Number.isFinite(ttlSeconds) ? ttlSeconds : 3600);

  const { data, error } = await supabaseStorageClient
    .storage
    .from(voicemailBucket)
    .createSignedUrl(storagePath, expiresIn);

  if (error) {
    throw error;
  }

  const signedUrl = data?.signedUrl || null;
  const expirationIso = data?.expiration
    ? new Date(data.expiration * 1000).toISOString()
    : new Date(Date.now() + expiresIn * 1000).toISOString();

  return { signedUrl, expiresAt: expirationIso };
};

const persistRecordingToSupabaseStorage = async ({
  callSid,
  recordingSid,
  resolvedUrl,
  response,
}) => {
  if (!supabaseStorageClient) {
    throw new Error('Supabase storage client is not configured.');
  }

  const extension = inferAudioExtension(resolvedUrl, response);
  const contentType = response.headers.get('content-type') || `audio/${extension === 'wav' ? 'wav' : 'mpeg'}`;

  const buffer = Buffer.from(await response.arrayBuffer());
  const storagePath = buildVoicemailStoragePath({ callSid, recordingSid, extension });

  const { error: uploadError } = await supabaseStorageClient
    .storage
    .from(voicemailBucket)
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { signedUrl, expiresAt } = await createSignedUrlForPath(storagePath);

  const recordingExpiresAt = voicemailRetentionDays > 0
    ? new Date(Date.now() + voicemailRetentionDays * MS_PER_DAY).toISOString()
    : null;

  return {
    storagePath,
    signedUrl,
    signedExpiresAt: expiresAt,
    recordingExpiresAt,
    contentType,
    extension,
    size: buffer.length,
  };
};

const purgeExpiredRecordings = async () => {
  if (!supabaseStorageClient) {
    return;
  }

  if (!voicemailRetentionDays || voicemailRetentionDays <= 0) {
    return;
  }

  try {
    const cutoffIso = new Date().toISOString();
    const candidates = await findExpiredRecordingCalls({ cutoffIso, limit: 50 });

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return;
    }

    for (const candidate of candidates) {
      const callSid = candidate?.call_sid;
      const storagePath = candidate?.recording_storage_path;

      if (!callSid) {
        continue;
      }

      try {
        if (storagePath) {
          const { error: removeError } = await supabaseStorageClient
            .storage
            .from(voicemailBucket)
            .remove([storagePath]);

          if (removeError) {
            console.error('[Telephony] Failed to delete expired voicemail from storage.', {
              callSid,
              storagePath,
              error: removeError,
            });
            continue;
          }

          await markCallRecordingExpired({ callSid, clearStoragePath: true });
        } else {
          await markCallRecordingExpired({ callSid, clearStoragePath: false });
        }
      } catch (callError) {
        console.error('[Telephony] Failed to mark voicemail recording expired.', {
          callSid,
          error: callError,
        });
      }
    }
  } catch (error) {
    console.error('[Telephony] Failed to purge expired recordings.', { error });
  }
};

const scheduleRetentionSweep = () => {
  if (!voicemailRetentionDays || voicemailRetentionDays <= 0) {
    return;
  }

  setTimeout(() => {
    purgeExpiredRecordings().catch((error) => {
      console.error('[Telephony] Retention sweep threw an error.', { error });
    });
  }, 0);
};

const sendConfirmationSms = async ({ to, body }) => {
  if (!twilioMessagingClient) {
    throw new Error('Twilio messaging client is not configured.');
  }

  if (!to) {
    throw new Error('Destination phone number is required.');
  }

  const payload = {
    to,
    body,
  };

  if (twilioMessagingServiceSid) {
    payload.messagingServiceSid = twilioMessagingServiceSid;
  } else if (twilioSmsFromNumber) {
    payload.from = twilioSmsFromNumber;
  } else {
    throw new Error('Configure TWILIO_MESSAGING_SERVICE_SID or TWILIO_SMS_FROM_NUMBER to send SMS.');
  }

  const message = await twilioMessagingClient.messages.create(payload);
  return message;
};

app.post('/telephony/inbound-voice', handleInboundCall);
app.get('/telephony/inbound-voice', handleInboundCall);
app.post('/telephony/conversation-continue', handleConversationContinue);
app.post('/telephony/recording-status', handleRecordingStatus);

app.post('/voice/profiles/:voiceProfileId/clone', authenticateJwt, async (req, res) => {
  if (!supabaseStorageClient) {
    console.error('[VoiceClone] Supabase client not configured');
    return res.status(500).json({ error: 'Voice cloning unavailable' });
  }

  if (!elevenLabsApiKey) {
    console.error('[VoiceClone] ELEVENLABS_API_KEY not configured');
    return res.status(500).json({ error: 'Voice cloning not configured' });
  }

  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const voiceProfileId = req.params.voiceProfileId;

  try {
    const { data: profile, error: fetchError } = await supabaseStorageClient
      .from('voice_profiles')
      .select('id, user_id, label, status, sample_path, voice_id, created_at, updated_at')
      .eq('id', voiceProfileId)
      .single();

    if (fetchError || !profile) {
      console.warn('[VoiceClone] Voice profile not found', { voiceProfileId, fetchError });
      return res.status(404).json({ error: 'Voice profile not found' });
    }

    if (profile.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!profile.sample_path) {
      return res.status(400).json({ error: 'Voice sample missing' });
    }

    await supabaseStorageClient
      .from('voice_profiles')
      .update({ status: 'cloning', updated_at: new Date().toISOString() })
      .eq('id', voiceProfileId);

    const { data: sampleData, error: downloadError } = await supabaseStorageClient
      .storage
      .from(voiceProfileBucket)
      .download(profile.sample_path);

    if (downloadError || !sampleData) {
      console.error('[VoiceClone] Failed to download voice sample', { voiceProfileId, downloadError });
      await supabaseStorageClient
        .from('voice_profiles')
        .update({ status: 'error', updated_at: new Date().toISOString() })
        .eq('id', voiceProfileId);
      return res.status(500).json({ error: 'Failed to download voice sample' });
    }

    const sampleBuffer = Buffer.from(await sampleData.arrayBuffer());
    const fileName = path.basename(profile.sample_path) || `voice-sample-${voiceProfileId}.m4a`;

    const form = new FormData();
    form.append('name', profile.label || `Flynn voice ${voiceProfileId}`);
    if (elevenLabsModelId) {
      form.append('model_id', elevenLabsModelId);
    }

    let filePart;
    if (typeof File !== 'undefined') {
      filePart = new File([sampleBuffer], fileName, { type: 'audio/m4a' });
    } else if (typeof Blob !== 'undefined') {
      filePart = new Blob([sampleBuffer], { type: 'audio/m4a' });
    } else {
      filePart = sampleBuffer;
    }

    form.append('files', filePart, fileName);

    const formHeaders = typeof form.getHeaders === 'function' ? form.getHeaders() : undefined;

    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsApiKey,
        ...(formHeaders || {}),
      },
      body: form,
    });

    if (!response.ok) {
      const errorPayload = await response.text();
      console.error('[VoiceClone] ElevenLabs clone request failed', {
        status: response.status,
        body: errorPayload,
      });

      await supabaseStorageClient
        .from('voice_profiles')
        .update({ status: 'error', updated_at: new Date().toISOString() })
        .eq('id', voiceProfileId);

      return res.status(response.status).json({ error: 'Voice clone request failed', details: errorPayload });
    }

    const payload = await response.json();
    const voiceId = payload?.voice_id || payload?.voice?.id || payload?.voice?.voice_id || null;

    const { data: updatedProfile, error: updateError } = await supabaseStorageClient
      .from('voice_profiles')
      .update({
        status: voiceId ? 'ready' : 'processed',
        voice_id: voiceId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', voiceProfileId)
      .select('id, user_id, label, provider, status, sample_path, voice_id, created_at, updated_at')
      .single();

    if (updateError) {
      console.error('[VoiceClone] Failed to update voice profile after cloning', { updateError });
      return res.status(500).json({ error: 'Voice clone completed but failed to update profile' });
    }

    return res.json({ profile: updatedProfile, providerResponse: payload });
  } catch (error) {
    console.error('[VoiceClone] Unexpected error during cloning', { error });
    try {
      await supabaseStorageClient
        .from('voice_profiles')
        .update({ status: 'error', updated_at: new Date().toISOString() })
        .eq('id', voiceProfileId);
    } catch (updateError) {
      console.error('[VoiceClone] Failed to set error status on voice profile', { updateError });
    }

    return res.status(500).json({ error: 'Failed to clone voice profile' });
  }
});

app.post('/voice/preview', authenticateJwt, async (req, res) => {
  if (!elevenLabsApiKey) {
    console.error('[VoicePreview] ELEVENLABS_API_KEY not configured');
    return res.status(500).json({ error: 'Voice preview unavailable' });
  }

  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { text, voiceOption, voiceProfileId } = req.body || {};

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Preview text is required' });
  }

  if (!voiceOption || typeof voiceOption !== 'string') {
    return res.status(400).json({ error: 'Voice option is required' });
  }

  try {
    let voiceId;

    if (voiceOption === 'custom_voice') {
      if (!voiceProfileId) {
        return res.status(400).json({ error: 'Custom voice profile is required' });
      }

      if (!supabaseStorageClient) {
        console.error('[VoicePreview] Supabase client not configured');
        return res.status(500).json({ error: 'Voice preview unavailable' });
      }

      const { data: profile, error: profileError } = await supabaseStorageClient
        .from('voice_profiles')
        .select('id, user_id, status, voice_id')
        .eq('id', voiceProfileId)
        .single();

      if (profileError || !profile) {
        console.warn('[VoicePreview] Voice profile not found', { voiceProfileId, profileError });
        return res.status(404).json({ error: 'Voice profile not found' });
      }

      if (profile.user_id !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      if (profile.status !== 'ready' || !profile.voice_id) {
        return res.status(400).json({ error: 'Voice profile is not ready for playback' });
      }

      voiceId = profile.voice_id;
    } else {
      voiceId = presetReceptionistVoices[voiceOption];

      if (!voiceId) {
        console.warn('[VoicePreview] No preset voice configured for option', voiceOption);
        return res.status(400).json({ error: 'This voice does not support previews yet' });
      }
    }

    const previewResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsApiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: elevenLabsModelId,
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.8,
        },
      }),
    });

    if (!previewResponse.ok) {
      const errorPayload = await previewResponse.text();
      console.error('[VoicePreview] ElevenLabs preview failed', {
        status: previewResponse.status,
        body: errorPayload,
      });
      return res.status(previewResponse.status).json({ error: 'Voice preview failed', details: errorPayload });
    }

    const arrayBuffer = await previewResponse.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');
    const contentType = previewResponse.headers.get('content-type') || 'audio/mpeg';

    return res.json({ audio: base64Audio, contentType });
  } catch (error) {
    console.error('[VoicePreview] Unexpected error', { error });
    return res.status(500).json({ error: 'Failed to generate voice preview' });
  }
});

// Business context extraction endpoint
app.post('/receptionist/business-context/extract', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { businessProfileUrl } = req.body || {};

  if (!businessProfileUrl || typeof businessProfileUrl !== 'string') {
    return res.status(400).json({ error: 'Business profile URL is required' });
  }

  // Validate it's a Google Maps/Business Profile URL
  if (!businessProfileUrl.includes('google.com/maps') && !businessProfileUrl.includes('google.com/business')) {
    return res.status(400).json({ error: 'Please provide a valid Google Business Profile or Google Maps URL' });
  }

  try {
    console.log('[BusinessContext] Extracting context from URL:', businessProfileUrl);

    // Extract business context using AI
    const businessContext = await extractBusinessContext(businessProfileUrl);

    // Save to database
    await updateBusinessContext(userId, businessProfileUrl, businessContext);

    console.log('[BusinessContext] Successfully extracted and saved context:', {
      userId,
      businessName: businessContext.businessName,
    });

    return res.json({
      success: true,
      businessContext,
    });
  } catch (error) {
    console.error('[BusinessContext] Failed to extract business context:', error);
    return res.status(500).json({
      error: 'Failed to extract business information. Please check the URL and try again.',
    });
  }
});

// Get current business context
app.get('/receptionist/business-context', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const data = await getBusinessContext(userId);
    return res.json(data || {});
  } catch (error) {
    console.error('[BusinessContext] Failed to get business context:', error);
    return res.status(500).json({ error: 'Failed to retrieve business context' });
  }
});

app.get('/telephony/calls/:callSid/recording', authenticateJwt, async (req, res) => {
  const callSid = req.params?.callSid;

  if (!callSid) {
    return res.status(400).json({ error: 'CallSid is required' });
  }

  try {
    const userId = req.user?.id;
    const callRecord = await getCallBySid(callSid);

    if (!callRecord || (callRecord.user_id && callRecord.user_id !== userId)) {
      return res.status(404).json({ error: 'Call not found' });
    }

    if (!callRecord.recording_storage_path) {
      return res.status(404).json({ error: 'No stored recording for this call' });
    }

    if (!supabaseStorageClient) {
      console.error('[Telephony] Supabase storage client is not configured; cannot issue signed URL.');
      return res.status(500).json({ error: 'Voicemail storage unavailable' });
    }

    const { signedUrl, expiresAt } = await createSignedUrlForPath(callRecord.recording_storage_path);

    await updateCallRecordingSignedUrl({
      callSid,
      signedUrl,
      signedExpiresAt: expiresAt,
    });

    return res.status(200).json({
      callSid,
      signedUrl,
      expiresAt,
    });
  } catch (error) {
    console.error('[Telephony] Failed to generate signed voicemail URL.', { callSid, error });
    return res.status(500).json({ error: 'Failed to generate voicemail URL' });
  }
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

    if (!supabaseStorageClient) {
      console.error('[Telephony] Supabase storage client is not configured; cannot store voicemail.');
      await upsertCallRecord({
        callSid: CallSid,
        fromNumber: From,
        toNumber: To,
        recordingSid: RecordingSid,
        durationSec,
        recordedAt,
        status: 'failed',
      });
      await updateCallTranscriptionStatus({ callSid: CallSid, status: 'failed' }).catch(() => {});
      return res.status(500).json({ error: 'Voicemail storage unavailable' });
    }

    if (!RecordingUrl) {
      console.warn('[Telephony] RecordingUrl missing from webhook payload.');
      await upsertCallRecord({
        callSid: CallSid,
        fromNumber: From,
        toNumber: To,
        recordingSid: RecordingSid,
        durationSec,
        recordedAt,
        status: 'failed',
      });
      await updateCallTranscriptionStatus({ callSid: CallSid, status: 'failed' }).catch(() => {});
      return res.status(400).json({ error: 'RecordingUrl is required' });
    }

    let recordingResponse;
    let resolvedUrl;
    let storageMetadata;

    try {
      ({ response: recordingResponse, resolvedUrl } = await downloadTwilioRecording(RecordingUrl));
      storageMetadata = await persistRecordingToSupabaseStorage({
        callSid: CallSid,
        recordingSid: RecordingSid,
        resolvedUrl,
        response: recordingResponse.clone(),
      });
    } catch (storageError) {
      console.error('[Telephony] Failed to persist voicemail recording.', {
        callSid: CallSid,
        error: storageError,
      });

      await upsertCallRecord({
        callSid: CallSid,
        fromNumber: From,
        toNumber: To,
        recordingSid: RecordingSid,
        durationSec,
        recordedAt,
        status: 'failed',
      });

      await updateCallTranscriptionStatus({ callSid: CallSid, status: 'failed' }).catch(() => {});

      return res.status(500).json({ error: 'Failed to store recording' });
    }

    await upsertCallRecord({
      callSid: CallSid,
      fromNumber: From,
      toNumber: To,
      recordingUrl: storageMetadata?.signedUrl,
      recordingSid: RecordingSid,
      recordingStoragePath: storageMetadata?.storagePath,
      recordingSignedExpiresAt: storageMetadata?.signedExpiresAt,
      recordingExpiresAt: storageMetadata?.recordingExpiresAt,
      durationSec,
      recordedAt,
      status: 'active',
    });

    scheduleRetentionSweep();

    const existingTranscript = await getTranscriptByCallSid(CallSid);
    if (existingTranscript) {
      console.log('[Telephony] Transcript already exists for call; skipping regeneration.');
      await updateCallTranscriptionStatus({ callSid: CallSid, status: 'completed' });
      return res.status(200).json({ status: 'transcribed' });
    }

    if (!openaiClient) {
      console.error('[Telephony] OpenAI client not configured; cannot transcribe.');
      await updateCallTranscriptionStatus({ callSid: CallSid, status: 'failed' });
      return res.status(500).json({ error: 'Transcription service unavailable' });
    }

    await updateCallTranscriptionStatus({ callSid: CallSid, status: 'processing' });

    try {
      const fileNameBase = RecordingSid || CallSid || 'recording';
      const extension = storageMetadata?.extension || inferAudioExtension(resolvedUrl, recordingResponse);
      const fileName = extension ? `${fileNameBase}.${extension}` : fileNameBase;
      const contentType = storageMetadata?.contentType || recordingResponse.headers.get('content-type') || undefined;

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

      try {
        await ensureJobForTranscript({
          callSid: CallSid,
          transcriptText,
          openaiClient,
        });
      } catch (jobCreationError) {
        console.error('[Jobs] Failed to create job from transcript.', {
          callSid: CallSid,
          error: jobCreationError,
        });
      }

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

app.post('/me/notifications/token', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { token, platform } = req.body || {};
  const trimmedToken = typeof token === 'string' ? token.trim() : '';
  const normalizedPlatform = typeof platform === 'string' ? platform.toLowerCase() : '';

  if (!trimmedToken) {
    return res.status(400).json({ error: 'token is required' });
  }

  if (!['ios', 'android'].includes(normalizedPlatform)) {
    return res.status(400).json({ error: 'platform must be ios or android' });
  }

  try {
    await upsertNotificationToken({ userId, platform: normalizedPlatform, token: trimmedToken });
    return res.status(204).end();
  } catch (error) {
    console.error('[Notifications] Failed to upsert notification token.', { userId, error });
    return res.status(500).json({ error: 'Failed to register device token' });
  }
});

app.get('/jobs', authenticateJwt, async (req, res) => {
  const userId = req.user.id;
  const statusParam = typeof req.query.status === 'string' ? req.query.status.trim() : undefined;
  const normalizedStatus = statusParam ? statusParam.toLowerCase() : undefined;

  if (normalizedStatus && !JOB_STATUS_VALUES.has(normalizedStatus)) {
    return res.status(400).json({ error: 'Invalid status filter' });
  }

  const limitParam = typeof req.query.limit === 'string' ? req.query.limit : undefined;
  const offsetParam = typeof req.query.offset === 'string' ? req.query.offset : undefined;

  const parsedLimit = Number.parseInt(limitParam ?? '', 10);
  const parsedOffset = Number.parseInt(offsetParam ?? '', 10);

  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, 100)
    : 20;
  const offset = Number.isFinite(parsedOffset) && parsedOffset >= 0
    ? parsedOffset
    : 0;

  try {
    const jobs = await listJobsForUser({
      userId,
      status: normalizedStatus,
      limit,
      offset,
    });

    return res.status(200).json({
      jobs,
      pagination: {
        limit,
        offset,
        count: jobs.length,
      },
    });
  } catch (error) {
    console.error('[Jobs] Failed to list jobs.', {
      userId,
      error,
    });
    return res.status(500).json({ error: 'Failed to load jobs' });
  }
});

app.get('/jobs/:id', authenticateJwt, async (req, res) => {
  const userId = req.user.id;
  const jobId = req.params?.id;

  if (!jobId) {
    return res.status(400).json({ error: 'Job ID is required' });
  }

  try {
    const job = await getJobForUser({ jobId, userId });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    return res.status(200).json({ job });
  } catch (error) {
    console.error('[Jobs] Failed to fetch job.', {
      userId,
      jobId,
      error,
    });
    return res.status(500).json({ error: 'Failed to load job' });
  }
});

app.patch('/jobs/:id', authenticateJwt, async (req, res) => {
  const userId = req.user.id;
  const jobId = req.params?.id;

  if (!jobId) {
    return res.status(400).json({ error: 'Job ID is required' });
  }

  const requestedStatus = req.body && typeof req.body.status === 'string'
    ? req.body.status.trim().toLowerCase()
    : undefined;

  if (!requestedStatus) {
    return res.status(400).json({ error: 'Status is required' });
  }

  if (!JOB_STATUS_VALUES.has(requestedStatus)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  try {
    const updatedJob = await updateJobStatusForUser({
      jobId,
      userId,
      status: requestedStatus,
    });

    if (!updatedJob) {
      return res.status(404).json({ error: 'Job not found' });
    }

    return res.status(200).json({ job: updatedJob });
  } catch (error) {
    console.error('[Jobs] Failed to update job status.', {
      userId,
      jobId,
      requestedStatus,
      error,
    });
    return res.status(500).json({ error: 'Failed to update job' });
  }
});

app.post('/jobs/:id/notify', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  const jobId = req.params?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!jobId) {
    return res.status(400).json({ error: 'Job ID is required' });
  }

  try {
    const job = await getJobById(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.user_id && job.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await sendJobCreatedNotification({ userId: job.user_id, job });
    return res.status(200).json(result);
  } catch (error) {
    console.error('[Notifications] Failed to send job notification.', { jobId, error });
    return res.status(500).json({ error: 'Failed to send notification' });
  }
});

app.post('/jobs/:id/confirm', async (req, res) => {
  const jobId = req.params?.id;

  if (!jobId) {
    return res.status(400).json({ error: 'Job ID is required' });
  }

  if (!twilioMessagingClient) {
    console.error('[Jobs] Twilio messaging client unavailable; cannot send confirmation SMS.');
    return res.status(500).json({ error: 'Messaging not configured' });
  }

  try {
    const jobRecord = await getJobById(jobId);

    if (!jobRecord) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (!jobRecord.customer_phone) {
      return res.status(400).json({ error: 'Job is missing customer_phone' });
    }

    const smsBody = "Hi, we received your voicemail and created a job card. We'll be in touch soon.";

    await sendConfirmationSms({
      to: jobRecord.customer_phone,
      body: smsBody,
    });

    console.log('[Jobs] Confirmation SMS queued.', {
      jobId: jobRecord.id,
      callSid: jobRecord.call_sid,
    });

    return res.status(200).json({ status: 'queued' });
  } catch (error) {
    console.error('[Jobs] Failed to send confirmation SMS.', {
      jobId,
      error,
    });

    if (error && error.message && /configure/i.test(error.message)) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(500).json({ error: 'Failed to send confirmation SMS' });
  }
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`FlynnAI telephony server listening on port ${port}`);
  });
}

module.exports = app;
