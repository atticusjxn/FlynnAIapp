const mockSupabaseClient = {
  upsertCallRecord: jest.fn().mockResolvedValue(undefined),
  getTranscriptByCallSid: jest.fn().mockResolvedValue(null),
  insertTranscription: jest.fn().mockResolvedValue(null),
  updateCallTranscriptionStatus: jest.fn().mockResolvedValue(undefined),
  getCallBySid: jest.fn().mockResolvedValue(null),
  getJobByCallSid: jest.fn().mockResolvedValue(null),
  listJobsForUser: jest.fn().mockResolvedValue([]),
  getJobForUser: jest.fn().mockResolvedValue(null),
  updateJobStatusForUser: jest.fn().mockResolvedValue(null),
  getJobById: jest.fn().mockResolvedValue(null),
  insertJob: jest.fn().mockResolvedValue({ id: 'job-id' }),
  findExpiredRecordingCalls: jest.fn().mockResolvedValue([]),
  markCallRecordingExpired: jest.fn().mockResolvedValue(undefined),
  updateCallRecordingSignedUrl: jest.fn().mockResolvedValue(undefined),
  normalizePhoneNumber: jest.fn((value) => value),
  getUserByTwilioNumber: jest.fn().mockResolvedValue({ id: 'user-123' }),
  getRoutingSettingsForUser: jest.fn().mockResolvedValue({ mode: 'smart_auto' }),
  getCallerByPhone: jest.fn().mockResolvedValue(null),
  upsertCaller: jest.fn().mockResolvedValue(null),
  CALL_ROUTING_MODES: new Set(['intake', 'voicemail', 'smart_auto']),
};

const storageUploadMock = jest.fn().mockResolvedValue({ data: { path: 'voicemails/test' }, error: null });
const storageCreateSignedUrlMock = jest.fn().mockResolvedValue({
  data: {
    signedUrl: 'https://storage.example.com/voicemail.mp3',
    expiration: Math.floor(Date.now() / 1000) + 3600,
  },
  error: null,
});
const storageRemoveMock = jest.fn().mockResolvedValue({ error: null });

const storageFromMock = jest.fn(() => ({
  upload: storageUploadMock,
  createSignedUrl: storageCreateSignedUrlMock,
  remove: storageRemoveMock,
}));

const supabaseClientMock = {
  storage: {
    from: storageFromMock,
  },
};

const mockCreateSupabaseClient = jest.fn(() => supabaseClientMock);

jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

const voiceResponseInstance = {
  say: jest.fn(),
  record: jest.fn(),
  toString: jest.fn().mockReturnValue('<Response></Response>'),
};

const mockVoiceResponse = jest.fn(() => voiceResponseInstance);

const twilioMessagesCreateMock = jest.fn().mockResolvedValue({ sid: 'SM123' });

const twilioInstance = {
  messages: {
    create: twilioMessagesCreateMock,
  },
};

const mockTwilio = jest.fn(() => twilioInstance);
mockTwilio.validateRequest = jest.fn().mockReturnValue(true);
mockTwilio.twiml = { VoiceResponse: mockVoiceResponse };

mockTwilio.mockReset = () => {
  mockTwilio.mockClear();
  mockTwilio.validateRequest.mockClear();
  mockVoiceResponse.mockClear();
  voiceResponseInstance.say.mockClear();
  voiceResponseInstance.record.mockClear();
  voiceResponseInstance.toString.mockClear();
  twilioMessagesCreateMock.mockClear();
};

jest.mock('twilio', () => mockTwilio);

jest.mock('expo', () => ({}), { virtual: true });
jest.mock('expo/virtual/env', () => ({}), { virtual: true });

const openaiTranscriptionCreateMock = jest.fn().mockResolvedValue({
  text: 'transcribed text',
  language: 'en',
});

const openaiChatCompletionMock = jest.fn().mockResolvedValue({
  choices: [
    {
      message: {
        content: JSON.stringify({
          customer_name: 'Alice',
          customer_phone: '+15550000001',
          service_type: 'plumbing',
          summary: 'Fix sink',
        }),
      },
    },
  ],
});

const mockOpenAI = jest.fn().mockImplementation(() => ({
  audio: {
    transcriptions: {
      create: openaiTranscriptionCreateMock,
    },
  },
  chat: {
    completions: {
      create: openaiChatCompletionMock,
    },
  },
}));

const mockToFile = jest.fn(async () => ({ file: 'mock-file' }));

const mockOpenAIModule = Object.assign(mockOpenAI, { toFile: mockToFile });

jest.mock('openai', () => mockOpenAIModule);

jest.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateSupabaseClient,
}));

const mockEnsureJobForTranscript = jest.fn().mockResolvedValue({ id: 'job-123' });
jest.mock('../telephony/jobCreation', () => ({
  ensureJobForTranscript: mockEnsureJobForTranscript,
}));

jest.mock('../supabaseMcpClient', () => mockSupabaseClient);

const fetchMock = jest.fn();
global.fetch = fetchMock;

const resetAllMocks = () => {
  mockSupabaseClient.upsertCallRecord.mockReset().mockResolvedValue(undefined);
  mockSupabaseClient.getTranscriptByCallSid.mockReset().mockResolvedValue(null);
  mockSupabaseClient.insertTranscription.mockReset().mockResolvedValue(null);
  mockSupabaseClient.updateCallTranscriptionStatus.mockReset().mockResolvedValue(undefined);
  mockSupabaseClient.getCallBySid.mockReset().mockResolvedValue(null);
  mockSupabaseClient.getJobByCallSid.mockReset().mockResolvedValue(null);
  mockSupabaseClient.listJobsForUser.mockReset().mockResolvedValue([]);
  mockSupabaseClient.getJobForUser.mockReset().mockResolvedValue(null);
  mockSupabaseClient.updateJobStatusForUser.mockReset().mockResolvedValue(null);
  mockSupabaseClient.getJobById.mockReset().mockResolvedValue(null);
  mockSupabaseClient.insertJob.mockReset().mockResolvedValue({ id: 'job-id' });
  mockSupabaseClient.findExpiredRecordingCalls.mockReset().mockResolvedValue([]);
  mockSupabaseClient.markCallRecordingExpired.mockReset().mockResolvedValue(undefined);
  mockSupabaseClient.updateCallRecordingSignedUrl.mockReset().mockResolvedValue(undefined);
  mockSupabaseClient.normalizePhoneNumber.mockReset().mockImplementation((value) => value);
  mockSupabaseClient.getUserByTwilioNumber.mockReset().mockResolvedValue({ id: 'user-123' });
  mockSupabaseClient.getRoutingSettingsForUser.mockReset().mockResolvedValue({ mode: 'smart_auto' });
  mockSupabaseClient.getCallerByPhone.mockReset().mockResolvedValue(null);
  mockSupabaseClient.upsertCaller.mockReset().mockResolvedValue(null);
  storageUploadMock.mockReset().mockResolvedValue({ data: { path: 'voicemails/test' }, error: null });
  storageCreateSignedUrlMock.mockReset().mockResolvedValue({
    data: {
      signedUrl: 'https://storage.example.com/voicemail.mp3',
      expiration: Math.floor(Date.now() / 1000) + 3600,
    },
    error: null,
  });
  storageRemoveMock.mockReset().mockResolvedValue({ error: null });
  storageFromMock.mockReset().mockImplementation(() => ({
    upload: storageUploadMock,
    createSignedUrl: storageCreateSignedUrlMock,
    remove: storageRemoveMock,
  }));
  mockCreateSupabaseClient.mockReset().mockReturnValue(supabaseClientMock);
  mockTwilio.mockReset();
  twilioMessagesCreateMock.mockReset().mockResolvedValue({ sid: 'SM123' });
  mockOpenAI.mockReset();
  mockOpenAI.mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: openaiTranscriptionCreateMock,
      },
    },
    chat: {
      completions: {
        create: openaiChatCompletionMock,
      },
    },
  }));
  openaiTranscriptionCreateMock.mockReset().mockResolvedValue({ text: 'transcribed text', language: 'en' });
  openaiChatCompletionMock.mockReset().mockResolvedValue({
    choices: [{ message: { content: JSON.stringify({
      customer_name: 'Alice',
      customer_phone: '+15550000001',
      service_type: 'plumbing',
      summary: 'Fix sink',
    }) } }],
  });
  mockToFile.mockReset().mockResolvedValue({ file: 'mock-file' });
  mockEnsureJobForTranscript.mockReset().mockResolvedValue({ id: 'job-123' });
  fetchMock.mockReset();
};

module.exports = {
  mockSupabaseClient,
  supabaseClientMock,
  storageUploadMock,
  storageCreateSignedUrlMock,
  storageRemoveMock,
  storageFromMock,
  mockCreateSupabaseClient,
  mockTwilio,
  twilioInstance,
  mockVoiceResponse,
  voiceResponseInstance,
  twilioMessagesCreateMock,
  mockOpenAI,
  openaiTranscriptionCreateMock,
  openaiChatCompletionMock,
  mockToFile,
  mockEnsureJobForTranscript,
  fetchMock,
  resetAllMocks,
};
