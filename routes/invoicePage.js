/**
 * Public photo-invoice page — GET /i/:token
 *
 * Renders the hosted invoice a client receives: business header, the job photos
 * the operator texted embedded, line items, totals, an optional Pay button, and
 * a print-to-PDF action. Read-only, token-gated, no auth.
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { renderInvoiceHTML, normalizeInvoiceRow } = require('../services/photoInvoice');
const ogImage = require('../services/ogImage');

const OG_FALLBACK_IMAGE = 'https://flynnai.app/og-image.png';

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_SECRET;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

/**
 * Look a public token up in the unified invoice table, falling back to the
 * legacy agent_invoices table.
 *
 * Photo invoices now write to public.invoices; agent_invoices is retained
 * read-only so links already in the wild (and any row that predates the
 * migration) keep resolving. Returns a row normalised to the shape the
 * renderers expect, plus which table it came from.
 */
async function findInvoiceByToken(token, columns = '*') {
  if (!supabase || !token) return null;
  const { data: current } = await supabase
    .from('invoices').select(columns).eq('public_token', token).maybeSingle();
  if (current) return { row: normalizeInvoiceRow(current), table: 'invoices' };

  const { data: legacy } = await supabase
    .from('agent_invoices').select(columns).eq('public_token', token).maybeSingle();
  if (legacy) return { row: normalizeInvoiceRow(legacy), table: 'agent_invoices' };
  return null;
}

function notFound(res) {
  res.status(404).set('Content-Type', 'text/html; charset=utf-8').send(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;text-align:center;padding:64px 20px;color:#555">'
    + '<h2 style="font-weight:600">Invoice not found</h2><p>This link may have expired.</p></body>',
  );
}

// Dynamic OG card image for link previews. Renders a branded card showing the
// amount + status; falls back to a static image if anything goes wrong so the
// preview never breaks.
router.get('/i/:token/og.png', async (req, res) => {
  const token = String(req.params.token || '');
  try {
    if (!supabase || !token) throw new Error('no token');
    const found = await findInvoiceByToken(token);
    if (!found) throw new Error('not found');
    const inv = found.row;

    let business = {};
    const { data: u } = await supabase
      .from('users').select('business_brain').eq('phone', inv.user_phone).maybeSingle();
    if (u?.business_brain) business = u.business_brain;

    const png = await ogImage.renderCardPng(inv, business);
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=120'); // short — so it flips to Paid quickly
    return res.send(png);
  } catch (e) {
    console.warn('[invoicePage] og.png failed, using fallback:', e?.message);
    return res.redirect(302, OG_FALLBACK_IMAGE);
  }
});

router.get('/i/:token', async (req, res) => {
  if (!supabase) return notFound(res);
  const token = String(req.params.token || '');
  if (!token) return notFound(res);

  let found;
  try {
    found = await findInvoiceByToken(token);
  } catch (e) {
    console.warn('[invoicePage] lookup failed:', e?.message);
    return notFound(res);
  }
  if (!found) return notFound(res);
  const inv = found.row;

  // Best-effort first-view stamp (fire and forget), against whichever table
  // the row actually came from.
  if (!inv.viewed_at) {
    supabase.from(found.table)
      .update({ viewed_at: new Date().toISOString() })
      .eq('id', inv.id)
      .is('viewed_at', null)
      .then(() => {}, () => {});
  }

  let business = {};
  try {
    const { data: u } = await supabase
      .from('users')
      .select('business_brain')
      .eq('phone', inv.user_phone)
      .maybeSingle();
    if (u?.business_brain) business = u.business_brain;
  } catch { /* fall back to defaults */ }

  res.set('Content-Type', 'text/html; charset=utf-8').send(renderInvoiceHTML(inv, business));
});

module.exports = router;
