import { supabase } from './supabase';

export type DashboardActivityType =
  | 'job_created'
  | 'job_completed'
  | 'job_updated'
  | 'communication_sent'
  | 'calendar_synced'
  | 'call_recorded';

export interface DashboardActivityMetadata {
  clientName?: string | null;
  clientPhone?: string | null;
  jobId?: string | null;
  platform?: string | null;
  status?: string | null;
  channel?: string | null;
  amount?: number | null;
}

export interface DashboardActivity {
  id: string;
  type: DashboardActivityType;
  title: string;
  description: string;
  timestamp: string;
  icon: string;
  metadata?: DashboardActivityMetadata;
}

const formatDescription = (
  prefix: string,
  clientName?: string | null,
  extra?: string | null,
) => {
  const parts = [prefix];
  if (clientName) parts.push(clientName);
  if (extra) parts.push(extra);
  return parts.join(' ');
};

export const formatActivityTime = (timestamp: string): string => {
  const now = new Date();
  const activityDate = new Date(timestamp);
  const diffMs = now.getTime() - activityDate.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return activityDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const fetchDashboardActivities = async (
  userId: string,
): Promise<DashboardActivity[]> => {
  const activities: DashboardActivity[] = [];

  const [jobsRes, eventsRes, commsRes, callsRes] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, customer_name, customer_phone, service_type, status, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(15),
    supabase
      .from('calendar_events')
      .select('id, title, start_time, created_at, client_id, job_id, clients(name, phone)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(15),
    supabase
      .from('communication_logs')
      .select('id, communication_type, recipient, content, status, created_at, event_id, user_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(15),
    supabase
      .from('calls')
      .select('id, call_sid, from_number, recorded_at, transcription_status, status')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(15),
  ]);

  if (!jobsRes.error && jobsRes.data) {
    for (const job of jobsRes.data) {
      const timestamp = job.updated_at ?? job.created_at ?? new Date().toISOString();
      const status = job.status ?? 'pending';
      const type: DashboardActivityType = status === 'completed' ? 'job_completed' : 'job_created';
      const icon = status === 'completed' ? 'checkmark-circle-outline' : 'briefcase-outline';
      const description = status === 'completed'
        ? formatDescription('Completed job for', job.customer_name, `(${job.service_type || 'Service'})`)
        : formatDescription('New job captured for', job.customer_name, `(${job.service_type || 'Service'})`);

      activities.push({
        id: `job_${job.id}`,
        type,
        title: status === 'completed' ? 'Job completed' : 'Job captured',
        description,
        timestamp,
        icon,
        metadata: {
          clientName: job.customer_name,
          clientPhone: job.customer_phone,
          jobId: job.id,
          status,
        },
      });
    }
  }

  if (!eventsRes.error && eventsRes.data) {
    for (const event of eventsRes.data) {
      const occurredAt = event.created_at ?? event.start_time ?? new Date().toISOString();
      const clientRelation = Array.isArray(event.clients) ? event.clients[0] : (event as any).clients;
      activities.push({
        id: `event_${event.id}`,
        type: 'calendar_synced',
        title: 'Calendar event scheduled',
        description: event.title ?? 'New calendar event',
        timestamp: occurredAt,
        icon: 'calendar-outline',
        metadata: {
          clientName: clientRelation?.name,
          clientPhone: clientRelation?.phone,
          jobId: event.job_id,
          platform: 'Calendar',
        },
      });
    }
  }

  if (!commsRes.error && commsRes.data) {
    for (const log of commsRes.data) {
      const channel = log.communication_type;
      const icon = channel === 'email' ? 'mail-outline' : channel === 'sms' ? 'chatbubble-outline' : 'call-outline';
      const title = channel === 'email' ? 'Email sent' : channel === 'sms' ? 'Text message sent' : 'Call logged';
      const description = log.content || `Sent to ${log.recipient}`;
      activities.push({
        id: `comm_${log.id}`,
        type: 'communication_sent',
        title,
        description,
        timestamp: log.created_at ?? new Date().toISOString(),
        icon,
        metadata: {
          clientPhone: log.recipient,
          platform: channel.toUpperCase(),
          status: log.status,
          channel,
        },
      });
    }
  }

  if (!callsRes.error && callsRes.data) {
    for (const call of callsRes.data) {
      if (!call.recorded_at) continue;
      activities.push({
        id: `call_${call.id ?? call.call_sid}`,
        type: 'call_recorded',
        title: 'Call recorded',
        description: call.status ? `Call status: ${call.status}` : 'Inbound/outbound call logged',
        timestamp: call.recorded_at,
        icon: 'call-outline',
        metadata: {
          clientPhone: call.from_number,
          status: call.transcription_status ?? call.status ?? undefined,
        },
      });
    }
  }

  return activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 30);
};
