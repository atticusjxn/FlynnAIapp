/**
 * iMessage transport facade.
 *
 * Picks the active blue-bubble provider from FLYNN_IMESSAGE_PROVIDER so callers
 * (routes/iMessageInbound.js, services/flynnOutbound.js) never hard-code one:
 *   - "sendblue"   → services/sendblue.js  (managed relay, no Mac/iPhone)
 *   - default      → services/blueBubbles.js (self-hosted Mac server)
 *
 * Both modules expose the same surface:
 *   sendMessage, sendToGroup, sendAttachment, downloadAttachment,
 *   setTyping, markRead, ping
 */

const provider = (process.env.FLYNN_IMESSAGE_PROVIDER || 'bluebubbles').toLowerCase();

module.exports = provider === 'sendblue'
  ? require('./sendblue')
  : require('./blueBubbles');
