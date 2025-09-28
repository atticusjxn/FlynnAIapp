const { getCallBySid, getJobByCallSid, insertJob } = require('../supabaseMcpClient');
const { sendJobCreatedNotification } = require('../notifications/pushService');

const JOB_EXTRACTION_MODEL = process.env.OPENAI_JOB_EXTRACTION_MODEL || 'gpt-4o-mini';

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

const extractJobDetails = async ({ transcriptText, openaiClient }) => {
  if (!openaiClient) {
    throw new Error('OpenAI client is not configured for job extraction.');
  }

  const sanitizedTranscript = sanitizeText(transcriptText);
  if (!sanitizedTranscript) {
    throw new Error('Transcript text is required to extract job details.');
  }

  const completion = await openaiClient.chat.completions.create({
    model: JOB_EXTRACTION_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'Extract customer details from service voicemails. Always respond with JSON containing customer_name, customer_phone, service_type, and summary. Use null when a field is unknown.',
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
    serviceType: sanitizeText(parsed.service_type),
    summary,
  };
};

const ensureJobForTranscript = async ({ callSid, transcriptText, openaiClient }) => {
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

  const extracted = await extractJobDetails({ transcriptText, openaiClient });

  const jobPayload = {
    userId: callRecord?.user_id || null,
    callSid,
    customerName: extracted.customerName,
    customerPhone: extracted.customerPhone,
    summary: extracted.summary,
    serviceType: extracted.serviceType,
    status: 'new',
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
