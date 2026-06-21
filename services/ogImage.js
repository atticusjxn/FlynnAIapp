// services/ogImage.js
//
// Dynamic Open Graph card for invoice links. When Flynn's /i/<token> link is
// shared in iMessage / Google Messages, the crawler fetches /i/<token>/og.png
// and unfurls this branded 1200x630 card showing the business, amount, and
// status (Awaiting payment / Paid) — so the card flips to "Paid" once marked.
//
// Rendered as SVG → PNG via sharp (already a dependency). Deliberately NOT
// puppeteer: Chromium OOMs the small Fly VM. No network fetch, so it can't hang.

const sharp = require('sharp');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function money(cents, currency = 'AUD') {
  const sym = currency === 'GBP' ? '£' : '$';
  return `${sym}${(Math.round(cents || 0) / 100).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function renderCardSVG(inv, business = {}) {
  const currency = inv.currency || 'AUD';
  const bizName = business.business_name || business.business_type || 'My business';
  const paid = inv.status === 'paid';
  const amount = money(inv.total_cents, currency);
  const initials = (bizName.match(/\b\w/g) || ['F']).slice(0, 2).join('').toUpperCase();
  const forLine = inv.client_name ? `For ${inv.client_name}` : 'Invoice';
  const statusText = paid ? 'PAID' : 'AWAITING PAYMENT';
  const statusBg = paid ? '#1FA36B' : '#E0A436';
  const pillW = statusText.length * 17 + 56;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="Helvetica, Arial, sans-serif">
  <rect width="1200" height="630" fill="#F4E6CE"/>
  <rect x="780" y="0" width="420" height="630" fill="#FB5B1E"/>
  <rect x="780" y="0" width="3" height="630" fill="#2C2018"/>
  <rect x="64" y="68" width="64" height="64" rx="14" fill="#FB5B1E" stroke="#2C2018" stroke-width="3"/>
  <text x="96" y="112" text-anchor="middle" fill="#fff" font-size="28" font-weight="bold">${esc(initials)}</text>
  <text x="148" y="114" fill="#2C2018" font-size="32" font-weight="bold">${esc(bizName)}</text>
  <text x="64" y="300" fill="#8C7B6A" font-size="22" font-weight="bold" letter-spacing="3">INVOICE</text>
  <text x="60" y="420" fill="#2C2018" font-size="128" font-weight="bold">${esc(amount)}</text>
  <text x="64" y="468" fill="#5A4A3C" font-size="26">${esc(forLine)}</text>
  <rect x="64" y="512" width="${pillW}" height="58" rx="29" fill="${statusBg}" stroke="#2C2018" stroke-width="3"/>
  <text x="${64 + pillW / 2}" y="550" text-anchor="middle" fill="#fff" font-size="24" font-weight="bold" letter-spacing="1">${esc(statusText)}</text>
</svg>`;
}

async function renderCardPng(inv, business = {}) {
  const svg = renderCardSVG(inv, business);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { renderCardSVG, renderCardPng };
