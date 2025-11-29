#!/usr/bin/env node
/**
 * Pre-deployment verification script
 * Checks that all required dependencies and environment variables are configured
 */

require('dotenv').config();

const requiredServerEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'JWT_SECRET',
];

const requiredLLMEnvVars = [
  ['XAI_API_KEY', 'OPENAI_API_KEY'], // At least one must be present
];

const optionalServerEnvVars = [
  'AZURE_SPEECH_KEY',
  'DEEPGRAM_API_KEY',
  'TWILIO_PHONE_NUMBER',
  'PORT',
];

const requiredDependencies = [
  'axios',
  'cheerio',
  'turndown',
  'express',
  'twilio',
  'openai',
  '@supabase/supabase-js',
];

console.log('🔍 Verifying Flynn AI Deployment Configuration\n');

let hasErrors = false;
let hasWarnings = false;

// Check Node version
console.log('📦 Node.js Version:');
const nodeVersion = process.version;
console.log(`   ${nodeVersion}`);
if (parseInt(nodeVersion.slice(1).split('.')[0]) < 18) {
  console.log('   ⚠️  Warning: Node 18+ recommended');
  hasWarnings = true;
} else {
  console.log('   ✅ Compatible');
}
console.log('');

// Check required environment variables
console.log('🔐 Required Environment Variables:');
for (const envVar of requiredServerEnvVars) {
  const value = process.env[envVar];
  if (!value) {
    console.log(`   ❌ ${envVar} - MISSING`);
    hasErrors = true;
  } else {
    const masked = value.slice(0, 8) + '***';
    console.log(`   ✅ ${envVar} - ${masked}`);
  }
}

// Check LLM API keys (at least one required)
console.log('\n🤖 LLM Provider (at least one required):');
let hasLLMKey = false;
for (const envVar of requiredLLMEnvVars[0]) {
  const value = process.env[envVar];
  if (value) {
    const masked = value.slice(0, 8) + '***';
    console.log(`   ✅ ${envVar} - ${masked}`);
    hasLLMKey = true;
  } else {
    console.log(`   ⚪ ${envVar} - Not set`);
  }
}
if (!hasLLMKey) {
  console.log('   ❌ No LLM API key found (XAI_API_KEY or OPENAI_API_KEY required)');
  hasErrors = true;
}

// Check optional environment variables
console.log('\n⚙️  Optional Environment Variables:');
for (const envVar of optionalServerEnvVars) {
  const value = process.env[envVar];
  if (value) {
    const masked = value.length > 20 ? value.slice(0, 8) + '***' : value;
    console.log(`   ✅ ${envVar} - ${masked}`);
  } else {
    console.log(`   ⚪ ${envVar} - Not set (optional)`);
  }
}

// Check dependencies
console.log('\n📚 Required Dependencies:');
let packageJson;
try {
  packageJson = require('../package.json');
} catch (error) {
  console.log('   ❌ Cannot read package.json');
  hasErrors = true;
}

if (packageJson) {
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  for (const dep of requiredDependencies) {
    if (allDeps[dep]) {
      console.log(`   ✅ ${dep} - ${allDeps[dep]}`);
    } else {
      console.log(`   ❌ ${dep} - MISSING`);
      hasErrors = true;
    }
  }
}

// Check new dependencies for website scraping
console.log('\n🆕 New Website Scraping Dependencies:');
const newDeps = ['axios', 'cheerio', 'turndown'];
for (const dep of newDeps) {
  if (packageJson && packageJson.dependencies[dep]) {
    console.log(`   ✅ ${dep} - ${packageJson.dependencies[dep]}`);
  } else {
    console.log(`   ❌ ${dep} - MISSING (run: npm install ${newDeps.join(' ')})`);
    hasErrors = true;
  }
}

// Check if files exist
console.log('\n📄 New Feature Files:');
const fs = require('fs');
const path = require('path');

const newFiles = [
  'services/websiteScraper.js',
  'services/businessProfileGenerator.js',
  'src/types/receptionist.ts',
  'src/components/WebsiteScraperSetup.tsx',
];

for (const file of newFiles) {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} - MISSING`);
    hasErrors = true;
  }
}

// Summary
console.log('\n' + '='.repeat(60));
if (hasErrors) {
  console.log('❌ DEPLOYMENT CHECK FAILED');
  console.log('Please fix the errors above before deploying.');
  process.exit(1);
} else if (hasWarnings) {
  console.log('⚠️  DEPLOYMENT CHECK PASSED WITH WARNINGS');
  console.log('Consider addressing the warnings above.');
  process.exit(0);
} else {
  console.log('✅ DEPLOYMENT CHECK PASSED');
  console.log('All required configuration is in place.');
  console.log('\nReady to deploy! Run:');
  console.log('  npm run dev          # Test locally');
  console.log('  npx eas build --profile production --platform all');
  process.exit(0);
}
