/**
 * Flynn Desktop — Chrome/Edge extension service worker.
 *
 * Maintains a persistent WebSocket connection to the Flynn Desktop app
 * on ws://localhost:9741. When the desktop app sends REQUEST_CONVERSATION,
 * the service worker injects a capture into the active tab's content script
 * and returns the result.
 */

const WS_URL = 'ws://localhost:9741';
const RECONNECT_DELAY_MS = 3000;

let ws = null;
let reconnectTimer = null;

function connect() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
    return;
  }

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log('[Flynn] Connected to desktop app');
    clearTimeout(reconnectTimer);
    // Announce ourselves
    send({ type: 'STATUS', status: 'connected' });
  };

  ws.onmessage = async (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }

    if (msg.type === 'REQUEST_CONVERSATION') {
      const result = await captureActiveTab();
      if (result) {
        send({ type: 'CONVERSATION', messages: result.messages, sourceSite: result.site });
      }
    }
  };

  ws.onclose = () => {
    console.log('[Flynn] Disconnected from desktop app — retrying…');
    reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
  };

  ws.onerror = () => {
    ws.close();
  };
}

function send(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

async function captureActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;

  try {
    const result = await chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_CONVERSATION' });
    return result;
  } catch {
    return null;
  }
}

// Start connection when the service worker starts
connect();

// Keep alive via periodic ping (service workers can be suspended)
setInterval(() => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    connect();
  } else {
    // WebSocket ping (no-op frame)
    send({ type: 'STATUS', status: 'ping' });
  }
}, 20000);
