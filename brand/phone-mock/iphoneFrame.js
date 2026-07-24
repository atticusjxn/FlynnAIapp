/*
 * Real iPhone device frame, traced from Apple's own proportions via MagicUI's
 * open-source `iphone` component (MIT license, magicui.design /
 * github.com/magicuidesign/magicui, apps/www/registry/magicui/iphone.tsx).
 * viewBox 433x882 — screen inset at (21.25, 19.25), sized 389.5x843.5, corner
 * radius 55.75. This replaces a hand-tuned CSS bezel approximation that never
 * quite matched a real device (wrong ratio, flat-bar "dynamic island", bezel
 * touching the screen curve) — this is pixel-accurate to the actual product.
 *
 * Usage: iphoneFrame({ width: 940, contentHtml: '...' }) returns an HTML
 * fragment: an absol-positioned SVG chassis + a clipped div at the exact
 * screen coordinates holding your content. Caller wraps it in a positioned
 * container and sets that container's width/aspect-ratio.
 */

const PHONE_W = 433;
const PHONE_H = 882;
const SCREEN_X = 21.25;
const SCREEN_Y = 19.25;
const SCREEN_W = 389.5;
const SCREEN_H = 843.5;
const SCREEN_R = 55.75;

const ASPECT = PHONE_H / PHONE_W; // 2.0369...
const LEFT_PCT = (SCREEN_X / PHONE_W) * 100;
const TOP_PCT = (SCREEN_Y / PHONE_H) * 100;
const WIDTH_PCT = (SCREEN_W / PHONE_W) * 100;
const HEIGHT_PCT = (SCREEN_H / PHONE_H) * 100;
const RADIUS_H_PCT = (SCREEN_R / SCREEN_W) * 100;
const RADIUS_V_PCT = (SCREEN_R / SCREEN_H) * 100;

// The chassis SVG (light-mode fills only — this is a marketing render, not a
// dark-mode-aware UI). Camera/dynamic-island pill is drawn as real paths.
const CHASSIS_SVG = `
<svg viewBox="0 0 ${PHONE_W} ${PHONE_H}" fill="none" xmlns="http://www.w3.org/2000/svg" class="iphone-chassis">
  <path d="M2 73C2 32.6832 34.6832 0 75 0H357C397.317 0 430 32.6832 430 73V809C430 849.317 397.317 882 357 882H75C34.6832 882 2 849.317 2 809V73Z" fill="#2E2E30"/>
  <path d="M0 171C0 170.448 0.447715 170 1 170H3V204H1C0.447715 204 0 203.552 0 203V171Z" fill="#2E2E30"/>
  <path d="M1 234C1 233.448 1.44772 233 2 233H3.5V300H2C1.44772 300 1 299.552 1 299V234Z" fill="#2E2E30"/>
  <path d="M1 319C1 318.448 1.44772 318 2 318H3.5V385H2C1.44772 385 1 384.552 1 384V319Z" fill="#2E2E30"/>
  <path d="M430 279H432C432.552 279 433 279.448 433 280V384C433 384.552 432.552 385 432 385H430V279Z" fill="#2E2E30"/>
  <path d="M6 74C6 35.3401 37.3401 4 76 4H356C394.66 4 426 35.3401 426 74V808C426 846.66 394.66 878 356 878H76C37.3401 878 6 846.66 6 808V74Z" fill="#0A0A0B"/>
  <path opacity="0.4" d="M174 5H258V5.5C258 6.60457 257.105 7.5 256 7.5H176C174.895 7.5 174 6.60457 174 5.5V5Z" fill="#5A5A5C"/>
  <path d="M154 48.5C154 38.2827 162.283 30 172.5 30H259.5C269.717 30 278 38.2827 278 48.5C278 58.7173 269.717 67 259.5 67H172.5C162.283 67 154 58.7173 154 48.5Z" fill="#000000"/>
  <path d="M249 48.5C249 42.701 253.701 38 259.5 38C265.299 38 270 42.701 270 48.5C270 54.299 265.299 59 259.5 59C253.701 59 249 54.299 249 48.5Z" fill="#151515"/>
  <path d="M254 48.5C254 45.4624 256.462 43 259.5 43C262.538 43 265 45.4624 265 48.5C265 51.5376 262.538 54 259.5 54C256.462 54 254 51.5376 254 48.5Z" fill="#2A2A2C"/>
</svg>`.trim();

/**
 * @param {object} opts
 * @param {number} opts.left - px, left offset of the whole phone within its canvas
 * @param {number} opts.top - px, top offset
 * @param {number} opts.width - px, phone width (height is derived from ASPECT)
 * @param {string} opts.contentHtml - HTML to place inside the screen area
 * @param {string} [opts.screenBg] - background behind contentHtml (default white)
 * @returns {{ html: string, height: number, screen: { leftPct, topPct, widthPct, heightPct } }}
 */
function iphoneFrame({ left, top, width, contentHtml, screenBg = '#fff' }) {
  const height = Math.round(width * ASPECT);
  const html = `
    <div style="position:absolute; left:${left}px; top:${top}px; width:${width}px; height:${height}px;
      filter:drop-shadow(0 34px 60px rgba(20,14,10,.32)) drop-shadow(0 8px 18px rgba(20,14,10,.22));">
      ${CHASSIS_SVG}
      <div style="position:absolute; left:${LEFT_PCT}%; top:${TOP_PCT}%; width:${WIDTH_PCT}%; height:${HEIGHT_PCT}%;
        border-radius:${RADIUS_H_PCT}% / ${RADIUS_V_PCT}%; overflow:hidden; background:${screenBg};">
        ${contentHtml}
      </div>
    </div>`;
  return { html, height, screen: { leftPct: LEFT_PCT, topPct: TOP_PCT, widthPct: WIDTH_PCT, heightPct: HEIGHT_PCT } };
}

module.exports = { iphoneFrame, ASPECT, PHONE_W, PHONE_H, SCREEN_X, SCREEN_Y, SCREEN_W, SCREEN_H, SCREEN_R };
