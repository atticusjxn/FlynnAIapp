/**
 * Onboarding understanding service
 *
 * Powers the new low-friction onboarding: the user types a one-line description
 * of what they do ("mobile dog groomer in Geelong"). From that (plus any scraped
 * website data) we ask the model to:
 *   1. normalise a starter Business Brain (type, services, rough pricing, hours), and
 *   2. invent 3 REALISTIC customer texts tailored to THAT trade, which the user
 *      then replies to so we capture their voice in context.
 *
 * Same cheap/fast model + JSON discipline as services/draftReplies.js.
 */

const { getLLMClient } = require('../llmClient');

const PROMPT_COUNT = 3;

const buildMessages = ({ description, websiteData }) => {
  const parts = [
    'You help onboard a small-business owner into an app that drafts their customer text replies.',
    `The owner describes what they do as: "${description}".`,
  ];

  if (websiteData && typeof websiteData === 'object') {
    const compact = {
      businessName: websiteData.businessName || websiteData.public_name,
      services: websiteData.services,
      hours: websiteData.businessHours || websiteData.hoursSummary,
      serviceArea: websiteData.serviceArea || websiteData.service_area,
    };
    parts.push(`Extra detail scraped from their website (may be partial): ${JSON.stringify(compact)}.`);
  }

  parts.push(
    'Do two things:',
    '1) Normalise a starter business profile. Infer sensible, realistic values; leave a field null if you genuinely cannot guess.',
    '2) Invent EXACTLY 3 short, realistic inbound customer text messages that someone would actually send THIS specific business (use the trade, services and locale). Make them varied: e.g. a price/availability enquiry, a booking request with a vague time, and a quick specific question. Casual SMS phrasing, lowercase is fine.',
    'Respond with ONLY this JSON object, no prose, no markdown:',
    '{"businessType": string|null, "services": [{"name": string, "price_range": string|null}], "pricingNote": string|null, "hoursSummary": string|null, "samplePrompts": [string, string, string]}',
  );

  return [
    { role: 'system', content: parts.join('\n\n') },
    { role: 'user', content: `Owner description: ${description}` },
  ];
};

const parseUnderstanding = (content) => {
  let obj;
  try {
    obj = JSON.parse(content);
  } catch (_) {
    const match = typeof content === 'string' ? content.match(/\{[\s\S]*\}/) : null;
    if (!match) return null;
    try { obj = JSON.parse(match[0]); } catch (_) { return null; }
  }
  if (!obj || typeof obj !== 'object') return null;

  const services = Array.isArray(obj.services)
    ? obj.services
        .filter((s) => s && typeof s.name === 'string' && s.name.trim())
        .map((s) => ({ name: s.name.trim(), price_range: s.price_range || null }))
        .slice(0, 12)
    : [];

  const samplePrompts = Array.isArray(obj.samplePrompts)
    ? obj.samplePrompts.filter((p) => typeof p === 'string' && p.trim()).map((p) => p.trim()).slice(0, PROMPT_COUNT)
    : [];

  return {
    businessType: typeof obj.businessType === 'string' ? obj.businessType.trim() : null,
    services,
    pricingNote: typeof obj.pricingNote === 'string' ? obj.pricingNote.trim() : null,
    hoursSummary: typeof obj.hoursSummary === 'string' ? obj.hoursSummary.trim() : null,
    samplePrompts,
  };
};

/**
 * Generate the normalized brain + tailored sample prompts.
 * Returns null on failure so the caller can fall back to generic prompts.
 */
const understandBusiness = async ({ description, websiteData } = {}) => {
  const desc = (description || '').trim();
  if (!desc) return null;

  const client = getLLMClient('compatible');
  const response = await client.chat.completions.create({
    enable_thinking: false,
    temperature: 0.7,
    max_tokens: 600,
    response_format: { type: 'json_object' },
    messages: buildMessages({ description: desc, websiteData }),
  });

  const content = response?.choices?.[0]?.message?.content ?? '';
  return parseUnderstanding(content);
};

// Used if the model is unavailable, so onboarding never dead-ends.
const FALLBACK_PROMPTS = [
  "Hi, do you have any availability this week and roughly how much do you charge?",
  "Hey, can you come out next week sometime? Let me know what works.",
  "Quick question — do you cover my area? I'm not too far from the centre of town.",
];

module.exports = {
  PROMPT_COUNT,
  buildMessages,
  parseUnderstanding,
  understandBusiness,
  FALLBACK_PROMPTS,
};
