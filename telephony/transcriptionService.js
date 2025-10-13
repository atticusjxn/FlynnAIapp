const OpenAI = require('openai');
const fetch = require('node-fetch');

/**
 * Transcription Service using OpenAI Whisper
 *
 * Provides superior transcription accuracy compared to Twilio's built-in STT
 * Particularly effective for:
 * - Noisy phone call environments
 * - Accented speech
 * - Technical terminology (service-related vocabulary)
 *
 * ACCURACY IMPROVEMENTS:
 * - Whisper is top-tier for speech recognition in 2025
 * - Better than Twilio STT for phone call quality audio
 * - Handles background noise and poor connections well
 */

let openaiClient = null;

const getOpenAIClient = () => {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
};

/**
 * Transcribe audio file using OpenAI Whisper
 * @param {string|Buffer} audioInput - Audio file URL or Buffer
 * @param {string} language - Language code (e.g., 'en', 'en-AU')
 * @returns {Promise<{text: string, confidence: number, duration: number}>}
 */
const transcribeAudio = async (audioInput, language = 'en') => {
  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }

  const startTime = Date.now();

  try {
    let audioFile;

    // Handle URL input - fetch the audio file
    if (typeof audioInput === 'string' && (audioInput.startsWith('http://') || audioInput.startsWith('https://'))) {
      console.log('[TranscriptionService] Fetching audio from URL:', audioInput);

      const response = await fetch(audioInput);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
      }

      const audioBuffer = await response.buffer();
      audioFile = new File([audioBuffer], 'audio.mp3', { type: 'audio/mpeg' });
    } else if (Buffer.isBuffer(audioInput)) {
      // Handle Buffer input
      audioFile = new File([audioInput], 'audio.mp3', { type: 'audio/mpeg' });
    } else {
      throw new Error('Invalid audio input: must be URL or Buffer');
    }

    console.log('[TranscriptionService] Transcribing with Whisper...');

    // Use Whisper API for transcription
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: language.split('-')[0], // Convert 'en-AU' to 'en'
      response_format: 'verbose_json', // Get detailed response with confidence
      temperature: 0.0, // Deterministic output
    });

    const duration = Date.now() - startTime;

    console.log('[TranscriptionService] Transcription complete', {
      duration: `${duration}ms`,
      text: transcription.text,
      language: transcription.language,
    });

    // Verbose JSON response includes segments with confidence scores
    let avgConfidence = 0.95; // Whisper doesn't always provide per-word confidence
    if (transcription.segments && transcription.segments.length > 0) {
      // Calculate average confidence from segments if available
      const confidences = transcription.segments
        .map(s => s.avg_logprob)
        .filter(c => c !== undefined);

      if (confidences.length > 0) {
        // Convert log probabilities to confidence scores (0-1)
        avgConfidence = Math.exp(confidences.reduce((a, b) => a + b, 0) / confidences.length);
      }
    }

    return {
      text: transcription.text,
      confidence: avgConfidence,
      duration: transcription.duration || 0,
      language: transcription.language,
      segments: transcription.segments || [],
    };
  } catch (error) {
    console.error('[TranscriptionService] Transcription failed:', error);
    throw error;
  }
};

/**
 * Transcribe Twilio recording URL using Whisper
 * This is the main entry point for transcribing phone call recordings
 */
const transcribeTwilioRecording = async (recordingUrl, language = 'en-AU') => {
  try {
    // Twilio recordings are typically in .wav or .mp3 format
    // Whisper handles both formats well

    console.log('[TranscriptionService] Transcribing Twilio recording:', recordingUrl);

    const result = await transcribeAudio(recordingUrl, language);

    return {
      text: result.text,
      confidence: result.confidence,
      duration: result.duration,
      engine: 'whisper',
      model: 'whisper-1',
    };
  } catch (error) {
    console.error('[TranscriptionService] Failed to transcribe Twilio recording:', error);
    throw error;
  }
};

/**
 * Transcribe audio with fallback to Twilio STT
 * Use this for production to ensure calls never fail
 */
const transcribeWithFallback = async (recordingUrl, twilioTranscript = null, language = 'en-AU') => {
  try {
    // Try Whisper first for best accuracy
    return await transcribeTwilioRecording(recordingUrl, language);
  } catch (error) {
    console.error('[TranscriptionService] Whisper failed, using Twilio fallback:', error);

    // Fallback to Twilio's transcript if available
    if (twilioTranscript) {
      console.log('[TranscriptionService] Using Twilio STT fallback');
      return {
        text: twilioTranscript,
        confidence: 0.85, // Estimated confidence for Twilio STT
        duration: 0,
        engine: 'twilio',
        model: 'twilio-phone_call',
      };
    }

    throw new Error('Both Whisper and Twilio transcription unavailable');
  }
};

module.exports = {
  transcribeAudio,
  transcribeTwilioRecording,
  transcribeWithFallback,
};
