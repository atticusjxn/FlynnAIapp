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

const createSystemPrompt = (session) => {
  const greeting = session?.greeting
    ? `Greeting script:\n"""${session.greeting}"""\n\nDo not greet the caller yourself; the system plays the greeting.`
    : '';

  const questionBlock = session?.questions?.length
    ? `Intake questions (for context only — you must NOT ask them yourself; the system will ask each question):\n${session.questions.map((q, idx) => `  ${idx + 1}. ${q}`).join('\n')}\n`
    : 'Collect the caller\'s name, contact details, service request, timing, and location.';

  const businessFacts = session?.businessProfile
    ? `Business profile data:\n${JSON.stringify(session.businessProfile)}\n`
    : '';

  const businessType = session?.businessType
    ? `The business specialises in ${session.businessType.replace(/_/g, ' ')}.`
    : '';

  return [
    'You are Flynn, a friendly but efficient AI receptionist for a service business.',
    'Be concise, natural, and never repeat the same acknowledgement twice in a row.',
    'Do not initiate new questions; keep your responses to brief acknowledgements or clarifying follow-ups only. The system will handle asking the next question.',
    businessType,
    businessFacts,
    questionBlock,
    greeting,
    'Summarise collected details back to the caller before ending the call.',
  ].filter(Boolean).join('\n\n');
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
    this.systemPrompt = createSystemPrompt(session || {});
  }

  attach() {
    console.log('[Realtime] Attaching WebSocket handlers for call.', {
      callSid: this.callSid,
      userId: this.userId,
      hasSession: Boolean(this.session),
      hasDeepgram: Boolean(this.deepgramClient),
      hasLLM: Boolean(this.llmClient),
      hasElevenLabs: Boolean(this.voiceConfig?.apiKey),
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

    if (this.deepgramClient) {
      await this.createDeepgramStream();
    } else {
      console.warn('[Realtime] Deepgram client missing, live transcription disabled.', { callSid: this.callSid });
    }

    console.log('[Realtime] Sending greeting to caller.', { callSid: this.callSid });
    await this.sendGreeting();

    if (this.pendingFollowUps.length > 0) {
      console.log('[Realtime] Queuing first question.', {
        callSid: this.callSid,
        questionsRemaining: this.pendingFollowUps.length,
      });
      await this.maybeAskNextQuestion();
    }
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
              // Re-initialize system prompt with the loaded session
              this.systemPrompt = createSystemPrompt(this.session || {});
              this.pendingFollowUps = Array.isArray(this.session?.questions) ? [...this.session.questions] : [];
              // Now that we have a session, initialize properly
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

      const ack = this.selectAcknowledgement();
      if (ack) {
        await this.enqueueSpeech(ack, { priority: true });
      }

      const response = await this.generateAssistantResponse(transcript);
      if (response) {
        await this.enqueueSpeech(response);
        this.turns.push({ role: 'assistant', content: response });
      }

      if (this.pendingFollowUps.length > 0) {
        await this.maybeAskNextQuestion();
      } else if (this.shouldCloseConversation(transcript)) {
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
    if (this.pendingFollowUps.length > 0) {
      return false;
    }

    const lower = (latestUserTranscript || '').toLowerCase();
    if (lower.includes('that\'s all') || lower.includes('thanks') || lower.includes('bye')) {
      return true;
    }

    return this.userTranscript.length >= this.followUpLimit + 1;
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
    const apiKey = this.voiceConfig.apiKey;
    if (!apiKey) {
      console.error('[Realtime] ElevenLabs API key not configured.', { callSid: this.callSid });
      return null;
    }

    const voiceId = this.resolveVoiceId();
    if (!voiceId) {
      console.error('[Realtime] Could not resolve voice ID for TTS.', {
        callSid: this.callSid,
        voiceOption: this.session?.voiceOption,
      });
      return null;
    }

    const body = {
      text,
      model_id: this.voiceConfig.modelId || 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.85,
      },
      output_format: 'ulaw_8000',
      optimize_streaming_latency: 2,
    };

    console.log('[Realtime] Generating TTS audio.', {
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
          // audio/basic is the standard MIME for PCMU (µ-law)
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
        return null;
      }

      let contentType = response.headers?.get ? (response.headers.get('content-type') || '') : '';
      console.log('[Realtime] ElevenLabs response headers.', { callSid: this.callSid, contentType });
      let arrayBuffer = await response.arrayBuffer();
      let buffer = Buffer.from(arrayBuffer);

      // If the provider sent MP3 despite requesting µ-law, retry using the streaming endpoint
      if (/mpeg/i.test(contentType)) {
        console.warn('[Realtime] ElevenLabs returned MP3; retrying with streaming endpoint for µ-law.', {
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
          return null;
        }

        contentType = retry.headers?.get ? (retry.headers.get('content-type') || '') : '';
        console.log('[Realtime] ElevenLabs retry response headers.', { callSid: this.callSid, contentType });
        arrayBuffer = await retry.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      }

      // Detect WAV container (RIFF/WAVE) and extract raw µ-law audio if present.
      const isRiff = buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE';
      if (isRiff) {
        const extracted = this.extractUlawFromWav(buffer);
        if (extracted && extracted.data) {
          const { fmtEncoding, sampleRate, bitsPerSample } = extracted;
          console.log('[Realtime] Extracted µ-law audio from WAV container.', {
            callSid: this.callSid,
            sampleRate,
            bitsPerSample,
            fmtEncoding,
            rawSize: extracted.data.length,
          });
          buffer = extracted.data;
        } else {
          console.warn('[Realtime] WAV detected but failed to extract µ-law payload; sending raw bytes.', {
            callSid: this.callSid,
            size: buffer.length,
          });
        }
      }

      console.log('[Realtime] TTS audio generated successfully.', {
        callSid: this.callSid,
        bufferSize: buffer.length,
      });
      return buffer;
    } catch (error) {
      console.error('[Realtime] ElevenLabs request error.', { callSid: this.callSid, error });
      return null;
    }
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

  resolveVoiceId() {
    if (this.session?.voiceOption === 'custom_voice' && this.session?.voiceId) {
      return this.session.voiceId;
    }

    if (this.session?.voiceOption && this.voiceConfig?.presetVoices) {
      const candidate = this.voiceConfig.presetVoices[this.session.voiceOption];
      if (candidate) {
        return candidate;
      }
    }

    const presets = this.voiceConfig?.presetVoices || {};
    return presets.koala_warm || presets.koala_expert || Object.values(presets)[0] || null;
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
