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

function newToken() {
  return crypto.randomBytes(9).toString('base64url'); // ~12 url-safe chars
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

function renderInvoiceHTML(rawInv, business = {}) {
  const inv = normalizeInvoiceRow(rawInv);
  const currency = inv.currency || 'AUD';
  const bizName = business.business_name || business.business_type || 'My business';
  const initials = bizName.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'F';
  // A real logo if the business has one (URL or data URI), else an initials badge.
  const logoUrl = business.logo_url || business.logoUrl || '';
  const ref = String(inv.public_token || '').slice(0, 6).toUpperCase();
  const photos = Array.isArray(inv.photo_urls) ? inv.photo_urls : [];
  const items = Array.isArray(inv.line_items) ? inv.line_items : [];
  const accent = '#FB5B1E';

  const itemRows = items.map((li) => `
        <div class="row">
          <span>${esc(li.description || 'item')}</span>
          <span>${li.amount_cents != null ? moneyFull(li.amount_cents, currency) : ''}</span>
        </div>`).join('');

  const photoTiles = photos.map((url) => `
          <a class="tile" href="${esc(url)}" target="_blank" rel="noopener" style="background-image:url('${esc(url)}')"></a>`).join('');

  const photoBlock = photos.length ? `
      <div class="section">
        <div class="muted small">The job${inv.client_name ? ` · ${esc(inv.client_name)}` : ''}</div>
        <div class="photos">${photoTiles}</div>
        <div class="muted small center">${photos.length} photo${photos.length > 1 ? 's' : ''} from the job</div>
      </div>` : '';

  const gstRow = inv.tax_cents ? `
        <div class="row dim"><span>GST</span><span>${moneyFull(inv.tax_cents, currency)}</span></div>` : '';

  const isPaid = inv.status === 'paid';

  // Payment: a real Stripe link if one's been attached, else bank-transfer
  // details from the business brain (the AU/NZ norm). Never a fake button.
  const bankBsb = business.bank_bsb || business.bsb;
  const bankAcct = business.bank_account || business.account_number;
  const bankName = business.bank_account_name || business.account_name || bizName;
  const payid = business.payid || business.pay_id;
  let payBlock = '';
  if (isPaid) {
    payBlock = '';
  } else if (inv.stripe_payment_url) {
    payBlock = `<a class="btn" href="${esc(inv.stripe_payment_url)}">Pay now · ${moneyFull(inv.total_cents, currency)}</a>`;
  } else if (bankBsb && bankAcct) {
    const cp = (v) => `<button type="button" class="cp" data-c="${esc(v)}">${esc(v)}</button>`;
    const amtPlain = (Math.round(inv.total_cents) / 100).toFixed(2);
    payBlock = `<div class="bank">
          <div class="bank-h">Pay by bank transfer <span class="bank-hint">tap a value to copy</span></div>
          <div class="bank-row"><span>Name</span>${cp(bankName)}</div>
          <div class="bank-row"><span>BSB</span>${cp(bankBsb)}</div>
          <div class="bank-row"><span>Account</span>${cp(bankAcct)}</div>
          ${payid ? `<div class="bank-row"><span>PayID</span>${cp(payid)}</div>` : ''}
          <div class="bank-row"><span>Amount</span>${cp(amtPlain)}</div>
          <div class="bank-row"><span>Reference</span>${cp(ref)}</div>
        </div>`;
  } else if (business.payment_details) {
    payBlock = `<div class="bank"><div class="bank-h">Payment</div><div class="paytext">${esc(business.payment_details)}</div></div>`;
  }

  const title = `${esc(bizName)} · invoice ${moneyFull(inv.total_cents, currency)}`;
  // Link-preview card: status-aware text + a dynamic branded image that flips
  // to "Paid" once marked. Absolute URL so crawlers can fetch it.
  const ogTitle = `Invoice from ${bizName} — ${moneyFull(inv.total_cents, currency)}`;
  const statusLine = isPaid ? 'Paid · thanks!' : 'Awaiting payment · tap to view and pay';
  const ogImage = inv.public_token ? `${SERVER_URL}/i/${inv.public_token}/og.png` : (photos[0] || '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${title}</title>
<meta property="og:type" content="website" />
<meta property="og:title" content="${esc(ogTitle)}" />
<meta property="og:description" content="${esc(statusLine)}" />
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />` : ''}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(ogTitle)}" />
<meta name="twitter:description" content="${esc(statusLine)}" />
${ogImage ? `<meta name="twitter:image" content="${esc(ogImage)}" />` : ''}
<meta name="theme-color" content="${accent}" />
<style>
  :root { --ink:#1c1c1c; --muted:#8a8a8a; --line:#ECECEC; --accent:${accent}; }
  * { box-sizing: border-box; }
  body { margin:0; background:#EEE9DF; color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; -webkit-font-smoothing:antialiased; }
  .wrap { max-width:440px; margin:0 auto; padding:18px 14px 40px; }
  .card { background:#fff; border-radius:18px; overflow:hidden; }
  .head { padding:18px 18px 14px; border-bottom:1px solid var(--line); display:flex; align-items:center; gap:11px; }
  .logo { width:44px; height:44px; border-radius:11px; background:#1F7A4D; color:#fff;
    display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:600; flex-shrink:0; }
  .logo-img { background-position:center; background-size:cover; background-repeat:no-repeat; }
  .biz { line-height:1.3; min-width:0; }
  .biz b { font-size:15px; font-weight:600; display:block; }
  .biz span { font-size:11.5px; color:var(--muted); display:block; }
  .amt { margin-left:auto; text-align:right; line-height:1.25; }
  .amt b { font-size:19px; font-weight:600; color:#1F7A4D; }
  .amt span { display:block; font-size:11px; color:#c0392b; }
  .section { padding:14px 18px 6px; }
  .photos { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:8px 0 6px; }
  .photos .tile { display:block; height:120px; border-radius:10px; background:#d9d4c7 center/cover no-repeat; }
  .photos .tile:only-child { grid-column:1 / -1; height:200px; }
  .items { padding:8px 18px 4px; }
  .row { display:flex; justify-content:space-between; gap:12px; font-size:13.5px; color:#3a3a3a;
    padding:7px 0; border-bottom:1px solid #F2F2F2; }
  .row.dim { color:var(--muted); font-size:12px; border-bottom:none; }
  .row.total { font-size:15.5px; font-weight:600; color:var(--ink); border-bottom:none; padding-top:10px; }
  .pay { padding:6px 18px 16px; }
  .btn { display:block; text-align:center; text-decoration:none; background:var(--accent); color:#fff;
    font-size:15px; font-weight:600; padding:13px; border-radius:11px; }
  .amt span.paid { color:#1F7A4D; font-weight:700; letter-spacing:0.5px; }
  .bank { border:1px solid var(--line); border-radius:11px; padding:11px 13px; }
  .bank-h { font-size:12px; font-weight:600; color:#555; margin-bottom:6px; }
  .bank-row { display:flex; justify-content:space-between; gap:12px; font-size:13px; color:#3a3a3a; padding:3px 0; }
  .bank-row span:first-child { color:var(--muted); }
  .bank-hint { font-weight:400; color:#b0b0b0; font-size:10.5px; }
  .cp { background:none; border:none; padding:0; margin:0; font:inherit; font-weight:500; color:#1c1c1c;
    cursor:pointer; text-decoration:underline; text-decoration-color:#dcdcdc; text-underline-offset:3px; }
  .cp.ok { color:#1F7A4D; text-decoration:none; }
  .paytext { font-size:13px; color:#3a3a3a; line-height:1.5; }
  .ghost { display:block; width:100%; text-align:center; margin-top:9px; background:none; border:1px solid var(--line);
    color:#555; font-size:13px; font-weight:500; padding:11px; border-radius:11px; cursor:pointer; }
  .muted { color:var(--muted); }
  .small { font-size:11.5px; }
  .center { text-align:center; margin-top:6px; }
  .foot { text-align:center; font-size:11px; color:#b0b0b0; margin-top:14px; }
  .msg { padding:0 18px 8px; font-size:13px; color:#555; line-height:1.5; }
  @media print {
    body { background:#fff; } .wrap { max-width:none; padding:0; } .card { border-radius:0; }
    .ghost { display:none; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="head">
        ${logoUrl ? `<div class="logo logo-img" style="background-image:url('${esc(logoUrl)}')"></div>` : `<div class="logo">${esc(initials)}</div>`}
        <div class="biz"><b>${esc(bizName)}</b><span>Tax invoice · ${esc(ref)}</span></div>
        <div class="amt"><b>${moneyFull(inv.total_cents, currency)}</b>${isPaid ? '<span class="paid">PAID</span>' : (inv.due_date ? `<span>due ${esc(inv.due_date)}</span>` : '<span>Awaiting payment</span>')}</div>
      </div>
      ${photoBlock}
      ${inv.message ? `<div class="msg">${esc(inv.message)}</div>` : ''}
      <div class="items">
        ${itemRows}
        ${gstRow}
        <div class="row total"><span>Total${inv.tax_cents ? ' (incl GST)' : ''}</span><span>${moneyFull(inv.total_cents, currency)}</span></div>
      </div>
      <div class="pay">
        ${payBlock}
        <button class="ghost" onclick="window.print()">Download / print PDF</button>
      </div>
    </div>
    <div class="foot">Sent via Flynn</div>
  </div>
  <script>
    function cpFallback(t, done){ try{ var ta=document.createElement('textarea'); ta.value=t; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, t.length); document.execCommand('copy'); document.body.removeChild(ta); done(); }catch(e){} }
    document.addEventListener('click', function(e){
      var b = e.target.closest && e.target.closest('.cp'); if(!b) return;
      var t = b.getAttribute('data-c'); var o = b.textContent;
      function done(){ b.classList.add('ok'); b.textContent='copied'; setTimeout(function(){ b.classList.remove('ok'); b.textContent=o; }, 1200); }
      if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(t).then(done, function(){ cpFallback(t, done); }); } else { cpFallback(t, done); }
    });
  </script>
</body>
</html>`;
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
