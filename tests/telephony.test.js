const { loadServer, BASE_ENV } = require('./testServer');

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

      const request = require('supertest')(app);
      const response = await request.get(`/telephony/calls/${CALL_SID}/recording`);

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

      const request = require('supertest')(app);
      const response = await request.get(`/telephony/calls/${CALL_SID}/recording`);

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
      expect(response.body).toEqual({
        error: 'Configure TWILIO_MESSAGING_SERVICE_SID or TWILIO_SMS_FROM_NUMBER to send SMS.',
      });
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
