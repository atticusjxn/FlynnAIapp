# Backend API Requirements for Flynn AI

## Overview
This document outlines the backend API endpoints required to secure Flynn AI's mobile app by removing sensitive credentials from the client-side code. All Twilio and AI operations must be proxied through these secure backend endpoints.

## Security Requirements

### Authentication
- All endpoints **MUST** require authentication via Supabase JWT token
- Include `Authorization: Bearer {supabase_access_token}` in request headers
- Validate token using Supabase Admin SDK or JWT verification
- Extract `user_id` from token for database operations
- Return `401 Unauthorized` for missing/invalid tokens

### Rate Limiting
- Implement rate limiting per user/org to prevent abuse
- Suggested limits:
  - Number provisioning: 5 requests per day
  - Number search: 20 requests per hour
  - Job extraction: 100 requests per hour
  - SMS sending: 50 requests per hour

### Error Handling
- Return consistent JSON error format:
```json
{
  "error": true,
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

---

## API Endpoints

### 1. Search Available Phone Numbers

**Endpoint:** `POST /api/twilio/search-numbers`

**Purpose:** Search for available Twilio phone numbers in a specific country

**Authentication:** Required (Supabase JWT)

**Request Body:**
```json
{
  "countryCode": "US",     // ISO country code (US, AU, GB, etc.)
  "limit": 5,              // Number of results to return (1-20)
  "voiceEnabled": true     // Must support voice calls
}
```

**Response (Success - 200):**
```json
{
  "availableNumbers": [
    {
      "phone_number": "+15551234567",
      "friendly_name": "US Local Number",
      "capabilities": {
        "voice": true,
        "sms": true,
        "fax": false
      },
      "locality": "San Francisco",
      "region": "CA"
    }
  ]
}
```

**Backend Implementation:**
```typescript
// Pseudocode
1. Verify JWT token → extract user_id
2. Check rate limit for user
3. Call Twilio API:
   GET /2010-04-01/Accounts/{ACCOUNT_SID}/AvailablePhoneNumbers/{countryCode}/Local.json
   Params: Limit={limit}&VoiceEnabled=true
4. Return transformed results
```

**Environment Variables Needed:**
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

---

### 2. Purchase Phone Number

**Endpoint:** `POST /api/twilio/purchase-number`

**Purpose:** Purchase a Twilio phone number and configure webhooks

**Authentication:** Required (Supabase JWT)

**Request Body:**
```json
{
  "phoneNumber": "+15551234567",
  "userId": "user-uuid"
}
```

**Response (Success - 200):**
```json
{
  "phoneNumber": "+15551234567",
  "phoneNumberSid": "PN1234567890abcdef",
  "cost": 1.15,
  "monthlyCost": 1.15
}
```

**Backend Implementation:**
```typescript
// Pseudocode
1. Verify JWT token → extract authenticated user_id
2. Validate user_id in request matches authenticated user
3. Check user's org has paid plan (query Supabase organizations table)
4. Check rate limit (max 5 purchases per day)
5. Call Twilio API:
   POST /2010-04-01/Accounts/{ACCOUNT_SID}/IncomingPhoneNumbers.json
   Body:
     PhoneNumber={phoneNumber}
     VoiceUrl={SERVER_PUBLIC_URL}/webhook/voice/{userId}
     VoiceMethod=POST
     StatusCallback={SERVER_PUBLIC_URL}/webhook/status/{userId}
     StatusCallbackMethod=POST
6. Return purchase result with SID and cost
```

**Environment Variables Needed:**
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `SERVER_PUBLIC_URL` (for webhook configuration)

---

### 3. Release Phone Number

**Endpoint:** `DELETE /api/twilio/release-number`

**Purpose:** Release/delete a Twilio phone number

**Authentication:** Required (Supabase JWT)

**Request Body:**
```json
{
  "phoneNumberSid": "PN1234567890abcdef"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Phone number released successfully"
}
```

**Backend Implementation:**
```typescript
// Pseudocode
1. Verify JWT token → extract user_id
2. Verify user owns this phone number (query phone_numbers table)
3. Call Twilio API:
   DELETE /2010-04-01/Accounts/{ACCOUNT_SID}/IncomingPhoneNumbers/{phoneNumberSid}.json
4. Update phone_numbers table: status='released'
5. Return success
```

**Environment Variables Needed:**
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

---

### 4. Send SMS

**Endpoint:** `POST /api/twilio/send-sms`

**Purpose:** Send SMS messages to clients (for job confirmations, booking links, etc.)

**Authentication:** Required (Supabase JWT)

**Request Body:**
```json
{
  "to": "+15551234567",
  "message": "Hi John! Your appointment is confirmed for tomorrow at 10am.",
  "fromNumberId": "phone-number-uuid"  // Optional - use user's primary if not provided
}
```

**Response (Success - 200):**
```json
{
  "messageSid": "SM1234567890abcdef",
  "status": "queued",
  "to": "+15551234567",
  "from": "+61363588413"
}
```

**Backend Implementation:**
```typescript
// Pseudocode
1. Verify JWT token → extract user_id
2. Get user's org_id from users table
3. Get from number:
   - If fromNumberId provided, verify user owns it
   - Otherwise, use primary phone_number for org
4. Check rate limit (50 SMS per hour per org)
5. Call Twilio API:
   POST /2010-04-01/Accounts/{ACCOUNT_SID}/Messages.json
   Body:
     To={to}
     From={fromNumber}
     Body={message}
6. Log SMS in call_events or messages table
7. Return message SID and status
```

**Environment Variables Needed:**
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

---

### 5. Extract Job from Transcript (AI)

**Endpoint:** `POST /api/ai/extract-job`

**Purpose:** Use LLM to extract structured job information from call transcriptions

**Authentication:** Required (Supabase JWT)

**Request Body:**
```json
{
  "transcription": "Hi, this is John Smith calling about a plumbing job...",
  "businessType": "Home & Property",
  "prompt": "Extract job details from this transcription...",
  "model": "grok-4-fast"
}
```

**Response (Success - 200):**
```json
{
  "extraction": {
    "confidence": 0.85,
    "clientName": "John Smith",
    "clientPhone": "+15551234567",
    "serviceType": "Plumbing repair",
    "description": "Kitchen sink leaking under cabinet",
    "scheduledDate": "2025-01-25",
    "scheduledTime": "10:00 AM",
    "location": "123 Main St, San Francisco, CA",
    "urgency": "medium",
    "estimatedPrice": null,
    "followUpRequired": false,
    "extractedAt": "2025-01-22T10:30:00Z",
    "processingTime": 1500
  }
}
```

**Backend Implementation:**
```typescript
// Pseudocode
1. Verify JWT token → extract user_id
2. Check rate limit (100 requests per hour per org)
3. Select LLM provider based on model:
   - If model starts with "grok": use X.AI API
   - If model starts with "gpt": use OpenAI API
   - If model starts with "gemini": use Google Gemini API
4. Call LLM API:
   POST {LLM_BASE_URL}/chat/completions
   Headers: Authorization: Bearer {API_KEY}
   Body:
     model={model}
     messages=[{role: "system", content: "..."}, {role: "user", content: prompt}]
     temperature=0.1
     max_tokens=1000
5. Parse JSON response from LLM
6. Add metadata (extractedAt, processingTime)
7. Return structured extraction
```

**Environment Variables Needed:**
- `GROK_API_KEY` or `XAI_API_KEY`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `LLM_PROVIDER` (default provider)

---

### 6. Lookup Carrier (Optional)

**Endpoint:** `POST /api/twilio/lookup-carrier`

**Purpose:** Lookup carrier information for a phone number to assist with call forwarding setup

**Authentication:** Required (Supabase JWT)

**Request Body:**
```json
{
  "phoneNumber": "+15551234567"
}
```

**Response (Success - 200):**
```json
{
  "phoneNumber": "+15551234567",
  "countryCode": "US",
  "carrier": {
    "name": "Verizon Wireless",
    "type": "mobile",
    "error_code": null
  },
  "nationalFormat": "(555) 123-4567"
}
```

**Backend Implementation:**
```typescript
// Pseudocode
1. Verify JWT token → extract user_id
2. Check rate limit (20 requests per hour)
3. Call Twilio Lookup API:
   GET /2010-04-01/PhoneNumbers/{phoneNumber}.json?Type=carrier
4. Return carrier information
```

**Environment Variables Needed:**
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

---

## Deployment Checklist

### Environment Variables to Set
```bash
# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
SERVER_PUBLIC_URL=https://flynnai-telephony.fly.dev

# Supabase (for JWT verification)
SUPABASE_URL=https://zvfeafmmtfplzpnocyjw.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=...

# AI/LLM
GROK_API_KEY=xai-...
XAI_API_KEY=xai-...  # Alternative name
OPENAI_API_KEY=sk-proj-...
GEMINI_API_KEY=AIzaSy...
LLM_PROVIDER=grok    # Default provider

# Rate Limiting (Optional - use Redis)
REDIS_URL=redis://...

# Monitoring (Optional)
SENTRY_DSN=https://...
```

### Security Checklist
- [ ] All endpoints require valid Supabase JWT
- [ ] Rate limiting implemented per user/org
- [ ] CORS configured to only allow Flynn AI mobile app origins
- [ ] Twilio credentials never exposed in responses
- [ ] All errors logged (Sentry/CloudWatch)
- [ ] HTTPS only (enforce TLS 1.2+)
- [ ] Input validation on all parameters
- [ ] SQL injection protection (use parameterized queries)
- [ ] Request/response logging (without exposing PII)

### Testing Checklist
- [ ] Test with valid Supabase JWT token
- [ ] Test with expired/invalid token (should return 401)
- [ ] Test rate limiting (should return 429 when exceeded)
- [ ] Test number search for multiple countries (US, AU, GB)
- [ ] Test number purchase flow end-to-end
- [ ] Test SMS sending to real phone number
- [ ] Test job extraction with sample transcripts
- [ ] Test error handling for Twilio API failures
- [ ] Load test with concurrent requests

---

## Client-Side Changes Summary

### Removed from Client
- `EXPO_PUBLIC_TWILIO_ACCOUNT_SID` ❌
- `EXPO_PUBLIC_TWILIO_AUTH_TOKEN` ❌
- `EXPO_PUBLIC_GROK_API_KEY` ❌
- Direct Twilio SDK calls ❌
- Direct LLM API calls ❌

### Kept on Client
- `EXPO_PUBLIC_API_BASE_URL` ✅ (backend URL only)
- `EXPO_PUBLIC_LLM_PROVIDER` ✅ (non-sensitive config)
- `EXPO_PUBLIC_LLM_CHAT_MODEL` ✅ (model name only)

### Updated Files
- `/Users/atticus/FlynnAI/.env` - Removed exposed secrets
- `/Users/atticus/FlynnAI/src/services/TwilioService.ts` - All methods now use backend proxy

---

## Example Backend Implementation (Node.js/Express)

```typescript
import express from 'express';
import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

const app = express();
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Middleware: Verify Supabase JWT
const verifyAuth = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: true, message: 'Unauthorized' });
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: true, message: 'Invalid token' });
  }

  req.user = user;
  next();
};

// POST /api/twilio/search-numbers
app.post('/api/twilio/search-numbers', verifyAuth, async (req, res) => {
  try {
    const { countryCode, limit, voiceEnabled } = req.body;

    const availableNumbers = await twilioClient
      .availablePhoneNumbers(countryCode)
      .local
      .list({ limit, voiceEnabled });

    res.json({
      availableNumbers: availableNumbers.map(num => ({
        phone_number: num.phoneNumber,
        friendly_name: num.friendlyName,
        capabilities: num.capabilities,
        locality: num.locality,
        region: num.region,
      }))
    });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
});

// POST /api/twilio/purchase-number
app.post('/api/twilio/purchase-number', verifyAuth, async (req, res) => {
  try {
    const { phoneNumber, userId } = req.body;

    // Verify user owns this userId
    if (req.user.id !== userId) {
      return res.status(403).json({ error: true, message: 'Forbidden' });
    }

    const purchasedNumber = await twilioClient.incomingPhoneNumbers.create({
      phoneNumber,
      voiceUrl: `${process.env.SERVER_PUBLIC_URL}/webhook/voice/${userId}`,
      voiceMethod: 'POST',
      statusCallback: `${process.env.SERVER_PUBLIC_URL}/webhook/status/${userId}`,
      statusCallbackMethod: 'POST',
    });

    res.json({
      phoneNumber: purchasedNumber.phoneNumber,
      phoneNumberSid: purchasedNumber.sid,
      cost: 1.15,
    });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
});

app.listen(3000, () => console.log('Backend API running on port 3000'));
```

---

## Support & Questions

For questions or issues with backend implementation:
- Review this document thoroughly
- Check Twilio API documentation: https://www.twilio.com/docs/usage/api
- Check Supabase Auth docs: https://supabase.com/docs/guides/auth
- Test endpoints with Postman/Thunder Client before mobile integration

---

**Document Version:** 1.0
**Last Updated:** January 22, 2025
**Maintained By:** Flynn AI Development Team
