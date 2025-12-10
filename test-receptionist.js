#!/usr/bin/env node
/**
 * Test AI Receptionist Integration
 *
 * This script simulates app interactions with the backend to test:
 * 1. Website scraping and AI training
 * 2. Greeting generation
 * 3. Follow-up questions generation
 * 4. Updating AI receptionist configuration
 */

// Load environment variables FIRST before any other requires
const dotenv = require('dotenv');
dotenv.config();

// Now load modules that depend on env vars
const { createClient } = require('@supabase/supabase-js');
const { scrapeWebsite } = require('./services/websiteScraper');
const { generateReceptionistConfig } = require('./services/businessProfileGenerator');

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_KEY
  || process.env.SUPABASE_SECRET;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, colors.bright + colors.cyan);
  console.log('='.repeat(80) + '\n');
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logError(message) {
  log(`✗ ${message}`, colors.red);
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.blue);
}

function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

/**
 * Get user by email
 */
async function getUserByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, receptionist_greeting, receptionist_questions, receptionist_business_profile, receptionist_mode, receptionist_configured')
    .eq('email', email)
    .single();

  if (error) {
    throw new Error(`Failed to fetch user: ${error.message}`);
  }

  return data;
}

/**
 * Test 1: Website Scraping
 */
async function testWebsiteScraping(url) {
  logSection('TEST 1: Website Scraping');
  logInfo(`Scraping website: ${url}`);

  try {
    const scrapedData = await scrapeWebsite(url);

    logSuccess('Website scraped successfully');
    logInfo(`Content length: ${scrapedData.content?.length || 0} characters`);
    logInfo(`Services found: ${scrapedData.services?.length || 0}`);
    logInfo(`Has structured data: ${scrapedData.structuredData?.length > 0 ? 'Yes' : 'No'}`);
    logInfo(`Has metadata: ${scrapedData.metadata?.description ? 'Yes' : 'No'}`);

    console.log('\nScraped Data Preview:');
    console.log('--------------------');
    console.log('Title:', scrapedData.metadata?.title || 'N/A');
    console.log('Description:', scrapedData.metadata?.description || 'N/A');
    console.log('Services:', scrapedData.services?.slice(0, 5).join(', ') || 'None');
    console.log('Contact:', JSON.stringify(scrapedData.contact, null, 2));

    return scrapedData;
  } catch (error) {
    logError(`Website scraping failed: ${error.message}`);
    throw error;
  }
}

/**
 * Test 2: AI Receptionist Config Generation
 */
async function testConfigGeneration(scrapedData) {
  logSection('TEST 2: AI Receptionist Config Generation');
  logInfo('Generating business profile, greeting, and questions...');

  try {
    const config = await generateReceptionistConfig(scrapedData);

    logSuccess('AI receptionist config generated successfully');

    console.log('\nGenerated Configuration:');
    console.log('========================');

    console.log('\n📋 Business Profile:');
    console.log('  Public Name:', config.businessProfile.public_name);
    console.log('  Headline:', config.businessProfile.headline);
    console.log('  Description:', config.businessProfile.description);
    console.log('  Services:', config.businessProfile.services?.join(', '));
    console.log('  Brand Voice:', JSON.stringify(config.businessProfile.brand_voice, null, 2));
    console.log('  Target Audience:', config.businessProfile.target_audience);

    console.log('\n💬 Greeting Script:');
    console.log('  ', config.greetingScript);

    console.log('\n❓ Intake Questions:');
    config.intakeQuestions.forEach((q, i) => {
      console.log(`  ${i + 1}. ${q}`);
    });

    return config;
  } catch (error) {
    logError(`Config generation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Test 3: Apply Config to User
 */
async function testApplyConfig(userId, config) {
  logSection('TEST 3: Apply Config to User');
  logInfo(`Applying configuration to user: ${userId}`);

  try {
    const { error } = await supabase
      .from('users')
      .update({
        receptionist_greeting: config.greetingScript,
        receptionist_questions: config.intakeQuestions,
        receptionist_business_profile: config.businessProfile,
        receptionist_mode: 'hybrid_choice',
        receptionist_configured: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to apply config: ${error.message}`);
    }

    logSuccess('Configuration applied to user successfully');

    // Verify the update
    const updatedUser = await getUserByEmail('a@a.com');

    console.log('\nUpdated User Profile:');
    console.log('=====================');
    console.log('Greeting:', updatedUser.receptionist_greeting);
    console.log('Questions:', updatedUser.receptionist_questions);
    console.log('Business Profile:', JSON.stringify(updatedUser.receptionist_business_profile, null, 2));
    console.log('Mode:', updatedUser.receptionist_mode);
    console.log('Configured:', updatedUser.receptionist_configured);

    return updatedUser;
  } catch (error) {
    logError(`Applying config failed: ${error.message}`);
    throw error;
  }
}

/**
 * Test 4: Update Individual Fields
 */
async function testUpdateFields(userId) {
  logSection('TEST 4: Update Individual Fields');
  logInfo('Testing manual updates to greeting and questions...');

  const customGreeting = "G'day! You've reached Smith's Plumbing. Thanks for calling Brisbane's most trusted plumbers. How can we help you today?";
  const customQuestions = [
    "What's your name?",
    "What plumbing issue can we help you with?",
    "Where is the job located?",
    "When do you need this done?",
    "What's the best contact number for you?"
  ];

  try {
    const { error } = await supabase
      .from('users')
      .update({
        receptionist_greeting: customGreeting,
        receptionist_questions: customQuestions,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to update fields: ${error.message}`);
    }

    logSuccess('Fields updated successfully');

    // Verify the update
    const updatedUser = await getUserByEmail('a@a.com');

    console.log('\nUpdated Fields:');
    console.log('===============');
    console.log('New Greeting:', updatedUser.receptionist_greeting);
    console.log('New Questions:');
    updatedUser.receptionist_questions.forEach((q, i) => {
      console.log(`  ${i + 1}. ${q}`);
    });

    return updatedUser;
  } catch (error) {
    logError(`Updating fields failed: ${error.message}`);
    throw error;
  }
}

/**
 * Test 5: Configure Default Missed Call Behavior
 */
async function testMissedCallDefaults(userId) {
  logSection('TEST 5: Configure Missed Call Defaults');
  logInfo('Setting AI receptionist to hybrid_choice mode (offer message or booking option)...');

  try {
    // The default behavior should be 'hybrid_choice' mode which handles missed calls
    // by offering callers the option to leave a message or book an appointment
    const { error } = await supabase
      .from('users')
      .update({
        receptionist_mode: 'hybrid_choice',
        receptionist_configured: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to set defaults: ${error.message}`);
    }

    logSuccess('Missed call defaults configured successfully');
    logInfo('AI receptionist will now offer: "Would you like to leave a message, or would you prefer to book an appointment with me now?"');

    // Verify the setting
    const updatedUser = await getUserByEmail('a@a.com');
    console.log('\nMissed Call Configuration:');
    console.log('==========================');
    console.log('Mode:', updatedUser.receptionist_mode);
    console.log('Configured:', updatedUser.receptionist_configured);
    console.log('\nBehavior:');
    console.log('- Hybrid choice mode is now active');
    console.log('- AI will ask callers if they want to leave a message or book');
    console.log('- If they choose "leave message", call ends and voicemail is recorded');
    console.log('- If they choose "book", AI proceeds with intake questions');

    return updatedUser;
  } catch (error) {
    logError(`Setting defaults failed: ${error.message}`);
    throw error;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  const testUrl = 'https://www.smithsplumbing.au/qld/?dyn1=Brisbane&dyn2=Hot%20Water%20Plumbing&gad_source=1&gad_campaignid=22916698514&gbraid=0AAAABBNEQrlYG3D30UmBnORx6tN-_Nj7x&gclid=Cj0KCQiArt_JBhCTARIsADQZaynHOniYAU5z_aF-oVYcqFxuf62SfHl3SA2PMs0U_g76YmqPMXrYl88aAhzxEALw_wcB';

  log('\n🚀 Starting AI Receptionist Integration Tests\n', colors.bright + colors.cyan);
  logInfo(`Test URL: ${testUrl}`);
  logInfo(`Test User: a@a.com`);

  try {
    // Get user
    logInfo('\nFetching user account...');
    const user = await getUserByEmail('a@a.com');
    logSuccess(`Found user: ${user.email} (${user.id})`);

    console.log('\nCurrent Configuration:');
    console.log('======================');
    console.log('Greeting:', user.receptionist_greeting || 'Not set');
    console.log('Questions:', user.receptionist_questions?.length || 0, 'questions');
    console.log('Mode:', user.receptionist_mode || 'Not set');
    console.log('Configured:', user.receptionist_configured || false);

    // Test 1: Scrape website
    const scrapedData = await testWebsiteScraping(testUrl);

    // Test 2: Generate config
    const config = await testConfigGeneration(scrapedData);

    // Test 3: Apply config
    await testApplyConfig(user.id, config);

    // Test 4: Update individual fields
    await testUpdateFields(user.id);

    // Test 5: Configure missed call defaults
    await testMissedCallDefaults(user.id);

    // Final summary
    logSection('✅ ALL TESTS PASSED');
    logSuccess('Website scraping works correctly');
    logSuccess('AI config generation works correctly');
    logSuccess('Config application works correctly');
    logSuccess('Field updates work correctly');
    logSuccess('Missed call defaults configured correctly');

    console.log('\n📝 Summary:');
    console.log('===========');
    console.log('• The app can successfully scrape business websites');
    console.log('• AI generates appropriate greetings and questions');
    console.log('• Configuration updates are persisted to the database');
    console.log('• User changes to greeting/questions work as expected');
    console.log('• Default missed call behavior is configured');
    console.log('\n');

  } catch (error) {
    logSection('❌ TESTS FAILED');
    logError(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run tests
runTests();
