// services/priceCompare.js
//
// Real cross-supplier price comparison via the SerpApi Google Shopping engine.
// Given a product query ("17mm structural plywood 2400x1200"), returns the
// cheapest few AU sellers with prices (and availability when Google exposes it),
// so Flynn can say "Bunnings has it at $X, Mitre 10 cheaper at $Y" with real
// data before ordering. No official AU trade-supplier APIs exist, and per-store
// scraping is fragile; Google Shopping is the reliable, generalizing source.
//
// Needs SERPAPI_KEY. Degrades gracefully ({ available:false }) when unset so the
// agent can fall back to a plain order.

const SERPAPI_KEY = process.env.SERPAPI_KEY || process.env.SERP_API_KEY;
const SERP_ENDPOINT = 'https://serpapi.com/search.json';

function isConfigured() {
  return Boolean(SERPAPI_KEY);
}

// "$12.50" / "A$12.50" / "12.50" -> 1250 (cents), or null.
function priceToCents(p, extracted) {
  if (Number.isFinite(extracted)) return Math.round(extracted * 100);
  const m = String(p || '').replace(/[, ]/g, '').match(/(\d+(\.\d+)?)/);
  return m ? Math.round(parseFloat(m[1]) * 100) : null;
}

function availabilityFrom(r) {
  const hay = `${r.tag || ''} ${(r.extensions || []).join(' ')} ${r.delivery || ''} ${r.second_hand_condition || ''}`.toLowerCase();
  if (/out of stock|sold out|unavailable/.test(hay)) return 'out_of_stock';
  if (/in stock|in-store|pickup|available/.test(hay)) return 'in_stock';
  return null;
}

/**
 * comparePrices(query, opts) -> {
 *   available: boolean,
 *   results: [{ seller, title, priceCents, price, availability, link }]  // sorted cheapest-first
 * }
 */
async function comparePrices(query, { gl = 'au', hl = 'en', location = 'Australia', max = 6 } = {}) {
  if (!isConfigured()) return { available: false, results: [] };
  if (!query || !String(query).trim()) return { available: true, results: [] };

  const params = new URLSearchParams({
    engine: 'google_shopping',
    q: String(query).trim(),
    gl, hl, location,
    api_key: SERPAPI_KEY,
  });

  const res = await fetch(`${SERP_ENDPOINT}?${params}`, { method: 'GET' });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`SerpApi ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const rows = Array.isArray(json.shopping_results) ? json.shopping_results : [];

  const results = rows
    .map((r) => ({
      seller: r.source || r.seller || 'a supplier',
      title: r.title || '',
      priceCents: priceToCents(r.price, r.extracted_price),
      price: r.price || null,
      availability: availabilityFrom(r),
      link: r.product_link || r.link || null,
    }))
    .filter((r) => r.priceCents != null)
    .sort((a, b) => a.priceCents - b.priceCents)
    .slice(0, max);

  return { available: true, results };
}

module.exports = { comparePrices, isConfigured };
