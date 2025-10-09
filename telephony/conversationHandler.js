const twilio = require('twilio');
const { randomUUID } = require('crypto');

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
} = require('../supabaseMcpClient');

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

    // Get user's receptionist settings
    const {
      receptionist_greeting,
      receptionist_questions,
      receptionist_voice,
      receptionist_voice_profile_id,
    } = user;

    const greeting = receptionist_greeting || "Hi, you've reached FlynnAI. Please leave your details after the tone.";
    const questions = Array.isArray(receptionist_questions) && receptionist_questions.length > 0
      ? receptionist_questions
      : ['What is your name?', 'What is your phone number?', 'What service do you need?'];

    const voiceOption = receptionist_voice || 'koala_warm';

    // Get custom voice ID if using custom voice
    let customVoiceId = null;
    if (voiceOption === 'custom_voice' && receptionist_voice_profile_id) {
      // TODO: Fetch voice_id from voice_profiles table
      customVoiceId = receptionist_voice_profile_id;
    }

    const voiceId = resolveVoiceId(voiceOption, customVoiceId);

    // Create conversation state
    const conversationId = randomUUID();
    await upsertConversationState({
      id: conversationId,
      callSid: CallSid,
      userId: user.id,
      fromNumber: From,
      toNumber: To,
      currentStep: 0,
      totalSteps: questions.length,
      questions,
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

    // Say greeting using Polly voice (we'll upgrade to ElevenLabs cached audio later)
    response.say({ voice: 'Polly.Amy' }, greeting);

    // Pause briefly
    response.pause({ length: 1 });

    // Gather first response
    const gather = response.gather({
      input: 'speech',
      action: `${serverPublicUrl}/telephony/conversation-continue`,
      method: 'POST',
      speechTimeout: 'auto',
      speechModel: 'phone_call',
      language: 'en-AU',
    });

    gather.say({ voice: 'Polly.Amy' }, questions[0]);

    // If no input, prompt again
    response.say({ voice: 'Polly.Amy' }, "I didn't catch that. Let me ask again.");
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
 * Handle conversation continuation - process responses and ask next question
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

    const { currentStep, totalSteps, questions, responses, voiceId } = conversation;

    // Store the response if we have one
    if (SpeechResult) {
      responses.push({
        question: questions[currentStep],
        answer: SpeechResult,
        confidence: parseFloat(Confidence) || 0,
        timestamp: new Date().toISOString(),
      });

      console.log('[ConversationHandler] Response recorded', {
        CallSid,
        step: currentStep,
        question: questions[currentStep],
        answer: SpeechResult,
      });
    }

    const nextStep = currentStep + 1;

    // Check if we have more questions
    if (nextStep < totalSteps) {
      // Update state
      await updateConversationState(CallSid, {
        currentStep: nextStep,
        responses,
      });

      // Build TwiML for next question
      const response = new twilio.twiml.VoiceResponse();

      const serverPublicUrl = getServerPublicUrl();
      const gather = response.gather({
        input: 'speech',
        action: `${serverPublicUrl}/telephony/conversation-continue`,
        method: 'POST',
        speechTimeout: 'auto',
        speechModel: 'phone_call',
        language: 'en-AU',
      });

      gather.say({ voice: 'Polly.Amy' }, questions[nextStep]);

      response.redirect(`${serverPublicUrl}/telephony/conversation-continue`);

      res.type('text/xml');
      res.send(response.toString());

      console.log('[ConversationHandler] Next question sent', {
        CallSid,
        nextStep,
        question: questions[nextStep],
      });
    } else {
      // Conversation complete
      await updateConversationState(CallSid, {
        currentStep: nextStep,
        responses,
        status: 'completed',
        completedAt: new Date().toISOString(),
      });

      // Update call record status
      try {
        console.log('[ConversationHandler] Updating call record to completed', { CallSid });
        await upsertCallRecord({
          callSid: CallSid,
          status: 'completed',
          transcriptionStatus: 'conversation_completed',
        });
        console.log('[ConversationHandler] Call record updated to completed');
      } catch (callRecordError) {
        console.error('[ConversationHandler] Failed to update call record:', callRecordError);
      }

      // Build final TwiML
      const response = new twilio.twiml.VoiceResponse();
      response.say(
        { voice: 'Polly.Amy' },
        "Thank you for your details. We'll be in touch shortly to confirm your booking. Goodbye!"
      );
      response.hangup();

      res.type('text/xml');
      res.send(response.toString());

      console.log('[ConversationHandler] Conversation completed', { CallSid, responses });

      // TODO: Create job card from conversation responses
      // This will be handled by a background job that processes completed conversations
    }
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
