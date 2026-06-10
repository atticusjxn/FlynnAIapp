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
  proxy: jest.fn(),
  createConnectSession: jest.fn(),
}));
jest.mock('../services/googleCalendar', () => ({
  queryFreeBusy: jest.fn(async () => []),
  insertEvent: jest.fn(async () => ({ id: 'evt_1' })),
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
const browserbase = require('../services/browserbaseAgent');
const { runAgentTurn, executePendingTool, resumeParkedAction } = require('../services/agent/agentLoop');
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

  test('resolveSupplier prefers explicit ask, then connected, then brain', () => {
    const base = { connections: new Map(), userIntegrations: {}, brain: {} };
    expect(registry.resolveSupplier(base, { supplier: 'bunnings' })).toBe('bunnings');
    expect(registry.resolveSupplier({ ...base, userIntegrations: { reece: { email: 'x' } } }, {})).toBe('reece');
    expect(registry.resolveSupplier({ ...base, brain: { suppliers: ['Tradelink'] } }, {})).toBe('tradelink');
    expect(registry.resolveSupplier(base, {})).toBeNull();
  });
});
