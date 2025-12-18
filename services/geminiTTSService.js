/**
 * Google Gemini 2.5 Text-to-Speech Service (Server-side)
 *
 * Uses Google's latest Gemini 2.5 Flash/Pro TTS models for superior voice quality.
 * Documentation: https://ai.google.dev/gemini-api/docs/speech-generation
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Available Gemini voice names with descriptions
const GEMINI_VOICES = {
  // Bright voices
  Zephyr: 'Bright',
  Autonoe: 'Bright',

  // Upbeat voices
  Puck: 'Upbeat',
  Laomedeia: 'Upbeat',

  // Firm voices
  Kore: 'Firm',
  Orus: 'Firm',
  Alnilam: 'Firm',

  // Informative voices
  Charon: 'Informative',
  Rasalgethi: 'Informative',

  // Easy-going voices
  Callirrhoe: 'Easy-going',
  Umbriel: 'Easy-going',

  // Clear voices
  Iapetus: 'Clear',
  Erinome: 'Clear',

  // Smooth voices
  Algieba: 'Smooth',
  Despina: 'Smooth',

  // Soft voices
  Achernar: 'Soft',

  // Other unique voices
  Fenrir: 'Excitable',
  Leda: 'Youthful',
  Aoede: 'Breezy',
  Enceladus: 'Breathy',
  Algenib: 'Gravelly',
  Schedar: 'Even',
  Gacrux: 'Mature',
  Pulcherrima: 'Forward',
  Achird: 'Friendly',
  Zubenelgenubi: 'Casual',
  Vindemiatrix: 'Gentle',
  Sadachbia: 'Lively',
  Sadaltager: 'Knowledgeable',
  Sulafat: 'Warm',
};

// Preset voice mappings for Flynn personas
const PRESET_VOICE_MAPPING = {
  flynn_warm: 'Sulafat', // Warm voice for friendly persona
  flynn_expert: 'Kore', // Firm voice for professional persona
  flynn_hype: 'Puck', // Upbeat voice for energetic persona
  koala_warm: 'Sulafat',
  koala_expert: 'Kore',
  koala_hype: 'Puck',
  male: 'Orus', // Firm male-sounding voice
  female: 'Aoede', // Breezy female-sounding voice
};

// Location-based accent mappings
const LOCATION_ACCENT_MAPPING = {
  AU: 'Australian English',
  GB: 'British English',
  UK: 'British English',
  US: 'American English',
  NZ: 'New Zealand English',
  CA: 'Canadian English',
  IE: 'Irish English',
  ZA: 'South African English',
};

/**
 * Convert PCM audio data to WAV format
 */
function pcmToWav(pcmData, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.length;
  const headerSize = 44;
  const fileSize = headerSize + dataSize - 8;

  const header = Buffer.alloc(headerSize);

  // RIFF chunk descriptor
  header.write('RIFF', 0);
  header.writeUInt32LE(fileSize, 4);
  header.write('WAVE', 8);

  // fmt sub-chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}

/**
 * Build TTS prompt with optional style, pace, and accent control
 */
function buildGeminiPrompt(text, options = {}) {
  const parts = [];

  // Add style guidance if provided
  if (options.style) {
    parts.push(`Style: ${options.style}`);
  }

  // Add pacing guidance if provided
  if (options.pace) {
    parts.push(`Pacing: ${options.pace}`);
  }

  // Add accent guidance if provided
  if (options.accent) {
    parts.push(`Accent: ${options.accent}`);
  }

  // Add the text to speak
  if (parts.length > 0) {
    parts.push(`\nText: ${text}`);
    return parts.join('\n');
  }

  // If no style guidance, just return the text
  return text;
}

/**
 * Generate speech using Gemini TTS
 */
async function generateSpeech(apiKey, text, options = {}) {
  if (!apiKey) {
    throw new Error('Gemini API key is required');
  }

  const model = options.model || 'gemini-2.5-flash-preview-tts';
  const voiceName = options.voiceName || 'Kore';
  const outputFormat = options.outputFormat || 'wav'; // 'wav' or 'pcm'

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model });

    const prompt = buildGeminiPrompt(text, {
      style: options.style,
      pace: options.pace,
      accent: options.accent,
    });

    const result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName,
            },
          },
        },
      },
    });

    const response = await result.response;
    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioData) {
      throw new Error('No audio data returned from Gemini TTS');
    }

    // Audio is returned as base64-encoded PCM data
    const pcmBuffer = Buffer.from(audioData, 'base64');

    // Convert to WAV if requested
    if (outputFormat === 'wav') {
      const wavBuffer = pcmToWav(pcmBuffer);
      return {
        audio: wavBuffer.toString('base64'),
        contentType: 'audio/wav',
        format: 'wav',
      };
    }

    return {
      audio: pcmBuffer.toString('base64'),
      contentType: 'audio/pcm',
      format: 'pcm',
    };
  } catch (error) {
    console.error('[GeminiTTS] Generation error:', error);
    throw new Error(`Failed to generate speech: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Get accent from location code (e.g., 'AU' -> 'Australian English')
 */
function getAccentFromLocation(locationCode) {
  if (!locationCode || typeof locationCode !== 'string') {
    return null;
  }

  // Handle both country codes and full location objects
  const code = locationCode.toUpperCase();
  return LOCATION_ACCENT_MAPPING[code] || null;
}

/**
 * Detect location from business profile locations array
 * Returns primary country code (e.g., 'AU', 'US', 'GB')
 */
function detectLocationFromProfile(locations) {
  if (!Array.isArray(locations) || locations.length === 0) {
    return null;
  }

  // Try to extract country code from first location
  const firstLocation = locations[0];

  if (typeof firstLocation === 'string') {
    // Simple string location - try to detect country from text
    const upperLocation = firstLocation.toUpperCase();
    if (upperLocation.includes('AUSTRALIA') || upperLocation.includes('SYDNEY') || upperLocation.includes('MELBOURNE')) {
      return 'AU';
    }
    if (upperLocation.includes('UNITED KINGDOM') || upperLocation.includes('UK') || upperLocation.includes('LONDON')) {
      return 'GB';
    }
    if (upperLocation.includes('UNITED STATES') || upperLocation.includes('USA') || upperLocation.includes('US')) {
      return 'US';
    }
  } else if (typeof firstLocation === 'object' && firstLocation !== null) {
    // Structured location object
    if (firstLocation.country_code) {
      return firstLocation.country_code.toUpperCase();
    }
    if (firstLocation.country) {
      const country = firstLocation.country.toUpperCase();
      if (country === 'AUSTRALIA') return 'AU';
      if (country === 'UNITED KINGDOM' || country === 'UK') return 'GB';
      if (country === 'UNITED STATES' || country === 'USA') return 'US';
    }
  }

  return null;
}

/**
 * Resolve voice name from preset or custom voice option
 */
function resolveVoiceName(voiceOption) {
  // Check if it's a preset mapping
  if (PRESET_VOICE_MAPPING[voiceOption]) {
    return PRESET_VOICE_MAPPING[voiceOption];
  }

  // Check if it's a valid Gemini voice name
  if (GEMINI_VOICES[voiceOption]) {
    return voiceOption;
  }

  // Default to Kore (firm, professional voice)
  return 'Kore';
}

/**
 * Get available voices with descriptions
 */
function getAvailableVoices() {
  return Object.entries(GEMINI_VOICES).map(([name, description]) => ({
    name,
    description,
  }));
}

module.exports = {
  generateSpeech,
  resolveVoiceName,
  getAvailableVoices,
  getAccentFromLocation,
  detectLocationFromProfile,
  GEMINI_VOICES,
  PRESET_VOICE_MAPPING,
  LOCATION_ACCENT_MAPPING,
  pcmToWav,
  buildGeminiPrompt,
};
