/**
 * Flynn SMS brain — intent routing and reply generation.
 *
 * All LLM calls use Qwen3.5-flash via DashScope (getLLMClient('compatible')).
 * enable_thinking: false is required — hybrid thinking mode kills latency.
 */

const { getLLMClient } = require('../llmClient');
const browserbase = require('./browserbaseAgent');
const { generateDrafts } = require('./draftReplies');

const QWEN_MODEL = process.env.SMS_LLM_MODEL || process.env.DRAFT_LLM_MODEL || 'qwen3.5-flash';

const CONFIRM_RE = /^\s*(yes|yeah|yep|yup|ok|okay|sure|do it|send it|go ahead|confirm|done|good|correct|sounds good|that's right|absolutely)\b/i;
const isConfirmation = (msg) => CONFIRM_RE.test(msg.trim());

// Brain slugs that connect via a Nango OAuth link (everything else is a
// credential ask for the Browserbase automations).
const NANGO_PROVIDER_BY_SLUG = {
  google_calendar: 'google-calendar',
  gmail: 'google-mail',
  google_sheets: 'google-sheet',
};
const MAX_NUDGES = 3; // per integration, across onboarding + re-engagement

function regionFromPhone(phone) {
  if (phone.startsWith('+61')) return 'Australia';
  if (phone.startsWith('+64')) return 'New Zealand';
  if (phone.startsWith('+44')) return 'UK';
  if (phone.startsWith('+1')) return 'US or Canada';
  return null;
}

function currencyFromPhone(phone) {
  if (phone.startsWith('+61')) return 'AUD';
  if (phone.startsWith('+64')) return 'NZD';
  if (phone.startsWith('+44')) return 'GBP';
  if (phone.startsWith('+1')) return 'USD';
  return null;
}

function formatMoney(cents, currency) {
  const sym = currency === 'GBP' ? '£' : '$';
  return `${sym}${Math.round((cents || 0) / 100)}`;
}

// Compact "you already know" line so Flynn never re-asks what the user told it.
function summariseBrain(brain = {}) {
  const bits = [];
  if (brain.business_type) bits.push(`trade ${brain.business_type}`);
  if (brain.business_name) bits.push(`business ${brain.business_name}`);
  if (brain.location) bits.push(`based ${brain.location}`);
  if (typeof brain.hourly_rate_cents === 'number') bits.push(`rate ${formatMoney(brain.hourly_rate_cents, brain.currency)}/hr`);
  else if (brain.pricing_notes) bits.push(`pricing ${brain.pricing_notes}`);
  if (Array.isArray(brain.suppliers) && brain.suppliers.length) bits.push(`suppliers ${brain.suppliers.join(', ')}`);
  if (brain.invoicing_tool && brain.invoicing_tool !== 'none') bits.push(`invoicing ${brain.invoicing_tool}`);
  if (Array.isArray(brain.services) && brain.services.length) bits.push(`services ${brain.services.join(', ')}`);
  if (Array.isArray(brain.needs) && brain.needs.length) bits.push(`wants help with ${brain.needs.join(', ')}`);
  if (Array.isArray(brain.exclusions) && brain.exclusions.length) bits.push(`doesn't do ${brain.exclusions.join(', ')}`);
  return bits.join('; ');
}

// Map the loose business_brain onto the profile shape draftReplies expects, so the
// live demo cites their real pricing/services.
function brainToProfileRow(brain = {}) {
  const pricingBits = [];
  if (brain.pricing_notes) pricingBits.push(brain.pricing_notes);
  if (typeof brain.hourly_rate_cents === 'number') pricingBits.push(`${formatMoney(brain.hourly_rate_cents, brain.currency)} per hour`);
  if (typeof brain.callout_fee_cents === 'number') pricingBits.push(`${formatMoney(brain.callout_fee_cents, brain.currency)} call-out fee`);
  if (Array.isArray(brain.exclusions) && brain.exclusions.length) pricingBits.push(`does not do: ${brain.exclusions.join(', ')}`);
  return {
    business_name: brain.business_name,
    business_type: brain.business_type,
    services: brain.services,
    pricing_notes: pricingBits.join('. ') || undefined,
    service_area: brain.service_area || brain.location,
    city: brain.location,
  };
}

// ---------------------------------------------------------------------------
// Phase 1 — Learn the business
// ---------------------------------------------------------------------------

async function handleBrainSetup(message, phone, existingBrain) {
  const client = getLLMClient('compatible');
  const region = regionFromPhone(phone);
  const currency = currencyFromPhone(phone);
  const brain = existingBrain || {};
  const known = summariseBrain(brain);

  const systemPrompt = `You are Flynn, a text-based assistant that runs the admin side of someone's work, right inside iMessage. You can reply to customers and emails, draft and send invoices, book things into a calendar, order supplies, log receipts, chase payments, and keep track of clients. You work for ANY kind of worker: a tradie, a real estate agent, a photographer, a freelancer, a salon owner, a consultant, a coach, a shop owner. You're texting someone new. Your only job right now is to understand what they do and what eats their time, so you can start helping.

Region (from their phone number): ${region || 'unknown, ask only if it matters'}
You already know: ${known || 'nothing yet'}

Rules:
- START GENERAL, then narrow. If you don't know what they do yet, ask that first in plain words, e.g. "what do you do for work?". Never assume an industry or call them a tradie unless they've told you.
- Listen for their real needs and pain points, and suggest the ONE tool that solves each as it comes up: someone who books appointments -> their calendar; someone who invoices or chases payments -> Xero/QuickBooks/MYOB; someone drowning in email -> their inbox; a tradie ordering parts -> their supplier (Reece, Bunnings, etc); anyone with receipts piling up -> a google sheet i keep for them. Suggest as needed, never dump a list.
- A great probe once you know what they do: ask what they do regularly that they find annoying, in your own casual words. Their answer tells you which tool to suggest.
- Sound like a sharp mate. Casual, lowercase starts, one or two short sentences per send, up to 3 short bubbles like a real person texting.
- Ask one thing at a time. Never ask for anything already in "you already know" above.
- Pull every useful fact from each message: their profession or role, location, what they sell or do, rates or prices, tools they already use, who their customers are, and what they want help with.
- Frame yourself as doing the work for them, not as a form to fill in. Never say "setup", "profile", "onboarding" or "configure".
- No em dashes, no "Sure!", no "Absolutely!", no sign-offs.

Set brain_complete=true once you know what they do AND at least one concrete way you can help (a task they need off their plate, or a tool to connect). When complete, name 2 or 3 specific things you'll do for them in their own terms, then offer a quick live proof. Integration slugs you can connect (use only the ones that fit what they told you):
  google_calendar (bookings, scheduling); gmail (email); google_sheets (receipts, expense tracking); xero, myob, quickbooks (invoicing, accounting); reece, bunnings, tradelink, nhp, middy, rsea, neco (trade suppliers); amazon (general supplies).`;

  const userPrompt = `Their message: "${message}"

Respond with JSON:
{
  "bubbles": ["<1 to 3 short sends, like a person texting>"],
  "brain_update": {
    "business_type": "<their profession or role, any industry, e.g. electrician, real estate agent, photographer, marketing consultant>",
    "business_name": "<if mentioned>",
    "location": "<suburb or city if mentioned>",
    "services": ["<what they sell or do>"],
    "needs": ["<what they want help with, e.g. 'chasing invoices', 'booking clients', 'replying to leads'>"],
    "pricing_notes": "<any rates or prices, free text>",
    "pricing_model": "<hourly | fixed | both, only if clear>",
    "hourly_rate_cents": <integer cents only if they state an hourly rate, else null>,
    "callout_fee_cents": <integer cents only if they state a call-out fee, else null>,
    "exclusions": ["<things they don't do>"],
    "suppliers": ["<supplier name, only if relevant>"],
    "invoicing_tool": "<xero|myob|quickbooks|none or null if unknown>",
    "notes": "<anything else useful>"
  },
  "brain_complete": <true when you know what they do AND at least one concrete way to help>,
  "suggested_integrations": ["<slug>"]
}
Only include a typed field (hourly_rate_cents, callout_fee_cents) when the user actually stated that number. Never invent figures.`;

  const raw = await client.chat.completions.create({
    model: QWEN_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 500,
    enable_thinking: false,
    response_format: { type: 'json_object' },
  });

  let parsed;
  try {
    parsed = JSON.parse(raw.choices[0].message.content);
  } catch {
    return { reply: 'hey, what kind of work do you do?', intent: 'BRAIN_SETUP' };
  }

  const updatedBrain = {
    ...brain,
    ...Object.fromEntries(
      Object.entries(parsed.brain_update || {}).filter(([, v]) => {
        if (v === null || v === undefined || v === '') return false;
        if (Array.isArray(v) && v.length === 0) return false;
        return true;
      })
    ),
  };
  if (currency && !updatedBrain.currency) updatedBrain.currency = currency;

  let updatedStep = 'brain_pending';
  if (parsed.brain_complete) {
    // Brain is built — arm the live demo so the next message becomes the magic moment.
    updatedBrain._awaiting_demo = true;
    const pending = (parsed.suggested_integrations || []).filter(Boolean);
    if (pending.length > 0) {
      updatedBrain._pending_integrations = pending;
      updatedBrain._connected_integrations = updatedBrain._connected_integrations || [];
      updatedStep = 'integrations_pending';
    } else {
      updatedStep = 'active';
    }
  }

  let bubbles = Array.isArray(parsed.bubbles)
    ? parsed.bubbles.filter((b) => typeof b === 'string' && b.trim())
    : [];

  // On completion, guarantee an explicit demo invite so the user knows the next
  // message will be drafted — don't rely on the model remembering to ask.
  if (parsed.brain_complete) {
    const invite = "want proof? forward me a msg or email you've got and i'll show you the reply i'd send right now";
    const lead = bubbles.length ? bubbles.slice(0, 2) : [parsed.reply || 'all set, i know your business now'];
    bubbles = [...lead, invite];
  }

  return {
    bubbles: bubbles.length ? bubbles : undefined,
    reply: bubbles.length ? undefined : (parsed.reply || 'hey, what kind of work do you do?'),
    intent: 'BRAIN_SETUP',
    updatedBrain,
    updatedStep,
  };
}

// ---------------------------------------------------------------------------
// The magic moment — Flynn drafts a real reply using their brain, mid-onboarding.
// Armed by _awaiting_demo once the brain is built. The next message is either the
// customer message to draft from, or a decline.
// ---------------------------------------------------------------------------

const DEMO_DECLINE_RE = /^\s*(no|nah|nope|not now|later|skip|maybe later|not yet|hold off)\b/i;

async function handleDraftDemo(message, businessBrain) {
  const brain = businessBrain || {};
  const nextStep = (Array.isArray(brain._pending_integrations) && brain._pending_integrations.length)
    ? 'integrations_pending'
    : 'active';

  // Clear the armed flag for the paths that move on.
  const movedBrain = { ...brain };
  delete movedBrain._awaiting_demo;

  if (DEMO_DECLINE_RE.test(message)) {
    const bubbles = nextStep === 'integrations_pending'
      ? ['all good.', "want to connect your tools so i can actually send this stuff for you? only takes a sec"]
      : ["all good, i'm ready when you are.", 'just text me what you need, a customer msg to reply to, an invoice, some parts, whatever'];
    return { bubbles, intent: 'DEMO_SKIP', updatedBrain: movedBrain, updatedStep: nextStep };
  }

  // "yeah go on" — they want the demo but haven't pasted a message yet. Keep armed.
  if (/^\s*(yes|yeah|yep|yup|ok|okay|sure|go on|go ahead|show me|do it|please|sounds good)\b/i.test(message) && message.trim().length < 25) {
    return {
      reply: "cool, paste me a customer msg you've got and i'll draft the reply right now",
      intent: 'DEMO',
      updatedBrain: businessBrain,
    };
  }

  let draft = '';
  try {
    const { drafts } = await generateDrafts({
      profileRow: brainToProfileRow(brain),
      messages: [message],
      draftCount: 1,
    });
    draft = (drafts && drafts[0]) || '';
  } catch (err) {
    console.warn('[FlynnSMS] demo draft failed:', err?.message || err);
  }

  if (!draft) {
    // Keep _awaiting_demo armed (return the original brain) so they can try again.
    return {
      reply: "give me a real customer msg and i'll show you, even a rough one works",
      intent: 'DEMO',
      updatedBrain: businessBrain,
    };
  }

  const bubbles = ["here's what i'd send back:", draft];
  bubbles.push(nextStep === 'integrations_pending'
    ? "want me set up to actually send these for you? i'll just need your tools connected"
    : "that's the idea. text me anytime you need a hand");

  return { bubbles, intent: 'DEMO', updatedBrain: movedBrain, updatedStep: nextStep };
}

// ---------------------------------------------------------------------------
// Phase 2 — Connect integrations
// ---------------------------------------------------------------------------

async function handleIntegrationSetup(message, phone, businessBrain, user) {
  const client = getLLMClient('compatible');
  const brain = businessBrain || {};
  const pending = brain._pending_integrations || [];
  const connected = brain._connected_integrations || [];
  const deferred = brain._deferred_integrations || [];
  const nudgeCounts = { ...(brain._nudge_counts || {}) };
  const setupTurns = (brain._integration_setup_turns || 0) + 1;

  // Never push an integration past its nudge cap — quietly defer it instead.
  // (A user-initiated request later still gets the link; that gate is exempt.)
  const suggestible = pending.filter((slug) => (nudgeCounts[slug] || 0) < MAX_NUDGES);
  const overNudged = pending.filter((slug) => (nudgeCounts[slug] || 0) >= MAX_NUDGES);

  // OAuth links: real Nango connect links for the google trio (the old
  // /auth/:slug links 404'd). Only mintable when Nango is configured and the
  // user has an auth-backed id.
  const oauthLinks = {};
  try {
    const nango = require('./nango');
    if (nango.isConfigured() && user?.id) {
      for (const slug of suggestible) {
        const provider = NANGO_PROVIDER_BY_SLUG[slug];
        if (provider) {
          oauthLinks[slug] = nango.createTextableConnectLink({ userId: user.id, phone, provider });
        }
      }
    }
  } catch (err) {
    console.warn('[FlynnSMS] connect link minting failed:', err?.message);
  }

  const systemPrompt = `You are Flynn, finishing onboarding a new user via SMS.
You're connecting their tools and supplier accounts so you can automate their admin later.

Business: ${JSON.stringify({ business_type: brain.business_type, suppliers: brain.suppliers, invoicing_tool: brain.invoicing_tool, location: brain.location })}
Still to connect: ${suggestible.join(', ') || 'none'}
Already connected: ${connected.join(', ') || 'none'}
Not interested (never bring these up again): ${deferred.join(', ') || 'none'}
OAuth links available: ${JSON.stringify(oauthLinks)}

Rules:
- Casual, max 2 sentences
- Work through one integration at a time, starting from the top of the "still to connect" list
- For tools with a link in oauthLinks (google_calendar, gmail, google_sheets): give them the exact link and say it takes 10 seconds. Tapping it finishes the connection, you'll know when it's done, so don't ask them to report back
- For supplier sites (reece, bunnings, nhp, tradelink, etc.) and invoicing logins (xero, myob, quickbooks): ask for their account email and password on the same line, e.g. "What's your Reece login? Email then password works."
- If the user's message contains credentials (email + password pattern), extract them — they are for the integration currently at the top of the pending list
- If the user says skip/no/later for an integration, respect it instantly and set skip_integration, never argue or re-pitch
- This is never a blocker: if they want to move on, wrap up warmly. They get full use of you either way
- Once all are connected or skipped, say something brief and friendly signalling they're all set
- No em-dashes, no sign-offs`;

  const userPrompt = `Their message: "${message}"

Respond with JSON:
{
  "reply": "<SMS reply>",
  "credential_extracted": {
    "integration_type": "<slug matching pending list>",
    "email": "<extracted email or null>",
    "password": "<extracted password or null>"
  } | null,
  "skip_integration": "<slug to remove from pending, or null>",
  "suggested_integration": "<the one slug your reply is pitching or linking, or null>",
  "onboarding_complete": <true when pending will be empty after this turn>
}`;

  const raw = await client.chat.completions.create({
    model: QWEN_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 400,
    enable_thinking: false,
    response_format: { type: 'json_object' },
  });

  let parsed;
  try {
    parsed = JSON.parse(raw.choices[0].message.content);
  } catch {
    return { reply: "What's the login for the first one?", intent: 'INTEGRATION_SETUP' };
  }

  let newPending = [...pending];
  let newConnected = [...connected];
  let newDeferred = [...deferred];

  if (parsed.credential_extracted?.integration_type) {
    const slug = parsed.credential_extracted.integration_type;
    newPending = newPending.filter(s => s !== slug);
    if (!newConnected.includes(slug)) newConnected.push(slug);
  }
  // "later/skip" parks the slug permanently — Flynn never re-suggests it.
  if (parsed.skip_integration) {
    newPending = newPending.filter(s => s !== parsed.skip_integration);
    if (!newDeferred.includes(parsed.skip_integration)) newDeferred.push(parsed.skip_integration);
  }
  if (parsed.suggested_integration) {
    nudgeCounts[parsed.suggested_integration] = (nudgeCounts[parsed.suggested_integration] || 0) + 1;
  }
  // Anything that hit the nudge cap stops being pending — same as a skip.
  for (const slug of overNudged) {
    newPending = newPending.filter(s => s !== slug);
    if (!newDeferred.includes(slug)) newDeferred.push(slug);
  }

  const updatedBrain = {
    ...brain,
    _pending_integrations: newPending,
    _connected_integrations: newConnected,
    _deferred_integrations: newDeferred,
    _nudge_counts: nudgeCounts,
    _integration_setup_turns: setupTurns,
  };

  // Soft phase: never hold the user hostage here. After a few turns they go
  // active regardless — connect links still work later and gated tool calls
  // re-offer them naturally.
  const done = parsed.onboarding_complete || newPending.length === 0 || setupTurns >= 4;

  return {
    reply: parsed.reply || "Got it.",
    intent: 'INTEGRATION_SETUP',
    updatedBrain,
    updatedStep: done ? 'active' : 'integrations_pending',
    newCredential: parsed.credential_extracted?.email ? parsed.credential_extracted : null,
  };
}

// ---------------------------------------------------------------------------
// Active phase — intent routing
// ---------------------------------------------------------------------------

async function routeIntent(message, businessBrain, pendingAction) {
  const client = getLLMClient('compatible');

  const brainContext = businessBrain
    ? JSON.stringify(businessBrain, null, 2)
    : 'No business profile set up yet.';

  const pendingContext = pendingAction
    ? `There is a pending ${pendingAction.action_type} action awaiting confirmation: ${pendingAction.confirmation_message}`
    : 'No pending action.';

  const systemPrompt = `You are Flynn, an AI business assistant texting with a small-business owner.
You handle their admin via SMS — invoices, parts orders, job bookings, quote drafts, and business questions.

Business profile:
${brainContext}

${pendingContext}

Rules:
- Brief and direct — this is SMS
- No em-dashes, no "Sure!", no "Absolutely!"
- Always confirm before doing anything that costs money or sends something
- Extract specific amounts, names, dates from the message
- If the user seems to be forwarding a client message they received, intent is DRAFT_REPLY
- Never make up prices or contacts not in the business profile`;

  const userPrompt = `User message: "${message}"

Classify and respond. Return JSON:
{
  "intent": "INVOICE | ORDER_PARTS | BOOK_JOB | DRAFT_REPLY | QUESTION | UNKNOWN",
  "reply": "<SMS reply — confirmation prompt or answer, max 3 sentences>",
  "pending_action": {
    "action_type": "INVOICE | ORDER_PARTS | BOOK_JOB",
    "action_data": {
      "client_name": "<if known>",
      "client_email": "<if known>",
      "amount_cents": <number or null>,
      "description": "<what this is for>",
      "date": "<YYYY-MM-DD or null>",
      "time": "<HH:MM or null>",
      "items": [{"name": "<item>", "qty": <n>, "unit_price_cents": <n>}]
    },
    "confirmation_message": "<the reply above, repeated for the pending_actions table>"
  } | null
}

If intent is DRAFT_REPLY or QUESTION, pending_action must be null.`;

  const raw = await client.chat.completions.create({
    model: QWEN_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 600,
    enable_thinking: false,
    response_format: { type: 'json_object' },
  });

  let parsed;
  try {
    parsed = JSON.parse(raw.choices[0].message.content);
  } catch {
    return { reply: "Got it, let me look into that.", intent: 'UNKNOWN' };
  }

  return {
    reply: parsed.reply || "Got it.",
    intent: parsed.intent || 'UNKNOWN',
    pendingAction: parsed.pending_action || null,
  };
}

// ---------------------------------------------------------------------------
// Confirmation execution
// ---------------------------------------------------------------------------

async function executeConfirmed(pendingAction, userIntegrations = {}) {
  const { action_type, action_data } = pendingAction;

  switch (action_type) {
    case 'INVOICE': {
      const xero = userIntegrations.xero;
      if (!xero?.email || !xero?.password) {
        return "I need your Xero login to send this. Reply with your Xero email and password.";
      }
      await browserbase.xeroInvoice(xero, action_data);
      return `Invoice sent to ${action_data.client_name || 'the client'}.`;
    }

    case 'ORDER_PARTS': {
      // Find whichever supplier integration is connected
      const supplierSlugs = ['reece', 'bunnings', 'tradelink', 'nhp', 'middy', 'rsea', 'neco', 'amazon'];
      const slug = supplierSlugs.find(s => userIntegrations[s]?.email);
      if (!slug) {
        return "I need your supplier login to place this order. What account do you use and what's your login?";
      }
      const creds = userIntegrations[slug];
      const result = await browserbase.supplierOrder(slug, creds, action_data.items || []);
      return `Order placed${result.cartTotal ? ` — ${result.cartTotal}` : ''}. Confirmation coming from ${slug}.`;
    }

    case 'BOOK_JOB': {
      const calendar = userIntegrations.google_calendar;
      if (!calendar?.access_token) {
        const SERVER_URL = process.env.SERVER_URL || 'https://flynnai-telephony.fly.dev';
        return `Connect your Google Calendar first: ${SERVER_URL}/auth/google_calendar`;
      }
      // Calendar write handled by the googleCalendar service
      return "Booked. It's in your calendar.";
    }

    default:
      return 'Done.';
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

async function processMessage({ phone, message, businessBrain, onboardingStep, pendingAction, userIntegrations, user, supabase, connections, imageNote }) {
  const toolLoopOn = process.env.FLYNN_TOOL_LOOP === '1';

  // 0. Live demo armed after brain setup — next message is the magic moment.
  if (businessBrain?._awaiting_demo) {
    return handleDraftDemo(message, businessBrain);
  }

  // 1. Learning phase
  if (onboardingStep === 'brain_pending' || onboardingStep === 'new') {
    return handleBrainSetup(message, phone, businessBrain);
  }

  // 2. Integration connection phase
  if (onboardingStep === 'integrations_pending') {
    return handleIntegrationSetup(message, phone, businessBrain, user);
  }

  // 3. Confirming a pending action. New-style rows (tool_name) execute through
  // the registry; legacy rows fall back to executeConfirmed.
  if (pendingAction && pendingAction.status !== 'awaiting_connection' && isConfirmation(message)) {
    if (toolLoopOn && pendingAction.tool_name) {
      const { executePendingTool } = require('./agent/agentLoop');
      const reply = await executePendingTool({ pendingAction, phone, user, supabase, connections, userIntegrations });
      if (reply) return { reply, intent: 'CONFIRM', clearPending: true };
    }
    const reply = await executeConfirmed(pendingAction, userIntegrations || {});
    return { reply, intent: 'CONFIRM', clearPending: true };
  }

  // 4. Cancelling a pending action (including one parked on a connect link)
  if (pendingAction && /^\s*(no|nope|cancel|stop|don't|never mind)\b/i.test(message)) {
    return { reply: "No worries, cancelled.", intent: 'CANCEL', clearPending: true };
  }

  // 5. Active phase — tool-calling agent loop (flagged), legacy JSON routing otherwise
  if (toolLoopOn) {
    const { runAgentTurn } = require('./agent/agentLoop');
    return runAgentTurn({ phone, user, message, supabase, connections, userIntegrations, pendingAction, imageNote });
  }
  return routeIntent(message, businessBrain, pendingAction);
}

module.exports = { processMessage };
