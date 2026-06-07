/**
 * "Flynn remembers" — durable per-customer/per-location facts that resurface in
 * future drafts. Facts arrive two ways: spoken voice notes (saved 'confirmed') and
 * passive extraction from the conversations Flynn drafts for (saved 'unconfirmed'
 * until the owner keeps them). Only 'confirmed' facts are ever injected — the owner
 * is always in the loop, matching CLAUDE.md "context deepens passively".
 *
 * Entity resolution is deliberately conservative: a fact is only injected when its
 * subject clearly appears in the current conversation. Better to remember nothing
 * than to leak the wrong customer's note.
 */

const { getLLMClient } = require('../llmClient');

const normalizeHandle = (s) =>
  (typeof s === 'string' && s.trim() ? s.toLowerCase().replace(/\s+/g, ' ').trim() : null);

/** Tolerant parse of the extractor's JSON into [{subject, fact, confidence}]. Pure. */
const parseFacts = (content) => {
  if (typeof content !== 'string') return [];
  let obj;
  try { obj = JSON.parse(content); } catch (_) {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return [];
    try { obj = JSON.parse(match[0]); } catch (_) { return []; }
  }
  const list = Array.isArray(obj?.facts) ? obj.facts : [];
  return list
    .map((f) => ({
      subject: typeof f.subject === 'string' && f.subject.trim() ? f.subject.trim().slice(0, 120) : null,
      fact: typeof f.fact === 'string' && f.fact.trim() ? f.fact.trim().slice(0, 300) : null,
      confidence: Number.isFinite(Number(f.confidence)) ? Math.max(0, Math.min(1, Number(f.confidence))) : 0.5,
    }))
    .filter((f) => f.fact);
};

/**
 * Keep only the remembered facts whose subject clearly appears in the current
 * conversation. Conservative substring match on the normalised handle/label.
 */
const matchFactsToConversation = (facts, messages) => {
  const hay = (messages || []).filter((m) => typeof m === 'string').join(' \n ').toLowerCase();
  if (!hay.trim()) return [];
  return (facts || []).filter((f) => {
    const handle = normalizeHandle(f.subject_handle) || normalizeHandle(f.subject_label);
    return handle && handle.length >= 3 && hay.includes(handle);
  });
};

/** Format up to N facts as a compact prompt block. Pure. */
const formatRememberedContext = (facts) => {
  const items = (facts || []).map((f) => f.fact).filter((f) => typeof f === 'string' && f.trim()).slice(0, 5);
  if (!items.length) return '';
  return [
    'Things Flynn remembers about this customer (use only if relevant, never force them in):',
    items.map((f) => `- ${f}`).join('\n'),
  ].join('\n');
};

const buildExtractorSystem = () => [
  'Extract any DURABLE facts worth remembering about the customer/property/job from this conversation — things useful for a future visit or reply (gate codes, pets, access notes, preferences, property details, recurring needs).',
  'Ignore one-off logistics (a specific time being discussed now), pleasantries, and anything already obvious.',
  'For each fact, give the subject it belongs to (the customer name or place) if identifiable, else null.',
  'Respond with ONLY JSON: {"facts": [{"subject": string|null, "fact": string, "confidence": 0..1}]}. Return {"facts": []} if nothing durable. No prose.',
].join('\n');

/**
 * Extract durable facts from a conversation. Best-effort — returns {facts: []} on
 * any failure so callers can fire-and-forget.
 * @param {{messages: string[]}} opts
 */
const extractFacts = async ({ messages = [] } = {}) => {
  const text = (messages || []).filter((m) => typeof m === 'string' && m.trim()).join('\n').trim();
  if (!text) return { facts: [] };
  try {
    const client = getLLMClient('compatible');
    const response = await client.chat.completions.create({
      enable_thinking: false,
      temperature: 0.2,
      max_tokens: 300,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildExtractorSystem() },
        { role: 'user', content: text },
      ],
    });
    return { facts: parseFacts(response?.choices?.[0]?.message?.content ?? '') };
  } catch (_) {
    return { facts: [] };
  }
};

module.exports = {
  normalizeHandle,
  parseFacts,
  matchFactsToConversation,
  formatRememberedContext,
  extractFacts,
};
