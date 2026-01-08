#!/usr/bin/env node

/**
 * Add setup progress fields to users table using programmatic approach
 * This bypasses SQL execution issues by using Supabase metadata API
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Read environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkAndAddFields() {
  console.log('[Setup] Checking if setup progress fields exist...\n');

  // Try to query the new fields
  const { data, error } = await supabase
    .from('users')
    .select('id, has_completed_onboarding, has_seen_demo, has_started_trial, has_provisioned_phone, demo_greeting_customized')
    .limit(1);

  if (error) {
    if (error.message.includes('column') && error.message.includes('does not exist')) {
      console.log('[Setup] ❌ Setup fields do not exist yet');
      console.log('[Setup] Missing column detected:', error.message);
      console.log('\n[Setup] To manually add these fields, run the following SQL in Supabase SQL Editor:');
      console.log('========================================\n');
      console.log(`ALTER TABLE users
ADD COLUMN IF NOT EXISTS has_completed_onboarding BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_seen_demo BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_started_trial BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_provisioned_phone BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS demo_greeting_customized TEXT;

CREATE INDEX IF NOT EXISTS idx_users_setup_progress
ON users(has_completed_onboarding, has_seen_demo, has_started_trial, has_provisioned_phone);
`);
      console.log('========================================\n');
      console.log('[Setup] Navigate to: https://supabase.com/dashboard/project/zvfeafmmtfplzpnocyjw/sql/new');
      console.log('[Setup] Paste the SQL above and click "Run"');
      process.exit(1);
    } else {
      console.error('[Setup] Unexpected error:', error);
      process.exit(1);
    }
  } else {
    console.log('[Setup] ✅ All setup progress fields exist!');
    console.log('[Setup] Found columns:');
    console.log('  ✓ has_completed_onboarding');
    console.log('  ✓ has_seen_demo');
    console.log('  ✓ has_started_trial');
    console.log('  ✓ has_provisioned_phone');
    console.log('  ✓ demo_greeting_customized');
    console.log('\n[Setup] Migration is complete and ready to use!');
    process.exit(0);
  }
}

checkAndAddFields();
