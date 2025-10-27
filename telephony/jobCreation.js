const {
  getCallBySid,
  getJobByCallSid,
  getUserProfileById,
  insertJob,
} = require('../supabaseMcpClient');
const { sendJobCreatedNotification } = require('../notifications/pushService');

const ACTIVE_LLM_PROVIDER = (() => {
  const explicit = (process.env.LLM_PROVIDER || '').trim().toLowerCase();
  if (explicit) {
    return explicit;
  }
  return (process.env.XAI_API_KEY || process.env.GROK_API_KEY) ? 'grok' : 'openai';
})();

const JOB_EXTRACTION_MODEL = process.env.JOB_EXTRACTION_MODEL
  || (ACTIVE_LLM_PROVIDER === 'grok' ? 'grok-4-fast' : process.env.OPENAI_JOB_EXTRACTION_MODEL || 'gpt-4o-mini');

const sanitizeText = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizePhone = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const digits = value.replace(/[^0-9+]/g, '');
  if (digits.length >= 10) {
    return digits;
  }

  return null;
};

const extractJobDetails = async ({ transcriptText, llmClient, userBusinessType }) => {
  if (!llmClient) {
    throw new Error('LLM client is not configured for job extraction.');
  }

  const sanitizedTranscript = sanitizeText(transcriptText);
  if (!sanitizedTranscript) {
    throw new Error('Transcript text is required to extract job details.');
  }

  const businessTypeContext = userBusinessType
    ? `This business is a ${userBusinessType.replace(/_/g, ' ')} service provider.`
    : '';

  const systemPrompt = `Extract customer details from service voicemails. ${businessTypeContext}

Always respond with JSON containing customer_name, customer_phone, customer_email, service_type, summary, scheduled_date, scheduled_time, location, and notes. Use null when a field is unknown.

- service_type should be specific to the business type (e.g., "Leaky faucet repair" for plumbers, "Haircut and color" for salons)
- scheduled_date should be in YYYY-MM-DD format if mentioned
- scheduled_time should be in HH:MM format if mentioned
- location should include address details if provided
- notes should capture special requirements or urgency`;

  const completion = await llmClient.chat.completions.create({
    model: JOB_EXTRACTION_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: `Transcript:\n${sanitizedTranscript}`,
      },
    ],
  });

  const messageContent = completion?.choices?.[0]?.message?.content;
  if (!messageContent) {
    throw new Error('Job extraction response did not include any content.');
  }

  let parsed;
  try {
    parsed = JSON.parse(messageContent);
  } catch (error) {
    throw new Error('Failed to parse job extraction JSON response.');
  }

  const summary = sanitizeText(parsed.summary) || sanitizedTranscript.slice(0, 250);

  return {
    customerName: sanitizeText(parsed.customer_name),
    customerPhone: normalizePhone(parsed.customer_phone),
    customerEmail: sanitizeText(parsed.customer_email),
    serviceType: sanitizeText(parsed.service_type),
    summary,
    scheduledDate: sanitizeText(parsed.scheduled_date),
    scheduledTime: sanitizeText(parsed.scheduled_time),
    location: sanitizeText(parsed.location),
    notes: sanitizeText(parsed.notes),
  };
};

const ensureJobForTranscript = async ({ callSid, transcriptText, llmClient }) => {
  if (!callSid) {
    throw new Error('callSid is required to create a job.');
  }

  const existingJob = await getJobByCallSid(callSid).catch((error) => {
    console.error('[Jobs] Failed to look up existing job by call_sid.', { callSid, error });
    throw error;
  });

  if (existingJob) {
    console.log('[Jobs] Job already exists for call; skipping creation.', { callSid });
    return existingJob;
  }

  const callRecord = await getCallBySid(callSid).catch((error) => {
    console.error('[Jobs] Failed to load call metadata before job creation.', { callSid, error });
    throw error;
  });

  let userProfile = null;
  if (callRecord?.user_id) {
    userProfile = await getUserProfileById(callRecord.user_id).catch((error) => {
      console.warn('[Jobs] Failed to load user profile before job creation.', { userId: callRecord.user_id, error });
      return null;
    });
  }

  const extracted = await extractJobDetails({
    transcriptText,
    llmClient,
    userBusinessType: userProfile?.business_type || null,
  });

  const jobPayload = {
    userId: callRecord?.user_id || null,
    callSid,
    customerName: extracted.customerName,
    customerPhone: extracted.customerPhone,
    customerEmail: extracted.customerEmail || null,
    summary: extracted.summary,
    serviceType: extracted.serviceType,
    status: 'new',
    businessType: userProfile?.business_type || null,
    source: 'voicemail',
    capturedAt: callRecord?.recorded_at || new Date().toISOString(),
    voicemailTranscript: transcriptText,
    voicemailRecordingUrl: callRecord?.recording_url || null,
    scheduledDate: extracted.scheduledDate || null,
    scheduledTime: extracted.scheduledTime || null,
    location: extracted.location || null,
    notes: extracted.notes || null,
    estimatedDuration: extracted.estimatedDuration || null,
    followUpDraft: extracted.followUpDraft || null,
    lastFollowUpAt: null,
  };

  const inserted = await insertJob(jobPayload);

  console.log(`[Jobs] New job created for user ${jobPayload.userId || 'unknown'}.`, {
    callSid,
    jobId: inserted?.id,
  });

  const jobRecord = {
    id: inserted?.id || jobPayload.id,
    call_sid: callSid,
    customer_name: jobPayload.customerName,
    status: jobPayload.status || 'new',
  };

  sendJobCreatedNotification({ userId: jobPayload.userId, job: jobRecord })
    .then((result) => {
      if (result.sent > 0) {
        console.log('[Push] Job notification dispatched.', {
          jobId: jobRecord.id,
          sent: result.sent,
          attempted: result.attempted,
        });
      }
    })
    .catch((error) => {
      console.warn('[Push] Failed to dispatch job notification.', {
        jobId: jobRecord.id,
        error,
      });
    });

  return {
    id: inserted?.id,
    ...jobPayload,
  };
};

module.exports = {
  extractJobDetails,
  ensureJobForTranscript,
};
