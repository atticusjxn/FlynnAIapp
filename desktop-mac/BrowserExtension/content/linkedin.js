/**
 * Flynn Desktop content script — LinkedIn Messaging
 *
 * Reads the open conversation thread in LinkedIn's messaging panel.
 */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'CAPTURE_CONVERSATION') return;

  const messages = captureConversation();
  sendResponse({ messages, site: 'LinkedIn' });
  return true;
});

function captureConversation() {
  const texts = [];

  // LinkedIn messaging: messages are in .msg-s-message-list__event items
  const events = document.querySelectorAll(
    '.msg-s-message-list__event .msg-s-event-listitem__body, ' +
    '.msg-s-message-group__meta ~ .msg-s-event-listitem, ' +
    '[class*="msg-s-message-list"] [class*="msg-s-event"]'
  );

  events.forEach(el => {
    const text = el.innerText?.trim();
    if (text && text.length > 1) texts.push(text);
  });

  return texts.slice(-30);
}
