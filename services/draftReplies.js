/**
 * Draft replies service
 *
 * Core of Flynn's text co-pilot: given the customer's (possibly fragmented)
 * messages plus the user's Business Brain, tone samples, and any genuinely-free
 * calendar slots, produce N short, send-ready reply drafts in the user's own
 * casual voice.
 *
 * Model: cheap/fast OpenAI-compatible host (default Qwen qwen3.5-flash via
 * DashScope), selected via getLLMClient('compatible'). Validated learnings baked
 * in here: thinking disabled for latency, JSON *object* output for reliability,
 * and an explicit guard so the model never parrots the tone samples verbatim.
 */

const { getLLMClient } = require('../llmClient');
const { formatBusinessContext } = require('./businessContextFormatter');

const DEFAULT_DRAFT_COUNT = 4;

/**
 * Map a business_profiles DB row onto the shape formatBusinessContext expects.
 * DB columns differ from the formatter's field names (industry vs business_type,
 * hours_json vs business_hours, service_areas vs service_area).
 */
const profileRowToContext = (row = {}) => {
  if (!row || typeof row !== 'object') return {};
  let serviceArea = row.service_area || null;
  if (!serviceArea && Array.isArray(row.service_areas)) {
    serviceArea = row.service_areas.filter(Boolean).join(', ');
  } else if (!serviceArea && typeof row.service_areas === 'string') {
    serviceArea = row.service_areas;
  }
  return {
    business_name: row.business_name,
    business_type: row.business_type || row.industry,
    services: row.services,
    pricing_notes: row.pricing_notes,
    business_hours: row.business_hours || row.hours_json,
    service_area: serviceArea,
    city: row.city,
    state: row.state,
    cancellation_policy: row.cancellation_policy,
    payment_terms: row.payment_terms,
    booking_notice: row.booking_notice,
    faqs: row.faqs,
    ai_instructions: row.ai_instructions,
  };
};

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
const PRICE_RE = /(\$\s?\d|\bquote\b|\bprice[ds]?\b|\bcost[s]?\b|\bper hour\b|\b\d+\s?(?:dollars|bucks)\b)/i;
const TIME_RE = /\b(mon|tue|wed|thu|fri|sat|sun|today|tomorrow|tonight|morning|afternoon|evening|\d{1,2}(?::\d{2})?\s?(?:am|pm)|\d{1,2}\s?(?:am|pm))\b/i;
const GREETING_RE = /^(hi|hey|hello|g'?day|gday|morning|cheers|yo)\b/i;

/**
 * Derive lightweight "substance" preferences from the replies the owner has
 * picked before (passive learning beyond pure voice mimicry). Pure heuristics,
 * no extra model call. Returns a compact instruction block, or '' when there
 * isn't enough signal yet.
 */
const deriveLearnedPreferences = (pickedSamples = []) => {
  const samples = (pickedSamples || [])
    .filter((s) => typeof s === 'string' && s.trim().length > 0)
    .slice(0, 25);
  if (samples.length < 3) return ''; // not enough history to be confident

  const n = samples.length;
  const frac = (pred) => samples.filter(pred).length / n;
  const avgWords =
    samples.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / n;

  const lines = [];
  // Length: only assert when consistently short or notably long.
  if (avgWords <= 14) lines.push(`- Keep replies short (around ${Math.round(avgWords)} words).`);
  else if (avgWords >= 30) lines.push(`- Replies tend to be longer (around ${Math.round(avgWords)} words).`);

  const priceFrac = frac((s) => PRICE_RE.test(s));
  if (priceFrac >= 0.6) lines.push('- Usually mentions a price, quote or cost.');
  else if (priceFrac <= 0.15) lines.push('- Rarely talks price up front.');

  const timeFrac = frac((s) => TIME_RE.test(s));
  if (timeFrac >= 0.6) lines.push('- Often offers a specific day or time.');

  const emojiFrac = frac((s) => EMOJI_RE.test(s));
  if (emojiFrac >= 0.5) lines.push('- Often uses an emoji.');
  else if (emojiFrac <= 0.1) lines.push('- Rarely uses emoji.');

  const greetFrac = frac((s) => GREETING_RE.test(s.trim()));
  if (greetFrac >= 0.6) lines.push('- Usually opens with a quick greeting.');
  else if (greetFrac <= 0.15) lines.push('- Usually skips a greeting and gets to the point.');

  if (lines.length === 0) return '';
  return [
    'Learned preferences — patterns from replies this owner has actually picked before. Lean toward these (they describe substance, not just style):',
    lines.join('\n'),
  ].join('\n');
};

/**
 * Build the system + user prompt for a draft request.
 */
const buildPrompt = ({
  businessBrainText = '',
  toneSamples = [],
  pickedSamples = [],
  messages = [],
  proposedSlots = [],
  draftCount = DEFAULT_DRAFT_COUNT,
  source = null,
}) => {
  const systemParts = [
    'You draft SMS replies for a small-business owner (often a sole-trader tradesperson) replying to a customer who messaged them.',
  ];

  if (toneSamples.length > 0) {
    systemParts.push(
      "Match the owner's writing voice. These are examples of the owner's OWN past texts — study their slang, casing, punctuation, emoji use and vibe:",
      toneSamples.map((s, i) => `${i + 1}. "${s}"`).join('\n'),
      'IMPORTANT: the examples above are STYLE references only. Never copy or reuse them. Every draft must directly respond to THIS customer.'
    );
  } else {
    systemParts.push('Write in a warm, natural, casual human voice — never stiff or corporate.');
  }

  const learnedPreferences = deriveLearnedPreferences(pickedSamples);
  if (learnedPreferences) {
    systemParts.push(learnedPreferences);
  }

  if (businessBrainText) {
    systemParts.push(businessBrainText);
  }

  if (proposedSlots.length > 0) {
    systemParts.push(
      `These calendar times are genuinely free — you may offer one if the customer is trying to book or asking when you can come: ${proposedSlots.join(', ')}.`
    );
  }

  systemParts.push(
    'Rules:',
    '- Sound like a real person texting. Keep each reply to 1-2 short sentences.',
    '- Be helpful and move toward booking the job, but never pushy.',
    '- Only use pricing/services/hours from the business info above. Never invent prices or promises.',
    '- Do not include placeholders like [name]; write a complete, send-ready message.',
    `Respond with ONLY a JSON object of the form {"drafts": ["reply 1", "reply 2", ...]} containing EXACTLY ${draftCount} distinct reply options. No other keys, no prose, no markdown.`
  );

  // Screenshot captures contain the whole visible conversation (both sides + app
  // chrome); clipboard captures are just the customer's copied message(s).
  const userText = source === 'screenshot'
    ? [
        "This is the text Flynn read from a screenshot of the conversation — it may include BOTH the customer's messages and the owner's own earlier replies, plus app chrome like names and timestamps. Focus on the latest customer message and draft the owner's next reply:",
        messages.join('\n'),
      ].join('\n')
    : [
        'The customer sent the following (it may arrive in fragments — treat it as one conversation):',
        messages.map((m) => `- ${m}`).join('\n'),
      ].join('\n');

  return {
    system: systemParts.join('\n\n'),
    user: userText,
  };
};

/**
 * Parse the model's JSON-object response into an array of draft strings.
 */
const parseDrafts = (content, draftCount) => {
  if (typeof content !== 'string') return [];
  let obj;
  try {
    obj = JSON.parse(content);
  } catch (_) {
    // Fall back to extracting the first {...} block if the model wrapped it.
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return [];
    try {
      obj = JSON.parse(match[0]);
    } catch (_) {
      return [];
    }
  }
  const drafts = Array.isArray(obj?.drafts) ? obj.drafts : Array.isArray(obj) ? obj : [];
  return drafts
    .filter((d) => typeof d === 'string' && d.trim().length > 0)
    .map((d) => d.trim())
    .slice(0, draftCount);
};

/**
 * Generate reply drafts. Pure async function — no DB access here so it can be
 * unit-tested and reused. Caller supplies the profile row, tone samples, the
 * accumulated customer messages, and any proposed slots.
 *
 * Privacy: customer message text is used only to build the prompt and is NOT
 * persisted by this function.
 */
const generateDrafts = async ({
  profileRow = {},
  toneSamples = [],
  pickedSamples = [],
  messages = [],
  proposedSlots = [],
  draftCount = DEFAULT_DRAFT_COUNT,
  source = null,
} = {}) => {
  const cleanedMessages = (messages || [])
    .map((m) => (typeof m === 'string' ? m.trim() : ''))
    .filter(Boolean);

  if (cleanedMessages.length === 0) {
    return { drafts: [], usage: null };
  }

  const businessBrainText = formatBusinessContext(profileRowToContext(profileRow));
  const { system, user } = buildPrompt({
    businessBrainText,
    toneSamples,
    pickedSamples,
    messages: cleanedMessages,
    proposedSlots,
    draftCount,
    source,
  });

  const client = getLLMClient('compatible');
  const response = await client.chat.completions.create({
    // Validated defaults for the drafting task (see flynn_draft_model memory).
    enable_thinking: false,
    temperature: 0.8,
    max_tokens: 500,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  const content = response?.choices?.[0]?.message?.content ?? '';
  const drafts = parseDrafts(content, draftCount);
  return { drafts, usage: response?.usage ?? null };
};

module.exports = {
  DEFAULT_DRAFT_COUNT,
  profileRowToContext,
  deriveLearnedPreferences,
  buildPrompt,
  parseDrafts,
  generateDrafts,
};
