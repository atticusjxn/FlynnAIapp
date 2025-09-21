import { TwilioService } from './TwilioService';
import { supabase } from './supabase';
import { 
  TwilioWebhookPayload,
  CallProcessingResult,
  JobExtraction,
  CallProcessingError as CallError
} from '../types/calls.types';
import { VoicemailPipeline } from './voicemail/pipeline';
import { SupabaseVoicemailRepository } from './voicemail/SupabaseVoicemailRepository';

// Use the standardized webhook payload type
export type TwilioWebhookData = TwilioWebhookPayload;

export interface TwiMLResponse {
  toString(): string;
}

// Re-export the standardized type
export type { CallProcessingResult } from '../types/calls.types';

const createCallError = ({
  callId,
  phase,
  code,
  message,
  details,
}: {
  callId: string;
  phase: 'webhook' | 'transcription' | 'job_extraction' | 'client_creation';
  code: string;
  message: string;
  details?: unknown;
}): CallError => {
  const error = new CallError(message, callId, phase, details);
  (error as CallError & { code: string; timestamp: string }).code = code;
  (error as CallError & { timestamp: string }).timestamp = new Date().toISOString();
  return error;
};

class CallHandlerClass {
  /**
   * Handle incoming voice webhook from Twilio
   */
  async handleVoiceWebhook(webhookData: TwilioWebhookData, userId: string): Promise<string> {
    try {
      console.log(`Handling voice webhook for user ${userId}:`, webhookData);

      // Store the call record immediately
      const callRecord = await TwilioService.storeCallRecord({
        callSid: webhookData.CallSid,
        fromNumber: webhookData.From,
        toNumber: webhookData.To,
        status: 'in-progress'
      });

      // Generate TwiML response for call handling
      const twiml = this.generateVoiceTwiML(userId, webhookData);
      
      return twiml;
    } catch (error) {
      console.error('Error handling voice webhook:', error);
      return this.generateErrorTwiML();
    }
  }

  /**
   * Handle call status updates from Twilio
   */
  async handleStatusWebhook(webhookData: TwilioWebhookData, userId: string): Promise<void> {
    try {
      console.log(`Handling status webhook for user ${userId}:`, webhookData);

      // Find existing call record
      const { data: existingCall, error: findError } = await supabase
        .from('calls')
        .select('id, call_sid, from_number, to_number, recording_url, recording_sid')
        .eq('call_sid', webhookData.CallSid)
        .eq('user_id', userId)
        .single();

      if (findError || !existingCall) {
        console.error('Call record not found for status update:', webhookData.CallSid);
        return;
      }

      // Update call status and duration
      const updates: any = {
        status: this.mapTwilioStatus(webhookData.CallStatus)
      };

      if (webhookData.CallDuration) {
        updates.duration = parseInt(webhookData.CallDuration);
      }

      await TwilioService.updateCallRecord(existingCall.id, updates);

      // If call is completed, trigger processing if we have transcription
      if (webhookData.CallStatus === 'completed' && webhookData.TranscriptionText) {
        await this.processCallTranscription(
          {
            id: existingCall.id,
            callSid: existingCall.call_sid,
            fromNumber: existingCall.from_number || webhookData.From,
            toNumber: existingCall.to_number || webhookData.To,
            recordingUrl: webhookData.RecordingUrl || existingCall.recording_url,
            recordingSid: webhookData.RecordingSid || existingCall.recording_sid,
          },
          webhookData.TranscriptionText,
          userId,
          webhookData
        );
      }
    } catch (error) {
      console.error('Error handling status webhook:', error);
    }
  }

  /**
   * Handle transcription completion webhook from Twilio
   */
  async handleTranscriptionWebhook(webhookData: TwilioWebhookData, userId: string): Promise<CallProcessingResult> {
    try {
      console.log(`Handling transcription webhook for user ${userId}:`, webhookData);

      // Find the call record
      const { data: existingCall, error: findError } = await supabase
        .from('calls')
        .select('id, call_sid, from_number, to_number, recording_url, recording_sid')
        .eq('call_sid', webhookData.CallSid)
        .eq('user_id', userId)
        .single();

      if (findError || !existingCall) {
        throw new Error(`Call record not found: ${webhookData.CallSid}`);
      }

      // Update call record with transcription
      await TwilioService.updateCallRecord(existingCall.id, {
        transcriptionText: webhookData.TranscriptionText || '',
        recordingUrl: webhookData.RecordingUrl,
        recordingSid: webhookData.RecordingSid,
      });

      // Process the transcription for job extraction
      const result = await this.processCallTranscription(
        {
          id: existingCall.id,
          callSid: existingCall.call_sid,
          fromNumber: existingCall.from_number || webhookData.From,
          toNumber: existingCall.to_number || webhookData.To,
          recordingUrl: webhookData.RecordingUrl || existingCall.recording_url,
          recordingSid: webhookData.RecordingSid || existingCall.recording_sid,
        },
        webhookData.TranscriptionText || '',
        userId,
        webhookData
      );

      return result;
    } catch (error) {
      console.error('Error handling transcription webhook:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        callId: webhookData.CallSid || '',
        jobCreated: false,
        error: createCallError({
          callId: webhookData.CallSid || '',
          phase: 'webhook',
          code: 'TRANSCRIPTION_WEBHOOK_FAILED',
          message,
          details: error,
        }),
      };
    }
  }

  /**
   * Process call transcription and extract job details
   */
  private async processCallTranscription(
    callRecord: {
      id: string;
      callSid: string;
      fromNumber?: string;
      toNumber?: string;
      recordingUrl?: string;
      recordingSid?: string;
    },
    transcriptionText: string,
    userId: string,
    webhookData: TwilioWebhookData
  ): Promise<CallProcessingResult> {
    const callId = callRecord.id;

    try {
      if (!transcriptionText.trim()) {
        return {
          callId,
          jobCreated: false,
          error: createCallError({
            callId,
            phase: 'transcription',
            code: 'NO_TRANSCRIPTION',
            message: 'No transcription text available',
          }),
        };
      }

      const recordingUrl =
        webhookData.RecordingUrl || callRecord.recordingUrl || '';

      if (!recordingUrl) {
        return {
          callId,
          jobCreated: false,
          error: createCallError({
            callId,
            phase: 'transcription',
            code: 'RECORDING_URL_MISSING',
            message: 'Recording URL missing; cannot process voicemail',
          }),
        };
      }

      const { data: userData } = await supabase
        .from('users')
        .select('business_type')
        .eq('id', userId)
        .single();

      const businessType = userData?.business_type;

      const repository = new SupabaseVoicemailRepository(supabase);
      const pipeline = new VoicemailPipeline({
        repository,
        transcription: {
          async transcribe() {
            throw new Error('No transcription adapter configured for raw recordings.');
          },
        },
        extraction: {
          async extract(transcript) {
            return TwilioService.extractJobFromTranscript(
              transcript.text,
              businessType
            );
          },
        },
      });

      const pipelineResult = await pipeline.process({
        callSid: callRecord.callSid,
        userId,
        from: callRecord.fromNumber || webhookData.From || '',
        to: callRecord.toNumber || webhookData.To || '',
        recordingUrl,
        recordingSid: callRecord.recordingSid || webhookData.RecordingSid,
        recordingDuration: webhookData.RecordingDuration
          ? parseInt(webhookData.RecordingDuration)
          : undefined,
        transcriptionText,
        transcriptionStatus: 'completed',
      });

      const jobExtraction = pipelineResult.jobDraft;

      let jobId: string | undefined;
      if (jobExtraction && jobExtraction.confidence > 0.7) {
        jobId = await this.createJobFromExtraction(jobExtraction, userId, callId);
        
        if (jobId) {
          await TwilioService.updateCallRecord(callId, { jobId });
        }
      }

      return {
        callId,
        jobCreated: !!jobId,
        jobId,
      };
    } catch (error) {
      console.error('Error processing call transcription:', error);
      const message = error instanceof Error ? error.message : 'Processing failed';
      return {
        callId,
        jobCreated: false,
        error: createCallError({
          callId,
          phase: 'job_extraction',
          code: 'PROCESSING_FAILED',
          message,
          details: error,
        }),
      };
    }
  }

  /**
   * Create a job from extracted call data
   */
  private async createJobFromExtraction(
    extraction: JobExtraction, 
    userId: string, 
    callId: string
  ): Promise<string | undefined> {
    try {
      if (!extraction.serviceType && !extraction.description) {
        console.log('Insufficient job details for job creation');
        return undefined;
      }

      // Create or find client if we have client information
      let clientId: string | undefined;
      if (extraction.clientName || extraction.clientPhone) {
        clientId = await this.findOrCreateClient(extraction, userId);
      }

      // Create the job record
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .insert({
          user_id: userId,
          client_id: clientId,
          title: extraction.serviceType || 'Phone Call Job',
          description: extraction.description || '',
          address: extraction.location,
          quoted_price: extraction.estimatedPrice,
          status: 'pending',
          notes: `Created from phone call (Call ID: ${callId})`
        })
        .select('id')
        .single();

      if (jobError) {
        throw new Error(`Failed to create job: ${jobError.message}`);
      }

      // Create calendar event if we have scheduling information
      if (jobData.id && (extraction.scheduledDate || extraction.scheduledTime)) {
        await this.createCalendarEvent(jobData.id, extraction, userId, clientId);
      }

      // Send client confirmation if we have contact info
      if (clientId && extraction.clientPhone) {
        await this.sendClientConfirmation(extraction, jobData.id);
      }

      console.log(`Created job ${jobData.id} from call ${callId}`);
      return jobData.id;
    } catch (error) {
      console.error('Error creating job from extraction:', error);
      return undefined;
    }
  }

  /**
   * Find existing client or create new one
   */
  private async findOrCreateClient(extraction: JobExtraction, userId: string): Promise<string | undefined> {
    try {
      // Try to find existing client by phone or name
      let existingClient = null;
      
      if (extraction.clientPhone) {
        const { data } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', userId)
          .eq('phone', extraction.clientPhone)
          .single();
        existingClient = data;
      }

      if (!existingClient && extraction.clientName) {
        const { data } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', userId)
          .ilike('name', `%${extraction.clientName}%`)
          .single();
        existingClient = data;
      }

      if (existingClient) {
        return existingClient.id;
      }

      // Create new client
      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({
          user_id: userId,
          name: extraction.clientName || 'Phone Call Client',
          phone: extraction.clientPhone,
          address: extraction.location
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error creating client:', error);
        return undefined;
      }

      return newClient.id;
    } catch (error) {
      console.error('Error finding/creating client:', error);
      return undefined;
    }
  }

  /**
   * Create calendar event from job extraction
   */
  private async createCalendarEvent(
    jobId: string, 
    extraction: JobExtraction, 
    userId: string,
    clientId?: string
  ): Promise<void> {
    try {
      const startTime = this.parseDateTime(extraction.scheduledDate, extraction.scheduledTime);
      if (!startTime) {
        console.log('Unable to parse date/time for calendar event');
        return;
      }

      // Default to 1-hour duration if not specified
      const endTime = new Date(startTime.getTime() + (60 * 60 * 1000));

      const { error } = await supabase
        .from('calendar_events')
        .insert({
          user_id: userId,
          job_id: jobId,
          client_id: clientId,
          title: extraction.serviceType || 'Service Call',
          description: extraction.description,
          location: extraction.location,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          reminder_minutes: extraction.urgency === 'high' ? 30 : 60
        });

      if (error) {
        console.error('Error creating calendar event:', error);
      }
    } catch (error) {
      console.error('Error creating calendar event:', error);
    }
  }

  /**
   * Parse date and time strings into a Date object
   */
  private parseDateTime(dateString?: string, timeString?: string): Date | null {
    try {
      if (!dateString) {
        return null;
      }

      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return null;
      }

      if (timeString) {
        const timeMatch = timeString.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          const ampm = timeMatch[3]?.toUpperCase();

          if (ampm === 'PM' && hours !== 12) {
            hours += 12;
          } else if (ampm === 'AM' && hours === 12) {
            hours = 0;
          }

          date.setHours(hours, minutes, 0, 0);
        }
      }

      return date;
    } catch (error) {
      console.error('Error parsing date/time:', error);
      return null;
    }
  }

  /**
   * Send confirmation message to client
   */
  private async sendClientConfirmation(extraction: JobExtraction, jobId: string): Promise<void> {
    try {
      // This would integrate with an SMS service (Twilio SMS API)
      // For now, we'll just log it
      console.log(`Would send confirmation to ${extraction.clientPhone} for job ${jobId}:`, {
        service: extraction.serviceType,
        date: extraction.scheduledDate,
        time: extraction.scheduledTime
      });

      // TODO: Implement actual SMS sending via Twilio SMS API
    } catch (error) {
      console.error('Error sending client confirmation:', error);
    }
  }

  /**
   * Generate TwiML response for incoming voice calls
   */
  private generateVoiceTwiML(userId: string, webhookData: TwilioWebhookData): string {
    // Basic TwiML that records the call and transcribes it
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Emma">
        Welcome to Flynn AI. Your call is being recorded for automatic job processing. Please describe your service request.
    </Say>
    <Record
        action="/webhook/transcription/${userId}"
        method="POST"
        transcribe="true"
        transcribeCallback="/webhook/transcription/${userId}"
        playBeep="false"
        maxLength="600"
        recordingStatusCallback="/webhook/status/${userId}"
    />
</Response>`;

    return twiml;
  }

  /**
   * Generate error TwiML response
   */
  private generateErrorTwiML(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Emma">
        Sorry, there was an error processing your call. Please try again later.
    </Say>
    <Hangup />
</Response>`;
  }

  /**
   * Map Twilio call status to our internal status
   */
  private mapTwilioStatus(twilioStatus?: string): string {
    switch (twilioStatus) {
      case 'queued':
      case 'ringing':
      case 'in-progress':
        return 'in-progress';
      case 'completed':
        return 'completed';
      case 'busy':
        return 'busy';
      case 'failed':
        return 'failed';
      case 'no-answer':
        return 'no-answer';
      default:
        return 'in-progress';
    }
  }

  /**
   * Validate webhook signature (security)
   */
  validateWebhookSignature(url: string, params: any, signature: string): boolean {
    // TODO: Implement Twilio signature validation
    // This would use Twilio's auth token to validate the request authenticity
    console.log('Webhook signature validation - TODO: implement');
    return true; // For now, accept all requests
  }
}

export const CallHandler = new CallHandlerClass();
