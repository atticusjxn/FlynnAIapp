#!/usr/bin/env node

require('dotenv').config();
const { getLLMClient } = require('../llmClient');
const { ensureJobForTranscript } = require('../telephony/jobCreation');
const { getTranscriptByCallSid } = require('../supabaseMcpClient');

const usage = () => {
  console.log('Usage: node scripts/createJobFromTranscriptSample.js <call_sid>');
  console.log('Optionally set SAMPLE_CALL_SID env var to skip passing an argument.');
};

const resolveCallSid = () => {
  if (process.argv[2]) {
    return process.argv[2];
  }

  if (process.env.SAMPLE_CALL_SID) {
    return process.env.SAMPLE_CALL_SID;
  }

  return null;
};

const main = async () => {
  const callSid = resolveCallSid();
  if (!callSid) {
    usage();
    process.exit(1);
  }

  const transcriptRow = await getTranscriptByCallSid(callSid);
  if (!transcriptRow) {
    console.error('No transcript found for call_sid:', callSid);
    process.exit(1);
  }

  let llmClient;
  try {
    llmClient = getLLMClient();
  } catch (error) {
    throw new Error(`Failed to initialise LLM client: ${error.message}`);
  }

  const job = await ensureJobForTranscript({
    callSid,
    transcriptText: transcriptRow.text,
    llmClient,
  });

  console.log('Job creation completed:', job);
};

main().catch((error) => {
  console.error('Job creation harness encountered an error:', error);
  process.exit(1);
});
