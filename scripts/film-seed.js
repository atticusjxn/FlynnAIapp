#!/usr/bin/env node
//
// Local runner for the demo-shoot beats in services/filmSeed.js.
//
// Same three beats the director endpoint exposes, but run straight from your
// machine against prod — so a shoot never waits on a Fly deploy.
//
//   node scripts/film-seed.js status  +61497779071
//   node scripts/film-seed.js wipe    +61497779071   (clean slate before a funnel take)
//   node scripts/film-seed.js seed    +61497779071
//   node scripts/film-seed.js seed    +61497779071 --profile ./my-profile.json
//   node scripts/film-seed.js chase   +61497779071
//
// `chase` sends a real push, so APNS_* must be set in .env for it to reach the
// phone; the rest need only the Supabase service key.
//
// `wipe` keeps users.is_demo ON so agent tools stay on the simulated path —
// pass --clear-demo-flag to turn it off and let tools hit real providers.

require('dotenv').config();
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { seedFilmHistory, fireAppChase, filmStatus, wipeForFunnelTake } = require('../services/filmSeed');

const [, , beat, rawPhone, ...rest] = process.argv;

if (!beat || !rawPhone) {
  console.error('usage: node scripts/film-seed.js <seed|chase|status> <+61...> [--profile ./file.json]');
  process.exit(1);
}

const phone = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone.replace(/\D/g, '')}`;

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_SECRET;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (check .env)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function loadProfile() {
  const idx = rest.indexOf('--profile');
  if (idx === -1) return {};
  const file = rest[idx + 1];
  if (!file) {
    console.error('--profile needs a path to a JSON file');
    process.exit(1);
  }
  return require(path.resolve(process.cwd(), file));
}

(async () => {
  try {
    let result;
    if (beat === 'seed') {
      result = await seedFilmHistory(phone, { supabase, profile: loadProfile() });
    } else if (beat === 'chase') {
      result = await fireAppChase(phone, { supabase });
    } else if (beat === 'status') {
      result = await filmStatus(phone, { supabase });
    } else if (beat === 'wipe') {
      result = await wipeForFunnelTake(phone, {
        supabase,
        clearDemoFlag: rest.includes('--clear-demo-flag'),
      });
    } else {
      console.error(`unknown beat "${beat}" — expected wipe, seed, chase or status`);
      process.exit(1);
    }
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(`[film-seed] ${beat} failed:`, err?.message || err);
    process.exit(1);
  }
})();
