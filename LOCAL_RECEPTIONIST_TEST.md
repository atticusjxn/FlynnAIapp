# Local In-App Receptionist Testing

## Overview

The local receptionist testing feature allows users to **try out their AI receptionist directly in the app** using their device's microphone and speaker, **without making actual phone calls or requiring a paid account**.

This feature enables users to:
- Test their receptionist greeting and questions
- Experience the conversation flow before going live
- Validate AI responses and job extraction
- Try the service before paying for phone forwarding

## How It Works

### User Experience Flow

1. **Open Receptionist Tab** → Tap "START TEST CALL"
2. **Grant Microphone Permission** → Allow mic access (one-time)
3. **Hear Greeting** → Flynn speaks your configured greeting via device speaker
4. **Have Conversation** → Speak naturally, tap mic button to send each response
5. **Flynn Responds** → AI processes speech and responds via TTS
6. **View Extracted Job** → At end, see what Flynn captured (name, service, date, etc.)

### Technical Architecture

```
┌─────────────────────────────────────────────────────┐
│                  LocalTestModal                     │
│  (React Native UI - src/components/receptionist/)   │
└─────────────────┬───────────────────────────────────┘
                  │
      ┌───────────┴────────────┐
      │                        │
┌─────▼─────┐         ┌────────▼─────────┐
│ Expo Audio │         │   Expo Speech    │
│ Recording  │         │   (Device TTS)   │
└─────┬──────┘         └──────────────────┘
      │
      │ Audio file (.m4a)
      │
┌─────▼──────────────────────────────────────┐
│      Backend API (/ai/transcribe)          │
│      Whisper transcription                 │
└─────┬──────────────────────────────────────┘
      │ Transcript text
      │
┌─────▼──────────────────────────────────────┐
│      Backend API (/ai/chat)                │
│      GPT-4 conversation                    │
└─────┬──────────────────────────────────────┘
      │ AI response
      │
┌─────▼──────────────────────────────────────┐
│      Backend API (/ai/extract-job)         │
│      Extract job details                   │
└────────────────────────────────────────────┘
```

## Components

### Frontend

#### `LocalTestModal.tsx`
- **Location**: `src/components/receptionist/LocalTestModal.tsx`
- **Purpose**: Full-screen modal for in-app receptionist testing
- **Features**:
  - Audio recording using Expo Audio
  - Text-to-speech playback using Expo Speech
  - Real-time conversation transcript display
  - Job details extraction and review screen
  - Microphone permission handling
  - Visual feedback (mic animation, status indicators)

#### `ReceptionistScreen.tsx`
- **Updated**: Now uses `LocalTestModal` instead of `TestCallModal`
- **Button**: "START TEST CALL" → Opens local test modal

### Backend API Endpoints

#### `POST /ai/transcribe`
- **Purpose**: Transcribe audio recording using OpenAI Whisper
- **Auth**: Required (JWT)
- **Input**:
  - `file`: Audio file (multipart/form-data, .m4a format)
- **Output**:
  ```json
  {
    "text": "transcribed speech text"
  }
  ```

#### `POST /ai/chat`
- **Purpose**: Generate AI receptionist responses
- **Auth**: Required (JWT)
- **Input**:
  ```json
  {
    "messages": [
      { "role": "system", "content": "..." },
      { "role": "user", "content": "..." }
    ],
    "model": "gpt-4o-mini",
    "temperature": 0.7,
    "max_tokens": 150
  }
  ```
- **Output**: OpenAI chat completion response

#### `POST /ai/extract-job`
- **Purpose**: Extract job booking details from conversation transcript
- **Auth**: Required (JWT)
- **Input**:
  ```json
  {
    "transcript": "Full conversation text"
  }
  ```
- **Output**:
  ```json
  {
    "job": {
      "clientName": "John Doe",
      "clientPhone": "+1234567890",
      "serviceType": "Plumbing Repair",
      "scheduledDate": "2025-01-15",
      "scheduledTime": "14:00",
      "location": "123 Main St",
      "notes": "Leaking kitchen sink",
      "urgency": "medium",
      "confidence": 0.85
    }
  }
  ```

## Key Features

### 1. **No Phone Calls Required**
- Everything happens locally on device
- Uses device mic and speaker
- No Twilio/telephony costs for testing

### 2. **No Payment Required**
- Users can test before paying for service
- No account restrictions
- Free tier friendly

### 3. **Real Speech Recognition**
- Uses OpenAI Whisper for accurate transcription
- Handles natural speech patterns
- Works with various accents

### 4. **Natural TTS**
- Uses device's native text-to-speech engine
- iOS: Samantha voice
- Android: System default voice
- Adjustable rate and pitch

### 5. **Job Extraction**
- Automatically extracts booking details from conversation
- Shows confidence scores
- Displays formatted job summary

### 6. **Conversation Transcript**
- Real-time display of conversation
- Distinguishes user vs Flynn messages
- Scrollable history

## Configuration

Users can customize:
- **Greeting**: What Flynn says when test call starts
- **Questions**: What Flynn asks to gather booking info
- **Voice**: Affects greeting delivery (actual TTS uses device voice)
- **Mode**: AI-only, hybrid choice, or voicemail-only

## Limitations & Future Enhancements

### Current Limitations
1. **Manual Send**: Users must tap mic button to send each response (not voice-activated)
2. **Device TTS Only**: Uses basic device TTS, not premium voices
3. **No Barge-In**: Can't interrupt Flynn while speaking
4. **Simple Extraction**: Basic job detail extraction (can be enhanced)

### Potential Enhancements
1. **Voice Activation Detection** (VAD) for automatic send
2. **Premium TTS Integration** (ElevenLabs, Azure, Gemini)
3. **Barge-in Support** (interrupt AI mid-sentence)
4. **Advanced Extraction** (multiple jobs, complex requests)
5. **Test Call History** (save test sessions for review)
6. **Performance Metrics** (call duration, response time, confidence scores)

## Dependencies

### NPM Packages
- `expo-av` - Audio recording
- `expo-speech` - Text-to-speech
- `multer` - File upload handling (server-side)

### APIs Required
- OpenAI API key (for Whisper transcription and GPT chat)
- Authenticated user session (JWT)

## Cost Considerations

### OpenAI API Costs (per test call)
- **Whisper Transcription**: ~$0.006 per minute of audio
- **GPT-4o-mini**: ~$0.0002 per 1000 tokens
- **Estimated per test**: $0.02 - $0.05 (2-5 minute conversation)

### Free for Users
- No charges to users for testing
- Costs absorbed by platform during trial/testing phase
- Could implement rate limiting (e.g., 5 tests per day) to control costs

## Security

- **JWT Authentication**: All API endpoints require valid user session
- **Audio Files**: Stored in memory only, never persisted to disk
- **Rate Limiting**: Could add to prevent abuse
- **Permission Gates**: Requires explicit microphone permission from user

## Testing

To test the feature:

1. Open Flynn AI app
2. Navigate to **Receptionist** tab
3. Configure greeting and questions
4. Tap **"START TEST CALL"**
5. Grant microphone permission if prompted
6. Speak naturally after hearing greeting
7. Tap large mic button to send each response
8. Review extracted job details at end

## Troubleshooting

### Common Issues

**"Microphone permission required"**
- Solution: Go to iOS Settings → Flynn AI → Enable Microphone

**"Failed to transcribe audio"**
- Solution: Check OpenAI API key is configured
- Check network connection

**"AI not responding"**
- Solution: Verify OpenAI API key has credits
- Check server logs for errors

**"No sound playing"**
- Solution: Check device volume
- Ensure "Playsounds in silent mode" is enabled in audio settings

## File Reference

### New Files
- `src/components/receptionist/LocalTestModal.tsx` - Main test modal UI
- `src/services/LocalReceptionistTestService.ts` - Service layer (not fully used)
- `LOCAL_RECEPTIONIST_TEST.md` - This documentation

### Modified Files
- `server.js` - Added `/ai/transcribe`, `/ai/chat`, `/ai/extract-job` endpoints
- `src/screens/ReceptionistScreen.tsx` - Uses LocalTestModal
- `package.json` - Added `multer` and `expo-speech` dependencies

## Summary

The local in-app receptionist testing feature provides a **zero-friction way for users to try Flynn before paying**, using their device's native capabilities combined with powerful AI APIs. This removes the barrier of needing to set up call forwarding or provision phone numbers just to see how the receptionist works.

**Key Benefits:**
✅ No phone calls required
✅ No payment required
✅ Real AI conversation experience
✅ Job extraction validation
✅ Easy to use (tap and talk)
✅ Works on iOS and Android

This feature should significantly improve conversion rates by letting users experience the product before committing to paid plans.
