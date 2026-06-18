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

// Web sign-up — unauthenticated, sends welcome SMS + vCard MMS
export async function startSignup(phone: string): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/signup/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to send welcome message');
  }

  return response.json();
}

// ─── Org resolution ────────────────────────────────────────────────────────
// Single source of truth for "which org is this signed-in user acting as".
// Matches the RLS pattern used across the DB (org_members + is_org_member),
// falling back to users.default_org_id for solo operators.
export async function getCurrentOrgId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (membership?.org_id) return membership.org_id;

  const { data: userRow } = await supabase
    .from('users')
    .select('default_org_id')
    .eq('id', user.id)
    .maybeSingle();
  return userRow?.default_org_id ?? null;
}

// ─── Dashboard data (adaptive — render a card only when its data exists) ─────
export interface UpcomingJob {
  id: string;
  customer_name: string | null;
  service_type: string | null;
  summary: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  location: string | null;
  status: string;
}

export async function getUpcomingJobs(orgId: string, days: number = 7): Promise<UpcomingJob[]> {
  const today = new Date();
  const horizon = new Date(today.getTime() + days * 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('jobs')
    .select('id, customer_name, service_type, summary, scheduled_date, scheduled_time, location, status')
    .eq('org_id', orgId)
    .not('scheduled_date', 'is', null)
    .gte('scheduled_date', fmt(today))
    .lte('scheduled_date', fmt(horizon))
    .not('status', 'in', '(cancelled,completed)')
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true });

  if (error) {
    console.error('getUpcomingJobs error:', error.message);
    return [];
  }
  return data || [];
}

export interface OpenQuote {
  id: string;
  quote_number: string | null;
  client_name: string | null;
  total: number | null;
  status: string;
  valid_until: string | null;
  created_at: string;
}

export async function getOpenQuotes(orgId: string): Promise<OpenQuote[]> {
  const { data, error } = await supabase
    .from('quotes')
    .select('id, quote_number, client_name, total, status, valid_until, created_at')
    .eq('org_id', orgId)
    .in('status', ['draft', 'sent', 'viewed'])
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('getOpenQuotes error:', error.message);
    return [];
  }
  return data || [];
}

export interface BrainSummary {
  business_type: string | null;
  services: any[];
  service_areas: string[];
  pricing_notes: string | null;
  ai_instructions: string | null;
  has_hours: boolean;
}

export async function getBrainSummary(orgId: string): Promise<BrainSummary | null> {
  const { data, error } = await supabase
    .from('business_profiles')
    .select('business_type, services, service_areas, pricing_notes, ai_instructions, hours_json')
    .eq('org_id', orgId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('getBrainSummary error:', error.message);
    return null;
  }
  return {
    business_type: data.business_type ?? null,
    services: Array.isArray(data.services) ? data.services : [],
    service_areas: Array.isArray(data.service_areas) ? data.service_areas : [],
    pricing_notes: data.pricing_notes ?? null,
    ai_instructions: data.ai_instructions ?? null,
    has_hours: !!data.hours_json && Object.keys(data.hours_json).length > 0,
  };
}

// ─── Integrations (org-level, canonical: integration_connections) ────────────
export interface IntegrationConnection {
  id: string;
  provider: string;
  type: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending' | 'expired';
  account_name: string | null;
  last_sync_at: string | null;
  updated_at: string;
}

export async function getIntegrations(orgId: string): Promise<IntegrationConnection[]> {
  const { data, error } = await supabase
    .from('integration_connections')
    .select('id, provider, type, status, account_name, last_sync_at, updated_at')
    .eq('org_id', orgId);

  if (error) {
    console.error('getIntegrations error:', error.message);
    return [];
  }
  return data || [];
}

export async function disconnectIntegration(orgId: string, provider: string): Promise<void> {
  const { error } = await supabase
    .from('integration_connections')
    .update({ status: 'disconnected' })
    .eq('org_id', orgId)
    .eq('provider', provider);

  if (error) throw new Error(error.message);
}

// Kicks off an OAuth connect flow. The server builds the provider auth URL
// (with org in `state`) and returns it; the caller redirects in the same tab.
// `token` is an optional short-lived signed JWT from an SMS deep-link that
// pre-identifies the user when they're not logged in (server verifies it).
export async function connectIntegration(
  provider: string,
  token?: string,
): Promise<{ authUrl: string }> {
  const qs = token ? `?token=${encodeURIComponent(token)}` : '';
  const response = await authenticatedFetch(`/api/integrations/${provider}/connect${qs}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.message || `Couldn't start ${provider} connect`);
  }
  return response.json();
}

// Back-compat alias — Google Calendar uses the same generalized endpoint.
export async function connectGoogleCalendar(): Promise<{ authUrl: string }> {
  return connectIntegration('google-calendar');
}
