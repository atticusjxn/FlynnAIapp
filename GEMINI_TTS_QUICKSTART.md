# Gemini TTS Quick Start

## ⚡ 3-Minute Setup

### 1. Configure Environment
```bash
# Add to .env
GEMINI_API_KEY=your_api_key_here
TTS_PROVIDER=gemini
```

### 2. Test It
```bash
node scripts/test-gemini-tts.js
```

### 3. Run It
```bash
npm run dev
```

## 🎤 Voice Reference

| Use Case | Voice | Style Prompt |
|----------|-------|--------------|
| 🤝 Friendly greeting | `Sulafat` | "warm and welcoming" |
| 💼 Professional | `Kore` | "professional and efficient" |
| 🎉 Enthusiastic | `Puck` | "upbeat and energetic" |
| 🧘 Calm support | `Aoede` | "calm and helpful" |

## 📁 Files Created

```
src/services/GeminiTTSService.ts          # TypeScript service
services/geminiTTSService.js               # Node.js service
scripts/test-gemini-tts.js                 # Test suite
GEMINI_TTS_IMPLEMENTATION.md               # Full docs
GEMINI_TTS_COMPLETE.md                     # Summary
```

## 🔍 Verify It's Working

### Check server logs:
```
[TTS] Provider configuration detected. { provider: 'gemini', hasGemini: true ... }
```

### During a call:
```
[Realtime] ⏱️ TTS request starting (Gemini)
[Realtime] ⏱️ Gemini TTS audio generated successfully.
```

## 🆘 Quick Fixes

**Not working?**
```bash
# Restart with fresh env
source .env
npm run dev
```

**Want to switch back?**
```bash
# In .env, change:
TTS_PROVIDER=elevenlabs  # or azure
```

## 📚 More Info

- Full docs: `GEMINI_TTS_IMPLEMENTATION.md`
- Complete summary: `GEMINI_TTS_COMPLETE.md`
- Google docs: https://ai.google.dev/gemini-api/docs/speech-generation
