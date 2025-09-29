export type ContactPreference = 'phone' | 'text' | 'email';

export interface Client {
  id: string;
  userId?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  businessType?: string | null;
  preferredContactMethod?: ContactPreference | null;
  totalJobs?: number | null;
  lastJobDate?: string | null;
  lastJobType?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ClientJob {
  id: string;
  date: string;
  serviceType?: string | null;
  description?: string | null;
  status?: 'scheduled' | 'completed' | 'cancelled' | 'pending';
  amount?: number | null;
}

export interface CommunicationEntry {
  id: string;
  type: 'call' | 'text' | 'email';
  date: string;
  direction?: 'outgoing' | 'incoming';
  content?: string | null;
  success?: boolean;
}

export interface ClientDetails extends Client {
  jobHistory: ClientJob[];
  communicationLog: CommunicationEntry[];
}
