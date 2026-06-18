/**
 * Public photo-invoice page — GET /i/:token
 *
 * Renders the hosted invoice a client receives: business header, the job photos
 * the operator texted embedded, line items, totals, an optional Pay button, and
 * a print-to-PDF action. Read-only, token-gated, no auth.
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { renderInvoiceHTML } = require('../services/photoInvoice');

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_SECRET;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

function notFound(res) {
  res.status(404).set('Content-Type', 'text/html; charset=utf-8').send(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;text-align:center;padding:64px 20px;color:#555">'
    + '<h2 style="font-weight:600">Invoice not found</h2><p>This link may have expired.</p></body>',
  );
}

router.get('/i/:token', async (req, res) => {
  if (!supabase) return notFound(res);
  const token = String(req.params.token || '');
  if (!token) return notFound(res);

  let inv;
  try {
    const { data } = await supabase
      .from('agent_invoices')
      .select('*')
      .eq('public_token', token)
      .maybeSingle();
    inv = data;
  } catch (e) {
    console.warn('[invoicePage] lookup failed:', e?.message);
    return notFound(res);
  }
  if (!inv) return notFound(res);

  // Best-effort first-view stamp (fire and forget).
  if (!inv.viewed_at) {
    supabase.from('agent_invoices')
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
