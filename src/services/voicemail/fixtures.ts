import { JobExtraction } from '../../types/calls.types';
import {
  InMemoryVoicemailRepository,
} from './InMemoryVoicemailRepository';
import {
  TranscriptResult,
  VoicemailPipelineOptions,
  VoicemailWebhookInput,
} from './types';
import { VoicemailPipeline } from './pipeline';

export const sampleVoicemailWebhook: VoicemailWebhookInput = {
  callSid: 'CA_fixture123',
  userId: 'user_fixture',
  from: '+15551231234',
  to: '+15559876543',
  recordingUrl: 'https://example.com/recordings/fixture123.mp3',
  recordingSid: 'RE_fixture123',
  recordingDuration: 78,
  receivedAt: new Date().toISOString(),
};

export const sampleTranscript: TranscriptResult = {
  text: `Hi Flynn team, this is Sarah from Harbor Plumbing. We missed your call earlier today.
We have a homeowner in Pacific Heights reporting a leaking water heater and they need someone out tomorrow morning around 9am if possible.
Their address is 1829 Jackson Street, San Francisco and the phone number is 415-555-0199. Please give me a quick confirmation text once it's booked. Thanks!`,
  confidence: 0.92,
  vendor: 'mock',
};

export const sampleJobExtraction: JobExtraction = {
  confidence: 0.88,
  clientName: 'Sarah (Harbor Plumbing)',
  clientPhone: '+14155550199',
  serviceType: 'Water heater leak assessment',
  description: 'Leak reported at Pacific Heights residence; requested morning visit around 9am tomorrow.',
  scheduledDate: new Date().toISOString().split('T')[0],
  scheduledTime: '09:00',
  location: '1829 Jackson Street, San Francisco, CA',
  followUpRequired: true,
  urgency: 'high',
  extractedAt: new Date().toISOString(),
};

export const createFixturePipeline = () => {
  const repository = new InMemoryVoicemailRepository();
  const options: VoicemailPipelineOptions = {
    repository,
    transcription: {
      async transcribe() {
        return sampleTranscript;
      },
    },
    extraction: {
      async extract() {
        return sampleJobExtraction;
      },
    },
  };

  const pipeline = new VoicemailPipeline(options);

  return {
    pipeline,
    repository,
  };
};

export const runFixturePipeline = async () => {
  const { pipeline } = createFixturePipeline();
  return pipeline.process({
    ...sampleVoicemailWebhook,
    transcriptionText: sampleTranscript.text,
    transcriptionStatus: 'completed',
  });
};
