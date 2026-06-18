#!/usr/bin/env node
/**
 * One-off backfill: give every phone-keyed public.users row a real, id-aligned
 * auth.users record so existing texters can sign into the iOS app via the no-OTP
 * magic link (services/authLink.js).
 *
 * For each orphan row (a users row with a phone but no matching auth.users), we
 * create the auth user WITH the existing public.users.id. The on_auth_user_created
 * trigger then runs `on conflict (id) do update`, realigning the row in place so
 * all existing FKs (jobs.user_id, business_profiles.user_id, tone_samples.user_id)
 * stay valid. Idempotent: rows already aligned are skipped.
 *
 * Phone collisions — a row whose phone already belongs to a DIFFERENT auth.users
 * (e.g. a user who also did old phone-OTP signup) — are logged and skipped, never
 * auto-merged.
 *
 * Usage:
 *   node scripts/backfill-auth-users.js           # dry run, report only
 *   node scripts/backfill-auth-users.js --apply   # create the auth users
 *
 * Run against a Supabase branch first and verify a reconciled user's RLS reads
 * before pointing it at production.
 */

const { createClient } = require('@supabase/supabase-js');

const APPLY = process.argv.includes('--apply');

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_SECRET;

const PHONE_EMAIL_DOMAIN = process.env.FLYNN_PHONE_EMAIL_DOMAIN || 'phone.flynnai.app';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function syntheticEmail(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  return `${digits}@${PHONE_EMAIL_DOMAIN}`;
}

// Build an index of existing auth users by id and by normalised phone.
async function indexAuthUsers() {
  const byId = new Set();
  const phoneToId = new Map();
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const users = data?.users || [];
    for (const u of users) {
      byId.add(u.id);
      if (u.phone) phoneToId.set(`+${u.phone.replace(/\D/g, '')}`, u.id);
    }
    if (users.length < 1000) break;
    page += 1;
  }
  return { byId, phoneToId };
}

async function main() {
  console.log(`[backfill] mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

  const { byId, phoneToId } = await indexAuthUsers();
  console.log(`[backfill] existing auth users: ${byId.size}`);

  const { data: rows, error } = await admin
    .from('users')
    .select('id, phone')
    .not('phone', 'is', null);
  if (error) throw new Error(`users select failed: ${error.message}`);

  const stats = { total: rows.length, aligned: 0, collisions: 0, created: 0, failed: 0 };

  for (const row of rows) {
    const phone = `+${(row.phone || '').replace(/\D/g, '')}`;

    if (byId.has(row.id)) {
      stats.aligned += 1;
      continue;
    }

    const existingForPhone = phoneToId.get(phone);
    if (existingForPhone && existingForPhone !== row.id) {
      stats.collisions += 1;
      console.warn(`[backfill] COLLISION phone=${phone} users.id=${row.id} already-auth-id=${existingForPhone} (skipping — resolve manually)`);
      continue;
    }

    if (!APPLY) {
      stats.created += 1;
      console.log(`[backfill] would create auth user id=${row.id} phone=${phone}`);
      continue;
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      id: row.id,
      phone,
      email: syntheticEmail(phone),
      phone_confirm: true,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      stats.failed += 1;
      console.error(`[backfill] FAILED id=${row.id} phone=${phone}: ${createErr?.message}`);
      continue;
    }
    stats.created += 1;
    byId.add(row.id);
    phoneToId.set(phone, row.id);
    console.log(`[backfill] created auth user id=${row.id} phone=${phone}`);
  }

  console.log('[backfill] done', stats);
  if (stats.collisions > 0) {
    console.log('[backfill] NOTE: collisions need manual resolution before those users can use app sign-in.');
  }
}

main().catch((err) => {
  console.error('[backfill] fatal:', err?.message || err);
  process.exit(1);
});
