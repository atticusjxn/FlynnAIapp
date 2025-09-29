import { supabase } from './supabase';
import {
  Client,
  ClientDetails,
  ClientJob,
  CommunicationEntry,
  ContactPreference,
} from '../types/client';

interface ClientRecord {
  id: string;
  user_id?: string | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  business_type?: string | null;
  preferred_contact_method?: string | null;
  last_job_type?: string | null;
  last_job_date?: string | null;
  total_jobs?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface CalendarEventRecord {
  id: string;
  title?: string | null;
  description?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  created_at?: string | null;
}

interface CommunicationLogRecord {
  id: string;
  communication_type: 'email' | 'sms' | 'call';
  content?: string | null;
  status?: string | null;
  created_at?: string | null;
  recipient?: string | null;
}

const mapClientRecord = (record: ClientRecord): Client => ({
  id: record.id,
  userId: record.user_id ?? undefined,
  name: record.name,
  phone: record.phone ?? undefined,
  email: record.email ?? undefined,
  address: record.address ?? undefined,
  notes: record.notes ?? undefined,
  businessType: record.business_type ?? undefined,
  preferredContactMethod: (record.preferred_contact_method as ContactPreference | null | undefined) ?? undefined,
  lastJobType: record.last_job_type ?? undefined,
  lastJobDate: record.last_job_date ?? undefined,
  totalJobs: record.total_jobs ?? undefined,
  createdAt: record.created_at ?? undefined,
  updatedAt: record.updated_at ?? undefined,
});

const mapCalendarEventRecord = (record: CalendarEventRecord): ClientJob => {
  const date = record.start_time || record.created_at || new Date().toISOString();
  const end = record.end_time ? new Date(record.end_time) : null;
  const status = end && end.getTime() < Date.now() ? 'completed' : 'scheduled';

  return {
    id: record.id,
    date,
    serviceType: record.title ?? 'Service job',
    description: record.description ?? undefined,
    status,
  };
};

const mapCommunicationRecord = (record: CommunicationLogRecord): CommunicationEntry => {
  const typeMap: Record<CommunicationLogRecord['communication_type'], CommunicationEntry['type']> = {
    email: 'email',
    sms: 'text',
    call: 'call',
  };

  return {
    id: record.id,
    type: typeMap[record.communication_type],
    date: record.created_at ?? new Date().toISOString(),
    direction: 'outgoing',
    content: record.content ?? undefined,
    success: record.status ? record.status !== 'failed' : undefined,
  };
};

export const clientsService = {
  async listClients(): Promise<Client[]> {
    const { data, error } = await supabase
      .from('clients')
      .select(
        'id, user_id, name, phone, email, address, notes, business_type, preferred_contact_method, last_job_type, last_job_date, total_jobs, created_at, updated_at'
      )
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return ((data as ClientRecord[]) ?? []).map(mapClientRecord);
  },

  async upsertClient({
    client,
    userId,
  }: {
    client: Partial<Client> & { name: string } & { id?: string };
    userId: string;
  }): Promise<Client> {
    const payload: Record<string, unknown> = {
      name: client.name,
      phone: client.phone ?? null,
      email: client.email ?? null,
      address: client.address ?? null,
      notes: client.notes ?? null,
      business_type: client.businessType ?? null,
      preferred_contact_method: client.preferredContactMethod ?? null,
      last_job_type: client.lastJobType ?? null,
      last_job_date: client.lastJobDate ?? null,
      total_jobs: client.totalJobs ?? null,
      user_id: userId,
    };

    if (client.id) {
      const { data, error } = await supabase
        .from('clients')
        .update(payload)
        .eq('id', client.id)
        .eq('user_id', userId)
        .select(
          'id, user_id, name, phone, email, address, notes, business_type, preferred_contact_method, last_job_type, last_job_date, total_jobs, created_at, updated_at'
        )
        .single();

      if (error) {
        throw error;
      }

      return mapClientRecord(data as ClientRecord);
    }

    const { data, error } = await supabase
      .from('clients')
      .insert({ ...payload, user_id: userId })
      .select(
        'id, user_id, name, phone, email, address, notes, business_type, preferred_contact_method, last_job_type, last_job_date, total_jobs, created_at, updated_at'
      )
      .single();

    if (error) {
      throw error;
    }

    return mapClientRecord(data as ClientRecord);
  },

  async deleteClient({ clientId, userId }: { clientId: string; userId: string }): Promise<void> {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }
  },

  async getClientDetails({ clientId }: { clientId: string }): Promise<ClientDetails | null> {
    const [{ data: clientRecord, error: clientError }, { data: events, error: eventsError }, { data: comms, error: commsError }] = await Promise.all([
      supabase
        .from('clients')
        .select(
          'id, user_id, name, phone, email, address, notes, business_type, preferred_contact_method, last_job_type, last_job_date, total_jobs, created_at, updated_at'
        )
        .eq('id', clientId)
        .maybeSingle(),
      supabase
        .from('calendar_events')
        .select('id, title, description, start_time, end_time, created_at')
        .eq('client_id', clientId)
        .order('start_time', { ascending: false }),
      supabase
        .from('communication_logs')
        .select('id, communication_type, content, status, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(25),
    ]);

    if (clientError) {
      if (clientError.code === 'PGRST116') {
        return null;
      }
      throw clientError;
    }

    if (!clientRecord) {
      return null;
    }

    if (eventsError) {
      console.warn('[clientsService] Failed to load calendar events for client', eventsError);
    }

    if (commsError) {
      console.warn('[clientsService] Failed to load communication logs for client', commsError);
    }

    const jobHistory = ((events as CalendarEventRecord[]) ?? []).map(mapCalendarEventRecord);
    const communicationLog = ((comms as CommunicationLogRecord[]) ?? []).map(mapCommunicationRecord);

    return {
      ...mapClientRecord(clientRecord as ClientRecord),
      jobHistory,
      communicationLog,
    };
  },

  async logCommunication({
    clientId,
    userId,
    type,
    content,
    recipient,
  }: {
    clientId: string;
    userId: string;
    type: CommunicationEntry['type'];
    content: string;
    recipient?: string | null;
  }): Promise<CommunicationEntry> {
    const communicationTypeMap: Record<CommunicationEntry['type'], CommunicationLogRecord['communication_type']> = {
      email: 'email',
      text: 'sms',
      call: 'call',
    };

    const insertPayload = {
      user_id: userId,
      client_id: clientId,
      communication_type: communicationTypeMap[type],
      content,
      recipient: recipient ?? null,
      status: 'sent',
    };

    const { data, error } = await supabase
      .from('communication_logs')
      .insert(insertPayload)
      .select('id, communication_type, content, status, created_at, recipient')
      .single();

    if (error) {
      throw error;
    }

    return mapCommunicationRecord(data as CommunicationLogRecord);
  },
};
