/**
 * POST /api/track/messaged
 *
 * Beacon receiver for the landing-page "Message Flynn" tap. The browser fires
 * the Meta Pixel MessagedFlynn event client-side (full attribution) and, in the
 * same handler, sends this beacon so the server can:
 *   1. mirror MessagedFlynn via CAPI with the SAME event_id (Meta dedups them) —
 *      this is the copy that survives iOS / ad-blockers, keeping the ad's
 *      optimisation signal intact;
 *   2. persist the browser's Meta identifiers (fbp/fbc/fbclid) against the ref
 *      token, so when the user later texts Flynn we can attribute their
 *      Activated event back to this ad click (see iMessageInbound.js).
 *
 * Sent via navigator.sendBeacon as text/plain, so it's a CORS "simple request"
 * (no preflight) and is delivered even as the page unloads to open iMessage.
 * We still set permissive CORS headers for any fetch() fallback.
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const metaCapi = require('../services/metaCapi');

const router = express.Router();

const supabase = (() => {
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_SECRET;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
})();

// Permissive CORS for the beacon (sendBeacon doesn't need it, fetch fallback might).
router.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// sendBeacon delivers text/plain, which the global express.json() won't parse —
// take the raw body here and JSON.parse it ourselves.
router.post('/messaged', express.text({ type: '*/*', limit: '8kb' }), async (req, res) => {
  // Always ack fast; tracking must never block or error the client.
  res.sendStatus(204);

  let payload = {};
  try {
    payload = typeof req.body === 'string' && req.body ? JSON.parse(req.body) : (req.body || {});
  } catch {
    return;
  }

  const { ref, event_id, fbp, fbc, fbclid, event_source_url, utm } = payload;
  const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress;
  const userAgent = req.headers['user-agent'];

  // 1. CAPI mirror of the browser MessagedFlynn (shared event_id => deduped).
  metaCapi.trackMessagedFlynn({
    eventId: event_id,
    eventSourceUrl: event_source_url,
    fbp, fbc, fbclid, clientIp, userAgent,
  }).catch(() => {});

  // 2. Persist the bridge so the later Activated event can attribute back.
  if (supabase && ref) {
    await supabase.from('capi_click_bridge').upsert({
      ref: String(ref).slice(0, 32),
      event_id: event_id || null,
      fbp: fbp || null,
      fbc: fbc || null,
      fbclid: fbclid || null,
      event_source_url: event_source_url || null,
      utm: utm || null,
    }, { onConflict: 'ref' }).then(() => {}, (e) => console.warn('[track] bridge upsert failed:', e?.message));
  }
});

module.exports = router;
