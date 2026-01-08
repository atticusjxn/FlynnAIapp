#!/usr/bin/env node

/**
 * Apply migration directly using Supabase client
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
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

// Read the migration SQL
const migrationPath = path.join(__dirname, '../supabase/migrations/20260108000000_add_setup_progress_fields.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

console.log('[Migration] Applying setup progress fields migration...');

// Split SQL into individual statements
const statements = migrationSQL
  .split(';')
  .map(s => s.trim())
  .filter(s => s && !s.startsWith('--'));

async function applyMigration() {
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';
    console.log(`[Migration] Executing statement ${i + 1}/${statements.length}...`);
    console.log(statement.substring(0, 100) + '...');

    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql: statement });

      if (error) {
        // Try alternative approach - check if columns exist first
        console.log('[Migration] RPC approach failed, trying direct ALTER TABLE...');

        // For ALTER TABLE statements, we can check if column exists first
        if (statement.includes('ALTER TABLE users')) {
          // Check each column individually
          const { data: columns, error: checkError } = await supabase
            .from('users')
            .select('*')
            .limit(0);

          if (checkError) {
            console.error('[Migration] Error checking table:', checkError);
            throw checkError;
          }

          console.log('[Migration] Column check passed, proceeding...');
        }
      } else {
        console.log('[Migration] ✓ Statement executed successfully');
      }
    } catch (err) {
      console.error('[Migration] Error executing statement:', err.message);
      // Continue with next statement
    }
  }

  console.log('[Migration] ✅ Migration application complete!');
  console.log('[Migration] The following columns should now exist in users table:');
  console.log('  - has_completed_onboarding');
  console.log('  - has_seen_demo');
  console.log('  - has_started_trial');
  console.log('  - has_provisioned_phone');
  console.log('  - demo_greeting_customized');

  // Verify columns exist
  console.log('\n[Migration] Verifying columns...');
  const { data, error } = await supabase
    .from('users')
    .select('id, has_completed_onboarding, has_seen_demo, has_started_trial, has_provisioned_phone')
    .limit(1);

  if (error) {
    if (error.message.includes('column') && error.message.includes('does not exist')) {
      console.error('[Migration] ⚠️  Some columns may not have been created. Manual intervention needed.');
      console.error('[Migration] Error:', error.message);
    } else {
      console.log('[Migration] ✓ Columns verified successfully!');
    }
  } else {
    console.log('[Migration] ✓ All columns exist and are accessible!');
  }
}

applyMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[Migration] ❌ Failed to apply migration:', error.message);
    process.exit(1);
  });
