/**
 * Public photo-invoice page — GET /i/:token
 *
 * Renders the hosted invoice a client receives: business header, the job photos
 * the operator texted embedded, line items, totals, an optional Pay button, and
 * a print-to-PDF action. Read-only, token-gated, no auth.
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { renderInvoiceHTML, normalizeInvoiceRow, moneyFull } = require('../services/photoInvoice');
const ogImage = require('../services/ogImage');

const OG_FALLBACK_IMAGE = 'https://flynnai.app/og-image.png';
const SERVER_URL = (
  process.env.SERVER_PUBLIC_URL || process.env.SERVER_URL || 'https://flynnai-telephony.fly.dev'
).replace(/\/$/, '');

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

/**
 * POST /i/:token/email  { to }
 *
 * Lets whoever is looking at the invoice send themselves (or their bookkeeper)
 * a copy. Public + token-gated like the page itself: knowing the token is
 * already enough to see the invoice, so this leaks nothing extra — but it only
 * ever sends the link, never an attachment, and is rate-limited per token.
 */
const emailHits = new Map(); // token -> [timestamps]
const EMAIL_WINDOW_MS = 10 * 60 * 1000;
const EMAIL_MAX_PER_WINDOW = 5;

function emailRateLimited(token) {
  const now = Date.now();
  const hits = (emailHits.get(token) || []).filter((t) => now - t < EMAIL_WINDOW_MS);
  if (hits.length >= EMAIL_MAX_PER_WINDOW) return true;
  hits.push(now);
  emailHits.set(token, hits);
  return false;
}

router.post('/i/:token/email', express.json(), async (req, res) => {
  const token = String(req.params.token || '');
  const to = String(req.body?.to || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return res.status(400).json({ error: "That email doesn't look right." });
  }
  if (emailRateLimited(token)) {
    return res.status(429).json({ error: 'Too many sends just now, try again shortly.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Email sending is not configured yet.' });
  }

  try {
    const found = await findInvoiceByToken(token);
    if (!found) return res.status(404).json({ error: 'Invoice not found.' });
    const inv = found.row;

    let bizName = 'Flynn';
    if (inv.user_phone) {
      const { data: u } = await supabase
        .from('users').select('business_brain').eq('phone', inv.user_phone).maybeSingle();
      bizName = u?.business_brain?.business_name || u?.business_brain?.business_type || bizName;
    }

    const amount = moneyFull(inv.total_cents, inv.currency || 'AUD');
    const link = `${SERVER_URL}/i/${token}`;
    const paid = inv.status === 'paid';
    const subject = paid
      ? `Receipt from ${bizName} — ${amount}`
      : `Invoice from ${bizName} — ${amount}`;

    const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:28px 24px;color:#101828">
  <p style="font-size:13px;color:#667085;margin:0 0 6px">${paid ? 'Receipt from' : 'Invoice from'}</p>
  <p style="font-size:19px;font-weight:650;margin:0 0 18px">${bizName}</p>
  <p style="font-size:42px;font-weight:750;letter-spacing:-1.2px;margin:0 0 20px">${amount}</p>
  <a href="${link}" style="display:inline-block;background:linear-gradient(180deg,#ff9a5c 0%,#f46430 46%,#d94e1c 100%);color:#fff;text-decoration:none;font-weight:620;font-size:16px;padding:15px 30px;border-radius:9999px;box-shadow:0 8px 24px -6px rgba(244,100,48,.5)">${paid ? 'View receipt' : 'View & pay invoice'}</a>
  <p style="font-size:13px;color:#667085;line-height:1.6;margin:22px 0 0">Open the link to see the full breakdown, job photos and payment options. You can save it as a PDF for Xero, MYOB or QuickBooks from there.</p>
  <p style="font-size:12px;color:#98a2b3;margin:22px 0 0">Sent via Flynn · flynnai.app</p>
</div>`;

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || 'Flynn <noreply@flynnai.app>',
        to: [to],
        subject,
        html,
      }),
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      console.warn('[invoicePage] resend failed:', resp.status, detail.slice(0, 200));
      return res.status(502).json({ error: "Couldn't send that just now." });
    }
    return res.json({ sent: true });
  } catch (e) {
    console.warn('[invoicePage] email failed:', e?.message);
    return res.status(500).json({ error: "Couldn't send that just now." });
  }
});

// Short alias: /p/:token renders the same page. Kept alongside /i/ so links
// already in the wild keep working while new sends can use the shorter path.
router.get('/p/:token', (req, res, next) => {
  req.url = `/i/${req.params.token}`;
  router.handle(req, res, next);
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
