const twilio = require('twilio');

/**
 * Realtime API Conversation Handler
 *
 * Provides Twilio webhook endpoints that use Media Streams instead of Gather
 * for ultra-low latency conversations with OpenAI Realtime API
 *
 * ARCHITECTURE CHANGE:
 * OLD: Call → Gather (STT) → Webhook → OpenAI (LLM) → ElevenLabs (TTS) → Play (~5-10s)
 * NEW: Call → Media Stream → WebSocket → Realtime API (audio-to-audio) (~300-600ms)
 */

const getServerPublicUrl = () => process.env.SERVER_PUBLIC_URL;

/**
 * Handle inbound call with Media Streams
 * Replaces handleInboundCall from conversationHandler.js
 */
const handleRealtimeInboundCall = async (req, res) => {
  const CallSid = req.body.CallSid || req.query.CallSid;
  const From = req.body.From || req.query.From;
  const To = req.body.To || req.query.To;

  console.log('[RealtimeHandler] Inbound call received', {
    CallSid,
    From,
    To,
  });

  try {
    const response = new twilio.twiml.VoiceResponse();
    const serverPublicUrl = getServerPublicUrl();

    // Start Media Stream connection to WebSocket server
    // This opens a bidirectional audio stream to our realtime server
    const connect = response.connect();
    const stream = connect.stream({
      url: `wss://${serverPublicUrl.replace(/^https?:\/\//, '')}/realtime-stream?callSid=${CallSid}&from=${encodeURIComponent(From)}&to=${encodeURIComponent(To)}`,
    });

    // Enable recording for the call (for backup/compliance)
    response.record({
      recordingStatusCallback: `${serverPublicUrl}/telephony/realtime-recording-status`,
      recordingStatusCallbackMethod: 'POST',
      recordingStatusCallbackEvent: ['completed'],
    });

    const twiml = response.toString();
    console.log('[RealtimeHandler] TwiML response:', twiml);

    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('[RealtimeHandler] Error handling inbound call', { error, CallSid });

    // Fallback to basic voicemail
    const response = new twilio.twiml.VoiceResponse();
    response.say(
      { voice: 'Polly.Amy' },
      "Hi, you've reached FlynnAI. We're experiencing technical difficulties. Please leave a message after the tone."
    );
    response.record({
      action: `${getServerPublicUrl()}/telephony/recording-complete`,
      method: 'POST',
      playBeep: true,
    });

    res.type('text/xml');
    res.send(response.toString());
  }
};

/**
 * Handle recording status callback
 * Saves recording URL for backup/compliance
 */
const handleRealtimeRecordingStatus = async (req, res) => {
  const { CallSid, RecordingUrl, RecordingSid, RecordingDuration } = req.body;

  console.log('[RealtimeHandler] Recording completed', {
    CallSid,
    RecordingSid,
    RecordingDuration,
    RecordingUrl,
  });

  try {
    const { upsertCallRecord } = require('../supabaseMcpClient');

    await upsertCallRecord({
      callSid: CallSid,
      recordingUrl: RecordingUrl,
      recordingSid: RecordingSid,
      durationSec: parseInt(RecordingDuration, 10),
    });

    console.log('[RealtimeHandler] Recording URL saved to database');
  } catch (error) {
    console.error('[RealtimeHandler] Failed to save recording URL:', error);
  }

  res.status(200).send('OK');
};

/**
 * Health check endpoint for Realtime API integration
 */
const handleRealtimeHealthCheck = (req, res) => {
  const { activeSessions } = require('./realtimeServer');

  const health = {
    status: 'healthy',
    service: 'realtime-api',
    openaiConnected: !!process.env.OPENAI_API_KEY,
    activeSessions: activeSessions.size,
    timestamp: new Date().toISOString(),
  };

  console.log('[RealtimeHandler] Health check:', health);

  res.json(health);
};

module.exports = {
  handleRealtimeInboundCall,
  handleRealtimeRecordingStatus,
  handleRealtimeHealthCheck,
};
