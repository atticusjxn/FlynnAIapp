#!/usr/bin/env node

/**
 * Script to apply database migration directly via Supabase execute_sql function
 * This bypasses the migration history sync issue
 */

const https = require('https');
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

// Read the migration SQL
const migrationPath = path.join(__dirname, '../supabase/migrations/20260108000000_add_setup_progress_fields.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

console.log('[Migration] Applying setup progress fields migration...');
console.log('[Migration] SQL:', migrationSQL);

// Execute SQL via execute_sql function
const executeSQL = async (sql) => {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + '/rest/v1/rpc/execute_sql');

    const postData = JSON.stringify({
      query: sql
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('[Migration] Success! Response:', data);
          resolve(data);
        } else {
          console.error('[Migration] Error:', res.statusCode, data);
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('[Migration] Request error:', error);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
};

// Run migration
executeSQL(migrationSQL)
  .then(() => {
    console.log('[Migration] ✅ Setup progress fields added successfully!');
    console.log('[Migration] The following columns have been added to users table:');
    console.log('  - has_completed_onboarding');
    console.log('  - has_seen_demo');
    console.log('  - has_started_trial');
    console.log('  - has_provisioned_phone');
    console.log('  - demo_greeting_customized');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Migration] ❌ Failed to apply migration:', error.message);
    process.exit(1);
  });
