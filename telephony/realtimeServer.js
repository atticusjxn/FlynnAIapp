const WebSocket = require('ws');
const { randomUUID } = require('crypto');

/**
 * OpenAI Realtime API WebSocket Server
 *
 * Proxies audio between Twilio Media Streams and OpenAI Realtime API
 * for ultra-low latency voice conversations (300-600ms vs 5-10s with Gather)
 *
 * ARCHITECTURE:
 * Twilio Call → Media Stream → WebSocket → This Server → OpenAI Realtime API
 *                                                ↓
 *                                       (Bidirectional audio proxy)
 *
 * BENEFITS:
 * - Native audio-in/audio-out (no STT/TTS latency)
 * - Built-in conversation state management
 * - Interruption handling
 * - Function calling for booking info extraction
 * - 10-15x faster than current Gather implementation
 */

// Service imports
const {
  getUserByTwilioNumber,
  getBusinessContext,
  insertJob,
  upsertCallRecord,
  insertTranscription,
  getCallBySid,
} = require('../supabaseMcpClient');
const { sendJobCreatedNotification } = require('../notifications/pushService');

// Environment config
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const REALTIME_API_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';

// Active sessions: callSid -> { realtimeWs, twilioWs, conversationLog, ... }
const activeSessions = new Map();

/**
 * Session configuration
 */
const createSessionConfig = (user, businessContext) => {
  const businessName = businessContext?.businessName || user?.business_name || 'our business';
  const customQuestions = user?.receptionist_questions || [];

  let instructions = `You are an AI receptionist for ${businessName}.

YOUR ROLE:
- Answer customer questions professionally and helpfully
- Gather essential information: customer name, phone number, and service needed
- Be friendly, natural, and professional (keep responses under 3 sentences)
- Always aim to book an appointment or schedule a callback

CONVERSATION GOALS:
1. Understand what the customer needs
2. Get their name and contact information (phone number is critical)
3. Confirm we can help them
4. Collect any specific details about their request
5. Schedule appointment or promise a callback`;

  if (customQuestions.length > 0) {
    instructions += `\n\nCUSTOM QUESTIONS TO ASK (work these naturally into the conversation):
${customQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

IMPORTANT: Ask these one at a time as the conversation flows naturally. Make sure you get answers to ALL these questions before ending the call.`;
  }

  if (businessContext) {
    instructions += `\n\nBUSINESS CONTEXT:
Business Type: ${businessContext.businessType || 'Service Provider'}
Services Offered: ${businessContext.servicesOffered?.join(', ') || 'Various services'}`;
  }

  return {
    modalities: ['text', 'audio'],
    instructions,
    voice: 'verse', // Natural, professional voice
    input_audio_format: 'g711_ulaw', // Twilio's format
    output_audio_format: 'g711_ulaw',
    input_audio_transcription: {
      model: 'whisper-1',
    },
    turn_detection: {
      type: 'server_vad', // Server-side voice activity detection
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500,
    },
    tools: [
      {
        type: 'function',
        name: 'extract_booking_info',
        description: 'Extract and save booking information when all required details are collected',
        parameters: {
          type: 'object',
          properties: {
            customerName: {
              type: 'string',
              description: 'Customer full name',
            },
            phoneNumber: {
              type: 'string',
              description: 'Customer phone number (REQUIRED)',
            },
            serviceRequested: {
              type: 'string',
              description: 'Service or job the customer is requesting',
            },
            preferredDate: {
              type: 'string',
              description: 'Preferred date for service (e.g., "tomorrow", "next Monday", "2025-01-20")',
            },
            preferredTime: {
              type: 'string',
              description: 'Preferred time for service (e.g., "morning", "2pm", "after 5pm")',
            },
            location: {
              type: 'string',
              description: 'Service location or address',
            },
            urgency: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'emergency'],
              description: 'Urgency level of the request',
            },
            additionalNotes: {
              type: 'string',
              description: 'Any additional relevant information',
            },
          },
          required: ['customerName', 'phoneNumber', 'serviceRequested'],
        },
      },
    ],
    tool_choice: 'auto',
    temperature: 0.7,
  };
};

/**
 * Handle new Twilio Media Stream connection
 */
const handleTwilioConnection = async (twilioWs, request) => {
  const callSid = request.url.split('callSid=')[1]?.split('&')[0];

  console.log('[RealtimeServer] New Twilio connection', { callSid });

  if (!callSid) {
    console.error('[RealtimeServer] Missing callSid in connection');
    twilioWs.close();
    return;
  }

  try {
    // Get user and business context
    const twilioNumber = request.url.split('to=')[1]?.split('&')[0];
    const user = await getUserByTwilioNumber(twilioNumber);

    if (!user) {
      console.error('[RealtimeServer] No user found for number', { twilioNumber });
      twilioWs.close();
      return;
    }

    const businessContextData = await getBusinessContext(user.id);
    const businessContext = businessContextData?.business_context || null;

    // Create call record
    const fromNumber = request.url.split('from=')[1]?.split('&')[0];
    await upsertCallRecord({
      callSid,
      userId: user.id,
      fromNumber,
      toNumber: twilioNumber,
      recordedAt: new Date().toISOString(),
      status: 'active',
      transcriptionStatus: 'realtime_active',
    });

    // Connect to OpenAI Realtime API
    const realtimeWs = new WebSocket(REALTIME_API_URL, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    });

    // Initialize session state
    const session = {
      callSid,
      userId: user.id,
      user,
      businessContext,
      twilioWs,
      realtimeWs,
      conversationLog: [],
      bookingInfo: null,
      streamSid: null,
      startTime: Date.now(),
    };

    activeSessions.set(callSid, session);

    // ==========================================
    // OPENAI REALTIME API EVENT HANDLERS
    // ==========================================

    realtimeWs.on('open', () => {
      console.log('[RealtimeServer] Connected to OpenAI Realtime API');

      // Configure session
      const sessionConfig = createSessionConfig(user, businessContext);
      realtimeWs.send(JSON.stringify({
        type: 'session.update',
        session: sessionConfig,
      }));

      console.log('[RealtimeServer] Session configured', { callSid });
    });

    realtimeWs.on('message', (data) => {
      try {
        const event = JSON.parse(data.toString());
        handleRealtimeEvent(event, session);
      } catch (error) {
        console.error('[RealtimeServer] Failed to parse Realtime API event:', error);
      }
    });

    realtimeWs.on('error', (error) => {
      console.error('[RealtimeServer] Realtime API error:', error);
    });

    realtimeWs.on('close', () => {
      console.log('[RealtimeServer] Realtime API connection closed');
      activeSessions.delete(callSid);
    });

    // ==========================================
    // TWILIO MEDIA STREAM EVENT HANDLERS
    // ==========================================

    twilioWs.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleTwilioEvent(message, session);
      } catch (error) {
        console.error('[RealtimeServer] Failed to parse Twilio event:', error);
      }
    });

    twilioWs.on('close', () => {
      console.log('[RealtimeServer] Twilio connection closed', { callSid });

      // Save conversation and create job
      finalizeConversation(session);

      // Close Realtime API connection
      if (realtimeWs.readyState === WebSocket.OPEN) {
        realtimeWs.close();
      }

      activeSessions.delete(callSid);
    });

  } catch (error) {
    console.error('[RealtimeServer] Error handling Twilio connection:', error);
    twilioWs.close();
  }
};

/**
 * Handle events from OpenAI Realtime API
 */
const handleRealtimeEvent = (event, session) => {
  const { type } = event;

  switch (type) {
    case 'session.created':
      console.log('[RealtimeServer] Session created:', event.session.id);
      break;

    case 'session.updated':
      console.log('[RealtimeServer] Session updated');
      break;

    case 'conversation.item.created':
      // Track conversation items
      console.log('[RealtimeServer] Conversation item created:', event.item.id);
      break;

    case 'response.audio.delta':
      // Stream audio back to Twilio
      if (session.twilioWs.readyState === WebSocket.OPEN && session.streamSid) {
        const audioPayload = {
          event: 'media',
          streamSid: session.streamSid,
          media: {
            payload: event.delta, // Already base64 encoded
          },
        };
        session.twilioWs.send(JSON.stringify(audioPayload));
      }
      break;

    case 'response.audio_transcript.delta':
      // Accumulate transcript
      if (!session.currentTranscript) {
        session.currentTranscript = '';
      }
      session.currentTranscript += event.delta;
      break;

    case 'response.audio_transcript.done':
      // Save complete assistant response
      if (session.currentTranscript) {
        session.conversationLog.push({
          role: 'assistant',
          content: session.currentTranscript,
          timestamp: new Date().toISOString(),
        });
        console.log('[RealtimeServer] Assistant:', session.currentTranscript);
        session.currentTranscript = '';
      }
      break;

    case 'conversation.item.input_audio_transcription.completed':
      // Save user speech transcript
      session.conversationLog.push({
        role: 'user',
        content: event.transcript,
        timestamp: new Date().toISOString(),
      });
      console.log('[RealtimeServer] User:', event.transcript);
      break;

    case 'response.function_call_arguments.done':
      // Handle booking info extraction
      try {
        const args = JSON.parse(event.arguments);
        session.bookingInfo = args;
        console.log('[RealtimeServer] Booking info extracted:', args);

        // Send function result back to continue conversation
        session.realtimeWs.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: event.call_id,
            output: JSON.stringify({ success: true, message: 'Booking information saved' }),
          },
        }));

        // Trigger response generation
        session.realtimeWs.send(JSON.stringify({
          type: 'response.create',
        }));
      } catch (error) {
        console.error('[RealtimeServer] Failed to parse function arguments:', error);
      }
      break;

    case 'error':
      console.error('[RealtimeServer] Realtime API error:', event.error);
      break;

    default:
      // Log other events for debugging
      if (process.env.DEBUG_REALTIME) {
        console.log('[RealtimeServer] Realtime event:', type);
      }
  }
};

/**
 * Handle events from Twilio Media Stream
 */
const handleTwilioEvent = (message, session) => {
  const { event } = message;

  switch (event) {
    case 'start':
      // Stream started
      session.streamSid = message.start.streamSid;
      console.log('[RealtimeServer] Twilio stream started:', session.streamSid);
      break;

    case 'media':
      // Forward audio to OpenAI Realtime API
      if (session.realtimeWs.readyState === WebSocket.OPEN) {
        const audioAppend = {
          type: 'input_audio_buffer.append',
          audio: message.media.payload, // Base64 encoded audio
        };
        session.realtimeWs.send(JSON.stringify(audioAppend));
      }
      break;

    case 'stop':
      console.log('[RealtimeServer] Twilio stream stopped');
      break;

    default:
      if (process.env.DEBUG_TWILIO) {
        console.log('[RealtimeServer] Twilio event:', event);
      }
  }
};

/**
 * Finalize conversation and create job
 */
const finalizeConversation = async (session) => {
  const { callSid, userId, conversationLog, bookingInfo, startTime } = session;

  try {
    // Calculate call duration
    const duration = Math.floor((Date.now() - startTime) / 1000);

    // Build conversation transcript
    const transcript = conversationLog
      .map(log => `${log.role === 'user' ? 'Caller' : 'AI'}: ${log.content}`)
      .join('\n\n');

    // Save transcript
    await insertTranscription({
      id: randomUUID(),
      callSid,
      engine: 'openai_realtime',
      text: transcript,
      confidence: 0.95,
      language: 'en',
    });

    // Update call record
    await upsertCallRecord({
      callSid,
      status: 'completed',
      transcriptionStatus: 'completed',
      durationSec: duration,
    });

    console.log('[RealtimeServer] Conversation transcript saved');

    // Create job if booking info available
    if (bookingInfo && bookingInfo.customerName) {
      const scheduledDate = bookingInfo.preferredDate
        ? parseRelativeDateToISO(bookingInfo.preferredDate)
        : null;

      const callRecord = await getCallBySid(callSid).catch(() => null);

      const jobPayload = {
        userId,
        callSid,
        customerName: bookingInfo.customerName,
        customerPhone: bookingInfo.phoneNumber || null,
        customerEmail: null,
        summary: `${bookingInfo.serviceRequested || 'Service'} - ${bookingInfo.preferredDate || 'Date TBD'}`,
        serviceType: bookingInfo.serviceRequested || null,
        status: 'new',
        businessType: session.user?.business_type || null,
        source: 'ai_receptionist_realtime',
        capturedAt: new Date().toISOString(),
        voicemailTranscript: transcript,
        voicemailRecordingUrl: callRecord?.recording_url || null,
        scheduledDate,
        scheduledTime: bookingInfo.preferredTime || null,
        location: bookingInfo.location || null,
        notes: `Urgency: ${bookingInfo.urgency || 'medium'}${bookingInfo.additionalNotes ? `\n${bookingInfo.additionalNotes}` : ''}`,
        estimatedDuration: null,
        followUpDraft: null,
        lastFollowUpAt: null,
      };

      const inserted = await insertJob(jobPayload);
      console.log('[RealtimeServer] Job created from Realtime conversation', {
        callSid,
        jobId: inserted?.id,
      });

      // Send push notification
      const jobRecord = {
        id: inserted?.id,
        call_sid: callSid,
        customer_name: jobPayload.customerName,
        status: jobPayload.status || 'new',
      };

      sendJobCreatedNotification({ userId, job: jobRecord })
        .then((result) => {
          if (result.sent > 0) {
            console.log('[RealtimeServer] Job notification sent', {
              jobId: jobRecord.id,
              sent: result.sent,
            });
          }
        })
        .catch((error) => {
          console.warn('[RealtimeServer] Failed to send job notification', { jobId: jobRecord.id, error });
        });
    }
  } catch (error) {
    console.error('[RealtimeServer] Error finalizing conversation:', error);
  }
};

/**
 * Convert relative date strings to ISO format
 */
function parseRelativeDateToISO(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const today = new Date();
  const normalized = dateStr.toLowerCase().trim();

  if (normalized === 'today') {
    return today.toISOString().split('T')[0];
  }

  if (normalized === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayIndex = dayNames.findIndex(day => normalized.includes(day));

  if (dayIndex !== -1) {
    const currentDay = today.getDay();
    let daysUntilTarget = dayIndex - currentDay;

    if (daysUntilTarget <= 0) {
      daysUntilTarget += 7;
    }

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysUntilTarget);
    return targetDate.toISOString().split('T')[0];
  }

  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

module.exports = {
  handleTwilioConnection,
  activeSessions,
};
