const express = require('express');
const twilio = require('twilio');
const dotenv = require('dotenv');
const http = require('http');
const WebSocket = require('ws');
const { randomUUID } = require('crypto');
const Stripe = require('stripe');
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
  recordCallEvent,
  getBusinessContextForOrg,
} = require('./supabaseMcpClient');
const { sendJobCreatedNotification } = require('./notifications/pushService');
const { scrapeWebsite } = require('./services/websiteScraper');
const { generateReceptionistConfig } = require('./services/businessProfileGenerator');
const { generateSiteFromInstagram } = require('./services/sites/siteGenerationService');
const { generateSpeech: generateGeminiSpeech, resolveVoiceName: resolveGeminiVoice } = require('./services/geminiTTSService');
const reminderScheduler = require('./services/reminderScheduler');

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
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripeBasicPriceId = process.env.STRIPE_BASIC_PRICE_ID;
const stripeGrowthPriceId = process.env.STRIPE_GROWTH_PRICE_ID;
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

const computeReportPeriod = (period, customStartDate, customEndDate) => {
  const now = new Date();
  const startOfQuarter = (year, quarterIndex) => new Date(year, quarterIndex * 3, 1);
  const endOfQuarter = (year, quarterIndex) => new Date(year, quarterIndex * 3 + 3, 0, 23, 59, 59, 999);

  switch (period) {
    case 'currentQuarter': {
      const quarterIndex = Math.floor(now.getMonth() / 3);
      const year = now.getFullYear();
      return { start: startOfQuarter(year, quarterIndex), end: endOfQuarter(year, quarterIndex) };
    }
    case 'lastQuarter': {
      let quarterIndex = Math.floor(now.getMonth() / 3) - 1;
      let year = now.getFullYear();
      if (quarterIndex < 0) {
        quarterIndex = 3;
        year -= 1;
      }
      return { start: startOfQuarter(year, quarterIndex), end: endOfQuarter(year, quarterIndex) };
    }
    case 'currentFinancialYear': {
      // AU financial year: Jul 1 - Jun 30
      const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
      return { start: new Date(year, 6, 1), end: new Date(year + 1, 5, 30, 23, 59, 59, 999) };
    }
    case 'lastFinancialYear': {
      const year = now.getMonth() >= 6 ? now.getFullYear() - 1 : now.getFullYear() - 2;
      return { start: new Date(year, 6, 1), end: new Date(year + 1, 5, 30, 23, 59, 59, 999) };
    }
    case 'custom': {
      const start = customStartDate ? new Date(customStartDate) : null;
      const end = customEndDate ? new Date(customEndDate) : null;
      if (!start || Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime())) {
        return null;
      }
      return { start, end: new Date(end.getTime()) };
    }
    default:
      return null;
  }
};

const voicemailBucket = process.env.VOICEMAIL_STORAGE_BUCKET || 'voicemails';
const voicemailSignedUrlTtlSeconds = parseIntegerEnv(process.env.VOICEMAIL_SIGNED_URL_TTL_SECONDS, 3600);
const voicemailRetentionDays = parseIntegerEnv(process.env.VOICEMAIL_RETENTION_DAYS, 30);

const allowedSummaryTypes = new Set(['Payments', 'Earnings']);
const allowedSummaryPeriods = new Set([
  'currentQuarter',
  'lastQuarter',
  'currentFinancialYear',
  'lastFinancialYear',
  'custom',
]);

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

const deleteUserData = async (userId) => {
  if (!supabaseStorageClient) {
    throw new Error('Supabase client not configured for account deletion');
  }

  const tablesWithUserId = [
    'notification_tokens',
    'voice_profiles',
    'calls',
    'transcriptions',
    'call_events',
    'receptionist_configs',
    'call_flows',
    'phone_numbers',
    'business_profiles',
    'website_ingests',
    'onboarding_sessions',
    'jobs',
  ];

  for (const table of tablesWithUserId) {
    const { error } = await supabaseStorageClient.from(table).delete().eq('user_id', userId);
    if (error) {
      console.warn('[AccountDeletion] Failed to purge table', { table, userId, error });
    }
  }

  const { error: profileError } = await supabaseStorageClient.from('users').delete().eq('id', userId);
  if (profileError) {
    console.warn('[AccountDeletion] Failed to delete user profile row', { userId, error: profileError });
  }

  if (supabaseStorageClient.auth?.admin?.deleteUser) {
    try {
      await supabaseStorageClient.auth.admin.deleteUser(userId);
    } catch (error) {
      console.error('[AccountDeletion] Failed to delete auth user', { userId, error });
      throw error;
    }
  }
};

const stripeClient = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' })
  : null;

const planPriceMapping = {};
if (stripeBasicPriceId) {
  planPriceMapping[stripeBasicPriceId] = 'starter';
}
if (stripeGrowthPriceId) {
  planPriceMapping[stripeGrowthPriceId] = 'growth';
}

const knownPlanIds = new Set(['trial', 'starter', 'growth', 'enterprise']);

const resolvePlanFromPriceId = (priceId) => {
  if (!priceId) {
    return null;
  }
  return planPriceMapping[priceId] || null;
};

const normalizePlanId = (planId) => {
  if (!planId) {
    return null;
  }
  return knownPlanIds.has(planId) ? planId : null;
};

const updateOrganizationPlanById = async (orgId, planId) => {
  if (!supabaseStorageClient) {
    console.warn('[Billing] Supabase client unavailable; cannot update plan.');
    return false;
  }

  try {
    const { data, error } = await supabaseStorageClient
      .from('organizations')
      .update({ plan: planId, status: 'active' })
      .eq('id', orgId)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[Billing] Failed to update organization plan', { orgId, planId, error });
      return false;
    }

    if (!data) {
      console.warn('[Billing] Organization not found for plan update', { orgId });
      return false;
    }

    console.log('[Billing] Updated organization plan', { orgId, planId });
    return true;
  } catch (error) {
    console.error('[Billing] Unexpected error updating organization plan', { orgId, planId, error });
    return false;
  }
};

const updateOrganizationPlanByEmail = async (email, planId) => {
  if (!supabaseStorageClient) {
    console.warn('[Billing] Supabase client unavailable; cannot update plan by email.');
    return false;
  }

  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    return false;
  }

  try {
    const { data: userRow, error } = await supabaseStorageClient
      .from('users')
      .select('default_org_id')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (error) {
      console.error('[Billing] Failed to lookup user for email', { email: normalizedEmail, error });
      return false;
    }

    if (!userRow?.default_org_id) {
      console.warn('[Billing] No default organization found for user email', { email: normalizedEmail });
      return false;
    }

    return updateOrganizationPlanById(userRow.default_org_id, planId);
  } catch (error) {
    console.error('[Billing] Unexpected error resolving user by email', { email: normalizedEmail, error });
    return false;
  }
};

const applyPlanToOrganizationContext = async ({ orgId, email, planId }) => {
  const normalizedPlan = normalizePlanId(planId);
  if (!normalizedPlan) {
    console.warn('[Billing] Attempted to apply unknown plan', { planId });
    return;
  }

  let updated = false;
  if (orgId) {
    updated = await updateOrganizationPlanById(orgId, normalizedPlan);
  }

  if (!updated && email) {
    updated = await updateOrganizationPlanByEmail(email, normalizedPlan);
  }

  if (!updated) {
    console.warn('[Billing] Unable to map Stripe payment to organization', { orgId, email, planId: normalizedPlan });
  }
};

const resolvePlanFromCheckoutSession = async (session) => {
  const metadataPlan = normalizePlanId(session?.metadata?.planId || session?.metadata?.plan || null);
  if (metadataPlan) {
    return metadataPlan;
  }

  const fallback = resolvePlanFromPriceId(session?.metadata?.priceId);
  if (fallback) {
    return fallback;
  }

  if (!stripeClient) {
    return null;
  }

  try {
    const expandedSession = await stripeClient.checkout.sessions.retrieve(session.id, {
      expand: ['line_items.data.price'],
    });

    const lineItems = expandedSession?.line_items?.data ?? [];
    for (const item of lineItems) {
      const priceId = item?.price?.id;
      const planId = resolvePlanFromPriceId(priceId);
      if (planId) {
        return planId;
      }
    }
  } catch (error) {
    console.error('[Billing] Failed to expand checkout session for plan resolution', { sessionId: session?.id, error });
  }

  return null;
};

const handleCheckoutSessionCompleted = async (session) => {
  const planId = await resolvePlanFromCheckoutSession(session);
  if (!planId) {
    console.warn('[Billing] Checkout completed without recognised plan', { sessionId: session?.id });
    return;
  }

  const orgId = session?.client_reference_id || session?.metadata?.organizationId || null;
  const email = (session?.customer_details?.email || session?.customer_email || '').toLowerCase();

  await applyPlanToOrganizationContext({
    orgId,
    email,
    planId,
  });
};

const handleStripeWebhookEvent = async (event) => {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event.data.object);
      break;
    default:
      break;
  }
};

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
if (!transcriptionClient || transcriptionClient.provider === PROVIDERS.GROK || transcriptionClient.provider === PROVIDERS.GEMINI) {
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
  } else if (llmClient && (llmClient.provider === PROVIDERS.GROK || llmClient.provider === PROVIDERS.GEMINI)) {
    console.warn('[LLM] Non-OpenAI provider active without transcription fallback; voicemail transcription will be disabled.');
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
const elevenLabsModelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_flash_v2_5';
const elevenLabsPresetVoices = {
  flynn_warm: process.env.ELEVENLABS_VOICE_FLYNN_WARM_ID,
  flynn_expert: process.env.ELEVENLABS_VOICE_FLYNN_EXPERT_ID,
  flynn_hype: process.env.ELEVENLABS_VOICE_FLYNN_HYPE_ID,
  // Koala persona aliases used by receptionist configs
  koala_warm: process.env.ELEVENLABS_VOICE_KOALA_WARM_ID,
  koala_expert: process.env.ELEVENLABS_VOICE_KOALA_EXPERT_ID,
  koala_hype: process.env.ELEVENLABS_VOICE_KOALA_HYPE_ID,
};

const azureSpeechKey = process.env.AZURE_SPEECH_KEY ? process.env.AZURE_SPEECH_KEY.trim() : '';
const azureSpeechRegion = process.env.AZURE_SPEECH_REGION ? process.env.AZURE_SPEECH_REGION.trim() : '';
const azureSpeechEndpoint = process.env.AZURE_SPEECH_ENDPOINT ? process.env.AZURE_SPEECH_ENDPOINT.trim() : '';
const azureDefaultVoice = process.env.AZURE_TTS_DEFAULT_VOICE || 'en-AU-NatashaNeural';
const azurePresetVoices = {
  flynn_warm: process.env.AZURE_VOICE_FLYNN_WARM || azureDefaultVoice,
  flynn_expert: process.env.AZURE_VOICE_FLYNN_EXPERT || 'en-AU-WilliamNeural',
  flynn_hype: process.env.AZURE_VOICE_FLYNN_HYPE || 'en-AU-CarlyNeural',
  // Simple gender-based voices for Azure
  male: 'en-AU-WilliamNeural',
  female: 'en-AU-NatashaNeural',
};

// Gemini TTS Configuration (Google's latest superior TTS)
const geminiApiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
const geminiTtsModel = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
const geminiDefaultVoice = process.env.GEMINI_TTS_DEFAULT_VOICE || 'Kore';
const geminiPresetVoices = {
  flynn_warm: 'Sulafat',     // Warm voice
  flynn_expert: 'Kore',      // Firm, professional
  flynn_hype: 'Puck',        // Upbeat, energetic
  koala_warm: 'Sulafat',
  koala_expert: 'Kore',
  koala_hype: 'Puck',
  male: 'Orus',              // Firm male-sounding
  female: 'Aoede',           // Breezy female-sounding
};

const resolveTtsProvider = () => {
  const explicit = (process.env.TTS_PROVIDER || '').trim().toLowerCase();
  const hasGemini = Boolean(geminiApiKey);
  const hasAzure = Boolean(azureSpeechKey && (azureSpeechRegion || azureSpeechEndpoint));
  const hasEleven = Boolean(elevenLabsApiKey);

  if (!hasGemini && !hasAzure && !hasEleven) {
    return 'none';
  }

  if (explicit === 'gemini' && hasGemini) {
    return 'gemini';
  }
  if (explicit === 'azure' && hasAzure) {
    return 'azure';
  }
  if (explicit === 'elevenlabs' && hasEleven) {
    return 'elevenlabs';
  }

  // Default: prefer Gemini (superior quality), then Azure, then ElevenLabs
  if (hasGemini) return 'gemini';
  if (hasAzure) return 'azure';
  if (hasEleven) return 'elevenlabs';
  return 'none';
};

const ttsProvider = resolveTtsProvider();
const ttsCacheTtlMs = parseIntegerEnv(process.env.TTS_CACHE_TTL_MS, 15 * 60 * 1000);
const ttsCacheMaxEntries = parseIntegerEnv(process.env.TTS_CACHE_MAX_ENTRIES, 256);
const activePresetVoices =
  ttsProvider === 'gemini' ? geminiPresetVoices :
  ttsProvider === 'azure' ? azurePresetVoices :
  elevenLabsPresetVoices;
const voiceConfig = {
  provider: ttsProvider,
  presetVoices: activePresetVoices,
  cacheControl: {
    ttlMs: ttsCacheTtlMs,
    maxEntries: ttsCacheMaxEntries,
  },
  gemini: {
    apiKey: geminiApiKey,
    model: geminiTtsModel,
    defaultVoice: geminiDefaultVoice,
    presetVoices: geminiPresetVoices,
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
  hasGemini: Boolean(voiceConfig.gemini.apiKey),
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
    orgId: profile.default_org_id || profile.org_id || null,
    toNumber,
    startedAt: Date.now(),
    ackLibrary,
    greeting: (profile.receptionist_greeting || '').trim(),
    voiceOption: profile.receptionist_voice || 'flynn_warm',
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

  // Start call recording via Twilio REST API (runs in parallel with stream)
  if (twilioMessagingClient && callSid) {
    const recordingCallbackUrl = buildRecordingCallbackUrl(req);
    twilioMessagingClient.calls(callSid)
      .recordings
      .create({
        recordingStatusCallback: recordingCallbackUrl,
        recordingStatusCallbackMethod: 'POST',
      })
      .then((recording) => {
        console.log('[Telephony] Call recording started via API.', {
          callSid,
          recordingSid: recording.sid,
        });
      })
      .catch((error) => {
        console.error('[Telephony] Failed to start call recording.', {
          callSid,
          error: error.message,
        });
      });
  }

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

const handleRealtimeConversationComplete = async ({ callSid, userId, orgId, transcript, turns, reason }) => {
  if (!callSid) {
    return;
  }

  let callContext = null;
  try {
    callContext = await getCallBySid(callSid);
  } catch (error) {
    console.warn('[Realtime] Unable to load call context for event logging.', { callSid, error });
  }

  // Log AI call usage for billing
  if (orgId && userId) {
    try {
      const durationSeconds = callContext?.call_duration || 0;
      const callCostCents = 40; // $0.40 AUD per call
      const billingMonth = new Date();
      billingMonth.setDate(1);
      billingMonth.setHours(0, 0, 0, 0);

      await supabaseClient.from('ai_call_usage').insert({
        organization_id: orgId,
        user_id: userId,
        call_sid: callSid,
        call_duration_seconds: durationSeconds,
        call_cost_cents: callCostCents,
        billing_period_month: billingMonth.toISOString().split('T')[0],
      }).then(({ error }) => {
        if (error) {
          console.warn('[Billing] Failed to log call usage.', { callSid, orgId, error });
        } else {
          console.log('[Billing] Call usage logged successfully.', {
            callSid,
            orgId,
            userId,
            cost: `$${(callCostCents / 100).toFixed(2)} AUD`,
          });
        }
      });
    } catch (usageError) {
      console.error('[Billing] Error logging call usage.', { callSid, orgId, error: usageError });
    }
  }

  try {
    const existingTranscript = await getTranscriptByCallSid(callSid);

    if (!existingTranscript && transcript && transcript.trim().length > 0) {
      await insertTranscription({
        id: randomUUID(),
        callSid,
        userId: userId || null,
        orgId: orgId || null,
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
      orgId: orgId || null,
      status: reason === 'complete' ? 'completed' : 'ended',
    }).catch((error) => {
      console.error('[Realtime] Failed to upsert call record on conversation complete.', { callSid, userId, orgId, error });
    });

    if (transcript && transcript.trim().length > 4) {
      if (llmClient) {
        await ensureJobForTranscript({
          callSid,
          transcriptText: transcript,
          llmClient,
          userId,
          orgId,
        });
      } else {
        console.warn('[Jobs] Skipping job creation; no LLM client configured.', { callSid });
      }
    }

    await logCallEvent({
      orgId: callContext?.org_id || null,
      callSid,
      eventType: 'call_completed',
      direction: 'inbound',
      payload: {
        reason,
        turnCount: Array.isArray(turns) ? turns.length : 0,
        transcriptLength: transcript ? transcript.length : 0,
      },
    });

    // Explicitly end the live call to avoid lingering streams once we finish
    if (twilioMessagingClient && callSid) {
      try {
        await twilioMessagingClient.calls(callSid).update({ status: 'completed' });
        console.log('[Realtime] Ended Twilio call via REST API.', { callSid });
      } catch (error) {
        // 404 (code 20404) means call already ended naturally - this is fine, not an error
        if (error.status === 404 || error.code === 20404) {
          console.log('[Realtime] Call already ended naturally.', { callSid });
        } else {
          console.warn('[Realtime] Failed to end Twilio call via REST API.', { callSid, error });
        }
      }
    }
  } catch (error) {
    console.error('[Realtime] Failed to persist realtime conversation data.', { callSid, error });
  } finally {
    receptionistSessionCache.delete(callSid);
  }
};

if (stripeClient && stripeWebhookSecret) {
  app.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['stripe-signature'];

    let event;
    try {
      event = stripeClient.webhooks.constructEvent(req.body, signature, stripeWebhookSecret);
    } catch (error) {
      console.error('[Stripe] Webhook signature verification failed', error);
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    try {
      await handleStripeWebhookEvent(event);
      return res.status(200).json({ received: true });
    } catch (error) {
      console.error('[Stripe] Failed processing webhook event', error);
      return res.status(500).json({ error: 'Webhook handler error' });
    }
  });
} else {
  app.post('/stripe/webhook', (req, res) => {
    res.status(501).json({ error: 'Stripe webhook not configured' });
  });
}

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ========================================
// Payments Summary CSV (Mates Rates compatibility)
// ========================================
app.post('/downloadPaymentSummary', async (req, res) => {
  try {
    const {
      type,
      period,
      customStartDate,
      customEndDate,
    } = req.body || {};

    if (!allowedSummaryTypes.has(type)) {
      return res.status(400).json({ err: 'Invalid type. Use "Payments" or "Earnings".' });
    }

    if (!allowedSummaryPeriods.has(period)) {
      return res.status(400).json({ err: 'Invalid period selection.' });
    }

    const range = computeReportPeriod(period, customStartDate, customEndDate);
    if (!range) {
      return res.status(400).json({ err: 'Invalid or missing dates for custom period.' });
    }

    // TODO: Replace placeholder data with real transaction records when the data source is available.
    const rows = [
      ['Date', 'Type', 'Title', 'Client', 'Worker', 'Amount', 'Commission', 'Status', 'JobId'],
    ];

    // Example placeholder row for easier manual verification
    rows.push([
      range.start.toISOString().slice(0, 10),
      type,
      'Example job',
      'N/A',
      'N/A',
      '0.00',
      '0.00',
      'N/A',
      'sample-id',
    ]);

    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="payment_summary.csv"');
    return res.status(200).send(csv);
  } catch (error) {
    console.error('[PaymentsSummary] Failed to generate summary', error);
    return res.status(500).json({ err: 'Failed to generate payment summary.' });
  }
});

// ========================================
// Jobber Integration OAuth Endpoints
// ========================================

const JOBBER_CLIENT_ID = process.env.EXPO_PUBLIC_JOBBER_CLIENT_ID;
const JOBBER_CLIENT_SECRET = process.env.JOBBER_CLIENT_SECRET;
const JOBBER_REDIRECT_URI = process.env.EXPO_PUBLIC_JOBBER_REDIRECT_URI || 'https://flynnai-telephony.fly.dev/integrations/jobber/callback';
const JOBBER_TOKEN_URL = 'https://api.getjobber.com/api/oauth/token';
const JOBBER_API_BASE = 'https://api.getjobber.com/api/graphql';

/**
 * Jobber OAuth Callback
 * Handles the redirect from Jobber after user authorizes the app
 */
app.get('/integrations/jobber/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  console.log('[Jobber OAuth] Callback received:', {
    hasCode: !!code,
    state,
    error,
    error_description
  });

  // Handle authorization errors
  if (error) {
    console.error('[Jobber OAuth] Authorization error:', error, error_description);
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Jobber Connection Failed</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                   padding: 40px; text-align: center; background: #f5f5f5; }
            .container { max-width: 500px; margin: 0 auto; background: white;
                        padding: 40px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            h1 { color: #ef4444; font-size: 24px; margin-bottom: 16px; }
            p { color: #64748b; line-height: 1.6; }
            .error { background: #fee2e2; padding: 16px; border-radius: 8px; margin: 20px 0; }
            .error-code { font-family: monospace; color: #991b1b; }
            a { color: #2563eb; text-decoration: none; font-weight: 500; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Connection Failed</h1>
            <p>Failed to connect your Jobber account.</p>
            <div class="error">
              <strong>Error:</strong> <span class="error-code">${error}</span><br>
              ${error_description ? `<strong>Details:</strong> ${error_description}` : ''}
            </div>
            <p>Please try again or contact support if the issue persists.</p>
            <p><a href="javascript:window.close()">Close this window</a></p>
          </div>
        </body>
      </html>
    `);
  }

  if (!code) {
    console.error('[Jobber OAuth] No authorization code received');
    return res.status(400).send('Missing authorization code');
  }

  if (!JOBBER_CLIENT_ID || !JOBBER_CLIENT_SECRET) {
    console.error('[Jobber OAuth] Jobber credentials not configured');
    return res.status(500).send('Jobber integration not configured on server');
  }

  try {
    // Exchange authorization code for access token
    console.log('[Jobber OAuth] Exchanging code for token...');
    const tokenResponse = await fetch(JOBBER_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: JOBBER_CLIENT_ID,
        client_secret: JOBBER_CLIENT_SECRET,
        redirect_uri: JOBBER_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error('[Jobber OAuth] Token exchange failed:', errorData);
      throw new Error(`Token exchange failed: ${errorData.error_description || errorData.error || tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('[Jobber OAuth] Token received successfully');

    const { access_token, refresh_token, expires_in } = tokenData;
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Get account info from Jobber
    console.log('[Jobber OAuth] Fetching account info...');
    const accountQuery = `
      query {
        account {
          id
          name
        }
      }
    `;

    const accountResponse = await fetch(JOBBER_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`,
        'X-JOBBER-GRAPHQL-VERSION': '2024-09-10',
      },
      body: JSON.stringify({ query: accountQuery }),
    });

    if (!accountResponse.ok) {
      throw new Error(`Failed to fetch account info: ${accountResponse.statusText}`);
    }

    const accountData = await accountResponse.json();
    if (accountData.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(accountData.errors)}`);
    }

    const accountInfo = accountData.data.account;
    console.log('[Jobber OAuth] Account info retrieved:', accountInfo);

    // Extract org_id from state parameter (should be passed from frontend)
    // For now, we'll need to handle this based on session or require org_id in state
    const orgId = state; // Assuming state contains org_id

    if (!orgId) {
      console.error('[Jobber OAuth] No org_id in state parameter');
      return res.status(400).send('Missing organization identifier');
    }

    // Save connection to database
    console.log('[Jobber OAuth] Saving connection to database...');
    const { data: connection, error: dbError } = await supabaseAdmin
      .from('integration_connections')
      .upsert({
        org_id: orgId,
        provider: 'jobber',
        type: 'field_service',
        status: 'connected',
        access_token,
        refresh_token,
        token_expires_at: expiresAt,
        account_id: accountInfo.id,
        account_name: accountInfo.name,
        metadata: accountInfo,
        last_sync_at: null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'org_id,provider',
      })
      .select()
      .single();

    if (dbError) {
      console.error('[Jobber OAuth] Database error:', dbError);
      throw new Error(`Failed to save connection: ${dbError.message}`);
    }

    console.log('[Jobber OAuth] Connection saved successfully:', connection.id);

    // Return success page
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Jobber Connected Successfully</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                   padding: 40px; text-align: center; background: #f5f5f5; }
            .container { max-width: 500px; margin: 0 auto; background: white;
                        padding: 40px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            h1 { color: #10b981; font-size: 24px; margin-bottom: 16px; }
            p { color: #64748b; line-height: 1.6; }
            .success { background: #d1fae5; padding: 16px; border-radius: 8px; margin: 20px 0; color: #065f46; }
            .account { font-weight: 600; color: #1e293b; }
            .cta { display: inline-block; margin-top: 24px; padding: 12px 24px;
                   background: #2563eb; color: white; border-radius: 8px;
                   text-decoration: none; font-weight: 500; }
            .cta:hover { background: #1e40af; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ Jobber Connected!</h1>
            <p>Your Jobber account has been successfully connected to Flynn AI.</p>
            <div class="success">
              <strong>Account:</strong> <span class="account">${accountInfo.name}</span>
            </div>
            <p>Jobs created from missed calls will now automatically sync to your Jobber account.</p>
            <a href="javascript:window.close()" class="cta">Close & Return to Flynn AI</a>
          </div>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('[Jobber OAuth] Error during callback processing:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                   padding: 40px; text-align: center; background: #f5f5f5; }
            .container { max-width: 500px; margin: 0 auto; background: white;
                        padding: 40px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            h1 { color: #ef4444; font-size: 24px; margin-bottom: 16px; }
            p { color: #64748b; line-height: 1.6; }
            .error { background: #fee2e2; padding: 16px; border-radius: 8px; margin: 20px 0; }
            .error-msg { font-family: monospace; color: #991b1b; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Connection Error</h1>
            <p>An error occurred while connecting your Jobber account.</p>
            <div class="error">
              <div class="error-msg">${error.message}</div>
            </div>
            <p>Please try again or contact support@flynnai.com if the issue persists.</p>
            <p><a href="javascript:window.close()">Close this window</a></p>
          </div>
        </body>
      </html>
    `);
  }
});

/**
 * Jobber Webhook Endpoints
 * Handle real-time updates from Jobber (jobs created/updated, clients created/updated)
 */
app.post('/webhooks/jobber/job-created', async (req, res) => {
  console.log('[Jobber Webhook] Job created:', req.body);
  // TODO: Implement job created webhook handler
  res.status(200).json({ received: true });
});

app.post('/webhooks/jobber/job-updated', async (req, res) => {
  console.log('[Jobber Webhook] Job updated:', req.body);
  // TODO: Implement job updated webhook handler
  res.status(200).json({ received: true });
});

app.post('/webhooks/jobber/client-created', async (req, res) => {
  console.log('[Jobber Webhook] Client created:', req.body);
  // TODO: Implement client created webhook handler
  res.status(200).json({ received: true });
});

app.post('/webhooks/jobber/client-updated', async (req, res) => {
  console.log('[Jobber Webhook] Client updated:', req.body);
  // TODO: Implement client updated webhook handler
  res.status(200).json({ received: true });
});

// ========================================
// AI Testing API (for in-app receptionist testing)
// ========================================

// Transcribe audio using Whisper
app.post('/ai/transcribe', authenticateJwt, async (req, res) => {
  const multer = require('multer');
  const upload = multer({ storage: multer.memoryStorage() });

  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('[AI/Transcribe] Upload error:', err);
      return res.status(400).json({ error: 'Failed to upload audio file' });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
      }

      const llmClient = getLLMClient();
      const fileBuffer = req.file.buffer;

      // Convert buffer to File object for OpenAI
      const audioFile = await toFile(fileBuffer, 'audio.m4a', { type: 'audio/m4a' });

      const transcription = await llmClient.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
      });

      res.status(200).json({
        text: transcription.text || '',
      });
    } catch (error) {
      console.error('[AI/Transcribe] Error:', error);
      res.status(500).json({
        error: 'Failed to transcribe audio',
        details: error.message,
      });
    }
  });
});

// Generate AI chat response
app.post('/ai/chat', authenticateJwt, async (req, res) => {
  try {
    const { messages, model = 'gpt-4o-mini', temperature = 0.7, max_tokens = 150 } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const llmClient = getLLMClient();

    const response = await llmClient.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens,
    });

    res.status(200).json(response);
  } catch (error) {
    console.error('[AI/Chat] Error:', error);
    res.status(500).json({
      error: 'Failed to generate AI response',
      details: error.message,
    });
  }
});

// Extract job details from conversation
app.post('/ai/extract-job', authenticateJwt, async (req, res) => {
  try {
    const { transcript } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    const llmClient = getLLMClient();

    const extractionPrompt = `Extract job booking details from this conversation transcript. Return ONLY valid JSON with these fields:
{
  "clientName": string or null,
  "clientPhone": string or null,
  "clientEmail": string or null,
  "serviceType": string or null,
  "scheduledDate": string (YYYY-MM-DD) or null,
  "scheduledTime": string (HH:MM) or null,
  "location": string or null,
  "notes": string or null,
  "urgency": "low" | "medium" | "high" | null,
  "confidence": number (0-1)
}

Transcript:
${transcript}`;

    const response = await llmClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that extracts structured job data from conversation transcripts. Always respond with valid JSON.' },
        { role: 'user', content: extractionPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const extracted = JSON.parse(response.choices[0].message.content || '{}');

    res.status(200).json({
      job: extracted,
    });
  } catch (error) {
    console.error('[AI/ExtractJob] Error:', error);
    res.status(500).json({
      error: 'Failed to extract job details',
      details: error.message,
    });
  }
});

// ========================================
// Website Scraping & Business Profile API
// ========================================

// FlynnAI Sites: Instagram -> Gemini -> site spec
app.post('/api/sites/generate', authenticateJwt, async (req, res) => {
  const { handle, imageLimit = 12 } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!handle) {
    return res.status(400).json({ error: 'Instagram handle is required' });
  }

  const normalizedHandle = String(handle).replace(/^@/, '').trim();

  try {
    const result = await generateSiteFromInstagram({
      handle: normalizedHandle,
      imageLimit: Math.min(Math.max(Number.parseInt(imageLimit, 10) || 12, 1), 25),
    });

    res.status(200).json({
      success: true,
      handle: normalizedHandle,
      ...result,
    });
  } catch (error) {
    console.error('[Sites] Failed to generate site from Instagram', { error });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate site',
    });
  }
});

/**
 * Scrape a business website and extract relevant information
 * Uses OpenAI to intelligently parse website content
 */
/**
 * Scrape website and generate AI receptionist configuration
 * POST /api/scrape-website
 * Body: { url: string, applyConfig?: boolean }
 */
app.post('/api/scrape-website', authenticateJwt, async (req, res) => {
  const { url, applyConfig = false } = req.body;
  const userId = req.user?.id;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  console.log('[API] Scraping website and generating config:', { url, userId, applyConfig });

  try {
    // Step 1: Scrape the website
    const scrapedData = await scrapeWebsite(url);

    // Step 2: Generate receptionist configuration
    const config = await generateReceptionistConfig(scrapedData);

    // Step 3: Optionally apply config to user's settings
    if (applyConfig) {
      if (!supabaseStorageClient) {
        throw new Error('Supabase client not configured');
      }

      const { error } = await supabaseStorageClient
        .from('users')
        .update({
          receptionist_greeting: config.greetingScript,
          receptionist_questions: config.intakeQuestions,
          receptionist_business_profile: config.businessProfile,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        console.error('[API] Failed to apply config:', error);
        throw new Error('Failed to apply configuration to user settings');
      }

      console.log('[API] Successfully applied receptionist config to user:', userId);
    }

    res.status(200).json({
      success: true,
      url,
      scraped_at: scrapedData.scrapedAt,
      config: {
        businessProfile: config.businessProfile,
        greetingScript: config.greetingScript,
        intakeQuestions: config.intakeQuestions,
      },
      applied: applyConfig,
    });
  } catch (error) {
    console.error('[API] Error scraping website:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to scrape website and generate configuration',
    });
  }
});

/**
 * Apply generated receptionist configuration to user settings
 * POST /api/receptionist/apply-config
 * Body: { greetingScript: string, intakeQuestions: string[], businessProfile: object }
 */
app.post('/api/receptionist/apply-config', authenticateJwt, async (req, res) => {
  const { greetingScript, intakeQuestions, businessProfile } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!greetingScript && !intakeQuestions && !businessProfile) {
    return res.status(400).json({ error: 'At least one configuration field is required' });
  }

  console.log('[API] Applying receptionist config:', { userId, hasGreeting: !!greetingScript, questionsCount: intakeQuestions?.length || 0 });

  try {
    if (!supabaseStorageClient) {
      throw new Error('Supabase client not configured');
    }

    const updates = {
      updated_at: new Date().toISOString(),
    };

    if (greetingScript) {
      updates.receptionist_greeting = greetingScript;
    }

    if (intakeQuestions && Array.isArray(intakeQuestions)) {
      updates.receptionist_questions = intakeQuestions;
    }

    if (businessProfile) {
      updates.receptionist_business_profile = businessProfile;
    }

    const { error } = await supabaseStorageClient
      .from('users')
      .update(updates)
      .eq('id', userId);

    if (error) {
      console.error('[API] Failed to apply config:', error);
      throw new Error('Failed to apply configuration');
    }

    console.log('[API] Successfully applied receptionist config');

    res.status(200).json({
      success: true,
      applied: Object.keys(updates).filter(k => k !== 'updated_at'),
    });
  } catch (error) {
    console.error('[API] Error applying config:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to apply configuration',
    });
  }
});

/**
 * Get business profile for organization (called by AI during calls)
 */
app.get('/api/business-profile/:orgId', async (req, res) => {
  const { orgId } = req.params;

  if (!orgId) {
    return res.status(400).json({ error: 'Organization ID required' });
  }

  try {
    console.log('[Business Profile] Fetching profile for org:', orgId);

    // Use the Supabase function to get business context
    const { data, error } = await supabaseAdmin.rpc('get_business_context_for_org', {
      p_org_id: orgId,
    });

    if (error) {
      console.error('[Business Profile] Database error:', error);
      throw new Error(error.message);
    }

    if (!data) {
      return res.status(404).json({ error: 'Business profile not found' });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('[Business Profile] Error:', error);
    res.status(500).json({ error: 'Failed to get business profile' });
  }
});

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

const downloadTwilioRecording = async (recordingUrl, recordingSid) => {
  if (!recordingUrl) {
    throw new Error('RecordingUrl is required to download audio.');
  }

  if (!twilioAccountSid || !twilioAuthToken) {
    throw new Error('Twilio credentials are not configured.');
  }

  // First, try using Twilio SDK to fetch the recording (works with regional endpoints)
  if (recordingSid && twilioMessagingClient) {
    try {
      console.log('[Telephony] Attempting to download recording via Twilio SDK.', {
        recordingSid,
        recordingUrl,
      });

      const recording = await twilioMessagingClient.recordings(recordingSid).fetch();

      // Get the media URL with proper authentication
      const mediaUrl = `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`;

      const authHeader = `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64')}`;

      const response = await fetch(mediaUrl, {
        headers: {
          Authorization: authHeader,
        },
      });

      if (response.ok && isAudioResponse(response, mediaUrl)) {
        console.log('[Telephony] Successfully downloaded recording via Twilio SDK.', {
          recordingSid,
          url: mediaUrl,
        });
        return { response, resolvedUrl: mediaUrl };
      }

      console.warn('[Telephony] Twilio SDK recording fetch returned unexpected response.', {
        url: mediaUrl,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
      });
    } catch (sdkError) {
      console.warn('[Telephony] Failed to download recording via Twilio SDK, falling back to direct URL fetch.', {
        recordingSid,
        error: sdkError.message,
      });
    }
  }

  // Fallback: Try direct URL fetch with Basic Auth
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

  const payload = { to, body };

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

const logCallEvent = async ({
  orgId,
  numberId = null,
  callSid = null,
  eventType,
  direction = null,
  payload = {},
}) => {
  if (!orgId || !eventType) {
    return;
  }

  try {
    await recordCallEvent({
      orgId,
      numberId,
      callSid,
      eventType,
      direction,
      payload,
      occurredAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('[CallEvents] Failed to record event.', {
      orgId,
      numberId,
      callSid,
      eventType,
      error: error?.message || error,
    });
  }
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

    const orgId = receptionistProfile?.default_org_id || null;

    if (callSid) {
      await upsertCallRecord({
        callSid,
        userId: receptionistProfile?.id || null,
        orgId,
        fromNumber,
        toNumber,
        status: 'ringing',
      }).catch((error) => {
        console.warn('[Telephony] Failed to upsert initial call record.', { callSid, error });
      });
    }

    await logCallEvent({
      orgId,
      callSid,
      eventType: 'call_inbound_received',
      direction: 'inbound',
      payload: {
        fromNumber,
        toNumber,
        stage,
        receptionistMode: receptionistProfile?.receptionist_mode || null,
        conversationalPath: Boolean(receptionistProfile),
      },
    });

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
      await logCallEvent({
        orgId,
        callSid,
        eventType: 'call_routed_voicemail',
        direction: 'inbound',
        payload: {
          reason: 'conversational_path_unavailable',
          receptionistConfigured,
          receptionistEnabledGlobally,
          hasLLM: hasLLMProvider,
          hasElevenLabs,
          hasDeepgram,
        },
      });
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
      await logCallEvent({
        orgId,
        callSid,
        eventType: 'call_routed_voicemail',
        direction: 'inbound',
        payload: { reason: 'voicemail_only_mode' },
      });
      console.log('[Telephony] Receptionist mode is voicemail_only, routing to voicemail.', { callSid });
      return respondWithVoicemail(req, res, inboundParams);
    }

    if (receptionistMode === 'hybrid_choice' && stage === 'initial') {
      return respondWithHybridChoice(req, res, inboundParams, receptionistProfile);
    }

    if (receptionistMode === 'hybrid_choice' && stage === 'choice') {
      const decision = stageDecision || interpretHybridChoice(inboundParams);
      if (decision === 'voicemail') {
        await logCallEvent({
          orgId,
          callSid,
          eventType: 'call_routed_voicemail',
          direction: 'inbound',
          payload: { reason: 'hybrid_choice_voicemail' },
        });
        return respondWithVoicemail(req, res, inboundParams);
      }
      // default to AI receptionist when uncertain
    }

    // Check subscription status before allowing AI receptionist
    if (orgId) {
      try {
        const { data: org, error: orgError } = await supabaseClient
          .from('organizations')
          .select('billing_plan_id, subscription_status')
          .eq('id', orgId)
          .single();

        if (orgError) {
          console.warn('[Telephony] Failed to check organization billing status.', { orgId, error: orgError });
        } else {
          const isPaidPlan = org?.billing_plan_id && org.billing_plan_id !== 'trial';
          const isActiveSubscription = ['active', 'trialing'].includes(org?.subscription_status);

          if (!isPaidPlan || !isActiveSubscription) {
            console.log('[Telephony] Organization subscription inactive, routing to voicemail.', {
              callSid,
              orgId,
              billingPlan: org?.billing_plan_id,
              subscriptionStatus: org?.subscription_status,
            });

            await logCallEvent({
              orgId,
              callSid,
              eventType: 'call_routed_voicemail',
              direction: 'inbound',
              payload: {
                reason: 'subscription_inactive',
                billingPlan: org?.billing_plan_id,
                subscriptionStatus: org?.subscription_status,
              },
            });

            return respondWithVoicemail(req, res, inboundParams);
          }
        }
      } catch (billingCheckError) {
        console.error('[Telephony] Error checking billing status.', { orgId, error: billingCheckError });
        // On error, allow call through to avoid breaking existing users
      }
    }

    if (callSid) {
      await upsertCallRecord({
        callSid,
        userId: receptionistProfile?.id || null,
        orgId,
        fromNumber,
        toNumber,
        status: 'ai_engaged',
      }).catch((error) => {
        console.warn('[Telephony] Failed to update call status to ai_engaged.', { callSid, error });
      });

      await logCallEvent({
        orgId,
        callSid,
        eventType: 'ai_receptionist_engaged',
        direction: 'inbound',
        payload: { receptionistMode },
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

  const providerPriority =
    voiceConfig.provider === 'gemini' ? ['gemini', 'azure', 'elevenlabs'] :
    voiceConfig.provider === 'azure' ? ['azure', 'gemini', 'elevenlabs'] :
    ['elevenlabs', 'gemini', 'azure'];

  const resolveVoiceForPreview = (provider) => {
    if (provider === 'gemini') {
      const presets = voiceConfig.gemini?.presetVoices || voiceConfig.presetVoices || {};
      return presets?.[voiceOption]
        || voiceConfig.gemini?.defaultVoice
        || presets.flynn_expert
        || presets.flynn_warm
        || Object.values(presets).find(Boolean)
        || 'Kore';
    }

    if (provider === 'azure') {
      const presets = voiceConfig.azure?.presetVoices || voiceConfig.presetVoices || {};
      return presets?.[voiceOption]
        || voiceConfig.azure?.defaultVoice
        || presets.flynn_warm
        || presets.flynn_expert
        || Object.values(presets).find(Boolean)
        || voiceConfig.azure?.defaultVoice
        || null;
    }

    if (provider === 'elevenlabs') {
      const presets = voiceConfig.elevenLabs?.presetVoices || voiceConfig.presetVoices || {};
      return presets?.[voiceOption]
        || presets.flynn_expert
        || presets.flynn_warm
        || Object.values(presets).find(Boolean)
        || null;
    }

    return null;
  };

  const synthesizeGeminiPreview = async (voiceName) => {
    const gemini = voiceConfig.gemini || {};
    if (!gemini.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const result = await generateGeminiSpeech(gemini.apiKey, text, {
      voiceName: voiceName || gemini.defaultVoice,
      model: gemini.model,
      outputFormat: 'wav',
      style: 'professional and friendly',
    });

    return {
      audio: result.audio,
      contentType: result.contentType,
    };
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
        if (provider === 'gemini') {
          const voiceName = resolveVoiceForPreview('gemini');
          if (!voiceName) {
            continue;
          }
          const preview = await synthesizeGeminiPreview(voiceName);
          return res.json(preview);
        }

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
      ({ response: recordingResponse, resolvedUrl } = await downloadTwilioRecording(RecordingUrl, RecordingSid));
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

    let callEventContext = null;
    try {
      callEventContext = await getCallBySid(CallSid);
    } catch (contextError) {
      console.warn('[Telephony] Unable to load call context for recording event.', {
        callSid: CallSid,
        error: contextError,
      });
    }

    await logCallEvent({
      orgId: callEventContext?.org_id || null,
      callSid: CallSid,
      eventType: 'recording_stored',
      direction: 'inbound',
      payload: {
        durationSec,
        recordingSid: RecordingSid,
        storagePath: storageMetadata?.storagePath,
      },
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
        userId: callEventContext?.user_id || null,
        orgId: callEventContext?.org_id || null,
        engine: 'whisper',
        text: transcriptText,
        confidence: 0.8,
        language: transcriptLanguage,
      });

      await updateCallTranscriptionStatus({ callSid: CallSid, status: 'completed' });

      await logCallEvent({
        orgId: callEventContext?.org_id || null,
        callSid: CallSid,
        eventType: 'transcription_completed',
        direction: 'inbound',
        payload: {
          recordingSid: RecordingSid,
          transcriptLength: transcriptText.length,
          language: transcriptLanguage,
        },
      });

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

          await logCallEvent({
            orgId: callEventContext?.org_id || null,
            callSid: CallSid,
            eventType: 'job_creation_failed',
            direction: 'inbound',
            payload: { reason: jobCreationError?.message || 'unknown' },
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

      await logCallEvent({
        orgId: callEventContext?.org_id || null,
        callSid: CallSid,
        eventType: 'transcription_failed',
        direction: 'inbound',
        payload: {
          recordingSid: RecordingSid,
          error: transcriptionError?.message || 'unknown',
        },
      });
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

app.post('/me/account/delete', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!supabaseStorageClient) {
    return res.status(503).json({ error: 'Account deletion is not available right now' });
  }

  try {
    await deleteUserData(userId);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[AccountDeletion] Failed to delete account', { userId, error });
    return res.status(500).json({ error: 'Failed to delete account' });
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

// ============================================================================
// Reminder System API Endpoints
// ============================================================================

// GET /api/reminders/settings - Get reminder settings for organization
app.get('/api/reminders/settings', authenticateJwt, async (req, res) => {
  try {
    const orgId = req.user?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    const { data, error } = await supabaseStorageClient
      .from('reminder_settings')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found, which is OK
      throw error;
    }

    // Return default settings if none exist
    if (!data) {
      return res.status(200).json({
        enabled: true,
        default_enabled: true,
        confirmation_enabled: true,
        one_day_before_enabled: true,
        one_day_before_time: '18:00',
        morning_of_enabled: false,
        morning_of_time: '08:00',
        two_hours_before_enabled: false,
        custom_reminders: [],
        skip_weekends_for_morning: false,
        respect_quiet_hours: true,
        quiet_hours_start: '21:00',
        quiet_hours_end: '08:00',
        post_job_enabled: false,
        post_job_delay_hours: 2,
        confirmation_template: 'Hi {{clientName}}! Your {{serviceType}} appointment is confirmed for {{date}} at {{time}} at {{location}}. Reply YES to confirm.',
        one_day_before_template: 'Hi {{clientName}}! Reminder: We\'ll see you tomorrow at {{time}} for {{serviceType}} at {{location}}.',
        morning_of_template: 'Good morning {{clientName}}! We\'re looking forward to seeing you today at {{time}} for {{serviceType}}.',
        two_hours_before_template: 'Hi {{clientName}}! We\'ll be there in about 2 hours for your {{serviceType}} appointment.',
        on_the_way_template: 'Hi {{clientName}}! We\'re on our way to your location. We\'ll arrive in approximately {{eta}} minutes.',
        post_job_template: 'Thanks for choosing {{businessName}}! Your job is complete. We\'d love your feedback!',
      });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('[Reminders] Error fetching reminder settings:', error);
    res.status(500).json({ error: 'Failed to fetch reminder settings' });
  }
});

// PUT /api/reminders/settings - Update reminder settings
app.put('/api/reminders/settings', authenticateJwt, async (req, res) => {
  try {
    const orgId = req.user?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    const settings = req.body;

    const { data, error } = await supabaseStorageClient
      .from('reminder_settings')
      .upsert({
        org_id: orgId,
        ...settings,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log('[Reminders] Settings updated for org:', orgId);
    res.status(200).json(data);
  } catch (error) {
    console.error('[Reminders] Error updating reminder settings:', error);
    res.status(500).json({ error: 'Failed to update reminder settings' });
  }
});

// GET /api/jobs/:jobId/reminders - List reminders for a job
app.get('/api/jobs/:jobId/reminders', authenticateJwt, async (req, res) => {
  try {
    const { jobId } = req.params;
    const orgId = req.user?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    const { data, error } = await supabaseStorageClient
      .from('scheduled_reminders')
      .select('*')
      .eq('org_id', orgId)
      .eq('job_id', jobId)
      .order('scheduled_for', { ascending: true });

    if (error) {
      throw error;
    }

    res.status(200).json(data || []);
  } catch (error) {
    console.error('[Reminders] Error fetching job reminders:', error);
    res.status(500).json({ error: 'Failed to fetch job reminders' });
  }
});

// POST /api/jobs/:jobId/reminders/reschedule - Reschedule reminders for a job
app.post('/api/jobs/:jobId/reminders/reschedule', authenticateJwt, async (req, res) => {
  try {
    const { jobId } = req.params;
    const orgId = req.user?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    const result = await reminderScheduler.scheduleRemindersForJob(jobId, orgId);

    console.log('[Reminders] Rescheduled reminders for job:', jobId);
    res.status(200).json(result);
  } catch (error) {
    console.error('[Reminders] Error rescheduling reminders:', error);
    res.status(500).json({ error: 'Failed to reschedule reminders' });
  }
});

// POST /api/jobs/:jobId/reminders/on-the-way - Send "on the way" notification
app.post('/api/jobs/:jobId/reminders/on-the-way', authenticateJwt, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { eta = 15 } = req.body;

    const result = await reminderScheduler.sendOnTheWayNotification(jobId, eta);

    console.log('[Reminders] Sent on-the-way notification for job:', jobId);
    res.status(200).json(result);
  } catch (error) {
    console.error('[Reminders] Error sending on-the-way notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// DELETE /api/reminders/:reminderId - Cancel a reminder
app.delete('/api/reminders/:reminderId', authenticateJwt, async (req, res) => {
  try {
    const { reminderId } = req.params;
    const orgId = req.user?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    const { error } = await supabaseStorageClient
      .from('scheduled_reminders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', reminderId)
      .eq('org_id', orgId);

    if (error) {
      throw error;
    }

    console.log('[Reminders] Cancelled reminder:', reminderId);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Reminders] Error cancelling reminder:', error);
    res.status(500).json({ error: 'Failed to cancel reminder' });
  }
});

// GET /api/reminders/stats - Get reminder statistics
app.get('/api/reminders/stats', authenticateJwt, async (req, res) => {
  try {
    const orgId = req.user?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    const { startDate, endDate } = req.query;
    const stats = await reminderScheduler.getReminderStats(
      orgId,
      startDate ? new Date(startDate).toISOString() : null,
      endDate ? new Date(endDate).toISOString() : null
    );

    res.status(200).json(stats);
  } catch (error) {
    console.error('[Reminders] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch reminder statistics' });
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
        getBusinessContextForOrg,
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

  // ============================================================================
  // Cron Job: Process Pending Reminders
  // ============================================================================

  // Process reminders every minute
  setInterval(async () => {
    try {
      await reminderScheduler.processPendingReminders();
    } catch (error) {
      console.error('[Cron] Reminder processor error:', error);
    }
  }, 60 * 1000); // Every 60 seconds

  console.log('[Server] Reminder processor scheduled (runs every 60 seconds)');
}

module.exports = app;
