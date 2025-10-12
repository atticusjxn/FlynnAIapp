const twilio = require('twilio');
const { randomUUID } = require('crypto');
const { createClient } = require('@supabase/supabase-js');

/**
 * Conversation handler for AI receptionist interactions
 * Manages state-based conversation flow with callers
 */

/**
 * Convert relative date strings (like "Saturday", "tomorrow") to ISO date strings
 * @param {string} dateStr - The relative date string
 * @returns {string|null} - ISO date string (YYYY-MM-DD) or null if can't parse
 */
function parseRelativeDateToISO(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const today = new Date();
  const normalized = dateStr.toLowerCase().trim();

  // Handle "today"
  if (normalized === 'today') {
    return today.toISOString().split('T')[0];
  }

  // Handle "tomorrow"
  if (normalized === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  // Handle day names (Monday, Tuesday, etc.)
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayIndex = dayNames.findIndex(day => normalized.includes(day));

  if (dayIndex !== -1) {
    const currentDay = today.getDay();
    let daysUntilTarget = dayIndex - currentDay;

    // If the day has already passed this week, schedule for next week
    if (daysUntilTarget <= 0) {
      daysUntilTarget += 7;
    }

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysUntilTarget);
    return targetDate.toISOString().split('T')[0];
  }

  // Try to parse as actual date
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

const {
  getUserByTwilioNumber,
  upsertConversationState,
  getConversationState,
  updateConversationState,
  upsertCallRecord,
  getBusinessContext,
} = require('../supabaseMcpClient');

const {
  processCallerMessage,
  getNextQuestion,
  generateClosingMessage,
} = require('./aiConversationService');

// Supabase client for storage
let supabaseStorageClient = null;

// Short phrase we can play while longer responses are prepared so callers know we're still on the line
const WAITING_FILLER_PHRASE = 'Got it, let me check that for you.';

const initializeStorage = () => {
  if (!supabaseStorageClient && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabaseStorageClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return supabaseStorageClient;
};

// Helper functions to load env vars after dotenv loads
const getServerPublicUrl = () => process.env.SERVER_PUBLIC_URL;
const getElevenLabsApiKey = () => process.env.ELEVENLABS_API_KEY;
const getElevenLabsModelId = () => process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';

/**
 * Get preset voice IDs (loaded from env at runtime)
 */
const getPresetReceptionistVoices = () => ({
  koala_warm: process.env.ELEVENLABS_VOICE_KOALA_WARM_ID,
  koala_expert: process.env.ELEVENLABS_VOICE_KOALA_EXPERT_ID,
  koala_hype: process.env.ELEVENLABS_VOICE_KOALA_HYPE_ID,
});

/**
 * Generate audio using ElevenLabs TTS
 */
const generateSpeech = async (text, voiceId) => {
  const elevenLabsApiKey = getElevenLabsApiKey();
  if (!elevenLabsApiKey) {
    throw new Error('ElevenLabs API key not configured');
  }

  if (!voiceId) {
    throw new Error('Voice ID is required for speech generation');
  }

  const elevenLabsModelId = getElevenLabsModelId();

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
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
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ConversationHandler] ElevenLabs API error', {
        status: response.status,
        error: errorText,
      });
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    return await response.arrayBuffer();
  } catch (error) {
    console.error('[ConversationHandler] Failed to generate speech', { error, text, voiceId });
    throw error;
  }
};

/**
 * Get voice ID for user's selected voice option
 */
const resolveVoiceId = (voiceOption, customVoiceId) => {
  if (voiceOption === 'custom_voice' && customVoiceId) {
    return customVoiceId;
  }

  const presetVoices = getPresetReceptionistVoices();
  return presetVoices[voiceOption] || presetVoices.koala_warm;
};

/**
 * Generate audio and upload to Supabase, returning a public URL
 */
const generateAndUploadAudio = async (text, voiceId, userId) => {
  const storage = initializeStorage();
  if (!storage) {
    console.warn('[ConversationHandler] Storage not configured, falling back to Polly');
    return null;
  }

  try {
    // Generate audio using ElevenLabs
    const audioBuffer = await generateSpeech(text, voiceId);

    // Create a unique filename based on hash of text + voice ID
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(`${text}-${voiceId}`).digest('hex');
    const filename = `receptionist-audio/${userId}/${hash}.mp3`;

    // Check if this audio already exists (caching)
    const { data: existingFile } = await storage
      .storage
      .from('voicemails')
      .list(`receptionist-audio/${userId}`, {
        search: `${hash}.mp3`,
      });

    if (existingFile && existingFile.length > 0) {
      // Audio already exists, get signed URL
      console.log('[ConversationHandler] Using cached audio:', filename);
      const { data: signedData, error: signedError } = await storage
        .storage
        .from('voicemails')
        .createSignedUrl(filename, 3600); // 1 hour expiry

      if (signedError) {
        console.error('[ConversationHandler] Failed to create signed URL:', signedError);
        return null;
      }

      return signedData?.signedUrl;
    } else {
      // Upload new audio
      console.log('[ConversationHandler] Uploading new audio:', filename);
      const { error: uploadError } = await storage
        .storage
        .from('voicemails')
        .upload(filename, Buffer.from(audioBuffer), {
          contentType: 'audio/mpeg',
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error('[ConversationHandler] Failed to upload audio:', uploadError);
        return null;
      }

      // Get signed URL
      const { data: signedData, error: signedError } = await storage
        .storage
        .from('voicemails')
        .createSignedUrl(filename, 3600); // 1 hour expiry

      if (signedError) {
        console.error('[ConversationHandler] Failed to create signed URL:', signedError);
        return null;
      }

      return signedData?.signedUrl;
    }
  } catch (error) {
    console.error('[ConversationHandler] Failed to generate/upload audio:', error);
    return null;
  }
};

/**
 * Handle initial inbound call - play greeting and start conversation
 */
const handleInboundCall = async (req, res) => {
  // Extract params from both GET and POST
  const CallSid = req.body.CallSid || req.query.CallSid;
  const From = req.body.From || req.query.From;
  const To = req.body.To || req.query.To;

  console.log('[ConversationHandler] Inbound call received', {
    CallSid,
    From,
    To,
  });

  try {
    // Check if conversation already exists to prevent duplicate initialization
    const existingConversation = await getConversationState(CallSid);
    if (existingConversation && existingConversation.status === 'active') {
      console.log('[ConversationHandler] Conversation already active, redirecting to continue');
      const response = new twilio.twiml.VoiceResponse();
      const serverPublicUrl = getServerPublicUrl();
      response.say({ voice: 'Polly.Amy' }, "I'm listening. How can I help you?");

      const gather = response.gather({
        input: 'speech',
        action: `${serverPublicUrl}/telephony/conversation-continue`,
        method: 'POST',
        speechTimeout: 'auto',
        speechModel: 'phone_call',
        language: 'en-AU',
        maxSpeechTime: 60,
      });

      gather.say({ voice: 'Polly.Amy' }, "Please tell me what you need.");
      response.redirect(`${serverPublicUrl}/telephony/conversation-continue`);

      res.type('text/xml');
      res.send(response.toString());
      return;
    }

    // Find user by their Twilio number
    const user = await getUserByTwilioNumber(To);

    if (!user) {
      console.warn('[ConversationHandler] No user found for number', { To });
      return sendFallbackVoicemail(res);
    }

    // Get user's business context for AI-powered conversations
    const businessContextData = await getBusinessContext(user.id);
    const businessContext = businessContextData?.business_context || null;

    console.log('[ConversationHandler] Business context loaded:', {
      hasContext: !!businessContext,
      businessName: businessContext?.businessName,
    });

    // Get user's receptionist settings
    const {
      receptionist_greeting,
      receptionist_voice,
      receptionist_voice_profile_id,
    } = user;

    const greeting = receptionist_greeting ||
      (businessContext?.businessName
        ? `Hi, thanks for calling ${businessContext.businessName}! How can I help you today?`
        : "Hi, thanks for calling! How can I help you today?");

    const voiceOption = receptionist_voice || 'koala_warm';

    // Get custom voice ID if using custom voice
    let customVoiceId = null;
    if (voiceOption === 'custom_voice' && receptionist_voice_profile_id) {
      // TODO: Fetch voice_id from voice_profiles table
      customVoiceId = receptionist_voice_profile_id;
    }

    const voiceId = resolveVoiceId(voiceOption, customVoiceId);
    console.log('[ConversationHandler] Voice configuration:', {
      voiceOption,
      customVoiceId,
      resolvedVoiceId: voiceId,
    });

    // Create conversation state with AI-powered flow
    const conversationId = randomUUID();
    await upsertConversationState({
      id: conversationId,
      callSid: CallSid,
      userId: user.id,
      fromNumber: From,
      toNumber: To,
      currentStep: 0,
      totalSteps: 0, // AI-powered conversations don't have fixed steps
      questions: [], // Will be generated dynamically by AI
      responses: [],
      voiceId,
      greeting,
      status: 'active',
    });

    // Create call record for dashboard visibility
    try {
      console.log('[ConversationHandler] Creating call record', { CallSid, userId: user.id });
      await upsertCallRecord({
        callSid: CallSid,
        userId: user.id,
        fromNumber: From,
        toNumber: To,
        recordedAt: new Date().toISOString(),
        status: 'active',
        transcriptionStatus: 'conversation_active',
      });
      console.log('[ConversationHandler] Call record created successfully');
    } catch (callRecordError) {
      console.error('[ConversationHandler] Failed to create call record:', callRecordError);
    }

    // Build TwiML response
    const response = new twilio.twiml.VoiceResponse();
    const serverPublicUrl = getServerPublicUrl();

    // Enable call recording for the entire conversation
    response.record({
      recordingStatusCallback: `${serverPublicUrl}/telephony/recording-status`,
      recordingStatusCallbackMethod: 'POST',
      recordingStatusCallbackEvent: ['completed'],
    });

    // Generate greeting audio using ElevenLabs
    const greetingAudioUrl = await generateAndUploadAudio(greeting, voiceId, user.id);

    // Gather caller's response - AI will process whatever they say
    const gather = response.gather({
      input: 'speech',
      action: `${serverPublicUrl}/telephony/conversation-continue`,
      method: 'POST',
      speechTimeout: 'auto',
      speechModel: 'phone_call',
      language: 'en-AU',
      maxSpeechTime: 60, // Allow up to 60 seconds for initial response
    });

    // Play greeting INSIDE the gather to avoid overlap
    if (greetingAudioUrl) {
      gather.play(greetingAudioUrl);
    } else {
      // Fallback: generate audio with custom voice instead of Twilio TTS
      const fallbackAudioUrl = await generateAndUploadAudio(greeting, voiceId, user.id);
      if (fallbackAudioUrl) {
        gather.play(fallbackAudioUrl);
      } else {
        // Last resort - use Twilio voice (but this should rarely happen)
        gather.say({ voice: 'Polly.Amy' }, greeting);
      }
    }

    // Pause briefly for caller to start speaking
    gather.pause({ length: 2 });

    // If gather times out or caller hangs up, redirect to this endpoint
    response.redirect(`${serverPublicUrl}/telephony/inbound-voice`);

    const twiml = response.toString();
    console.log('[ConversationHandler] TwiML response:', twiml);

    res.type('text/xml');
    res.send(twiml);

    console.log('[ConversationHandler] Greeting sent, waiting for response', { conversationId, CallSid });
  } catch (error) {
    console.error('[ConversationHandler] Error handling inbound call', { error, CallSid });
    // Try to get voice info for fallback, but proceed even if unavailable
    const user = await getUserByTwilioNumber(req.body.To).catch(() => null);
    const voiceId = user?.receptionist_voice_profile_id || resolveVoiceId(user?.receptionist_voice);
    return sendFallbackVoicemail(res, voiceId, user?.id);
  }
};

/**
 * Handle conversation continuation - AI-powered intelligent conversation
 */
const handleConversationContinue = async (req, res) => {
  console.log('[ConversationHandler] Conversation continue', {
    CallSid: req.body.CallSid,
    SpeechResult: req.body.SpeechResult,
  });

  const { CallSid, SpeechResult, Confidence } = req.body;

  try {
    // Get conversation state
    console.log('[ConversationHandler] Fetching conversation state for CallSid:', CallSid);
    const conversation = await getConversationState(CallSid);
    console.log('[ConversationHandler] Conversation state retrieved:', conversation ? 'found' : 'not found');

    if (!conversation) {
      console.warn('[ConversationHandler] No conversation state found', { CallSid });
      // Try to get voice info for fallback
      const user = await getUserByTwilioNumber(req.body.To || req.body.Called).catch(() => null);
      const voiceId = user?.receptionist_voice_profile_id || resolveVoiceId(user?.receptionist_voice);
      return sendFallbackVoicemail(res, voiceId, user?.id);
    }

    const { responses, voice_id: voiceId, user_id } = conversation;

    // If no speech input, ask them to speak
    if (!SpeechResult) {
      const response = new twilio.twiml.VoiceResponse();
      const serverPublicUrl = getServerPublicUrl();

      // Use custom voice for "didn't hear anything" message
      const noSpeechMessage = "I'm sorry, I didn't hear anything. Please tell me how I can help you.";
      const audioUrl = await generateAndUploadAudio(noSpeechMessage, voiceId, user_id);

      if (audioUrl) {
        response.play(audioUrl);
      } else {
        response.say({ voice: 'Polly.Amy' }, noSpeechMessage);
      }

      const gather = response.gather({
        input: 'speech',
        action: `${serverPublicUrl}/telephony/conversation-continue`,
        method: 'POST',
        speechTimeout: 'auto',
        speechModel: 'phone_call',
        language: 'en-AU',
      });

      response.redirect(`${serverPublicUrl}/telephony/conversation-continue`);

      res.type('text/xml');
      res.send(response.toString());
      return;
    }

    // Get user and business context for AI processing
    const user = await getUserByTwilioNumber(conversation.to_number);
    const businessContextData = await getBusinessContext(user_id);
    const businessContext = businessContextData?.business_context || null;

    // Build conversation history for AI context
    const conversationHistory = responses.map(r => [
      { role: 'assistant', content: r.question || '' },
      { role: 'user', content: r.answer },
    ]).flat().filter(msg => msg.content);

    // Process caller's message with AI
    const aiResult = await processCallerMessage({
      callerMessage: SpeechResult,
      conversationHistory,
      businessContext,
      user,
    });

    console.log('[ConversationHandler] AI processed message', {
      CallSid,
      aiReply: aiResult.aiReply,
      hasBookingInfo: !!aiResult.bookingInfo,
      conversationComplete: aiResult.conversationComplete,
    });

    // Store this exchange in conversation history
    responses.push({
      question: '', // AI doesn't ask fixed questions
      answer: SpeechResult,
      aiReply: aiResult.aiReply,
      bookingInfo: aiResult.bookingInfo,
      confidence: parseFloat(Confidence) || 0,
      timestamp: new Date().toISOString(),
    });

    // Build TwiML response
    const response = new twilio.twiml.VoiceResponse();
    const serverPublicUrl = getServerPublicUrl();

    if (aiResult.conversationComplete) {
      // We have all the info we need - close the conversation
      await updateConversationState(CallSid, {
        responses,
        status: 'completed',
        completedAt: new Date().toISOString(),
      });

      // Update call record with conversation transcript
      try {
        const { insertTranscription } = require('../supabaseMcpClient');
        const { randomUUID } = require('crypto');

        // Build full conversation transcript
        const conversationTranscript = responses.map((r, idx) => {
          const speaker1 = r.aiReply || r.question || 'AI';
          const speaker2 = r.answer || 'Caller';
          return `[Turn ${idx + 1}]\nAI: ${speaker1}\nCaller: ${speaker2}`;
        }).join('\n\n');

        // Insert as transcription so it shows in the app
        await insertTranscription({
          id: randomUUID(),
          callSid: CallSid,
          engine: 'ai_conversation',
          text: conversationTranscript,
          confidence: 0.95, // AI conversations have high confidence
          language: 'en',
        });

        await upsertCallRecord({
          callSid: CallSid,
          status: 'completed',
          transcriptionStatus: 'completed',
        });

        console.log('[ConversationHandler] Conversation transcript saved to database');
      } catch (callRecordError) {
        console.error('[ConversationHandler] Failed to update call record:', callRecordError);
      }

      // Generate personalized closing message
      const closingMessage = generateClosingMessage(aiResult.bookingInfo, businessContext);
      const closingAudioUrl = await generateAndUploadAudio(closingMessage, voiceId, user_id);

      if (closingAudioUrl) {
        response.play(closingAudioUrl);
      } else {
        response.say({ voice: 'Polly.Amy' }, closingMessage);
      }

      response.hangup();

      console.log('[ConversationHandler] Conversation completed', {
        CallSid,
        bookingInfo: aiResult.bookingInfo,
      });

      // Create job card from booking info
      try {
        const { insertJob } = require('../supabaseMcpClient');
        const { sendJobCreatedNotification } = require('../notifications/pushService');

        const bookingInfo = aiResult.bookingInfo || {};

        // Convert relative date strings to ISO dates
        const scheduledDate = bookingInfo.preferredDate
          ? parseRelativeDateToISO(bookingInfo.preferredDate)
          : null;

        // Get recording URL from call record (may be available later via webhook)
        const { getCallBySid } = require('../supabaseMcpClient');
        const callRecord = await getCallBySid(CallSid).catch(() => null);

        const jobPayload = {
          userId: user_id,
          callSid: CallSid,
          customerName: bookingInfo.customerName || null,
          customerPhone: bookingInfo.phoneNumber || null,
          customerEmail: null,
          summary: `${bookingInfo.serviceRequested || 'Service'} - ${bookingInfo.preferredDate || 'Date TBD'}`,
          serviceType: bookingInfo.serviceRequested || null,
          status: 'new',
          businessType: user?.business_type || null,
          source: 'ai_receptionist',
          capturedAt: new Date().toISOString(),
          voicemailTranscript: responses.map(r => `Q: ${r.question || r.aiReply}\nA: ${r.answer}`).join('\n\n'),
          voicemailRecordingUrl: callRecord?.recording_url || null,
          scheduledDate: scheduledDate,
          scheduledTime: bookingInfo.preferredTime || null,
          location: bookingInfo.location || null,
          notes: `Urgency: ${bookingInfo.urgency || 'medium'}${bookingInfo.preferredDate ? `\nRequested: ${bookingInfo.preferredDate}` : ''}`,
          estimatedDuration: null,
          followUpDraft: null,
          lastFollowUpAt: null,
        };

        const inserted = await insertJob(jobPayload);
        console.log('[ConversationHandler] Job created from AI conversation', {
          CallSid,
          jobId: inserted?.id,
        });

        // Send push notification
        const jobRecord = {
          id: inserted?.id,
          call_sid: CallSid,
          customer_name: jobPayload.customerName,
          status: jobPayload.status || 'new',
        };

        sendJobCreatedNotification({ userId: user_id, job: jobRecord })
          .then((result) => {
            if (result.sent > 0) {
              console.log('[Push] Job notification sent for AI conversation.', {
                jobId: jobRecord.id,
                sent: result.sent,
              });
            }
          })
          .catch((error) => {
            console.warn('[Push] Failed to send job notification.', { jobId: jobRecord.id, error });
          });
      } catch (jobError) {
        console.error('[ConversationHandler] Failed to create job from conversation:', jobError);
      }
    } else {
      // Conversation continues - play AI's response and gather next input
      await updateConversationState(CallSid, {
        responses,
      });

      const responseScript = aiResult.aiReply
        ? `${WAITING_FILLER_PHRASE} ${aiResult.aiReply}`.trim()
        : WAITING_FILLER_PHRASE;

      // Generate and play AI's response using ElevenLabs
      const aiReplyAudioUrl = await generateAndUploadAudio(responseScript, voiceId, user_id);

      // Gather with the AI's response - no additional prompts
      const gather = response.gather({
        input: 'speech',
        action: `${serverPublicUrl}/telephony/conversation-continue`,
        method: 'POST',
        speechTimeout: 'auto',
        speechModel: 'phone_call',
        language: 'en-AU',
      });

      // Play the AI's response INSIDE the gather so it doesn't overlap
      if (aiReplyAudioUrl) {
        gather.play(aiReplyAudioUrl);
      } else {
        // Fallback to Polly only if ElevenLabs fails
        gather.say({ voice: 'Polly.Amy' }, responseScript);
      }

      // If gather times out (no response), loop back to continue
      response.redirect(`${serverPublicUrl}/telephony/conversation-continue`);
    }

    res.type('text/xml');
    res.send(response.toString());
  } catch (error) {
    console.error('[ConversationHandler] Error handling conversation continue', { error, CallSid });
    // Get conversation to retrieve voice info for fallback
    const conversation = await getConversationState(CallSid).catch(() => null);
    const voiceId = conversation?.voice_id;
    const userId = conversation?.user_id;
    return sendFallbackVoicemail(res, voiceId, userId);
  }
};

/**
 * Fallback to basic voicemail if conversation fails
 */
const sendFallbackVoicemail = async (res, voiceId = null, userId = null) => {
  const response = new twilio.twiml.VoiceResponse();
  const serverPublicUrl = getServerPublicUrl();

  const fallbackMessage = "Hi, you've reached FlynnAI. Please leave a message after the tone.";

  // Try to use custom voice if available
  if (voiceId && userId) {
    try {
      const audioUrl = await generateAndUploadAudio(fallbackMessage, voiceId, userId);
      if (audioUrl) {
        response.play(audioUrl);
      } else {
        response.say({ voice: 'Polly.Amy' }, fallbackMessage);
      }
    } catch (error) {
      console.error('[ConversationHandler] Failed to generate fallback audio:', error);
      response.say({ voice: 'Polly.Amy' }, fallbackMessage);
    }
  } else {
    response.say({ voice: 'Polly.Amy' }, fallbackMessage);
  }

  response.record({
    action: `${serverPublicUrl}/telephony/recording-complete`,
    method: 'POST',
    playBeep: true,
  });

  res.type('text/xml');
  res.send(response.toString());
};

/**
 * Handle recording status callback from Twilio
 */
const handleRecordingStatus = async (req, res) => {
  const { CallSid, RecordingUrl, RecordingSid, RecordingDuration } = req.body;

  console.log('[ConversationHandler] Recording completed', {
    CallSid,
    RecordingSid,
    RecordingDuration,
    RecordingUrl,
  });

  try {
    // Update call record with recording URL
    await upsertCallRecord({
      callSid: CallSid,
      recordingUrl: RecordingUrl,
      recordingSid: RecordingSid,
      durationSec: parseInt(RecordingDuration, 10),
    });

    console.log('[ConversationHandler] Recording URL saved to database');

    // Also update any job associated with this call
    const { getJobByCallSid, executeSql } = require('../supabaseMcpClient');
    const job = await getJobByCallSid(CallSid).catch(() => null);

    if (job) {
      const updateQuery = `
        UPDATE public.jobs
        SET voicemail_recording_url = '${RecordingUrl.replace(/'/g, "''")}'
        WHERE call_sid = '${CallSid}'
      `;
      await executeSql(updateQuery).catch(err => {
        console.error('[ConversationHandler] Failed to update job recording URL:', err);
      });
      console.log('[ConversationHandler] Job recording URL updated', { jobId: job.id });
    }
  } catch (error) {
    console.error('[ConversationHandler] Failed to save recording URL:', error);
  }

  // Respond to Twilio
  res.status(200).send('OK');
};

module.exports = {
  handleInboundCall,
  handleConversationContinue,
  handleRecordingStatus,
  generateSpeech,
};
