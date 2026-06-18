/**
 * Agent loop — Flynn's active-phase brain when FLYNN_TOOL_LOOP=1.
 *
 * One OpenAI-style tool-calling loop (Qwen via the compatible client) over the
 * tool registry. Every tool call is gated before execution:
 *
 *   confirm gate      irreversible tools (invoice, order, send email) park in
 *                     pending_actions as awaiting_confirmation; the user's next
 *                     "yes" executes deterministically (no LLM in that path)
 *   connection gate   tools whose provider isn't connected park as
 *                     awaiting_connection; the user gets a connect link
 *                     (nango_oauth) or is asked for a login (browserbase).
 *                     resumeParkedAction() runs the parked call after the
 *                     Nango webhook fires or a login is saved.
 *
 * Returns the processMessage contract: { bubbles|reply, intent, pendingAction,
 * clearPending, updatedBrain } — routes/iMessageInbound.js persists the rest.
 */

const { getLLMClient } = require('../../llmClient');
const nango = require('../nango');
const registry = require('./toolRegistry');
const billingGate = require('../billingGate');
const { logToolEvent } = require('./toolEvents');

const QWEN_MODEL = process.env.SMS_LLM_MODEL || process.env.DRAFT_LLM_MODEL || 'qwen3.5-flash';
const MAX_TOOL_ITERATIONS = 6; // headroom to log a batch of receipts in one turn
const HISTORY_LIMIT = 12;
const GATED_ACTION_TTL_MS = 24 * 60 * 60 * 1000; // user may tap the connect link hours later
const CONFIRM_ACTION_TTL_MS = 30 * 60 * 1000;

function currencyFromPhone(phone = '') {
  if (phone.startsWith('+64')) return 'NZD';
  if (phone.startsWith('+44')) return 'GBP';
  if (phone.startsWith('+1')) return 'USD';
  return 'AUD';
}

function buildCtx({ user, phone, supabase, connections, userIntegrations, brain }) {
  return {
    user: user || {},
    phone,
    supabase,
    connections: connections || new Map(),
    userIntegrations: userIntegrations || {},
    brain: brain || {},
    nango,
    tz: registry.timezoneFromPhone(phone),
    currency: (brain || {}).currency || currencyFromPhone(phone),
  };
}

/**
 * Load this user's user_connections rows into a Map<provider, row>.
 */
async function loadConnections(supabase, phone) {
  const connections = new Map();
  if (!supabase) return connections;
  const { data } = await supabase
    .from('user_connections')
    .select('*')
    .eq('user_phone', phone);
  for (const row of data || []) connections.set(row.provider, row);
  return connections;
}

async function loadHistory(supabase, phone, currentMessage) {
  if (!supabase) return [];
  const { data } = await supabase
    .from('sms_messages')
    .select('direction, body, created_at')
    .eq('user_phone', phone)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT + 1);
  const rows = (data || []).reverse();
  // The inbound route logs the current message before calling us — drop it.
  if (rows.length && rows[rows.length - 1].direction === 'in' && rows[rows.length - 1].body === currentMessage) {
    rows.pop();
  }
  return rows.slice(-HISTORY_LIMIT).map((r) => ({
    role: r.direction === 'in' ? 'user' : 'assistant',
    content: r.body,
  }));
}

function connectionSummary(ctx) {
  const bits = [];
  for (const cap of registry.CAPABILITIES) {
    if (cap.auth_kind === 'none') continue;
    if (cap.dynamicProvider) {
      const slug = cap.dynamicProvider(ctx, {});
      bits.push(`${cap.label}: ${slug && registry.connectionFor(cap, ctx, {}) ? `connected (${slug})` : 'not connected'}`);
    } else {
      bits.push(`${cap.label}: ${registry.connectionFor(cap, ctx, {}) ? 'connected' : 'not connected'}`);
    }
  }
  return bits.join('; ');
}

function openItemsBlock(openActionItems) {
  if (!Array.isArray(openActionItems) || !openActionItems.length) return '';
  const lines = openActionItems
    .map((it, i) => `${i + 1}. [${it.category || 'item'}] ${it.summary}`)
    .join('\n');
  return `\nFlynn has been watching this user's team group chat. Open items you picked up that they haven't actioned yet (they may refer to these by number, e.g. "do 1 and 3", or in plain words, e.g. "order the MDF"). When they ask, call the matching tool with the details from the item:
${lines}\n`;
}

function buildSystemPrompt(ctx, imageNote, openActionItems) {
  const now = new Date();
  const today = now.toLocaleDateString('en-CA', { timeZone: ctx.tz }); // YYYY-MM-DD
  const weekday = now.toLocaleDateString('en-AU', { timeZone: ctx.tz, weekday: 'long' });

  return `You are Flynn, a text-based assistant that runs the admin side of someone's work, right inside iMessage. You book jobs into their calendar, find and send emails, log expenses and receipts, write and send proper invoices yourself (with photos of the job on them), and order parts from their trade supplier.

Today is ${weekday} ${today} (${ctx.tz}). Currency: ${ctx.currency}.

Their business (use these real details, never invent prices or contacts):
${JSON.stringify(ctx.brain, null, 2)}

Tool connections right now: ${connectionSummary(ctx)}
${imageNote ? `\n${imageNote}\n` : ''}${openItemsBlock(openActionItems)}
Rules:
- Use the tools to actually do things. Don't describe what you could do, do it. If a tool's account isn't connected, call it anyway: the user gets a 10-second connect link and the action runs right after.
- Resolve relative dates ("thursday", "tomorrow arvo") to real YYYY-MM-DD dates using today's date above before calling a tool. Morning ~08:00, midday 12:00, arvo ~14:00 unless they said a time.
- If the user texts a login (email and password), call save_login with the right provider.
- When the user tells you something new about their business (a rate, a supplier, a client, a preference like where receipts get logged), call remember to save it. Never ask for something twice. This is how you learn their tool stack.
- Don't push connect links in the first messages. Have a real conversation first and learn what they actually use (their calendar, accounting, the suppliers they order from), remembering each. Once you've got a good picture of their stack, offer to set it all up in one go with connect_tools, which texts them a single page pre-filled with their tools, instead of dripping one link at a time. Only use a one-off gated connect link when they make a specific request (book/order/invoice) before they've set up.
- Calendar can be Google or Apple/iCloud. If they say they use Apple Calendar or iCloud, call remember with calendar_provider set to "apple" before booking, so it goes to the right calendar. Otherwise assume Google.
- Email can be Gmail, Outlook/Microsoft 365, or another provider (Bigpond, iCloud, Optus, or their own business domain). Gmail and Outlook are one-tap sign-ins; everything else needs their email address and an app password. If they tell you which they use, call remember with email_provider (e.g. "gmail", "outlook", "bigpond") before sending so the connect prompt and the send go to the right place. If you don't know yet and they ask you to email someone, ask once which email they use.
- When a task could go to more than one place (e.g. a receipt could go to a spreadsheet or their accounting software) and their business details don't say which, ask once what they'd prefer, then remember the answer.
- Invoicing is built in, so treat it like any other thing you just do. You can write and send a real invoice yourself with create_photo_invoice (no account needed); it returns a link they forward to the client, and any job photos they've texted recently get embedded automatically. So when someone wants to invoice and hasn't set up accounting software, don't send them off to connect anything, just offer: "that's fine, i can write the invoice and send it out." For work where before/after shots matter (landscaping, cleaning, painting, detailing, renos, pressure washing), offer to put the photos on it. If you don't know how they get paid yet, offer to add their bank details (bsb + account, or payid) so it shows on the invoice, then remember them. If they've got Xero connected it's logged there too. After you make an invoice, send the link on its own line so it's one tap to forward, and if you've got the client's email offer to email it to them right now. When they say a client paid, call mark_invoice_paid.
- If the user seems to be forwarding a customer message they received, draft the reply they should send, in their voice, using their real pricing.
- Texting style: sound like a sharp mate. Casual, lowercase starts where natural, contractions always. One or two short sentences. Separate thoughts with a blank line to send as separate bubbles, max 3.
- No em dashes, no bullet points, no "Sure!", no "Absolutely!", no sign-offs.
- Never ask for something already in their business details above.`;
}

/**
 * Execute one registry tool, normalising errors into model-readable results.
 */
async function safeExecute(entry, ctx, args) {
  try {
    const outcome = await entry.tool.executor(ctx, args);
    return { ...outcome, ok: true };
  } catch (err) {
    if (err instanceof registry.ToolArgError) {
      return { result: `tool error: ${err.message}`, ok: false };
    }
    console.error(`[AgentLoop] ${entry.tool.name} failed:`, err?.message || err);
    return { result: `tool failed: ${String(err?.message || err).slice(0, 200)}. apologise briefly and suggest trying again`, ok: false };
  }
}

/**
 * Emit one tool_call_events row for an execution. Never throws.
 */
function recordToolEvent(entry, ctx, args, outcome, source) {
  logToolEvent(ctx, {
    toolName: entry.tool.name,
    capability: entry.capability.capability,
    provider: registry.providerFor(entry.capability, ctx, args),
    success: outcome?.ok !== false,
    source,
  });
}

function parseArgs(toolCall) {
  try {
    return JSON.parse(toolCall.function.arguments || '{}');
  } catch {
    return null;
  }
}

/**
 * When the agent acts on a tool that matches an open group-chat item, mark that
 * item actioned so it stops being suggested. Matching: same suggested_tool;
 * if several share it, prefer the one whose suggested_args overlaps. Mutates
 * openItems (removes the matched one). Fires on execute, confirm-park, or
 * connect-park alike — once the boss engages an item it shouldn't re-nag.
 */
async function reconcileActionedItem(openItems, toolName, args, supabase) {
  if (!openItems.length || !supabase) return;
  const candidates = openItems.filter((it) => it.suggested_tool === toolName);
  if (!candidates.length) return;

  let match = candidates[0];
  if (candidates.length > 1) {
    const argVals = new Set(Object.values(args || {}).map((v) => String(v).toLowerCase()));
    match = candidates.find((it) => Object.values(it.suggested_args || {}).some((v) => argVals.has(String(v).toLowerCase()))) || candidates[0];
  }

  openItems.splice(openItems.indexOf(match), 1);
  await supabase
    .from('group_action_items')
    .update({ status: 'actioned', updated_at: new Date().toISOString() })
    .eq('id', match.id)
    .then(() => {}, () => {});
}

// The unfinished task, phrased as a hook for the paywall upsell ("want me to
// send that invoice?"). Null falls back to a generic line.
function taskHookFor(name, args = {}) {
  switch (name) {
    case 'xero_send_invoice': return `send that invoice to ${args.client_name || 'them'}`;
    case 'draft_quote': return `quote ${args.client_name || 'that job'}`;
    case 'order_parts': return 'put that order in';
    case 'send_email': return 'send that email';
    case 'calendar_book_event': return 'book that in';
    case 'xero_log_expense':
    case 'sheets_log_expense': return 'keep logging your receipts';
    case 'log_timesheet': return 'log those hours';
    default: return null;
  }
}

async function gatedLinkBubble(capability, ctx, provider) {
  const authKind = registry.authKindFor(provider, capability);
  if (authKind === 'nango_oauth') {
    const link = await nango.createTextableConnectLink({ userId: ctx.user.id, phone: ctx.phone, provider });
    return `to do that i need access to ${capability.connectBlurb}, takes 10 sec: ${link}`;
  }
  if (authKind === 'credentials_apple') {
    return "to book into your apple calendar i need an icloud app-specific password (apple won't let me use your normal one). make one at appleid.apple.com under Sign-In and Security, then text me your icloud email and that password";
  }
  if (authKind === 'credentials_imap') {
    return "to send from your email i need your address and an app password (bigpond, icloud and the like won't take your normal password for apps). grab one from your email provider's security settings, then text me your email address and that app password";
  }
  return `i can do that through ${capability.connectBlurb}. what's your ${provider} login? email then password works`;
}

/**
 * The main turn. Mirrors the legacy routeIntent contract.
 */
async function runAgentTurn({ phone, user, message, supabase, connections, userIntegrations, pendingAction, imageNote, openActionItems }) {
  const brain = user?.business_brain || {};
  const ctx = buildCtx({ user, phone, supabase, connections, userIntegrations, brain });
  const client = getLLMClient('compatible');

  // Open group-chat items the boss may act on this turn. Mutated as items are
  // matched so each is reconciled at most once.
  const openItems = Array.isArray(openActionItems) ? [...openActionItems] : [];

  const history = await loadHistory(supabase, phone, message);
  const messages = [
    { role: 'system', content: buildSystemPrompt(ctx, imageNote, openItems) },
    ...history,
    { role: 'user', content: message },
  ];

  let parkedResult = null; // set when a gate fires — becomes the reply

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const raw = await client.chat.completions.create({
      model: QWEN_MODEL,
      messages,
      tools: registry.getOpenAITools(ctx),
      tool_choice: 'auto',
      parallel_tool_calls: true, // lets the model log several receipts in one turn
      max_tokens: 700,
      enable_thinking: false,
    });

    const choice = raw?.choices?.[0]?.message || {};
    const toolCalls = choice.tool_calls || [];

    if (!toolCalls.length) {
      const text = (choice.content || '').trim();
      return { reply: text || 'on it', intent: 'AGENT', ...(parkedResult || {}) };
    }

    messages.push({ role: 'assistant', content: choice.content || '', tool_calls: toolCalls });

    for (const toolCall of toolCalls) {
      const entry = registry.findTool(toolCall.function?.name);
      const args = entry ? parseArgs(toolCall) : null;
      const respond = (content) => messages.push({ role: 'tool', tool_call_id: toolCall.id, content });

      if (!entry) {
        respond(`unknown tool ${toolCall.function?.name}`);
        continue;
      }
      if (args === null) {
        respond('tool error: arguments were not valid JSON, try again');
        continue;
      }

      // Acting on a tool that matches an open group item retires it (whether it
      // executes, parks for confirm, or parks for connect below).
      await reconcileActionedItem(openItems, entry.tool.name, args, supabase);

      // Paywall gate — metered "doing" tools stop past the free budget (chat
      // and read-only tools stay free). No-op unless FLYNN_PAYWALL=1.
      if (registry.METERED_TOOLS.has(entry.tool.name)) {
        const gate = await billingGate.isEntitled({ user: ctx.user, phone, supabase, toolName: entry.tool.name });
        if (!gate.entitled) {
          const bubble = await billingGate.upsellBubble({ user: ctx.user, phone, taskHook: taskHookFor(entry.tool.name, args) });
          return { reply: bubble, intent: 'AGENT_PAYWALL' };
        }
      }

      const provider = registry.providerFor(entry.capability, ctx, args);

      // Connection gate — park the call and prompt the connect.
      if (!registry.connectionFor(entry.capability, ctx, args)) {
        if (!provider && entry.capability.dynamicProvider) {
          respond('tool error: no supplier known for this user, ask which supplier they order from');
          continue;
        }
        const bubble = await gatedLinkBubble(entry.capability, ctx, provider);
        return {
          reply: bubble,
          intent: 'AGENT_GATED',
          pendingAction: {
            action_type: entry.tool.name,
            action_data: args,
            confirmation_message: bubble,
            status: 'awaiting_connection',
            required_provider: provider,
            tool_name: entry.tool.name,
            tool_args: args,
            expires_at: new Date(Date.now() + GATED_ACTION_TTL_MS).toISOString(),
          },
        };
      }

      // Confirm gate — irreversible actions wait for an explicit yes.
      if (entry.tool.confirm) {
        const confirmation = entry.tool.confirmMessage
          ? entry.tool.confirmMessage(args, ctx)
          : `about to run ${entry.tool.name}. sound right?`;
        return {
          reply: confirmation,
          intent: 'AGENT_CONFIRM',
          pendingAction: {
            action_type: entry.tool.name,
            action_data: args,
            confirmation_message: confirmation,
            status: 'awaiting_confirmation',
            tool_name: entry.tool.name,
            tool_args: args,
            expires_at: new Date(Date.now() + CONFIRM_ACTION_TTL_MS).toISOString(),
          },
        };
      }

      // Execute.
      const outcome = await safeExecute(entry, ctx, args);
      recordToolEvent(entry, ctx, args, outcome, 'llm');
      respond(outcome.result || 'done');

      // save_login can unblock a parked action in the same turn.
      if (outcome.connectedProvider && pendingAction?.status === 'awaiting_connection'
        && pendingAction.required_provider === outcome.connectedProvider && pendingAction.tool_name) {
        const parkedEntry = registry.findTool(pendingAction.tool_name);
        if (parkedEntry?.tool.confirm) {
          const confirmation = parkedEntry.tool.confirmMessage
            ? parkedEntry.tool.confirmMessage(pendingAction.tool_args || {}, ctx)
            : pendingAction.confirmation_message;
          respond(`login saved. there's a parked action waiting on the user's confirmation, relay this question: "${confirmation}"`);
          parkedResult = {
            pendingAction: {
              action_type: pendingAction.tool_name,
              action_data: pendingAction.tool_args || {},
              confirmation_message: confirmation,
              status: 'awaiting_confirmation',
              tool_name: pendingAction.tool_name,
              tool_args: pendingAction.tool_args || {},
              expires_at: new Date(Date.now() + CONFIRM_ACTION_TTL_MS).toISOString(),
            },
          };
        } else if (parkedEntry) {
          const parkedOutcome = await safeExecute(parkedEntry, ctx, pendingAction.tool_args || {});
          recordToolEvent(parkedEntry, ctx, pendingAction.tool_args || {}, parkedOutcome, 'resumed');
          respond(`parked action ran now the login is saved: ${parkedOutcome.result}`);
          parkedResult = { clearPending: true };
        }
      }
    }
  }

  return { reply: "sorry, that got away from me. try asking again in one go", intent: 'AGENT', ...(parkedResult || {}) };
}

/**
 * Deterministic execution of a confirmed pending tool call ("yes" path).
 * Called from processMessage — no LLM involved.
 */
async function executePendingTool({ pendingAction, phone, user, supabase, connections, userIntegrations }) {
  const entry = registry.findTool(pendingAction.tool_name);
  if (!entry) return null; // legacy row — caller falls back to executeConfirmed()
  const ctx = buildCtx({
    user, phone, supabase, connections, userIntegrations,
    brain: user?.business_brain || {},
  });
  const outcome = await safeExecute(entry, ctx, pendingAction.tool_args || {});
  recordToolEvent(entry, ctx, pendingAction.tool_args || {}, outcome, 'confirmed');
  return outcome.userFacing || outcome.result || 'done';
}

/**
 * Resume a parked awaiting_connection action after its provider connects.
 * Called by the Nango webhook (and credential-save paths). Returns
 * { handled, bubbles } — caller texts the bubbles.
 */
async function resumeParkedAction(phone, provider, supabase) {
  const { data: pending } = await supabase
    .from('pending_actions')
    .select('*')
    .eq('user_phone', phone)
    .eq('status', 'awaiting_connection')
    .eq('required_provider', provider)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (!pending?.tool_name) return { handled: false, bubbles: [] };

  const entry = registry.findTool(pending.tool_name);
  if (!entry) {
    await supabase.from('pending_actions').delete().eq('id', pending.id);
    return { handled: false, bubbles: [] };
  }

  const { data: user } = await supabase
    .from('users')
    .select('id, phone, business_brain, onboarding_step, preferred_channel, subscription_status, trial_end_date, stripe_customer_id')
    .eq('phone', phone)
    .maybeSingle();

  const connections = await loadConnections(supabase, phone);
  const userIntegrations = {};
  const { data: integrations } = await supabase
    .from('user_integrations')
    .select('integration_type, credentials_encrypted')
    .eq('user_phone', phone);
  const { decryptCredentials } = require('../credentialCrypto');
  for (const row of integrations || []) userIntegrations[row.integration_type] = decryptCredentials(row.credentials_encrypted);

  const ctx = buildCtx({
    user, phone, supabase, connections, userIntegrations,
    brain: user?.business_brain || {},
  });

  // Irreversible tools still need the user's yes — flip to awaiting_confirmation.
  if (entry.tool.confirm) {
    const confirmation = entry.tool.confirmMessage
      ? entry.tool.confirmMessage(pending.tool_args || {}, ctx)
      : pending.confirmation_message;
    await supabase
      .from('pending_actions')
      .update({
        status: 'awaiting_confirmation',
        confirmation_message: confirmation,
        expires_at: new Date(Date.now() + CONFIRM_ACTION_TTL_MS).toISOString(),
      })
      .eq('id', pending.id);
    return { handled: true, bubbles: [confirmation] };
  }

  // Delete before executing so a webhook retry can't double-run the action.
  await supabase.from('pending_actions').delete().eq('id', pending.id);
  const outcome = await safeExecute(entry, ctx, pending.tool_args || {});
  recordToolEvent(entry, ctx, pending.tool_args || {}, outcome, 'resumed');
  return { handled: true, bubbles: [outcome.userFacing || outcome.result || 'done'] };
}

// Nango provider config keys → brain bookkeeping slugs + the line Flynn texts
// once a provider is live. Shared by the webhook, the /connected landing page,
// and the inbound poll-reconcile so all three announce a connection the same way.
const PROVIDER_TO_BRAIN_SLUG = {
  'google-calendar': 'google_calendar',
  'google-mail': 'gmail',
  'google-sheet': 'google_sheets',
  outlook: 'outlook',
};
const CONNECTED_BLURB = {
  'google-calendar': "calendar's in. i can check your week and book jobs straight into it now",
  'google-mail': "gmail's connected. i can find emails and send them for you now",
  'google-sheet': "sheets is connected. text me receipts and i'll log them for you",
  outlook: "outlook's connected. i can find your emails and send them for you now",
};

/**
 * Record a freshly-authorised Nango connection: upsert user_connections,
 * move the provider from pending → connected in the brain, resume whatever
 * was parked on it, and return the bubbles to text. Idempotent — the upsert
 * is keyed on (user_phone, provider) and resumeParkedAction deletes the parked
 * row before running, so calling this twice doesn't double-announce or
 * double-run. Shared by the webhook and the poll-reconcile path.
 */
async function recordNangoConnection({ supabase, user, provider, connectionId, accountLabel }) {
  const now = new Date().toISOString();
  await supabase
    .from('user_connections')
    .upsert({
      user_id: user.id,
      user_phone: user.phone,
      provider,
      auth_kind: 'nango_oauth',
      status: 'connected',
      nango_connection_id: connectionId,
      account_label: accountLabel || null,
      connected_at: now,
      updated_at: now,
    }, { onConflict: 'user_phone,provider' });

  const slug = PROVIDER_TO_BRAIN_SLUG[provider] || provider;
  const brain = user.business_brain || {};
  const pending = (brain._pending_integrations || []).filter((s) => s !== slug);
  const deferred = (brain._deferred_integrations || []).filter((s) => s !== slug);
  const connected = brain._connected_integrations || [];
  if (!connected.includes(slug)) connected.push(slug);
  await supabase
    .from('users')
    .update({
      business_brain: {
        ...brain,
        _pending_integrations: pending,
        _connected_integrations: connected,
        _deferred_integrations: deferred,
      },
    })
    .eq('id', user.id);

  const resumed = await resumeParkedAction(user.phone, provider, supabase);
  const blurb = CONNECTED_BLURB[provider];
  return resumed.handled && resumed.bubbles.length
    ? [blurb ? `${blurb.split('.')[0]}.` : 'connected.', ...resumed.bubbles]
    : [blurb || `${provider} is connected`];
}

/**
 * Poll Nango to see whether `provider` is now connected for this user, and if
 * so record it. This is how connect-completion works WITHOUT the Nango webhook
 * (free self-hosted Nango has no webhooks): the /connected landing page calls
 * it right after consent, and the inbound path calls it when the user has a
 * parked awaiting_connection row. connection_id is always users.id.
 * Returns { connected, bubbles }.
 */
async function reconcileNangoConnection({ supabase, user, provider }) {
  if (!user?.id) return { connected: false, bubbles: [] };
  // The connect-session flow auto-generates the connection_id, so resolve it by
  // end user (= users.id) rather than assuming it equals users.id.
  let connectionId = null;
  try {
    connectionId = await nango.findConnectionId(provider, user.id);
  } catch {
    connectionId = null;
  }
  if (!connectionId) return { connected: false, bubbles: [] };
  try {
    await nango.getToken(provider, connectionId); // confirm it's live
  } catch {
    return { connected: false, bubbles: [] };
  }
  const bubbles = await recordNangoConnection({ supabase, user, provider, connectionId });
  return { connected: true, bubbles };
}

module.exports = {
  runAgentTurn,
  executePendingTool,
  resumeParkedAction,
  recordNangoConnection,
  reconcileNangoConnection,
  loadConnections,
  buildCtx,
  safeExecute,
  recordToolEvent,
  PROVIDER_TO_BRAIN_SLUG,
  CONNECTED_BLURB,
};
