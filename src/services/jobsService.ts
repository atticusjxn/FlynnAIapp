import { supabase } from './supabase';
import { Job } from '../components/jobs/JobCard';

const mapStatus = (status?: string | null): Job['status'] => {
  switch (status) {
    case 'completed':
    case 'complete':
      return 'complete';
    case 'in_progress':
    case 'in-progress':
      return 'in-progress';
    default:
      return 'pending';
  }
};

const defaultLocation = 'On-site';

const mapRowToJob = (row: any): Job => {
  const createdAt = row.created_at ? new Date(row.created_at) : new Date();
  const iso = createdAt.toISOString();
  const [datePart, timePart = '00:00:00'] = iso.split('T');
  const timeValue = timePart.slice(0, 5);

  return {
    id: row.id,
    clientName: row.customer_name || 'Client',
    clientPhone: row.customer_phone || '',
    clientEmail: row.customer_email || undefined,
    serviceType: row.service_type || 'General service',
    description: row.summary || 'Job details unavailable',
    date: row.scheduled_date || datePart,
    time: row.scheduled_time || timeValue,
    location: row.location || defaultLocation,
    status: mapStatus(row.status),
    businessType: row.business_type || 'other',
    notes: row.notes || undefined,
    estimatedDuration: row.estimated_duration || undefined,
    createdAt: createdAt.toISOString(),
    source: row.source || (row.call_sid ? 'voicemail' : 'manual'),
    voicemailTranscript: row.voicemail_transcript || undefined,
    voicemailRecordingUrl: row.voicemail_recording_url || undefined,
    followUpDraft: row.follow_up_draft || undefined,
    capturedAt: row.captured_at || createdAt.toISOString(),
    lastFollowUpAt: row.last_follow_up_at || undefined,
  };
};

export const jobsService = {
  async listJobs(userId: string): Promise<Job[]> {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map(mapRowToJob);
  },

  async updateStatus(jobId: string, status: Job['status']): Promise<void> {
    const canonical = status === 'complete' ? 'completed' : status === 'in-progress' ? 'in_progress' : 'pending';
    const { error } = await supabase
      .from('jobs')
      .update({ status: canonical, updated_at: new Date().toISOString() })
      .eq('id', jobId);

    if (error) throw error;
  },

  async deleteJob(jobId: string): Promise<void> {
    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', jobId);

    if (error) throw error;
  },

  async updateJob(jobId: string, updates: Partial<{
    serviceType: string;
    description: string;
    scheduledDate: string;
    scheduledTime: string;
    location: string;
    notes: string;
  }>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (updates.serviceType !== undefined) payload.service_type = updates.serviceType;
    if (updates.description !== undefined) payload.summary = updates.description;
    if (updates.scheduledDate !== undefined) payload.scheduled_date = updates.scheduledDate;
    if (updates.scheduledTime !== undefined) payload.scheduled_time = updates.scheduledTime;
    if (updates.location !== undefined) payload.location = updates.location;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    payload.updated_at = new Date().toISOString();

    if (Object.keys(payload).length === 1) return; // only updated_at

    const { error } = await supabase
      .from('jobs')
      .update(payload)
      .eq('id', jobId);

    if (error) throw error;
  },
};
