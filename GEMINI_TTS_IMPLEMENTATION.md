# Google Gemini 2.5 TTS Implementation Guide

This document describes the implementation of Google's latest Gemini 2.5 Text-to-Speech models in Flynn AI, which provides superior voice quality compared to existing TTS solutions.

## Overview

Google's Gemini 2.5 TTS models offer:
- **Enhanced expressivity**: Richer tone versatility and stricter adherence to style prompts
- **Precision pacing**: Smarter context-aware speed adjustments
- **Seamless dialogue**: Consistent character voices in multi-speaker scenarios
- **Superior quality**: Better than ElevenLabs and Azure TTS according to Google

Reference: https://blog.google/technology/developers/gemini-2-5-text-to-speech/

## What I've Implemented

### 1. TypeScript Service (`src/services/GeminiTTSService.ts`)
✅ **COMPLETE** - Full TypeScript implementation for React Native/mobile use
- All 30 Gemini voices supported
- Style, pace, and accent control
- PCM to WAV conversion
- Error handling and validation

### 2. Node.js Server Service (`services/geminiTTSService.js`)
✅ **COMPLETE** - Server-side implementation for backend/telephony use
- Identical functionality to TypeScript version
- Optimized for Express/Node.js backend
- Flynn persona voice mappings (flynn_warm, flynn_expert, flynn_hype)
- Preset voice support for easy integration

### 3. Environment Configuration (`.env.example`)
✅ **COMPLETE** - Added Gemini TTS configuration:
```bash
# Text-to-Speech Configuration
TTS_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_TTS_MODEL=gemini-2.5-flash-preview-tts
GEMINI_TTS_DEFAULT_VOICE=Kore
```

### 4. Server Integration (`server.js`)
✅ **COMPLETE** - Fully integrated into Express server:
- Import of Gemini TTS service
- Configuration variables for Gemini
- Updated `resolveTtsProvider()` to prioritize Gemini
- Updated voice preview endpoint with Gemini support
- Preset voice mappings for Flynn personas

## What You Need to Do

### 1. Get a Gemini API Key
1. Visit https://aistudio.google.com/apikey
2. Create or select a Google Cloud project
3. Generate an API key
4. Add to your `.env` file:
   ```bash
   GEMINI_API_KEY=your_actual_api_key_here
   TTS_PROVIDER=gemini
   ```

### 2. Update `telephony/realtimeHandler.js`

✅ **COMPLETE** - The realtime handler has been fully updated with Gemini TTS support:
- Added Gemini TTS import
- Added Gemini configuration variables
- Created `textToSpeechGemini()` function with PCM to µ-law conversion
- Integrated into main `textToSpeech()` provider selection
- Updated `resolveVoiceForProvider()` to handle Gemini voices

### 3. Test the Integration

#### A. Run the Test Script
```bash
# Run the comprehensive test suite
node scripts/test-gemini-tts.js
```

This will:
- Test basic speech generation
- Test style control (enthusiastic, professional, etc.)
- Test different voice personas (flynn_warm, flynn_expert, flynn_hype)
- Test accent control (Australian English, etc.)
- Test PCM output for realtime telephony
- Generate sample WAV files in `test-output/` directory

#### B. Test Voice Preview (Server)
```bash
# Start the server
npm run dev

# Test the voice preview endpoint
curl -X POST http://localhost:3000/voice/preview \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hi, youve reached Flynn — how can we help with your event today?",
    "voiceOption": "flynn_warm"
  }'
```

#### C. Test Live Phone Calls
1. Ensure `TTS_PROVIDER=gemini` in your `.env`
2. Make a test call to your Flynn AI number
3. Check server logs for `[Realtime] ⏱️ TTS request starting (Gemini)`
4. Verify audio quality and latency

#### D. Test TypeScript Service (Mobile - Optional)
```typescript
import { geminiTTSService } from './src/services/GeminiTTSService';

// Initialize
geminiTTSService.initialize({
  apiKey: 'your_gemini_api_key',
  model: 'gemini-2.5-flash-preview-tts',
  defaultVoice: 'Kore',
});

// Generate speech
const result = await geminiTTSService.generateSpeechWav({
  text: 'Welcome to Flynn AI!',
  voiceName: 'Puck',
  style: 'cheerful and enthusiastic',
  pace: 'speak at a moderate, friendly pace',
});

// result.audio is a WAV buffer ready to play
```

### 4. Update Package Dependencies

Ensure `@google/generative-ai` is in your `package.json`:
```bash
npm install @google/generative-ai
```

(This should already be installed based on your package.json)

## Available Voices

Gemini provides 30 high-quality voices. Here are the Flynn persona mappings:

| Flynn Persona | Gemini Voice | Description |
|--------------|--------------|-------------|
| flynn_warm / koala_warm | Sulafat | Warm, friendly |
| flynn_expert / koala_expert | Kore | Firm, professional |
| flynn_hype / koala_hype | Puck | Upbeat, energetic |

### All 30 Voices
- **Bright**: Zephyr, Autonoe
- **Upbeat**: Puck, Laomedeia
- **Firm**: Kore, Orus, Alnilam
- **Informative**: Charon, Rasalgethi
- **Easy-going**: Callirrhoe, Umbriel
- **Clear**: Iapetus, Erinome
- **Smooth**: Algieba, Despina
- **Soft**: Achernar
- **Excitable**: Fenrir
- **Youthful**: Leda
- **Breezy**: Aoede
- **Breathy**: Enceladus
- **Gravelly**: Algenib
- **Even**: Schedar
- **Mature**: Gacrux
- **Forward**: Pulcherrima
- **Friendly**: Achird
- **Casual**: Zubenelgenubi
- **Gentle**: Vindemiatrix
- **Lively**: Sadachbia
- **Knowledgeable**: Sadaltager
- **Warm**: Sulafat

## Advanced Features

### Style Control
```javascript
const result = await generateGeminiSpeech(apiKey, text, {
  voiceName: 'Kore',
  style: 'professional and trustworthy, like a helpful receptionist',
  pace: 'speak at a moderate pace with clear enunciation',
  accent: 'Australian English',
});
```

### Pacing Examples
- `"speak slowly and deliberately"`
- `"fast and energetic"`
- `"moderate pace with pauses for emphasis"`

### Style Examples
- `"cheerful and enthusiastic"`
- `"calm and professional"`
- `"friendly but businesslike"`
- `"warm and welcoming"`

## Supported Languages

Gemini TTS supports 24 languages with automatic detection:
- English (US, India), Spanish, French, German
- Italian, Japanese, Korean, Portuguese (Brazil)
- Russian, Arabic, Hindi, Bengali, Thai
- Turkish, Vietnamese, Romanian, Ukrainian
- Polish, Indonesian, Dutch, Marathi
- Tamil, Telugu

## Migration Path

If you want to fully switch from ElevenLabs/Azure to Gemini:

1. Set `TTS_PROVIDER=gemini` in `.env`
2. Add `GEMINI_API_KEY` to `.env`
3. Restart the server
4. Test voice previews work
5. Update `telephony/realtimeHandler.js` as described above
6. Test live calls with AI receptionist
7. Monitor quality and performance

You can also run Gemini alongside ElevenLabs/Azure for A/B testing by keeping all API keys configured and switching the `TTS_PROVIDER` variable.

## Troubleshooting

### "Gemini API key not configured"
- Ensure `GEMINI_API_KEY` is set in `.env`
- Restart the server after adding the key

### "No audio data returned from Gemini TTS"
- Check API key is valid
- Verify you're using a TTS-capable model (gemini-2.5-flash-preview-tts or gemini-2.5-pro-preview-tts)
- Check network connectivity

### Voice preview returns 500 error
- Check server logs for specific error
- Ensure @google/generative-ai package is installed
- Verify API key has TTS permissions enabled in Google Cloud Console

### Realtime calls still use ElevenLabs
- You need to manually update `telephony/realtimeHandler.js` as described above
- The server.js changes only affect voice previews and greeting generation

## Cost Comparison

According to Google, Gemini 2.5 TTS pricing is competitive with other providers. Check current pricing at:
https://ai.google.dev/pricing

## Next Steps

1. ✅ Get Gemini API key
2. ✅ Add to .env file
3. ✅ Update telephony/realtimeHandler.js
4. ⏳ **Test voice previews** → Run `node scripts/test-gemini-tts.js`
5. ⏳ **Test live calls** → Make a test call to your Flynn number
6. ⏳ Monitor quality vs ElevenLabs/Azure
7. ⏳ Consider switching default provider to Gemini

## Quick Start (Summary)

```bash
# 1. Add to your .env file
echo "GEMINI_API_KEY=your_api_key_here" >> .env
echo "TTS_PROVIDER=gemini" >> .env

# 2. Run the test suite
node scripts/test-gemini-tts.js

# 3. Start the server
npm run dev

# 4. Make a test call or test the voice preview endpoint
# Check logs for "[Realtime] ⏱️ TTS request starting (Gemini)"
```

## References

- [Gemini TTS Announcement](https://blog.google/technology/developers/gemini-2-5-text-to-speech/)
- [Gemini TTS Documentation](https://ai.google.dev/gemini-api/docs/speech-generation)
- [Get API Key](https://aistudio.google.com/apikey)
- [Gemini Pricing](https://ai.google.dev/pricing)
