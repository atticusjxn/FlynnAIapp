/**
 * Quote-style ingestion — learn how THIS owner quotes, whatever their trade.
 *
 * The owner captures a quote/invoice/proposal they've already sent; we infer their
 * conventions and store them so future voice/keyboard quotes come out in their
 * style. Deliberately vertical-agnostic: trades, consulting, creative, events,
 * health, real estate, education, SaaS, anything. Every field is optional and the
 * `extras` catch-all holds niche conventions, so no business is forced into a
 * tradesperson template.
 *
 * Multiple captures accumulate (mergeStyles) into a richer picture over time.
 */

const { getLLMClient } = require('../llmClient');

const uniqStrings = (arr, max = 12) => {
  const out = [];
  const seen = new Set();
  for (const v of arr || []) {
    if (typeof v !== 'string') continue;
    const t = v.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t.slice(0, 120));
    if (out.length >= max) break;
  }
  return out;
};

const str = (v, max = 600) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

const parseJson = (content) => {
  if (typeof content !== 'string') return null;
  try { return JSON.parse(content); } catch (_) {}
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch (_) { return null; }
};

/** Normalise the raw model object into our style shape. Pure. */
const parseStyle = (raw) => {
  const o = raw && typeof raw === 'object' ? raw : {};
  const tax = o.tax && typeof o.tax === 'object' ? o.tax : null;
  const lic = o.line_item_conventions && typeof o.line_item_conventions === 'object' ? o.line_item_conventions : {};
  const samples = Array.isArray(o.sample_line_items) ? o.sample_line_items : [];

  return {
    vertical: str(o.vertical, 80),
    pricing_models: uniqStrings(o.pricing_models, 8),     // hourly, fixed_price, per_unit, per_room, package, tiered, milestone, retainer, day_rate, commission, subscription, ...
    currency: str(o.currency, 12),
    tax: tax ? {
      label: str(tax.label, 40),                          // GST, VAT, Sales Tax, None, ...
      rate: Number.isFinite(Number(tax.rate)) ? Number(tax.rate) : null,
      mode: tax.mode === 'inclusive' || tax.mode === 'exclusive' ? tax.mode : null,
    } : null,
    line_item_conventions: {
      shows_quantity: typeof lic.shows_quantity === 'boolean' ? lic.shows_quantity : null,
      shows_unit: typeof lic.shows_unit === 'boolean' ? lic.shows_unit : null,
      unit_types: uniqStrings(lic.unit_types, 10),         // hours, days, units, rooms, sqm, sessions, milestones, words, photos, ...
      phrasing: str(lic.phrasing, 300),
    },
    sample_line_items: samples
      .map((s) => (s && typeof s === 'object' ? {
        description: str(s.description, 160),
        unit: str(s.unit, 40),
        note: str(s.note, 160),
      } : null))
      .filter((s) => s && s.description)
      .slice(0, 12),
    deposit: str(o.deposit, 200),
    payment_terms: str(o.payment_terms, 200),
    payment_methods: uniqStrings(o.payment_methods, 8),
    validity: str(o.validity, 120),
    sections: uniqStrings(o.sections, 14),                 // scope, terms, warranty, notes, milestones, deliverables, exclusions, ...
    tone: str(o.tone, 200),
    intro_blurb: str(o.intro_blurb, 600),
    closing_notes: str(o.closing_notes, 600),
    terms_text: str(o.terms_text, 1500),
    title_format: str(o.title_format, 120),                // e.g. "Quote — {job}", "Proposal for {client}"
    extras: o.extras && typeof o.extras === 'object' && !Array.isArray(o.extras) ? o.extras : null,
  };
};

/** Merge a freshly-captured style into the accumulated one. New non-null wins;
 *  arrays union; samples accumulate. Pure. */
const mergeStyles = (existing, incoming) => {
  const a = existing && typeof existing === 'object' ? existing : {};
  const b = incoming && typeof incoming === 'object' ? incoming : {};
  const pick = (k) => (b[k] != null && b[k] !== '' ? b[k] : (a[k] ?? null));
  const unionArr = (k, max = 14) => uniqStrings([...(a[k] || []), ...(b[k] || [])], max);

  return {
    vertical: pick('vertical'),
    pricing_models: unionArr('pricing_models', 8),
    currency: pick('currency'),
    tax: b.tax || a.tax || null,
    line_item_conventions: {
      shows_quantity: b.line_item_conventions?.shows_quantity ?? a.line_item_conventions?.shows_quantity ?? null,
      shows_unit: b.line_item_conventions?.shows_unit ?? a.line_item_conventions?.shows_unit ?? null,
      unit_types: uniqStrings([
        ...(a.line_item_conventions?.unit_types || []),
        ...(b.line_item_conventions?.unit_types || []),
      ], 10),
      phrasing: b.line_item_conventions?.phrasing || a.line_item_conventions?.phrasing || null,
    },
    sample_line_items: [
      ...(b.sample_line_items || []),
      ...(a.sample_line_items || []),
    ].slice(0, 12),
    deposit: pick('deposit'),
    payment_terms: pick('payment_terms'),
    payment_methods: unionArr('payment_methods', 8),
    validity: pick('validity'),
    sections: unionArr('sections', 14),
    tone: pick('tone'),
    intro_blurb: pick('intro_blurb'),
    closing_notes: pick('closing_notes'),
    terms_text: pick('terms_text'),
    title_format: pick('title_format'),
    extras: { ...(a.extras || {}), ...(b.extras || {}) },
  };
};

/** The effective tax rate (%) implied by a style: explicit rate, 0 for "none",
 *  else null (caller decides default). Pure. */
const styleTaxRate = (style) => {
  const tax = style?.tax;
  if (!tax) return null;
  if (typeof tax.label === 'string' && /none|no tax|exempt|0/i.test(tax.label) && !(Number(tax.rate) > 0)) return 0;
  if (Number.isFinite(Number(tax.rate))) return Number(tax.rate);
  return null;
};

/** Compact text block injected into the quote generator so output matches the
 *  owner's style. Pure — only includes fields that are present. */
const formatStyleForPrompt = (style) => {
  if (!style || typeof style !== 'object') return '';
  const lines = [];
  if (style.vertical) lines.push(`Business type: ${style.vertical}.`);
  if (style.pricing_models?.length) lines.push(`Typical pricing model(s): ${style.pricing_models.join(', ')}.`);
  if (style.currency) lines.push(`Currency: ${style.currency}.`);
  if (style.tax) {
    const r = Number.isFinite(Number(style.tax.rate)) ? `${style.tax.rate}%` : '';
    lines.push(`Tax: ${[style.tax.label, r, style.tax.mode].filter(Boolean).join(' ')}.`);
  }
  const lic = style.line_item_conventions || {};
  if (lic.unit_types?.length) lines.push(`Units used: ${lic.unit_types.join(', ')}.`);
  if (lic.phrasing) lines.push(`Line-item wording: ${lic.phrasing}`);
  if (style.sample_line_items?.length) {
    lines.push('Example line items from their past quotes:');
    style.sample_line_items.slice(0, 8).forEach((s) => {
      lines.push(`- ${[s.description, s.unit ? `(${s.unit})` : null].filter(Boolean).join(' ')}`);
    });
  }
  if (style.deposit) lines.push(`Deposit/terms: ${style.deposit}`);
  if (style.payment_terms) lines.push(`Payment terms: ${style.payment_terms}`);
  if (style.validity) lines.push(`Validity: ${style.validity}`);
  if (style.tone) lines.push(`Tone: ${style.tone}`);
  if (style.title_format) lines.push(`Title format: ${style.title_format}`);
  if (style.closing_notes) lines.push(`Usual closing note: ${style.closing_notes}`);
  if (lines.length === 0) return '';
  return ['The owner quotes in this style — match it:', ...lines].join('\n');
};

const buildExtractorSystem = () => [
  'You are analysing a quote, invoice, estimate, or proposal the business owner has already sent, to learn HOW THEY QUOTE.',
  'This could be ANY kind of business — a tradesperson, consultant, designer, photographer, events planner, cleaner, tutor, clinic, real estate agent, agency, SaaS, anything. Capture only the conventions THIS document actually shows. Never assume a trades/hourly template; leave fields null when not present.',
  'Extract their conventions into JSON with these (all optional) keys:',
  '{"vertical": their trade/niche in a few words,',
  ' "pricing_models": array (e.g. hourly, fixed_price, per_unit, per_room, package, tiered, milestone, retainer, day_rate, commission, subscription),',
  ' "currency": e.g. "AUD","$","£","€",',
  ' "tax": {"label": e.g. GST/VAT/Sales Tax/None, "rate": number percent, "mode": "inclusive"|"exclusive"},',
  ' "line_item_conventions": {"shows_quantity": bool, "shows_unit": bool, "unit_types": array (hours, days, rooms, sqm, sessions, milestones, photos, words...), "phrasing": how they word items},',
  ' "sample_line_items": [{"description": real example from the doc, "unit": string, "note": string}],',
  ' "deposit": their deposit convention, "payment_terms": e.g. "Net 14"/"due on completion", "payment_methods": array,',
  ' "validity": e.g. "valid 30 days", "sections": which sections the doc has (scope, terms, warranty, exclusions, milestones, deliverables...),',
  ' "tone": wording tone, "intro_blurb": any opening blurb, "closing_notes": any closing note, "terms_text": their terms & conditions wording verbatim if present,',
  ' "title_format": how they title it (e.g. "Quote — {job}"),',
  ' "extras": an object for any other niche-specific convention worth keeping}.',
  'Use null / omit anything not present. Do not invent. Respond with ONLY the JSON object.',
].join('\n');

/**
 * Extract a quote style from captured document text, merged onto any existing style.
 * @param {{ocrText: string, existingStyle?: object|null}} opts
 * @returns {Promise<object>} the merged style
 */
const extractQuoteStyle = async ({ ocrText, existingStyle = null } = {}) => {
  const text = (ocrText || '').trim();
  if (!text) return existingStyle ? parseStyle(existingStyle) : null;

  const client = getLLMClient('compatible');
  const response = await client.chat.completions.create({
    enable_thinking: false,
    temperature: 0.2,
    max_tokens: 900,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: buildExtractorSystem() },
      { role: 'user', content: text.slice(0, 8000) },
    ],
  });
  const fresh = parseStyle(parseJson(response?.choices?.[0]?.message?.content ?? '') || {});
  return existingStyle ? mergeStyles(parseStyle(existingStyle), fresh) : fresh;
};

module.exports = {
  parseStyle,
  mergeStyles,
  styleTaxRate,
  formatStyleForPrompt,
  extractQuoteStyle,
};
