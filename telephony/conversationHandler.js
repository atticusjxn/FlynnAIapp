const twilio = require('twilio');
const { randomUUID } = require('crypto');
const { createClient } = require('@supabase/supabase-js');

/**
 * Conversation handler for AI receptionist interactions
 * Manages state-based conversation flow with callers
 */

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

const presetReceptionistVoices = {
  koala_warm: process.env.ELEVENLABS_VOICE_KOALA_WARM_ID,
  koala_expert: process.env.ELEVENLABS_VOICE_KOALA_EXPERT_ID,
  koala_hype: process.env.ELEVENLABS_VOICE_KOALA_HYPE_ID,
};

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

  return presetReceptionistVoices[voiceOption] || presetReceptionistVoices.koala_warm;
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
      .from('voicemail')
      .list(`receptionist-audio/${userId}`, {
        search: `${hash}.mp3`,
      });

    let publicUrl;

    if (existingFile && existingFile.length > 0) {
      // Audio already exists, get public URL
      console.log('[ConversationHandler] Using cached audio:', filename);
      const { data } = storage
        .storage
        .from('voicemail')
        .getPublicUrl(filename);
      publicUrl = data?.publicUrl;
    } else {
      // Upload new audio
      console.log('[ConversationHandler] Uploading new audio:', filename);
      const { error: uploadError } = await storage
        .storage
        .from('voicemail')
        .upload(filename, Buffer.from(audioBuffer), {
          contentType: 'audio/mpeg',
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error('[ConversationHandler] Failed to upload audio:', uploadError);
        return null;
      }

      // Get public URL
      const { data } = storage
        .storage
        .from('voicemail')
        .getPublicUrl(filename);
      publicUrl = data?.publicUrl;
    }

    return publicUrl;
  } catch (error) {
    console.error('[ConversationHandler] Failed to generate/upload audio:', error);
    return null;
  }
};

/**
 * Handle initial inbound call - play greeting and start conversation
 */
const handleInboundCall = async (req, res) => {
  console.log('[ConversationHandler] Inbound call received', {
    CallSid: req.body.CallSid,
    From: req.body.From,
    To: req.body.To,
  });

  const { CallSid, From, To } = req.body;

  try {
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
        status: 'in-progress',
        transcriptionStatus: 'conversation_active',
      });
      console.log('[ConversationHandler] Call record created successfully');
    } catch (callRecordError) {
      console.error('[ConversationHandler] Failed to create call record:', callRecordError);
    }

    // Build TwiML response
    const response = new twilio.twiml.VoiceResponse();

    // Start recording the call
    const serverPublicUrl = getServerPublicUrl();
    response.record({
      recordingStatusCallback: `${serverPublicUrl}/telephony/recording-status`,
      recordingStatusCallbackMethod: 'POST',
      recordingStatusCallbackEvent: ['completed'],
      maxLength: 600, // 10 minutes max
      trim: 'trim-silence',
    });

    // Generate and play greeting using ElevenLabs
    const greetingAudioUrl = await generateAndUploadAudio(greeting, voiceId, user.id);
    if (greetingAudioUrl) {
      response.play(greetingAudioUrl);
    } else {
      // Fallback to Polly if audio generation fails
      response.say({ voice: 'Polly.Amy' }, greeting);
    }

    // Pause briefly for caller to start speaking
    response.pause({ length: 2 });

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

    // The greeting already asks "How can I help you?" so we just listen
    // If no input after the pause, prompt the caller
    response.say({ voice: 'Polly.Amy' }, "I'm here to help. What can I do for you today?");
    response.redirect(`${serverPublicUrl}/telephony/inbound-voice`);

    const twiml = response.toString();
    console.log('[ConversationHandler] TwiML response:', twiml);

    res.type('text/xml');
    res.send(twiml);

    console.log('[ConversationHandler] Greeting sent, waiting for response', { conversationId, CallSid });
  } catch (error) {
    console.error('[ConversationHandler] Error handling inbound call', { error, CallSid });
    return sendFallbackVoicemail(res);
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
      return sendFallbackVoicemail(res);
    }

    const { responses, voiceId, user_id } = conversation;

    // If no speech input, ask them to speak
    if (!SpeechResult) {
      const response = new twilio.twiml.VoiceResponse();
      response.say({ voice: 'Polly.Amy' }, "I'm sorry, I didn't hear anything. Please tell me how I can help you.");

      const serverPublicUrl = getServerPublicUrl();
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

      // Update call record with booking info
      try {
        await upsertCallRecord({
          callSid: CallSid,
          status: 'completed',
          transcriptionStatus: 'conversation_completed',
        });
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

      // TODO: Create job card from booking info
    } else {
      // Conversation continues - play AI's response and gather next input
      await updateConversationState(CallSid, {
        responses,
      });

      // Generate and play AI's response
      const aiReplyAudioUrl = await generateAndUploadAudio(aiResult.aiReply, voiceId, user_id);

      if (aiReplyAudioUrl) {
        response.play(aiReplyAudioUrl);
      } else {
        response.say({ voice: 'Polly.Amy' }, aiResult.aiReply);
      }

      // Gather next response
      const gather = response.gather({
        input: 'speech',
        action: `${serverPublicUrl}/telephony/conversation-continue`,
        method: 'POST',
        speechTimeout: 'auto',
        speechModel: 'phone_call',
        language: 'en-AU',
      });

      // If no response, ask a follow-up question
      const nextQuestion = getNextQuestion(aiResult.bookingInfo || {});
      if (nextQuestion) {
        gather.say({ voice: 'Polly.Amy' }, nextQuestion);
      }

      response.redirect(`${serverPublicUrl}/telephony/conversation-continue`);
    }

    res.type('text/xml');
    res.send(response.toString());
  } catch (error) {
    console.error('[ConversationHandler] Error handling conversation continue', { error, CallSid });
    return sendFallbackVoicemail(res);
  }
};

/**
 * Fallback to basic voicemail if conversation fails
 */
const sendFallbackVoicemail = (res) => {
  const response = new twilio.twiml.VoiceResponse();
  response.say({ voice: 'Polly.Amy' }, "Hi, you've reached FlynnAI. Please leave a message after the tone.");
  const serverPublicUrl = getServerPublicUrl();
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
