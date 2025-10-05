import { supabase } from './supabase';

export type CallerLabel = 'lead' | 'client' | 'personal' | 'spam';
export type CallerRoutingOverride = 'intake' | 'voicemail' | 'auto';

export interface CallerRecord {
  id: string;
  phoneNumber: string;
  label: CallerLabel;
  routingOverride: CallerRoutingOverride | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  updatedAt: string | null;
  displayName?: string | null;
}

export interface CallerTimelineEntry {
  callSid: string;
  createdAt: string;
  status?: string | null;
  routeDecision?: 'intake' | 'voicemail' | null;
  routeReason?: string | null;
  transcriptionText?: string | null;
  recordingUrl?: string | null;
}

const mapCallerRow = (row: any): CallerRecord => ({
  id: row.id,
  phoneNumber: row.phone_number,
  label: row.label,
  routingOverride: row.routing_override ?? null,
  firstSeenAt: row.first_seen_at ?? null,
  lastSeenAt: row.last_seen_at ?? null,
  updatedAt: row.updated_at ?? null,
  displayName: row.display_name ?? null,
});

export const fetchCallerById = async (callerId: string): Promise<CallerRecord | null> => {
  const { data, error } = await supabase
    .from('callers')
    .select('id, phone_number, label, routing_override, first_seen_at, last_seen_at, updated_at, display_name')
    .eq('id', callerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapCallerRow(data) : null;
};

export const updateCallerPreferences = async (
  callerId: string,
  updates: { label?: CallerLabel; routingOverride?: CallerRoutingOverride | null; displayName?: string | null },
): Promise<CallerRecord | null> => {
  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.label) {
    payload.label = updates.label;
  }

  if (updates.routingOverride !== undefined) {
    payload.routing_override = updates.routingOverride;
  }

  if (updates.displayName !== undefined) {
    payload.display_name = updates.displayName;
  }

  const { data, error } = await supabase
    .from('callers')
    .update(payload)
    .eq('id', callerId)
    .select('id, phone_number, label, routing_override, first_seen_at, last_seen_at, updated_at, display_name')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapCallerRow(data) : null;
};

export const fetchCallerTimeline = async (
  callerId: string,
  limit: number = 20,
): Promise<CallerTimelineEntry[]> => {
  const { data, error } = await supabase
    .from('calls')
    .select(`
      call_sid,
      created_at,
      status,
      route_decision,
      route_reason,
      call_voicemails (transcription_text, recording_url, created_at)
    `)
    .eq('caller_id', callerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data || []).map((row) => ({
    callSid: row.call_sid,
    createdAt: row.created_at,
    status: row.status,
    routeDecision: row.route_decision,
    routeReason: row.route_reason,
    transcriptionText: row.call_voicemails?.[0]?.transcription_text ?? null,
    recordingUrl: row.call_voicemails?.[0]?.recording_url ?? null,
  }));
};

export const listCallers = async (limit: number = 50): Promise<CallerRecord[]> => {
  const { data, error } = await supabase
    .from('callers')
    .select('id, phone_number, label, routing_override, first_seen_at, last_seen_at, updated_at, display_name')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data || []).map(mapCallerRow);
};
