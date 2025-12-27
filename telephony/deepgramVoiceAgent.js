/**
 * Deepgram Voice Agent API Handler
 *
 * Replaces custom real-time voice orchestration with Deepgram's unified Voice Agent API.
 * Handles:
 * - STT (Speech-to-Text) via Deepgram Nova-3
 * - LLM orchestration via Gemini 2.5 Flash
 * - TTS (Text-to-Speech) via Deepgram Aura-2
 * - Function calling for structured booking data extraction
 */

const { Buffer } = require('buffer');
const EventEmitter = require('events');
const { createClient } = require('@deepgram/sdk');

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

/**
 * Build system prompt for the AI receptionist
 */
const buildSystemPrompt = (greeting, businessContext, businessType = 'service business', mode = 'ai_only') => {
  const businessFacts = businessContext
    ? formatBusinessContext(businessContext)
    : 'No specific business details provided.';

  const baseInstructions = [
    'ROLE:',
    'You are a friendly, efficient AI receptionist for a busy service business.',
    'Your job is to capture lead details when the owner can\'t answer.',
    '',
    'TONE:',
    '- Casual and warm (like a helpful mate, not corporate)',
    '- Fast-paced - get to the point quickly',
    '- Professional but conversational',
    '- Use natural Aussie speech patterns if appropriate to the business location',
  ];

  // Add voicemail handling for hybrid_choice mode
  if (mode === 'hybrid_choice') {
    baseInstructions.push(
      '',
      'VOICEMAIL OPTION:',
      '- If the caller says they want to "leave a message", "leave a voicemail", or similar, respond:',
      '  "No worries! I\'ll transfer you to voicemail now. Just wait for the beep!"',
      '- Then IMMEDIATELY END THE CALL so they can leave a voicemail',
      '- Do NOT try to help them further - just transfer to voicemail',
    );
  }

  return [
    ...baseInstructions,
    '',
    'CONVERSATION FLOW:',
    '1. Greeting (brief, natural)',
    '2. Ask what they need',
    '3. Get their name',
    '4. Get their contact number',
    '5. Capture timing preference (when they need service)',
    '6. Any other critical details',
    '7. Confirm and end call',
    '',
    'STYLE RULES:',
    '- Keep responses SHORT (1-2 sentences max)',
    '- Ask ONE question at a time',
    '- Don\'t repeat information they already gave',
    '- Don\'t apologize excessively',
    '- Use contractions (I\'m, we\'ll, can\'t)',
    '- Sound human, not robotic',
    '- PHONE NUMBER FORMATTING: When reading back phone numbers, add spacing for clarity',
    '  Example: Say "0497 779 071" NOT "0497779071"',
    '  Example: Say "zero four nine seven, seven seven nine, zero seven one"',
    '',
    'INFORMATION TO CAPTURE:',
    '- Caller name (first name is fine)',
    '- Phone number (for callback)',
    '- Service/job type',
    '- Preferred date/time',
    '- Location (if relevant)',
    '- Urgency level',
    '',
    'EXAMPLES OF GOOD RESPONSES:',
    '- "Hey! Thanks for calling. What can we help you with?"',
    '- "Got it. And what\'s the best number to call you back on?"',
    '- "Perfect. When were you looking to get this done?"',
    '- "Cool, Saturday morning works. And what\'s the best number to reach you?"',
    '',
    'ENDING THE CALL:',
    '- Once you have: name, contact info, service details, and timing → CONFIRM and hang up',
    '- Confirmation format: "Perfect! So I\'ve got you down for [service] on [date/time]. We\'ll call you at [phone] to confirm. Sound good?"',
    '- After they confirm, say: "Awesome, we\'ll be in touch soon!" and END THE CALL',
    '- DO NOT keep chatting after confirmation - wrap it up',
    '',
    businessType,
    businessFacts,
    greeting || '',
  ].filter(Boolean).join('\n\n');
};

/**
 * DeepgramVoiceAgentHandler
 *
 * Manages a single call session using Deepgram Voice Agent API
 */
class DeepgramVoiceAgentHandler extends EventEmitter {
  constructor({
    ws,
    callSid,
    userId,
    sessionCache,
    session,
    deepgramClient,
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
    this.onConversationComplete = onConversationComplete;
    this.getBusinessContextForOrg = getBusinessContextForOrg;

    this.streamSid = null;
    this.agentConnection = null;
    this.conversationHistory = [];
    this.extractedData = {};
    this.closed = false;
    this.systemPrompt = null;
    this.businessContext = null;
    this.keepAliveInterval = null;
  }

  /**
   * Initialize the Voice Agent connection and configuration
   */
  async initialize() {
    try {
      console.log(`[DeepgramAgent][${this.callSid}] Initializing Voice Agent...`);

      // Fetch business context if available
      if (this.getBusinessContextForOrg && this.userId) {
        try {
          this.businessContext = await this.getBusinessContextForOrg(this.userId);
          console.log(`[DeepgramAgent][${this.callSid}] Business context loaded:`, {
            hasContext: !!this.businessContext,
            businessName: this.businessContext?.business_name,
          });
        } catch (err) {
          console.warn(`[DeepgramAgent][${this.callSid}] Failed to load business context:`, err.message);
        }
      }

      // Build system prompt
      const greeting = this.session?.greeting || this.businessContext?.greeting || '';
      const businessType = this.businessContext?.business_type || 'service business';
      const mode = this.session?.mode || 'ai_only';
      this.systemPrompt = buildSystemPrompt(greeting, this.businessContext, businessType, mode);

      console.log(`[DeepgramAgent][${this.callSid}] System prompt generated (${this.systemPrompt.length} chars), mode: ${mode}`);

    } catch (error) {
      console.error(`[DeepgramAgent][${this.callSid}] Initialization error:`, error);
      throw error;
    }
  }

  /**
   * Define function calling schema for booking data extraction
   */
  getFunctionSchema() {
    return [
      {
        name: 'extract_booking_details',
        description: 'Extract structured booking and caller information from the conversation. Call this when you have gathered enough information to create a booking.',
        parameters: {
          type: 'object',
          properties: {
            caller_name: {
              type: 'string',
              description: 'The caller\'s full name or first name',
            },
            phone_number: {
              type: 'string',
              description: 'The caller\'s contact phone number',
            },
            service_type: {
              type: 'string',
              description: 'The type of service or job requested',
            },
            preferred_date: {
              type: 'string',
              description: 'Preferred date for the service (e.g., "Saturday", "next week", "ASAP")',
            },
            preferred_time: {
              type: 'string',
              description: 'Preferred time for the service (e.g., "morning", "2pm", "afternoon")',
            },
            location: {
              type: 'string',
              description: 'Service location or address if provided',
            },
            urgency: {
              type: 'string',
              enum: ['urgent', 'normal', 'flexible'],
              description: 'How urgently the caller needs the service',
            },
            notes: {
              type: 'string',
              description: 'Any additional notes, requirements, or context from the caller',
            },
          },
          required: ['caller_name', 'phone_number', 'service_type'],
        },
      },
    ];
  }

  /**
   * Build the greeting based on receptionist mode
   */
  buildGreeting() {
    const baseGreeting = this.session?.greeting || 'Hey! Thanks for calling.';
    const mode = this.session?.mode || 'ai_only';

    if (mode === 'hybrid_choice') {
      // Offer caller a choice between voicemail or AI receptionist
      // All in the same Deepgram Australian voice (no accent switching)
      return `${baseGreeting} If you'd like to leave a voicemail, just say "leave a message". Or, if you'd like to speak with our AI receptionist to book a service right now, just let me know what you need help with.`;
    }

    // Standard conversational greeting for ai_only mode
    return `${baseGreeting} What can we help you with?`;
  }

  /**
   * Attach WebSocket listeners and start the Voice Agent
   */
  attach() {
    console.log(`[DeepgramAgent][${this.callSid}] Attaching WebSocket handlers...`);

    this.ws.on('message', async (message) => {
      try {
        const msg = JSON.parse(message.toString('utf-8'));
        await this.handleTwilioMessage(msg);
      } catch (error) {
        console.error(`[DeepgramAgent][${this.callSid}] Message handling error:`, error);
      }
    });

    this.ws.on('close', () => {
      console.log(`[DeepgramAgent][${this.callSid}] Twilio WebSocket closed`);
      this.cleanup();
    });

    this.ws.on('error', (error) => {
      console.error(`[DeepgramAgent][${this.callSid}] Twilio WebSocket error:`, error);
      this.cleanup();
    });

    // NOTE: We don't initialize here - we wait for the 'start' event which contains
    // the callSid and userId in customParameters, then we can get the session from cache
  }

  /**
   * Handle incoming messages from Twilio Media Streams
   */
  async handleTwilioMessage(msg) {
    switch (msg.event) {
      case 'start':
        this.streamSid = msg.start.streamSid;

        // Extract callSid and userId from Twilio custom parameters
        const customParams = msg.start?.customParameters || {};
        if (customParams.callSid && !this.callSid) {
          this.callSid = customParams.callSid;
        }
        if (customParams.userId && !this.userId) {
          this.userId = customParams.userId;
        }

        // Retrieve session from cache now that we have callSid
        if (this.callSid && !this.session) {
          this.session = this.sessionCache.get(this.callSid);
          console.log(`[DeepgramAgent][${this.callSid}] Session retrieved from cache:`, {
            hasSession: !!this.session,
            mode: this.session?.mode,
            greeting: this.session?.greeting ? 'present' : 'missing',
          });

          if (!this.session) {
            console.warn(`[DeepgramAgent][${this.callSid}] No session found in cache. Will use defaults.`);
          }
        }

        console.log(`[DeepgramAgent][${this.callSid}] Stream started:`, this.streamSid);

        // Initialize the agent now that we have the session
        if (!this.systemPrompt) {
          await this.initialize();
        }

        await this.startVoiceAgent();
        break;

      case 'media':
        if (this.agentConnection && msg.media?.payload) {
          // Forward audio to Deepgram Voice Agent
          // Twilio sends µ-law @ 8kHz, need to convert to linear16 @ 24kHz
          const audioBuffer = Buffer.from(msg.media.payload, 'base64');
          this.sendAudioToAgent(audioBuffer);
        }
        break;

      case 'stop':
        console.log(`[DeepgramAgent][${this.callSid}] Stream stopped`);
        this.cleanup();
        break;

      default:
        // Ignore other events (mark, connected, etc.)
        break;
    }
  }

  /**
   * Start the Deepgram Voice Agent connection
   */
  async startVoiceAgent() {
    try {
      console.log(`[DeepgramAgent][${this.callSid}] Starting Deepgram Voice Agent...`);

      // Create Deepgram client if not provided
      const client = this.deepgramClient || createClient(process.env.DEEPGRAM_API_KEY);

      // Initialize Voice Agent connection
      this.agentConnection = client.agent();

      // Set up event listeners
      this.setupAgentEventListeners();

      // Wait for Welcome event before configuring
      await new Promise((resolve, reject) => {
        const welcomeTimeout = setTimeout(() => {
          reject(new Error('Voice Agent Welcome timeout'));
        }, 10000);

        this.agentConnection.once('Welcome', () => {
          clearTimeout(welcomeTimeout);
          resolve();
        });
      });

      console.log(`[DeepgramAgent][${this.callSid}] Voice Agent connected, sending configuration...`);

      // Configure the agent
      this.agentConnection.configure({
        audio: {
          input: {
            encoding: 'mulaw', // Twilio uses µ-law
            sample_rate: 8000, // Twilio sample rate
          },
          output: {
            encoding: 'mulaw', // Send µ-law back to Twilio
            sample_rate: 8000,
            container: 'none', // Raw audio, no WAV header
          },
        },
        agent: {
          language: 'en',
          listen: {
            provider: {
              type: 'deepgram',
              model: 'nova-3', // Phone-optimized STT
            },
          },
          think: {
            provider: {
              type: 'google',
            },
            endpoint: {
              url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse',
              headers: {
                'x-goog-api-key': process.env.GEMINI_API_KEY,
              },
            },
            prompt: this.systemPrompt,
            functions: this.getFunctionSchema(),
          },
          speak: {
            provider: {
              type: 'deepgram',
              model: 'aura-2-theia-en', // Natural Australian female voice (Deepgram Aura-2)
            },
          },
          greeting: this.buildGreeting(),
        },
      });

      console.log(`[DeepgramAgent][${this.callSid}] Voice Agent configured and ready`);

      // Start keepAlive to prevent connection timeout (every 5 seconds)
      this.keepAliveInterval = setInterval(() => {
        if (this.agentConnection && !this.closed) {
          try {
            this.agentConnection.keepAlive();
          } catch (err) {
            console.warn(`[DeepgramAgent][${this.callSid}] KeepAlive error:`, err);
          }
        }
      }, 5000);

    } catch (error) {
      console.error(`[DeepgramAgent][${this.callSid}] Failed to start Voice Agent:`, error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Set up Deepgram Voice Agent event listeners
   */
  setupAgentEventListeners() {
    if (!this.agentConnection) return;

    // Welcome - connection established
    this.agentConnection.on('Welcome', () => {
      console.log(`[DeepgramAgent][${this.callSid}] Welcome received`);
    });

    // SettingsApplied - configuration confirmed
    this.agentConnection.on('SettingsApplied', () => {
      console.log(`[DeepgramAgent][${this.callSid}] Settings applied successfully`);
    });

    // ConversationText - user/assistant dialogue
    this.agentConnection.on('ConversationText', (data) => {
      console.log(`[DeepgramAgent][${this.callSid}] Conversation:`, {
        role: data.role,
        content: data.content?.substring(0, 100) + '...',
      });

      this.conversationHistory.push({
        role: data.role,
        content: data.content,
        timestamp: new Date().toISOString(),
      });
    });

    // UserStartedSpeaking - user audio detection
    this.agentConnection.on('UserStartedSpeaking', () => {
      console.log(`[DeepgramAgent][${this.callSid}] User started speaking`);
    });

    // AgentThinking - processing user input
    this.agentConnection.on('AgentThinking', () => {
      console.log(`[DeepgramAgent][${this.callSid}] Agent thinking...`);
    });

    // AgentStartedSpeaking - response generation begun
    this.agentConnection.on('AgentStartedSpeaking', () => {
      console.log(`[DeepgramAgent][${this.callSid}] Agent started speaking`);
    });

    // Audio - TTS audio from agent
    this.agentConnection.on('Audio', (audioData) => {
      // Send audio back to Twilio
      this.sendAudioToTwilio(audioData);
    });

    // AgentAudioDone - response complete
    this.agentConnection.on('AgentAudioDone', () => {
      console.log(`[DeepgramAgent][${this.callSid}] Agent audio done`);
    });

    // FunctionCallRequest - agent wants to call a function
    this.agentConnection.on('FunctionCallRequest', async (request) => {
      console.log(`[DeepgramAgent][${this.callSid}] Function call request:`, request);
      await this.handleFunctionCall(request);
    });

    // Error - connection or processing errors
    this.agentConnection.on('Error', (error) => {
      console.error(`[DeepgramAgent][${this.callSid}] Agent error:`, error);
    });

    // Close - connection terminated
    this.agentConnection.on('Close', () => {
      console.log(`[DeepgramAgent][${this.callSid}] Agent connection closed`);
      this.cleanup();
    });
  }

  /**
   * Send audio from Twilio to Deepgram Voice Agent
   */
  sendAudioToAgent(audioBuffer) {
    if (!this.agentConnection || this.closed) return;

    try {
      // Send buffer directly to agent (correct SDK method is 'send', not 'sendAudio')
      this.agentConnection.send(audioBuffer);
    } catch (error) {
      console.error(`[DeepgramAgent][${this.callSid}] Error sending audio to agent:`, error);
    }
  }

  /**
   * Send audio from Deepgram Voice Agent to Twilio
   */
  sendAudioToTwilio(audioData) {
    if (!this.ws || this.closed) return;

    try {
      // audioData is an ArrayBuffer from Deepgram, convert to base64
      const buffer = Buffer.from(audioData);
      const base64Audio = buffer.toString('base64');

      const mediaMessage = {
        event: 'media',
        streamSid: this.streamSid,
        media: {
          payload: base64Audio,
        },
      };

      this.ws.send(JSON.stringify(mediaMessage));
    } catch (error) {
      console.error(`[DeepgramAgent][${this.callSid}] Error sending audio to Twilio:`, error);
    }
  }

  /**
   * Handle function call requests from the agent
   */
  async handleFunctionCall(request) {
    try {
      // Actual structure: { type: 'FunctionCallRequest', functions: [{ id, name, arguments, client_side }] }
      const { functions } = request;

      if (!functions || functions.length === 0) {
        console.warn(`[DeepgramAgent][${this.callSid}] Function call received with no functions array`);
        return;
      }

      const functionCall = functions[0]; // Handle first function call
      const { id, name, arguments: argsString } = functionCall;
      const args = JSON.parse(argsString);

      console.log(`[DeepgramAgent][${this.callSid}] Executing function: ${name}`, args);

      let result = {};

      if (name === 'extract_booking_details') {
        // Store extracted data
        this.extractedData = {
          ...args,
          call_sid: this.callSid,
          user_id: this.userId,
          timestamp: new Date().toISOString(),
        };

        result = {
          success: true,
          message: 'Booking details captured successfully',
          data: this.extractedData,
        };

        console.log(`[DeepgramAgent][${this.callSid}] Booking details extracted:`, this.extractedData);
      }

      // Send function response back to agent using correct format
      // Documentation: https://developers.deepgram.com/docs/voice-agent-function-call-response
      const response = {
        type: 'FunctionCallResponse',
        id: id,
        name: name,
        content: JSON.stringify(result),
      };

      this.agentConnection.send(JSON.stringify(response));

    } catch (error) {
      console.error(`[DeepgramAgent][${this.callSid}] Function call error:`, error);

      // Send error response using correct format
      try {
        const { functions } = request;
        if (functions && functions.length > 0) {
          const { id, name } = functions[0];
          const errorResponse = {
            type: 'FunctionCallResponse',
            id: id,
            name: name,
            content: JSON.stringify({
              success: false,
              error: error.message,
            }),
          };
          this.agentConnection.send(JSON.stringify(errorResponse));
        }
      } catch (sendError) {
        console.error(`[DeepgramAgent][${this.callSid}] Failed to send error response:`, sendError);
      }
    }
  }

  /**
   * Clean up resources and complete the conversation
   */
  async cleanup() {
    if (this.closed) return;
    this.closed = true;

    console.log(`[DeepgramAgent][${this.callSid}] Cleaning up...`);

    // Stop keepAlive interval
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }

    // Close Deepgram Voice Agent connection
    if (this.agentConnection) {
      try {
        // SDK uses finish() method, not close()
        if (typeof this.agentConnection.finish === 'function') {
          this.agentConnection.finish();
        }
      } catch (err) {
        console.warn(`[DeepgramAgent][${this.callSid}] Error closing agent connection:`, err);
      }
      this.agentConnection = null;
    }

    // Close Twilio WebSocket
    if (this.ws && this.ws.readyState === 1) {
      try {
        this.ws.close();
      } catch (err) {
        console.warn(`[DeepgramAgent][${this.callSid}] Error closing Twilio WebSocket:`, err);
      }
    }

    // Complete conversation callback
    if (this.onConversationComplete) {
      try {
        await this.onConversationComplete({
          callSid: this.callSid,
          userId: this.userId,
          transcript: this.conversationHistory,
          extractedData: this.extractedData,
          duration: this.conversationHistory.length > 0
            ? Math.floor((new Date() - new Date(this.conversationHistory[0].timestamp)) / 1000)
            : 0,
        });
      } catch (err) {
        console.error(`[DeepgramAgent][${this.callSid}] Error in conversation complete callback:`, err);
      }
    }

    console.log(`[DeepgramAgent][${this.callSid}] Cleanup complete`);
  }
}

/**
 * Factory function to create Voice Agent handler
 */
module.exports = (options) => new DeepgramVoiceAgentHandler(options);
