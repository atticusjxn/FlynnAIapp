const { URL } = require('url');
const WebSocket = require('ws');
const createVoiceAgentHandler = require('./deepgramVoiceAgent');

/**
 * Attach a Twilio media stream WebSocket endpoint to the HTTP server.
 * Uses Deepgram Voice Agent API for unified STT + LLM + TTS orchestration.
 *
 * @param {object} options
 * @param {import('http').Server} options.httpServer
 * @param {Map<string, object>} options.sessionCache
 * @param {import('@deepgram/sdk').Deepgram | null} options.deepgramClient
 * @param {Function} options.onConversationComplete - Callback when conversation ends
 * @param {Function} options.getBusinessContextForOrg - Fetch business context by user ID
 */
const attachRealtimeServer = ({
  httpServer,
  sessionCache,
  deepgramClient,
  onConversationComplete,
  getBusinessContextForOrg,
}) => {
  const wss = new WebSocket.Server({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    console.log('[Realtime] WebSocket upgrade request received:', {
      url: request.url,
      headers: request.headers,
    });

    try {
      const requestUrl = new URL(request.url, `http://${request.headers.host}`);
      console.log('[Realtime] Parsed URL:', {
        pathname: requestUrl.pathname,
        searchParams: Object.fromEntries(requestUrl.searchParams),
      });

      if (requestUrl.pathname !== '/realtime/twilio' && requestUrl.pathname !== '/realtime/test') {
        console.warn('[Realtime] WebSocket upgrade rejected - wrong path:', requestUrl.pathname);
        socket.destroy();
        return;
      }

      console.log('[Realtime] WebSocket upgrade accepted, handling connection...');
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, requestUrl);
      });
    } catch (error) {
      console.error('[Realtime] WebSocket upgrade error:', error);
      socket.destroy();
    }
  });

  wss.on('connection', (ws, request, parsedUrl) => {
    console.log('[Realtime] WebSocket connection established!');

    try {
      const params = parsedUrl instanceof URL
        ? parsedUrl.searchParams
        : new URL(request.url, `http://${request.headers.host}`).searchParams;
      const callSid = params.get('callSid');
      const userId = params.get('userId');

      console.log('[Realtime] Connection parameters:', { callSid, userId });

      const session = callSid ? sessionCache.get(callSid) : null;

      const handler = createVoiceAgentHandler({
        ws,
        callSid,
        userId,
        sessionCache,
        session,
        deepgramClient,
        onConversationComplete,
        getBusinessContextForOrg,
      });

      handler.attach();
    } catch (error) {
      console.error('[Realtime] Failed to initialize connection.', error);
      ws.close();
    }
  });

  console.log('[Realtime] WebSocket server attached and listening for /realtime/twilio connections');

  return wss;
};

module.exports = attachRealtimeServer;
