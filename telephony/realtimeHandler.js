const { Buffer } = require('buffer');
const EventEmitter = require('events');
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
  return (process.env.XAI_API_KEY || process.env.GROK_API_KEY) ? 'grok' : 'openai';
})();

const DEFAULT_RECEPTIONIST_MODEL = process.env.RECEPTIONIST_MODEL
  || (ACTIVE_LLM_PROVIDER === 'grok' ? 'grok-4-fast' : 'gpt-4o-mini');

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

  return [
    'You are Flynn, a friendly but efficient AI receptionist for a service business.',
    'Be concise, natural, and conversational.',
    'Your job: Acknowledge what the caller says, then naturally ask the next intake question.',
    'Keep responses brief (1-2 sentences max). Never repeat the same acknowledgement twice in a row.',
    'After asking all intake questions, confirm with the caller: "Is there anything else I should know?"',
    'Only when they say no/that\'s all/nothing else should you end the conversation.',
    businessType,
    businessFacts,
    businessContext,
    questionBlock,
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
    this.followUpLimit = (session && session.maxQuestionsPerTurn) || 1;
    this.minAckVariety = (session && session.minAckVariety) || 3;
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
      this.deepgramStream = this.deepgramClient.listen.live({
        model: 'nova-2-conversationalai',
        encoding: 'mulaw',
        sample_rate: 8000,
        interim_results: true,
        punctuate: true,
        vad_events: true,
      });

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
      if (!isFinal) {
        return;
      }

      // Require meaningful user speech before reacting (reduces noise-driven loops)
      const hasLetters = /[a-zA-Z]/.test(transcript);
      if (transcript.length < 3 || !hasLetters) {
        return;
      }

      this.userTranscript.push(transcript);
      this.turns.push({ role: 'user', content: transcript });

      // FAST ACKNOWLEDGMENT: Send immediate response within 500ms
      // This makes the conversation feel natural and responsive
      const quickAck = this.selectAcknowledgement();
      await this.enqueueSpeech(quickAck, { priority: false });

      // Add a natural pause before the full response (300ms)
      await sleep(300);

      // Generate full AI response (includes next question)
      const response = await this.generateAssistantResponse(transcript);
      if (response) {
        await this.enqueueSpeech(response);
        this.turns.push({ role: 'assistant', content: `${quickAck} ${response}` });
      }

      // Note: AI naturally incorporates questions into responses,
      // so we don't call maybeAskNextQuestion() here to avoid duplication.
      // Instead, we check if the conversation should close.
      if (this.shouldCloseConversation(transcript)) {
        await this.generateAndSpeakSummary();
        await this.enqueueSpeech('Thanks for calling. I\'ll send this through to the team right now. Talk soon!');
        this.tearDown('complete');
      }
    } catch (error) {
      console.error('[Realtime] Failed to process transcript.', { callSid: this.callSid, error });
    }
  }

  selectAcknowledgement() {
    const library = Array.isArray(this.session?.ackLibrary) && this.session.ackLibrary.length > 0
      ? this.session.ackLibrary
      : ['Got it.'];

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

    try {
      const messages = [
        { role: 'system', content: this.systemPrompt },
        ...this.turns,
        { role: 'user', content: userText },
      ];

      const completion = await this.llmClient.chat.completions.create({
        model: this.session?.openaiModel || DEFAULT_RECEPTIONIST_MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 180,
      });

      const assistantMessage = normaliseChoiceContent(completion?.choices?.[0]);
      if (assistantMessage && typeof assistantMessage === 'string') {
        return assistantMessage.trim();
      }

      return null;
    } catch (error) {
      console.error('[Realtime] Failed to generate assistant response.', { callSid: this.callSid, error });
      return 'Thanks, I have what I need.';
    }
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

    const buffer = await this.textToSpeech(normalized);
    if (!buffer || !buffer.length) {
      return;
    }

    if (priority) {
      this.pendingAudioQueue.unshift({ buffer, text: normalized });
    } else {
      this.pendingAudioQueue.push({ buffer, text: normalized });
    }

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
      await this.playAudioBuffer(item.buffer);
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
        return cached;
      }

      let buffer = null;
      if (provider === 'azure') {
        buffer = await this.textToSpeechAzure(trimmed, voiceId);
      } else if (provider === 'elevenlabs') {
        buffer = await this.textToSpeechElevenLabs(trimmed, voiceId);
      } else {
        console.warn('[Realtime] Unknown TTS provider encountered.', { provider });
        continue;
      }

      if (buffer && buffer.length) {
        setCachedAudio(cacheKey, buffer, this.ttsCacheMaxEntries);
        return buffer;
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
      model_id: config.modelId || 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.85,
      },
      output_format: 'ulaw_8000',
      optimize_streaming_latency: 2,
    };

    console.log('[Realtime] Generating ElevenLabs TTS audio.', {
      callSid: this.callSid,
      voiceId,
      textLength: text.length,
      textPreview: text.substring(0, 50),
    });

    try {
      const baseUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
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
      let arrayBuffer = await response.arrayBuffer();
      let buffer = Buffer.from(arrayBuffer);

      if (/mpeg/i.test(contentType)) {
        console.warn('[Realtime] ElevenLabs returned MP3; retrying streaming endpoint for µ-law.', {
          callSid: this.callSid,
          contentType,
        });

        const streamUrl = `${baseUrl}/stream?output_format=ulaw_8000`;
        const retry = await fetch(streamUrl, {
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
          console.error('[Realtime] ElevenLabs streaming retry failed.', {
            callSid: this.callSid,
            status: retry.status,
            body: retryText,
          });

          if (retry.status === 401 && retryText.includes('quota_exceeded')) {
            console.warn('[Realtime] ElevenLabs quota exceeded on retry. Skipping TTS.', {
              callSid: this.callSid,
            });
          }

          return null;
        }

        contentType = retry.headers?.get ? (retry.headers.get('content-type') || '') : '';
        arrayBuffer = await retry.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
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
      return buffer;
    } catch (error) {
      console.error('[Realtime] ElevenLabs request error.', { callSid: this.callSid, error });
      return null;
    }
  }

  resolveVoiceForProvider(provider) {
    const voiceOption = this.session?.voiceOption;
    if (voiceOption === 'custom_voice' && this.session?.voiceId) {
      return this.session.voiceId;
    }

    if (provider === 'azure') {
      const azure = this.voiceConfig?.azure || {};
      const presets = azure.presetVoices || this.voiceConfig?.presetVoices || {};
      return (voiceOption && presets?.[voiceOption])
        || azure.defaultVoice
        || presets.koala_warm
        || presets.koala_expert
        || Object.values(presets).find(Boolean)
        || azure.defaultVoice
        || null;
    }

    if (provider === 'elevenlabs') {
      const eleven = this.voiceConfig?.elevenLabs || {};
      const presets = eleven.presetVoices || this.voiceConfig?.presetVoices || {};
      return (voiceOption && presets?.[voiceOption])
        || presets.koala_expert
        || presets.koala_warm
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

    if (typeof this.onConversationComplete === 'function') {
      try {
        await this.onConversationComplete({
          callSid: this.callSid,
          userId: this.userId,
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
