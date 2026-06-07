/**
 * Compose an OUTBOUND message from a spoken instruction — the proactive/initiation
 * case the keyboard draft pipeline doesn't cover (that one replies TO a customer
 * message; this one starts a new one). "Follow up with Sarah about the rental" →
 * ready-to-send drafts in the owner's voice, using their business context.
 */

const { getLLMClient } = require('../llmClient');
const { formatBusinessContext } = require('./businessContextFormatter');

const parseDrafts = (content, count) => {
  if (typeof content !== 'string') return [];
  let obj;
  try { obj = JSON.parse(content); } catch (_) {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return [];
    try { obj = JSON.parse(match[0]); } catch (_) { return []; }
  }
  const drafts = Array.isArray(obj?.drafts) ? obj.drafts : Array.isArray(obj) ? obj : [];
  return drafts.filter((d) => typeof d === 'string' && d.trim()).map((d) => d.trim()).slice(0, count);
};

/**
 * @param {{instruction: string, recipient?: string|null, businessContext?: string, toneSamples?: string[], draftCount?: number}} opts
 * @returns {Promise<{drafts: string[]}>}
 */
const composeOutbound = async ({
  instruction,
  recipient = null,
  businessContext = '',
  toneSamples = [],
  draftCount = 3,
} = {}) => {
  const text = (instruction || '').trim();
  if (!text) return { drafts: [] };

  const systemParts = [
    'You draft a short OUTBOUND text message for a small-business owner to send to a customer.',
    'The owner described what they want to say; write the actual message, ready to send.',
  ];
  if (recipient) systemParts.push(`The message is addressed to: ${recipient}.`);
  if (toneSamples.length) {
    systemParts.push(
      "Match the owner's writing voice from these examples of their own past texts (style only, never reuse wording):",
      toneSamples.slice(0, 8).map((s, i) => `${i + 1}. "${s}"`).join('\n')
    );
  } else {
    systemParts.push('Write in a warm, natural, casual human voice — never stiff or corporate.');
  }
  if (businessContext) systemParts.push(businessContext);
  systemParts.push(
    'Rules: 1-2 short sentences, sound like a real person texting, no placeholders like [name], only use real business facts above.',
    `Respond with ONLY a JSON object {"drafts": ["message 1", ...]} containing EXACTLY ${draftCount} distinct options. No prose, no markdown.`
  );

  const client = getLLMClient('compatible');
  const response = await client.chat.completions.create({
    enable_thinking: false,
    temperature: 0.8,
    max_tokens: 400,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemParts.join('\n\n') },
      { role: 'user', content: text },
    ],
  });
  return { drafts: parseDrafts(response?.choices?.[0]?.message?.content ?? '', draftCount) };
};

module.exports = { composeOutbound, formatBusinessContextPassthrough: formatBusinessContext };
