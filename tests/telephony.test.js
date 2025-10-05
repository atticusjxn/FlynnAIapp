const { loadServer, BASE_ENV, createAuthToken } = require('./testServer');

const buildRecordingResponse = () => {
  const buffer = Buffer.from('fake-audio');
  const headers = {
    get: (key) => (key.toLowerCase() === 'content-type' ? 'audio/mpeg' : null),
  };

  const response = {
    ok: true,
    headers,
    arrayBuffer: async () => buffer,
    clone: () => buildRecordingResponse(),
    body: {
      cancel: jest.fn(),
    },
  };

  return response;
};

describe('Telephony API', () => {
  const CALL_SID = 'CA555';

  describe('POST /telephony/inbound-voice', () => {
    const basePayload = {
      CallSid: CALL_SID,
      From: '+15550009999',
      To: '+15550001234',
    };

    let determineInboundRouteMock;
    const ROUTING_FEATURE_VERSION = 'smart-routing-test';
    const setupRoutingMock = () => {
      determineInboundRouteMock = jest.fn();
      jest.doMock('../telephony/routing', () => ({
        determineInboundRoute: determineInboundRouteMock,
        FEATURE_VERSION: ROUTING_FEATURE_VERSION,
      }));
    };

    test('routes unknown callers to AI intake and persists metadata', async () => {
      const {
        app,
        mocks: { mockSupabaseClient, voiceResponseInstance },
      } = loadServer({}, { setupMocks: setupRoutingMock });

      determineInboundRouteMock.mockResolvedValue({
        route: 'intake',
        reason: 'smart_unknown',
        mode: 'smart_auto',
        user: { id: 'user-123' },
        caller: null,
        fallback: false,
        schedule: { active: true },
      });

      const request = require('supertest')(app);
      const response = await request
        .post('/telephony/inbound-voice')
        .send(basePayload)
        .set('content-type', 'application/x-www-form-urlencoded');

      expect(response.status).toBe(200);
      expect(voiceResponseInstance.say).toHaveBeenCalledWith(
        'Hi, you have reached FlynnAI. I am the AI receptionist and will take down the details for the team.',
      );
      expect(voiceResponseInstance.record).toHaveBeenCalledWith(
        expect.objectContaining({ playBeep: true }),
      );
      expect(determineInboundRouteMock).toHaveBeenCalledWith({
        toNumber: basePayload.To,
        fromNumber: basePayload.From,
        now: expect.any(Date),
      });
      expect(mockSupabaseClient.upsertCallRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          callSid: CALL_SID,
          userId: 'user-123',
          routeDecision: 'intake',
          routeReason: 'smart_unknown',
          routeFallback: false,
          featureFlagVersion: ROUTING_FEATURE_VERSION,
        }),
      );
    });

    test('routes known callers to voicemail path', async () => {
      const {
        app,
        mocks: { mockSupabaseClient, voiceResponseInstance },
      } = loadServer({}, { setupMocks: setupRoutingMock });

      determineInboundRouteMock.mockResolvedValue({
        route: 'voicemail',
        reason: 'smart_known',
        mode: 'smart_auto',
        user: { id: 'user-456' },
        caller: { id: 'caller-99' },
        fallback: false,
      });

      const request = require('supertest')(app);
      const response = await request
        .post('/telephony/inbound-voice')
        .send(basePayload)
        .set('content-type', 'application/x-www-form-urlencoded');

      expect(response.status).toBe(200);
      expect(voiceResponseInstance.say).toHaveBeenCalledWith(
        "Hi, you've reached FlynnAI. Please leave a message after the tone.",
      );
      expect(determineInboundRouteMock).toHaveBeenCalledTimes(1);
      expect(mockSupabaseClient.upsertCallRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          callSid: CALL_SID,
          userId: 'user-456',
          callerId: 'caller-99',
          routeDecision: 'voicemail',
          routeReason: 'smart_known',
          featureFlagVersion: ROUTING_FEATURE_VERSION,
        }),
      );
    });

    test('falls back to voicemail when routing evaluation fails', async () => {
      const {
        app,
        mocks: { mockSupabaseClient, voiceResponseInstance },
      } = loadServer({}, { setupMocks: setupRoutingMock });

      determineInboundRouteMock.mockRejectedValue(new Error('db unavailable'));

      const request = require('supertest')(app);
      const response = await request
        .post('/telephony/inbound-voice')
        .send(basePayload)
        .set('content-type', 'application/x-www-form-urlencoded');

      expect(response.status).toBe(200);
      expect(voiceResponseInstance.say).toHaveBeenCalledWith(
        "Hi, you've reached FlynnAI. Please leave a message after the tone.",
      );
      expect(determineInboundRouteMock).toHaveBeenCalledTimes(1);
      expect(mockSupabaseClient.upsertCallRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          callSid: CALL_SID,
          routeDecision: 'voicemail',
          routeReason: 'evaluation_error',
          routeFallback: true,
          featureFlagVersion: ROUTING_FEATURE_VERSION,
        }),
      );
    });
  });

  describe('POST /telephony/recording-complete', () => {
    const basePayload = {
      CallSid: CALL_SID,
      From: '+15550000010',
      To: '+15550000011',
      RecordingSid: 'RS123',
      RecordingUrl: 'https://api.twilio.com/recordings/RS123',
      RecordingDuration: '45',
      Timestamp: '2024-09-27T12:05:00Z',
    };

    test('stores recording, transcribes, and returns success', async () => {
      const {
        app,
        mocks: {
          mockSupabaseClient,
          fetchMock,
          mockEnsureJobForTranscript,
        },
      } = loadServer();

      fetchMock.mockResolvedValue(buildRecordingResponse());

      mockSupabaseClient.getTranscriptByCallSid.mockResolvedValue(null);
      mockSupabaseClient.insertTranscription.mockResolvedValue({ id: 'transcription-1' });
      mockSupabaseClient.upsertCallRecord.mockResolvedValue(undefined);
      mockSupabaseClient.getCallBySid.mockResolvedValue({
        call_sid: CALL_SID,
        route_decision: 'intake',
        user_id: 'user-123',
      });

      const request = require('supertest')(app);
      const response = await request
        .post('/telephony/recording-complete')
        .send(basePayload)
        .set('x-twilio-signature', 'test-signature')
        .set('content-type', 'application/x-www-form-urlencoded');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'transcribed' });
      expect(fetchMock).toHaveBeenCalledWith(basePayload.RecordingUrl, expect.any(Object));
      expect(mockSupabaseClient.upsertCallRecord).toHaveBeenCalledWith(expect.objectContaining({
        callSid: CALL_SID,
        recordingSid: basePayload.RecordingSid,
        status: 'active',
      }));
      expect(mockSupabaseClient.insertTranscription).toHaveBeenCalled();
      expect(mockEnsureJobForTranscript).toHaveBeenCalledWith(expect.objectContaining({
        callSid: CALL_SID,
      }));
    });

    test('fails when RecordingUrl missing', async () => {
    const {
      app,
      mocks: { mockSupabaseClient },
    } = loadServer();

      const request = require('supertest')(app);
      const response = await request
        .post('/telephony/recording-complete')
        .send({ ...basePayload, RecordingUrl: undefined })
        .set('x-twilio-signature', 'test-signature')
        .set('content-type', 'application/x-www-form-urlencoded');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'RecordingUrl is required' });
      expect(mockSupabaseClient.upsertCallRecord).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
    });

    test('returns 400 when CallSid missing', async () => {
      const { app } = loadServer();
      const request = require('supertest')(app);

      const response = await request
        .post('/telephony/recording-complete')
        .send({})
        .set('x-twilio-signature', 'test-signature')
        .set('content-type', 'application/x-www-form-urlencoded');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'CallSid is required' });
    });
  });

  describe('GET /telephony/calls/:callSid/recording', () => {
    test('returns signed URL when recording stored', async () => {
    const {
      app,
      mocks: { mockSupabaseClient, storageCreateSignedUrlMock },
    } = loadServer();

      const signedUrlPayload = {
        signedUrl: 'https://storage.example.com/file.mp3',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };

      storageCreateSignedUrlMock.mockResolvedValue({
        data: {
          signedUrl: signedUrlPayload.signedUrl,
          expiration: Math.floor(new Date(signedUrlPayload.expiresAt).getTime() / 1000),
        },
        error: null,
      });

      mockSupabaseClient.getCallBySid.mockResolvedValue({
        call_sid: CALL_SID,
        recording_storage_path: 'voicemails/file.mp3',
      });

      const token = createAuthToken('user-123');
      const request = require('supertest')(app);
      const response = await request
        .get(`/telephony/calls/${CALL_SID}/recording`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.callSid).toBe(CALL_SID);
      expect(response.body.signedUrl).toEqual(signedUrlPayload.signedUrl);
      expect(mockSupabaseClient.updateCallRecordingSignedUrl).toHaveBeenCalledWith(expect.objectContaining({
        callSid: CALL_SID,
      }));
    });

    test('returns 404 when no recording stored', async () => {
    const {
      app,
      mocks: { mockSupabaseClient },
    } = loadServer();

    mockSupabaseClient.getCallBySid.mockResolvedValue({
      call_sid: CALL_SID,
      recording_storage_path: null,
    });

    const token = createAuthToken('user-123');
    const request = require('supertest')(app);
    const response = await request
      .get(`/telephony/calls/${CALL_SID}/recording`)
      .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'No stored recording for this call' });
    });
  });

  describe('POST /jobs/:id/confirm', () => {
    const JOB_ID = 'job-123';

    test('queues confirmation SMS when job has customer phone', async () => {
      const {
        app,
      mocks: { mockSupabaseClient, twilioMessagesCreateMock },
      } = loadServer();

      mockSupabaseClient.getJobById.mockResolvedValue({
        id: JOB_ID,
        customer_phone: '+15550000001',
        call_sid: 'CA123',
      });

      const request = require('supertest')(app);
      const response = await request.post(`/jobs/${JOB_ID}/confirm`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'queued' });
      expect(twilioMessagesCreateMock).toHaveBeenCalledWith(expect.objectContaining({
        to: '+15550000001',
      }));
    });

    test('fails when job missing customer phone', async () => {
      const {
        app,
      mocks: { mockSupabaseClient, twilioMessagesCreateMock },
      } = loadServer();

      mockSupabaseClient.getJobById.mockResolvedValue({
        id: JOB_ID,
        customer_phone: null,
      });

      const request = require('supertest')(app);
      const response = await request.post(`/jobs/${JOB_ID}/confirm`);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Job is missing customer_phone' });
      expect(twilioMessagesCreateMock).not.toHaveBeenCalled();
    });

    test('returns 500 when messaging not configured', async () => {
      const envWithoutTwilio = {
        ...BASE_ENV,
        TWILIO_ACCOUNT_SID: undefined,
        TWILIO_AUTH_TOKEN: undefined,
        TWILIO_SMS_FROM_NUMBER: undefined,
        TWILIO_MESSAGING_SERVICE_SID: undefined,
      };

      const {
        app,
        mocks: { mockSupabaseClient },
      } = loadServer(envWithoutTwilio);

      mockSupabaseClient.getJobById.mockResolvedValue({ id: JOB_ID, customer_phone: '+15550000001' });

      const request = require('supertest')(app);
      const response = await request.post(`/jobs/${JOB_ID}/confirm`);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Messaging not configured' });
    });

    test('returns 404 when job not found', async () => {
      const {
        app,
      mocks: { mockSupabaseClient },
      } = loadServer();

    mockSupabaseClient.getJobById.mockResolvedValue(null);

      const request = require('supertest')(app);
      const response = await request.post(`/jobs/${JOB_ID}/confirm`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Job not found' });
    });
  });
});
