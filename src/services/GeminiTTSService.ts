import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Google Gemini 2.5 Text-to-Speech Service
 *
 * Uses Google's latest Gemini 2.5 Flash/Pro TTS models for superior voice quality.
 * Documentation: https://ai.google.dev/gemini-api/docs/speech-generation
 */

// Location-based accent mappings
const LOCATION_ACCENT_MAPPING: Record<string, string> = {
  AU: 'Australian English',
  GB: 'British English',
  UK: 'British English',
  US: 'American English',
  NZ: 'New Zealand English',
  CA: 'Canadian English',
  IE: 'Irish English',
  ZA: 'South African English',
};

export type GeminiVoiceName =
  | 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Leda'
  | 'Orus' | 'Aoede' | 'Callirrhoe' | 'Autonoe' | 'Enceladus' | 'Iapetus'
  | 'Umbriel' | 'Algieba' | 'Despina' | 'Erinome' | 'Algenib' | 'Rasalgethi'
  | 'Laomedeia' | 'Achernar' | 'Alnilam' | 'Schedar' | 'Gacrux' | 'Pulcherrima'
  | 'Achird' | 'Zubenelgenubi' | 'Vindemiatrix' | 'Sadachbia' | 'Sadaltager' | 'Sulafat';

export type GeminiTTSModel = 'gemini-2.5-flash-preview-tts' | 'gemini-2.5-pro-preview-tts';

export interface GeminiTTSConfig {
  apiKey: string;
  model?: GeminiTTSModel;
  defaultVoice?: GeminiVoiceName;
}

export interface GeminiTTSRequest {
  text: string;
  voiceName?: GeminiVoiceName;
  style?: string; // Natural language style prompt (e.g., "cheerful and enthusiastic", "calm and professional")
  pace?: string; // Pacing instructions (e.g., "speak slowly", "fast and energetic")
  accent?: string; // Accent specification (e.g., "Australian English", "British English from London")
  location?: string; // Location code for automatic accent detection (e.g., "AU", "US", "GB")
}

export interface GeminiTTSResponse {
  audio: Buffer | string; // PCM audio data
  format: 'pcm_24000_16bit_mono' | 'wav';
  contentType: string;
}

class GeminiTTSService {
  private client: GoogleGenerativeAI | null = null;
  private config: GeminiTTSConfig | null = null;

  /**
   * Initialize the Gemini TTS service
   */
  initialize(config: GeminiTTSConfig): void {
    if (!config.apiKey) {
      throw new Error('Gemini API key is required');
    }

    this.config = {
      model: config.model || 'gemini-2.5-flash-preview-tts',
      defaultVoice: config.defaultVoice || 'Kore',
      ...config,
    };

    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  /**
   * Get initialized client
   */
  private getClient(): GoogleGenerativeAI {
    if (!this.client || !this.config) {
      throw new Error('GeminiTTSService not initialized. Call initialize() first.');
    }
    return this.client;
  }

  /**
   * Build the TTS prompt with optional style, pace, and accent control
   */
  private buildPrompt(request: GeminiTTSRequest): string {
    const parts: string[] = [];

    // Add style guidance if provided
    if (request.style) {
      parts.push(`Style: ${request.style}`);
    }

    // Add pacing guidance if provided
    if (request.pace) {
      parts.push(`Pacing: ${request.pace}`);
    }

    // Add accent guidance - either from explicit accent or detected from location
    let accentToUse = request.accent;
    if (!accentToUse && request.location) {
      const locationCode = request.location.toUpperCase();
      accentToUse = LOCATION_ACCENT_MAPPING[locationCode];
    }

    if (accentToUse) {
      parts.push(`Accent: ${accentToUse}`);
    }

    // Add the text to speak
    if (parts.length > 0) {
      parts.push(`\nText: ${request.text}`);
      return parts.join('\n');
    }

    // If no style guidance, just return the text
    return request.text;
  }

  /**
   * Generate speech from text using Gemini 2.5 TTS
   */
  async generateSpeech(request: GeminiTTSRequest): Promise<GeminiTTSResponse> {
    const client = this.getClient();
    const model = this.config!.model!;
    const voiceName = request.voiceName || this.config!.defaultVoice!;

    try {
      const genAI = client.getGenerativeModel({
        model,
      });

      const prompt = this.buildPrompt(request);

      const result = await genAI.generateContent({
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
      const audioBuffer = Buffer.from(audioData, 'base64');

      return {
        audio: audioBuffer,
        format: 'pcm_24000_16bit_mono',
        contentType: 'audio/pcm',
      };
    } catch (error) {
      console.error('Gemini TTS generation error:', error);
      throw new Error(`Failed to generate speech: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate speech and convert to WAV format
   */
  async generateSpeechWav(request: GeminiTTSRequest): Promise<GeminiTTSResponse> {
    const pcmResult = await this.generateSpeech(request);

    // Convert PCM to WAV by adding WAV header
    const wavBuffer = this.pcmToWav(pcmResult.audio as Buffer, 24000, 1, 16);

    return {
      audio: wavBuffer,
      format: 'wav',
      contentType: 'audio/wav',
    };
  }

  /**
   * Convert PCM data to WAV format by adding header
   */
  private pcmToWav(pcmData: Buffer, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
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
   * Get list of available voices with descriptions
   */
  getAvailableVoices(): Array<{ name: GeminiVoiceName; description: string }> {
    return [
      { name: 'Zephyr', description: 'Bright' },
      { name: 'Puck', description: 'Upbeat' },
      { name: 'Charon', description: 'Informative' },
      { name: 'Kore', description: 'Firm' },
      { name: 'Fenrir', description: 'Excitable' },
      { name: 'Leda', description: 'Youthful' },
      { name: 'Orus', description: 'Firm' },
      { name: 'Aoede', description: 'Breezy' },
      { name: 'Callirrhoe', description: 'Easy-going' },
      { name: 'Autonoe', description: 'Bright' },
      { name: 'Enceladus', description: 'Breathy' },
      { name: 'Iapetus', description: 'Clear' },
      { name: 'Umbriel', description: 'Easy-going' },
      { name: 'Algieba', description: 'Smooth' },
      { name: 'Despina', description: 'Smooth' },
      { name: 'Erinome', description: 'Clear' },
      { name: 'Algenib', description: 'Gravelly' },
      { name: 'Rasalgethi', description: 'Informative' },
      { name: 'Laomedeia', description: 'Upbeat' },
      { name: 'Achernar', description: 'Soft' },
      { name: 'Alnilam', description: 'Firm' },
      { name: 'Schedar', description: 'Even' },
      { name: 'Gacrux', description: 'Mature' },
      { name: 'Pulcherrima', description: 'Forward' },
      { name: 'Achird', description: 'Friendly' },
      { name: 'Zubenelgenubi', description: 'Casual' },
      { name: 'Vindemiatrix', description: 'Gentle' },
      { name: 'Sadachbia', description: 'Lively' },
      { name: 'Sadaltager', description: 'Knowledgeable' },
      { name: 'Sulafat', description: 'Warm' },
    ];
  }

  /**
   * Get accent string from location code
   */
  static getAccentFromLocation(locationCode: string): string | null {
    if (!locationCode) return null;
    return LOCATION_ACCENT_MAPPING[locationCode.toUpperCase()] || null;
  }

  /**
   * Detect location from business profile locations array
   */
  static detectLocationFromProfile(locations: any[]): string | null {
    if (!Array.isArray(locations) || locations.length === 0) {
      return null;
    }

    const firstLocation = locations[0];

    if (typeof firstLocation === 'string') {
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
}

export const geminiTTSService = new GeminiTTSService();
export default geminiTTSService;
