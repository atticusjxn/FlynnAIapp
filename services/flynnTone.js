/**
 * Flynn tone helpers — pure, dependency-free.
 *
 * Every outbound message Flynn generates passes through sanitiseReply() so the
 * model's stray AI tells (em dashes, dramatic ellipses, filler openers) never
 * reach the user. splitBubbles() lets Flynn text like a real person — a thought
 * broken across a couple of short sends rather than one wall of text.
 *
 * Keep this file free of imports so schedulers, routes and the SMS brain can all
 * share it without pulling in network/DB clients.
 */

// Leading filler affirmations that read like a chatbot, not a mate.
const FILLER_OPENER_RE = /^(great|sure|absolutely|of course|certainly|no problem)\s*[!,.]+\s*/i;

/**
 * Strip the AI tells from a single message before it goes out.
 * @param {string} text
 * @returns {string}
 */
function sanitiseReply(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\s*[—–]\s+/g, ', ')  // spaced em/en dash → comma (no stray space)
    .replace(/—/g, ', ')           // any remaining em dash → comma
    .replace(/–/g, '-')            // remaining en dash → hyphen (keeps 8am-10am readable)
    .replace(/\.{3,}/g, '..')      // dramatic ellipsis → two dots
    .replace(/!{2,}/g, '!')       // !! / !!! → single !
    .replace(FILLER_OPENER_RE, '') // drop "Great!", "Sure!", "Absolutely!" openers
    .replace(/[ \t]{2,}/g, ' ')   // collapse runs of spaces left behind
    .trim();
}

/**
 * Normalise handler output into an array of send-ready bubbles.
 *
 * Accepts a single string (split on blank lines into separate sends) or an array
 * of strings (each already a bubble). Each bubble is sanitised; empties dropped;
 * capped at 3 sends so Flynn never spams. Overflow is folded into the last bubble
 * rather than discarded, so no text is ever lost.
 *
 * @param {string|string[]} content
 * @returns {string[]}
 */
function splitBubbles(content) {
  let parts;
  if (Array.isArray(content)) {
    parts = content.flatMap((c) => (typeof c === 'string' ? c.split(/\n{2,}/) : []));
  } else if (typeof content === 'string') {
    parts = content.split(/\n{2,}/);
  } else {
    return [];
  }

  const bubbles = parts.map(sanitiseReply).filter(Boolean);
  if (bubbles.length <= 3) return bubbles;

  // Keep the first two as-is, fold everything after into the third.
  return [...bubbles.slice(0, 2), bubbles.slice(2).join(' ')];
}

module.exports = { sanitiseReply, splitBubbles };
