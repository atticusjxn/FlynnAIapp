import {
  JobExtractionAdapter,
  PipelineLogEntry,
  TranscriptResult,
  TranscriptionAdapter,
  VoicemailPipelineOptions,
  VoicemailProcessingResult,
  VoicemailRepository,
  VoicemailWebhookInput,
} from './types';

const createLogEntry = (
  step: PipelineLogEntry['step'],
  status: PipelineLogEntry['status'],
  message: string,
  meta?: Record<string, any>
): PipelineLogEntry => ({
  step,
  status,
  message,
  meta,
  timestamp: new Date().toISOString(),
});

export class VoicemailPipeline {
  private repository: VoicemailRepository;
  private transcription: TranscriptionAdapter;
  private extraction: JobExtractionAdapter;
  private onLog?: (entry: PipelineLogEntry) => void;

  constructor(options: VoicemailPipelineOptions) {
    this.repository = options.repository;
    this.transcription = options.transcription;
    this.extraction = options.extraction;
    this.onLog = options.onLog;
  }

  private log(entry: PipelineLogEntry) {
    if (this.onLog) {
      this.onLog(entry);
    }
  }

  async process(
    webhook: VoicemailWebhookInput
  ): Promise<VoicemailProcessingResult> {
    const logs: PipelineLogEntry[] = [];

    const appendLog = (entry: PipelineLogEntry) => {
      logs.push(entry);
      this.log(entry);
    };

    appendLog(createLogEntry('ingest', 'pending', 'Checking for existing voicemail record', {
      callSid: webhook.callSid,
      userId: webhook.userId,
    }));

    let record = await this.repository.findByCallSid(
      webhook.callSid,
      webhook.userId
    );

    if (!record) {
      appendLog(
        createLogEntry(
          'ingest',
          'pending',
          'Creating new voicemail record',
          { recordingUrl: webhook.recordingUrl }
        )
      );
      record = await this.repository.create(webhook);
    }

    appendLog(createLogEntry('ingest', 'completed', 'Voicemail stored', {
      recordId: record.id,
    }));

    let transcript: TranscriptResult | undefined;

    if (webhook.transcriptionText) {
      transcript = {
        text: webhook.transcriptionText,
        confidence: 0.6,
        vendor: 'mock',
      };
      appendLog(createLogEntry('transcribe', 'skipped', 'Using transcription supplied by provider'));
    } else {
      appendLog(createLogEntry('transcribe', 'pending', 'Requesting transcription for recording'));
      transcript = await this.transcription.transcribe(webhook.recordingUrl, webhook);
      appendLog(createLogEntry('transcribe', 'completed', 'Transcription completed', {
        confidence: transcript.confidence,
      }));
    }

    record = await this.repository.update(record.id, {
      status: 'transcribed',
      transcript: transcript?.text,
      transcriptConfidence: transcript?.confidence,
    });

    if (!transcript) {
      appendLog(
        createLogEntry('transcribe', 'failed', 'Transcription failed, cannot build job draft')
      );
      throw new Error('Unable to transcribe voicemail recording.');
    }

    appendLog(createLogEntry('extract', 'pending', 'Generating job draft from transcript'));
    const jobDraft = await this.extraction.extract(transcript, webhook);
    appendLog(createLogEntry('extract', 'completed', 'Job draft generated', {
      confidence: jobDraft.confidence,
      clientName: jobDraft.clientName,
      serviceType: jobDraft.serviceType,
    }));

    record = await this.repository.update(record.id, {
      status: 'processed',
      jobDraft,
    });

    appendLog(createLogEntry('persist', 'completed', 'Updated voicemail record with job draft'));

    return {
      record,
      transcript,
      jobDraft,
      logs,
    };
  }
}
