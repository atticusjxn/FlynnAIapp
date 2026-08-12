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

  // Number provisioning is NOT here. /api/twilio/search-numbers,
  // /api/twilio/purchase-number and /api/twilio/release-number were removed:
  // none of them checked entitlement, purchase bought any country with no
  // regulatory bundle and never recorded the number against a user, and
  // release took a phoneNumberSid straight from the request body with no
  // ownership check at all, so any authenticated user could disconnect any
  // other tenant's receptionist number. Provisioning lives behind the
  // entitlement gate in routes/voiceOnboarding.js.

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
        'POST /api/twilio/send-sms': 'Send SMS message',
        'POST /api/ai/extract-job': 'Extract job from transcript',
        'POST /api/twilio/lookup-carrier': 'Lookup carrier info (optional)',
      },
    });
  });

  console.log('[SecureAPI] All secure API routes attached successfully');
};
