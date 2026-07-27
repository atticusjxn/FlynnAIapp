/**
 * POST /webhooks/demo-director/fire
 *
 * Secret-gated "director" endpoint to choreograph the demo video. Fires each
 * proactive beat ON CUE (instead of the auto-timers) so the operator can film
 * a clean, paced take. Produces only Flynn's outbound message — no visible
 * trigger appears in the iMessage thread.
 *
 * Body: { "secret": "<DEMO_DIRECTOR_SECRET>", "phone": "+61...", "beat": "..." }
 *
 * iMessage-thread beats (phone-keyed persona, fire-and-forget):
 *   seed    — provision the James persona, clean (no welcome, no pre-seeded
 *             invoice, no auto-nudges); operator creates the hero invoice live
 *   chase   — proactive "Henderson's $2,400 is overdue, want me to chase it?"
 *   paid    — "Henderson just paid the $2,400. marked it off."
 *   weather — hero "rain forecast for the Toowoomba job, move it?"
 *
 * App beats (org-keyed, for shooting the iOS app — see services/filmSeed.js).
 * These run synchronously and return a summary, because on a shoot you need to
 * know the seed landed before you roll:
 *   film_seed   — backdated clients/jobs/invoices/parts orders into the org of
 *                 a real signed-up phone. Accepts an optional `profile` object
 *                 to override the default (removals) history without a deploy.
 *   app_chase   — the overdue nudge as a PUSH notification, not a text
 *   film_status — counts of what's currently seeded + registered push tokens
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { provisionDemoAccount, fireChase, fireWeather, firePaid } = require('../services/demoAccount');
const { seedFilmHistory, fireAppChase, filmStatus } = require('../services/filmSeed');

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_SECRET;

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const DIRECTOR_SECRET = process.env.DEMO_DIRECTOR_SECRET;

router.post('/fire', async (req, res) => {
  if (!DIRECTOR_SECRET || req.body?.secret !== DIRECTOR_SECRET) {
    return res.sendStatus(403);
  }
  const phone = req.body?.phone;
  const beat = req.body?.beat;
  if (!phone || !beat) {
    return res.status(400).json({ error: 'phone and beat required' });
  }
  if (!supabase) {
    return res.status(500).json({ error: 'supabase not configured' });
  }

  // App beats answer synchronously: the operator needs the result (and any
  // failure reason) before rolling, not a blind 200.
  const APP_BEATS = { film_seed: null, app_chase: null, film_status: null };
  if (beat in APP_BEATS) {
    try {
      let result;
      if (beat === 'film_seed') {
        result = await seedFilmHistory(phone, { supabase, profile: req.body?.profile || {} });
      } else if (beat === 'app_chase') {
        result = await fireAppChase(phone, { supabase });
      } else {
        result = await filmStatus(phone, { supabase });
      }
      return res.json({ ok: true, beat, phone, result });
    } catch (err) {
      console.error('[demoDirector]', beat, err?.message || err);
      return res.status(500).json({ ok: false, beat, phone, error: err?.message || String(err) });
    }
  }

  res.json({ ok: true, beat, phone });

  try {
    if (beat === 'seed') {
      await provisionDemoAccount(phone, { supabase, channel: 'imessage', film: true });
    } else if (beat === 'chase') {
      await fireChase(phone, { supabase, channel: 'imessage' });
    } else if (beat === 'paid') {
      await firePaid(phone, { supabase, channel: 'imessage' });
    } else if (beat === 'weather') {
      await fireWeather(phone, { supabase });
    } else {
      console.warn('[demoDirector] unknown beat:', beat);
    }
  } catch (err) {
    console.error('[demoDirector]', beat, err?.message || err);
  }
});

module.exports = router;
