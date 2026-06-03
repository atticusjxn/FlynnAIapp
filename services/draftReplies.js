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

/**
 * Build the system + user prompt for a draft request.
 */
const buildPrompt = ({
  businessBrainText = '',
  toneSamples = [],
  messages = [],
  proposedSlots = [],
  draftCount = DEFAULT_DRAFT_COUNT,
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

  const userText = [
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
  messages = [],
  proposedSlots = [],
  draftCount = DEFAULT_DRAFT_COUNT,
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
    messages: cleanedMessages,
    proposedSlots,
    draftCount,
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
  buildPrompt,
  parseDrafts,
  generateDrafts,
};
