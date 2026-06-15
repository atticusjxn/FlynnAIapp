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
const appleCalendar = require('../appleCalendar');
const xeroReceivables = require('../xeroReceivables');
const imapEmail = require('../imapEmail');

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1';
const SHEETS_BASE = 'https://sheets.googleapis.com/v4';
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

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

// Microsoft Graph (Outlook mail). Same shape as googleApi; token from Nango via
// nangoToken(ctx, 'outlook'). Used for the Microsoft 365 / Outlook mail tools.
async function graphApi(token, url, { method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(method === 'GET' ? { ConsistencyLevel: 'eventual' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Graph API ${method} ${url} failed (${res.status}): ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  // sendMail returns 202 with no body
  if (res.status === 202 || res.status === 204) return {};
  return res.json();
}

// Xero accounting API. Mirrors googleApi (token from Nango via nangoToken), plus
// the Xero-tenant-id header that scopes every call to one organisation.
const XERO_API = 'https://api.xero.com/api.xro/2.0';

async function xeroApi(token, url, { method = 'GET', body, tenantId } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(tenantId ? { 'Xero-tenant-id': tenantId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Xero API ${method} ${url} failed (${res.status}): ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Receipt category -> Xero chart-of-accounts code. Defaults are the common
// Xero demo-org expense codes; a wrong code just files under the fallback, it
// never fails the call. Override the fallback with FLYNN_XERO_DEFAULT_ACCOUNT_CODE.
const XERO_EXPENSE_ACCOUNTS = {
  materials: '310', // Cost of Goods Sold
  fuel: '449',
  vehicle: '449',
  tools: '711',
  office: '453',
  food: '420',
};

// ---------------------------------------------------------------------------
// Calendar — dual provider: Google (OAuth) or Apple/iCloud (CalDAV)
// ---------------------------------------------------------------------------

// Which calendar this user is on. Connected wins; then a remembered preference
// (brain.calendar_provider, set via the remember tool when they say they use
// Apple/iCloud); else default to Google.
function resolveCalendarProvider(ctx, args) {
  const appleConnected = ctx.connections.get('apple-calendar')?.status === 'connected'
    || Boolean(ctx.userIntegrations['apple-calendar']?.email);
  if (appleConnected) return 'apple-calendar';
  if (ctx.connections.get('google-calendar')?.status === 'connected') return 'google-calendar';
  const pref = String(ctx.brain?.calendar_provider || '').toLowerCase();
  if (pref === 'apple' || pref === 'apple-calendar' || pref === 'icloud') return 'apple-calendar';
  return 'google-calendar';
}

// Auth kind keyed off the resolved provider (calendar mixes nango + creds), so
// gating doesn't depend on a single per-capability auth_kind.
function authKindFor(provider, capability) {
  if (provider === 'apple-calendar') return 'credentials_apple';
  if (provider === 'imap-email') return 'credentials_imap';
  if (provider === 'outlook') return 'nango_oauth';
  if (typeof provider === 'string' && provider.startsWith('google-')) return 'nango_oauth';
  return capability?.auth_kind || 'credentials_browserbase';
}

// Which mail provider this user is on. Connected wins (outlook > gmail > imap);
// then a remembered preference (brain.email_provider, set via remember when they
// say "I use outlook" / "bigpond"); else default to Gmail (the largest slice).
// Mirrors resolveCalendarProvider so the agent calls one set of email tools and
// Flynn routes to the right backend.
function resolveMailProvider(ctx) {
  if (ctx.connections.get('outlook')?.status === 'connected') return 'outlook';
  if (ctx.connections.get('google-mail')?.status === 'connected') return 'google-mail';
  if (ctx.userIntegrations['imap-email']?.email
    || ctx.connections.get('imap-email')?.status === 'connected') return 'imap-email';
  const pref = String(ctx.brain?.email_provider || '').toLowerCase();
  if (pref === 'outlook' || pref === 'microsoft' || pref === 'office365' || pref === 'hotmail') return 'outlook';
  if (pref === 'gmail' || pref === 'google') return 'google-mail';
  if (pref && pref !== 'gmail' && pref !== 'google') {
    // a named non-Google/Microsoft provider (bigpond, icloud, optus, a host domain)
    if (pref !== 'outlook' && pref !== 'microsoft') return 'imap-email';
  }
  return 'google-mail';
}

async function checkAvailability(ctx, args) {
  const date = assertDate(requireArg(args, 'date', 'YYYY-MM-DD'));
  const days = Math.min(Math.max(Number(args.days) || 1, 1), 7);

  const timeMin = isoInTz(date, '00:00', ctx.tz);
  const end = new Date(`${date}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + days);
  const timeMax = isoInTz(end.toISOString().slice(0, 10), '00:00', ctx.tz);

  const provider = resolveCalendarProvider(ctx, args);
  const busy = provider === 'apple-calendar'
    ? await appleCalendar.queryFreeBusy(ctx.userIntegrations['apple-calendar'], { timeMin, timeMax })
    : await googleCalendar.queryFreeBusy(await nangoToken(ctx, 'google-calendar'), { timeMin, timeMax });
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
  const description = [args.client_name && `Client: ${args.client_name}`, args.notes].filter(Boolean).join('\n');

  const provider = resolveCalendarProvider(ctx, args);
  const event = provider === 'apple-calendar'
    ? await appleCalendar.insertEvent(ctx.userIntegrations['apple-calendar'], { summary, description, startISO, endISO, location: args.location })
    : await googleCalendar.insertEvent(await nangoToken(ctx, 'google-calendar'), { summary, description, startISO, endISO, timeZone: ctx.tz, location: args.location });

  const when = new Date(startISO).toLocaleString('en-AU', { timeZone: ctx.tz, weekday: 'long', hour: 'numeric', minute: '2-digit' });
  return {
    result: `booked "${summary}" ${date} ${startTime} (${durationMins}min), event id ${event.id}`,
    userFacing: `booked ${args.client_name || summary} in for ${when.toLowerCase()}`,
  };
}

// ---------------------------------------------------------------------------
// Email — one capability over three backends, resolved per call by
// resolveMailProvider: Gmail (OAuth), Outlook/Microsoft 365 (Graph OAuth), or
// IMAP/SMTP for the AU long tail (Bigpond, Optus, iCloud, host mailboxes).
// ---------------------------------------------------------------------------

async function findEmails(ctx, args) {
  const query = requireArg(args, 'query', 'search query, e.g. from:dave OR "quote"');
  const max = Math.min(Math.max(Number(args.max_results) || 5, 1), 10);
  const provider = resolveMailProvider(ctx);

  if (provider === 'outlook') {
    const token = await nangoToken(ctx, 'outlook');
    const url = `${GRAPH_BASE}/me/messages?$search=${encodeURIComponent(`"${query}"`)}&$top=${max}&$select=from,subject,receivedDateTime,bodyPreview`;
    const list = await graphApi(token, url);
    const msgs = list.value || [];
    if (!msgs.length) return { result: `no emails match "${query}"` };
    return { result: msgs.map((m) => `from ${m.from?.emailAddress?.address || '?'} | ${m.subject || '(no subject)'} | ${(m.receivedDateTime || '').slice(0, 10)} | ${m.bodyPreview || ''}`).join('\n') };
  }

  if (provider === 'imap-email') {
    const creds = ctx.userIntegrations['imap-email'];
    if (!creds?.email) throw new ToolArgError('no email login on file — ask for their email address and app password, then call save_login with provider imap-email');
    const lines = await imapEmail.findEmails({ email: creds.email, password: creds.password, query, max });
    if (!lines.length) return { result: `no emails match "${query}"` };
    return { result: lines.join('\n') };
  }

  // Gmail (default)
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
  const provider = resolveMailProvider(ctx);

  if (provider === 'outlook') {
    const token = await nangoToken(ctx, 'outlook');
    await graphApi(token, `${GRAPH_BASE}/me/sendMail`, {
      method: 'POST',
      body: {
        message: {
          subject,
          body: { contentType: 'Text', content: body },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: true,
      },
    });
    return { result: `email sent to ${to} via outlook`, userFacing: `sent the email to ${to}` };
  }

  if (provider === 'imap-email') {
    const creds = ctx.userIntegrations['imap-email'];
    if (!creds?.email) throw new ToolArgError('no email login on file — ask for their email address and app password, then call save_login with provider imap-email');
    await imapEmail.sendEmail({ email: creds.email, password: creds.password, to, subject, body });
    return { result: `email sent to ${to} from ${creds.email}`, userFacing: `sent the email to ${to}` };
  }

  // Gmail (default)
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
// Timesheets (Google Sheets) — log a worker's hours. Same append pattern as
// expenses, to a separate "Flynn timesheets" sheet. A common ask once Flynn is
// watching a team group chat ("Jack worked 6h Friday").
// ---------------------------------------------------------------------------

async function logTimesheet(ctx, args) {
  const worker = requireArg(args, 'worker', 'whose hours these are');
  const hours = Number(requireArg(args, 'hours', 'hours worked, e.g. 6'));
  if (!Number.isFinite(hours) || hours <= 0) throw new ToolArgError('hours must be a positive number');
  const date = assertDate(args.date || new Date().toISOString().slice(0, 10));

  const token = await nangoToken(ctx, 'google-sheet');
  const conn = ctx.connections.get('google-sheet');
  let spreadsheetId = conn?.metadata?.timesheets_spreadsheet_id;
  let created = false;
  let sheetUrl = conn?.metadata?.timesheets_spreadsheet_url;

  if (!spreadsheetId) {
    const sheet = await googleApi(token, `${SHEETS_BASE}/spreadsheets`, {
      method: 'POST',
      body: { properties: { title: 'Flynn timesheets' }, sheets: [{ properties: { title: 'Timesheets' } }] },
    });
    spreadsheetId = sheet.spreadsheetId;
    sheetUrl = sheet.spreadsheetUrl;
    created = true;
    await googleApi(token, `${SHEETS_BASE}/spreadsheets/${spreadsheetId}/values/Timesheets!A1:E1?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: { values: [['Date', 'Worker', 'Hours', 'Job', 'Rate']] },
    });
    if (conn) {
      const metadata = { ...(conn.metadata || {}), timesheets_spreadsheet_id: spreadsheetId, timesheets_spreadsheet_url: sheetUrl };
      await ctx.supabase
        .from('user_connections')
        .update({ metadata, updated_at: new Date().toISOString() })
        .eq('id', conn.id);
      conn.metadata = metadata;
    }
  }

  const rate = Number(args.rate_cents);
  await googleApi(token, `${SHEETS_BASE}/spreadsheets/${spreadsheetId}/values/Timesheets!A:E:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    body: {
      values: [[
        date,
        worker,
        hours,
        args.job || '',
        Number.isFinite(rate) && rate > 0 ? (rate / 100).toFixed(2) : '',
      ]],
    },
  });

  const tail = created && sheetUrl ? `. made you a timesheets sheet: ${sheetUrl}` : '';
  return {
    result: `timesheet logged: ${date} ${worker} ${hours}h${created ? ' (new spreadsheet created)' : ''}`,
    userFacing: `logged ${hours}h for ${worker.toLowerCase()}${args.job ? ` on ${args.job}` : ''}${tail}`,
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

// Record a receipt as a DRAFT bill (ACCPAY) in Xero via the API. Draft is the
// safety gate: it lands in the user's Xero for review before it hits the books,
// so this is confirm:false and batches cleanly across many receipts.
async function xeroLogExpense(ctx, args) {
  const vendor = requireArg(args, 'vendor', 'who was paid');
  const totalCents = Number(requireArg(args, 'total_cents', 'integer cents'));
  if (!Number.isFinite(totalCents) || totalCents <= 0) throw new ToolArgError('total_cents must be a positive integer');
  const date = assertDate(args.date || new Date().toISOString().slice(0, 10));

  const token = await nangoToken(ctx, 'xero');
  const conn = ctx.connections.get('xero');

  // Tenant id (which Xero org). Fetched once from the identity endpoint, then
  // cached on the connection row so later receipts skip the round-trip.
  let tenantId = conn?.metadata?.xero_tenant_id;
  if (!tenantId) {
    const orgs = await xeroApi(token, 'https://api.xero.com/connections');
    tenantId = Array.isArray(orgs) ? orgs[0]?.tenantId : null;
    if (!tenantId) throw new ToolArgError('no xero organisation found on this login');
    if (conn && ctx.supabase) {
      const metadata = { ...(conn.metadata || {}), xero_tenant_id: tenantId };
      await ctx.supabase
        .from('user_connections')
        .update({ metadata, updated_at: new Date().toISOString() })
        .eq('id', conn.id);
      conn.metadata = metadata;
    }
  }

  const gst = Number(args.gst_cents);
  const accountCode = XERO_EXPENSE_ACCOUNTS[String(args.category || '').toLowerCase()]
    || process.env.FLYNN_XERO_DEFAULT_ACCOUNT_CODE || '400';

  const invoice = {
    Type: 'ACCPAY', // a bill: money the user owes a supplier
    Contact: { Name: vendor },
    Date: date,
    DueDate: date,
    LineAmountTypes: 'Inclusive', // the total already includes GST
    LineItems: [{
      Description: args.description || args.category || 'Expense',
      Quantity: 1,
      UnitAmount: (totalCents / 100).toFixed(2),
      AccountCode: accountCode,
      ...(Number.isFinite(gst) && gst > 0 ? { TaxAmount: (gst / 100).toFixed(2) } : {}),
    }],
    Status: 'DRAFT',
  };

  const res = await xeroApi(token, `${XERO_API}/Invoices`, {
    method: 'POST',
    body: { Invoices: [invoice] },
    tenantId,
  });
  const inv = res?.Invoices?.[0];
  const amount = money(totalCents, ctx.currency);
  return {
    result: `xero draft bill ${inv?.InvoiceID || ''} created: ${date} ${vendor} ${amount}`,
    userFacing: `filed ${amount} from ${vendor.toLowerCase()} into xero as a draft bill`,
  };
}

async function xeroListInvoices(ctx, args = {}) {
  const connectionRow = ctx.connections.get('xero');
  if (!connectionRow?.nango_connection_id) throw new ToolArgError('xero not connected');
  const onlyOverdue = args.only_overdue !== false; // default to overdue-only
  const rows = await xeroReceivables.listOutstandingInvoices({ connectionRow, supabase: ctx.supabase, onlyOverdue });
  if (!rows.length) {
    return { result: 'no outstanding invoices', userFacing: onlyOverdue ? "nothing overdue, you're all paid up" : 'nothing outstanding right now' };
  }
  const total = rows.reduce((s, r) => s + r.amountDueCents, 0);
  const lines = rows.slice(0, 8).map((r) => `${r.contactName} ${money(r.amountDueCents, r.currency || ctx.currency)}${r.daysOverdue > 0 ? ` (${r.daysOverdue}d overdue)` : ''}`);
  return {
    result: `${rows.length} outstanding totalling ${money(total, ctx.currency)}: ${lines.join('; ')}`,
    userFacing: `you've got ${rows.length} unpaid totalling ${money(total, ctx.currency)}:\n${lines.join('\n')}`,
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
// Quotes — phone-keyed quote tracking (agent_quotes). Flynn drafts the quote
// the operator sends to their client AND records it so the chaser can nudge
// them to follow it up when it goes cold. Stored in our own DB, so never gated
// on a third-party connection (auth_kind: none).
// ---------------------------------------------------------------------------

const QUOTE_DEFAULT_VALID_DAYS = 14;
const QUOTE_FIRST_FOLLOWUP_DAYS = 3;

function formatQuote(ctx, { clientName, lineItems, description, amountCents, validDays }) {
  const business = ctx.brain?.business_name || ctx.brain?.business_type || 'us';
  const body = Array.isArray(lineItems) && lineItems.length
    ? lineItems.map((li) => {
      const amt = Number(li.amount_cents);
      return `- ${li.description || 'item'}${Number.isFinite(amt) && amt > 0 ? `  ${money(amt, ctx.currency)}` : ''}`;
    }).join('\n')
    : (description || '');
  return [
    `Quote from ${business}`,
    `For: ${clientName}`,
    '',
    body || null,
    body ? '' : null,
    `Total: ${money(amountCents, ctx.currency)} inc GST`,
    `Valid for ${validDays} days.`,
  ].filter((v) => v !== null).join('\n');
}

async function draftQuote(ctx, args) {
  const clientName = requireArg(args, 'client_name', "the client this quote is for");
  const amountCents = Number(requireArg(args, 'amount_cents', 'total in integer cents'));
  if (!Number.isFinite(amountCents) || amountCents <= 0) throw new ToolArgError('amount_cents must be a positive integer');
  const validDays = Math.min(Math.max(Number(args.valid_days) || QUOTE_DEFAULT_VALID_DAYS, 1), 90);
  const description = args.description
    || (Array.isArray(args.line_items) ? args.line_items.map((li) => li.description).filter(Boolean).join(', ') : null);

  const quoteText = formatQuote(ctx, { clientName, lineItems: args.line_items, description, amountCents, validDays });

  if (ctx.supabase) {
    const followupDays = Math.min(Math.max(Number(args.followup_days) || QUOTE_FIRST_FOLLOWUP_DAYS, 1), 30);
    await ctx.supabase.from('agent_quotes').insert({
      user_id: ctx.user?.id || null,
      user_phone: ctx.phone,
      client_name: clientName,
      client_handle: String(clientName).toLowerCase().trim(),
      amount_cents: amountCents,
      currency: ctx.currency,
      description,
      status: 'open',
      next_followup_at: new Date(Date.now() + followupDays * 24 * 60 * 60 * 1000).toISOString(),
    }).then(() => {}, (e) => console.warn('[quotes] record failed:', e?.message));
  }

  // result carries the full quote so the model relays it verbatim to the user.
  return {
    result: `quote drafted and saved as open for ${clientName} (${money(amountCents, ctx.currency)}). Send this to the user EXACTLY as written, in a code-free plain block, don't reword it:\n\n${quoteText}`,
    userFacing: `here's the quote for ${clientName.toLowerCase()}, copy and send it:\n\n${quoteText}`,
  };
}

// Record a quote the operator already gave verbally, without drafting text —
// "quoted dave $480 for the reno". Just feeds the chaser.
async function recordQuote(ctx, args) {
  const clientName = requireArg(args, 'client_name');
  const amountCents = Number(requireArg(args, 'amount_cents', 'integer cents'));
  if (!Number.isFinite(amountCents) || amountCents <= 0) throw new ToolArgError('amount_cents must be a positive integer');
  const followupDays = Math.min(Math.max(Number(args.followup_days) || QUOTE_FIRST_FOLLOWUP_DAYS, 1), 30);
  if (ctx.supabase) {
    await ctx.supabase.from('agent_quotes').insert({
      user_id: ctx.user?.id || null,
      user_phone: ctx.phone,
      client_name: clientName,
      client_handle: String(clientName).toLowerCase().trim(),
      amount_cents: amountCents,
      currency: ctx.currency,
      description: args.description || null,
      status: 'open',
      next_followup_at: new Date(Date.now() + followupDays * 24 * 60 * 60 * 1000).toISOString(),
    }).then(() => {}, (e) => console.warn('[quotes] record failed:', e?.message));
  }
  return {
    result: `recorded quote: ${clientName} ${money(amountCents, ctx.currency)} (open, will nudge to follow up)`,
    userFacing: `got it, noted the ${money(amountCents, ctx.currency)} quote for ${clientName.toLowerCase()}. i'll remind you to chase it if it goes quiet`,
  };
}

async function listQuotes(ctx, args = {}) {
  if (!ctx.supabase) return { result: 'quotes unavailable' };
  const status = String(args.status || 'open').toLowerCase();
  const { data } = await ctx.supabase
    .from('agent_quotes')
    .select('client_name, amount_cents, currency, status, sent_at')
    .eq('user_phone', ctx.phone)
    .eq('status', status)
    .order('sent_at', { ascending: false })
    .limit(10);
  if (!data || !data.length) {
    return { result: `no ${status} quotes`, userFacing: status === 'open' ? 'no open quotes right now' : `no ${status} quotes` };
  }
  const total = data.reduce((s, q) => s + (q.amount_cents || 0), 0);
  const lines = data.map((q) => `${q.client_name} ${money(q.amount_cents || 0, q.currency || ctx.currency)}`);
  return {
    result: `${data.length} ${status} totalling ${money(total, ctx.currency)}: ${lines.join('; ')}`,
    userFacing: `${status} quotes (${money(total, ctx.currency)}):\n${lines.join('\n')}`,
  };
}

async function updateQuote(ctx, args) {
  if (!ctx.supabase) return { result: 'quotes unavailable' };
  const status = String(requireArg(args, 'status')).toLowerCase();
  if (!['won', 'lost', 'expired', 'open'].includes(status)) throw new ToolArgError('status must be won, lost, expired or open');
  const handle = String(requireArg(args, 'client_name')).toLowerCase().trim();
  const { data } = await ctx.supabase
    .from('agent_quotes')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('user_phone', ctx.phone)
    .eq('client_handle', handle)
    .eq('status', 'open')
    .select('client_name, amount_cents, currency');
  if (!data || !data.length) {
    return { result: `no open quote found for ${handle}`, userFacing: `couldn't find an open quote for ${handle}` };
  }
  const q = data[0];
  return { result: `quote for ${q.client_name} marked ${status}`, userFacing: `marked ${q.client_name.toLowerCase()}'s quote as ${status}` };
}

// ---------------------------------------------------------------------------
// Memory — passive context accumulation. The model saves any new fact or
// preference the user states (rates, suppliers, where receipts go) so Flynn
// never asks twice. Underscore-prefixed keys are internal bookkeeping and
// can't be written from here.
// ---------------------------------------------------------------------------

async function rememberFacts(ctx, args) {
  const facts = args.facts;
  if (!facts || typeof facts !== 'object' || Array.isArray(facts)) {
    throw new ToolArgError('facts must be an object of key/value pairs');
  }
  const clean = Object.fromEntries(
    Object.entries(facts).filter(([k, v]) => !k.startsWith('_') && v !== null && v !== undefined && v !== '')
  );
  if (!Object.keys(clean).length) throw new ToolArgError('no valid facts to remember');

  const merged = { ...ctx.brain, ...clean };
  await ctx.supabase.from('users').update({ business_brain: merged }).eq('phone', ctx.phone);
  Object.assign(ctx.brain, clean);
  return { result: `remembered: ${Object.keys(clean).join(', ')}` };
}

// ---------------------------------------------------------------------------
// Credential capture (always available — lets the model save supplier/Xero
// logins the user texts, which also unblocks any parked action)
// ---------------------------------------------------------------------------

async function saveLogin(ctx, args) {
  const provider = (requireArg(args, 'provider') || '').toLowerCase().trim();
  const email = requireArg(args, 'email');
  const password = requireArg(args, 'password');
  const known = new Set(['xero', 'apple-calendar', 'imap-email', ...SUPPLIER_SLUGS]);
  if (!known.has(provider)) throw new ToolArgError(`unknown provider "${provider}" — must be one of: xero, apple-calendar, imap-email, ${SUPPLIER_SLUGS.join(', ')}`);
  // IMAP/SMTP email only works for non-OAuth providers — Gmail and Microsoft
  // basic auth is dead, so steer those back to the one-click OAuth connectors.
  if (provider === 'imap-email' && imapEmail.requiresOAuth(email)) {
    throw new ToolArgError(`${email} is a ${email.split('@')[1]} address — that needs the one-click ${/gmail|googlemail/.test(email) ? 'Gmail' : 'Outlook'} sign-in, not a password. Offer connect_tools instead.`);
  }
  const ak = authKindFor(provider);

  const now = new Date().toISOString();
  await ctx.supabase.from('user_integrations').upsert({
    user_phone: ctx.phone,
    integration_type: provider,
    credentials_encrypted: require('../credentialCrypto').encryptCredentials({ email, password }),
    connected_at: now,
    updated_at: now,
  }, { onConflict: 'user_phone,integration_type' });
  await ctx.supabase.from('user_connections').upsert({
    user_id: ctx.user?.id || null,
    user_phone: ctx.phone,
    provider,
    auth_kind: ak,
    status: 'connected',
    connected_at: now,
    updated_at: now,
  }, { onConflict: 'user_phone,provider' });

  ctx.userIntegrations[provider] = { email, password };
  ctx.connections.set(provider, { user_phone: ctx.phone, provider, auth_kind: ak, status: 'connected' });
  return { result: `${provider} login saved`, userFacing: `${provider} login saved`, connectedProvider: provider };
}

// One secure web page to connect several tools at once (OAuth buttons +
// encrypted credential forms) instead of collecting logins over text.
async function connectToolsLink(ctx) {
  if (!ctx.user?.id) return { result: 'no user id yet, ask the user to text again in a moment' };
  const link = ctx.nango.createSetupLink({ userId: ctx.user.id, phone: ctx.phone });
  return {
    result: `setup page link: ${link}`,
    userFacing: `connect everything in one spot, takes a min: ${link}`,
  };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const CAPABILITIES = [
  {
    capability: 'calendar',
    provider: null, // resolved per call: google-calendar (OAuth) or apple-calendar (iCloud CalDAV)
    auth_kind: 'nango_oauth', // default; authKindFor() overrides for apple-calendar
    dynamicProvider: resolveCalendarProvider,
    label: 'Calendar',
    connectBlurb: 'your calendar',
    tools: [
      {
        name: 'calendar_check_availability',
        confirm: false,
        description: "Check busy/free blocks on the user's calendar (Google or Apple/iCloud) from a date.",
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
        description: "Book a job/appointment into the user's calendar (Google or Apple/iCloud, whichever they use).",
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
    provider: null, // resolved per call: google-mail (OAuth), outlook (OAuth), or imap-email (login)
    auth_kind: 'nango_oauth', // default; authKindFor() overrides for imap-email
    dynamicProvider: resolveMailProvider,
    label: 'Email',
    connectBlurb: 'your email',
    tools: [
      {
        name: 'find_emails',
        confirm: false,
        description: "Search the user's inbox (Gmail, Outlook/Microsoft 365, or their other email) and return sender/subject/snippet summaries.",
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'search terms, e.g. dave quote (Gmail also takes from:dave newer_than:7d)' },
            max_results: { type: 'number', description: 'default 5, max 10' },
          },
          required: ['query'],
        },
        executor: findEmails,
      },
      {
        name: 'send_email',
        confirm: true,
        description: "Send an email from the user's own email account (Gmail, Outlook, or their other provider, whichever they connected). Irreversible, so the user is asked to confirm first.",
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
    capability: 'timesheets',
    provider: 'google-sheet',
    auth_kind: 'nango_oauth',
    label: 'Google Sheets',
    connectBlurb: 'a google sheet for timesheets',
    tools: [
      {
        name: 'log_timesheet',
        confirm: false,
        description: "Log a worker's hours to the user's timesheets spreadsheet (created automatically the first time). Use when someone reports hours worked, e.g. \"Jack did 6h Friday\".",
        parameters: {
          type: 'object',
          properties: {
            worker: { type: 'string', description: 'who worked, e.g. Jack' },
            hours: { type: 'number', description: 'hours worked, e.g. 6' },
            date: { type: 'string', description: 'YYYY-MM-DD, default today' },
            job: { type: 'string', description: 'job/site the hours were on, if known' },
            rate_cents: { type: 'number', description: 'hourly rate in integer cents if known' },
          },
          required: ['worker', 'hours'],
        },
        executor: logTimesheet,
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
    // Accounting-side expenses via the Xero API (OAuth through Nango). Distinct
    // from the browserbase `invoicing` capability above, which also uses the
    // "xero" provider key but reads a saved login from user_integrations — the
    // two never clash because they read different stores (connections vs creds).
    capability: 'expenses-accounting',
    provider: 'xero',
    auth_kind: 'nango_oauth',
    label: 'Xero',
    connectBlurb: 'your xero account',
    tools: [
      {
        name: 'xero_log_expense',
        confirm: false, // lands as a DRAFT bill the user reviews in Xero, so no per-receipt SMS confirm
        description: "Record a receipt/expense as a draft bill in the user's Xero (via the Xero API). Use this when their expense_destination is xero. One call per receipt.",
        parameters: {
          type: 'object',
          properties: {
            vendor: { type: 'string', description: 'who was paid, e.g. Bunnings' },
            date: { type: 'string', description: 'YYYY-MM-DD, default today' },
            total_cents: { type: 'number', description: 'total paid in integer cents' },
            gst_cents: { type: 'number', description: 'GST portion in integer cents if known' },
            category: { type: 'string', description: 'materials, fuel, tools, vehicle, office, food' },
            description: { type: 'string' },
          },
          required: ['vendor', 'total_cents'],
        },
        executor: xeroLogExpense,
      },
      {
        name: 'xero_list_invoices',
        confirm: false,
        description: "Read the user's outstanding sales invoices from Xero (accounts receivable). Use when they ask what's unpaid, what's owed to them, or what's overdue. Defaults to overdue only; pass only_overdue=false for everything outstanding.",
        parameters: {
          type: 'object',
          properties: {
            only_overdue: { type: 'boolean', description: 'true (default) = overdue only; false = all outstanding' },
          },
        },
        executor: xeroListInvoices,
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
    capability: 'quotes',
    provider: null,
    auth_kind: 'none',
    label: 'quotes',
    tools: [
      {
        name: 'draft_quote',
        confirm: false,
        description: "Draft a quote the user can send to their client AND record it so you can chase it later. Use when the user asks you to quote a job. Return the drafted quote text to the user verbatim. Pass line_items for an itemised quote or description for a one-liner.",
        parameters: {
          type: 'object',
          properties: {
            client_name: { type: 'string', description: 'who the quote is for' },
            amount_cents: { type: 'number', description: 'total quote amount in integer cents' },
            description: { type: 'string', description: 'what the quote is for, if not itemised' },
            line_items: {
              type: 'array',
              description: 'optional itemised lines',
              items: {
                type: 'object',
                properties: {
                  description: { type: 'string' },
                  amount_cents: { type: 'number' },
                },
                required: ['description'],
              },
            },
            valid_days: { type: 'number', description: 'how many days the quote is valid, default 14' },
          },
          required: ['client_name', 'amount_cents'],
        },
        executor: draftQuote,
      },
      {
        name: 'record_quote',
        confirm: false,
        description: "Record a quote the user already gave verbally (no text drafted), e.g. \"quoted dave $480 for the reno\", so you can chase the follow-up. Use when they mention a quote they've already sent.",
        parameters: {
          type: 'object',
          properties: {
            client_name: { type: 'string' },
            amount_cents: { type: 'number', description: 'integer cents' },
            description: { type: 'string' },
          },
          required: ['client_name', 'amount_cents'],
        },
        executor: recordQuote,
      },
      {
        name: 'list_quotes',
        confirm: false,
        description: "List the user's quotes by status (default open). Use when they ask what quotes are out, what's pending, or what's still open.",
        parameters: {
          type: 'object',
          properties: {
            status: { type: 'string', description: 'open (default), won, lost, or expired' },
          },
        },
        executor: listQuotes,
      },
      {
        name: 'update_quote',
        confirm: false,
        description: "Mark an open quote won, lost or expired so Flynn stops chasing it. Use when the user says a quote was accepted, declined, or is dead.",
        parameters: {
          type: 'object',
          properties: {
            client_name: { type: 'string', description: 'the client whose quote to update' },
            status: { type: 'string', description: 'won, lost, or expired' },
          },
          required: ['client_name', 'status'],
        },
        executor: updateQuote,
      },
    ],
  },
  {
    capability: 'memory',
    provider: null,
    auth_kind: 'none',
    label: 'memory',
    tools: [
      {
        name: 'remember',
        confirm: false,
        description: 'Save new facts or preferences the user just told you (rates, suppliers, client details, where they want expenses logged). Call this whenever you learn something about their business so you never ask twice.',
        parameters: {
          type: 'object',
          properties: {
            facts: {
              type: 'object',
              description: 'flat object of facts, e.g. {"expense_destination": "google_sheet", "hourly_rate_cents": 15000, "preferred_supplier": "reece"}',
              additionalProperties: true,
            },
          },
          required: ['facts'],
        },
        executor: rememberFacts,
      },
    ],
  },
  {
    capability: 'setup',
    provider: null,
    auth_kind: 'none',
    label: 'setup',
    tools: [
      {
        name: 'connect_tools',
        confirm: false,
        description: "Text the user one secure link to connect several tools/accounts at once on a web page (calendar, supplier logins, Xero, iCloud). Prefer this over collecting logins via text when the user wants to set up multiple things or asks to connect their accounts.",
        parameters: { type: 'object', properties: {}, required: [] },
        executor: connectToolsLink,
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
        description: "Save a login the user just texted (email + password) for xero, a trade supplier account, or apple-calendar (iCloud email + app-specific password). Call this whenever the user provides credentials.",
        parameters: {
          type: 'object',
          properties: {
            provider: { type: 'string', description: `one of: xero, apple-calendar, ${SUPPLIER_SLUGS.join(', ')}` },
            email: { type: 'string', description: 'account email (or iCloud email for apple-calendar)' },
            password: { type: 'string', description: 'password (an app-specific password for apple-calendar)' },
          },
          required: ['provider', 'email', 'password'],
        },
        executor: saveLogin,
      },
    ],
  },
];

// Tools that actually DO money/admin work — the "doing" surface the paywall
// meters. Read-only, memory, setup and credential tools are always free so
// chat, onboarding and connecting never hit the gate. Receipts are metered but
// the free budget is generous enough that activation always happens free.
const METERED_TOOLS = new Set([
  'calendar_book_event',
  'send_email',
  'sheets_log_expense',
  'log_timesheet',
  'xero_send_invoice',
  'xero_log_expense',
  'order_parts',
  'draft_quote',
]);

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
  const ak = authKindFor(provider, capability);
  const row = ctx.connections.get(provider);
  if (row?.status === 'connected') {
    // "xero" is shared by two capabilities: OAuth expenses and browserbase
    // invoicing. An OAuth capability must only accept an actual OAuth row, or a
    // saved browserbase login would satisfy it and then fail with no token.
    if (ak === 'nango_oauth') {
      if (row.auth_kind === 'nango_oauth' || row.nango_connection_id) return row;
    } else {
      return row;
    }
  }
  // Credential-based providers (browserbase suppliers/xero, apple-calendar):
  // a saved login in user_integrations counts as connected.
  if (ak.startsWith('credentials') && ctx.userIntegrations[provider]?.email) {
    return { provider, status: 'connected', auth_kind: ak };
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
  METERED_TOOLS,
  ToolArgError,
  findTool,
  providerFor,
  connectionFor,
  authKindFor,
  getOpenAITools,
  timezoneFromPhone,
  resolveSupplier,
  resolveCalendarProvider,
};
