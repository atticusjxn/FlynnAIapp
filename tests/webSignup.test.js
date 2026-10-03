/**
 * Web signup (flynnai.app/start): embedded Stripe Checkout with a 7-day trial,
 * then automatic receptionist provisioning. These pin the parts a hot lead
 * actually hits: strict input, the exact Checkout Session shape, provisioning
 * that happens exactly once whether the webhook or the status poll gets there
 * first, the male/female AU voice mapping, and the calendar connect link.
 */

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_abc';
process.env.TWILIO_ACCOUNT_SID = 'AC123';
process.env.TWILIO_AUTH_TOKEN = 'tok';

// ---- in-memory Supabase fake ------------------------------------------------
function makeDb() {
  const tables = {
    web_signups: [], users: [], organizations: [], receptionist_configs: [],
    business_profiles: [], voice_number_pool: [], booking_pages: [],
  };
  const rpcs = {};
  let idSeq = 0;
  const match = (row, filters) => filters.every(([op, k, v]) => {
    if (op === 'eq') return row[k] === v;
    if (op === 'is') return row[k] === v;
    if (op === 'in') return v.includes(row[k]);
    return true;
  });
  function builder(table) {
    const st = { table, op: 'select', filters: [], payload: null, returning: false, single: false, maybe: false };
    const api = {
      select() { if (st.op !== 'select') st.returning = true; return api; },
      insert(p) { st.op = 'insert'; st.payload = p; return api; },
      update(p) { st.op = 'update'; st.payload = p; return api; },
      upsert(p) { st.op = 'insert'; st.payload = p; return api; },
      eq(k, v) { st.filters.push(['eq', k, v]); return api; },
      is(k, v) { st.filters.push(['is', k, v]); return api; },
      in(k, v) { st.filters.push(['in', k, v]); return api; },
      order() { return api; }, limit() { return api; },
      single() { st.single = true; return run(); },
      maybeSingle() { st.maybe = true; return run(); },
      then(res, rej) { return run().then(res, rej); },
      catch(fn) { return run().catch(fn); },
    };
    async function run() {
      const rows = tables[st.table] || (tables[st.table] = []);
      let data;
      if (st.op === 'insert') {
        const row = { id: `id-${++idSeq}`, status: 'pending', ...st.payload };
        rows.push(row); data = [row];
      } else if (st.op === 'update') {
        data = rows.filter((r) => match(r, st.filters));
        data.forEach((r) => Object.assign(r, st.payload));
        if (!st.returning && !st.single && !st.maybe) return { data: null, error: null };
      } else {
        data = rows.filter((r) => match(r, st.filters));
      }
      if (st.single || st.maybe) return { data: data[0] ? { ...data[0] } : null, error: null };
      return { data: data.map((r) => ({ ...r })), error: null };
    }
    return api;
  }
  const db = {
    tables, rpcs,
    from: (t) => builder(t),
    rpc: jest.fn(async (name, args) => (rpcs[name] ? rpcs[name](args) : { data: null, error: { message: 'no rpc' } })),
  };
  return db;
}

const db = makeDb();
jest.mock('@supabase/supabase-js', () => ({ createClient: () => db }));
jest.mock('dotenv', () => ({ config: jest.fn() }));

const sentMessages = [];
const numberUpdates = [];
const twilioInstance = {
  messages: { create: jest.fn(async (m) => { sentMessages.push(m); return { sid: 'SM1' }; }) },
  incomingPhoneNumbers: Object.assign(
    jest.fn((sid) => ({ update: jest.fn(async (u) => { numberUpdates.push({ sid, ...u }); }) })),
    { list: jest.fn(async () => [{ sid: 'PN1' }]) },
  ),
};
jest.mock('twilio', () => jest.fn(() => twilioInstance));

// The auth user + its trigger-created org.
const mockEnsureAuthUser = jest.fn(async (phone) => {
  const existing = db.tables.users.find((u) => u.phone === phone);
  if (existing) return { id: existing.id, created: false };
  const user = { id: `user-${db.tables.users.length + 1}`, phone, default_org_id: `org-${db.tables.users.length + 1}` };
  db.tables.users.push(user);
  db.tables.organizations.push({ id: user.default_org_id });
  db.tables.receptionist_configs.push({ org_id: user.default_org_id, summary_delivery: 'push' });
  db.tables.business_profiles.push({ org_id: user.default_org_id });
  return { id: user.id, created: true };
});
jest.mock('../services/authLink', () => {
  const actual = jest.requireActual('../services/authLink');
  return { ...actual, ensureAuthUser: (...a) => mockEnsureAuthUser(...a) };
});
jest.mock('../services/bookingPage', () => ({ ensureBookingPage: jest.fn(async () => ({ slug: 'demo' })) }));
jest.mock('../services/nango', () => ({
  createSetupLink: jest.fn(({ userId }) => `https://flynnai-telephony.fly.dev/setup?t=jwt-for-${userId}`),
}));

const express = require('express');
const request = require('supertest');
const router = require('../routes/webSignup');
const { buildSpeakConfig } = require('../telephony/deepgramVoiceAgent');
const { forwardingCodesFor, primaryCodeFor } = require('../services/webSignupProvision');

const app = express();
app.use(express.json());
app.use('/api/signup', router);

const stripeCreate = jest.fn(async () => ({ id: 'cs_test_abc123', client_secret: 'cs_test_abc123_secret_xyz' }));
const stripeRetrieve = jest.fn();
router._test.setStripeForTest({ checkout: { sessions: { create: stripeCreate, retrieve: stripeRetrieve } } });

const bradley = {
  name: 'Bradley Smith',
  email: 'Bradley@Example.com',
  mobile: '0497 000 111',
  businessName: 'Bradley Prototypes',
  businessType: 'Freelance prototype development',
  onMissedCall: ['take_message', 'text_summary', 'book_appointment'],
  coverage: 'missed_calls',
  voice: 'male',
  notes: 'Personal line, no forwarding of answered calls',
};

let poolNumbers;
beforeEach(() => {
  poolNumbers = ['+61480111222'];
  db.rpcs.allocate_pool_number = jest.fn(async () => ({ data: poolNumbers.shift() || null, error: null }));
  sentMessages.length = 0;
});

describe('POST /api/signup/checkout', () => {
  test('rejects unknown fields, bad enums and non-AU mobiles', async () => {
    const extra = await request(app).post('/api/signup/checkout').send({ answers: { ...bradley, admin: true } });
    expect(extra.status).toBe(400);
    const badVoice = await request(app).post('/api/signup/checkout').send({ answers: { ...bradley, voice: 'robot' } });
    expect(badVoice.status).toBe(400);
    const nz = await request(app).post('/api/signup/checkout').send({ answers: { ...bradley, mobile: '+64211234567' } });
    expect(nz.status).toBe(400);
    expect(nz.body.fields).toEqual(['answers.mobile']);
    const afterHoursNoHours = await request(app).post('/api/signup/checkout').send({ answers: { ...bradley, coverage: 'after_hours' } });
    expect(afterHoursNoHours.body.fields).toEqual(['answers.hours']);
    expect(stripeCreate).not.toHaveBeenCalled();
  });

  test('creates an embedded subscription checkout with a 7-day card-required trial', async () => {
    const res = await request(app).post('/api/signup/checkout').send({ answers: bradley, ref: 'bradley' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ clientSecret: 'cs_test_abc123_secret_xyz', sessionId: 'cs_test_abc123', publishableKey: 'pk_test_abc' });

    const [params, opts] = stripeCreate.mock.calls[0];
    expect(params).toMatchObject({
      ui_mode: 'embedded',
      mode: 'subscription',
      customer_email: 'bradley@example.com',
      payment_method_collection: 'always',
      subscription_data: { trial_period_days: 7 },
      return_url: 'https://flynnai.app/start/done?session_id={CHECKOUT_SESSION_ID}',
    });
    expect(params.line_items[0].price_data).toMatchObject({ currency: 'aud', unit_amount: 7900, recurring: { interval: 'month' } });
    const row = db.tables.web_signups[0];
    expect(params.metadata).toEqual({ flynn_signup: 'web_v1', flynn_signup_id: row.id });
    expect(opts.idempotencyKey).toBe(`web-signup-${row.id}`);
    // Answers are stored server-side, normalised, and linked to the session.
    expect(row).toMatchObject({ email: 'bradley@example.com', mobile: '+61497000111', ref: 'bradley', stripe_session_id: 'cs_test_abc123' });
    expect(row.answers.voice).toBe('male');
  });
});

describe('provisioning', () => {
  const completeSession = {
    id: 'cs_test_abc123', status: 'complete',
    customer: 'cus_1', subscription: { id: 'sub_1', status: 'trialing' },
  };

  test('status stays pending until Stripe says the trial started', async () => {
    stripeRetrieve.mockResolvedValueOnce({ ...completeSession, status: 'open', subscription: null });
    const res = await request(app).get('/api/signup/status').query({ session_id: 'cs_test_abc123' });
    expect(res.body.state).toBe('pending');
    expect(db.rpcs.allocate_pool_number).not.toHaveBeenCalled();
  });

  test('a completed session provisions exactly once across webhook + concurrent polls', async () => {
    const row = db.tables.web_signups[0];
    stripeRetrieve.mockResolvedValue({ ...completeSession, metadata: { flynn_signup: 'web_v1', flynn_signup_id: row.id } });

    const [a, b, hook] = await Promise.all([
      request(app).get('/api/signup/status').query({ session_id: 'cs_test_abc123' }),
      request(app).get('/api/signup/status').query({ session_id: 'cs_test_abc123' }),
      router.provisionFromCheckoutSession({ ...completeSession, subscription: 'sub_1', metadata: { flynn_signup: 'web_v1', flynn_signup_id: row.id } }),
    ]);
    expect(db.rpcs.allocate_pool_number).toHaveBeenCalledTimes(1);
    expect(mockEnsureAuthUser).toHaveBeenCalledTimes(1);
    expect(hook).toBeTruthy();

    const live = await request(app).get('/api/signup/status').query({ session_id: 'cs_test_abc123' });
    expect(live.body).toEqual({
      state: 'live',
      voice: 'male',
      coverage: 'missed_calls',
      phoneNumber: '+61480111222',
      forwardingCodes: {
        noAnswer: '**61*0480111222#', busy: '**67*0480111222#', unreachable: '**62*0480111222#',
        allConditional: '**004*0480111222#', cancel: '##004#',
      },
      calendarConnectUrl: 'https://flynnai-telephony.fly.dev/setup?t=jwt-for-user-1',
    });
    expect([a.status, b.status]).toEqual([200, 200]);
  });

  test('the receptionist is configured from the form and entitled via the org', () => {
    const user = db.tables.users[0];
    expect(user).toMatchObject({
      email: 'bradley@example.com',
      business_name: 'Bradley Prototypes',
      receptionist_configured: true,
      call_handling_mode: 'ai_receptionist',
      receptionist_voice: 'male',
      twilio_phone_number: '+61480111222',
      subscription_status: 'trialing',
      stripe_customer_id: 'cus_1',
    });
    expect(user.receptionist_business_profile).toMatchObject({ wants_booking: true, coverage: 'missed_calls' });
    expect(user.receptionist_greeting).toMatch(/Bradley Prototypes/);
    expect(db.tables.organizations[0]).toMatchObject({ billing_plan_id: 'starter', subscription_status: 'trialing', stripe_subscription_id: 'sub_1' });
    expect(db.tables.receptionist_configs[0].summary_delivery).toBe('sms');
    expect(numberUpdates[0]).toMatchObject({ sid: 'PN1', smsUrl: expect.stringMatching(/\/webhooks\/sms\/inbound$/) });
  });

  test('welcome SMS carries the number, the divert code and the calendar link', () => {
    // Sent during the previous test's provisioning run.
    expect(twilioInstance.messages.create).toHaveBeenCalled();
    const msg = twilioInstance.messages.create.mock.calls[0][0];
    expect(msg.to).toBe('+61497000111');
    expect(msg.from).toBe('+61480111222');
    expect(msg.body).toContain('0480111222');
    expect(msg.body).toContain('**004*0480111222#');
    expect(msg.body).toContain('Connect your calendar so Flynn can book you in: https://flynnai-telephony.fly.dev/setup?t=jwt-for-user-1');
  });

  test('an empty number pool fails visibly instead of hanging in provisioning', async () => {
    poolNumbers = [];
    stripeCreate.mockResolvedValueOnce({ id: 'cs_test_empty1', client_secret: 'sec' });
    await request(app).post('/api/signup/checkout').send({ answers: { ...bradley, mobile: '0412345678', voice: 'female' } });
    const row = db.tables.web_signups.find((r) => r.stripe_session_id === 'cs_test_empty1');
    const out = await router.provisionFromCheckoutSession({ customer: 'cus_2', subscription: 'sub_2', metadata: { flynn_signup: 'web_v1', flynn_signup_id: row.id } });
    expect(out.status).toBe('failed');
    const res = await request(app).get('/api/signup/status').query({ session_id: 'cs_test_empty1' });
    expect(res.body).toMatchObject({ state: 'failed', error: 'pool_empty' });
  });

  test('ignores checkout sessions that are not web signups', async () => {
    await expect(router.provisionFromCheckoutSession({ metadata: { planId: 'starter' } })).resolves.toBeNull();
  });
});

describe('voice + forwarding helpers', () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; });

  test("receptionist_voice 'male' selects the AU male Cartesia voice", () => {
    process.env.CARTESIA_API_KEY = 'k';
    process.env.CARTESIA_VOICE_AU_MALE = 'male-voice-id';
    process.env.CARTESIA_VOICE_AU_FEMALE = 'female-voice-id';
    expect(buildSpeakConfig(null, 'male').provider.voice.id).toBe('male-voice-id');
    expect(buildSpeakConfig(null, 'female').provider.voice.id).toBe('female-voice-id');
    // Existing named voice options keep today's default.
    expect(buildSpeakConfig(null, 'flynn_warm').provider.voice.id).toBe('female-voice-id');
    // An explicit voice_profile still wins.
    expect(buildSpeakConfig({ voice_profile: { gender: 'female' } }, 'male').provider.voice.id).toBe('female-voice-id');
  });

  test('always-on coverage uses the unconditional divert', () => {
    expect(primaryCodeFor('always', '+61480111222')).toBe('**21*0480111222#');
    expect(primaryCodeFor('missed_calls', '+61480111222')).toBe('**004*0480111222#');
    expect(forwardingCodesFor('+61480111222').cancel).toBe('##004#');
  });
});
