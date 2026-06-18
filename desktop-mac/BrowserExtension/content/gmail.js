/**
 * Flynn Desktop content script — Gmail
 *
 * Reads the open email thread when invoked by the service worker.
 * Targets the expanded email bodies in the conversation view.
 */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'CAPTURE_CONVERSATION') return;

  const messages = captureConversation();
  sendResponse({ messages, site: 'Gmail' });
  return true;
});

function captureConversation() {
  const texts = [];

  // Gmail thread view: each email is an [role=listitem] with a body
  const emails = document.querySelectorAll('[role="listitem"] .a3s.aiL, [role="listitem"] .ii.gt .a3s');
  emails.forEach(el => {
    const text = el.innerText?.trim();
    if (text && text.length > 10) texts.push(text);
  });

  if (texts.length > 0) return texts.slice(-10); // last 10 emails in thread

  // Fallback: open compose or single email view
  const body = document.querySelector('.Ap [aria-label="Message Body"], .ii.gt');
  if (body) {
    const text = body.innerText?.trim();
    if (text) return [text];
  }

  return [];
}
