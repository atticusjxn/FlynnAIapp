# Testing AI Receptionist - Quick Start Guide

## Prerequisites Checklist
✅ ngrok running: `https://gushier-chase-terrestrially.ngrok-free.dev`
✅ .env configured with ngrok URL
✅ Database migration applied (conversation_states table)
✅ Server running: `node server.js` (port 3000)

## Step 1: Configure Twilio Number

Go to your Twilio console and update your phone number's Voice webhook:

**Twilio Phone Number:** `+61264123519`

**Voice Configuration:**
- When a call comes in: `Webhook`
- URL: `https://gushier-chase-terrestrially.ngrok-free.dev/telephony/inbound-voice`
- HTTP Method: `POST`

## Step 2: Configure Your Receptionist Settings

1. Open Flynn AI app on your phone
2. Go to **AI Receptionist** tab
3. Set your greeting (e.g., "Hi, you've reached [Your Business]. Let me help you book an appointment.")
4. Configure your follow-up questions:
   - "What's your name?"
   - "What's your phone number?"
   - "What type of service do you need?"
5. Save your settings

## Step 3: Test the Call Flow

1. **Call your Flynn number:** `+61264123519`

2. **Expected Flow:**
   ```
   Flynn: "Hi, you've reached [Your Business]..." (your custom greeting)
   Flynn: "What's your name?"
   You: "John Smith"

   Flynn: "What's your phone number?"
   You: "0412345678"

   Flynn: "What type of service do you need?"
   You: "Plumbing repair for a leaky tap"

   Flynn: "Thank you for your details. We'll be in touch shortly to confirm your booking. Goodbye!"
   *Call ends*
   ```

3. **Check the results:**
   - Open your server logs to see conversation progress
   - Check Supabase `conversation_states` table for the stored conversation
   - Job card should be created automatically (coming in Phase 2)

## Step 4: Debugging

If something doesn't work:

### Check ngrok is running:
```bash
curl https://gushier-chase-terrestrially.ngrok-free.dev/telephony/inbound-voice
# Should return TwiML or error (not 404)
```

### Check server logs:
```bash
# Look for:
[ConversationHandler] Inbound call received
[ConversationHandler] Response recorded
[ConversationHandler] Conversation completed
```

### Check Twilio Console:
- Go to Monitor → Logs → Calls
- Find your recent call
- Check the webhook requests and responses

### Common Issues:

**Issue:** Call goes straight to voicemail
- **Fix:** Make sure Twilio webhook URL is correct and ngrok is running

**Issue:** Greeting doesn't play custom text
- **Fix:** Check that you saved your receptionist settings in the app

**Issue:** Questions don't ask
- **Fix:** Check conversation_states table - might be database permission issue

**Issue:** Server crashes
- **Fix:** Check that all environment variables are set (especially ELEVENLABS_API_KEY)

## What's Working Now

✅ Custom greetings based on your settings
✅ Interactive Q&A conversation flow
✅ Response storage in database
✅ Graceful fallback to voicemail if errors occur

## Coming in Phase 2

🔜 Calendar integration to check availability
🔜 Automatic booking confirmation
🔜 ElevenLabs voice synthesis (currently using Polly)
🔜 Job card auto-creation from conversation
🔜 SMS confirmation to caller

## Monitoring Your Calls

**Check conversation states:**
```sql
SELECT * FROM conversation_states ORDER BY created_at DESC LIMIT 10;
```

**See responses:**
```sql
SELECT
  call_sid,
  status,
  current_step,
  total_steps,
  responses
FROM conversation_states
WHERE status = 'completed'
ORDER BY created_at DESC;
```

## Next Steps

Once this is working:
1. We'll add calendar integration
2. Implement automatic booking
3. Upgrade to ElevenLabs voices
4. Add conversation → job card creation
