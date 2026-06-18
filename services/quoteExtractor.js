/**
 * Turn a spoken job description into a structured quote.
 *
 * "4.5 hours, 100km travel, 80 bucks materials for the Johnson job" → priced line
 * items. The model proposes line items + descriptions; we compute every total in
 * code (never trust an LLM's arithmetic). Hourly/callout rates come from the
 * owner's Business Brain so "4.5 hours" becomes a real dollar figure; if no rate
 * is known we emit a clearly-flagged placeholder rather than a hallucinated price.
 */

const { getLLMClient } = require('../llmClient');
const { formatStyleForPrompt, styleTaxRate } = require('./quoteStyleExtractor');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Compute subtotal/tax/total from line items so the figures are always correct. */
const computeTotals = (lineItems, taxRate) => {
  const items = (Array.isArray(lineItems) ? lineItems : []).map((li) => {
    const quantity = Number(li.quantity) > 0 ? Number(li.quantity) : 1;
    const unitPrice = round2(li.unit_price);
    return {
      description: typeof li.description === 'string' ? li.description.slice(0, 200) : 'Item',
      quantity,
      unit_price: unitPrice,
      total: round2(quantity * unitPrice),
    };
  });
  const subtotal = round2(items.reduce((sum, li) => sum + li.total, 0));
  const rate = Number.isFinite(Number(taxRate)) ? Number(taxRate) : 10;
  const taxAmount = round2(subtotal * (rate / 100));
  return { lineItems: items, subtotal, taxRate: rate, taxAmount, total: round2(subtotal + taxAmount) };
};

const parseJson = (content) => {
  if (typeof content !== 'string') return null;
  try { return JSON.parse(content); } catch (_) {}
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch (_) { return null; }
};

const buildSystem = ({ pricingContext, defaultTaxRate, styleBlock }) => [
  'You convert a business owner\'s spoken job description into a price quote. The business could be ANY trade or profession — match how they actually quote.',
  styleBlock || '',
  pricingContext ? `The owner\'s pricing context:\n${pricingContext}` : 'No saved pricing was provided.',
  'Produce line items in their style and units (hours, days, rooms, sessions, units, milestones, packages — whatever fits). For quantities given against a known rate, multiply out.',
  'If a needed rate or price is NOT in the pricing/style context and was not spoken, still create the line item but set unit_price to 0 and prefix its description with "[set price] ".',
  'Never invent a specific price that was neither spoken nor in the context.',
  `Respond with ONLY JSON: {"title": short job title, "client_name": the customer if named else null, "line_items": [{"description": string, "quantity": number, "unit_price": number}], "tax_rate": number percent (default ${defaultTaxRate}), "notes": optional short note}. No prose.`,
].filter(Boolean).join('\n');

/**
 * @param {{transcript: string, pricingContext?: string, defaultTaxRate?: number, quoteStyle?: object|null}} opts
 * @returns {Promise<{title, clientName, lineItems, subtotal, taxRate, taxAmount, total, notes}>}
 */
const extractQuote = async ({ transcript, pricingContext = '', defaultTaxRate = 10, quoteStyle = null } = {}) => {
  const text = (transcript || '').trim();
  if (!text) return null;

  // A learned style overrides the tax default (e.g. UK VAT 20, US no sales tax,
  // tax-inclusive pricing) so we never force GST on a business that doesn't use it.
  const styleBlock = formatStyleForPrompt(quoteStyle);
  const styleTax = styleTaxRate(quoteStyle);
  const effectiveDefaultTax = styleTax != null ? styleTax : defaultTaxRate;

  const client = getLLMClient('compatible');
  const response = await client.chat.completions.create({
    enable_thinking: false,
    temperature: 0.3,
    max_tokens: 600,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: buildSystem({ pricingContext, defaultTaxRate: effectiveDefaultTax, styleBlock }) },
      { role: 'user', content: text },
    ],
  });
  const obj = parseJson(response?.choices?.[0]?.message?.content ?? '') || {};
  const { lineItems, subtotal, taxRate, taxAmount, total } = computeTotals(
    obj.line_items,
    obj.tax_rate ?? effectiveDefaultTax
  );

  return {
    title: typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim().slice(0, 120) : 'Quote',
    clientName: typeof obj.client_name === 'string' && obj.client_name.trim() ? obj.client_name.trim().slice(0, 120) : null,
    lineItems,
    subtotal,
    taxRate,
    taxAmount,
    total,
    notes: typeof obj.notes === 'string' && obj.notes.trim() ? obj.notes.trim().slice(0, 500) : null,
  };
};

module.exports = { extractQuote, computeTotals };
