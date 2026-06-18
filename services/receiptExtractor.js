/**
 * Receipt extraction — one vision-model call (qwen3-vl-plus via the same
 * DashScope compatible client) turning photo(s) into structured expense data.
 *
 * Runs separately from the agent loop: the vision model isn't the tool model.
 * The extraction is injected into the agent turn as context, so the loop can
 * call sheets_log_expense with clean args (and the parked tool_args after a
 * connect gate are JSON, never the image).
 */

const { getLLMClient } = require('../llmClient');

const VISION_MODEL = process.env.VISION_LLM_MODEL || 'qwen3-vl-plus';

/**
 * @param {string[]} imageDataUrls data: URLs (base64) of the photos
 * @returns {Promise<{is_receipt: boolean, vendor?: string, date?: string,
 *   total_cents?: number, gst_cents?: number, category?: string,
 *   description?: string, confidence?: number, image_summary?: string} | null>}
 */
async function extractReceipt(imageDataUrls) {
  if (!Array.isArray(imageDataUrls) || !imageDataUrls.length) return null;

  const client = getLLMClient('compatible');
  const content = [
    ...imageDataUrls.map((url) => ({ type: 'image_url', image_url: { url } })),
    {
      type: 'text',
      text: `Look at the image(s). If it's a receipt, tax invoice or expense docket, extract the purchase. If not, briefly describe what it shows.

Return JSON only:
{
  "is_receipt": <boolean>,
  "vendor": "<store/business paid, e.g. Bunnings>",
  "date": "<YYYY-MM-DD from the receipt, or null>",
  "total_cents": <total paid in integer cents, or null>,
  "gst_cents": <GST/tax portion in integer cents, or null>,
  "category": "<one of: materials, fuel, tools, food, vehicle, office, other>",
  "description": "<one short line, e.g. '20x PVC pipe + fittings'>",
  "confidence": <0 to 1>,
  "image_summary": "<only when not a receipt: one line on what the image shows>"
}
Never invent amounts. If the total isn't readable, set total_cents to null and confidence low.`,
    },
  ];

  const raw = await client.chat.completions.create({
    model: VISION_MODEL,
    messages: [{ role: 'user', content }],
    max_tokens: 400,
    enable_thinking: false,
    response_format: { type: 'json_object' },
  });

  try {
    return JSON.parse(raw.choices[0].message.content);
  } catch {
    return null;
  }
}

module.exports = { extractReceipt };
