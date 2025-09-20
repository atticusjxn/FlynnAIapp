import { JobExtraction } from '../../types/calls.types';

export interface VoicemailWebhookInput {
  callSid: string;
  userId: string;
  from: string;
  to: string;
  recordingUrl: string;
  recordingSid?: string;
  recordingDuration?: number;
  transcriptionText?: string;
  transcriptionStatus?: 'none' | 'in-progress' | 'completed' | 'failed';
  receivedAt?: string;
}

export interface StoredVoicemailRecord {
  id: string;
  callSid: string;
  userId: string;
  fromNumber: string;
  toNumber: string;
  recordingUrl: string;
  recordingSid?: string;
  status: 'pending' | 'transcribing' | 'transcribed' | 'processed' | 'failed';
  transcript?: string;
  transcriptConfidence?: number;
  jobDraft?: JobExtraction;
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptResult {
  text: string;
  confidence: number;
  vendor?: 'openai' | 'whisper' | 'deepgram' | 'assembly' | 'mock';
  raw?: any;
}

export interface PipelineLogEntry {
  step: 'ingest' | 'transcribe' | 'extract' | 'persist' | 'notify';
  status: 'pending' | 'skipped' | 'completed' | 'failed';
  message: string;
  timestamp: string;
  meta?: Record<string, any>;
}

export interface VoicemailProcessingResult {
  record: StoredVoicemailRecord;
  transcript?: TranscriptResult;
  jobDraft?: JobExtraction;
  logs: PipelineLogEntry[];
}

export interface VoicemailRepository {
  findByCallSid(callSid: string, userId: string): Promise<StoredVoicemailRecord | null>;
  create(input: VoicemailWebhookInput): Promise<StoredVoicemailRecord>;
  update(
    id: string,
    updates: Partial<Omit<StoredVoicemailRecord, 'id' | 'userId' | 'callSid'>>
  ): Promise<StoredVoicemailRecord>;
}

export interface TranscriptionAdapter {
  transcribe(recordingUrl: string, context: VoicemailWebhookInput): Promise<TranscriptResult>;
}

export interface JobExtractionAdapter {
  extract(
    transcript: TranscriptResult,
    context: VoicemailWebhookInput
  ): Promise<JobExtraction>;
}

export interface VoicemailPipelineOptions {
  repository: VoicemailRepository;
  transcription: TranscriptionAdapter;
  extraction: JobExtractionAdapter;
  onLog?: (entry: PipelineLogEntry) => void;
}
