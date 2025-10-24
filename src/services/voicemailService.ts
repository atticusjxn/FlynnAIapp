import { supabase } from './supabase';

export interface DashboardVoicemail {
  id: string;
  callSid: string;
  fromNumber?: string | null;
  toNumber?: string | null;
  recordedAt: string;
  recordingUrl?: string | null;
  transcription?: string | null;
  jobId?: string | null;
  status?: string | null;
}

interface RawVoicemailRow {
  id?: string;
  call_sid: string;
  from_number?: string | null;
  to_number?: string | null;
  recorded_at?: string | null;
  created_at?: string | null;
  recording_url?: string | null;
  transcription_status?: string | null;
  transcription_text?: string | null;
  status?: string | null;
  job_id?: string | null;
  transcriptions?: { text?: string | null } | { text?: string | null }[] | null;
  jobs?:
    | { id?: string | null; voicemail_transcript?: string | null; voicemail_recording_url?: string | null }
    | Array<{ id?: string | null; voicemail_transcript?: string | null; voicemail_recording_url?: string | null }>
    | null;
}

const getFirstRelationItem = <T>(value?: T | T[] | null): T | null => {
  if (!value) return null;
  return Array.isArray(value) ? (value.length > 0 ? value[0] ?? null : null) : value;
};

export const fetchRecentVoicemails = async (
  userId: string,
  limit = 5,
): Promise<DashboardVoicemail[]> => {
  const { data, error } = await supabase
    .from('calls')
    .select(
      `
        id,
        call_sid,
        from_number,
        to_number,
        recorded_at,
        created_at,
        recording_url,
        transcription_status,
        transcription_text,
        status,
        job_id,
        transcriptions(text),
        jobs:jobs!jobs_call_sid_fkey(id, voicemail_transcript, voicemail_recording_url)
      `,
    )
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data as RawVoicemailRow[] | null ?? []).map(row => {
    const transcriptionRelation = getFirstRelationItem(row.transcriptions);
    const jobRelation = getFirstRelationItem(row.jobs);

    const transcription = row.transcription_text
      ?? transcriptionRelation?.text
      ?? jobRelation?.voicemail_transcript
      ?? null;

    const recordingUrl = row.recording_url
      ?? jobRelation?.voicemail_recording_url
      ?? null;

    const recordedAt = row.recorded_at
      ?? row.created_at
      ?? new Date().toISOString();

    return {
      id: row.id ?? row.call_sid,
      callSid: row.call_sid,
      fromNumber: row.from_number ?? null,
      toNumber: row.to_number ?? null,
      recordedAt,
      recordingUrl,
      transcription,
      jobId: row.job_id ?? jobRelation?.id ?? null,
      status: row.status ?? row.transcription_status ?? null,
    } satisfies DashboardVoicemail;
  });
};
