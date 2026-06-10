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

const QWEN_MODEL = process.env.SMS_LLM_MODEL || process.env.DRAFT_LLM_MODEL || 'qwen3.5-flash';
const MAX_TOOL_ITERATIONS = 4;
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

function buildSystemPrompt(ctx, imageNote) {
  const now = new Date();
  const today = now.toLocaleDateString('en-CA', { timeZone: ctx.tz }); // YYYY-MM-DD
  const weekday = now.toLocaleDateString('en-AU', { timeZone: ctx.tz, weekday: 'long' });

  return `You are Flynn, a text-based assistant that runs the admin side of someone's work, right inside iMessage. You book jobs into their calendar, find and send emails, log expenses and receipts to a spreadsheet, send invoices through Xero, and order parts from their trade supplier.

Today is ${weekday} ${today} (${ctx.tz}). Currency: ${ctx.currency}.

Their business (use these real details, never invent prices or contacts):
${JSON.stringify(ctx.brain, null, 2)}

Tool connections right now: ${connectionSummary(ctx)}
${imageNote ? `\n${imageNote}\n` : ''}
Rules:
- Use the tools to actually do things. Don't describe what you could do, do it. If a tool's account isn't connected, call it anyway: the user gets a 10-second connect link and the action runs right after.
- Resolve relative dates ("thursday", "tomorrow arvo") to real YYYY-MM-DD dates using today's date above before calling a tool. Morning ~08:00, midday 12:00, arvo ~14:00 unless they said a time.
- If the user texts a login (email and password), call save_login with the right provider.
- When the user tells you something new about their business (a rate, a supplier, a client, a preference like where receipts get logged), call remember to save it. Never ask for something twice.
- When a task could go to more than one place (e.g. a receipt could go to a spreadsheet or their accounting software) and their business details don't say which, ask once what they'd prefer, then remember the answer.
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
    return await entry.tool.executor(ctx, args);
  } catch (err) {
    if (err instanceof registry.ToolArgError) {
      return { result: `tool error: ${err.message}` };
    }
    console.error(`[AgentLoop] ${entry.tool.name} failed:`, err?.message || err);
    return { result: `tool failed: ${String(err?.message || err).slice(0, 200)}. apologise briefly and suggest trying again` };
  }
}

function parseArgs(toolCall) {
  try {
    return JSON.parse(toolCall.function.arguments || '{}');
  } catch {
    return null;
  }
}

function gatedLinkBubble(capability, ctx, provider) {
  if (capability.auth_kind === 'nango_oauth') {
    const link = nango.createTextableConnectLink({ userId: ctx.user.id, phone: ctx.phone, provider });
    return `to do that i need access to ${capability.connectBlurb}, takes 10 sec: ${link}`;
  }
  return `i can do that through ${capability.connectBlurb}. what's your ${provider} login? email then password works`;
}

/**
 * The main turn. Mirrors the legacy routeIntent contract.
 */
async function runAgentTurn({ phone, user, message, supabase, connections, userIntegrations, pendingAction, imageNote }) {
  const brain = user?.business_brain || {};
  const ctx = buildCtx({ user, phone, supabase, connections, userIntegrations, brain });
  const client = getLLMClient('compatible');

  const history = await loadHistory(supabase, phone, message);
  const messages = [
    { role: 'system', content: buildSystemPrompt(ctx, imageNote) },
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
      parallel_tool_calls: false,
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

      const provider = registry.providerFor(entry.capability, ctx, args);

      // Connection gate — park the call and prompt the connect.
      if (!registry.connectionFor(entry.capability, ctx, args)) {
        if (!provider && entry.capability.dynamicProvider) {
          respond('tool error: no supplier known for this user, ask which supplier they order from');
          continue;
        }
        const bubble = gatedLinkBubble(entry.capability, ctx, provider);
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
    .select('id, phone, business_brain, onboarding_step, preferred_channel')
    .eq('phone', phone)
    .maybeSingle();

  const connections = await loadConnections(supabase, phone);
  const userIntegrations = {};
  const { data: integrations } = await supabase
    .from('user_integrations')
    .select('integration_type, credentials_encrypted')
    .eq('user_phone', phone);
  for (const row of integrations || []) userIntegrations[row.integration_type] = row.credentials_encrypted || {};

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
  return { handled: true, bubbles: [outcome.userFacing || outcome.result || 'done'] };
}

module.exports = { runAgentTurn, executePendingTool, resumeParkedAction, loadConnections };
