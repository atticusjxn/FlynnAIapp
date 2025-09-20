import { SupabaseClient } from '@supabase/supabase-js';
import {
  StoredVoicemailRecord,
  VoicemailRepository,
  VoicemailWebhookInput,
} from './types';

const mapRowToRecord = (row: any): StoredVoicemailRecord => ({
  id: row.id,
  callSid: row.call_sid,
  userId: row.user_id,
  fromNumber: row.from_number,
  toNumber: row.to_number,
  recordingUrl: row.recording_url,
  recordingSid: row.recording_sid || undefined,
  status: (row.status || 'pending') as StoredVoicemailRecord['status'],
  transcript: row.transcription_text || undefined,
  transcriptConfidence: row.transcription_confidence || undefined,
  jobDraft: row.job_extracted || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Supabase-backed repository for Twilio voicemail ingestion.
 * Requires a service role client or RPC that bypasses RLS policies for automation accounts.
 */
export class SupabaseVoicemailRepository implements VoicemailRepository {
  constructor(private client: SupabaseClient) {}

  async findByCallSid(callSid: string, userId: string): Promise<StoredVoicemailRecord | null> {
    const { data, error } = await this.client
      .from('calls')
      .select('*')
      .eq('call_sid', callSid)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapRowToRecord(data) : null;
  }

  async create(input: VoicemailWebhookInput): Promise<StoredVoicemailRecord> {
    const { data, error } = await this.client
      .from('calls')
      .insert({
        user_id: input.userId,
        call_sid: input.callSid,
        from_number: input.from,
        to_number: input.to,
        status: 'pending',
        recording_url: input.recordingUrl,
        recording_sid: input.recordingSid,
      })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return mapRowToRecord(data);
  }

  async update(
    id: string,
    updates: Partial<Omit<StoredVoicemailRecord, 'id' | 'userId' | 'callSid'>>
  ): Promise<StoredVoicemailRecord> {
    const payload: Record<string, any> = { updated_at: new Date().toISOString() };

    if (updates.status) payload.status = updates.status;
    if (updates.transcript !== undefined) payload.transcription_text = updates.transcript;
    if (updates.transcriptConfidence !== undefined) {
      payload.transcription_confidence = updates.transcriptConfidence;
    }
    if (updates.jobDraft !== undefined) payload.job_extracted = updates.jobDraft;
    if (updates.recordingUrl) payload.recording_url = updates.recordingUrl;
    if (updates.recordingSid) payload.recording_sid = updates.recordingSid;

    const { data, error } = await this.client
      .from('calls')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return mapRowToRecord(data);
  }
}
