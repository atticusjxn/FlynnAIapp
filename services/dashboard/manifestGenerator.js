/**
 * Dashboard manifest generator.
 *
 * Hybrid: deterministic rules rank which widgets appear and in what order (from
 * tool_call_events usage + connected providers + recent jobs/customer_context),
 * then Qwen writes the per-business proactive copy for the surfaced widgets. The
 * result is a platform-agnostic JSON manifest persisted to dashboard_manifests
 * and rendered by flynn-dashboard (and later the iOS/Kotlin apps).
 *
 * Ranking and readiness are pure functions (exported for unit tests); the LLM
 * copy pass is isolated and degrades gracefully to templated copy on failure.
 */

const crypto = require('crypto');
const { getLLMClient } = require('../../llmClient');

const COPY_MODEL = process.env.SMS_LLM_MODEL || process.env.DRAFT_LLM_MODEL || 'qwen3.5-flash';
const SCHEMA_VERSION = 1;
const WINDOW_30D_MS = 30 * 24 * 60 * 60 * 1000;
const WINDOW_7D_MS = 7 * 24 * 60 * 60 * 1000;
const MODULE_LIMIT = 6;

const READY_MIN_DAYS = Number(process.env.DASHBOARD_READY_MIN_DAYS || 3);
const READY_MIN_EVENTS = Number(process.env.DASHBOARD_READY_MIN_EVENTS || 8);
const REGEN_STALE_HOURS = Number(process.env.DASHBOARD_REGEN_STALE_HOURS || 24);

// Brain keys that don't count as "substantive business knowledge" for readiness.
const BRAIN_BOOKKEEPING_KEYS = new Set([
  '_pending_integrations', '_connected_integrations', '_deferred_integrations',
  '_dashboard_announced_at', 'currency',
]);

/**
 * Widget catalog. Each widget maps to the agent capabilities it represents, the
 * connection provider slugs that count as "connected" for it, a default CTA
 * (namespaced action string), and a baseline weight so core widgets still show
 * for a brand-new user with no usage history.
 */
const WIDGETS = [
  {
    type: 'invoicing', title: 'Invoices', baseline: 0,
    capabilities: ['invoicing'], providers: ['xero'],
    actions: [{ label: 'New invoice', action: 'tool:xero_send_invoice' }],
    bindingSource: 'tool_call_events', bindingFilter: { capability: 'invoicing' },
  },
  {
    type: 'expenses', title: 'Expenses', baseline: 0,
    capabilities: ['expenses', 'expenses-accounting'], providers: ['google-sheet', 'xero'],
    actions: [{ label: 'Log expense', action: 'tool:sheets_log_expense' }],
    bindingSource: 'tool_call_events', bindingFilter: { capability: 'expenses' },
  },
  {
    type: 'calendar', title: 'Calendar', baseline: 0.2,
    capabilities: ['calendar'], providers: ['google-calendar', 'apple-calendar'],
    actions: [{ label: 'Book a job', action: 'tool:calendar_book_event' }],
    bindingSource: 'jobs', bindingFilter: { upcoming: true },
  },
  {
    type: 'email', title: 'Email', baseline: 0,
    capabilities: ['email'], providers: ['google-mail'],
    actions: [{ label: 'Send email', action: 'tool:gmail_send_email' }],
    bindingSource: 'tool_call_events', bindingFilter: { capability: 'email' },
  },
  {
    type: 'suppliers', title: 'Suppliers', baseline: 0,
    capabilities: ['supplies'], providers: '@suppliers',
    actions: [{ label: 'Order parts', action: 'tool:order_parts' }],
    bindingSource: 'business_brain', bindingFilter: { key: 'suppliers' },
  },
  {
    type: 'jobs_pipeline', title: 'Jobs', baseline: 0.5,
    capabilities: [], providers: [],
    actions: [{ label: 'View jobs', action: 'nav:/jobs' }],
    bindingSource: 'jobs', bindingFilter: {},
  },
  {
    type: 'clients_crm', title: 'Clients', baseline: 0.4,
    capabilities: [], providers: [],
    actions: [{ label: 'View clients', action: 'nav:/clients' }],
    bindingSource: 'customer_context', bindingFilter: {},
  },
  {
    type: 'business_brain', title: 'Your business', baseline: 0.1,
    capabilities: ['memory'], providers: [],
    actions: [{ label: 'Edit details', action: 'nav:/brain' }],
    bindingSource: 'business_brain', bindingFilter: {},
  },
  {
    type: 'connect_tools', title: 'Connect your tools', baseline: 0,
    capabilities: ['setup'], providers: [],
    actions: [{ label: 'Set up', action: 'tool:connect_tools' }],
    bindingSource: 'user_connections', bindingFilter: {},
  },
];

// OAuth provider slugs Flynn knows about — anything else connected is a supplier.
const KNOWN_OAUTH_PROVIDERS = new Set([
  'google-calendar', 'apple-calendar', 'google-mail', 'google-sheet', 'xero',
]);

function log1p(n) { return Math.log1p(Math.max(0, n || 0)); }

/**
 * Is a widget's provider connected? '@suppliers' means any connected provider
 * that isn't a known OAuth slug (i.e. a browserbase supplier login).
 */
function widgetConnected(widget, connectedProviders) {
  if (widget.providers === '@suppliers') {
    for (const p of connectedProviders) {
      if (!KNOWN_OAUTH_PROVIDERS.has(p)) return true;
    }
    return false;
  }
  if (!widget.providers || !widget.providers.length) return false;
  return widget.providers.some((p) => connectedProviders.has(p));
}

function usageFor(widget, usageMap) {
  return widget.capabilities.reduce((sum, cap) => sum + (usageMap[cap] || 0), 0);
}

/**
 * Deterministic ranking. Pure: inputs in, ordered module skeletons out.
 * @returns {Array<{ id, type, title, binding, actions, rank_score }>}
 */
function rankWidgets(inputs) {
  const {
    usage30 = {}, usage7 = {}, connectedProviders = new Set(),
    jobs30 = 0, confirmedFacts = 0, unconnectedCount = 0, totalUsage = 0,
  } = inputs;

  const scored = WIDGETS.map((w) => {
    const u30 = usageFor(w, usage30);
    const u7 = usageFor(w, usage7);
    const connected = widgetConnected(w, connectedProviders) ? 1 : 0;

    let score = 1.0 * log1p(u30) + 0.6 * log1p(u7) + 0.4 * connected + w.baseline;

    if (w.type === 'jobs_pipeline') score += 0.3 * log1p(jobs30);
    if (w.type === 'clients_crm') score += 0.3 * log1p(confirmedFacts);
    // Surface setup early for a new user who hasn't connected much yet.
    if (w.type === 'connect_tools' && unconnectedCount > 0 && totalUsage < 5) score += 1.2;

    return { w, score: Math.round(score * 1000) / 1000 };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, MODULE_LIMIT).map(({ w, score }) => ({
    id: w.type,
    type: w.type,
    title: w.title,
    proactive: '', // filled by the LLM copy pass
    binding: { source: w.bindingSource, filter: w.bindingFilter },
    actions: w.actions,
    rank_score: score,
  }));
}

/**
 * Pick the hero. Prefers an actionable, high-confidence customer fact, then an
 * un-invoiced-completed-jobs nudge, then the top-ranked module as a prompt.
 */
function selectHero(inputs, modules) {
  const { topFacts = [], unInvoicedJobs = 0 } = inputs;

  const actionableFact = topFacts.find((f) => f.confidence >= 0.6 && f.label);
  if (actionableFact) {
    return {
      type: 'proactive_prompt',
      title: actionableFact.label,
      body: '', // LLM fills
      binding: { source: 'customer_context', subject_handle: actionableFact.handle || null },
      _seed: { kind: 'customer_fact', fact: actionableFact.fact, label: actionableFact.label },
    };
  }

  if (unInvoicedJobs > 0 && modules.some((m) => m.type === 'invoicing')) {
    return {
      type: 'proactive_prompt',
      title: 'Invoices',
      body: '',
      cta: { label: 'Send invoices', action: 'tool:xero_send_invoice' },
      binding: { source: 'jobs', filter: { status: 'completed', uninvoiced: true } },
      _seed: { kind: 'uninvoiced', count: unInvoicedJobs },
    };
  }

  const top = modules[0];
  return {
    type: 'proactive_prompt',
    title: top ? top.title : 'Your business',
    body: '',
    binding: top ? top.binding : { source: 'business_brain', filter: {} },
    _seed: { kind: 'top_module', moduleType: top?.type },
  };
}

/**
 * Readiness gate — only build/announce a dashboard once the user has actually
 * used Flynn for a few days. Pure.
 */
function computeReadiness(inputs) {
  const { activeDays = 0, totalEvents = 0, substantiveBrainKeys = 0 } = inputs;
  if (activeDays < READY_MIN_DAYS) return { ready: false, reason: `only ${activeDays} active days` };
  if (totalEvents < READY_MIN_EVENTS) return { ready: false, reason: `only ${totalEvents} tool events` };
  if (substantiveBrainKeys < 3) return { ready: false, reason: 'brain too thin' };
  return { ready: true, reason: 'ready' };
}

// ----------------------------------------------------------------------------
// Data gathering (impure — needs a service-role supabase client)
// ----------------------------------------------------------------------------

async function gatherInputs({ phone, supabase }) {
  const now = Date.now();
  const since30 = new Date(now - WINDOW_30D_MS).toISOString();
  const since7 = new Date(now - WINDOW_7D_MS).toISOString();

  const { data: userRow } = await supabase
    .from('users')
    .select('id, business_brain')
    .eq('phone', phone)
    .maybeSingle();
  const userId = userRow?.id || null;
  const brain = userRow?.business_brain || {};

  // Tool usage over the windows.
  const { data: events } = await supabase
    .from('tool_call_events')
    .select('capability, success, created_at')
    .eq('user_phone', phone)
    .gte('created_at', since30);
  const usage30 = {};
  const usage7 = {};
  const activeDaySet = new Set();
  for (const e of events || []) {
    if (e.success === false) continue;
    usage30[e.capability] = (usage30[e.capability] || 0) + 1;
    if (e.created_at >= since7) usage7[e.capability] = (usage7[e.capability] || 0) + 1;
    activeDaySet.add(String(e.created_at).slice(0, 10));
  }
  const totalUsage = Object.values(usage30).reduce((a, b) => a + b, 0);

  // Connected providers.
  const { data: conns } = await supabase
    .from('user_connections')
    .select('provider, status')
    .eq('user_phone', phone);
  const connectedProviders = new Set();
  for (const c of conns || []) if (c.status === 'connected') connectedProviders.add(c.provider);
  const unconnectedCount = Math.max(0, KNOWN_OAUTH_PROVIDERS.size - connectedProviders.size);

  // Recent jobs (user_id-keyed) + un-invoiced completed jobs as a proxy.
  let jobs30 = 0;
  let unInvoicedJobs = 0;
  if (userId) {
    const { data: jobs } = await supabase
      .from('jobs')
      .select('status, created_at')
      .eq('user_id', userId)
      .gte('created_at', since30);
    jobs30 = (jobs || []).length;
    // An invoice event in the same window means at least some were invoiced; this
    // is a coarse proxy — completed jobs with no invoicing usage at all.
    const completed = (jobs || []).filter((j) => String(j.status || '').toLowerCase() === 'completed').length;
    unInvoicedJobs = (usage30['invoicing'] || 0) === 0 ? completed : 0;
  }

  // Confirmed customer facts (user_id-keyed).
  let confirmedFacts = 0;
  let topFacts = [];
  if (userId) {
    const { data: facts } = await supabase
      .from('customer_context')
      .select('subject_handle, subject_label, fact, confidence')
      .eq('user_id', userId)
      .eq('status', 'confirmed')
      .order('confidence', { ascending: false })
      .limit(50);
    confirmedFacts = (facts || []).length;
    topFacts = (facts || []).slice(0, 5).map((f) => ({
      handle: f.subject_handle,
      label: f.subject_label,
      fact: f.fact,
      confidence: Number(f.confidence) || 0,
    }));
  }

  // Active days also draw on inbound messages (usage events can be sparse).
  const { data: msgs } = await supabase
    .from('sms_messages')
    .select('created_at')
    .eq('user_phone', phone)
    .gte('created_at', since30);
  for (const m of msgs || []) activeDaySet.add(String(m.created_at).slice(0, 10));

  const substantiveBrainKeys = Object.keys(brain).filter((k) => !BRAIN_BOOKKEEPING_KEYS.has(k)).length;
  const businessLabel = brain.business_name || brain.businessName || brain.name || null;
  const currency = brain.currency || currencyFromPhone(phone);

  return {
    phone, userId, brain,
    usage30, usage7, totalUsage,
    connectedProviders, unconnectedCount,
    jobs30, unInvoicedJobs,
    confirmedFacts, topFacts,
    activeDays: activeDaySet.size,
    totalEvents: totalUsage,
    substantiveBrainKeys,
    businessLabel, currency,
  };
}

function currencyFromPhone(phone = '') {
  if (phone.startsWith('+64')) return 'NZD';
  if (phone.startsWith('+44')) return 'GBP';
  if (phone.startsWith('+1')) return 'USD';
  return 'AUD';
}

/**
 * Stable hash of the ranking inputs — when unchanged, skip regen (and LLM spend).
 */
function hashInputs(inputs) {
  const shape = {
    usage30: inputs.usage30,
    connected: [...inputs.connectedProviders].sort(),
    jobs30: inputs.jobs30,
    confirmedFacts: inputs.confirmedFacts,
    unInvoicedJobs: inputs.unInvoicedJobs,
    brainKeys: Object.keys(inputs.brain || {}).sort(),
    topFacts: (inputs.topFacts || []).map((f) => f.handle),
  };
  return crypto.createHash('sha256').update(JSON.stringify(shape)).digest('hex').slice(0, 32);
}

// ----------------------------------------------------------------------------
// LLM copy pass
// ----------------------------------------------------------------------------

function buildCopyPrompt(inputs, hero, modules) {
  const facts = [];
  for (const f of inputs.topFacts || []) facts.push(`- ${f.label}: ${f.fact}`);
  if (inputs.unInvoicedJobs > 0) facts.push(`- ${inputs.unInvoicedJobs} completed job(s) with no invoice sent yet`);
  if (inputs.jobs30 > 0) facts.push(`- ${inputs.jobs30} job(s) in the last 30 days`);

  const widgetList = modules.map((m) => `- ${m.id} (${m.title})`).join('\n');

  const system = `You write short proactive prompts for a tradesperson's business dashboard. Voice = a sharp mate: lowercase starts where natural, contractions, one short line each. No em dashes, no bullet points, no exclamation marks, no "Sure!"/"Absolutely!". Never invent names, amounts, or facts that aren't given. Return JSON only.`;

  const user = `Business: ${inputs.businessLabel || 'their business'} (${inputs.currency}).
Business details Flynn knows:
${JSON.stringify(inputs.brain, null, 2)}

Concrete facts to ground the copy (only use these, don't invent):
${facts.length ? facts.join('\n') : '- (none yet)'}

Write a hero prompt and one short proactive line per module below.
Modules:
${widgetList}

Return JSON exactly like:
{"hero":{"title":"<=40 chars","body":"<=90 chars"},"modules":{"<module_id>":"<=90 chars", ...}}
Every module id above must appear in "modules".`;

  return { system, user };
}

async function writeCopy(inputs, hero, modules) {
  try {
    const client = getLLMClient();
    const { system, user } = buildCopyPrompt(inputs, hero, modules);
    const raw = await client.chat.completions.create({
      model: COPY_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      enable_thinking: false,
      max_tokens: 500,
    });
    const text = raw?.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(text);
    return {
      hero: parsed.hero || {},
      modules: parsed.modules || {},
    };
  } catch (err) {
    console.warn('[manifestGenerator] copy pass failed, using fallback:', err?.message || err);
    return { hero: {}, modules: {} };
  }
}

function fallbackModuleCopy(type) {
  const map = {
    invoicing: 'send and track your invoices',
    expenses: 'log receipts and keep expenses tidy',
    calendar: "what's on this week",
    email: 'find and send emails',
    suppliers: 'order parts from your supplier',
    jobs_pipeline: 'your jobs at a glance',
    clients_crm: 'everything you know about your clients',
    business_brain: 'the details flynn remembers about your business',
    connect_tools: 'hook up your tools so flynn can do more',
  };
  return map[type] || '';
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

async function getCurrentManifest({ phone, supabase }) {
  const { data } = await supabase
    .from('dashboard_manifests')
    .select('*')
    .eq('user_phone', phone)
    .eq('is_current', true)
    .maybeSingle();
  return data || null;
}

async function isReadyForDashboard({ phone, supabase }) {
  const inputs = await gatherInputs({ phone, supabase });
  return computeReadiness(inputs);
}

/**
 * Build (or refresh) the manifest for a user.
 * @returns {{ manifest, version, skipped }}
 */
async function generateManifest({ phone, supabase, force = false }) {
  const inputs = await gatherInputs({ phone, supabase });
  const inputsHash = hashInputs(inputs);

  const current = await getCurrentManifest({ phone, supabase });
  if (!force && current && current.inputs_hash === inputsHash) {
    return { manifest: current.manifest, version: current.version, skipped: true };
  }

  // Deterministic skeleton.
  const modules = rankWidgets(inputs);
  const hero = selectHero(inputs, modules);

  // LLM copy pass (degrades gracefully).
  const copy = await writeCopy(inputs, hero, modules);
  hero.title = copy.hero.title || hero.title;
  hero.body = copy.hero.body || hero.body || '';
  for (const m of modules) {
    m.proactive = (copy.modules && copy.modules[m.id]) || fallbackModuleCopy(m.type);
  }
  delete hero._seed;

  const manifest = {
    schema_version: SCHEMA_VERSION,
    business_label: inputs.businessLabel,
    currency: inputs.currency,
    generated_at: new Date().toISOString(),
    hero,
    modules,
  };

  // Persist: flip prior current row, insert new version.
  const nextVersion = (current?.version || 0) + 1;
  if (current) {
    await supabase.from('dashboard_manifests').update({ is_current: false }).eq('id', current.id);
  }
  await supabase.from('dashboard_manifests').insert({
    user_id: inputs.userId,
    user_phone: phone,
    version: nextVersion,
    manifest,
    inputs_hash: inputsHash,
    generated_by: 'hybrid',
    is_current: true,
  });

  return { manifest, version: nextVersion, skipped: false };
}

/**
 * Whether the current manifest is stale enough to lazily regenerate on fetch.
 */
function isManifestStale(manifestRow) {
  if (!manifestRow) return true;
  const age = Date.now() - new Date(manifestRow.generated_at).getTime();
  return age > REGEN_STALE_HOURS * 60 * 60 * 1000;
}

module.exports = {
  generateManifest,
  getCurrentManifest,
  isReadyForDashboard,
  isManifestStale,
  // exported for unit tests:
  rankWidgets,
  selectHero,
  computeReadiness,
  hashInputs,
  WIDGETS,
};
