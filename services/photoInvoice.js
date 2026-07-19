/**
 * Photo invoices for the iMessage agent.
 *
 * Flow: the user texts Flynn job photos (stored to the `documents` bucket +
 * buffered per-phone by the inbound route), then says "invoice the henderson job
 * $180". The create_photo_invoice tool (toolRegistry.js) claims the buffered
 * photos, writes a `public.invoices` row, and returns a hosted link. This module
 * owns: photo storage, the buffer, persistence, and rendering the public page.
 *
 * The agent is phone-keyed, so this never touches the org-based public.invoices
 * (different shape entirely: decimal dollars vs cents, a generated
 * invoice_number, no public_token). Rows ARE stamped with org_id where one can
 * be resolved, so agent invoices are attributable to a business for the
 * system-of-record spine without changing which table owns them.
 */

const crypto = require('crypto');

const PHOTO_BUCKET = 'documents';
const BUFFER_MAX_AGE_HOURS = 12;
const BUFFER_MAX_PHOTOS = 8;

const SERVER_URL = (
  process.env.SERVER_PUBLIC_URL || process.env.SERVER_URL || 'https://flynnai-telephony.fly.dev'
).replace(/\/$/, '');

// GST is treated as inclusive (line items / amount are GST-inclusive totals),
// matching how Flynn drafts quotes ("Total inc GST").
function gstRate(currency) {
  if (currency === 'NZD') return 0.15;
  if (currency === 'AUD') return 0.10;
  return 0; // GBP/USD etc — no GST line
}

function splitTax(totalCents, currency) {
  const rate = gstRate(currency);
  if (!rate) return { subtotalCents: totalCents, taxCents: 0 };
  const taxCents = Math.round(totalCents - totalCents / (1 + rate));
  return { subtotalCents: totalCents - taxCents, taxCents };
}

function moneyFull(cents, currency) {
  const sym = currency === 'GBP' ? '£' : '$';
  const n = (Math.round(cents) / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sym}${n}`;
}

// Sum line items if they all carry amounts, else fall back to amount_cents.
function computeTotalCents(args) {
  const items = Array.isArray(args.line_items) ? args.line_items.filter((li) => li && li.description) : [];
  if (items.length && items.every((li) => Number.isFinite(Number(li.amount_cents)))) {
    return items.reduce((s, li) => s + Math.round(Number(li.amount_cents)), 0);
  }
  if (args.amount_cents != null && Number.isFinite(Number(args.amount_cents))) {
    return Math.round(Number(args.amount_cents));
  }
  return NaN;
}

// 6 bytes -> 8 url-safe chars (~2.8e14 combinations). Short enough to read out
// or fit neatly in an SMS, still far too large to guess, and the unique index
// on public_token catches any collision.
function newToken() {
  return crypto.randomBytes(6).toString('base64url');
}

function invoiceUrl(token) {
  return `${SERVER_URL}/i/${token}`;
}

function phoneSlug(phone) {
  return String(phone || 'x').replace(/[^a-zA-Z0-9]/g, '');
}

// ---------------------------------------------------------------------------
// Photo capture + buffer
// ---------------------------------------------------------------------------

// Upload one job photo (already a sane JPEG buffer) to the public documents
// bucket and buffer it for this phone. Returns { publicUrl, path } or null.
async function storeJobPhoto({ supabase, userPhone, jpegBuffer, summary = null }) {
  if (!supabase || !jpegBuffer?.length) return null;
  const path = `job-photos/${phoneSlug(userPhone)}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.jpg`;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, jpegBuffer, { contentType: 'image/jpeg', upsert: false });
  if (error) {
    console.warn('[photo-invoice] upload failed:', error.message);
    return null;
  }
  const publicUrl = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
  await supabase
    .from('job_photo_buffer')
    .insert({ user_phone: userPhone, storage_path: path, public_url: publicUrl, summary })
    .then(() => {}, (e) => console.warn('[photo-invoice] buffer insert failed:', e?.message));
  return { publicUrl, path };
}

// Claim the recent unconsumed job photos for this phone (oldest first, so
// before/after send-order is preserved), marking them consumed.
async function takeBufferedPhotos({ supabase, userPhone, maxAgeHours = BUFFER_MAX_AGE_HOURS, limit = BUFFER_MAX_PHOTOS }) {
  if (!supabase) return [];
  const since = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('job_photo_buffer')
    .select('id, public_url, summary')
    .eq('user_phone', userPhone)
    .eq('consumed', false)
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(limit);
  const rows = data || [];
  if (rows.length) {
    await supabase
      .from('job_photo_buffer')
      .update({ consumed: true })
      .in('id', rows.map((r) => r.id))
      .then(() => {}, (e) => console.warn('[photo-invoice] buffer consume failed:', e?.message));
  }
  return rows.map((r) => ({ url: r.public_url, summary: r.summary }));
}

// ---------------------------------------------------------------------------
// Persist
// ---------------------------------------------------------------------------

const cents = (c) => Math.round(Number(c) || 0) / 100;

/**
 * Persist a photo invoice to `public.invoices` — the single invoice table.
 *
 * Agent invoices used to live in a separate phone-keyed `agent_invoices` table
 * that never synced with the app's `public.invoices`, so an invoice Flynn
 * created over text was invisible in the app. invoices now carries the columns
 * that made that split necessary (public_token, photo_urls, currency,
 * user_phone) and has nullable org_id/invoice_number so an operator who isn't
 * in an org yet can still invoice.
 *
 * Money is stored as decimal dollars here (the app's shape) rather than the
 * integer cents the agent works in, and line items are written in the app's
 * {description, quantity, unit_price, total} shape so InvoiceDTO decodes them.
 */
async function saveInvoice(ctx, {
  clientName, clientHandle, clientEmail, lineItems, totalCents, message, dueDate, photoUrls,
}) {
  const currency = ctx.currency || 'AUD';
  const { subtotalCents, taxCents } = splitTax(totalCents, currency);
  const token = newToken();

  const items = (Array.isArray(lineItems) ? lineItems : []).map((li) => {
    const amount = cents(li.amount_cents);
    return {
      description: li.description || 'item',
      quantity: 1,
      unit_price: amount,
      total: amount,
      // Kept so the hosted page and anything else still reading the agent's
      // native shape keeps working without a translation layer.
      amount_cents: Math.round(Number(li.amount_cents) || 0),
    };
  });

  const row = {
    org_id: ctx.orgId || null,
    user_phone: ctx.phone,
    client_name: clientName,
    client_handle: clientHandle,
    client_email: clientEmail || null,
    client_phone: null,
    title: clientName || 'Invoice',
    line_items: items,
    subtotal: cents(subtotalCents),
    tax_rate: subtotalCents > 0 ? Math.round((taxCents / subtotalCents) * 10000) / 100 : 0,
    tax_amount: cents(taxCents),
    total: cents(totalCents),
    amount_paid: 0,
    amount_due: cents(totalCents),
    currency,
    photo_urls: photoUrls || [],
    notes: message || null,
    due_date: dueDate || null,
    issued_date: new Date().toISOString().slice(0, 10),
    public_token: token,
    status: 'sent',
  };

  if (ctx.supabase) {
    const { data, error } = await ctx.supabase.from('invoices').insert(row).select('*').single();
    if (error) throw new Error(`invoice save failed: ${error.message}`);
    // client_email isn't a column on invoices; carry it back in-memory for the
    // send step, which only needs it for this turn.
    return { invoice: { ...data, client_email: clientEmail || null }, url: invoiceUrl(token) };
  }
  return { invoice: { ...row, id: null, client_email: clientEmail || null }, url: invoiceUrl(token) };
}

// ---------------------------------------------------------------------------
// Render the public invoice page
// ---------------------------------------------------------------------------

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Present either invoice row shape to the renderers in the integer-cents shape
 * they were written against.
 *
 * New rows live in public.invoices (decimal dollars, stripe_payment_link_url);
 * legacy rows in agent_invoices (integer cents, stripe_payment_url). Rather
 * than fork the HTML/OG renderers, normalise once here so both render
 * identically and old links keep working.
 */
function normalizeInvoiceRow(inv) {
  if (!inv) return inv;
  const toCents = (v) => (v == null ? null : Math.round(Number(v) * 100));
  return {
    ...inv,
    total_cents: inv.total_cents != null ? inv.total_cents : toCents(inv.total),
    subtotal_cents: inv.subtotal_cents != null ? inv.subtotal_cents : toCents(inv.subtotal),
    tax_cents: inv.tax_cents != null ? inv.tax_cents : toCents(inv.tax_amount),
    stripe_payment_url: inv.stripe_payment_url || inv.stripe_payment_link_url || null,
    // invoices.notes carries what agent_invoices called `message`.
    message: inv.message != null ? inv.message : (inv.notes || null),
  };
}

// Flynn wordmark, inlined from flynn-ai-new-landingpage/assets/flynn-logo.svg
// (verified as the current full-word logo: charcoal #34302f + orange dot).
// Tight viewBox crops the 512-square artboard to the wordmark itself.
const FLYNN_WORDMARK = `<svg viewBox="40 128 432 258" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Flynn">
  <g fill="#34302f">
    <path d="M 52.3 217.5 L 118.0 217.5 L 119.1 218.3 L 119.4 219.1 L 119.4 243.5 L 118.8 244.3 L 84.2 244.6 L 83.7 245.1 L 83.7 280.3 L 116.7 280.8 L 117.5 282.2 L 117.5 306.1 L 117.0 307.1 L 115.9 307.7 L 84.8 307.7 L 83.9 308.2 L 83.7 373.7 L 83.1 374.5 L 81.8 375.0 L 53.3 375.0 L 52.3 374.8 L 51.2 373.4 L 51.2 218.8 L 52.3 217.5 Z"/>
    <path d="M 130.4 217.5 L 160.4 217.5 L 161.8 218.6 L 162.1 347.4 L 175.7 347.9 L 199.9 347.9 L 200.4 348.5 L 200.4 350.9 L 198.6 370.5 L 198.3 373.2 L 197.2 374.8 L 131.2 375.0 L 129.3 373.7 L 129.3 218.6 L 130.4 217.5 Z"/>
    <path d="M 183.5 217.5 L 216.3 217.5 L 217.6 218.6 L 224.6 261.8 L 227.5 286.2 L 228.1 287.0 L 228.9 286.2 L 229.7 281.6 L 239.4 218.6 L 240.4 217.5 L 271.6 217.5 L 272.6 218.6 L 272.4 221.0 L 244.5 324.0 L 244.5 372.9 L 244.2 374.0 L 243.4 374.8 L 214.1 375.0 L 213.1 374.8 L 212.0 373.4 L 212.0 324.8 L 187.3 234.7 L 182.7 219.4 L 182.7 218.3 L 183.5 217.5 Z"/>
    <path d="M 281.0 217.5 L 312.9 217.5 L 314.2 218.6 L 327.9 276.5 L 335.2 311.4 L 336.3 315.5 L 336.8 316.0 L 337.6 315.7 L 337.6 305.5 L 336.0 249.2 L 336.0 218.3 L 337.1 217.5 L 362.0 217.5 L 363.1 218.3 L 363.4 373.4 L 362.8 374.5 L 361.5 375.0 L 332.0 375.0 L 329.8 374.0 L 329.0 372.1 L 328.2 367.3 L 318.5 325.9 L 307.8 275.7 L 307.0 274.7 L 306.2 275.2 L 306.2 288.9 L 307.0 312.8 L 307.3 373.4 L 306.2 374.8 L 305.1 375.0 L 281.5 375.0 L 280.2 374.2 L 279.9 218.6 L 281.0 217.5 Z"/>
    <path d="M 377.9 217.5 L 410.3 217.5 L 411.4 218.3 L 417.9 244.1 L 428.3 290.2 L 433.2 314.4 L 434.0 316.0 L 435.0 315.5 L 435.0 307.9 L 434.5 299.3 L 433.7 263.9 L 433.4 218.8 L 434.5 217.5 L 459.5 217.5 L 460.8 218.6 L 460.8 373.7 L 460.3 374.5 L 458.9 375.0 L 429.4 375.0 L 428.1 374.8 L 426.7 373.7 L 422.1 355.4 L 405.2 277.9 L 404.7 275.7 L 403.9 274.7 L 403.1 275.2 L 403.1 290.0 L 404.2 324.6 L 404.2 373.4 L 403.1 374.8 L 401.7 375.0 L 378.9 375.0 L 377.1 374.2 L 376.5 372.9 L 376.5 219.1 L 376.8 218.3 L 377.9 217.5 Z"/>
  </g>
  <circle cx="368.7" cy="169.0" r="32.0" fill="#f46430"/>
</svg>`;

// Payment-method marks.
//
// NOTE: these are clean in-house renditions so the page is complete and
// on-brand today. Apple Pay and PayID are trademarks whose owners require
// their OFFICIAL artwork and specific clear-space/sizing rules in production
// (Apple Pay Marketing Guidelines; NPP Australia's PayID brand assets).
// Swap these for the official files before this page is used commercially.
const MARK_PAYID = `<svg viewBox="0 0 64 24" xmlns="http://www.w3.org/2000/svg" aria-label="PayID"><rect width="64" height="24" rx="6" fill="#7d3cf8"/><text x="32" y="16.5" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="11" font-weight="700" fill="#fff" text-anchor="middle" letter-spacing=".2">PayID</text></svg>`;
const MARK_APPLEPAY = `<svg viewBox="0 0 64 24" xmlns="http://www.w3.org/2000/svg" aria-label="Apple Pay"><rect width="64" height="24" rx="6" fill="#111"/><path d="M20.6 9.1c-.5.6-1.3 1-2 .9-.1-.8.3-1.6.7-2.1.5-.6 1.3-1 2-1 .1.8-.2 1.6-.7 2.2zm.7 1.1c-1.1-.1-2 .6-2.5.6s-1.3-.6-2.2-.6c-1.1 0-2.2.7-2.7 1.7-1.2 2-.3 5 .8 6.6.6.8 1.2 1.7 2.1 1.7.8 0 1.1-.5 2.1-.5s1.3.5 2.2.5 1.5-.8 2.1-1.6c.7-.9.9-1.8 1-1.8 0 0-1.9-.8-1.9-2.9 0-1.8 1.5-2.7 1.5-2.7-.8-1.2-2.1-1.3-2.5-1.3z" fill="#fff"/><text x="43" y="16.5" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="11" font-weight="600" fill="#fff" text-anchor="middle">Pay</text></svg>`;
const MARK_CARD = `<svg viewBox="0 0 64 24" xmlns="http://www.w3.org/2000/svg" aria-label="Card"><rect width="64" height="24" rx="6" fill="#eef0f4"/><rect x="12" y="8" width="40" height="9" rx="2" fill="#98a2b3"/><rect x="12" y="8" width="40" height="3" rx="1.5" fill="#667085"/></svg>`;

function renderInvoiceHTML(rawInv, business = {}) {
  const inv = normalizeInvoiceRow(rawInv);
  const currency = inv.currency || 'AUD';
  const bizName = business.business_name || business.business_type || 'My business';
  const ref = String(inv.public_token || '').slice(0, 6).toUpperCase();
  const photos = Array.isArray(inv.photo_urls) ? inv.photo_urls : [];
  const items = Array.isArray(inv.line_items) ? inv.line_items : [];
  const isPaid = inv.status === 'paid';

  const bankBsb = business.bank_bsb || business.bsb;
  const bankAcct = business.bank_account || business.account_number;
  const bankName = business.bank_account_name || business.account_name || bizName;
  const payid = business.payid || business.pay_id;
  const hasBank = Boolean(bankBsb && bankAcct) || Boolean(payid);

  // Line items tolerate both shapes: the app's {unit_price,total} and the
  // agent's {amount_cents}.
  const itemRows = items.map((li) => {
    const c = li.amount_cents != null
      ? Number(li.amount_cents)
      : Math.round(Number(li.total != null ? li.total : li.unit_price || 0) * 100);
    const qty = Number(li.quantity);
    const qtyBit = Number.isFinite(qty) && qty > 1
      ? `<span class="qty">${qty} &times; ${moneyFull(Math.round(c / qty), currency)}</span>` : '';
    return `<li class="item">
        <div class="item-main"><span class="item-desc">${esc(li.description || 'Item')}</span>${qtyBit}</div>
        <span class="item-amt">${moneyFull(c, currency)}</span>
      </li>`;
  }).join('');

  const photoTiles = photos.slice(0, 8).map((u) => `<img src="${esc(u)}" alt="Job photo" loading="lazy">`).join('');

  const cp = (v) => `<button class="copy" data-copy="${esc(v)}" type="button"><span>${esc(v)}</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>`;

  const payMethods = `
      <div class="methods">
        <div class="method">${MARK_PAYID}<span>Pay by bank, instantly</span></div>
        <div class="method">${MARK_APPLEPAY}<span>One tap on iPhone</span></div>
        <div class="method">${MARK_CARD}<span>Any debit or credit card</span></div>
      </div>`;

  const payBlock = isPaid
    ? `<div class="paid-banner"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg> Paid in full &mdash; thank you</div>`
    : `<section class="pay card">
        <h2>Pay this invoice</h2>
        ${inv.stripe_payment_url
          ? `<a class="btn btn-primary" href="${esc(inv.stripe_payment_url)}">Pay ${moneyFull(inv.total_cents, currency)}</a>`
          : `<button class="btn btn-primary" type="button" data-pay disabled>Pay ${moneyFull(inv.total_cents, currency)}</button>
             <p class="pay-soon">Card, Apple&nbsp;Pay and PayID are switching on shortly. In the meantime you can pay by bank transfer below.</p>`}
        ${payMethods}
      </section>`;

  const bankBlock = hasBank && !isPaid ? `
      <section class="card">
        <h2>Or pay by bank transfer</h2>
        <div class="bank">
          ${payid ? `<div class="bank-row"><span>PayID</span>${cp(payid)}</div>` : ''}
          ${bankBsb ? `<div class="bank-row"><span>BSB</span>${cp(bankBsb)}</div>` : ''}
          ${bankAcct ? `<div class="bank-row"><span>Account</span>${cp(bankAcct)}</div>` : ''}
          <div class="bank-row"><span>Name</span><b>${esc(bankName)}</b></div>
          <div class="bank-row"><span>Reference</span>${cp(ref)}</div>
        </div>
      </section>` : '';

  const title = `${bizName} · invoice ${moneyFull(inv.total_cents, currency)}`;
  const ogDesc = isPaid ? 'Paid · thanks!' : `Awaiting payment · due ${inv.due_date || 'on receipt'}`;
  const ogImg = inv.public_token ? `${SERVER_URL}/i/${inv.public_token}/og.png` : '';

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="theme-color" content="#ffffff">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(ogDesc)}">
${ogImg ? `<meta property="og:image" content="${esc(ogImg)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<style>
  *,*::before,*::after{box-sizing:border-box}
  :root{
    --ink:#101828; --muted:#667085; --line:#e7e9ee; --bg:#ffffff;
    --brand:#f46430; --brand-deep:#d94e1c;
  }
  html,body{margin:0;background:var(--bg);color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    -webkit-font-smoothing:antialiased}
  body{padding:0 0 56px}
  .wrap{max-width:560px;margin:0 auto;padding:0 20px}

  /* top bar */
  .top{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.82);
    backdrop-filter:saturate(180%) blur(14px);-webkit-backdrop-filter:saturate(180%) blur(14px);
    border-bottom:1px solid rgba(16,24,40,.06)}
  .top .wrap{display:flex;align-items:center;justify-content:space-between;height:58px}
  .brand{display:inline-flex;align-items:center}
  .brand svg{height:24px;width:auto;display:block}
  .secure{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);
    background:#f6f7f9;border:1px solid var(--line);padding:5px 10px;border-radius:999px}

  /* hero */
  .hero{padding:34px 0 8px;text-align:center}
  .from{font-size:13px;color:var(--muted);margin:0 0 6px}
  .biz{font-size:19px;font-weight:650;margin:0 0 18px}
  .amount{font-size:52px;font-weight:760;letter-spacing:-1.6px;line-height:1;margin:0}
  .status{display:inline-flex;align-items:center;gap:7px;margin-top:14px;font-size:13px;font-weight:560;
    padding:7px 14px;border-radius:999px}
  .status.due{background:#fff5ed;color:#b54708;border:1px solid #fde3cd}
  .status.paid{background:#ecfdf3;color:#027a48;border:1px solid #abefc6}

  /* cards */
  .card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:20px;margin-top:16px;
    box-shadow:0 1px 2px rgba(16,24,40,.04)}
  .card h2{font-size:13px;font-weight:620;text-transform:uppercase;letter-spacing:.55px;
    color:var(--muted);margin:0 0 14px}

  /* items */
  ul.items{list-style:none;margin:0;padding:0}
  .item{display:flex;justify-content:space-between;gap:16px;padding:11px 0;border-bottom:1px solid #f2f4f7}
  .item:last-child{border-bottom:0}
  .item-main{display:flex;flex-direction:column;gap:3px}
  .item-desc{font-size:15px;line-height:1.35}
  .qty{font-size:12.5px;color:var(--muted)}
  .item-amt{font-size:15px;font-weight:560;white-space:nowrap;font-variant-numeric:tabular-nums}
  .totals{margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}
  .trow{display:flex;justify-content:space-between;font-size:14px;color:var(--muted);padding:4px 0;
    font-variant-numeric:tabular-nums}
  .trow.grand{color:var(--ink);font-size:19px;font-weight:720;padding-top:10px}

  /* glassy buttons — translucent gradient, inner top sheen, soft outer glow */
  .btn{position:relative;display:flex;align-items:center;justify-content:center;gap:8px;
    width:100%;min-height:56px;padding:0 22px;border-radius:16px;border:1px solid rgba(255,255,255,.28);
    font-size:17px;font-weight:640;letter-spacing:.1px;color:#fff;text-decoration:none;cursor:pointer;
    isolation:isolate;overflow:hidden;
    transition:transform .16s cubic-bezier(.2,.8,.3,1),box-shadow .16s,filter .16s}
  .btn::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
    background:linear-gradient(180deg,rgba(255,255,255,.42) 0%,rgba(255,255,255,.10) 42%,rgba(255,255,255,0) 62%)}
  .btn::after{content:"";position:absolute;left:0;right:0;top:0;height:1px;pointer-events:none;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent)}
  .btn-primary{background:linear-gradient(180deg,#ff8a4c 0%,var(--brand) 52%,var(--brand-deep) 100%);
    box-shadow:0 10px 26px -6px rgba(244,100,48,.55),0 2px 6px rgba(16,24,40,.14),
      inset 0 -10px 20px rgba(255,255,255,.10)}
  .btn-primary:hover{transform:translateY(-1px);
    box-shadow:0 14px 32px -6px rgba(244,100,48,.62),0 3px 8px rgba(16,24,40,.16)}
  .btn-primary:active{transform:translateY(0) scale(.994)}
  /* "not wired yet" state: keep the full brand gradient (a washed-out button
     reads as broken), just drop the lift + glow so it doesn't invite a tap. */
  .btn[disabled]{cursor:default;box-shadow:0 2px 6px rgba(16,24,40,.12)}
  .btn[disabled]:hover{transform:none;box-shadow:0 2px 6px rgba(16,24,40,.12)}
  .btn-ghost{color:var(--ink);background:linear-gradient(180deg,#fff 0%,#f6f7f9 100%);
    border:1px solid var(--line);box-shadow:0 1px 2px rgba(16,24,40,.05);min-height:50px;font-size:15.5px}
  .btn-ghost::before{background:linear-gradient(180deg,rgba(255,255,255,.9),rgba(255,255,255,0) 60%)}
  .btn-ghost::after{display:none}
  .btn-ghost:hover{transform:translateY(-1px);box-shadow:0 6px 16px -6px rgba(16,24,40,.18)}

  .pay-soon{font-size:12.5px;color:var(--muted);margin:12px 2px 0;line-height:1.5;text-align:center}
  .methods{display:flex;flex-direction:column;gap:10px;margin-top:16px;padding-top:16px;
    border-top:1px solid var(--line)}
  .method{display:flex;align-items:center;gap:10px;font-size:13.5px;color:var(--muted)}
  .method svg{height:22px;width:auto;flex:none;border-radius:6px}
  .paid-banner{display:flex;align-items:center;justify-content:center;gap:9px;margin-top:16px;
    padding:16px;border-radius:16px;font-weight:620;font-size:15.5px;
    background:linear-gradient(180deg,#f0fdf5,#ecfdf3);color:#027a48;border:1px solid #abefc6}

  /* bank */
  .bank-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;
    border-bottom:1px solid #f2f4f7;font-size:14.5px}
  .bank-row:last-child{border-bottom:0}
  .bank-row>span:first-child{color:var(--muted)}
  .copy{display:inline-flex;align-items:center;gap:7px;background:#f6f7f9;border:1px solid var(--line);
    border-radius:9px;padding:5px 9px;font:inherit;font-size:14px;font-weight:560;color:var(--ink);
    cursor:pointer;font-variant-numeric:tabular-nums}
  .copy:hover{background:#eef0f3}
  .copy svg{color:var(--muted);flex:none}

  /* photos */
  .photos{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px}
  .photos img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;border:1px solid var(--line);
    display:block}

  /* email */
  .email-row{display:flex;gap:9px;margin-bottom:10px}
  .email-row input{flex:1;min-width:0;height:50px;padding:0 14px;border-radius:13px;
    border:1px solid var(--line);font:inherit;font-size:15.5px;color:var(--ink);background:#fbfbfc}
  .email-row input:focus{outline:none;border-color:var(--brand);background:#fff;
    box-shadow:0 0 0 4px rgba(244,100,48,.12)}
  .email-row .btn-ghost{width:auto;padding:0 18px;flex:none}
  .hint{font-size:12.5px;color:var(--muted);margin:0;line-height:1.5}
  .ok{color:#027a48;font-weight:560}
  .err{color:#b42318;font-weight:560}

  /* footer */
  footer{margin-top:26px;text-align:center}
  .compat{font-size:12.5px;color:var(--muted);line-height:1.6;margin:0 0 16px}
  .powered{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:var(--muted);
    text-decoration:none;padding:9px 15px;border-radius:999px;border:1px solid var(--line);background:#fbfbfc}
  .powered:hover{background:#f4f5f7}
  .powered svg{height:13px;width:auto}
  @media print{.top,.pay,.email,.powered,.btn{display:none!important}
    .card{break-inside:avoid;box-shadow:none}}
</style>
</head><body>

<header class="top"><div class="wrap">
  <a class="brand" href="https://flynnai.app" target="_blank" rel="noopener" aria-label="Flynn — go to flynnai.app">${FLYNN_WORDMARK}</a>
  <span class="secure"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Secure invoice</span>
</div></header>

<main class="wrap">
  <div class="hero">
    <p class="from">Invoice from</p>
    <p class="biz">${esc(bizName)}</p>
    <p class="amount">${moneyFull(inv.total_cents, currency)}</p>
    <span class="status ${isPaid ? 'paid' : 'due'}">
      ${isPaid ? 'Paid' : (inv.due_date ? `Due ${esc(inv.due_date)}` : 'Awaiting payment')}
    </span>
  </div>

  ${payBlock}
  ${bankBlock}

  <section class="card">
    <h2>${items.length ? 'What this covers' : 'Invoice'}</h2>
    <ul class="items">${itemRows || '<li class="item"><span class="item-desc">Work completed</span></li>'}</ul>
    <div class="totals">
      ${inv.tax_cents ? `<div class="trow"><span>Subtotal</span><span>${moneyFull(inv.total_cents - inv.tax_cents, currency)}</span></div>
      <div class="trow"><span>GST</span><span>${moneyFull(inv.tax_cents, currency)}</span></div>` : ''}
      <div class="trow grand"><span>Total</span><span>${moneyFull(inv.total_cents, currency)}</span></div>
    </div>
  </section>

  ${photos.length ? `<section class="card"><h2>The job</h2><div class="photos">${photoTiles}</div></section>` : ''}
  ${inv.message ? `<section class="card"><h2>Note</h2><p style="margin:0;font-size:15px;line-height:1.55">${esc(inv.message)}</p></section>` : ''}

  <section class="card email">
    <h2>Send a copy</h2>
    <div class="email-row">
      <input type="email" id="em" placeholder="you@example.com" autocomplete="email" inputmode="email">
      <button class="btn btn-ghost" type="button" id="emBtn">Email it</button>
    </div>
    <p class="hint" id="emMsg">Email it to yourself, your bookkeeper, or anyone else. Includes a PDF that imports into Xero, MYOB, QuickBooks and the rest.</p>
    <button class="btn btn-ghost" type="button" onclick="window.print()" style="margin-top:10px">Save as PDF</button>
  </section>

  <footer>
    <p class="compat">Reference ${esc(ref)} &middot; Works with Xero, MYOB &amp; QuickBooks</p>
    <a class="powered" href="https://flynnai.app" target="_blank" rel="noopener">
      Invoiced with ${FLYNN_WORDMARK}
    </a>
  </footer>
</main>

<script>
  document.querySelectorAll('.copy').forEach(function(b){
    b.addEventListener('click',function(){
      var v=b.getAttribute('data-copy');
      navigator.clipboard&&navigator.clipboard.writeText(v).then(function(){
        var s=b.querySelector('span'),o=s.textContent;s.textContent='Copied';
        setTimeout(function(){s.textContent=o;},1200);
      });
    });
  });
  (function(){
    var btn=document.getElementById('emBtn'),inp=document.getElementById('em'),msg=document.getElementById('emMsg');
    if(!btn) return;
    btn.addEventListener('click',function(){
      var to=(inp.value||'').trim();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)){msg.textContent='That email doesn\'t look right.';msg.className='hint err';return;}
      btn.disabled=true;msg.textContent='Sending…';msg.className='hint';
      fetch(location.pathname.replace(/\/$/,'')+'/email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:to})})
        .then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j}})})
        .then(function(res){
          if(res.ok&&res.j.sent){msg.textContent='Sent to '+to;msg.className='hint ok';inp.value='';}
          else {msg.textContent=(res.j&&res.j.error)||'Couldn\'t send that just now.';msg.className='hint err';}
        })
        .catch(function(){msg.textContent='Couldn\'t send that just now.';msg.className='hint err';})
        .finally(function(){btn.disabled=false;});
    });
  })();
</script>
</body></html>`;
}

module.exports = {
  storeJobPhoto,
  takeBufferedPhotos,
  saveInvoice,
  renderInvoiceHTML,
  normalizeInvoiceRow,
  computeTotalCents,
  invoiceUrl,
  moneyFull,
};
