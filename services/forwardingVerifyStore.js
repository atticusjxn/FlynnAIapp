/**
 * In-memory store of in-flight call-forwarding verifications.
 *
 * How verification works: the server places a test call to the user's own
 * mobile from a known number. If the user's conditional divert (**61*) is live
 * and they let it ring out, the carrier forwards the unanswered call to their
 * Flynn number — so an INBOUND call arriving at that Flynn number, from the
 * verification number (or the user's own mobile, some carriers rewrite the
 * caller id), during the window, is proof the divert works. That match is the
 * ONLY thing that flips a verification to `verified`; the outbound leg's own
 * webhooks can't reliably distinguish "user answered" from "forward answered"
 * across carriers, so they aren't trusted.
 *
 * Kept in memory (keyed by Flynn number) because the verify endpoint and the
 * inbound webhook run in the same single Fly machine, and the window is ~2
 * minutes — a restart mid-verification just means the user retries. The whole
 * feature is gated by FLYNN_FORWARDING_VERIFY; when off, `start` is never
 * called, so `matchInbound` is always empty and the inbound path is untouched.
 */

const WINDOW_MS = 120 * 1000;

// flynnNumber(normalized) -> { id, userId, userMobile, verifyFrom, status, createdAt, expiresAt }
const pending = new Map();

const normalize = (n) => (n ? String(n).replace(/[^\d+]/g, '') : '');

function sweep() {
  const now = Date.now();
  for (const [key, v] of pending) {
    if (v.expiresAt <= now && v.status === 'checking') {
      v.status = 'expired';
    }
    // Keep resolved entries briefly so the poll can read them, then drop.
    if (v.expiresAt + 60 * 1000 <= now) pending.delete(key);
  }
}
setInterval(sweep, 30 * 1000).unref?.();

/** Begin a verification. Returns the entry id. One per Flynn number at a time. */
function start({ id, userId, flynnNumber, userMobile, verifyFrom }) {
  const key = normalize(flynnNumber);
  const now = Date.now();
  const entry = {
    id,
    userId,
    flynnNumber: key,
    userMobile: normalize(userMobile),
    verifyFrom: normalize(verifyFrom),
    status: 'checking',
    createdAt: now,
    expiresAt: now + WINDOW_MS,
  };
  pending.set(key, entry);
  return entry;
}

/**
 * Does this inbound call prove a divert? Called from the inbound voice webhook.
 * Matches when a checking verification exists for the called (Flynn) number and
 * the caller is the verification number or the user's own mobile. Marks it
 * verified and returns the entry; otherwise null (and the call routes normally).
 */
function matchInbound({ toNumber, fromNumber }) {
  const key = normalize(toNumber);
  const entry = pending.get(key);
  if (!entry || entry.status !== 'checking' || entry.expiresAt <= Date.now()) return null;
  const from = normalize(fromNumber);
  if (from && from !== entry.verifyFrom && from !== entry.userMobile) {
    // A real call arriving mid-window from someone else — not our test call.
    return null;
  }
  entry.status = 'verified';
  entry.verifiedAt = Date.now();
  return entry;
}

/** The user answered the test call directly → the divert isn't active. */
function markNotForwarded(id) {
  for (const entry of pending.values()) {
    if (entry.id === id && entry.status === 'checking') entry.status = 'not_forwarded';
  }
}

function getById(id) {
  for (const entry of pending.values()) {
    if (entry.id === id) return entry;
  }
  return null;
}

module.exports = { start, matchInbound, markNotForwarded, getById };
