/**
 * Flynn Desktop content script — WhatsApp Web
 *
 * Reads the active conversation panel when invoked by the service worker.
 * Selectors target WhatsApp Web's current DOM structure (as of mid-2025).
 */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'CAPTURE_CONVERSATION') return;

  const messages = captureConversation();
  sendResponse({ messages, site: 'WhatsApp Web' });
  return true; // keep channel open for async
});

function captureConversation() {
  // Main conversation panel: contains incoming and outgoing message rows
  const panel = document.querySelector(
    '#main [data-testid="conversation-panel-messages"], ' +
    '#main .message-list, ' +
    '#main [class*="_2WP9Q"]'
  );
  if (!panel) return [];

  // Message rows: incoming messages have data-testid="msg-container"
  // Text is in spans with class "selectable-text"
  const rows = panel.querySelectorAll('[data-testid="msg-container"], [class*="message-in"]');
  const texts = [];

  rows.forEach(row => {
    const spans = row.querySelectorAll('.selectable-text, [class*="_2_LEW"]');
    const text = Array.from(spans)
      .map(s => s.textContent?.trim())
      .filter(Boolean)
      .join(' ');
    if (text) texts.push(text);
  });

  // Cap at last 30 incoming messages
  return texts.slice(-30);
}
