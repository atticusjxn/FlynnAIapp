/**
 * Voice command intent router.
 *
 * Flynn's voice surface is a universal command bar, not a single feature: the
 * owner holds the mic and says whatever they want. This classifies the spoken
 * command into one intent and pulls out the structured fields each downstream
 * action needs. Vertical-agnostic — a tradie says "quote the Johnson job", a real
 * estate agent says "note the Oak St lockbox code" or "book an inspection Tuesday".
 *
 * One cheap JSON-object LLM call (reuses the draft model client). The TIME for a
 * calendar intent is only captured as the spoken phrase here; slotProposer does
 * the trusted parse downstream (same pattern as the keyboard booking).
 */

const { getLLMClient } = require('../llmClient');

const INTENTS = ['quote', 'calendar', 'reply', 'note', 'unknown'];

const buildSystem = ({ businessName } = {}) => {
  const who = businessName ? ` for ${businessName}` : '';
  return [
    `You are the voice command router for Flynn, an assistant${who} used by a small-business owner or professional.`,
    'The owner just spoke a short command. Pick the SINGLE best intent and extract fields. Intents:',
    '- "quote": create a price quote/invoice for a job (mentions hours, materials, travel, prices, or "quote/invoice X").',
    '- "calendar": book or schedule something at a time (a day/time plus an appointment, inspection, job or meeting).',
    '- "reply": draft a text/message/email to someone (mentions messaging/replying/following up with a person).',
    '- "note": record a fact to remember about a customer, property, or job (no action, just "remember/note that ...").',
    '- "unknown": unclear or none of the above.',
    'Respond with ONLY a JSON object:',
    '{"intent": one of [quote,calendar,reply,note,unknown],',
    ' "confidence": 0.0-1.0,',
    ' "title": a short label for the action (a few words),',
    ' "customer": the person/property/job it concerns, or null,',
    ' "datetime_text": the spoken day/time phrase VERBATIM if any (e.g. "Tuesday 3pm", "tomorrow arvo"), else null,',
    ' "recipient": for a reply, who it is to, else null,',
    ' "note": for a note intent, the exact fact to remember, else null,',
    ' "summary": one short sentence restating what they asked for}.',
    'Do not invent details that were not said. No prose, no markdown.',
  ].join('\n');
};

/**
 * Tolerant parse of the model's JSON-object response into a normalised intent.
 * Pure — unit-testable without the LLM. Unknown/garbage collapses to 'unknown'.
 */
const parseIntentResponse = (content, transcript = '') => {
  const fallback = {
    intent: 'unknown',
    confidence: 0,
    title: '',
    customer: null,
    datetimeText: null,
    recipient: null,
    note: null,
    summary: '',
    transcript,
  };
  if (typeof content !== 'string') return fallback;
  let obj;
  try {
    obj = JSON.parse(content);
  } catch (_) {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    try { obj = JSON.parse(match[0]); } catch (_) { return fallback; }
  }
  if (!obj || typeof obj !== 'object') return fallback;

  const str = (v, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
  const intent = INTENTS.includes(obj.intent) ? obj.intent : 'unknown';
  let confidence = Number(obj.confidence);
  if (!Number.isFinite(confidence)) confidence = intent === 'unknown' ? 0 : 0.5;
  confidence = Math.max(0, Math.min(1, confidence));

  return {
    intent,
    confidence,
    title: str(obj.title) || '',
    customer: str(obj.customer, 120),
    datetimeText: str(obj.datetime_text, 120),
    recipient: str(obj.recipient, 120),
    note: str(obj.note, 500),
    summary: str(obj.summary, 300) || '',
    transcript,
  };
};

/**
 * Classify a transcript into a structured intent.
 * @param {{transcript: string, businessName?: string}} opts
 */
const classifyIntent = async ({ transcript, businessName } = {}) => {
  const text = (transcript || '').trim();
  if (!text) return parseIntentResponse('', '');

  const client = getLLMClient('compatible');
  const response = await client.chat.completions.create({
    enable_thinking: false,
    temperature: 0.2,
    max_tokens: 300,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: buildSystem({ businessName }) },
      { role: 'user', content: text },
    ],
  });
  const content = response?.choices?.[0]?.message?.content ?? '';
  return parseIntentResponse(content, text);
};

module.exports = { INTENTS, buildSystem, parseIntentResponse, classifyIntent };
