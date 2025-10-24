# Twilio AI Receptionist Debug Guide

## Current Issue: Greeting Not Playing

### What's Happening:
✅ Server receives call correctly
✅ Greeting audio URL generated successfully
✅ TwiML sent to Twilio with `<Play>` command
❌ **Caller doesn't hear the greeting**
❌ Call goes straight to "beep" (voicemail)

### Root Cause Analysis:

The logs show Twilio is calling your webhook **multiple times** for the same call:
```
[ConversationHandler] Inbound call received (twice)
[ConversationHandler] Greeting sent (twice with different conversation IDs)
```

This suggests **webhook configuration issues** in your Twilio console.

## Fix Steps:

### 1. Check Twilio Phone Number Configuration

Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming

Find your number: `+61363588413`

**Voice Configuration should be:**
```
A CALL COMES IN: Webhook
URL: https://gushier-chase-terrestrially.ngrok-free.dev/telephony/inbound-voice
HTTP: POST
```

**CRITICAL: Remove any other webhooks like:**
- ❌ Primary Handler
- ❌ Recording callback
- ❌ Status callback on the NUMBER configuration

Those should ONLY be in the TwiML, not the phone number settings.

### 2. Verify ngrok is Running

```bash
# Check if ngrok is active
curl https://gushier-chase-terrestrially.ngrok-free.dev/health

# Should return: OK or similar
```

If ngrok isn't running:
```bash
ngrok http 3000
# Update SERVER_PUBLIC_URL in .env with new URL
```

### 3. Test TwiML Response

The server is generating this TwiML:
```xml
<Response>
  <Record recordingStatusCallback="..."/>
  <Gather input="speech" action="/telephony/conversation-continue">
    <Play>https://zvfeafmmtfplzpnocyjw.supabase.co/storage/.../audio.mp3</Play>
    <Pause length="2"/>
  </Gather>
  <Redirect>https://gushier-chase-terrestrially.ngrok-free.dev/telephony/inbound-voice</Redirect>
</Response>
```

**Test the audio URL directly:**
Open this in your browser to verify it plays:
```
https://zvfeafmmtfplzpnocyjw.supabase.co/storage/v1/object/sign/voicemails/receptionist-audio/...
```

If the audio doesn't play in browser, the ElevenLabs cache is corrupted.

### 4. Check Twilio Debugger

Go to: https://console.twilio.com/us1/monitor/logs/debugger

Look for your recent call and check for:
- ❌ **11200 errors** - HTTP retrieval failure (can't fetch audio)
- ❌ **11205 errors** - Invalid TwiML
- ❌ **13224 errors** - Webhook timeout

### 5. Enable Twilio Detailed Logging

In your Twilio console:
1. Go to Monitor → Logs → Voice
2. Enable "Voice Trace"
3. Make a test call
4. Review the trace for exact failure point

## Common Issues:

### Issue 1: Greeting Audio Not Accessible
**Symptom:** Twilio can't fetch the Supabase audio URL
**Fix:** Check Supabase storage bucket permissions - should be public read

### Issue 2: Webhook Loop
**Symptom:** Duplicate "Inbound call received" logs
**Fix:** Check Twilio number configuration - only ONE webhook should be configured

### Issue 3: ngrok Rate Limiting
**Symptom:** Intermittent connection failures
**Fix:** Upgrade to ngrok paid plan or use Twilio Runtime

### Issue 4: TwiML Timeout
**Symptom:** Call drops after greeting plays
**Fix:** Increase `maxSpeechTime` or check `speechTimeout` settings

## Recommended Next Steps:

1. **Immediate Fix:** Test with simpler TwiML
   Replace the greeting temporarily with Polly TTS:
   ```xml
   <Say voice="Polly.Amy">Hi, thanks for calling. How can I help?</Say>
   ```

2. **Check Supabase Storage:**
   ```bash
   # Test if audio URL is publicly accessible
   curl -I "https://zvfeafmmtfplzpnocyjw.supabase.co/storage/..."
   # Should return: 200 OK
   ```

3. **Simplify for Testing:**
   Comment out the `<Record>` tag temporarily to isolate the issue

4. **Check Twilio Account Status:**
   - Verify account is not in trial mode (trial has limitations)
   - Check for any billing issues
   - Verify phone number is active

## Expected Behavior:

When working correctly, you should see:
```
1. Call comes in
2. Greeting plays (ElevenLabs voice)
3. 2-second pause
4. Caller speaks
5. /conversation-continue webhook called with SpeechResult
6. AI responds within 3-4s
7. Conversation continues
```

## Test Command:

Make a test call and check Twilio debugger immediately:
```
https://console.twilio.com/us1/monitor/logs/debugger
```

Look for the call SID from your logs and click "Voice Trace" to see exact execution flow.
