const { Buffer } = require('buffer');
const EventEmitter = require('events');
const {
  generateSpeech: generateGeminiSpeech,
  detectLocationFromProfile,
  getAccentFromLocation
} = require('../services/geminiTTSService');
let LiveTranscriptionEvents = { Open: 'open', Close: 'close', Error: 'error', Transcript: 'transcript' };
try {
  ({ LiveTranscriptionEvents } = require('@deepgram/sdk'));
} catch (err) {
  // Optional dependency: server will operate without live transcription
  console.warn('[Startup] @deepgram/sdk not found; using fallback event names.');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ACTIVE_LLM_PROVIDER = (() => {
  const explicit = (process.env.LLM_PROVIDER || '').trim().toLowerCase();
  if (explicit) {
    return explicit;
  }
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    return 'gemini';
  }
  return (process.env.XAI_API_KEY || process.env.GROK_API_KEY) ? 'grok' : 'openai';
})();

const DEFAULT_RECEPTIONIST_MODEL = process.env.RECEPTIONIST_MODEL
  || (ACTIVE_LLM_PROVIDER === 'gemini' ? 'gemini-2.5-flash' :
      ACTIVE_LLM_PROVIDER === 'grok' ? 'grok-4-fast' : 'gpt-4o-mini');

// Fastest ElevenLabs text-to-speech model for realtime phone usage
const ELEVEN_LABS_FAST_MODEL = process.env.ELEVEN_LABS_MODEL_ID || 'eleven_flash_v2_5';

// Gemini TTS Configuration for realtime calls
const GEMINI_TTS_ENABLED = Boolean(process.env.GEMINI_API_KEY);
const GEMINI_TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
const GEMINI_TTS_DEFAULT_VOICE = process.env.GEMINI_TTS_DEFAULT_VOICE || 'Kore';

const normaliseChoiceContent = (choice) => {
  if (!choice) {
    return null;
  }

  const candidate = choice.message?.content ?? choice.content ?? choice.text;
  if (typeof candidate === 'string') {
    return candidate;
  }

  if (Array.isArray(candidate)) {
    return candidate.map((entry) => {
      if (typeof entry === 'string') {
        return entry;
      }
      if (entry?.text) {
        return entry.text;
      }
      if (entry?.content) {
        return entry.content;
      }
      return '';
    }).join('');
  }

  return null;
};

const TTS_DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000;
const TTS_DEFAULT_CACHE_MAX_ENTRIES = 256;
const ttsAudioCache = new Map();

const escapeSsml = (text) => text
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/\"/g, '&quot;')
  .replace(/'/g, '&apos;');

const deriveVoiceLanguage = (voiceName) => {
  if (!voiceName || typeof voiceName !== 'string') {
    return 'en-AU';
  }
  const parts = voiceName.split('-');
  if (parts.length >= 2) {
    return `${parts[0]}-${parts[1]}`;
  }
  return 'en-AU';
};

const buildSsml = (text, voiceName) => (
  `<speak version=\"1.0\" xml:lang=\"${deriveVoiceLanguage(voiceName)}\"><voice name=\"${voiceName}\">${escapeSsml(text)}</voice></speak>`
);

const getCachedAudio = (key, ttlMs) => {
  if (!key) {
    return null;
  }
  const entry = ttsAudioCache.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() - entry.timestamp > ttlMs) {
    ttsAudioCache.delete(key);
    return null;
  }

  return entry.buffer;
};

const setCachedAudio = (key, buffer, maxEntries) => {
  if (!key || !buffer) {
    return;
  }

  ttsAudioCache.set(key, {
    buffer,
    timestamp: Date.now(),
  });

  while (ttsAudioCache.size > maxEntries) {
    const [oldestKey] = ttsAudioCache.keys();
    if (!oldestKey) {
      break;
    }
    ttsAudioCache.delete(oldestKey);
  }
};

const createSystemPrompt = async (session, getBusinessContextForOrg) => {
  const greeting = session?.greeting
    ? `Greeting script:\n"""${session.greeting}"""\n\nDo not greet the caller yourself; the system plays the greeting.`
    : '';

  const questionBlock = session?.questions?.length
    ? `Intake questions (ask these naturally in your responses):\n${session.questions.map((q, idx) => `  ${idx + 1}. ${q}`).join('\n')}\n\nImportant: After acknowledging the caller's answer, smoothly transition to the next question. Ask questions in order. Track which questions you've already asked and don't repeat them.`
    : 'Collect the caller\'s name, contact details, service request, timing, and location.';

  const businessFacts = session?.businessProfile
    ? `Business profile data:\n${JSON.stringify(session.businessProfile)}\n`
    : '';

  const businessType = session?.businessType
    ? `The business specialises in ${session.businessType.replace(/_/g, ' ')}.`
    : '';

  // Fetch business context from database if orgId is available
  let businessContext = '';
  if (session?.orgId && getBusinessContextForOrg) {
    try {
      const contextData = await getBusinessContextForOrg(session.orgId);
      if (contextData) {
        businessContext = formatBusinessContext(contextData);
      }
    } catch (error) {
      console.error('[Realtime] Failed to fetch business context:', error);
    }
  }

  // Handle hybrid_choice mode - offer caller option to leave message or book
  const receptionistMode = session?.receptionistMode || 'ai_only';
  const hybridModeInstructions = receptionistMode === 'hybrid_choice'
    ? `CALLER CHOICE MODE:
- At the start of the conversation (after the greeting), ask: "Would you like to leave a message, or would you prefer to book an appointment with me now?"
- If they choose "leave a message": Say "No worries! Please leave your message after the beep, and we'll get back to you soon." Then END THE CALL.
- If they choose "book an appointment" or "book now" or similar: Proceed with the intake questions to capture their booking details.
- If they're unsure, briefly explain: "I can take your details now and get you booked in, or you can just leave a message. What works better for you?"`
    : '';

  return [
    'You are Flynn, a casual and friendly AI receptionist for a service business.',
    '',
    hybridModeInstructions,
    '',
    'CONVERSATION STYLE:',
    '- Talk like a real person - casual, warm, natural',
    '- Use casual acknowledgments: "Cool", "Awesome", "Perfect", "No worries", "Sounds good"',
    '- Keep responses SHORT (5-10 words max) - you\'re on a phone call, not writing an essay',
    '- Let callers talk as much as they want - they often give ALL the info upfront',
    '- Be friendly but efficient - don\'t waste their time',
    '',
    'LISTENING & EXTRACTING INFO:',
    '- Callers usually give MULTIPLE details in one go ("I need a removal on Saturday at 8am, we have stairs...")',
    '- LISTEN CAREFULLY and extract ALL information they provide',
    '- Track what you already know from what they\'ve said',
    '- Don\'t ask questions if you already have the answer from their previous message',
    '',
    'SMART FOLLOW-UPS:',
    '- ONLY ask about information that\'s MISSING',
    '- If they mentioned stairs, DON\'T ask about elevator access',
    '- If they mentioned a date/time, DON\'T ask when they want it',
    '- If they already gave their phone number, DON\'T ask for contact info',
    '- Use context clues - if they said "we have a lift", that means no stairs',
    '',
    'QUESTION STRATEGY:',
    questionBlock,
    '- Ask ONE question at a time, and only if that info wasn\'t already provided',
    '- Acknowledge what they said FIRST with something casual, THEN ask your follow-up',
    '- Example: "Cool, Saturday morning works. And what\'s the best number to reach you?"',
    '',
    'ENDING THE CALL:',
    '- Once you have: name, contact info, service details, and timing → CONFIRM and hang up',
    '- Confirmation format: "Perfect! So I\'ve got you down for [service] on [date/time]. We\'ll call you at [phone] to confirm. Sound good?"',
    '- After they confirm, say: "Awesome, we\'ll be in touch soon!" and END THE CALL',
    '- DO NOT keep chatting after confirmation - wrap it up',
    '',
    businessType,
    businessFacts,
    businessContext,
    greeting,
  ].filter(Boolean).join('\n\n');
};

/**
 * Format business context data for AI prompt
 */
const formatBusinessContext = (contextData) => {
  if (!contextData) return '';

  const sections = [];

  // Business name and type
  if (contextData.business_name) {
    sections.push(`Business: ${contextData.business_name}`);
  }
  if (contextData.business_type) {
    sections.push(`Type: ${contextData.business_type}`);
  }

  // Services
  if (contextData.services && Array.isArray(contextData.services) && contextData.services.length > 0) {
    const servicesList = contextData.services
      .map((s) => {
        let line = `- ${s.name}`;
        if (s.description) line += `: ${s.description}`;
        if (s.price_range) line += ` (${s.price_range})`;
        return line;
      })
      .join('\n');
    sections.push(`Services offered:\n${servicesList}`);
  }

  // Pricing
  if (contextData.pricing_notes) {
    sections.push(`Pricing: ${contextData.pricing_notes}`);
  }

  // Business hours
  if (contextData.business_hours) {
    const hoursText = formatBusinessHours(contextData.business_hours);
    if (hoursText) {
      sections.push(`Business hours:\n${hoursText}`);
    }
  }

  // Location
  if (contextData.service_area) {
    sections.push(`Service area: ${contextData.service_area}`);
  } else if (contextData.city && contextData.state) {
    sections.push(`Location: ${contextData.city}, ${contextData.state}`);
  }

  // Policies
  if (contextData.cancellation_policy) {
    sections.push(`Cancellation policy: ${contextData.cancellation_policy}`);
  }
  if (contextData.payment_terms) {
    sections.push(`Payment terms: ${contextData.payment_terms}`);
  }
  if (contextData.booking_notice) {
    sections.push(`Booking notice: ${contextData.booking_notice}`);
  }

  // Custom AI instructions
  if (contextData.ai_instructions) {
    sections.push(`Special instructions: ${contextData.ai_instructions}`);
  }

  return sections.length > 0
    ? `Business Profile:\n${sections.join('\n')}`
    : '';
};

/**
 * Format business hours for display
 */
const formatBusinessHours = (hours) => {
  if (!hours || typeof hours !== 'object') return '';

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const formatted = [];

  days.forEach((day) => {
    const dayHours = hours[day];
    if (!dayHours) return;

    const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

    if (dayHours.closed) {
      formatted.push(`${capitalize(day)}: Closed`);
    } else if (dayHours.open && dayHours.close) {
      formatted.push(`${capitalize(day)}: ${dayHours.open} - ${dayHours.close}`);
    }
  });

  return formatted.join('\n');
};

class RealtimeCallHandler extends EventEmitter {
  constructor({
    ws,
    callSid,
    userId,
    sessionCache,
    session,
    deepgramClient,
    llmClient,
    voiceConfig,
    onConversationComplete,
    getBusinessContextForOrg,
  }) {
    super();
    this.ws = ws;
    this.callSid = callSid;
    this.userId = userId;
    this.sessionCache = sessionCache;
    this.session = session;
    this.deepgramClient = deepgramClient;
    this.llmClient = llmClient;
    this.voiceConfig = voiceConfig || {};
    this.onConversationComplete = onConversationComplete;
    this.getBusinessContextForOrg = getBusinessContextForOrg;

    this.streamSid = null;
    this.deepgramStream = null;
    this.turns = [];
    this.userTranscript = [];
    this.pendingAudioQueue = [];
    this.isPlaying = false;
    this.closed = false;
    this.questionsAsked = 0;
    this.interimBuffer = ''; // Track interim results for barge-in detection
    this.lastInterimTime = 0; // Timestamp of last interim result
    this.followUpLimit = (session && session.maxQuestionsPerTurn) || 1;
    this.minAckVariety = (session && session.minAckVariety) || 3;
    // Allow disabling quick acknowledgments if they feel like duplicate responses
    this.quickAckEnabled = process.env.ENABLE_QUICK_ACK !== 'false';
    this.pendingFollowUps = Array.isArray(session?.questions) ? [...session.questions] : [];
    this.systemPrompt = null; // Will be initialized in initialize()
    this.ttsProviderPriority = this.buildProviderPriority();
    this.ttsCacheTtlMs = Math.max(
      1000,
      Number(this.voiceConfig?.cacheControl?.ttlMs) || TTS_DEFAULT_CACHE_TTL_MS,
    );
    this.ttsCacheMaxEntries = Math.max(
      1,
      Number(this.voiceConfig?.cacheControl?.maxEntries) || TTS_DEFAULT_CACHE_MAX_ENTRIES,
    );
  }

  buildDeepgramKeywords() {
    // Boost common name spellings, street types, and business-specific terms
    // Format: ["keyword:boost_value"] where boost is 0.0-4.0
    const commonKeywords = [
      'atticus:2.5',
      'escott:2.5',
      'langside:2.5',
      'saturday:1.5',
      'sunday:1.5',
      'monday:1.5',
      'street:1.5',
      'road:1.5',
      'avenue:1.5',
      'drive:1.5',
      'lane:1.5',
      'garden:1.5',
      'cleanup:1.5',
      'removal:1.5',
      'event:1.5',
    ];

    // Add business-specific keywords if available
    if (this.session?.businessProfile?.services) {
      this.session.businessProfile.services.forEach(service => {
        if (service.name) {
          commonKeywords.push(`${service.name.toLowerCase()}:2.0`);
        }
      });
    }

    return commonKeywords;
  }

  hydrateSessionFromCustomParams(customParams = {}) {
    if (this.session) return;

    const questions = Array.isArray(customParams.questions) ? customParams.questions.filter(Boolean) : [];
    this.session = {
      isTestCall: Boolean(customParams.isTestCall),
      greeting: customParams.greeting || 'Hi! This is Flynn, your AI receptionist. How can I help you today?',
      questions,
      voiceId: customParams.voiceId || null,
      ackLibrary: Array.isArray(customParams.ackLibrary) ? customParams.ackLibrary : null,
      minAckVariety: this.minAckVariety,
      maxQuestionsPerTurn: this.followUpLimit,
    };

    // Rehydrate derived fields based on the newly created session
    this.pendingFollowUps = [...questions];
  }

  buildProviderPriority() {
    const priority = [];
    const preferred = (this.voiceConfig?.provider || '').toLowerCase();
    const hasAzure = Boolean(
      this.voiceConfig?.azure?.key
      && (this.voiceConfig?.azure?.endpoint || this.voiceConfig?.azure?.region),
    );
    const hasElevenLabs = Boolean(this.voiceConfig?.elevenLabs?.apiKey);

    const push = (provider) => {
      if (provider && !priority.includes(provider)) {
        priority.push(provider);
      }
    };

    if (preferred === 'azure') {
      if (hasAzure) push('azure');
      if (hasElevenLabs) push('elevenlabs');
    } else if (preferred === 'elevenlabs') {
      if (hasElevenLabs) push('elevenlabs');
      if (hasAzure) push('azure');
    } else {
      if (hasAzure) push('azure');
      if (hasElevenLabs) push('elevenlabs');
    }

    return priority;
  }

  attach() {
    const hasAzureSpeech = Boolean(
      this.voiceConfig?.azure?.key
      && (this.voiceConfig?.azure?.endpoint || this.voiceConfig?.azure?.region),
    );
    const hasElevenLabsSpeech = Boolean(this.voiceConfig?.elevenLabs?.apiKey);

    console.log('[Realtime] Attaching WebSocket handlers for call.', {
      callSid: this.callSid,
      userId: this.userId,
      hasSession: Boolean(this.session),
      hasDeepgram: Boolean(this.deepgramClient),
      hasLLM: Boolean(this.llmClient),
      hasAzure: hasAzureSpeech,
      hasElevenLabs: hasElevenLabsSpeech,
      ttsPriority: this.ttsProviderPriority,
      greeting: this.session?.greeting ? 'present' : 'missing',
      questionsCount: this.pendingFollowUps.length,
    });

    this.ws.on('message', (data) => this.handleTwilioMessage(data));
    this.ws.on('close', () => this.tearDown('socket_closed'));
    this.ws.on('error', (error) => {
      console.error('[Realtime] WebSocket error', { callSid: this.callSid, error });
      this.tearDown('socket_error');
    });

    // Only initialize immediately if we have a session
    // Otherwise, wait for the 'start' event to provide parameters and session
    if (this.session) {
      this.initialize()
        .catch((error) => {
          console.error('[Realtime] Failed to initialise realtime session.', { callSid: this.callSid, error });
          this.tearDown('initialisation_error');
        });
    } else {
      console.log('[Realtime] Waiting for start event to receive session parameters...', { callSid: this.callSid });
    }
  }

  async initialize() {
    console.log('[Realtime] Initializing call session.', {
      callSid: this.callSid,
      hasDeepgramClient: Boolean(this.deepgramClient),
    });

    // Initialize system prompt with business context
    this.systemPrompt = await createSystemPrompt(this.session || {}, this.getBusinessContextForOrg);
    console.log('[Realtime] System prompt initialized with business context');

    if (this.deepgramClient) {
      await this.createDeepgramStream();
    } else {
      console.warn('[Realtime] Deepgram client missing, live transcription disabled.', { callSid: this.callSid });
    }

    console.log('[Realtime] Sending greeting to caller.', { callSid: this.callSid });
    await this.sendGreeting();

    // Note: AI will naturally ask the first question after the greeting
    // No need to explicitly ask it here to avoid duplication
    console.log('[Realtime] AI will handle intake questions naturally.', {
      callSid: this.callSid,
      questionsToAsk: this.pendingFollowUps.length,
    });
  }

  async createDeepgramStream() {
    try {
      // Deepgram configuration optimized for phone call transcription
      const deepgramConfig = {
        model: 'nova-2-phonecall', // Phone call optimized model (better than conversationalai)
        encoding: 'mulaw',
        sample_rate: 8000,
        interim_results: true,
        punctuate: true,
        vad_events: true,
        endpointing: 1200, // Reduced from 2000ms for faster responses
        utterance_end_ms: 1000, // Reduced from 1500ms for faster finalization
        smart_format: true, // Better formatting for addresses, numbers, names
        filler_words: false, // Remove "um", "uh" for cleaner transcripts
        numerals: true, // Convert numbers to digits (important for addresses/phone numbers)
        keywords: this.buildDeepgramKeywords(), // Custom keywords for better accuracy
      };

      this.deepgramStream = this.deepgramClient.listen.live(deepgramConfig);

      this.deepgramStream.on(LiveTranscriptionEvents.Open, () => {
        console.log('[Realtime] Deepgram stream established.', { callSid: this.callSid });
      });

      this.deepgramStream.on(LiveTranscriptionEvents.Close, () => {
        console.log('[Realtime] Deepgram stream closed.', { callSid: this.callSid });
      });

      const errorEvent = LiveTranscriptionEvents.Error || 'error';
      this.deepgramStream.on(errorEvent, (error) => {
        console.error('[Realtime] Deepgram stream error.', { callSid: this.callSid, error });
      });

      this.deepgramStream.on(LiveTranscriptionEvents.Transcript, (event) => {
        this.handleDeepgramTranscript(event);
      });
    } catch (error) {
      console.error('[Realtime] Unable to create Deepgram stream.', { callSid: this.callSid, error });
      this.deepgramStream = null;
    }
  }

  async sendGreeting() {
    const greeting = this.session?.greeting || 'Hi there! Thanks for calling.';
    await this.enqueueSpeech(greeting);
    this.turns.push({ role: 'assistant', content: greeting });
  }

  async maybeAskNextQuestion() {
    if (!this.pendingFollowUps.length) {
      return;
    }

    const nextQuestion = this.pendingFollowUps.shift();
    if (!nextQuestion) {
      return;
    }

    this.questionsAsked += 1;
    await this.enqueueSpeech(nextQuestion);
    this.turns.push({ role: 'assistant', content: nextQuestion });
  }

  async handleTwilioMessage(data) {
    if (this.closed) {
      return;
    }

    try {
      const payload = JSON.parse(data);
      switch (payload.event) {
        case 'connected':
          break;
        case 'start':
          this.streamSid = payload.start?.streamSid || null;

        // Extract custom parameters from start event
        const customParams = payload.start?.customParameters || {};
        if (customParams.callSid) {
          this.callSid = customParams.callSid;
        }
        if (customParams.userId) {
          this.userId = customParams.userId;
        }

        // For test calls (or any sessionless connection), build a session from client-provided params
        this.hydrateSessionFromCustomParams(customParams);

        console.log('[Realtime] Stream started with parameters:', {
          streamSid: this.streamSid,
          callSid: this.callSid,
          userId: this.userId,
          });

          // If we now have a callSid and didn't have a session before, try to load it
          if (this.callSid && !this.session && this.sessionCache) {
            this.session = this.sessionCache.get(this.callSid);
            if (this.session) {
              console.log('[Realtime] Loaded session from cache after start event.', {
                callSid: this.callSid,
                userId: this.userId,
              });
              // Re-initialize with the loaded session
              this.pendingFollowUps = Array.isArray(this.session?.questions) ? [...this.session.questions] : [];
              // Now that we have a session, initialize properly (this will set systemPrompt)
              this.initialize().catch((error) => {
                console.error('[Realtime] Failed to initialize after loading session.', { callSid: this.callSid, error });
              });
            } else {
              console.warn('[Realtime] No session found in cache for callSid.', { callSid: this.callSid });
            }
          } else if (this.session && !this.systemPrompt) {
            // We have a freshly hydrated session; initialize now
            this.initialize().catch((error) => {
              console.error('[Realtime] Failed to initialize after hydrating session.', { callSid: this.callSid, error });
            });
          }
          break;
        case 'media':
          await this.forwardAudioToDeepgram(payload.media);
          break;
        case 'stop':
          this.tearDown('twilio_stop');
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('[Realtime] Failed to parse Twilio media event.', { callSid: this.callSid, error });
    }
  }

  async forwardAudioToDeepgram(mediaPayload) {
    // While we're actively playing TTS back to the caller, skip
    // forwarding audio to Deepgram to reduce potential echo.
    if (this.isPlaying) {
      return;
    }

    if (!mediaPayload?.payload || !this.deepgramStream) {
      return;
    }

    try {
      const audio = Buffer.from(mediaPayload.payload, 'base64');
      if (audio.length > 0) {
        this.deepgramStream.send(audio);
      }
    } catch (error) {
      console.error('[Realtime] Failed to forward audio to Deepgram.', { callSid: this.callSid, error });
    }
  }

  async handleDeepgramTranscript(event) {
    try {
      const results = event.channel?.alternatives?.[0];
      if (!results) {
        return;
      }

      const transcript = (results.transcript || '').trim();
      if (!transcript) {
        return;
      }

      const isFinal = event.is_final || event.speech_final || false;

      // Handle interim results for barge-in detection
      if (!isFinal) {
        // Track interim results to detect user speaking during AI playback
        this.interimBuffer = transcript;
        this.lastInterimTime = Date.now();

        // If user is speaking during AI playback, implement barge-in
        if (this.isPlaying && transcript.length > 15) {
          // Clear the audio queue to stop AI from continuing to speak
          console.log('[Realtime] Barge-in detected, clearing audio queue.', {
            callSid: this.callSid,
            interimLength: transcript.length,
            interimPreview: transcript.substring(0, 30),
          });
          this.pendingAudioQueue = [];
          this.isPlaying = false; // Allow processing to continue
        }
        return;
      }

      // Final transcript processing
      // Require meaningful user speech before reacting (reduces noise-driven loops)
      const hasLetters = /[a-zA-Z]/.test(transcript);
      if (transcript.length < 3 || !hasLetters) {
        return;
      }

      // Reset interim buffer on final transcript
      this.interimBuffer = '';
      this.lastInterimTime = 0;

      this.userTranscript.push(transcript);
      this.turns.push({ role: 'user', content: transcript });

      const transcriptReceivedTime = Date.now();
      // Log user transcript for conversation analysis
      console.log('[Realtime] ⏱️ USER SAID (transcript final):', {
        callSid: this.callSid,
        transcript: transcript,
        length: transcript.length,
        timestamp: new Date().toISOString(),
      });

      // CONDITIONAL ACKNOWLEDGMENT: Only send if AI response takes > 1000ms
      // This avoids unnecessary filler words when AI is fast, but provides
      // feedback during longer processing times to keep conversation natural
      const shouldAcknowledge = this.shouldSendQuickAck(transcript);
      const startTime = Date.now();
      let quickAck = '';
      let responseReady = false;

      // Start generating AI response (don't await yet)
      const responsePromise = this.generateAssistantResponse(transcript).then(response => {
        responseReady = true;
        return response;
      });

      // Wait briefly to see if we need to send an acknowledgment
      if (shouldAcknowledge) {
        await sleep(400);

        // If response still not ready after 1000ms, send short acknowledgment
        if (!responseReady) {
          quickAck = this.selectAcknowledgement({ shortOnly: true });
          console.log('[Realtime] Response taking >1000ms, sending acknowledgment:', {
            callSid: this.callSid,
            ack: quickAck,
            elapsed: Date.now() - startTime,
          });
          await this.enqueueSpeech(quickAck, { priority: false });
          await sleep(30);
        } else {
          console.log('[Realtime] Response ready in <1000ms, skipping acknowledgment:', {
            callSid: this.callSid,
            elapsed: Date.now() - startTime,
          });
        }
      }

      // Wait for and send full AI response
      const response = await responsePromise;
      if (response) {
        const responseReadyTime = Date.now();
        console.log('[Realtime] ⏱️ Total response pipeline duration:', {
          callSid: this.callSid,
          totalDuration: `${responseReadyTime - transcriptReceivedTime}ms`,
          timestamp: new Date().toISOString(),
        });

        await this.enqueueSpeech(response);
        const fullResponse = quickAck ? `${quickAck} ${response}` : response;
        this.turns.push({ role: 'assistant', content: fullResponse });

        // Check if AI just confirmed the job and is wrapping up
        if (this.isJobConfirmed(response)) {
          console.log('[Realtime] Job confirmation detected, ending call:', {
            callSid: this.callSid,
            response: response.slice(0, 50),
          });
          // Give user a moment to respond, then hang up
          await sleep(3000);
          this.tearDown('complete');
          return;
        }
      }

      // Check if user explicitly wants to end the call
      if (this.shouldCloseConversation(transcript)) {
        await this.generateAndSpeakSummary();
        await this.enqueueSpeech('Thanks for calling. I\'ll send this through to the team right now. Talk soon!');
        this.tearDown('complete');
      }
    } catch (error) {
      console.error('[Realtime] Failed to process transcript.', { callSid: this.callSid, error });
    }
  }

  shouldSendQuickAck(transcript) {
    if (!this.quickAckEnabled) {
      return false;
    }
    // With 2-second endpointing, we can be more relaxed about acknowledgments
    // Deepgram will wait for natural pauses, so most transcripts should be complete

    // Don't acknowledge very short transcripts (likely noise or incomplete)
    if (transcript.length < 15) {
      return false;
    }

    const words = transcript.trim().toLowerCase().split(/\s+/);
    const lastWord = words[words.length - 1];

    // Only skip acknowledgment if clearly in the middle of giving a phone number
    const numberWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    if (numberWords.includes(lastWord) && words.length < 12) {
      // Phone numbers are typically 10-11 words
      console.log('[Realtime] Skipping ack - phone number in progress:', {
        callSid: this.callSid,
        lastWord,
      });
      return false;
    }

    // Otherwise, trust Deepgram's 2-second endpointing and send acknowledgment
    // The longer wait time means they've likely finished their thought
    return true;
  }

  selectAcknowledgement({ shortOnly = false } = {}) {
    // Default casual, human-like acknowledgments
    const defaultLibrary = [
      'Cool',
      'Awesome',
      'Perfect',
      'Got it',
      'Sounds good',
      'No worries',
      'Right',
      'Yep',
      'Sure thing',
      'Nice',
    ];

    const rawLibrary = Array.isArray(this.session?.ackLibrary) && this.session.ackLibrary.length > 0
      ? this.session.ackLibrary
      : defaultLibrary;

    // Filter out problematic acknowledgments that don't work well in all contexts
    let library = rawLibrary.filter((ack) => {
      const lower = ack.toLowerCase();
      return !lower.includes('keep going') && !lower.includes('continue');
    });

    // If shortOnly requested, filter to only brief acknowledgments (≤ 15 characters)
    if (shortOnly) {
      library = library.filter((ack) => ack.length <= 15);

      // If no short acks available, use default casual ones
      if (library.length === 0) {
        library = ['Cool', 'Awesome', 'Perfect', 'Got it', 'Nice'];
      }
    }

    // Ensure we have at least one option
    if (library.length === 0) {
      library = defaultLibrary;
    }

    const history = Array.isArray(this.session?.ackHistory) ? this.session.ackHistory : [];
    const unused = library.filter((ack) => !history.includes(ack));

    let choice = null;
    if (unused.length > 0) {
      choice = unused[Math.floor(Math.random() * unused.length)];
    } else {
      choice = library[Math.floor(Math.random() * library.length)];
      this.session.ackHistory = [];
    }

    this.session.ackHistory = [...(this.session.ackHistory || []), choice];
    if (this.session.ackHistory.length >= this.minAckVariety) {
      this.session.ackHistory = [];
    }

    this.sessionCache.set(this.callSid, this.session);
    return choice;
  }

  async generateAssistantResponse(userText) {
    if (!this.llmClient) {
      return this.pendingFollowUps.length > 0
        ? 'Thanks, here\'s another quick question.'
        : 'Appreciate it. I\'ll pass this on right away.';
    }

    const llmStartTime = Date.now();
    try {
      const messages = [
        { role: 'system', content: this.systemPrompt },
        ...this.turns,
        { role: 'user', content: userText },
      ];

      console.log('[Realtime] ⏱️ LLM request starting', {
        callSid: this.callSid,
        model: this.session?.openaiModel || DEFAULT_RECEPTIONIST_MODEL,
        provider: ACTIVE_LLM_PROVIDER,
        timestamp: new Date().toISOString(),
      });

      const completion = await this.llmClient.chat.completions.create({
        model: this.session?.openaiModel || DEFAULT_RECEPTIONIST_MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 180,
        // Enable streaming for faster response times (not yet implemented in playback)
        stream: false,
      });

      const llmDuration = Date.now() - llmStartTime;
      console.log('[Realtime] ⏱️ LLM response received', {
        callSid: this.callSid,
        duration: `${llmDuration}ms`,
        timestamp: new Date().toISOString(),
      });

      const assistantMessage = normaliseChoiceContent(completion?.choices?.[0]);
      if (assistantMessage && typeof assistantMessage === 'string') {
        return assistantMessage.trim();
      }

      return null;
    } catch (error) {
      const llmDuration = Date.now() - llmStartTime;
      console.error('[Realtime] ⏱️ LLM request failed', {
        callSid: this.callSid,
        duration: `${llmDuration}ms`,
        error: error.message,
      });
      return 'Thanks, I have what I need.';
    }
  }

  isJobConfirmed(aiResponse) {
    // Check if AI response indicates job has been confirmed and call should end
    if (!aiResponse || typeof aiResponse !== 'string') {
      return false;
    }

    const lower = aiResponse.toLowerCase();

    // Phrases that indicate confirmation and wrap-up
    const confirmationPhrases = [
      'we\'ll be in touch',
      'we\'ll call you',
      'we\'ll reach out',
      'we\'ll contact you',
      'talk to you soon',
      'speak to you soon',
      'we\'ll get back to you',
      'someone will call you',
      'you\'ll hear from us',
      'we\'ll follow up',
      'we\'ll confirm',
      'i\'ve got you down',
      'you\'re all set',
      'we\'re all set',
    ];

    // Check if any confirmation phrase is present
    const hasConfirmation = confirmationPhrases.some(phrase => lower.includes(phrase));

    // Also check if response seems to be wrapping up (short and includes "thanks" or "awesome")
    const isWrappingUp = (lower.includes('awesome') || lower.includes('perfect') || lower.includes('great')) &&
                         (lower.includes('thanks') || lower.includes('thank you')) &&
                         aiResponse.length < 100; // Short response = likely ending

    return hasConfirmation || isWrappingUp;
  }

  shouldCloseConversation(latestUserTranscript) {
    // Only consider closing if we have enough information
    // We need at least 3 user responses (reasonable conversation)
    if (this.userTranscript.length < 3) {
      return false;
    }

    // Check if user explicitly wants to end the call
    const lower = (latestUserTranscript || '').toLowerCase();
    const explicitEnd = lower.includes('that\'s all') ||
                        lower.includes('that is all') ||
                        lower.includes('nothing else') ||
                        lower.includes('no thanks') ||
                        lower.includes('bye') ||
                        lower.includes('goodbye') ||
                        lower.includes('that\'s it');

    // Only close if user explicitly confirms they're done
    // This prevents premature hang-ups
    return explicitEnd;
  }

  async generateAndSpeakSummary() {
    // Generate a summary of what was captured during the call
    if (!this.llmClient) {
      return;
    }

    try {
      const summaryPrompt = [
        { role: 'system', content: 'You are Flynn, an AI receptionist. Summarize the key details captured from this call in one concise sentence. Format: "Perfect! Let me confirm: [service] in [location] on [date/time], contact number [phone]."' },
        ...this.turns,
        { role: 'user', content: 'Please summarize what you captured from this call.' },
      ];

      const completion = await this.llmClient.chat.completions.create({
        model: this.session?.openaiModel || DEFAULT_RECEPTIONIST_MODEL,
        messages: summaryPrompt,
        temperature: 0.3,
        max_tokens: 100,
      });

      const summary = normaliseChoiceContent(completion?.choices?.[0]);
      if (summary && typeof summary === 'string') {
        await this.enqueueSpeech(summary.trim());
        this.turns.push({ role: 'assistant', content: summary.trim() });
      }
    } catch (error) {
      console.error('[Realtime] Failed to generate summary.', { callSid: this.callSid, error });
      // Fallback summary if AI fails
      await this.enqueueSpeech('Perfect, I\'ve got all the details.');
    }
  }

  async enqueueSpeech(text, { priority = false } = {}) {
    if (!text || !this.streamSid) {
      return;
    }

    const normalized = text.trim();
    if (!normalized) {
      return;
    }

    const audio = await this.textToSpeech(normalized);
    if (!audio) {
      return;
    }

    const queueItem = audio.streamReader
      ? { streamReader: audio.streamReader, text: normalized }
      : { buffer: audio.buffer, text: normalized };

    if (priority) this.pendingAudioQueue.unshift(queueItem);
    else this.pendingAudioQueue.push(queueItem);

    if (!this.isPlaying) {
      this.processAudioQueue().catch((error) => {
        console.error('[Realtime] Failed to process audio queue.', { callSid: this.callSid, error });
      });
    }
  }

  async processAudioQueue() {
    if (this.isPlaying) {
      return;
    }

    this.isPlaying = true;
    while (this.pendingAudioQueue.length > 0 && !this.closed) {
      const item = this.pendingAudioQueue.shift();
      if (!item) {
        break;
      }
      if (item.streamReader) {
        await this.playAudioStream(item.streamReader);
      } else if (item.buffer) {
        await this.playAudioBuffer(item.buffer);
      }
    }
    this.isPlaying = false;
  }

  async playAudioBuffer(buffer) {
    if (!buffer || !this.streamSid || this.closed) {
      return;
    }

    const chunkSize = 160; // 20ms of µ-law @ 8kHz
    for (let offset = 0; offset < buffer.length; offset += chunkSize) {
      if (this.closed) {
        break;
      }
      const slice = buffer.subarray(offset, offset + chunkSize);
      const payload = Buffer.from(slice).toString('base64');
      this.ws.send(JSON.stringify({
        event: 'media',
        streamSid: this.streamSid,
        // Explicitly mark this as outbound audio for the caller
        media: { payload, track: 'outbound' },
      }));
      await sleep(20);
    }

    this.ws.send(JSON.stringify({
      event: 'mark',
      streamSid: this.streamSid,
      mark: { name: 'audio_complete' },
    }));
  }

  async playAudioStream(reader) {
    if (!reader || !this.streamSid || this.closed) {
      return;
    }

    const chunkSize = 160; // 20ms of µ-law @ 8kHz
    let buffer = Buffer.alloc(0);

    try {
      // Stream audio as soon as bytes arrive from ElevenLabs
      while (!this.closed) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const incoming = Buffer.from(value);
        buffer = Buffer.concat([buffer, incoming]);

        while (buffer.length >= chunkSize && !this.closed) {
          const slice = buffer.subarray(0, chunkSize);
          buffer = buffer.subarray(chunkSize);
          const payload = slice.toString('base64');
          this.ws.send(JSON.stringify({
            event: 'media',
            streamSid: this.streamSid,
            media: { payload, track: 'outbound' },
          }));
          await sleep(18); // slight headroom while staying near-real-time
        }
      }

      // Flush any remainder
      while (buffer.length > 0 && !this.closed) {
        const slice = buffer.subarray(0, chunkSize);
        buffer = buffer.subarray(chunkSize);
        const payload = slice.toString('base64');
        this.ws.send(JSON.stringify({
          event: 'media',
          streamSid: this.streamSid,
          media: { payload, track: 'outbound' },
        }));
        await sleep(18);
      }

      this.ws.send(JSON.stringify({
        event: 'mark',
        streamSid: this.streamSid,
        mark: { name: 'audio_complete' },
      }));
    } catch (error) {
      console.error('[Realtime] Failed to stream audio to caller.', { callSid: this.callSid, error });
      try {
        await reader.cancel();
      } catch (_) {
        // ignore
      }
    }
  }

  async textToSpeech(text) {
    if (!text || !this.ttsProviderPriority.length) {
      console.error('[Realtime] No TTS providers configured.', { callSid: this.callSid });
      return null;
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return null;
    }

    for (const provider of this.ttsProviderPriority) {
      const voiceId = this.resolveVoiceForProvider(provider);
      if (!voiceId) {
        console.warn('[Realtime] No voice configured for provider.', {
          callSid: this.callSid,
          provider,
          voiceOption: this.session?.voiceOption,
        });
        continue;
      }

      const cacheKey = `${provider}:${voiceId}:${trimmed}`;
      const cached = getCachedAudio(cacheKey, this.ttsCacheTtlMs);
      if (cached) {
        console.log('[Realtime] Using cached TTS audio.', {
          callSid: this.callSid,
          provider,
          voiceId,
        });
        return { buffer: cached };
      }

      let buffer = null;
      let streamReader = null;
      if (provider === 'gemini') {
        buffer = await this.textToSpeechGemini(trimmed, voiceId);
      } else if (provider === 'azure') {
        buffer = await this.textToSpeechAzure(trimmed, voiceId);
      } else if (provider === 'elevenlabs') {
        const elevenResult = await this.textToSpeechElevenLabs(trimmed, voiceId);
        buffer = elevenResult?.buffer || null;
        streamReader = elevenResult?.streamReader || null;
      } else {
        console.warn('[Realtime] Unknown TTS provider encountered.', { provider });
        continue;
      }

      if (streamReader) {
        // Streaming path: skip cache (content not fully buffered) and return reader
        return { streamReader };
      }

      if (buffer && buffer.length) {
        setCachedAudio(cacheKey, buffer, this.ttsCacheMaxEntries);
        return { buffer };
      }

      console.warn('[Realtime] TTS provider failed to generate audio; trying next provider.', {
        callSid: this.callSid,
        provider,
        voiceId,
      });
    }

    console.error('[Realtime] All configured TTS providers failed.', {
      callSid: this.callSid,
      providers: this.ttsProviderPriority,
    });
    return null;
  }

  async textToSpeechAzure(text, voiceName) {
    const azure = this.voiceConfig?.azure || {};
    if (!azure.key || !(azure.endpoint || azure.region)) {
      console.error('[Realtime] Azure Speech credentials not configured.', { callSid: this.callSid });
      return null;
    }

    const endpoint = azure.endpoint || `https://${azure.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const headers = {
      'Ocp-Apim-Subscription-Key': azure.key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'riff-8khz-8bit-mono-mulaw',
      'User-Agent': 'FlynnAI-Telephony/1.0',
    };

    if (!azure.endpoint && azure.region) {
      headers['Ocp-Apim-Subscription-Region'] = azure.region;
    }

    console.log('[Realtime] Generating Azure TTS audio.', {
      callSid: this.callSid,
      voiceName,
      textLength: text.length,
      textPreview: text.substring(0, 50),
    });

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: buildSsml(text, voiceName),
      });

      if (!response.ok) {
        const errorPayload = await response.text();
        console.error('[Realtime] Azure TTS failed.', {
          callSid: this.callSid,
          status: response.status,
          body: errorPayload,
        });
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      let buffer = Buffer.from(arrayBuffer);

      const extracted = this.extractUlawFromWav(buffer);
      if (extracted?.data) {
        console.log('[Realtime] Extracted µ-law audio from Azure WAV response.', {
          callSid: this.callSid,
          sampleRate: extracted.sampleRate,
          bitsPerSample: extracted.bitsPerSample,
        });
        buffer = extracted.data;
      }

      console.log('[Realtime] Azure TTS audio generated successfully.', {
        callSid: this.callSid,
        bufferSize: buffer.length,
      });

      return buffer;
    } catch (error) {
      console.error('[Realtime] Azure TTS request error.', { callSid: this.callSid, error });
      return null;
    }
  }

  async textToSpeechElevenLabs(text, voiceId) {
    const config = this.voiceConfig?.elevenLabs || {};
    const apiKey = config.apiKey;
    if (!apiKey) {
      console.error('[Realtime] ElevenLabs API key not configured.', { callSid: this.callSid });
      return null;
    }

    const body = {
      text,
      // Flash model is tuned for lowest latency phone playback
      model_id: config.modelId || ELEVEN_LABS_FAST_MODEL,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.85,
      },
      output_format: 'ulaw_8000',
      optimize_streaming_latency: 4, // Maximum latency optimization (0-4)
    };

    const ttsStartTime = Date.now();
    console.log('[Realtime] ⏱️ TTS request starting (ElevenLabs)', {
      callSid: this.callSid,
      voiceId,
      textLength: text.length,
      textPreview: text.substring(0, 50),
      model: body.model_id,
      timestamp: new Date().toISOString(),
    });

    try {
      // Use streaming endpoint and explicitly request ulaw
      const baseUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=ulaw_8000`;
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/basic',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorPayload = await response.text();
        console.error('[Realtime] ElevenLabs TTS failed.', {
          callSid: this.callSid,
          status: response.status,
          body: errorPayload,
        });

        if (response.status === 401 && errorPayload.includes('quota_exceeded')) {
          console.warn('[Realtime] ElevenLabs quota exceeded. Continuing without TTS.', {
            callSid: this.callSid,
          });
        }

        return null;
      }

      let contentType = response.headers?.get ? (response.headers.get('content-type') || '') : '';

      // If response supports streaming, return the reader for immediate playback
      if (response.body?.getReader) {
        const reader = response.body.getReader();
        const ttsDuration = Date.now() - ttsStartTime;
        console.log('[Realtime] ⏱️ TTS first byte received (ElevenLabs)', {
          callSid: this.callSid,
          duration: `${ttsDuration}ms`,
          timestamp: new Date().toISOString(),
        });
        return { streamReader: reader };
      }

      let buffer = Buffer.from(await response.arrayBuffer());

      // If ElevenLabs still returns MP3, retry once with an explicit ulaw request
      if (/mpeg/i.test(contentType)) {
        console.warn('[Realtime] ElevenLabs returned MP3; retrying with explicit ulaw.', {
          callSid: this.callSid,
          contentType,
        });

        const retry = await fetch(baseUrl, {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/basic, audio/wav;q=0.9',
          },
          body: JSON.stringify(body),
        });

        if (!retry.ok) {
          const retryText = await retry.text();
          console.error('[Realtime] ElevenLabs retry failed.', {
            callSid: this.callSid,
            status: retry.status,
            body: retryText.substring(0, 200),
          });
          return null;
        }

        contentType = retry.headers?.get ? (retry.headers.get('content-type') || '') : '';

        if (retry.body?.getReader) {
          const reader = retry.body.getReader();
          console.log('[Realtime] ElevenLabs streaming reader ready after retry.', { callSid: this.callSid });
          return { streamReader: reader };
        }

        buffer = Buffer.from(await retry.arrayBuffer());
      }

      const isRiff = buffer.length >= 12
        && buffer.toString('ascii', 0, 4) === 'RIFF'
        && buffer.toString('ascii', 8, 12) === 'WAVE';
      if (isRiff) {
        const extracted = this.extractUlawFromWav(buffer);
        if (extracted && extracted.data) {
          buffer = extracted.data;
        }
      }

      console.log('[Realtime] ElevenLabs TTS audio generated successfully.', {
        callSid: this.callSid,
        bufferSize: buffer.length,
      });
      return { buffer };
    } catch (error) {
      console.error('[Realtime] ElevenLabs request error.', { callSid: this.callSid, error });
      return null;
    }
  }

  async textToSpeechGemini(text, voiceName) {
    if (!GEMINI_TTS_ENABLED || !process.env.GEMINI_API_KEY) {
      console.error('[Realtime] Gemini API key not configured.', { callSid: this.callSid });
      return null;
    }

    // Detect location-based accent from business profile
    let accent = null;
    if (this.session?.businessProfile?.locations) {
      const locationCode = detectLocationFromProfile(this.session.businessProfile.locations);
      if (locationCode) {
        accent = getAccentFromLocation(locationCode);
      }
    }

    const ttsStartTime = Date.now();
    console.log('[Realtime] ⏱️ TTS request starting (Gemini)', {
      callSid: this.callSid,
      voiceName,
      accent: accent || 'default',
      textLength: text.length,
      textPreview: text.substring(0, 50),
      model: GEMINI_TTS_MODEL,
      timestamp: new Date().toISOString(),
    });

    try {
      const result = await generateGeminiSpeech(
        process.env.GEMINI_API_KEY,
        text,
        {
          voiceName: voiceName || GEMINI_TTS_DEFAULT_VOICE,
          model: GEMINI_TTS_MODEL,
          outputFormat: 'pcm', // Return raw PCM for realtime streaming
          style: 'professional and friendly',
          accent: accent, // Use location-based accent if available
        }
      );

      if (!result || !result.audio) {
        console.error('[Realtime] Gemini TTS returned no audio.', { callSid: this.callSid });
        return null;
      }

      // Convert base64 PCM to buffer
      const pcmBuffer = Buffer.from(result.audio, 'base64');

      // Gemini returns 24kHz 16-bit PCM mono, need to convert to 8kHz µ-law for Twilio
      const ulawBuffer = this.convertPcm24kToUlaw8k(pcmBuffer);

      const ttsDuration = Date.now() - ttsStartTime;
      console.log('[Realtime] ⏱️ Gemini TTS audio generated successfully.', {
        callSid: this.callSid,
        duration: `${ttsDuration}ms`,
        bufferSize: ulawBuffer.length,
        timestamp: new Date().toISOString(),
      });

      return ulawBuffer;
    } catch (error) {
      console.error('[Realtime] Gemini TTS request error.', {
        callSid: this.callSid,
        error: error.message || error
      });
      return null;
    }
  }

  // Convert 24kHz 16-bit PCM to 8kHz µ-law for Twilio
  convertPcm24kToUlaw8k(pcm24k) {
    // Simple downsampling: take every 3rd sample (24000 / 3 = 8000)
    const pcm8k = Buffer.alloc(Math.floor(pcm24k.length / 6)); // 16-bit = 2 bytes, so /6

    for (let i = 0; i < pcm8k.length / 2; i++) {
      const sourceIdx = i * 6; // Every 3rd sample, 2 bytes each
      if (sourceIdx + 1 < pcm24k.length) {
        pcm8k.writeInt16LE(pcm24k.readInt16LE(sourceIdx), i * 2);
      }
    }

    // Convert PCM to µ-law
    const ulaw = Buffer.alloc(pcm8k.length / 2);
    for (let i = 0; i < ulaw.length; i++) {
      const sample = pcm8k.readInt16LE(i * 2);
      ulaw[i] = this.linearToUlaw(sample);
    }

    return ulaw;
  }

  // Linear PCM to µ-law conversion
  linearToUlaw(sample) {
    const BIAS = 0x84;
    const CLIP = 32635;
    const sign = (sample >> 8) & 0x80;

    if (sign !== 0) sample = -sample;
    if (sample > CLIP) sample = CLIP;

    sample = sample + BIAS;
    const exponent = Math.floor(Math.log2(sample) - 7);
    const mantissa = (sample >> (exponent + 3)) & 0x0F;
    const ulawByte = ~(sign | (exponent << 4) | mantissa);

    return ulawByte & 0xFF;
  }

  resolveVoiceForProvider(provider) {
    const voiceOption = this.session?.voiceOption;
    if (voiceOption === 'custom_voice' && this.session?.voiceId) {
      return this.session.voiceId;
    }

    if (provider === 'gemini') {
      const gemini = this.voiceConfig?.gemini || {};
      const presets = gemini.presetVoices || this.voiceConfig?.presetVoices || {};
      return (voiceOption && presets?.[voiceOption])
        || gemini.defaultVoice
        || presets.flynn_expert
        || presets.flynn_warm
        || Object.values(presets).find(Boolean)
        || GEMINI_TTS_DEFAULT_VOICE
        || 'Kore';
    }

    if (provider === 'azure') {
      const azure = this.voiceConfig?.azure || {};
      const presets = azure.presetVoices || this.voiceConfig?.presetVoices || {};
      return (voiceOption && presets?.[voiceOption])
        || azure.defaultVoice
        || presets.flynn_warm
        || presets.flynn_expert
        || Object.values(presets).find(Boolean)
        || azure.defaultVoice
        || null;
    }

    if (provider === 'elevenlabs') {
      const eleven = this.voiceConfig?.elevenLabs || {};
      const presets = eleven.presetVoices || this.voiceConfig?.presetVoices || {};
      return (voiceOption && presets?.[voiceOption])
        || presets.flynn_expert
        || presets.flynn_warm
        || Object.values(presets).find(Boolean)
        || null;
    }

    return null;
  }

  // Parse a simple RIFF/WAVE container and extract µ-law (format code 7) data chunk
  extractUlawFromWav(buffer) {
    try {
      if (!buffer || buffer.length < 44) return null;
      if (buffer.toString('ascii', 0, 4) !== 'RIFF') return null;
      if (buffer.toString('ascii', 8, 12) !== 'WAVE') return null;

      let offset = 12;
      let fmtEncoding = null;
      let sampleRate = null;
      let bitsPerSample = null;
      let dataOffset = null;
      let dataSize = null;

      while (offset + 8 <= buffer.length) {
        const chunkId = buffer.toString('ascii', offset, offset + 4);
        const chunkSize = buffer.readUInt32LE(offset + 4);
        const chunkDataStart = offset + 8;

        if (chunkId === 'fmt ') {
          if (chunkSize >= 16) {
            fmtEncoding = buffer.readUInt16LE(chunkDataStart + 0); // 7 => µ-law
            sampleRate = buffer.readUInt32LE(chunkDataStart + 4);
            bitsPerSample = buffer.readUInt16LE(chunkDataStart + 14);
          }
        } else if (chunkId === 'data') {
          dataOffset = chunkDataStart;
          dataSize = Math.min(chunkSize, buffer.length - chunkDataStart);
          break;
        }

        // Chunks are word-aligned
        offset = chunkDataStart + chunkSize + (chunkSize % 2);
      }

      if (dataOffset != null && dataSize != null) {
        return {
          data: buffer.subarray(dataOffset, dataOffset + dataSize),
          fmtEncoding,
          sampleRate,
          bitsPerSample,
        };
      }
      return null;
    } catch (err) {
      console.warn('[Realtime] Failed parsing WAV container.', { callSid: this.callSid, err });
      return null;
    }
  }

  async extractJobFromTranscript(transcript) {
    if (!this.llmClient) {
      return null;
    }

    try {
      const extractionPrompt = `Extract job booking details from this conversation transcript:

"""
${transcript}
"""

Extract the following information if mentioned:
- Client name
- Client phone number or email
- Type of service requested
- Preferred date and time
- Location/address
- Any special notes or requirements
- Urgency level (low/medium/high)

Return the data as JSON with a confidence score (0-1) indicating how complete the information is.

Format:
{
  "clientName": "...",
  "clientPhone": "...",
  "clientEmail": "...",
  "serviceType": "...",
  "scheduledDate": "...",
  "scheduledTime": "...",
  "location": "...",
  "notes": "...",
  "urgency": "medium",
  "confidence": 0.85
}`;

      const response = await this.llmClient.chat.completions.create({
        model: DEFAULT_RECEPTIONIST_MODEL,
        messages: [
          { role: 'system', content: 'You are a job data extraction assistant. Extract information and return valid JSON only.' },
          { role: 'user', content: extractionPrompt }
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const content = normaliseChoiceContent(response.choices?.[0]);
      if (!content) {
        return null;
      }

      // Try to parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return null;
    } catch (error) {
      console.error('[Realtime] Job extraction failed:', error);
      return null;
    }
  }

  async tearDown(reason) {
    if (this.closed) {
      return;
    }
    this.closed = true;

    if (this.deepgramStream) {
      try {
        this.deepgramStream.finish();
      } catch (error) {
        // ignore
      }
    }

    if (this.session && this.sessionCache.has(this.callSid)) {
      this.session.completedAt = Date.now();
      this.session.reason = reason;
      this.session.userTranscript = this.userTranscript.join(' ');
      this.session.turns = this.turns;
      this.sessionCache.set(this.callSid, this.session);
    }

    // Avoid sending custom events back to Twilio's media stream socket; it only accepts media/mark.
    // Job extraction still runs and is persisted via onConversationComplete.
    if (this.userTranscript && this.userTranscript.length > 0) {
      try {
        const fullTranscript = this.userTranscript.join(' ');
        await this.extractJobFromTranscript(fullTranscript);
      } catch (error) {
        console.error('[Realtime] Failed to extract job data.', { callSid: this.callSid, error });
      }
    }

    if (typeof this.onConversationComplete === 'function') {
      try {
        await this.onConversationComplete({
          callSid: this.callSid,
          userId: this.userId,
          orgId: this.session?.orgId || null,
          transcript: this.userTranscript.join(' '),
          turns: this.turns,
          reason,
        });
      } catch (error) {
        console.error('[Realtime] Failed to run completion callback.', { callSid: this.callSid, error });
      }
    }

    if (this.ws && this.ws.readyState === this.ws.OPEN) {
      try {
        this.ws.close();
      } catch (error) {
        // ignore
      }
    }
  }
}

module.exports = (options) => new RealtimeCallHandler(options);
