// services/ogImage.js
//
// Dynamic Open Graph card for invoice links. When Flynn's /i/<token> link is
// shared in iMessage / Google Messages, the crawler fetches /i/<token>/og.png
// and unfurls this card. It's designed to LOOK LIKE THE INVOICE itself — the job
// photo, the business logo, the line item, the total, and the status — so the
// in-thread preview reads as a real invoice (not a generic banner), and tapping
// through to the hosted page is just "view full / pay".
//
// Rendered as SVG → PNG via sharp (already a dependency). The job photo is
// fetched and embedded as a data URI (with a short timeout + graceful fallback);
// the logo is drawn inline. Deliberately NOT puppeteer (Chromium OOMs the VM).

const sharp = require('sharp');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function money(cents, currency = 'AUD') {
  const sym = currency === 'GBP' ? '£' : '$';
  return `${sym}${(Math.round(cents || 0) / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Fetch a remote image and return a data URI, or null on any failure/timeout.
async function fetchImageDataUri(url, timeoutMs = 4000) {
  if (!url || /^data:/.test(url)) return url || null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || 'image/jpeg';
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

// The inline leaf emblem (matches the hosted-invoice logo), drawn at (x,y) size s.
function leafBadge(x, y, s) {
  return `<g transform="translate(${x},${y})">
    <rect width="${s}" height="${s}" rx="${s * 0.24}" fill="#1F7A4D"/>
    <g transform="translate(${s * 0.5},${s * 0.5}) scale(${s / 64}) translate(-32,-32) rotate(-15 32 32)">
      <path d="M32 11 C47 19 47 43 32 53 C17 43 17 19 32 11 Z" fill="#F3F9F4"/>
      <path d="M32 16 L32 48" stroke="#1E7445" stroke-width="3" stroke-linecap="round"/>
      <path d="M32 25 L24 21" stroke="#1E7445" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M32 25 L40 21" stroke="#1E7445" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M32 34 L24 30" stroke="#1E7445" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M32 34 L40 30" stroke="#1E7445" stroke-width="2.4" stroke-linecap="round"/>
    </g>
  </g>`;
}

async function renderCardSVG(inv, business = {}) {
  const currency = inv.currency || 'AUD';
  const bizName = business.business_name || business.business_type || 'My business';
  const paid = inv.status === 'paid';
  const amount = money(inv.total_cents, currency);
  const forLine = inv.client_name ? `For ${inv.client_name}` : 'Invoice';
  const items = Array.isArray(inv.line_items) ? inv.line_items : [];
  const lineLabel = items[0]?.description || 'Work completed';
  const statusText = paid ? 'PAID' : 'AWAITING PAYMENT';
  const statusBg = paid ? '#1F9D57' : '#E0A436';
  const pillW = statusText.length * 13 + 48;

  const photoUrl = Array.isArray(inv.photo_urls) ? inv.photo_urls[0] : null;
  const photoData = await fetchImageDataUri(photoUrl);

  // Full-bleed layout: the white card fills the whole frame (no cream margin) and
  // the photo panel runs to the right edge, so iMessage's own corner-rounding
  // makes it read as a clean native card, not a padded graphic.
  const px = 760, pw = 1200 - px;
  const photoPanel = photoData
    ? `<image x="${px}" y="0" width="${pw}" height="630" href="${photoData}" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect x="${px}" y="0" width="${pw}" height="630" fill="#1F7A4D"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="Helvetica, Arial, sans-serif">
  <rect width="1200" height="630" fill="#FFFFFF"/>
  ${leafBadge(64, 70, 92)}
  <text x="184" y="118" fill="#1C1C1C" font-size="42" font-weight="bold">${esc(bizName)}</text>
  <text x="184" y="156" fill="#8a8a8a" font-size="25">Tax invoice</text>
  <line x1="64" y1="220" x2="700" y2="220" stroke="#ECECEC" stroke-width="2"/>
  <text x="64" y="312" fill="#3a3a3a" font-size="31">${esc(lineLabel)}</text>
  <text x="62" y="456" fill="#1F7A4D" font-size="124" font-weight="bold">${esc(amount)}</text>
  <text x="66" y="502" fill="#8a8a8a" font-size="25">${esc(forLine)} · incl GST</text>
  <rect x="64" y="536" width="${pillW}" height="54" rx="27" fill="${statusBg}"/>
  <text x="${64 + pillW / 2}" y="571" text-anchor="middle" fill="#fff" font-size="23" font-weight="bold" letter-spacing="1">${esc(statusText)}</text>
  ${photoPanel}
</svg>`;
}

async function renderCardPng(inv, business = {}) {
  const svg = await renderCardSVG(inv, business);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { renderCardSVG, renderCardPng };
