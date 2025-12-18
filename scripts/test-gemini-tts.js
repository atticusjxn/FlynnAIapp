/**
 * Test script for Gemini TTS integration
 *
 * This script tests the Gemini TTS service to ensure it's working correctly.
 *
 * Usage:
 *   node scripts/test-gemini-tts.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { generateSpeech, getAvailableVoices } = require('../services/geminiTTSService');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OUTPUT_DIR = path.join(__dirname, '../test-output');

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function testBasicSpeech() {
  console.log('\n📝 Test 1: Basic Speech Generation');
  console.log('=' .repeat(50));

  const text = "Hi, you've reached Flynn — how can we help with your event today?";

  try {
    const result = await generateSpeech(GEMINI_API_KEY, text, {
      voiceName: 'Kore',
      model: 'gemini-2.5-flash-preview-tts',
      outputFormat: 'wav',
    });

    const outputPath = path.join(OUTPUT_DIR, 'test-basic.wav');
    const audioBuffer = Buffer.from(result.audio, 'base64');
    fs.writeFileSync(outputPath, audioBuffer);

    console.log('✅ Success!');
    console.log(`   Voice: Kore`);
    console.log(`   Format: ${result.format}`);
    console.log(`   Content-Type: ${result.contentType}`);
    console.log(`   File size: ${audioBuffer.length} bytes`);
    console.log(`   Saved to: ${outputPath}`);
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

async function testStyleControl() {
  console.log('\n🎨 Test 2: Style Control');
  console.log('=' .repeat(50));

  const text = "Welcome to Flynn AI! We're excited to help you manage your business more efficiently.";

  try {
    const result = await generateSpeech(GEMINI_API_KEY, text, {
      voiceName: 'Puck',
      style: 'cheerful and enthusiastic',
      pace: 'speak at an energetic, upbeat pace',
      outputFormat: 'wav',
    });

    const outputPath = path.join(OUTPUT_DIR, 'test-style-enthusiastic.wav');
    const audioBuffer = Buffer.from(result.audio, 'base64');
    fs.writeFileSync(outputPath, audioBuffer);

    console.log('✅ Success!');
    console.log(`   Voice: Puck (Upbeat)`);
    console.log(`   Style: cheerful and enthusiastic`);
    console.log(`   Pace: energetic, upbeat`);
    console.log(`   File size: ${audioBuffer.length} bytes`);
    console.log(`   Saved to: ${outputPath}`);
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

async function testDifferentVoices() {
  console.log('\n🎤 Test 3: Different Voice Personas');
  console.log('=' .repeat(50));

  const testCases = [
    { voice: 'Sulafat', persona: 'flynn_warm', description: 'Warm, friendly' },
    { voice: 'Kore', persona: 'flynn_expert', description: 'Firm, professional' },
    { voice: 'Puck', persona: 'flynn_hype', description: 'Upbeat, energetic' },
  ];

  const text = "Thank you for calling. I've noted your details and will get back to you shortly.";

  for (const testCase of testCases) {
    console.log(`\n   Testing ${testCase.voice} (${testCase.description})...`);

    try {
      const result = await generateSpeech(GEMINI_API_KEY, text, {
        voiceName: testCase.voice,
        outputFormat: 'wav',
      });

      const outputPath = path.join(OUTPUT_DIR, `test-voice-${testCase.persona}.wav`);
      const audioBuffer = Buffer.from(result.audio, 'base64');
      fs.writeFileSync(outputPath, audioBuffer);

      console.log(`   ✅ ${testCase.voice}: ${audioBuffer.length} bytes`);
    } catch (error) {
      console.error(`   ❌ ${testCase.voice} failed:`, error.message);
    }
  }
}

async function testAccentControl() {
  console.log('\n🌍 Test 4: Accent Control');
  console.log('=' .repeat(50));

  const text = "Good morning! I'm calling about your recent inquiry.";

  try {
    const result = await generateSpeech(GEMINI_API_KEY, text, {
      voiceName: 'Aoede',
      accent: 'Australian English',
      style: 'friendly and professional',
      outputFormat: 'wav',
    });

    const outputPath = path.join(OUTPUT_DIR, 'test-accent-australian.wav');
    const audioBuffer = Buffer.from(result.audio, 'base64');
    fs.writeFileSync(outputPath, audioBuffer);

    console.log('✅ Success!');
    console.log(`   Voice: Aoede (Breezy)`);
    console.log(`   Accent: Australian English`);
    console.log(`   File size: ${audioBuffer.length} bytes`);
    console.log(`   Saved to: ${outputPath}`);
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

async function testPCMOutput() {
  console.log('\n🔊 Test 5: PCM Output (for Realtime)');
  console.log('=' .repeat(50));

  const text = "Testing PCM audio format for real-time telephony.";

  try {
    const result = await generateSpeech(GEMINI_API_KEY, text, {
      voiceName: 'Kore',
      outputFormat: 'pcm',
    });

    const outputPath = path.join(OUTPUT_DIR, 'test-pcm.raw');
    const audioBuffer = Buffer.from(result.audio, 'base64');
    fs.writeFileSync(outputPath, audioBuffer);

    console.log('✅ Success!');
    console.log(`   Format: ${result.format} (24kHz 16-bit mono)`);
    console.log(`   Content-Type: ${result.contentType}`);
    console.log(`   File size: ${audioBuffer.length} bytes`);
    console.log(`   Saved to: ${outputPath}`);
    console.log(`   Note: This is raw PCM data, use Audacity to play it`);
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

async function listAvailableVoices() {
  console.log('\n📋 Available Gemini Voices');
  console.log('=' .repeat(50));

  const voices = getAvailableVoices();

  console.log(`\nTotal voices: ${voices.length}\n`);

  // Group by description
  const grouped = {};
  voices.forEach(voice => {
    if (!grouped[voice.description]) {
      grouped[voice.description] = [];
    }
    grouped[voice.description].push(voice.name);
  });

  Object.entries(grouped).forEach(([description, names]) => {
    console.log(`   ${description.padEnd(20)} : ${names.join(', ')}`);
  });
}

async function runTests() {
  console.log('\n🧪 Gemini TTS Integration Tests');
  console.log('='.repeat(50));

  // Check API key
  if (!GEMINI_API_KEY) {
    console.error('\n❌ Error: GEMINI_API_KEY not found in environment variables');
    console.log('   Please add GEMINI_API_KEY to your .env file');
    process.exit(1);
  }

  console.log(`\n✓ API Key: ${GEMINI_API_KEY.substring(0, 10)}...`);
  console.log(`✓ Output Directory: ${OUTPUT_DIR}`);

  try {
    await listAvailableVoices();
    await testBasicSpeech();
    await testStyleControl();
    await testDifferentVoices();
    await testAccentControl();
    await testPCMOutput();

    console.log('\n' + '='.repeat(50));
    console.log('🎉 All tests completed!');
    console.log(`\n📁 Audio files saved to: ${OUTPUT_DIR}`);
    console.log('\nYou can play the WAV files with any audio player.');
    console.log('For PCM files, use Audacity: Import > Raw Data');
    console.log('  - Encoding: Signed 16-bit PCM');
    console.log('  - Byte order: Little-endian');
    console.log('  - Channels: 1 (Mono)');
    console.log('  - Sample rate: 24000 Hz');
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
