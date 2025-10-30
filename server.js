const express = require('express');
const twilio = require('twilio');
const dotenv = require('dotenv');
const http = require('http');
const WebSocket = require('ws');
const { randomUUID } = require('crypto');
const OpenAI = require('openai');
const { toFile } = require('openai');
let createDeepgramClient;
try {
  ({ createClient: createDeepgramClient } = require('@deepgram/sdk'));
} catch (err) {
  console.warn('[Startup] @deepgram/sdk not found; live transcription disabled unless installed.');
}
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const { ensureJobForTranscript } = require('./telephony/jobCreation');
const authenticateJwt = require('./middleware/authenticateJwt');
const attachRealtimeServer = require('./telephony/realtimeServer');
const { getLLMClient, PROVIDERS } = require('./llmClient');

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
  getUserProfileById,
  upsertNotificationToken,
  findExpiredRecordingCalls,
  markCallRecordingExpired,
  updateCallRecordingSignedUrl,
  getReceptionistProfileByNumber,
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
const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
const receptionistEnabledGlobally = process.env.ENABLE_CONVERSATION_ORCHESTRATOR !== 'false';
const maxQuestionsPerTurn = Number.parseInt(process.env.MAX_QUESTIONS_PER_TURN ?? '1', 10);
const minAckVariety = Number.parseInt(process.env.MIN_ACK_VARIETY ?? '3', 10);

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

if (!supabaseStorageClient) {
  console.warn('[Telephony] Supabase storage client is not configured; voicemail uploads will fail.');
}

let llmClient = null;
try {
  llmClient = getLLMClient();
  console.log('[LLM] Initialised AI provider.', { provider: llmClient.provider });
} catch (error) {
  console.warn('[LLM] Failed to initialise AI provider.', { error: error.message });
}

if (!openaiApiKey && (!llmClient || llmClient.provider !== PROVIDERS.GROK)) {
  console.warn('[Telephony] OPENAI_API_KEY is not configured; OpenAI features will be unavailable.');
}

let transcriptionClient = llmClient;
if (!transcriptionClient || transcriptionClient.provider === PROVIDERS.GROK) {
  const fallbackKey = (process.env.OPENAI_API_KEY || '').trim();
  if (fallbackKey) {
    try {
      transcriptionClient = new OpenAI({ apiKey: fallbackKey });
      transcriptionClient.provider = PROVIDERS.OPENAI;
      console.log('[LLM] Using OpenAI fallback for transcription workloads.');
    } catch (error) {
      console.warn('[LLM] Failed to initialise OpenAI transcription fallback.', { error: error.message });
      transcriptionClient = null;
    }
  } else if (llmClient && llmClient.provider === PROVIDERS.GROK) {
    console.warn('[LLM] Grok provider active without transcription fallback; voicemail transcription will be disabled.');
  }
}

const deepgramClient = deepgramApiKey && typeof createDeepgramClient === 'function'
  ? createDeepgramClient(deepgramApiKey)
  : null;
const twilioMessagingClient = twilioAccountSid && twilioAuthToken
  ? twilio(twilioAccountSid, twilioAuthToken)
  : null;

const voiceProfileBucket = process.env.VOICE_PROFILE_BUCKET || 'voice-profiles';
const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
const elevenLabsModelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
const elevenLabsPresetVoices = {
  koala_warm: process.env.ELEVENLABS_VOICE_KOALA_WARM_ID,
  koala_expert: process.env.ELEVENLABS_VOICE_KOALA_EXPERT_ID,
  koala_hype: process.env.ELEVENLABS_VOICE_KOALA_HYPE_ID,
};

const azureSpeechKey = process.env.AZURE_SPEECH_KEY ? process.env.AZURE_SPEECH_KEY.trim() : '';
const azureSpeechRegion = process.env.AZURE_SPEECH_REGION ? process.env.AZURE_SPEECH_REGION.trim() : '';
const azureSpeechEndpoint = process.env.AZURE_SPEECH_ENDPOINT ? process.env.AZURE_SPEECH_ENDPOINT.trim() : '';
const azureDefaultVoice = process.env.AZURE_TTS_DEFAULT_VOICE || 'en-AU-NatashaNeural';
const azurePresetVoices = {
  koala_warm: process.env.AZURE_VOICE_KOALA_WARM || azureDefaultVoice,
  koala_expert: process.env.AZURE_VOICE_KOALA_EXPERT || 'en-AU-WilliamNeural',
  koala_hype: process.env.AZURE_VOICE_KOALA_HYPE || 'en-AU-CarlyNeural',
};

const resolveTtsProvider = () => {
  const explicit = (process.env.TTS_PROVIDER || '').trim().toLowerCase();
  if (explicit) {
    return explicit;
  }
  if (azureSpeechKey && azureSpeechRegion) {
    return 'azure';
  }
  return elevenLabsApiKey ? 'elevenlabs' : 'none';
};

const ttsProvider = resolveTtsProvider();
const ttsCacheTtlMs = parseIntegerEnv(process.env.TTS_CACHE_TTL_MS, 15 * 60 * 1000);
const ttsCacheMaxEntries = parseIntegerEnv(process.env.TTS_CACHE_MAX_ENTRIES, 256);
const activePresetVoices = ttsProvider === 'azure' ? azurePresetVoices : elevenLabsPresetVoices;
const voiceConfig = {
  provider: ttsProvider,
  presetVoices: activePresetVoices,
  cacheControl: {
    ttlMs: ttsCacheTtlMs,
    maxEntries: ttsCacheMaxEntries,
  },
  azure: {
    key: azureSpeechKey,
    region: azureSpeechRegion,
    endpoint: azureSpeechEndpoint,
    defaultVoice: azureDefaultVoice,
    presetVoices: azurePresetVoices,
  },
  elevenLabs: {
    apiKey: elevenLabsApiKey,
    modelId: elevenLabsModelId,
    presetVoices: elevenLabsPresetVoices,
  },
};

console.log('[TTS] Provider configuration detected.', {
  provider: voiceConfig.provider,
  hasAzure: Boolean(voiceConfig.azure.key && (voiceConfig.azure.endpoint || voiceConfig.azure.region)),
  hasElevenLabs: Boolean(voiceConfig.elevenLabs.apiKey),
  cacheTtlMs: voiceConfig.cacheControl.ttlMs,
  cacheMaxEntries: voiceConfig.cacheControl.maxEntries,
});

const escapeSsmlForAzure = (text) => text
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/\"/g, '&quot;')
  .replace(/'/g, '&apos;');

const buildAzureSsml = (voiceName, text) => {
  const voice = voiceName || 'en-AU-NatashaNeural';
  const langParts = Array.isArray(voice.split('-')) ? voice.split('-').slice(0, 2) : ['en', 'AU'];
  const lang = langParts.filter(Boolean).join('-') || 'en-AU';
  return `<speak version=\"1.0\" xml:lang=\"${lang}\"><voice name=\"${voice}\">${escapeSsmlForAzure(text)}</voice></speak>`;
};

const DEFAULT_ACK_LIBRARY = [
  'Got it!',
  'Perfect, thanks!',
  'Understood.',
  'That helps, thank you.',
  'Great, keep going.',
  'Heard you loud and clear.',
  'Awesome, let me note that.',
  'Thanks, just a sec.',
  'Okay, appreciate the detail.',
  'Brilliant, one moment.',
];

const receptionistSessionCache = new Map(); // callSid -> metadata

const buildRealtimeStreamUrl = (req, callSid, userId) => {
  const base = process.env.SERVER_PUBLIC_URL
    ? process.env.SERVER_PUBLIC_URL.trim().replace(/\/$/, '')
    : `${req.protocol}://${req.get('host')}`;

  const wsBase = base.replace(/^http/, 'ws').replace(/^https/, 'wss');
  const url = new URL('/realtime/twilio', wsBase);
  if (callSid) {
    url.searchParams.set('callSid', callSid);
  }
  if (userId) {
    url.searchParams.set('userId', userId);
  }
  return url.toString();
};

const normalizeAckLibrary = (profile) => {
  if (!profile) {
    return DEFAULT_ACK_LIBRARY;
  }

  const provided = Array.isArray(profile.receptionist_ack_library)
    ? profile.receptionist_ack_library
    : [];

  const cleaned = provided
    .map((entry) => (typeof entry === 'string' ? entry.trim() : null))
    .filter((entry) => entry && entry.length > 0);

  if (cleaned.length >= minAckVariety) {
    return cleaned;
  }

  const merged = [...cleaned];
  for (const fallback of DEFAULT_ACK_LIBRARY) {
    if (merged.length >= minAckVariety) {
      break;
    }
    if (!merged.includes(fallback)) {
      merged.push(fallback);
    }
  }

  return merged.length > 0 ? merged : DEFAULT_ACK_LIBRARY;
};

const respondWithVoicemail = (req, res, inboundParams) => {
  const response = new twilio.twiml.VoiceResponse();

  response.say('Hi, you\'ve reached FlynnAI. Please leave a message after the tone.');
  response.record({
    action: buildRecordingCallbackUrl(req),
    method: 'POST',
    playBeep: true,
  });

  res.type('text/xml');
  res.send(response.toString());
};

const respondWithHybridChoice = (req, res, inboundParams, profile) => {
  const response = new twilio.twiml.VoiceResponse();
  const action = `/telephony/inbound-voice?stage=choice&user=${profile.id}`;
  const gather = response.gather({
    input: 'speech dtmf',
    action,
    method: 'POST',
    numDigits: 1,
    timeout: 5,
    speechTimeout: 'auto',
  });

  const greeting = (profile.receptionist_greeting || '').trim()
    || 'Hi, thanks for calling the team.';

  gather.say(greeting);
  gather.pause({ length: 1 });
  gather.say('If you would like to leave a voicemail for the team, press 1 or say "leave a message".');
  gather.say('If you would like our receptionist to help you right now, press 2 or say "talk to the receptionist".');

  response.say('Sorry, I didn\'t catch that. I\'ll transfer you to voicemail.');
  response.redirect({ method: 'POST' }, '/telephony/inbound-voice');

  res.type('text/xml');
  res.send(response.toString());
};

const interpretHybridChoice = (params = {}) => {
  const digits = (params.Digits || '').trim();
  if (digits === '1') {
    return 'voicemail';
  }
  if (digits === '2') {
    return 'ai';
  }

  const speech = (params.SpeechResult || params.UnstableSpeechResult || '').toString().toLowerCase();

  if (speech.includes('message') || speech.includes('voicemail') || speech.includes('record')) {
    return 'voicemail';
  }

  if (speech.includes('book') || speech.includes('schedule') || speech.includes('talk') || speech.includes('yes')) {
    return 'ai';
  }

  return 'ai';
};

const cacheReceptionistSession = ({ callSid, profile, toNumber }) => {
  if (!callSid || !profile) {
    return;
  }

  const ackLibrary = normalizeAckLibrary(profile);
  const questions = Array.isArray(profile.receptionist_questions)
    ? profile.receptionist_questions.filter((q) => typeof q === 'string' && q.trim().length > 0)
    : [];

  receptionistSessionCache.set(callSid, {
    callSid,
    userId: profile.id,
    toNumber,
    startedAt: Date.now(),
    ackLibrary,
    greeting: (profile.receptionist_greeting || '').trim(),
    voiceOption: profile.receptionist_voice || 'koala_warm',
    voiceProfileId: profile.receptionist_voice_profile_id || null,
    voiceId: profile.receptionist_voice_id || null,
    voiceStatus: profile.receptionist_voice_status || null,
    questions,
    maxQuestionsPerTurn,
    minAckVariety,
    businessProfile: profile.receptionist_business_profile || null,
    businessName: profile.business_name || null,
    businessType: profile.business_type || null,
    mode: profile.receptionist_mode || 'ai_only',
    ackHistory: [],
  });
};

const respondWithAiReceptionist = ({ req, res, inboundParams, profile, callSid }) => {
  const response = new twilio.twiml.VoiceResponse();
  const streamUrl = buildRealtimeStreamUrl(req, callSid, profile?.id);

  console.log('[Telephony] Starting AI receptionist for call.', {
    callSid,
    userId: profile?.id,
    streamUrl,
    voiceOption: profile?.receptionist_voice,
    hasGreeting: Boolean(profile?.receptionist_greeting),
    questionsCount: Array.isArray(profile?.receptionist_questions) ? profile.receptionist_questions.length : 0,
  });

  // IMPORTANT: Cache the session BEFORE sending TwiML response
  cacheReceptionistSession({ callSid, profile, toNumber: inboundParams.To || inboundParams.Called });

  const connect = response.connect();
  const stream = connect.stream({
    url: streamUrl,
    track: 'inbound_track', // Only receive caller audio to prevent feedback loop
    statusCallback: `${req.protocol}://${req.get('host')}/telephony/stream-status`,
    statusCallbackMethod: 'POST',
  });

  stream.parameter({ name: 'callSid', value: callSid || '' });
  if (profile?.id) {
    stream.parameter({ name: 'userId', value: profile.id });
  }

  const twimlOutput = response.toString();
  console.log('[Telephony] Sending TwiML response:', { callSid, twiml: twimlOutput });

  res.type('text/xml');
  res.send(twimlOutput);
};

const handleRealtimeConversationComplete = async ({ callSid, userId, transcript, turns, reason }) => {
  if (!callSid) {
    return;
  }

  try {
    const existingTranscript = await getTranscriptByCallSid(callSid);

    if (!existingTranscript && transcript && transcript.trim().length > 0) {
      await insertTranscription({
        id: randomUUID(),
        callSid,
        engine: 'realtime',
        text: transcript.trim(),
        confidence: 0.92,
        language: 'en',
      });
    }

    await updateCallTranscriptionStatus({ callSid, status: 'completed' }).catch((error) => {
      console.warn('[Realtime] Failed to update transcription status.', { callSid, error });
    });

    await upsertCallRecord({
      callSid,
      userId: userId || null,
      status: reason === 'complete' ? 'completed' : 'ended',
    }).catch(() => {});

    if (transcript && transcript.trim().length > 4) {
      if (llmClient) {
        await ensureJobForTranscript({
          callSid,
          transcriptText: transcript,
          llmClient,
        });
      } else {
        console.warn('[Jobs] Skipping job creation; no LLM client configured.', { callSid });
      }
    }

    // Explicitly end the live call to avoid lingering streams once we finish
    if (twilioMessagingClient && callSid) {
      try {
        await twilioMessagingClient.calls(callSid).update({ status: 'completed' });
        console.log('[Realtime] Ended Twilio call via REST API.', { callSid });
      } catch (error) {
        console.warn('[Realtime] Failed to end Twilio call via REST API.', { callSid, error });
      }
    }
  } catch (error) {
    console.error('[Realtime] Failed to persist realtime conversation data.', { callSid, error });
  } finally {
    receptionistSessionCache.delete(callSid);
  }
};

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

const handleInboundVoice = async (req, res) => {
  console.log('[Telephony] Inbound voice webhook request received.', { method: req.method });

  const inboundParams = req.method === 'GET' ? req.query || {} : req.body || {};

  try {
    if (shouldValidateSignature && twilioAuthToken) {
      const signature = req.headers['x-twilio-signature'];
      if (!signature) {
        console.warn('[Telephony] Missing X-Twilio-Signature header on inbound request.');
        return res.status(403).send('Twilio signature missing');
      }

      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const isValid = twilio.validateRequest(twilioAuthToken, signature, url, inboundParams);

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

    const callSid = inboundParams.CallSid;
    const toNumber = inboundParams.To || inboundParams.Called || inboundParams.ToFormatted || null;
    const fromNumber = inboundParams.From || inboundParams.Caller || inboundParams.CallerNumber || null;
    const stage = req.query?.stage || 'initial';
    const stageDecision = req.query?.decision || null;
    const profileUserId = req.query?.user || null;

    let receptionistProfile = null;

    if (toNumber) {
      try {
        receptionistProfile = await getReceptionistProfileByNumber(toNumber);
      } catch (profileError) {
        console.error('[Telephony] Failed to load receptionist profile for number.', {
          toNumber,
          error: profileError,
        });
      }
    }

    if (!receptionistProfile && profileUserId) {
      try {
        receptionistProfile = await getUserProfileById(profileUserId);
      } catch (profileLookupError) {
        console.warn('[Telephony] Failed to fetch profile via user id fallback.', {
          profileUserId,
          error: profileLookupError,
        });
      }
    }

    if (callSid) {
      await upsertCallRecord({
        callSid,
        userId: receptionistProfile?.id || null,
        fromNumber,
        toNumber,
        status: 'ringing',
      }).catch((error) => {
        console.warn('[Telephony] Failed to upsert initial call record.', { callSid, error });
      });
    }

    const receptionistConfigured = Boolean(receptionistProfile?.receptionist_configured);

    // Explicitly default to 'ai_only' when configured but mode is null/undefined
    let receptionistMode = receptionistProfile?.receptionist_mode;
    if (!receptionistMode) {
      receptionistMode = receptionistConfigured ? 'ai_only' : 'voicemail_only';
    }

    // Check each service individually for better debugging
    const hasLLMProvider = Boolean(llmClient);
    const hasElevenLabs = Boolean(elevenLabsApiKey);
    const hasDeepgram = Boolean(deepgramClient);
    const conversationalPathAvailable = receptionistConfigured
      && receptionistEnabledGlobally
      && hasLLMProvider
      && hasElevenLabs
      && hasDeepgram;

    // Comprehensive logging for debugging routing decisions
    console.log('[Telephony] Receptionist routing decision:', {
      callSid,
      toNumber,
      fromNumber,
      hasReceptionistProfile: Boolean(receptionistProfile),
      receptionistConfigured,
      receptionistMode,
      receptionistEnabledGlobally,
      hasLLM: hasLLMProvider,
      llmProvider: llmClient?.provider || 'unknown',
      hasElevenLabs,
      hasDeepgram,
      conversationalPathAvailable,
      profileUserId: receptionistProfile?.id,
      profileGreeting: receptionistProfile?.receptionist_greeting ? 'present' : 'missing',
      profileVoice: receptionistProfile?.receptionist_voice || 'not set',
    });

    if (!receptionistProfile) {
      console.log('[Telephony] No receptionist profile found for number, routing to voicemail.', { toNumber });
      return respondWithVoicemail(req, res, inboundParams);
    }

    if (!conversationalPathAvailable) {
      console.warn('[Telephony] Conversational path unavailable, routing to voicemail.', {
        callSid,
        reason: {
          receptionistConfigured,
          receptionistEnabledGlobally,
          hasLLM: hasLLMProvider,
          hasElevenLabs,
          hasDeepgram,
        },
      });
      return respondWithVoicemail(req, res, inboundParams);
    }

    if (receptionistMode === 'voicemail_only') {
      console.log('[Telephony] Receptionist mode is voicemail_only, routing to voicemail.', { callSid });
      return respondWithVoicemail(req, res, inboundParams);
    }

    if (receptionistMode === 'hybrid_choice' && stage === 'initial') {
      return respondWithHybridChoice(req, res, inboundParams, receptionistProfile);
    }

    if (receptionistMode === 'hybrid_choice' && stage === 'choice') {
      const decision = stageDecision || interpretHybridChoice(inboundParams);
      if (decision === 'voicemail') {
        return respondWithVoicemail(req, res, inboundParams);
      }
      // default to AI receptionist when uncertain
    }

    if (callSid) {
      await upsertCallRecord({
        callSid,
        userId: receptionistProfile?.id || null,
        fromNumber,
        toNumber,
        status: 'ai_engaged',
      }).catch((error) => {
        console.warn('[Telephony] Failed to update call status to ai_engaged.', { callSid, error });
      });
    }

    return respondWithAiReceptionist({
      req,
      res,
      inboundParams,
      profile: receptionistProfile,
      callSid,
    });
  } catch (error) {
    console.error('[Telephony] Failed to process inbound voice request.', error);
    return respondWithVoicemail(req, res, inboundParams);
  }
};

app.post('/telephony/inbound-voice', handleInboundVoice);
app.get('/telephony/inbound-voice', handleInboundVoice);

app.post('/telephony/stream-status', async (req, res) => {
  const { CallSid, StreamSid, AccountSid, Status } = req.body || {};

  console.log('[Telephony] Stream status callback received:', {
    callSid: CallSid,
    streamSid: StreamSid,
    accountSid: AccountSid,
    status: Status,
    body: req.body,
  });

  res.status(200).send('OK');
});

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

  const providerPriority = voiceConfig.provider === 'azure'
    ? ['azure', 'elevenlabs']
    : ['elevenlabs', 'azure'];

  const resolveVoiceForPreview = (provider) => {
    if (provider === 'azure') {
      const presets = voiceConfig.azure?.presetVoices || voiceConfig.presetVoices || {};
      return presets?.[voiceOption]
        || voiceConfig.azure?.defaultVoice
        || presets.koala_warm
        || presets.koala_expert
        || Object.values(presets).find(Boolean)
        || voiceConfig.azure?.defaultVoice
        || null;
    }

    if (provider === 'elevenlabs') {
      const presets = voiceConfig.elevenLabs?.presetVoices || voiceConfig.presetVoices || {};
      return presets?.[voiceOption]
        || presets.koala_expert
        || presets.koala_warm
        || Object.values(presets).find(Boolean)
        || null;
    }

    return null;
  };

  const synthesizeAzurePreview = async (voiceName) => {
    const azure = voiceConfig.azure || {};
    if (!azure.key || !(azure.endpoint || azure.region)) {
      throw new Error('Azure Speech credentials not configured');
    }

    const endpoint = azure.endpoint || `https://${azure.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const headers = {
      'Ocp-Apim-Subscription-Key': azure.key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'FlynnAI-Preview/1.0',
    };

    if (!azure.endpoint && azure.region) {
      headers['Ocp-Apim-Subscription-Region'] = azure.region;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: buildAzureSsml(voiceName, text),
    });

    if (!response.ok) {
      throw new Error(await response.text() || `Azure TTS failed with status ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      audio: buffer.toString('base64'),
      contentType: response.headers.get('content-type') || 'audio/mpeg',
    };
  };

  const synthesizeElevenLabsPreview = async (voiceId) => {
    const eleven = voiceConfig.elevenLabs || {};
    if (!eleven.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': eleven.apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: eleven.modelId || 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.8,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text() || `ElevenLabs preview failed with status ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      audio: buffer.toString('base64'),
      contentType: response.headers.get('content-type') || 'audio/mpeg',
    };
  };

  try {
    let voiceId;

    if (voiceOption === 'custom_voice') {
      if (voiceConfig.provider !== 'elevenlabs') {
        return res.status(400).json({ error: 'Custom voice previews are only supported for ElevenLabs voices.' });
      }

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
      const preview = await synthesizeElevenLabsPreview(voiceId);
      return res.json(preview);
    }

    for (const provider of providerPriority) {
      try {
        if (provider === 'azure') {
          const voiceName = resolveVoiceForPreview('azure');
          if (!voiceName) {
            continue;
          }
          const preview = await synthesizeAzurePreview(voiceName);
          return res.json(preview);
        }

        if (provider === 'elevenlabs') {
          const presetVoiceId = resolveVoiceForPreview('elevenlabs');
          if (!presetVoiceId) {
            continue;
          }
          const preview = await synthesizeElevenLabsPreview(presetVoiceId);
          return res.json(preview);
        }
      } catch (error) {
        console.error(`[VoicePreview] ${provider} preview failed`, { error: error.message || error });
      }
    }

    return res.status(500).json({ error: 'Voice preview failed' });
  } catch (error) {
    console.error('[VoicePreview] Unexpected error', { error });
    return res.status(500).json({ error: 'Failed to generate voice preview' });
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

    if (!transcriptionClient || !transcriptionClient.audio || !transcriptionClient.audio.transcriptions) {
      console.error('[Telephony] No transcription provider configured; cannot transcribe.');
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

      const transcriptionResponse = await transcriptionClient.audio.transcriptions.create({
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

      if (llmClient) {
        try {
          await ensureJobForTranscript({
            callSid: CallSid,
            transcriptText,
            llmClient,
          });
        } catch (jobCreationError) {
          console.error('[Jobs] Failed to create job from transcript.', {
            callSid: CallSid,
            error: jobCreationError,
          });
        }
      } else {
        console.warn('[Jobs] Skipping job creation; no LLM client configured.', { callSid: CallSid });
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
  const httpServer = http.createServer(app);

  // Wrap WebSocket setup in try-catch to prevent startup failures
  if (receptionistEnabledGlobally) {
    try {
      attachRealtimeServer({
        httpServer,
        sessionCache: receptionistSessionCache,
        deepgramClient,
        llmClient,
        voiceConfig,
        onConversationComplete: handleRealtimeConversationComplete,
      });
      console.log('[Server] Realtime WebSocket server attached successfully');
    } catch (error) {
      console.error('[Server] Failed to attach realtime server, continuing without it:', error.message);
    }
  } else {
    console.log('[Server] Realtime receptionist disabled via ENABLE_CONVERSATION_ORCHESTRATOR');
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`[Server] FlynnAI telephony server listening on port ${port}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[Server] Health check available at http://localhost:${port}/health`);
  });

  httpServer.on('error', (error) => {
    console.error('[Server] Failed to start HTTP server:', error);
    process.exit(1);
  });
}

module.exports = app;
