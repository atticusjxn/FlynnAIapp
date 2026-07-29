/**
 * Brain voice fill — turns a tradie talking about their business into structured
 * profile fields.
 *
 * The app records "I'm a plumber on the northern beaches, ninety dollar callout,
 * quotes are free, open seven to four weekdays" and shows the result back as
 * editable chips for confirmation. Nothing here writes to the database; the
 * client applies what the user ticks.
 *
 * The single most important behaviour is that it must NOT invent. Every future
 * quote and reply is built from this data, so a hallucinated callout fee becomes
 * a wrong price quoted to a real customer. Fields that weren't said are omitted,
 * not guessed.
 */

const { getLLMClient } = require('../llmClient');

const MODEL = process.env.DRAFT_LLM_MODEL || process.env.COMPAT_LLM_MODEL || 'qwen3.5-flash';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const PROMPT = `You extract business details from a tradesperson describing their own business out loud.

Return JSON only, with ONLY the keys they actually mentioned:
{
  "business_type": "<their trade, e.g. Plumber. Title case, 1-3 words>",
  "business_description": "<one sentence about the business, only if they clearly described it>",
  "pricing_notes": "<call-out fees, quoting policy, minimum charges, as they said it>",
  "service_area": "<suburbs/regions they cover, comma separated>",
  "services": [
    { "name": "<service>", "price_range": "<e.g. $180-$400 or from $2,100>", "typical_duration": "<e.g. 1-2 hrs>" }
  ],
  "hours": [
    { "day": "monday", "open": "07:00", "close": "16:00", "closed": false }
  ]
}

Rules:
- OMIT any key they did not mention. Do not include empty strings, empty arrays or nulls.
- Never invent a price, a suburb or an hour. If it wasn't said, leave it out.
- NEVER infer business_type from the services they listed. "we do blocked drains and hot
  water" is services only — they did not say their trade, so omit business_type. Only set
  it if they named it ("I'm a plumber", "we're a sparky outfit").
- Write money and times as digits everywhere, including pricing_notes: "ninety dollar
  callout, quotes are free" becomes "$90 callout, quotes free". Keep their wording,
  convert their numbers.
- Speech-to-text writes numbers as words: "ninety dollar callout" is $90, "seven to four" is 07:00-16:00.
- "weekdays" means monday to friday. "weekends" means saturday and sunday.
- Trade hours are almost always AM start / PM finish: "seven to four" is 07:00-16:00, not 07:00-04:00.
- Only include a day in "hours" if its hours were stated or clearly implied by "weekdays"/"weekends"/"every day".
- Use 24-hour HH:MM for open/close.
- If they say they're closed on a day, include it with "closed": true.
- If the audio is rambling or off-topic, return {}.`;

/** Clamp to HH:MM, or null. Guards against "7" or "7pm" slipping through. */
function normaliseTime(value) {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)?$/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const suffix = (m[3] || '').toLowerCase();
  if (Number.isNaN(hour) || hour > 23 || min > 59) return null;
  if (suffix === 'pm' && hour < 12) hour += 12;
  if (suffix === 'am' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function cleanString(value, max = 400) {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s || s.toLowerCase() === 'null' || s.toLowerCase() === 'unknown') return null;
  return s.slice(0, max);
}

/**
 * Drops anything malformed rather than passing it to the app. The client renders
 * whatever comes back as a confirmable chip, so junk here becomes junk the user
 * has to notice and untick.
 */
function sanitise(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};

  const businessType = cleanString(raw.business_type, 60);
  if (businessType) out.business_type = businessType;

  const description = cleanString(raw.business_description, 400);
  if (description) out.business_description = description;

  const pricing = cleanString(raw.pricing_notes, 300);
  if (pricing) out.pricing_notes = pricing;

  const area = cleanString(raw.service_area, 300);
  if (area) out.service_area = area;

  if (Array.isArray(raw.services)) {
    const services = raw.services
      .map((s) => {
        const name = cleanString(s?.name, 80);
        if (!name) return null;
        const entry = { name };
        const price = cleanString(s?.price_range, 60);
        if (price) entry.price_range = price;
        const duration = cleanString(s?.typical_duration, 40);
        if (duration) entry.typical_duration = duration;
        return entry;
      })
      .filter(Boolean)
      .slice(0, 12);
    if (services.length) out.services = services;
  }

  if (Array.isArray(raw.hours)) {
    const seen = new Set();
    const hours = raw.hours
      .map((h) => {
        const day = cleanString(h?.day, 12)?.toLowerCase();
        if (!day || !DAYS.includes(day) || seen.has(day)) return null;
        seen.add(day);
        if (h?.closed === true) return { day, closed: true };
        const open = normaliseTime(h?.open);
        const close = normaliseTime(h?.close);
        if (!open || !close) return null;
        return { day, open, close, closed: false };
      })
      .filter(Boolean);
    if (hours.length) out.hours = hours;
  }

  return out;
}

/**
 * @param {string} transcript what the user said
 * @returns {Promise<object>} subset of the profile fields; `{}` when nothing usable
 */
async function parseBrainVoice(transcript) {
  const text = typeof transcript === 'string' ? transcript.trim() : '';
  if (text.length < 3) return {};

  const client = getLLMClient('compatible');
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: PROMPT },
      { role: 'user', content: text.slice(0, 4000) },
    ],
    max_tokens: 700,
    temperature: 0,
    enable_thinking: false,
    response_format: { type: 'json_object' },
  });

  let parsed;
  try {
    parsed = JSON.parse(response.choices[0].message.content);
  } catch {
    return {};
  }
  return sanitise(parsed);
}

module.exports = { parseBrainVoice, sanitise, normaliseTime };
