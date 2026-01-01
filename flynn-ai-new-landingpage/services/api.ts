import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://flynnai-telephony.fly.dev';

// Helper to get auth token
async function getAuthToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

// Fetch with auth headers
async function authenticatedFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAuthToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  return fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
}

// Business Profile
export interface BusinessProfile {
  id: string;
  organization_id: string;
  business_name: string;
  business_type?: string;
  phone_number?: string;
  email?: string;
  website?: string;
  address?: string;
  description?: string;
  services?: string[];
  hours?: Record<string, any>;
  greeting_script?: string;
  voice_profile?: string;
  created_at: string;
  updated_at: string;
}

export async function getBusinessProfile(orgId: string): Promise<BusinessProfile | null> {
  const { data, error } = await supabase
    .from('business_profiles')
    .select('*')
    .eq('organization_id', orgId)
    .single();

  if (error) {
    console.error('Error fetching business profile:', error);
    return null;
  }

  return data;
}

export async function updateBusinessProfile(
  orgId: string,
  updates: Partial<BusinessProfile>
): Promise<BusinessProfile | null> {
  const { data, error } = await supabase
    .from('business_profiles')
    .update(updates)
    .eq('organization_id', orgId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

// Calls
export interface Call {
  id: string;
  organization_id: string;
  from_number: string;
  to_number: string;
  status: string;
  duration?: number;
  recording_url?: string;
  transcription?: string;
  created_at: string;
}

export async function getCalls(orgId: string, limit: number = 20): Promise<Call[]> {
  const { data, error } = await supabase
    .from('calls')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

// Jobs/Events
export interface Job {
  id: string;
  organization_id: string;
  client_name: string;
  client_phone?: string;
  client_email?: string;
  service_type?: string;
  description?: string;
  scheduled_date?: string;
  status: 'new' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export async function getJobs(orgId: string, limit: number = 50): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function createJob(orgId: string, job: Partial<Job>): Promise<Job> {
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      organization_id: orgId,
      ...job,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateJob(jobId: string, updates: Partial<Job>): Promise<Job> {
  const { data, error } = await supabase
    .from('jobs')
    .update(updates)
    .eq('id', jobId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

// Analytics
export interface Analytics {
  total_calls: number;
  missed_calls: number;
  answered_calls: number;
  new_leads: number;
  conversion_rate: number;
}

export async function getAnalytics(orgId: string): Promise<Analytics> {
  // Get calls count
  const { count: totalCalls } = await supabase
    .from('calls')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId);

  const { count: missedCalls } = await supabase
    .from('calls')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('status', 'no-answer');

  // Get jobs/leads count
  const { count: newLeads } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('status', 'new');

  return {
    total_calls: totalCalls || 0,
    missed_calls: missedCalls || 0,
    answered_calls: (totalCalls || 0) - (missedCalls || 0),
    new_leads: newLeads || 0,
    conversion_rate: totalCalls ? ((newLeads || 0) / totalCalls) * 100 : 0,
  };
}

// Twilio Phone Number Provisioning
export async function provisionPhoneNumber(
  country: string = 'AU'
): Promise<{ phoneNumber: string }> {
  const response = await authenticatedFetch('/api/phone-numbers/provision', {
    method: 'POST',
    body: JSON.stringify({ country }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to provision phone number');
  }

  return response.json();
}

// Billing (uses existing backend endpoints)
export async function createCheckoutSession(priceId: string): Promise<{ url: string }> {
  const response = await authenticatedFetch('/api/billing/create-checkout-session', {
    method: 'POST',
    body: JSON.stringify({ priceId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create checkout session');
  }

  return response.json();
}

export async function createPortalSession(): Promise<{ url: string }> {
  const response = await authenticatedFetch('/api/billing/create-portal-session', {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create portal session');
  }

  return response.json();
}

export async function getSubscriptionStatus(): Promise<any> {
  const response = await authenticatedFetch('/api/billing/subscription-status');

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get subscription status');
  }

  return response.json();
}

// Google Calendar Integration
export async function connectGoogleCalendar(): Promise<{ authUrl: string }> {
  const response = await authenticatedFetch('/api/integrations/google-calendar/auth');

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get Google Calendar auth URL');
  }

  return response.json();
}
