const { loadServer, createAuthToken } = require('./testServer');

const USER_ID = '00000000-0000-0000-0000-000000000001';
const OTHER_USER_ID = '00000000-0000-0000-0000-000000000002';
const ISO_NOW = '2024-09-27T12:00:00.000Z';

const BASE_JOBS = [
  {
    id: 'job-1',
    user_id: USER_ID,
    call_sid: 'CA111',
    customer_name: 'Alice',
    customer_phone: '+15550000001',
    summary: 'Fix leaking sink',
    service_type: 'plumbing',
    status: 'new',
    created_at: ISO_NOW,
  },
  {
    id: 'job-2',
    user_id: USER_ID,
    call_sid: 'CA222',
    customer_name: 'Bob',
    customer_phone: '+15550000002',
    summary: 'Install ceiling fan',
    service_type: 'electrical',
    status: 'in_progress',
    created_at: ISO_NOW,
  },
  {
    id: 'job-3',
    user_id: OTHER_USER_ID,
    call_sid: 'CA333',
    customer_name: 'Charlie',
    customer_phone: '+15550000003',
    summary: 'Patch drywall',
    service_type: 'handyman',
    status: 'completed',
    created_at: ISO_NOW,
  },
];

const clone = (obj) => JSON.parse(JSON.stringify(obj));

describe('Jobs API', () => {
  test('rejects requests without x-user-id header', async () => {
    const {
      app,
      mocks: { mockSupabaseClient },
    } = loadServer();

    const request = require('supertest')(app);
    const response = await request.get('/jobs');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Unauthorized' });
    expect(mockSupabaseClient.listJobsForUser).not.toHaveBeenCalled();
  });

  test('lists jobs with pagination defaults', async () => {
    const {
      app,
      mocks: { mockSupabaseClient },
    } = loadServer();

    const expected = BASE_JOBS.slice(0, 2).map((job) => {
      const { user_id, ...rest } = job;
      return rest;
    });

    mockSupabaseClient.listJobsForUser.mockResolvedValue(expected);

    const request = require('supertest')(app);
    const token = createAuthToken(USER_ID);
    const response = await request.get('/jobs')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.jobs).toEqual(expected);
    expect(response.body.pagination).toEqual({ limit: 20, offset: 0, count: expected.length });
    expect(mockSupabaseClient.listJobsForUser).toHaveBeenCalledWith({
      userId: USER_ID,
      status: undefined,
      limit: 20,
      offset: 0,
    });
  });

  test('applies status filter and pagination overrides', async () => {
    const {
      app,
      mocks: { mockSupabaseClient },
    } = loadServer();

    const filtered = [clone(BASE_JOBS[1])].map(({ user_id, ...rest }) => rest);
    mockSupabaseClient.listJobsForUser.mockResolvedValue(filtered);

    const request = require('supertest')(app);
    const token = createAuthToken(USER_ID);
    const response = await request
      .get('/jobs?status=COMPLETED&limit=5&offset=10')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.jobs).toEqual(filtered);
    expect(mockSupabaseClient.listJobsForUser).toHaveBeenCalledWith({
      userId: USER_ID,
      status: 'completed',
      limit: 5,
      offset: 10,
    });
  });

  test('rejects invalid status filter', async () => {
    const {
      app,
      mocks: { mockSupabaseClient },
    } = loadServer();

    const request = require('supertest')(app);
    const token = createAuthToken(USER_ID);
    const response = await request
      .get('/jobs?status=done')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid status filter' });
    expect(mockSupabaseClient.listJobsForUser).not.toHaveBeenCalled();
  });

  test('retrieves job detail for owner', async () => {
    const job = clone(BASE_JOBS[0]);
    const {
      app,
      mocks: { mockSupabaseClient },
    } = loadServer();

    mockSupabaseClient.getJobForUser.mockResolvedValue(job);

    const request = require('supertest')(app);
    const token = createAuthToken(USER_ID);
    const response = await request
      .get(`/jobs/${job.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.job).toEqual(job);
    expect(mockSupabaseClient.getJobForUser).toHaveBeenCalledWith({ jobId: job.id, userId: USER_ID });
  });

  test('returns 404 for job missing or owned by another user', async () => {
    const {
      app,
      mocks: { mockSupabaseClient },
    } = loadServer();

    mockSupabaseClient.getJobForUser.mockResolvedValue(null);

    const request = require('supertest')(app);
    const token = createAuthToken(USER_ID);
    const response = await request
      .get('/jobs/job-missing')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Job not found' });
  });

  test('updates job status to permitted values', async () => {
    const job = clone(BASE_JOBS[1]);
    job.status = 'completed';

    const {
      app,
      mocks: { mockSupabaseClient },
    } = loadServer();

    mockSupabaseClient.updateJobStatusForUser.mockResolvedValue(job);

    const request = require('supertest')(app);
    const token = createAuthToken(USER_ID);
    const response = await request
      .patch(`/jobs/${job.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' });

    expect(response.status).toBe(200);
    expect(response.body.job).toEqual(job);
    expect(mockSupabaseClient.updateJobStatusForUser).toHaveBeenCalledWith({
      jobId: job.id,
      userId: USER_ID,
      status: 'completed',
    });
  });

  test('rejects invalid status transitions and missing status', async () => {
    const {
      app,
      mocks: { mockSupabaseClient },
    } = loadServer();

    const request = require('supertest')(app);
    const token = createAuthToken(USER_ID);

    const missingStatus = await request
      .patch('/jobs/job-1')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(missingStatus.status).toBe(400);
    expect(missingStatus.body).toEqual({ error: 'Status is required' });
    expect(mockSupabaseClient.updateJobStatusForUser).not.toHaveBeenCalled();

    const invalidStatus = await request
      .patch('/jobs/job-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'done' });

    expect(invalidStatus.status).toBe(400);
    expect(invalidStatus.body).toEqual({ error: 'Invalid status value' });
    expect(mockSupabaseClient.updateJobStatusForUser).not.toHaveBeenCalled();
  });

  test('returns 404 when updating job not owned by user', async () => {
    const {
      app,
      mocks: { mockSupabaseClient },
    } = loadServer();

    mockSupabaseClient.updateJobStatusForUser.mockResolvedValue(null);

    const request = require('supertest')(app);
    const token = createAuthToken(USER_ID);
    const response = await request
      .patch('/jobs/job-3')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Job not found' });
  });
});
