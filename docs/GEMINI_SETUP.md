# Gemini 2.5 Flash Setup Guide

## Overview

This guide explains how to switch Flynn AI's conversational AI from Grok to Google's Gemini 2.5 Flash for faster, lower-latency voice interactions.

## Why Gemini 2.5 Flash?

**Gemini 2.5 Flash** is Google's fastest multimodal model optimized for low-latency real-time applications:

- **Speed**: ~300-500ms response time (vs 1-2s+ for Grok/GPT-4)
- **Cost**: $0.30/1M input tokens, $0.60/1M output tokens (standard)
- **Quality**: Strong reasoning with extended thinking capabilities
- **Real-time optimized**: Built specifically for conversational AI

### Pricing Breakdown

- **Input tokens**: $0.30 per million tokens
- **Output tokens (standard)**: $0.60 per million tokens
- **Output tokens (with thinking)**: $3.50 per million tokens
- **Audio input**: $1.00 per million tokens

For voice receptionist use cases, expect **standard output pricing** since thinking mode is typically disabled for speed.

## Setup Instructions

### 1. Get Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click "Get API Key" or "Create API Key"
4. Copy your API key

### 2. Configure Environment Variables

Add these to your `.env` file:

```bash
# Gemini Configuration
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_CHAT_MODEL=gemini-2.5-flash  # Optional, this is the default

# Keep OpenAI as fallback for transcription (Gemini doesn't support audio transcription yet)
OPENAI_API_KEY=your_openai_key_here
```

**Important**: You still need `OPENAI_API_KEY` for voicemail transcription, as Gemini doesn't support Whisper-style audio transcription. OpenAI or Deepgram will handle transcription, while Gemini handles the conversational AI.

### 3. Alternative: Use GOOGLE_API_KEY

If you prefer, you can use `GOOGLE_API_KEY` instead of `GEMINI_API_KEY`:

```bash
LLM_PROVIDER=gemini
GOOGLE_API_KEY=your_google_api_key_here
```

### 4. Restart Your Server

```bash
# Stop current server (Ctrl+C if running)
# Then restart
npm run dev
```

## Verification

When your server starts, you should see:

```
[LLM] Initialised AI provider. { provider: 'gemini' }
[LLM] Using OpenAI fallback for transcription workloads.
```

## Model Options

Gemini offers several models for different use cases:

### Recommended for Voice:
- `gemini-2.5-flash` - **Best choice** for real-time voice (fastest)
- `gemini-2.5-flash-lite` - Even faster but slightly lower quality

### Not Recommended:
- `gemini-2.5-pro` - Too slow for voice (higher quality but 2-4s latency)
- `gemini-1.5-flash` - Older model, use 2.5 instead

## Performance Tuning

In `.env`, you can adjust these optional settings:

```bash
# Lower temperature for more consistent responses (0.0-1.0)
GEMINI_TEMPERATURE=0.4

# Reduce max tokens for faster responses
GEMINI_MAX_TOKENS=180
```

These settings are already optimized in the code for voice use cases.

## Troubleshooting

### Error: "Gemini client requested but GEMINI_API_KEY is not configured"
- Ensure `GEMINI_API_KEY` or `GOOGLE_API_KEY` is set in `.env`
- Restart the server after adding the key

### Error: "Non-OpenAI provider active without transcription fallback"
- Add `OPENAI_API_KEY` to `.env` for transcription support
- Or configure Deepgram with `DEEPGRAM_API_KEY`

### Slow responses
- Check you're using `gemini-2.5-flash` not `gemini-2.5-pro`
- Verify your API key quota hasn't been exceeded
- Check network latency to Google's API servers

### API Rate Limits
Gemini has generous rate limits on the free tier:
- 15 requests per minute
- 1,500 requests per day
- 1 million tokens per minute

For production, consider Google Cloud's Vertex AI for higher limits.

## Comparison: Grok vs Gemini 2.5 Flash

| Feature | Grok 4 Fast | Gemini 2.5 Flash |
|---------|-------------|------------------|
| **Latency** | 1-2 seconds | 300-500ms |
| **Cost** | Variable | $0.30/$0.60 per 1M tokens |
| **Reliability** | Beta/experimental | Production-ready |
| **Multimodal** | Text only | Native audio/video/text |
| **Voice optimization** | No | Yes |
| **Rate limits** | Limited | Generous free tier |

## Next Steps

After switching to Gemini:

1. **Test voice calls** - Make a few test calls to verify latency improvements
2. **Monitor costs** - Track token usage in Google AI Studio
3. **Optimize prompts** - Gemini may respond differently than Grok; adjust system prompts if needed
4. **Consider Vertex AI** - For production scale, migrate to Google Cloud Vertex AI

## Resources

- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [Gemini Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Google AI Studio](https://aistudio.google.com/)
- [Vertex AI (Production)](https://cloud.google.com/vertex-ai)

## Support

For issues specific to Flynn AI's Gemini integration, check:
- `/Users/atticus/FlynnAI/llmClient.js` - Client implementation
- `/Users/atticus/FlynnAI/telephony/realtimeHandler.js` - Voice handling

---

Last updated: December 2024
