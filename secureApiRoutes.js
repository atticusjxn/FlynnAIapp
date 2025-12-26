/**
 * Secure API Routes for Flynn AI Mobile App
 * These endpoints proxy Twilio and AI operations to keep credentials secure
 * Added: January 22, 2025
 */

module.exports = function attachSecureApiRoutes(app, {
  twilioAccountSid,
  twilioAuthToken,
  twilioSmsFromNumber,
  authenticateJwt,
  getLLMClient,
  twilio,
}) {
  console.log('[SecureAPI] Attaching secure API routes for mobile app');

  // POST /api/twilio/search-numbers - Search for available Twilio phone numbers
  app.post('/api/twilio/search-numbers', authenticateJwt, async (req, res) => {
    try {
      const { countryCode = 'US', limit = 5, voiceEnabled = true } = req.body;

      if (!twilioAccountSid || !twilioAuthToken) {
        return res.status(500).json({
          error: true,
          message: 'Twilio credentials not configured on server'
        });
      }

      console.log(`[SecureAPI] Searching for numbers in ${countryCode}, limit: ${limit}`);

      const twilioClient = twilio(twilioAccountSid, twilioAuthToken);

      const availableNumbers = await twilioClient
        .availablePhoneNumbers(countryCode)
        .local
        .list({ limit, voiceEnabled });

      const formattedNumbers = availableNumbers.map(num => ({
        phone_number: num.phoneNumber,
        friendly_name: num.friendlyName,
        capabilities: num.capabilities,
        locality: num.locality,
        region: num.region,
        postal_code: num.postalCode,
        iso_country: num.isoCountry,
      }));

      console.log(`[SecureAPI] Found ${formattedNumbers.length} available numbers`);
      res.status(200).json({ availableNumbers: formattedNumbers });

    } catch (error) {
      console.error('[SecureAPI] Error searching numbers:', error);
      res.status(500).json({
        error: true,
        message: error.message || 'Failed to search for available phone numbers'
      });
    }
  });

  // POST /api/twilio/purchase-number - Purchase a Twilio phone number
  app.post('/api/twilio/purchase-number', authenticateJwt, async (req, res) => {
    try {
      const { phoneNumber, userId } = req.body;
      const authenticatedUserId = req.user?.id;
      const orgId = req.user?.org_id;

      if (!userId || !authenticatedUserId) {
        return res.status(400).json({ error: true, message: 'User ID required' });
      }

      if (userId !== authenticatedUserId) {
        return res.status(403).json({ error: true, message: 'Forbidden - User ID mismatch' });
      }

      if (!phoneNumber) {
        return res.status(400).json({ error: true, message: 'Phone number required' });
      }

      if (!twilioAccountSid || !twilioAuthToken) {
        return res.status(500).json({
          error: true,
          message: 'Twilio credentials not configured on server'
        });
      }

      console.log(`[SecureAPI] Purchasing number ${phoneNumber} for user ${userId}, org ${orgId}`);

      const twilioClient = twilio(twilioAccountSid, twilioAuthToken);
      const serverPublicUrl = process.env.SERVER_PUBLIC_URL || 'https://flynnai-telephony.fly.dev';

      const purchasedNumber = await twilioClient.incomingPhoneNumbers.create({
        phoneNumber,
        voiceUrl: `${serverPublicUrl}/webhook/voice/${userId}`,
        voiceMethod: 'POST',
        statusCallback: `${serverPublicUrl}/webhook/status/${userId}`,
        statusCallbackMethod: 'POST',
      });

      console.log(`[SecureAPI] Successfully purchased ${purchasedNumber.phoneNumber} (SID: ${purchasedNumber.sid})`);

      res.status(200).json({
        phoneNumber: purchasedNumber.phoneNumber,
        phoneNumberSid: purchasedNumber.sid,
        cost: 1.15,
        monthlyCost: 1.15,
      });

    } catch (error) {
      console.error('[SecureAPI] Error purchasing number:', error);
      res.status(500).json({
        error: true,
        message: error.message || 'Failed to purchase phone number'
      });
    }
  });

  // DELETE /api/twilio/release-number - Release a Twilio phone number
  app.delete('/api/twilio/release-number', authenticateJwt, async (req, res) => {
    try {
      const { phoneNumberSid } = req.body;
      const userId = req.user?.id;
      const orgId = req.user?.org_id;

      if (!phoneNumberSid) {
        return res.status(400).json({ error: true, message: 'Phone number SID required' });
      }

      if (!twilioAccountSid || !twilioAuthToken) {
        return res.status(500).json({
          error: true,
          message: 'Twilio credentials not configured on server'
        });
      }

      console.log(`[SecureAPI] Releasing number ${phoneNumberSid} for user ${userId}, org ${orgId}`);

      const twilioClient = twilio(twilioAccountSid, twilioAuthToken);
      await twilioClient.incomingPhoneNumbers(phoneNumberSid).remove();

      console.log(`[SecureAPI] Successfully released number ${phoneNumberSid}`);

      res.status(200).json({
        success: true,
        message: 'Phone number released successfully',
      });

    } catch (error) {
      console.error('[SecureAPI] Error releasing number:', error);
      res.status(500).json({
        error: true,
        message: error.message || 'Failed to release phone number'
      });
    }
  });

  // POST /api/twilio/send-sms - Send SMS message
  app.post('/api/twilio/send-sms', authenticateJwt, async (req, res) => {
    try {
      const { to, message, fromNumberId } = req.body;
      const userId = req.user?.id;
      const orgId = req.user?.org_id;

      if (!to || !message) {
        return res.status(400).json({ error: true, message: 'To number and message required' });
      }

      if (!twilioAccountSid || !twilioAuthToken) {
        return res.status(500).json({
          error: true,
          message: 'Twilio credentials not configured on server'
        });
      }

      let fromNumber = twilioSmsFromNumber;
      if (!fromNumber) {
        return res.status(400).json({ error: true, message: 'No from number configured' });
      }

      console.log(`[SecureAPI] Sending SMS from ${fromNumber} to ${to} for org ${orgId}`);

      const twilioClient = twilio(twilioAccountSid, twilioAuthToken);
      const sentMessage = await twilioClient.messages.create({
        from: fromNumber,
        to,
        body: message,
      });

      console.log(`[SecureAPI] SMS sent successfully (SID: ${sentMessage.sid})`);

      res.status(200).json({
        messageSid: sentMessage.sid,
        status: sentMessage.status,
        to: sentMessage.to,
        from: sentMessage.from,
      });

    } catch (error) {
      console.error('[SecureAPI] Error sending SMS:', error);
      res.status(500).json({
        error: true,
        message: error.message || 'Failed to send SMS'
      });
    }
  });

  // POST /api/ai/extract-job - Extract job details from transcription using LLM
  app.post('/api/ai/extract-job', authenticateJwt, async (req, res) => {
    try {
      const { transcription, businessType, prompt, model } = req.body;
      const userId = req.user?.id;
      const orgId = req.user?.org_id;

      if (!transcription) {
        return res.status(400).json({ error: true, message: 'Transcription required' });
      }

      console.log(`[SecureAPI] Extracting job from transcript for org ${orgId}, model: ${model}`);

      const llmClient = getLLMClient();

      const systemPrompt = 'You are a helpful assistant that extracts job details from phone call transcriptions for service providers.';
      const userPrompt = prompt || `
Analyze this phone call transcription and extract job details. Return a JSON object with the following structure:

{
  "confidence": 0-1,
  "clientName": "string or null",
  "clientPhone": "string or null",
  "serviceType": "string or null",
  "description": "string or null",
  "scheduledDate": "YYYY-MM-DD or null",
  "scheduledTime": "HH:MM AM/PM or null",
  "location": "string or null",
  "estimatedPrice": number or null,
  "urgency": "low|medium|high or null",
  "followUpRequired": boolean
}

Business type: ${businessType || 'General service provider'}

Transcription:
${transcription}

Focus on extracting client name, contact info, service needed, timing, location, urgency, and pricing.
If information is unclear or missing, set those fields to null.
      `.trim();

      const startTime = Date.now();

      const response = await llmClient.chat.completions.create({
        model: model || 'grok-beta',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      });

      const processingTime = Date.now() - startTime;

      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('LLM response did not include any content');
      }

      let extraction;
      try {
        extraction = JSON.parse(content);
      } catch (parseError) {
        console.error('[SecureAPI] Failed to parse LLM response:', content);
        throw new Error('LLM returned invalid JSON');
      }

      extraction.extractedAt = new Date().toISOString();
      extraction.processingTime = processingTime;

      console.log(`[SecureAPI] Job extraction completed in ${processingTime}ms with confidence ${extraction.confidence}`);

      res.status(200).json({ extraction });

    } catch (error) {
      console.error('[SecureAPI] Error extracting job:', error);
      res.status(500).json({
        error: true,
        message: error.message || 'Failed to extract job from transcript'
      });
    }
  });

  // POST /api/twilio/lookup-carrier - Lookup carrier information
  app.post('/api/twilio/lookup-carrier', authenticateJwt, async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      const userId = req.user?.id;

      if (!phoneNumber) {
        return res.status(400).json({ error: true, message: 'Phone number required' });
      }

      if (!twilioAccountSid || !twilioAuthToken) {
        return res.status(500).json({
          error: true,
          message: 'Twilio credentials not configured on server'
        });
      }

      console.log(`[SecureAPI] Looking up carrier for ${phoneNumber}, user ${userId}`);

      const twilioClient = twilio(twilioAccountSid, twilioAuthToken);
      const lookup = await twilioClient.lookups.v1
        .phoneNumbers(phoneNumber)
        .fetch({ type: ['carrier'] });

      console.log(`[SecureAPI] Carrier lookup successful for ${phoneNumber}`);

      res.status(200).json({
        phoneNumber: lookup.phoneNumber,
        countryCode: lookup.countryCode,
        nationalFormat: lookup.nationalFormat,
        carrier: lookup.carrier,
      });

    } catch (error) {
      console.error('[SecureAPI] Error looking up carrier:', error);
      res.status(500).json({
        error: true,
        message: error.message || 'Failed to lookup carrier information'
      });
    }
  });

  // Health check for secure APIs
  app.get('/api/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'Flynn AI Secure API',
      timestamp: new Date().toISOString(),
      endpoints: {
        'POST /api/twilio/search-numbers': 'Search available numbers',
        'POST /api/twilio/purchase-number': 'Purchase phone number',
        'DELETE /api/twilio/release-number': 'Release phone number',
        'POST /api/twilio/send-sms': 'Send SMS message',
        'POST /api/ai/extract-job': 'Extract job from transcript',
        'POST /api/twilio/lookup-carrier': 'Lookup carrier info (optional)',
      },
    });
  });

  console.log('[SecureAPI] All secure API routes attached successfully');
};
