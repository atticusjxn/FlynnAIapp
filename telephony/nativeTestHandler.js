/**
 * Native Test Handler for Deepgram Voice Agent
 *
 * Handles WebSocket connections from React Native app for testing AI receptionist
 * during onboarding. Similar to deepgramVoiceAgent but accepts Linear16 PCM audio
 * instead of Twilio μ-law format.
 */

const { Buffer } = require('buffer');
const { createClient } = require('@deepgram/sdk');
const { convertNativeToDeepgram, convertDeepgramToNative } = require('./audioConverter');

/**
 * Create a native test handler for app-based testing
 *
 * @param {object} options
 * @param {WebSocket} options.ws - Client WebSocket connection
 * @param {string} options.userId - User ID for business context
 * @param {object} options.testConfig - Test configuration (greeting, voiceId, businessContext)
 * @param {Function} options.getBusinessContextForOrg - Fetch business context
 * @param {object} options.deepgramClient - Deepgram SDK client (optional)
 */
function createNativeTestHandler({
  ws,
  userId,
  testConfig = {},
  getBusinessContextForOrg,
  deepgramClient,
}) {
  console.log('[NativeTest] Creating native test handler:', { userId, testConfig: !!testConfig });

  const handler = {
    ws,
    userId,
    testConfig,
    getBusinessContextForOrg,
    deepgramClient,
    agentConnection: null,
    conversationHistory: [],
    extractedEntities: {},
    closed: false,
    keepAliveInterval: null,
    audioBufferQueue: Buffer.alloc(0), // Buffer for accumulating audio chunks

    /**
     * Initialize and attach event listeners
     */
    async attach() {
      console.log('[NativeTest] Attaching handler...');

      // Set up client WebSocket listeners
      this.ws.on('message', (data) => this.handleClientMessage(data));
      this.ws.on('close', () => this.cleanup());
      this.ws.on('error', (err) => {
        console.error('[NativeTest] Client WebSocket error:', err);
        this.cleanup();
      });

      try {
        // Fetch business context
        await this.loadBusinessContext();

        // Build system prompt
        await this.buildSystemPrompt();

        // Send ready message to client
        this.sendToClient({
          type: 'ready',
          message: 'Test ready - waiting for start command',
        });

        console.log('[NativeTest] Handler attached and ready');
      } catch (error) {
        console.error('[NativeTest] Failed to initialize:', error);
        this.sendToClient({
          type: 'error',
          error: 'Failed to initialize test: ' + error.message,
        });
        this.cleanup();
      }
    },

    /**
     * Load business context for the user
     */
    async loadBusinessContext() {
      console.log('[NativeTest] Loading business context for user:', this.userId);

      try {
        if (this.getBusinessContextForOrg && this.userId) {
          this.businessContext = await this.getBusinessContextForOrg(this.userId);
          console.log('[NativeTest] Business context loaded:', {
            hasContext: !!this.businessContext,
            businessName: this.businessContext?.business_name,
          });
        } else {
          console.warn('[NativeTest] No getBusinessContextForOrg function provided');
          this.businessContext = null;
        }
      } catch (error) {
        console.error('[NativeTest] Failed to load business context:', error);
        this.businessContext = null;
      }
    },

    /**
     * Build system prompt using same logic as production
     */
    async buildSystemPrompt() {
      // Import the buildSystemPrompt function from deepgramVoiceAgent
      const { buildSystemPrompt } = require('./deepgramVoiceAgent');

      const greeting = this.testConfig.greeting || 'Hello! How can I help you today?';
      const businessType = this.businessContext?.business_type || 'service business';
      const mode = this.testConfig.mode || 'ai_only';

      this.systemPrompt = buildSystemPrompt(greeting, this.businessContext, businessType, mode);
      this.greeting = greeting;

      console.log('[NativeTest] System prompt built:', {
        greetingLength: greeting.length,
        promptLength: this.systemPrompt.length,
      });
    },

    /**
     * Handle messages from the client (React Native app)
     */
    async handleClientMessage(data) {
      try {
        const message = JSON.parse(data.toString());
        console.log('[NativeTest] Received client message:', message.type);

        switch (message.type) {
          case 'start':
            await this.startVoiceAgent();
            break;

          case 'audio':
            // Client sends Linear16 PCM audio (base64 encoded)
            if (message.audio && this.agentConnection) {
              try {
                // Validate audio data exists and is not empty
                if (!message.audio || typeof message.audio !== 'string') {
                  console.warn('[NativeTest] Invalid audio data format');
                  break;
                }

                const audioBuffer = Buffer.from(message.audio, 'base64');

                // Validate buffer is valid and has sufficient data
                if (!audioBuffer || audioBuffer.length < 2) {
                  console.warn('[NativeTest] Audio buffer too small:', audioBuffer?.length || 0);
                  break;
                }

                // Convert from Linear16 16kHz to μ-law 8kHz for Deepgram
                // Deepgram prefers 8kHz mulaw for telephony-like input to match its model training
                const mulawBuffer = convertNativeToDeepgram(audioBuffer);

                // Only send if conversion produced valid output
                if (mulawBuffer && mulawBuffer.length > 0) {
                  this.sendAudioToAgent(mulawBuffer);
                }
              } catch (error) {
                console.error('[NativeTest] Error processing audio:', error);
                // Don't send error to client for audio processing issues (non-critical)
              }
            }
            break;

          case 'stop':
            console.log('[NativeTest] Client requested stop');
            await this.endConversation();
            break;

          default:
            console.warn('[NativeTest] Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('[NativeTest] Error handling client message:', error);
        this.sendToClient({
          type: 'error',
          error: 'Failed to process message: ' + error.message,
        });
      }
    },

    /**
     * Start the Deepgram Voice Agent connection
     */
    async startVoiceAgent() {
      try {
        console.log('[NativeTest] Starting Deepgram Voice Agent...');

        // Create Deepgram client if not provided
        const client = this.deepgramClient || createClient(process.env.DEEPGRAM_API_KEY);

        // Initialize Voice Agent connection
        this.agentConnection = client.agent();

        // Set up event listeners
        this.setupAgentEventListeners();

        // Wait for Welcome event
        await new Promise((resolve, reject) => {
          const welcomeTimeout = setTimeout(() => {
            reject(new Error('Voice Agent Welcome timeout'));
          }, 10000);

          this.agentConnection.once('Welcome', () => {
            clearTimeout(welcomeTimeout);
            resolve();
          });
        });

        console.log('[NativeTest] Voice Agent connected, sending configuration...');

        // Import function schema builder
        const { getFunctionSchema } = require('./deepgramVoiceAgent');

        // Configure the agent (same as production but adapted for native audio)
        this.agentConnection.configure({
          audio: {
            input: {
              encoding: 'mulaw',
              sample_rate: 8000,
            },
            output: {
              encoding: 'linear16',
              sample_rate: 16000,
              container: 'none',
            },
          },
          agent: {
            language: 'en',
            listen: {
              provider: {
                type: 'deepgram',
                model: 'nova-3',
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
              functions: getFunctionSchema(),
            },
            speak: {
              provider: {
                type: 'deepgram',
                model: this.testConfig.voiceId === 'flynn_expert' || this.testConfig.voiceId === 'male'
                  ? 'aura-2-arcas-en' // Australian male
                  : 'aura-2-theia-en', // Australian female (default)
              },
            },
            greeting: this.greeting,
          },
        });

        console.log('[NativeTest] Voice Agent configured and ready');

        // Start keepAlive
        this.keepAliveInterval = setInterval(() => {
          if (this.agentConnection && !this.closed) {
            try {
              this.agentConnection.keepAlive();
            } catch (err) {
              console.warn('[NativeTest] KeepAlive error:', err);
            }
          }
        }, 5000);

        // Notify client that agent is ready
        this.sendToClient({
          type: 'agent_ready',
          message: 'Voice agent connected and configured',
        });

      } catch (error) {
        console.error('[NativeTest] Failed to start Voice Agent:', error);
        this.sendToClient({
          type: 'error',
          error: 'Failed to start voice agent: ' + error.message,
        });
        throw error;
      }
    },

    /**
     * Flush accumulated audio buffer to client
     */
    flushAudioBuffer() {
      if (this.audioBufferQueue.length > 0) {
        try {
          console.log('[NativeTest] Flushing audio buffer:', this.audioBufferQueue.length, 'bytes');
          this.sendToClient({
            type: 'audio',
            audio: this.audioBufferQueue.toString('base64'),
          });
          this.audioBufferQueue = Buffer.alloc(0);
        } catch (err) {
          console.error('[NativeTest] Error flushing audio buffer:', err);
        }
      }
    },

    /**
     * Set up Deepgram Voice Agent event listeners
     */
    setupAgentEventListeners() {
      if (!this.agentConnection) return;

      // Audio output from agent
      this.agentConnection.on('Audio', (data) => {
        let chunk = null;

        if (Buffer.isBuffer(data)) {
          chunk = data;
        } else if (data && data.audio) {
          chunk = Buffer.from(data.audio);
        }

        if (chunk && chunk.length > 0) {
          // Append to buffer
          this.audioBufferQueue = Buffer.concat([this.audioBufferQueue, chunk]);

          // We wait for AgentAudioDone to flush the entire buffer as one file
          // This prevents "choppy" audio on the client side
        }
      });

      // Transcript from user speech
      this.agentConnection.on('UserStartedSpeaking', () => {
        this.sendToClient({ type: 'user_started_speaking' });
      });

      this.agentConnection.on('ConversationText', (data) => {
        if (data.role === 'user' && data.content) {
          console.log('[NativeTest] User said:', data.content);
          this.conversationHistory.push({
            role: 'user',
            content: data.content,
          });

          this.sendToClient({
            type: 'transcript',
            role: 'user',
            text: data.content,
          });
        } else if (data.role === 'assistant' && data.content) {
          console.log('[NativeTest] Agent said:', data.content);
          this.conversationHistory.push({
            role: 'assistant',
            content: data.content,
          });

          this.sendToClient({
            type: 'transcript',
            role: 'assistant',
            text: data.content,
          });
        }
      });

      // Agent started speaking
      this.agentConnection.on('AgentStartedSpeaking', () => {
        this.sendToClient({ type: 'agent_started_speaking' });
      });

      this.agentConnection.on('AgentStoppedSpeaking', () => {
        this.sendToClient({ type: 'agent_stopped_speaking' });
      });

      // Agent audio done - crucial for flushing remaining audio
      this.agentConnection.on('AgentAudioDone', () => {
        console.log('[NativeTest] Agent audio done, flushing remaining buffer');
        this.flushAudioBuffer();
        this.sendToClient({ type: 'agent_audio_done' });
      });

      // Function calls (entity extraction)
      this.agentConnection.on('FunctionCallRequest', async (request) => {
        console.log('[NativeTest] Function call request:', request);

        try {
          const { functions } = request;
          if (!functions || functions.length === 0) {
            console.warn('[NativeTest] Function call received with no functions array');
            return;
          }

          const functionCall = functions[0];
          const { id, name, arguments: argsString } = functionCall;
          const args = JSON.parse(argsString);

          console.log('[NativeTest] Executing function:', name, args);

          if (name === 'extract_booking_details') {
            // Merge with existing entities
            this.extractedEntities = {
              ...this.extractedEntities,
              ...args,
            };

            console.log('[NativeTest] Extracted entities updated:', this.extractedEntities);

            // Notify client
            this.sendToClient({
              type: 'entities_extracted',
              entities: this.extractedEntities,
            });

            // Send function response back to agent to prevent timeout
            const response = {
              type: 'FunctionCallResponse',
              id: id,
              name: name,
              content: JSON.stringify({
                success: true,
                message: 'Booking details captured successfully',
                data: this.extractedEntities,
              }),
            };
            this.agentConnection.send(JSON.stringify(response));
          }
        } catch (error) {
          console.error('[NativeTest] Failed to handle function call:', error);

          // Send error response to prevent timeout
          try {
            const { functions } = request;
            if (functions && functions.length > 0) {
              const { id, name } = functions[0];
              const errorResponse = {
                type: 'FunctionCallResponse',
                id: id,
                name: name,
                content: JSON.stringify({ success: false, error: error.message }),
              };
              this.agentConnection.send(JSON.stringify(errorResponse));
            }
          } catch (sendError) {
            console.error('[NativeTest] Failed to send error response:', sendError);
          }
        }
      });

      // Error handling
      this.agentConnection.on('Error', (error) => {
        console.error('[NativeTest] Voice Agent error:', error);
        this.sendToClient({
          type: 'error',
          error: 'Voice agent error: ' + (error.message || 'Unknown error'),
        });
      });

      // Unhandled events
      this.agentConnection.on('UnhandledEvent', (event) => {
        console.log('[NativeTest] Unhandled agent event:', event);
      });
    },

    /**
     * Send audio to Deepgram Voice Agent
     */
    sendAudioToAgent(audioBuffer) {
      if (!this.agentConnection || this.closed) return;

      try {
        // Send raw μ-law buffer to agent
        this.agentConnection.send(audioBuffer);
      } catch (error) {
        console.error('[NativeTest] Failed to send audio to agent:', error);
      }
    },

    /**
     * End the conversation and extract job details
     */
    async endConversation() {
      console.log('[NativeTest] Ending conversation...');

      try {
        // Close agent connection
        if (this.agentConnection) {
          if (typeof this.agentConnection.finish === 'function') {
            this.agentConnection.finish();
          }
        }

        // Prepare final response with conversation data
        const conversationText = this.conversationHistory
          .map(m => `${m.role === 'user' ? 'Caller' : 'Flynn'}: ${m.content}`)
          .join('\n');

        const response = {
          type: 'conversation_ended',
          transcript: conversationText,
          entities: this.extractedEntities,
          conversationHistory: this.conversationHistory,
        };

        // Send to client
        this.sendToClient(response);

        console.log('[NativeTest] Conversation ended successfully');
      } catch (error) {
        console.error('[NativeTest] Error ending conversation:', error);
        this.sendToClient({
          type: 'error',
          error: 'Failed to end conversation: ' + error.message,
        });
      }
    },

    /**
     * Send message to client
     */
    sendToClient(message) {
      if (this.ws && this.ws.readyState === 1) { // WebSocket.OPEN
        try {
          this.ws.send(JSON.stringify(message));
        } catch (error) {
          console.error('[NativeTest] Failed to send to client:', error);
        }
      }
    },

    /**
     * Clean up resources
     */
    cleanup() {
      if (this.closed) return;
      this.closed = true;

      console.log('[NativeTest] Cleaning up...');

      // Clear keepAlive interval
      if (this.keepAliveInterval) {
        clearInterval(this.keepAliveInterval);
        this.keepAliveInterval = null;
      }

      // Close agent connection
      if (this.agentConnection) {
        try {
          if (typeof this.agentConnection.finish === 'function') {
            this.agentConnection.finish();
          }
        } catch (error) {
          console.error('[NativeTest] Error closing agent connection:', error);
        }
        this.agentConnection = null;
      }

      // Close client WebSocket
      if (this.ws && this.ws.readyState === 1) {
        try {
          this.ws.close();
        } catch (error) {
          console.error('[NativeTest] Error closing client WebSocket:', error);
        }
      }

      console.log('[NativeTest] Cleanup complete');
    },
  };

  return handler;
}

// Export the buildSystemPrompt and getFunctionSchema so they can be reused
const buildSystemPrompt = require('./deepgramVoiceAgent').buildSystemPrompt;
const getFunctionSchema = require('./deepgramVoiceAgent').getFunctionSchema;

module.exports = createNativeTestHandler;
module.exports.buildSystemPrompt = buildSystemPrompt;
module.exports.getFunctionSchema = getFunctionSchema;
