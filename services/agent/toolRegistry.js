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
const photoInvoice = require('../photoInvoice');
const imessageTransport = require('../imessageTransport');
const priceCompare = require('../priceCompare');
const { createDashboardLoginLink } = require('../dashboardLink');
const manifestGenerator = require('../dashboard/manifestGenerator');

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

  await recordExpenseOnSpine(ctx, {
    vendor, totalCents, gstCents: gst, category: args.category, source: 'sms_receipt',
  });

  const amount = money(totalCents, ctx.currency);
  const tail = created && sheetUrl ? `. made you a sheet for them: ${sheetUrl}` : '';
  return {
    result: `expense logged: ${date} ${vendor} ${amount}${created ? ' (new spreadsheet created)' : ''}`,
    userFacing: `logged ${amount} from ${vendor.toLowerCase()} to your expenses sheet${tail}`,
  };
}

/**
 * Mirror a logged expense into the org-keyed `expenses` table so Flynn itself
 * is the system of record, not just Google Sheets / Xero.
 *
 * Deliberately best-effort and non-blocking: expense logging already succeeded
 * from the user's point of view by the time this runs, so a spine write
 * failing (or the user having no org yet) must never turn a successful receipt
 * log into an error. expenses.org_id is NOT NULL, so rows are only written
 * when an org actually resolved.
 */
async function recordExpenseOnSpine(ctx, { vendor, totalCents, gstCents, category, receiptUrl, source }) {
  if (!ctx.supabase || !ctx.orgId) return;
  try {
    await ctx.supabase.from('expenses').insert({
      org_id: ctx.orgId,
      vendor: vendor || null,
      amount_cents: Math.round(Number(totalCents) || 0),
      gst_cents: Number.isFinite(Number(gstCents)) && Number(gstCents) > 0 ? Math.round(Number(gstCents)) : 0,
      category: category || null,
      receipt_url: receiptUrl || null,
      source: source || 'manual',
      created_by: ctx.memberId || null,
    });
  } catch (e) {
    console.warn('[expenses] spine mirror failed:', e?.message);
  }
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

  // Same mirror as the Sheets path — whichever destination the user chose,
  // Flynn keeps its own record so the app's expense view is complete.
  await recordExpenseOnSpine(ctx, {
    vendor, totalCents, gstCents: gst, category: args.category, source: 'xero_sync',
  });

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

// Real cross-supplier price comparison (SerpApi Google Shopping). Called before
// ordering materials so Flynn can find who's got it cheapest/in stock. The data
// is live and generalises to any product; only the eventual order is gated.
async function findPrices(ctx, args = {}) {
  const query = requireArg(args, 'query', 'what to price up, e.g. "17mm structural plywood 2400x1200"');

  // Demo persona: return a deterministic, script-matching comparison so the
  // parts beat never depends on live shopping results on camera. Their usual
  // supplier (Bunnings) is dearer; a supplier near the Toowoomba job is cheaper.
  if (ctx.is_demo) {
    return {
      result: `Compared suppliers for "${query}" (cheapest first): Mitre 10 Toowoomba $186 (in stock, near the job); Bunnings $210 (their usual supplier). `
        + `Best pick: Mitre 10 Toowoomba at $186, the same materials $24 cheaper and right by the job. `
        + `Tell the user in your own words: their usual at Bunnings is $210, but Mitre 10 near the Toowoomba job has the same for $186. Offer to order the cheaper one. When they say yes, call order_parts with supplier set to "Mitre 10".`,
    };
  }

  if (!priceCompare.isConfigured()) {
    // No key set — tell the model to just proceed with a normal order.
    return { result: 'price comparison not available (not configured); proceed straight to order_parts with the user\'s usual supplier' };
  }
  let data;
  try {
    data = await priceCompare.comparePrices(query);
  } catch (e) {
    console.warn('[find_prices] failed:', e?.message);
    return { result: `price lookup failed; offer to just order it from their usual supplier via order_parts` };
  }
  const rows = data.results || [];
  if (!rows.length) {
    return { result: `no online prices found for "${query}"; offer to just order it from their usual supplier` };
  }
  const top = rows.slice(0, 4);
  const cheapestInStock = top.find((r) => r.availability !== 'out_of_stock') || top[0];
  const lines = top.map((r) => `${r.seller} ${r.price || money(r.priceCents, ctx.currency)}${r.availability === 'out_of_stock' ? ' (out of stock)' : ''}`);
  return {
    result: `Compared suppliers for "${query}" (cheapest first): ${lines.join('; ')}. `
      + `Best pick: ${cheapestInStock.seller}${cheapestInStock.price ? ` at ${cheapestInStock.price}` : ''}. `
      + `Tell the user the comparison in your own words, point out the best option (and flag if their first-choice supplier is dearer or out of stock), and offer to order it. When they say yes, call order_parts with supplier set to the chosen seller.`,
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

/**
 * Load this owner's learned quoting style (`quote_templates.style_json`),
 * captured by the app's Quote Style screen (`/api/quote-style`, which OCRs a
 * quote/invoice they've already sent). Best-effort: no style just means the
 * generic layout below.
 *
 * Wiring this in closes a real brain-first gap — the app could learn a style
 * but the agent ignored it, so every agent-drafted quote came out generic even
 * for owners who'd taught Flynn their format.
 */
async function loadQuoteStyle(ctx) {
  if (!ctx.supabase || !ctx.user?.id) return null;
  try {
    const { data } = await ctx.supabase
      .from('quote_templates')
      .select('style_json')
      .eq('user_id', ctx.user.id)
      .maybeSingle();
    return data?.style_json || null;
  } catch (e) {
    console.warn('[quotes] style load failed:', e?.message);
    return null;
  }
}

function formatQuote(ctx, { clientName, lineItems, description, amountCents, validDays, style }) {
  const business = ctx.brain?.business_name || ctx.brain?.business_type || 'us';

  const body = Array.isArray(lineItems) && lineItems.length
    ? lineItems.map((li) => {
      const amt = Number(li.amount_cents);
      return `- ${li.description || 'item'}${Number.isFinite(amt) && amt > 0 ? `  ${money(amt, ctx.currency)}` : ''}`;
    }).join('\n')
    : (description || '');

  // Honour the owner's learned conventions where they have them, falling back
  // to the generic layout field by field.
  const title = style?.title_format
    ? String(style.title_format).replace(/\{client\}/gi, clientName).replace(/\{job\}/gi, description || 'work')
    : `Quote from ${business}`;

  const taxLabel = style?.tax?.label && style.tax.label.toLowerCase() !== 'none'
    ? style.tax.label
    : (gstLabelFor(ctx.currency));
  const totalLine = taxLabel
    ? `Total: ${money(amountCents, ctx.currency)} inc ${taxLabel}`
    : `Total: ${money(amountCents, ctx.currency)}`;

  const validityLine = style?.validity || `Valid for ${validDays} days.`;

  return [
    title,
    `For: ${clientName}`,
    '',
    style?.intro_blurb || null,
    style?.intro_blurb ? '' : null,
    body || null,
    body ? '' : null,
    totalLine,
    validityLine,
    style?.deposit || null,
    style?.payment_terms || null,
    style?.closing_notes || null,
  ].filter((v) => v !== null && v !== undefined).join('\n');
}

// GST only applies in AU/NZ; other currencies get no tax label by default.
function gstLabelFor(currency) {
  return currency === 'AUD' || currency === 'NZD' ? 'GST' : null;
}

async function draftQuote(ctx, args) {
  const clientName = requireArg(args, 'client_name', "the client this quote is for");
  const amountCents = Number(requireArg(args, 'amount_cents', 'total in integer cents'));
  if (!Number.isFinite(amountCents) || amountCents <= 0) throw new ToolArgError('amount_cents must be a positive integer');
  const validDays = Math.min(Math.max(Number(args.valid_days) || QUOTE_DEFAULT_VALID_DAYS, 1), 90);
  const description = args.description
    || (Array.isArray(args.line_items) ? args.line_items.map((li) => li.description).filter(Boolean).join(', ') : null);

  const style = await loadQuoteStyle(ctx);
  const quoteText = formatQuote(ctx, { clientName, lineItems: args.line_items, description, amountCents, validDays, style });

  if (ctx.supabase) {
    const followupDays = Math.min(Math.max(Number(args.followup_days) || QUOTE_FIRST_FOLLOWUP_DAYS, 1), 30);
    await ctx.supabase.from('agent_quotes').insert({
      user_id: ctx.user?.id || null,
      user_phone: ctx.phone,
      // Org attribution for the system-of-record spine (null when the user
      // isn't in an org yet) — see agentLoop.buildCtx.
      org_id: ctx.orgId || null,
      client_name: clientName,
      client_handle: String(clientName).toLowerCase().trim(),
      client_email: args.client_email || null,
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
      org_id: ctx.orgId || null,
      client_name: clientName,
      client_handle: String(clientName).toLowerCase().trim(),
      client_email: args.client_email || null,
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

// Is an email provider actually connected (vs resolveMailProvider's gmail
// default)? Mirrors the connected checks resolveMailProvider uses up top.
function mailProviderConnected(ctx) {
  return ctx.connections.get('outlook')?.status === 'connected'
    || ctx.connections.get('google-mail')?.status === 'connected'
    || Boolean(ctx.userIntegrations?.['imap-email']?.email)
    || ctx.connections.get('imap-email')?.status === 'connected';
}

// A short, on-tone follow-up the operator can send (or Flynn emails) when a
// quote's gone quiet. No em dashes — passes sanitiseReply cleanly either way.
function chaseEmailBody(ctx, clientName, amountCents, currency) {
  const business = ctx.brain?.business_name || ctx.brain?.business_type || 'us';
  const amount = money(amountCents, currency || ctx.currency);
  return [
    `Hi ${clientName},`,
    '',
    `Just following up on the quote we sent through for ${amount}. Happy to answer any questions, and let me know if you'd like to go ahead and we'll lock it in.`,
    '',
    'Cheers,',
    business,
  ].join('\n');
}

// chase_quote — runs after the operator says "yep" to the proactive nudge.
// The scheduler parks a pending_actions row carrying the batch, so this gets
// the exact quotes (no inference). For each: if the client's email is on file
// and a mail provider is connected, Flynn emails the follow-up; otherwise it
// hands the operator a ready-to-send draft. Then stamps last_followup_at.
async function chaseQuote(ctx, args = {}) {
  if (!ctx.supabase) return { result: 'quotes unavailable' };

  // Prefer the parked batch; fall back to looking the client up by name if the
  // model called this directly ("chase the hendersons").
  let clients = Array.isArray(args.clients) ? args.clients.filter((c) => c && c.name) : [];
  if (!clients.length && args.client_name) {
    const handle = String(args.client_name).toLowerCase().trim();
    const { data } = await ctx.supabase
      .from('agent_quotes')
      .select('id, client_name, client_email, amount_cents, currency')
      .eq('user_phone', ctx.phone)
      .eq('client_handle', handle)
      .eq('status', 'open')
      .order('sent_at', { ascending: false })
      .limit(1);
    clients = (data || []).map((q) => ({ quote_id: q.id, name: q.client_name, email: q.client_email, amount_cents: q.amount_cents, currency: q.currency }));
  }
  if (!clients.length) {
    return { result: 'no matching open quote to chase', userFacing: "couldn't find that quote to chase, which client was it?" };
  }

  const canEmail = mailProviderConnected(ctx);
  const emailed = [];
  const drafts = [];
  const nowIso = new Date().toISOString();

  for (const c of clients) {
    const name = String(c.name);
    const amount = money(c.amount_cents, c.currency || ctx.currency);
    const body = chaseEmailBody(ctx, name, c.amount_cents, c.currency);

    if (canEmail && c.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) {
      try {
        await sendEmail(ctx, { to: c.email, subject: `Following up on your quote`, body });
        emailed.push(`${name.toLowerCase()} (${amount})`);
      } catch (e) {
        console.warn('[chase_quote] email send failed:', e?.message);
        drafts.push(`to ${name.toLowerCase()} (${amount}):\n${body}`);
      }
    } else {
      drafts.push(`to ${name.toLowerCase()} (${amount}):\n${body}`);
    }

    // Stamp the chase. The nudge already advanced the followup cadence, so just
    // record that the chase happened (don't double-bump the count).
    const match = c.quote_id
      ? ctx.supabase.from('agent_quotes').update({ last_followup_at: nowIso, updated_at: nowIso }).eq('id', c.quote_id)
      : ctx.supabase.from('agent_quotes').update({ last_followup_at: nowIso, updated_at: nowIso })
          .eq('user_phone', ctx.phone).eq('client_handle', name.toLowerCase().trim()).eq('status', 'open');
    await match.then(() => {}, (e) => console.warn('[chase_quote] stamp failed:', e?.message));
  }

  const parts = [];
  if (emailed.length) parts.push(`emailed the follow-up to ${emailed.join(', ')}`);
  let userFacing;
  if (emailed.length && !drafts.length) {
    userFacing = `done, chased ${emailed.join(' and ')} by email. i'll flag when they reply.`;
  } else if (drafts.length) {
    const lead = emailed.length ? `chased ${emailed.join(', ')} by email. ` : '';
    userFacing = `${lead}here's a follow-up you can send${drafts.length > 1 ? '' : ''}:\n\n${drafts.join('\n\n')}`;
  } else {
    userFacing = 'done, chased it.';
  }

  return {
    result: `chase_quote ran: ${emailed.length} emailed, ${drafts.length} drafted`,
    userFacing,
  };
}

// ---------------------------------------------------------------------------
// Photo invoices — Flynn renders its own invoice with the job photos the user
// texted embedded, returns a hosted link to forward, and (best-effort) mirrors
// the invoice into Xero so the books match. Phone-keyed (agent_invoices), so
// no third-party connection is required to send one (auth_kind: none).
// ---------------------------------------------------------------------------
async function createPhotoInvoice(ctx, args) {
  const clientName = requireArg(args, 'client_name', 'who the invoice is for');
  const totalCents = photoInvoice.computeTotalCents(args);
  if (!Number.isFinite(totalCents) || totalCents <= 0) {
    throw new ToolArgError('need a total — pass amount_cents, or line_items each with amount_cents');
  }
  let lineItems = Array.isArray(args.line_items) ? args.line_items.filter((li) => li && li.description) : [];
  if (!lineItems.length) lineItems = [{ description: args.description || 'work completed', amount_cents: totalCents }];

  const photos = await photoInvoice.takeBufferedPhotos({ supabase: ctx.supabase, userPhone: ctx.phone });
  let photoUrls = photos.map((p) => p.url);
  // Demo safety net: if no photo came through (e.g. an inbound-media hiccup mid
  // shoot), embed the seeded deck photo so the invoice always looks complete.
  if (ctx.is_demo && photoUrls.length === 0) {
    photoUrls = [process.env.DEMO_JOB_PHOTO_URL || 'https://flynnai.app/img-03-768x768.jpg'];
  }
  const { invoice, url } = await photoInvoice.saveInvoice(ctx, {
    clientName,
    clientHandle: String(clientName).toLowerCase().trim(),
    clientEmail: args.client_email || null,
    lineItems,
    totalCents,
    message: args.message || null,
    dueDate: args.due_date || null,
    photoUrls,
  });

  // Best-effort mirror to Xero so the books match — non-blocking, never holds
  // up the link, and only fires if the user has a Xero login on file.
  let xeroNote = '';
  const xeroCreds = ctx.userIntegrations?.xero;
  if (xeroCreds?.email && xeroCreds?.password) {
    xeroNote = ' (logging it to your xero too)';
    const description = args.description || lineItems.map((li) => li.description).join(', ');
    browserbase.xeroInvoice(xeroCreds, {
      clientName,
      clientEmail: args.client_email,
      description,
      amountCents: totalCents,
      date: new Date().toISOString().slice(0, 10),
    }).then(
      () => ctx.supabase?.from('agent_invoices').update({ xero_synced: true }).eq('id', invoice.id),
      (e) => console.warn('[photo-invoice] xero mirror failed:', e?.message),
    );
  }

  const amount = money(totalCents, ctx.currency);
  const n = photoUrls.length;
  const photoBit = n ? ` with ${n} photo${n > 1 ? 's' : ''}` : '';
  const label = String(clientName).toLowerCase();

  // Send the invoice card as an INLINE IMAGE (the og.png, which is rendered to
  // look like the invoice) rather than relying on iMessage to unfurl the link —
  // a relay-sent link shows a "tap to load preview" placeholder, an image
  // attachment renders instantly. The interactive link is delivered later at the
  // send step (send_invoice), so we don't double-unfurl here.
  const cardImageUrl = invoice.public_token ? `${url}/og.png` : null;
  if (cardImageUrl) {
    await imessageTransport.sendAttachment(ctx.phone, cardImageUrl, 'invoice.png')
      .catch((e) => console.warn('[create_photo_invoice] card image send failed:', e?.message));
  }

  // Preview-then-send: show the invoice card now, park a send_invoice action so a
  // "yep" sends it to the client. (terminal tool → userFacing returned verbatim.)
  const sendArgs = {
    invoice_id: invoice.id,
    client_name: clientName,
    client_email: args.client_email || null,
    total_cents: totalCents,
    currency: ctx.currency || 'AUD',
    public_token: invoice.public_token || null,
  };
  return {
    result: `photo invoice for ${clientName} ${amount}${photoBit} created at ${url}; the invoice card was just sent to the user as an image. Ask if they want it sent to the client.`,
    userFacing: `here's ${label}'s invoice for ${amount}${photoBit}. want me to send it to them?${xeroNote}`,
    pendingAction: {
      action_type: 'send_invoice',
      action_data: sendArgs,
      confirmation_message: `want me to send ${label}'s invoice?`,
      status: 'awaiting_confirmation',
      tool_name: 'send_invoice',
      tool_args: sendArgs,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    },
  };
}

// send_invoice — send a created photo invoice to the client. Parked by
// create_photo_invoice and run on the user's "yep". Demo simulates the send;
// real users get an email if the client's address is on file + a mail provider
// is connected, otherwise Flynn hands back the link to forward.
async function sendInvoice(ctx, args = {}) {
  const clientName = String(args.client_name || 'your client');
  const label = clientName.toLowerCase();
  if (args.invoice_id && ctx.supabase) {
    await ctx.supabase.from('agent_invoices')
      .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', args.invoice_id).then(() => {}, () => {});
  }
  if (ctx.is_demo) {
    return { result: `simulated send of ${clientName}'s invoice`, userFacing: `sent it through to ${label}. i'll flag when they pay.` };
  }
  const email = args.client_email;
  const url = args.public_token ? photoInvoice.invoiceUrl(args.public_token) : '';
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && mailProviderConnected(ctx)) {
    const body = `hi, here's the invoice for the work, ${money(args.total_cents, args.currency || ctx.currency)}. you can view and pay it here: ${url}. thanks!`;
    try {
      await sendEmail(ctx, { to: email, subject: 'Your invoice', body });
      return { result: `emailed ${clientName}`, userFacing: `sent to ${label}. i'll flag when they pay.` };
    } catch (e) {
      return { result: `email failed: ${e?.message}`, userFacing: `couldn't email it just now, here's the link to forward to ${label}:\n${url}` };
    }
  }
  return { result: 'no client email on file', userFacing: `i don't have ${label}'s email, so forward them the link, or send me their email and i'll fire it off.` };
}

// Operator action — "henderson paid" flips the most recent unpaid invoice to
// paid so it stops showing as outstanding (and won't be chased). Reversible
// enough to skip the confirm gate, like update_quote.
async function markInvoicePaid(ctx, args) {
  if (!ctx.supabase) return { result: 'invoices unavailable' };
  const handle = String(requireArg(args, 'client_name')).toLowerCase().trim();
  const { data: found } = await ctx.supabase
    .from('agent_invoices')
    .select('id, client_name, total_cents, currency')
    .eq('user_phone', ctx.phone)
    .eq('client_handle', handle)
    .neq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(1);
  if (!found || !found.length) {
    return { result: `no unpaid invoice for ${handle}`, userFacing: `couldn't find an unpaid invoice for ${handle}` };
  }
  const inv = found[0];
  await ctx.supabase
    .from('agent_invoices')
    .update({ status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', inv.id)
    .then(() => {}, (e) => console.warn('[photo-invoice] mark paid failed:', e?.message));
  return {
    result: `marked ${inv.client_name} invoice paid (${money(inv.total_cents, inv.currency || ctx.currency)})`,
    userFacing: `nice, marked ${String(inv.client_name).toLowerCase()}'s invoice as paid`,
  };
}

// Reminder body for an unpaid invoice — plain, on-tone, no em dashes.
function invoiceReminderBody(ctx, clientName, amountCents, currency, url) {
  const business = ctx.brain?.business_name || ctx.brain?.business_type || 'us';
  const amount = money(amountCents, currency || ctx.currency);
  return [
    `Hi ${clientName},`,
    '',
    `Just a quick reminder on the invoice for ${amount}.${url ? ` You can view and pay it here: ${url}` : ''} Let me know if you have any questions.`,
    '',
    'Cheers,',
    business,
  ].join('\n');
}

// chase_invoice — follows up on an unpaid photo invoice. Runs after the
// operator says "yep" to the proactive overdue nudge (the demo parks the batch)
// or when they ask directly ("chase the henderson invoice"). Emails the
// reminder if the client's email is on file and a mail provider is connected;
// in demo, simulates the send; otherwise hands the operator a draft.
async function chaseInvoice(ctx, args = {}) {
  if (!ctx.supabase) return { result: 'invoices unavailable' };

  let invoices = Array.isArray(args.invoices) ? args.invoices.filter((i) => i && i.client_name) : [];
  if (!invoices.length) {
    const handle = String(requireArg(args, 'client_name', 'which client to chase')).toLowerCase().trim();
    const { data } = await ctx.supabase
      .from('agent_invoices')
      .select('id, client_name, client_email, total_cents, currency, public_token')
      .eq('user_phone', ctx.phone)
      .eq('client_handle', handle)
      .neq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(1);
    invoices = (data || []).map((inv) => ({
      invoice_id: inv.id, client_name: inv.client_name, client_email: inv.client_email,
      total_cents: inv.total_cents, currency: inv.currency, public_token: inv.public_token,
    }));
  }
  if (!invoices.length) {
    return { result: 'no matching unpaid invoice to chase', userFacing: "couldn't find an unpaid invoice for that client, which one was it?" };
  }

  const canEmail = mailProviderConnected(ctx); // false for demo (no real connection)
  const emailed = [];
  const drafts = [];
  const nowIso = new Date().toISOString();

  for (const c of invoices) {
    const name = String(c.client_name);
    const amount = money(c.total_cents, c.currency || ctx.currency);
    const url = c.public_token ? photoInvoice.invoiceUrl(c.public_token) : '';
    const body = invoiceReminderBody(ctx, name, c.total_cents, c.currency, url);

    if (ctx.is_demo) {
      emailed.push(`${name.toLowerCase()} (${amount})`); // simulated, no real send
    } else if (canEmail && c.client_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.client_email)) {
      try {
        await sendEmail(ctx, { to: c.client_email, subject: 'Reminder: your invoice', body });
        emailed.push(`${name.toLowerCase()} (${amount})`);
      } catch (e) {
        console.warn('[chase_invoice] email send failed:', e?.message);
        drafts.push(`to ${name.toLowerCase()} (${amount}):\n${body}`);
      }
    } else {
      drafts.push(`to ${name.toLowerCase()} (${amount}):\n${body}`);
    }

    if (c.invoice_id) {
      await ctx.supabase.from('agent_invoices').update({ updated_at: nowIso }).eq('id', c.invoice_id).then(() => {}, () => {});
    }
  }

  let userFacing;
  if (emailed.length && !drafts.length) {
    userFacing = `done, chased ${emailed.join(' and ')} for you. i'll flag when they pay.`;
  } else if (drafts.length) {
    const lead = emailed.length ? `chased ${emailed.join(', ')}. ` : '';
    userFacing = `${lead}here's a reminder you can send:\n\n${drafts.join('\n\n')}`;
  } else {
    userFacing = 'done, chased it.';
  }

  // Demo only: close the loop a beat later — Flynn "sees" the payment land
  // (the client emails back / it gets marked paid), flips the invoice to paid,
  // and tells the operator. Real users keep the honest flow (chase, then a real
  // payment, then mark_invoice_paid). Scoped to is_demo so there's no fake
  // payment detection for anyone but the seeded reviewer persona.
  if (ctx.is_demo) {
    const ids = invoices.map((c) => c.invoice_id).filter(Boolean);
    const paidName = String(invoices[0]?.client_name || 'your client');
    const paidAmt = money(invoices[0]?.total_cents || 0, invoices[0]?.currency || ctx.currency);
    const channel = ctx.user?.preferred_channel === 'sms' ? 'sms' : 'imessage';
    setTimeout(async () => {
      try {
        if (ids.length) {
          await ctx.supabase.from('agent_invoices')
            .update({ status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .in('id', ids);
        }
        const { sendToUser } = require('../flynnOutbound');
        await sendToUser(ctx.phone, `${paidName.toLowerCase()} just paid the ${paidAmt}. marked it off your books.`, { channel, supabase: ctx.supabase });
      } catch (e) {
        console.warn('[demo] paid-loop sim failed:', e?.message);
      }
    }, 25 * 1000);
  }

  return { result: `chase_invoice ran: ${emailed.length} emailed, ${drafts.length} drafted`, userFacing };
}

// reschedule_job — moves a rained-out job to the next clear day. Runs after the
// operator says "yep" to the proactive weather nudge (the scheduler parks the
// event id + new time). Demo accounts simulate; real Google-calendar users get
// the event patched.
async function rescheduleJob(ctx, args = {}) {
  const label = args.clear_day_label || 'the next clear day';
  const what = args.summary ? String(args.summary).toLowerCase() : 'the job';
  if (ctx.is_demo || args.demo || args.provider === 'demo') {
    return { result: `[demo] moved ${what} to ${label}`, userFacing: `done, moved ${what} to ${label}, and i let the client know.` };
  }
  if (args.provider === 'google-calendar' && args.event_id && args.new_start_iso) {
    try {
      const token = await nangoToken(ctx, 'google-calendar');
      await googleCalendar.patchEvent(token, {
        eventId: args.event_id,
        startISO: args.new_start_iso,
        endISO: args.new_end_iso || args.new_start_iso,
        timeZone: ctx.tz,
      });
      return { result: `moved ${what} to ${label}`, userFacing: `done, moved ${what} to ${label}.` };
    } catch (e) {
      console.warn('[reschedule_job] patch failed:', e?.message);
      return { result: 'reschedule failed', userFacing: "couldn't move it automatically, want me to try again or give me the new time?" };
    }
  }
  return { result: 'no event to reschedule', userFacing: `tell me the new day and time and i'll move ${what}.` };
}

// send_app_link — when the user wants to view their own stuff (invoices, jobs,
// quotes, receipts, schedule, "the dashboard", "open the app") Flynn points them
// to the app and texts a single-use login link so they land already signed in.
// Best-effort rebuilds their dashboard manifest first so there's something to
// see; the link itself works regardless.
async function sendAppLink(ctx) {
  try {
    await manifestGenerator.generateManifest({ phone: ctx.phone, supabase: ctx.supabase, force: false });
  } catch (e) {
    console.warn('[send_app_link] manifest gen failed:', e?.message);
  }
  const link = await createDashboardLoginLink({ userId: ctx.user?.id, phone: ctx.phone });
  if (!link) {
    return { result: 'could not mint a login link', userFacing: "couldn't pull your link up just now, give it another go in a sec" };
  }
  return {
    result: `Tell the user their stuff lives in the app and give them this exact login link, verbatim and on its own line, unchanged: ${link}`,
    userFacing: `it's all in your app, here's a link straight in:\n\n${link}`,
  };
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
    capability: 'pricing',
    provider: null,
    auth_kind: 'none', // global price-comparison API, no per-user login
    label: 'price comparison',
    tools: [
      {
        name: 'find_prices',
        confirm: false,
        description: "Compare what a product/material costs across suppliers (live prices from Google Shopping AU). ALWAYS call this first when the user asks to order or buy materials, BEFORE order_parts, so you can tell them who's cheapest or in stock and recommend the best supplier. Pass a specific product query.",
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'specific product to price up, e.g. "17mm structural plywood 2400x1200 sheet"' },
          },
          required: ['query'],
        },
        executor: findPrices,
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
            client_email: { type: 'string', description: "client's email, if known — lets Flynn email the chase if the quote goes quiet" },
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
            client_email: { type: 'string', description: "client's email, if known — lets Flynn email the chase if the quote goes quiet" },
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
      {
        name: 'chase_quote',
        confirm: false,
        description: "Send a follow-up on a quote that's gone quiet. Use when the user says yes/yep to chasing a quote (e.g. after Flynn asked 'want me to chase them up?'), or asks you to chase or follow up a specific client. Emails the follow-up if the client's email is on file and an email account is connected, otherwise hands the user a ready-to-send draft.",
        parameters: {
          type: 'object',
          properties: {
            client_name: { type: 'string', description: 'the client to chase, if chasing one by name' },
            clients: {
              type: 'array',
              description: 'optional batch of quotes to chase (normally supplied automatically when resuming a nudge)',
              items: {
                type: 'object',
                properties: {
                  quote_id: { type: 'string' },
                  name: { type: 'string' },
                  email: { type: 'string' },
                  amount_cents: { type: 'number' },
                  currency: { type: 'string' },
                },
                required: ['name'],
              },
            },
          },
        },
        executor: chaseQuote,
      },
    ],
  },
  {
    capability: 'invoices',
    provider: null,
    auth_kind: 'none',
    label: 'invoices',
    tools: [
      {
        name: 'create_photo_invoice',
        confirm: false,
        terminal: true,
        description: "Create an invoice with the job photos the user recently texted embedded, and show them the shareable invoice card as a preview. Call this IMMEDIATELY when the user asks to invoice a job and you have a client/address + an amount — do NOT first ask for the client's email or how they get paid. Photos sent in the last few hours attach automatically — never ask them to re-send. Pass line_items for itemised, or amount_cents for a single total (amounts are GST-inclusive). client_email is OPTIONAL — omit it if you don't have it. After this runs, Flynn shows the invoice card and asks if they want it sent to the client; a 'yes' runs send_invoice.",
        parameters: {
          type: 'object',
          properties: {
            client_name: { type: 'string', description: 'who the invoice is for' },
            amount_cents: { type: 'number', description: 'total in integer cents (GST-inclusive) if not itemised' },
            description: { type: 'string', description: 'what the invoice is for, if not itemised' },
            line_items: {
              type: 'array',
              description: 'optional itemised lines (GST-inclusive amounts)',
              items: {
                type: 'object',
                properties: {
                  description: { type: 'string' },
                  amount_cents: { type: 'number' },
                },
                required: ['description'],
              },
            },
            client_email: { type: 'string', description: "client's email, if known" },
            due_date: { type: 'string', description: 'YYYY-MM-DD, optional' },
            message: { type: 'string', description: 'optional short note to the client' },
          },
          required: ['client_name'],
        },
        executor: createPhotoInvoice,
      },
      {
        name: 'send_invoice',
        confirm: false,
        description: "Send a created photo invoice to the client. Normally parked automatically by create_photo_invoice and run when the user confirms they want it sent. Emails the client if their address is on file and a mail provider is connected; otherwise hands back the link to forward.",
        parameters: {
          type: 'object',
          properties: {
            invoice_id: { type: 'string', description: 'id of the invoice to send' },
            client_name: { type: 'string', description: 'who the invoice is for' },
            client_email: { type: 'string', description: "client's email, if known" },
            total_cents: { type: 'number', description: 'invoice total in integer cents' },
            currency: { type: 'string', description: 'currency code, e.g. AUD' },
            public_token: { type: 'string', description: 'public token for the hosted invoice link' },
          },
          required: ['client_name'],
        },
        executor: sendInvoice,
      },
      {
        name: 'mark_invoice_paid',
        confirm: false,
        description: "Mark a photo invoice you sent as paid so it stops showing as outstanding. Use when the user says a client has paid, e.g. \"henderson paid\". Matches the most recent unpaid invoice for that client.",
        parameters: {
          type: 'object',
          properties: {
            client_name: { type: 'string', description: 'the client who paid' },
          },
          required: ['client_name'],
        },
        executor: markInvoicePaid,
      },
      {
        name: 'chase_invoice',
        confirm: false,
        description: "Send a follow-up on an unpaid invoice. Use when the user says yes/yep to chasing an invoice (e.g. after Flynn flagged 'that invoice is overdue, want me to chase it?'), or asks to chase/follow up an invoice for a client, e.g. 'chase the henderson invoice'. Emails the reminder if the client's email is on file and email is connected, otherwise hands the user a ready-to-send draft.",
        parameters: {
          type: 'object',
          properties: {
            client_name: { type: 'string', description: 'the client whose unpaid invoice to chase' },
            invoices: {
              type: 'array',
              description: 'optional batch (normally supplied automatically when resuming an overdue-invoice nudge)',
              items: {
                type: 'object',
                properties: {
                  invoice_id: { type: 'string' },
                  client_name: { type: 'string' },
                  client_email: { type: 'string' },
                  total_cents: { type: 'number' },
                  currency: { type: 'string' },
                  public_token: { type: 'string' },
                },
                required: ['client_name'],
              },
            },
          },
        },
        executor: chaseInvoice,
      },
    ],
  },
  {
    capability: 'scheduling',
    provider: null,
    auth_kind: 'none',
    label: 'scheduling',
    tools: [
      {
        name: 'reschedule_job',
        confirm: false,
        description: "Move a job to a new day, e.g. after Flynn flags rain and the user says yes to rescheduling. Normally the event details are supplied automatically when resuming a weather nudge; if the user asks directly, pass the summary and the new day.",
        parameters: {
          type: 'object',
          properties: {
            summary: { type: 'string', description: 'short job title' },
            clear_day_label: { type: 'string', description: 'the day to move it to, e.g. "friday"' },
            event_id: { type: 'string' },
            provider: { type: 'string' },
            new_start_iso: { type: 'string' },
            new_end_iso: { type: 'string' },
            location: { type: 'string' },
            demo: { type: 'boolean' },
          },
        },
        executor: rescheduleJob,
      },
    ],
  },
  {
    capability: 'dashboard',
    provider: null,
    auth_kind: 'none',
    label: 'dashboard',
    tools: [
      {
        name: 'send_app_link',
        confirm: false,
        description: "Text the user a single-use login link to their Flynn app/dashboard. Use whenever the user wants to view or check their own data rather than have Flynn do something — e.g. 'where can i see my invoices', 'how do i check my jobs', 'is there a dashboard', 'can i see my receipts somewhere', 'open the app', 'where's my schedule'. The link logs them straight in, no password.",
        parameters: { type: 'object', properties: {} },
        executor: sendAppLink,
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
  'create_photo_invoice',
]);

// Tools that hit real OAuth/Browserbase side effects. For reviewer demo
// accounts these are SIMULATED (realistic success text, no real call) so a
// reviewer can experience parts ordering, emailing, calendar + accounting
// without connecting anything. Local tools (invoices, quotes, chasing, memory)
// are deliberately NOT here — they run for real so the hosted pages are genuine.
const SIMULATED_TOOLS = new Set([
  'send_email',
  'find_emails',
  'calendar_book_event',
  'calendar_check_availability',
  'sheets_log_expense',
  'log_timesheet',
  'xero_send_invoice',
  'xero_log_expense',
  'xero_list_invoices',
  'order_parts',
]);

// Realistic canned outcomes for simulated tools, shaped from the call args so
// the reviewer sees something concrete ("ordered 3 sheets of ply…").
function demoResult(toolName, args = {}, ctx = {}) {
  const cur = ctx.currency || 'AUD';
  switch (toolName) {
    case 'order_parts': {
      let slug;
      try { slug = resolveSupplier(ctx, args); } catch { slug = null; }
      slug = slug || (Array.isArray(ctx.brain?.suppliers) && ctx.brain.suppliers[0]) || 'bunnings';
      const items = Array.isArray(args.items) ? args.items : [];
      const first = items[0];
      const what = first
        ? `${first.quantity || first.qty || ''} ${first.name || first.description || 'item'}`.trim()
        : (args.description || 'the materials');
      const price = money(18600, cur);
      return {
        result: `[demo] order placed at ${slug}: ${what}`,
        userFacing: `ordered ${what} from ${slug}, ${price}, ready for pickup tomorrow.`,
      };
    }
    case 'send_email':
      return { result: `[demo] email sent to ${args.to || 'the client'}`, userFacing: `sent the email to ${String(args.to || 'them').toLowerCase()}.` };
    case 'find_emails':
      return { result: '[demo] no new emails match', userFacing: 'had a look, nothing new in there right now.' };
    case 'calendar_book_event': {
      const when = [args.date, args.start_time].filter(Boolean).join(' ');
      return { result: `[demo] booked ${args.summary || 'job'} ${when}`, userFacing: `booked ${String(args.client_name || args.summary || 'the job').toLowerCase()} in${when ? ` for ${when}` : ''}.` };
    }
    case 'calendar_check_availability':
      return { result: '[demo] free after 2pm thursday and all friday', userFacing: "you're free after 2pm thursday and all of friday." };
    case 'sheets_log_expense':
    case 'xero_log_expense':
      return { result: `[demo] logged ${money(Number(args.total_cents) || 0, cur)} from ${args.vendor || 'supplier'}`, userFacing: `filed that ${money(Number(args.total_cents) || 0, cur)} receipt from ${String(args.vendor || 'the supplier').toLowerCase()}.` };
    case 'log_timesheet':
      return { result: '[demo] timesheet logged', userFacing: `logged ${args.hours || ''}h${args.worker ? ` for ${String(args.worker).toLowerCase()}` : ''}.` };
    case 'xero_send_invoice':
      return { result: `[demo] xero invoice sent to ${args.client_name || 'client'}`, userFacing: `invoice is away to ${String(args.client_name || 'them').toLowerCase()} and logged in xero.` };
    case 'xero_list_invoices':
      return { result: '[demo] 1 outstanding: Henderson $2,400 (4d overdue)', userFacing: "you've got one unpaid: henderson for $2,400, 4 days overdue." };
    default:
      return { result: `[demo] ${toolName} done`, userFacing: 'done.' };
  }
}

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
  // Reviewer demo accounts behave as if everything's connected (no real OAuth);
  // the actual external call is simulated in safeExecute.
  if (ctx?.is_demo) return { status: 'connected' };
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
  SIMULATED_TOOLS,
  demoResult,
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
