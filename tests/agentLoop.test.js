/**
 * Agent loop tests — gating, confirmation, execution and resume, all with
 * fakes (no network, no real LLM).
 */

jest.mock('../llmClient', () => ({
  getLLMClient: jest.fn(),
  PROVIDERS: {},
}));
jest.mock('../services/nango', () => ({
  isConfigured: () => true,
  createTextableConnectLink: jest.fn(({ provider }) => `https://flynn.test/connect/${provider}?t=tok123`),
  verifyConnectLinkToken: jest.fn(),
  getToken: jest.fn(async () => 'fake-access-token'),
  findConnectionId: jest.fn(async () => 'nc_resolved'),
  proxy: jest.fn(),
  createConnectSession: jest.fn(),
}));
jest.mock('../services/googleCalendar', () => ({
  queryFreeBusy: jest.fn(async () => []),
  insertEvent: jest.fn(async () => ({ id: 'evt_1' })),
}));
jest.mock('../services/appleCalendar', () => ({
  queryFreeBusy: jest.fn(async () => []),
  insertEvent: jest.fn(async () => ({ id: 'apple_evt_1' })),
}));
jest.mock('../services/browserbaseAgent', () => ({
  createSession: jest.fn(),
  xeroInvoice: jest.fn(async () => ({ ok: true })),
  reeceOrder: jest.fn(async () => ({ ok: true, cartTotal: '$120.50' })),
  supplierOrder: jest.fn(async () => ({ ok: true, cartTotal: '$80.00' })),
  run: jest.fn(async () => ({ ok: true })),
}));

const { getLLMClient } = require('../llmClient');
const googleCalendar = require('../services/googleCalendar');
const appleCalendar = require('../services/appleCalendar');
const browserbase = require('../services/browserbaseAgent');
const nango = require('../services/nango');
const { runAgentTurn, executePendingTool, resumeParkedAction, reconcileNangoConnection } = require('../services/agent/agentLoop');
const registry = require('../services/agent/toolRegistry');

const PHONE = '+61400000000';
const USER = { id: 'user-1', phone: PHONE, business_brain: { business_type: 'plumber' } };

// Queue of canned LLM responses; each create() call pops one.
function fakeLLM(responses) {
  const queue = [...responses];
  const create = jest.fn(async () => {
    if (!queue.length) throw new Error('fakeLLM exhausted');
    return queue.shift();
  });
  getLLMClient.mockReturnValue({ chat: { completions: { create } } });
  return create;
}

const toolCallResponse = (name, args, content = '') => ({
  choices: [{
    message: {
      content,
      tool_calls: [{ id: 'tc_1', function: { name, arguments: JSON.stringify(args) } }],
    },
  }],
});

const textResponse = (content) => ({ choices: [{ message: { content } }] });

// Minimal chainable supabase fake. Filters are ignored; tables resolve to
// the canned data. Mutations are recorded in .calls.
function fakeSupabase({ history = [], pending = null, integrations = [], connections = [] } = {}) {
  const calls = [];
  const tableData = {
    sms_messages: history,
    user_integrations: integrations,
    user_connections: connections,
  };
  const api = {
    calls,
    from(table) {
      const chain = {};
      const passthrough = ['select', 'eq', 'gt', 'order', 'limit'];
      for (const m of passthrough) chain[m] = () => chain;
      chain.maybeSingle = async () => {
        if (table === 'pending_actions') return { data: pending };
        if (table === 'users') return { data: USER };
        return { data: null };
      };
      chain.update = (payload) => { calls.push({ table, op: 'update', payload }); return chain; };
      chain.delete = () => { calls.push({ table, op: 'delete' }); return chain; };
      chain.upsert = (payload) => { calls.push({ table, op: 'upsert', payload }); return chain; };
      chain.insert = (payload) => { calls.push({ table, op: 'insert', payload }); return chain; };
      chain.then = (resolve, reject) =>
        Promise.resolve({ data: tableData[table] ?? null }).then(resolve, reject);
      return chain;
    },
  };
  return api;
}

const connectedCalendar = () => new Map([[
  'google-calendar',
  { id: 'c1', provider: 'google-calendar', status: 'connected', auth_kind: 'nango_oauth', nango_connection_id: 'nc_1', metadata: {} },
]]);

beforeEach(() => jest.clearAllMocks());

describe('runAgentTurn gating', () => {
  test('missing connection parks the call and texts a connect link', async () => {
    fakeLLM([toolCallResponse('calendar_book_event', {
      summary: 'Henderson regrout', date: '2026-06-12', start_time: '14:00',
    })]);

    const result = await runAgentTurn({
      phone: PHONE, user: USER, message: 'book henderson thursday 2pm',
      supabase: fakeSupabase(), connections: new Map(), userIntegrations: {},
    });

    expect(result.intent).toBe('AGENT_GATED');
    expect(result.reply).toContain('https://flynn.test/connect/google-calendar');
    expect(result.pendingAction).toMatchObject({
      status: 'awaiting_connection',
      required_provider: 'google-calendar',
      tool_name: 'calendar_book_event',
    });
    expect(result.pendingAction.tool_args.summary).toBe('Henderson regrout');
    expect(googleCalendar.insertEvent).not.toHaveBeenCalled();
  });

  test('irreversible tool parks as awaiting_confirmation, never executes', async () => {
    fakeLLM([toolCallResponse('xero_send_invoice', {
      client_name: 'Dave', amount_cents: 30000, description: 'regrout',
    })]);

    const result = await runAgentTurn({
      phone: PHONE, user: USER, message: 'invoice dave $300 for the regrout',
      supabase: fakeSupabase(), connections: new Map(),
      userIntegrations: { xero: { email: 'a@b.co', password: 'pw' } },
    });

    expect(result.intent).toBe('AGENT_CONFIRM');
    expect(result.reply).toContain('$300');
    expect(result.pendingAction.status).toBe('awaiting_confirmation');
    expect(result.pendingAction.tool_name).toBe('xero_send_invoice');
    expect(browserbase.xeroInvoice).not.toHaveBeenCalled();
  });

  test('connected reversible tool executes and the model writes the reply', async () => {
    fakeLLM([
      toolCallResponse('calendar_book_event', { summary: 'Henderson', date: '2026-06-12', start_time: '14:00' }),
      textResponse("done, henderson's in for thursday 2pm"),
    ]);

    const result = await runAgentTurn({
      phone: PHONE, user: USER, message: 'book henderson thursday 2pm',
      supabase: fakeSupabase(), connections: connectedCalendar(), userIntegrations: {},
    });

    expect(googleCalendar.insertEvent).toHaveBeenCalledTimes(1);
    expect(result.reply).toContain('henderson');
    expect(result.pendingAction).toBeUndefined();
  });

  test('books into Apple Calendar when the user is on iCloud (creds saved)', async () => {
    fakeLLM([
      toolCallResponse('calendar_book_event', { summary: 'Henderson', date: '2026-06-12', start_time: '14:00' }),
      textResponse('done, booked into your apple calendar'),
    ]);
    const result = await runAgentTurn({
      phone: PHONE, user: USER, message: 'book henderson thursday 2pm',
      supabase: fakeSupabase(), connections: new Map(),
      userIntegrations: { 'apple-calendar': { email: 'me@icloud.com', password: 'abcd-efgh-ijkl-mnop' } },
    });
    expect(appleCalendar.insertEvent).toHaveBeenCalledTimes(1);
    expect(googleCalendar.insertEvent).not.toHaveBeenCalled();
    expect(result.reply).toContain('apple');
  });

  test('apple-preference user with no creds gates for an iCloud app-specific password', async () => {
    fakeLLM([toolCallResponse('calendar_book_event', { summary: 'X', date: '2026-06-12', start_time: '14:00' })]);
    const result = await runAgentTurn({
      phone: PHONE, user: { ...USER, business_brain: { calendar_provider: 'apple' } },
      message: 'book it thursday 2pm', supabase: fakeSupabase(), connections: new Map(), userIntegrations: {},
    });
    expect(result.intent).toBe('AGENT_GATED');
    expect(result.reply.toLowerCase()).toContain('app-specific');
    expect(result.pendingAction.required_provider).toBe('apple-calendar');
    expect(appleCalendar.insertEvent).not.toHaveBeenCalled();
  });

  test('bad tool args are fed back, model recovers with text', async () => {
    fakeLLM([
      toolCallResponse('calendar_book_event', { summary: 'Henderson', date: 'thursday', start_time: '14:00' }),
      textResponse('what date works?'),
    ]);

    const result = await runAgentTurn({
      phone: PHONE, user: USER, message: 'book henderson in',
      supabase: fakeSupabase(), connections: connectedCalendar(), userIntegrations: {},
    });

    expect(googleCalendar.insertEvent).not.toHaveBeenCalled();
    expect(result.reply).toBe('what date works?');
  });

  test('plain text turn returns the reply untouched', async () => {
    fakeLLM([textResponse('gst on labour is 10%, so add $30')]);
    const result = await runAgentTurn({
      phone: PHONE, user: USER, message: 'how much gst on $300 of labour',
      supabase: fakeSupabase(), connections: new Map(), userIntegrations: {},
    });
    expect(result.reply).toContain('gst');
  });
});

describe('executePendingTool (the "yes" path)', () => {
  test('runs the parked tool deterministically', async () => {
    const reply = await executePendingTool({
      pendingAction: {
        tool_name: 'xero_send_invoice',
        tool_args: { client_name: 'Dave', amount_cents: 30000 },
      },
      phone: PHONE, user: USER, supabase: fakeSupabase(),
      connections: new Map(), userIntegrations: { xero: { email: 'a@b.co', password: 'pw' } },
    });

    expect(browserbase.xeroInvoice).toHaveBeenCalledTimes(1);
    expect(reply.toLowerCase()).toContain('invoice');
  });

  test('returns null for legacy rows so the caller falls back', async () => {
    const reply = await executePendingTool({
      pendingAction: { action_type: 'INVOICE' },
      phone: PHONE, user: USER, supabase: fakeSupabase(),
      connections: new Map(), userIntegrations: {},
    });
    expect(reply).toBeNull();
  });
});

describe('resumeParkedAction (after connect)', () => {
  const parkedBooking = {
    id: 'pa_1', user_phone: PHONE, status: 'awaiting_connection',
    required_provider: 'google-calendar', tool_name: 'calendar_book_event',
    tool_args: { summary: 'Henderson', date: '2026-06-12', start_time: '14:00' },
    confirmation_message: 'x',
  };

  test('reversible parked tool executes immediately, row deleted first', async () => {
    const supabase = fakeSupabase({
      pending: parkedBooking,
      connections: [{ provider: 'google-calendar', status: 'connected', nango_connection_id: 'nc_1', metadata: {} }],
    });

    const { handled, bubbles } = await resumeParkedAction(PHONE, 'google-calendar', supabase);

    expect(handled).toBe(true);
    expect(googleCalendar.insertEvent).toHaveBeenCalledTimes(1);
    expect(bubbles[0]).toContain('booked');
    const deleteIdx = supabase.calls.findIndex((c) => c.table === 'pending_actions' && c.op === 'delete');
    expect(deleteIdx).toBeGreaterThanOrEqual(0);
  });

  test('irreversible parked tool flips to awaiting_confirmation instead of running', async () => {
    const supabase = fakeSupabase({
      pending: {
        ...parkedBooking, tool_name: 'order_parts', required_provider: 'reece',
        tool_args: { items: [{ name: 'PVC pipe', qty: 20 }], supplier: 'reece' },
      },
      integrations: [{ integration_type: 'reece', credentials_encrypted: { email: 'a@b.co', password: 'pw' } }],
      connections: [{ provider: 'reece', status: 'connected', auth_kind: 'credentials_browserbase' }],
    });

    const { handled, bubbles } = await resumeParkedAction(PHONE, 'reece', supabase);

    expect(handled).toBe(true);
    expect(browserbase.supplierOrder).not.toHaveBeenCalled();
    expect(browserbase.reeceOrder).not.toHaveBeenCalled();
    expect(bubbles[0]).toContain('20x PVC pipe');
    const update = supabase.calls.find((c) => c.table === 'pending_actions' && c.op === 'update');
    expect(update.payload.status).toBe('awaiting_confirmation');
  });

  test('nothing parked: handled=false', async () => {
    const { handled } = await resumeParkedAction(PHONE, 'google-calendar', fakeSupabase());
    expect(handled).toBe(false);
  });
});

describe('reconcileNangoConnection (webhook-free completion)', () => {
  const parkedBooking = {
    id: 'pa_1', user_phone: PHONE, status: 'awaiting_connection',
    required_provider: 'google-calendar', tool_name: 'calendar_book_event',
    tool_args: { summary: 'Henderson', date: '2026-06-12', start_time: '14:00' },
    confirmation_message: 'x',
  };

  test('Nango reports connected: records the connection and resumes', async () => {
    nango.findConnectionId.mockResolvedValueOnce('nc_resolved');
    nango.getToken.mockResolvedValueOnce('fake-access-token');
    const supabase = fakeSupabase({ pending: parkedBooking });

    const { connected, bubbles } = await reconcileNangoConnection({
      supabase, user: USER, provider: 'google-calendar',
    });

    expect(connected).toBe(true);
    // connection_id is resolved by end user, then the token confirmed with it
    expect(nango.findConnectionId).toHaveBeenCalledWith('google-calendar', USER.id);
    expect(nango.getToken).toHaveBeenCalledWith('google-calendar', 'nc_resolved');
    expect(supabase.calls.some((c) => c.table === 'user_connections' && c.op === 'upsert')).toBe(true);
    expect(googleCalendar.insertEvent).toHaveBeenCalledTimes(1);
    expect(bubbles.join(' ')).toContain('booked');
  });

  test('Nango not connected yet: no-op', async () => {
    nango.findConnectionId.mockResolvedValueOnce(null);
    const supabase = fakeSupabase({ pending: parkedBooking });

    const { connected, bubbles } = await reconcileNangoConnection({
      supabase, user: USER, provider: 'google-calendar',
    });

    expect(connected).toBe(false);
    expect(bubbles).toEqual([]);
    expect(googleCalendar.insertEvent).not.toHaveBeenCalled();
  });
});

describe('tool registry', () => {
  test('every tool is always offered, with connection status annotated', () => {
    const ctx = { connections: new Map(), userIntegrations: {}, brain: {}, user: USER, phone: PHONE };
    const tools = registry.getOpenAITools(ctx);
    const names = tools.map((t) => t.function.name);
    expect(names).toEqual(expect.arrayContaining([
      'calendar_book_event', 'gmail_send_email', 'sheets_log_expense', 'xero_send_invoice', 'order_parts', 'save_login',
    ]));
    const calendarTool = tools.find((t) => t.function.name === 'calendar_book_event');
    expect(calendarTool.function.description).toContain('NOT connected');
  });

  test('remember merges facts into the brain and persists, blocking internal keys', async () => {
    const supabase = fakeSupabase();
    const ctx = {
      phone: PHONE, user: USER, supabase,
      connections: new Map(), userIntegrations: {},
      brain: { business_type: 'plumber' },
    };
    const entry = registry.findTool('remember');
    const outcome = await entry.tool.executor(ctx, {
      facts: { expense_destination: 'google_sheet', _connected_integrations: ['hacked'] },
    });

    expect(outcome.result).toContain('expense_destination');
    expect(outcome.result).not.toContain('_connected_integrations');
    expect(ctx.brain.expense_destination).toBe('google_sheet');
    expect(ctx.brain._connected_integrations).toBeUndefined();
    const update = supabase.calls.find((c) => c.table === 'users' && c.op === 'update');
    expect(update.payload.business_brain.expense_destination).toBe('google_sheet');
    expect(update.payload.business_brain._connected_integrations).toBeUndefined();
  });

  test('xero_log_expense: oauth connection counts, a browserbase xero login does not', () => {
    const cap = registry.findTool('xero_log_expense').capability;
    // OAuth row satisfies the expense capability
    const oauth = new Map([['xero', { id: 'x1', provider: 'xero', status: 'connected', auth_kind: 'nango_oauth', nango_connection_id: 'nc_x', metadata: {} }]]);
    expect(registry.connectionFor(cap, { connections: oauth, userIntegrations: {} }, {})).toBeTruthy();
    // A browserbase credential row under the same key must NOT satisfy it
    const cred = new Map([['xero', { id: 'x2', provider: 'xero', status: 'connected', auth_kind: 'credentials_browserbase' }]]);
    expect(registry.connectionFor(cap, { connections: cred, userIntegrations: { xero: { email: 'a@b.co' } } }, {})).toBeNull();
  });

  test('xero_log_expense posts a draft ACCPAY bill and caches the tenant id', async () => {
    nango.getToken.mockResolvedValue('xero-access-token');
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ tenantId: 'tenant-123' }] }) // GET /connections
      .mockResolvedValueOnce({ ok: true, json: async () => ({ Invoices: [{ InvoiceID: 'inv-1' }] }) }); // POST /Invoices
    const prevFetch = global.fetch;
    global.fetch = fetchMock;
    const supabase = fakeSupabase();
    const conn = { id: 'x1', provider: 'xero', status: 'connected', auth_kind: 'nango_oauth', nango_connection_id: 'nc_x', metadata: {} };
    const ctx = {
      phone: PHONE, user: USER, supabase, nango,
      connections: new Map([['xero', conn]]), userIntegrations: {},
      brain: {}, currency: 'AUD',
    };
    try {
      const outcome = await registry.findTool('xero_log_expense').tool.executor(ctx, {
        vendor: 'Bunnings', total_cents: 4400, gst_cents: 400, category: 'materials', date: '2026-06-13',
      });
      expect(outcome.userFacing).toContain('xero');
      const post = JSON.parse(fetchMock.mock.calls[1][1].body).Invoices[0];
      expect(post.Type).toBe('ACCPAY');
      expect(post.Status).toBe('DRAFT');
      expect(post.LineItems[0].UnitAmount).toBe('44.00');
      expect(fetchMock.mock.calls[1][1].headers['Xero-tenant-id']).toBe('tenant-123');
      // tenant id cached back onto the connection row
      expect(conn.metadata.xero_tenant_id).toBe('tenant-123');
    } finally {
      global.fetch = prevFetch;
    }
  });

  test('resolveSupplier prefers explicit ask, then connected, then brain', () => {
    const base = { connections: new Map(), userIntegrations: {}, brain: {} };
    expect(registry.resolveSupplier(base, { supplier: 'bunnings' })).toBe('bunnings');
    expect(registry.resolveSupplier({ ...base, userIntegrations: { reece: { email: 'x' } } }, {})).toBe('reece');
    expect(registry.resolveSupplier({ ...base, brain: { suppliers: ['Tradelink'] } }, {})).toBe('tradelink');
    expect(registry.resolveSupplier(base, {})).toBeNull();
  });
});
