/**
 * Tool registry — the capability map for Flynn's iMessage agent loop.
 *
 * Each capability binds a provider + auth kind to the tools it exposes to the
 * LLM. The agent loop (agentLoop.js) gates every tool call:
 *   - confirm:true tools park in pending_actions and wait for a "yes"
 *   - tools whose provider isn't connected park as awaiting_connection and the
 *     user gets a connect link (nango_oauth) or a login ask (browserbase)
 *
 * Executors are pure (ctx, args) -> { result, userFacing? }:
 *   result     short string fed back to the model as the tool result
 *   userFacing optional human sentence usable directly (resume-after-connect
 *              texts it without another LLM turn)
 *
 * ctx = { user, phone, supabase, connections (Map<provider, row>),
 *         userIntegrations (object), brain, nango, tz, currency }
 */

const browserbase = require('../browserbaseAgent');
const googleCalendar = require('../googleCalendar');

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1';
const SHEETS_BASE = 'https://sheets.googleapis.com/v4';

const SUPPLIER_SLUGS = ['reece', 'bunnings', 'tradelink', 'nhp', 'middy', 'rsea', 'neco', 'amazon'];

// Thrown by executors when args are unusable; the loop feeds the message back
// to the model so it re-asks instead of acting on garbage.
class ToolArgError extends Error {}

function timezoneFromPhone(phone = '') {
  if (phone.startsWith('+64')) return 'Pacific/Auckland';
  if (phone.startsWith('+44')) return 'Europe/London';
  if (phone.startsWith('+1')) return 'America/New_York';
  return 'Australia/Sydney';
}

// "2026-06-12" + "14:00" in an IANA tz -> RFC3339 with the correct offset for
// that date (DST-safe), e.g. "2026-06-12T14:00:00+10:00".
function isoInTz(date, time, tz) {
  const probe = new Date(`${date}T${time || '00:00'}:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
    .formatToParts(probe);
  const raw = (parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT+00:00').replace('GMT', '');
  const offset = raw === '' ? '+00:00' : raw;
  return `${date}T${time || '00:00'}:00${offset}`;
}

const requireArg = (args, key, hint) => {
  const v = args?.[key];
  if (v === null || v === undefined || v === '') {
    throw new ToolArgError(`missing ${key}${hint ? ` (${hint})` : ''} — ask the user`);
  }
  return v;
};

const assertDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new ToolArgError(`date "${s}" must be YYYY-MM-DD — re-ask or infer from today's date in your context`);
  return s;
};

const assertTime = (s) => {
  if (!/^\d{2}:\d{2}$/.test(s)) throw new ToolArgError(`time "${s}" must be 24h HH:MM`);
  return s;
};

const money = (cents, currency) => `${currency === 'GBP' ? '£' : '$'}${(Math.round(cents) / 100).toFixed(2).replace(/\.00$/, '')}`;

async function nangoToken(ctx, provider) {
  const conn = ctx.connections.get(provider);
  return ctx.nango.getToken(provider, conn?.nango_connection_id || ctx.user.id);
}

async function googleApi(token, url, { method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Google API ${method} ${url} failed (${res.status}): ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

async function checkAvailability(ctx, args) {
  const date = assertDate(requireArg(args, 'date', 'YYYY-MM-DD'));
  const days = Math.min(Math.max(Number(args.days) || 1, 1), 7);
  const token = await nangoToken(ctx, 'google-calendar');

  const timeMin = isoInTz(date, '00:00', ctx.tz);
  const end = new Date(`${date}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + days);
  const timeMax = isoInTz(end.toISOString().slice(0, 10), '00:00', ctx.tz);

  const busy = await googleCalendar.queryFreeBusy(token, { timeMin, timeMax });
  if (!busy.length) return { result: `calendar is completely free ${date}${days > 1 ? ` for ${days} days` : ''}` };
  const lines = busy.map((b) => {
    const fmt = (iso) => new Date(iso).toLocaleString('en-AU', { timeZone: ctx.tz, weekday: 'short', hour: 'numeric', minute: '2-digit' });
    return `${fmt(b.start)} to ${fmt(b.end)}`;
  });
  return { result: `busy blocks: ${lines.join('; ')}. everything else is free` };
}

async function bookEvent(ctx, args) {
  const date = assertDate(requireArg(args, 'date', 'YYYY-MM-DD'));
  const startTime = assertTime(requireArg(args, 'start_time', '24h HH:MM'));
  const summary = requireArg(args, 'summary', 'short event title, e.g. "Henderson regrout"');
  const durationMins = Math.min(Math.max(Number(args.duration_mins) || 60, 15), 12 * 60);

  const startISO = isoInTz(date, startTime, ctx.tz);
  const endDate = new Date(startISO);
  endDate.setMinutes(endDate.getMinutes() + durationMins);
  const endISO = endDate.toISOString();

  const token = await nangoToken(ctx, 'google-calendar');
  const event = await googleCalendar.insertEvent(token, {
    summary,
    description: [args.client_name && `Client: ${args.client_name}`, args.notes].filter(Boolean).join('\n'),
    startISO,
    endISO,
    timeZone: ctx.tz,
    location: args.location,
  });

  const when = new Date(startISO).toLocaleString('en-AU', { timeZone: ctx.tz, weekday: 'long', hour: 'numeric', minute: '2-digit' });
  return {
    result: `booked "${summary}" ${date} ${startTime} (${durationMins}min), event id ${event.id}`,
    userFacing: `booked ${args.client_name || summary} in for ${when.toLowerCase()}`,
  };
}

// ---------------------------------------------------------------------------
// Gmail
// ---------------------------------------------------------------------------

async function findEmails(ctx, args) {
  const query = requireArg(args, 'query', 'gmail search query, e.g. from:dave OR "quote"');
  const max = Math.min(Math.max(Number(args.max_results) || 5, 1), 10);
  const token = await nangoToken(ctx, 'google-mail');

  const list = await googleApi(token, `${GMAIL_BASE}/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${max}`);
  const ids = (list.messages || []).map((m) => m.id);
  if (!ids.length) return { result: `no emails match "${query}"` };

  const summaries = [];
  for (const id of ids) {
    const msg = await googleApi(token, `${GMAIL_BASE}/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);
    const header = (name) => msg.payload?.headers?.find((h) => h.name === name)?.value || '';
    summaries.push(`[${id}] from ${header('From')} | ${header('Subject')} | ${header('Date')} | ${msg.snippet || ''}`);
  }
  return { result: summaries.join('\n') };
}

async function sendEmail(ctx, args) {
  const to = requireArg(args, 'to', 'recipient email address');
  const subject = requireArg(args, 'subject');
  const body = requireArg(args, 'body', 'plain-text email body');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new ToolArgError(`"${to}" is not a valid email address — ask the user for it`);

  const token = await nangoToken(ctx, 'google-mail');
  const raw = Buffer.from(`To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`)
    .toString('base64url');
  await googleApi(token, `${GMAIL_BASE}/users/me/messages/send`, { method: 'POST', body: { raw } });
  return { result: `email sent to ${to}`, userFacing: `sent the email to ${to}` };
}

// ---------------------------------------------------------------------------
// Expenses (Google Sheets)
// ---------------------------------------------------------------------------

async function logExpense(ctx, args) {
  const vendor = requireArg(args, 'vendor', 'who the money went to');
  const totalCents = Number(requireArg(args, 'total_cents', 'integer cents'));
  if (!Number.isFinite(totalCents) || totalCents <= 0) throw new ToolArgError('total_cents must be a positive integer');
  const date = assertDate(args.date || new Date().toISOString().slice(0, 10));

  const token = await nangoToken(ctx, 'google-sheet');
  const conn = ctx.connections.get('google-sheet');
  let spreadsheetId = conn?.metadata?.expenses_spreadsheet_id;
  let created = false;
  let sheetUrl = conn?.metadata?.expenses_spreadsheet_url;

  if (!spreadsheetId) {
    const sheet = await googleApi(token, `${SHEETS_BASE}/spreadsheets`, {
      method: 'POST',
      body: { properties: { title: 'Flynn expenses' }, sheets: [{ properties: { title: 'Expenses' } }] },
    });
    spreadsheetId = sheet.spreadsheetId;
    sheetUrl = sheet.spreadsheetUrl;
    created = true;
    await googleApi(token, `${SHEETS_BASE}/spreadsheets/${spreadsheetId}/values/Expenses!A1:F1?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: { values: [['Date', 'Vendor', 'Description', 'Category', 'GST', 'Total']] },
    });
    if (conn) {
      await ctx.supabase
        .from('user_connections')
        .update({
          metadata: { ...(conn.metadata || {}), expenses_spreadsheet_id: spreadsheetId, expenses_spreadsheet_url: sheetUrl },
          updated_at: new Date().toISOString(),
        })
        .eq('id', conn.id);
      conn.metadata = { ...(conn.metadata || {}), expenses_spreadsheet_id: spreadsheetId, expenses_spreadsheet_url: sheetUrl };
    }
  }

  const gst = Number(args.gst_cents);
  await googleApi(token, `${SHEETS_BASE}/spreadsheets/${spreadsheetId}/values/Expenses!A:F:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    body: {
      values: [[
        date,
        vendor,
        args.description || '',
        args.category || '',
        Number.isFinite(gst) && gst > 0 ? (gst / 100).toFixed(2) : '',
        (totalCents / 100).toFixed(2),
      ]],
    },
  });

  const amount = money(totalCents, ctx.currency);
  const tail = created && sheetUrl ? `. made you a sheet for them: ${sheetUrl}` : '';
  return {
    result: `expense logged: ${date} ${vendor} ${amount}${created ? ' (new spreadsheet created)' : ''}`,
    userFacing: `logged ${amount} from ${vendor.toLowerCase()} to your expenses sheet${tail}`,
  };
}

// ---------------------------------------------------------------------------
// Browserbase-backed (Xero invoicing, supplier orders)
// ---------------------------------------------------------------------------

async function xeroSendInvoice(ctx, args) {
  const clientName = requireArg(args, 'client_name');
  const amountCents = Number(requireArg(args, 'amount_cents', 'integer cents'));
  if (!Number.isFinite(amountCents) || amountCents <= 0) throw new ToolArgError('amount_cents must be a positive integer');
  const creds = ctx.userIntegrations.xero;
  if (!creds?.email || !creds?.password) throw new ToolArgError('no xero login on file — ask for their xero email and password, then call save_login');

  await browserbase.xeroInvoice(creds, {
    clientName,
    clientEmail: args.client_email,
    description: args.description,
    amountCents,
    date: args.date,
  });
  const amount = money(amountCents, ctx.currency);
  return {
    result: `xero invoice for ${amount} sent to ${clientName}`,
    userFacing: `invoice for ${amount} is away to ${clientName.toLowerCase()}`,
  };
}

function resolveSupplier(ctx, args = {}) {
  const wanted = (args.supplier || '').toLowerCase().trim();
  if (wanted && SUPPLIER_SLUGS.includes(wanted)) return wanted;
  const connected = SUPPLIER_SLUGS.find((s) => ctx.connections.get(s)?.status === 'connected' || ctx.userIntegrations[s]?.email);
  if (connected) return connected;
  const fromBrain = (ctx.brain?.suppliers || [])
    .map((s) => String(s).toLowerCase().trim())
    .find((s) => SUPPLIER_SLUGS.includes(s));
  return fromBrain || null;
}

async function orderParts(ctx, args) {
  const items = args.items;
  if (!Array.isArray(items) || !items.length) throw new ToolArgError('items must be a non-empty array of {name, qty}');
  const slug = resolveSupplier(ctx, args);
  if (!slug) throw new ToolArgError('no supplier known — ask which supplier they order from (reece, bunnings, tradelink, ...)');
  const creds = ctx.userIntegrations[slug];
  if (!creds?.email) throw new ToolArgError(`no ${slug} login on file — ask for their ${slug} email and password, then call save_login`);

  const result = await browserbase.supplierOrder(slug, creds, items);
  const total = result?.cartTotal ? ` cart total ${result.cartTotal}` : '';
  return {
    result: `order placed at ${slug}: ${items.map((i) => `${i.qty || 1}x ${i.name}`).join(', ')}.${total}`,
    userFacing: `order's in at ${slug}${total ? `,${total.toLowerCase()}` : ''}. confirmation will come from them`,
  };
}

// ---------------------------------------------------------------------------
// Credential capture (always available — lets the model save supplier/Xero
// logins the user texts, which also unblocks any parked action)
// ---------------------------------------------------------------------------

async function saveLogin(ctx, args) {
  const provider = (requireArg(args, 'provider') || '').toLowerCase().trim();
  const email = requireArg(args, 'email');
  const password = requireArg(args, 'password');
  const known = new Set(['xero', ...SUPPLIER_SLUGS]);
  if (!known.has(provider)) throw new ToolArgError(`unknown provider "${provider}" — must be one of: xero, ${SUPPLIER_SLUGS.join(', ')}`);

  const now = new Date().toISOString();
  await ctx.supabase.from('user_integrations').upsert({
    user_phone: ctx.phone,
    integration_type: provider,
    credentials_encrypted: { email, password },
    connected_at: now,
    updated_at: now,
  }, { onConflict: 'user_phone,integration_type' });
  await ctx.supabase.from('user_connections').upsert({
    user_id: ctx.user?.id || null,
    user_phone: ctx.phone,
    provider,
    auth_kind: 'credentials_browserbase',
    status: 'connected',
    connected_at: now,
    updated_at: now,
  }, { onConflict: 'user_phone,provider' });

  ctx.userIntegrations[provider] = { email, password };
  ctx.connections.set(provider, { user_phone: ctx.phone, provider, auth_kind: 'credentials_browserbase', status: 'connected' });
  return { result: `${provider} login saved`, userFacing: `${provider} login saved`, connectedProvider: provider };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const CAPABILITIES = [
  {
    capability: 'calendar',
    provider: 'google-calendar',
    auth_kind: 'nango_oauth',
    label: 'Google Calendar',
    connectBlurb: 'your calendar',
    tools: [
      {
        name: 'calendar_check_availability',
        confirm: false,
        description: "Check busy/free blocks on the user's Google Calendar from a date.",
        parameters: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'start date, YYYY-MM-DD' },
            days: { type: 'number', description: 'how many days to check, default 1, max 7' },
          },
          required: ['date'],
        },
        executor: checkAvailability,
      },
      {
        name: 'calendar_book_event',
        confirm: false,
        description: "Book a job/appointment into the user's Google Calendar.",
        parameters: {
          type: 'object',
          properties: {
            summary: { type: 'string', description: 'short title, e.g. "Henderson regrout"' },
            date: { type: 'string', description: 'YYYY-MM-DD' },
            start_time: { type: 'string', description: '24h HH:MM' },
            duration_mins: { type: 'number', description: 'default 60' },
            client_name: { type: 'string' },
            location: { type: 'string' },
            notes: { type: 'string' },
          },
          required: ['summary', 'date', 'start_time'],
        },
        executor: bookEvent,
      },
    ],
  },
  {
    capability: 'email',
    provider: 'google-mail',
    auth_kind: 'nango_oauth',
    label: 'Gmail',
    connectBlurb: 'your gmail',
    tools: [
      {
        name: 'gmail_find_emails',
        confirm: false,
        description: "Search the user's Gmail and return sender/subject/snippet summaries.",
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'gmail search syntax, e.g. from:dave newer_than:7d' },
            max_results: { type: 'number', description: 'default 5, max 10' },
          },
          required: ['query'],
        },
        executor: findEmails,
      },
      {
        name: 'gmail_send_email',
        confirm: true,
        description: "Send an email from the user's Gmail. Irreversible, so the user is asked to confirm first.",
        parameters: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'recipient email address' },
            subject: { type: 'string' },
            body: { type: 'string', description: 'plain text body, written in the user\'s voice' },
          },
          required: ['to', 'subject', 'body'],
        },
        executor: sendEmail,
        confirmMessage: (args) => `sending "${args.subject}" to ${args.to}. want me to fire it off?`,
      },
    ],
  },
  {
    capability: 'expenses',
    provider: 'google-sheet',
    auth_kind: 'nango_oauth',
    label: 'Google Sheets',
    connectBlurb: 'a google sheet for your expenses',
    tools: [
      {
        name: 'sheets_log_expense',
        confirm: false,
        description: "Log an expense/receipt row to the user's expenses spreadsheet (created automatically the first time).",
        parameters: {
          type: 'object',
          properties: {
            vendor: { type: 'string', description: 'who was paid, e.g. Bunnings' },
            date: { type: 'string', description: 'YYYY-MM-DD, default today' },
            total_cents: { type: 'number', description: 'total paid in integer cents' },
            gst_cents: { type: 'number', description: 'GST portion in integer cents if known' },
            category: { type: 'string', description: 'e.g. materials, fuel, tools' },
            description: { type: 'string' },
          },
          required: ['vendor', 'total_cents'],
        },
        executor: logExpense,
      },
    ],
  },
  {
    capability: 'invoicing',
    provider: 'xero',
    auth_kind: 'credentials_browserbase',
    label: 'Xero',
    connectBlurb: 'your xero login',
    tools: [
      {
        name: 'xero_send_invoice',
        confirm: true,
        description: 'Create and email an invoice from the user\'s Xero account. Irreversible, so the user is asked to confirm first.',
        parameters: {
          type: 'object',
          properties: {
            client_name: { type: 'string' },
            client_email: { type: 'string' },
            description: { type: 'string', description: 'what the invoice is for' },
            amount_cents: { type: 'number', description: 'integer cents' },
            date: { type: 'string', description: 'YYYY-MM-DD' },
          },
          required: ['client_name', 'amount_cents'],
        },
        executor: xeroSendInvoice,
        confirmMessage: (args, ctx) => `i'll send ${args.client_name} an invoice for ${money(args.amount_cents, ctx?.currency)}${args.description ? ` for ${args.description}` : ''}. sound right?`,
      },
    ],
  },
  {
    capability: 'supplies',
    provider: null, // resolved per-call from the user's supplier
    auth_kind: 'credentials_browserbase',
    label: 'supplier account',
    connectBlurb: 'your supplier login',
    dynamicProvider: resolveSupplier,
    tools: [
      {
        name: 'order_parts',
        confirm: true,
        description: "Order parts/materials from the user's trade supplier account (Reece, Bunnings, Tradelink, ...). Costs money, so the user is asked to confirm first.",
        parameters: {
          type: 'object',
          properties: {
            supplier: { type: 'string', description: 'supplier slug if the user named one' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  qty: { type: 'number' },
                  product_code: { type: 'string' },
                },
                required: ['name'],
              },
            },
          },
          required: ['items'],
        },
        executor: orderParts,
        confirmMessage: (args) => {
          const list = (args.items || []).map((i) => `${i.qty || 1}x ${i.name}`).join(', ');
          return `ordering ${list}${args.supplier ? ` from ${args.supplier}` : ''}. good to go?`;
        },
      },
    ],
  },
  {
    capability: 'credentials',
    provider: null,
    auth_kind: 'none',
    label: 'logins',
    tools: [
      {
        name: 'save_login',
        confirm: false,
        description: 'Save a login the user just texted (email + password) for xero or a supplier account. Call this whenever the user provides credentials.',
        parameters: {
          type: 'object',
          properties: {
            provider: { type: 'string', description: `one of: xero, ${SUPPLIER_SLUGS.join(', ')}` },
            email: { type: 'string' },
            password: { type: 'string' },
          },
          required: ['provider', 'email', 'password'],
        },
        executor: saveLogin,
      },
    ],
  },
];

const TOOL_INDEX = new Map();
for (const cap of CAPABILITIES) {
  for (const tool of cap.tools) TOOL_INDEX.set(tool.name, { capability: cap, tool });
}

function findTool(name) {
  return TOOL_INDEX.get(name) || null;
}

/**
 * Resolve the provider a capability needs for this call (handles dynamic
 * supplier resolution). Returns a slug, or null when it can't be determined.
 */
function providerFor(capability, ctx, args) {
  if (capability.dynamicProvider) return capability.dynamicProvider(ctx, args);
  return capability.provider;
}

/**
 * The connected user_connections row for this capability+call, or null.
 */
function connectionFor(capability, ctx, args) {
  if (capability.auth_kind === 'none') return { status: 'connected' };
  const provider = providerFor(capability, ctx, args);
  if (!provider) return null;
  const row = ctx.connections.get(provider);
  if (row?.status === 'connected') return row;
  // Browserbase creds saved before user_connections existed still count.
  if (capability.auth_kind === 'credentials_browserbase' && ctx.userIntegrations[provider]?.email) {
    return { provider, status: 'connected', auth_kind: 'credentials_browserbase' };
  }
  return null;
}

/**
 * OpenAI tools array for the LLM. Every tool is always offered — a gated call
 * is itself the integration prompt — with connection status annotated so the
 * model can set expectations ("i'll need your calendar connected first").
 */
function getOpenAITools(ctx) {
  const tools = [];
  for (const cap of CAPABILITIES) {
    let note = '';
    if (cap.auth_kind !== 'none') {
      const connected = Boolean(connectionFor(cap, ctx, {}));
      note = connected
        ? ` (${cap.label} is connected)`
        : ` (${cap.label} is NOT connected yet — calling this anyway is fine: the user will be texted a quick connect link and the action runs right after they connect)`;
    }
    for (const tool of cap.tools) {
      tools.push({
        type: 'function',
        function: {
          name: tool.name,
          description: `${tool.description}${note}`,
          parameters: tool.parameters,
        },
      });
    }
  }
  return tools;
}

module.exports = {
  CAPABILITIES,
  ToolArgError,
  findTool,
  providerFor,
  connectionFor,
  getOpenAITools,
  timezoneFromPhone,
  resolveSupplier,
};
