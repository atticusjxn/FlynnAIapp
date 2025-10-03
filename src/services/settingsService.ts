import { supabase } from './supabase';
import { businessTypes } from '../context/OnboardingContext';

export interface UserSettingsPayload {
  id: string;
  business_name: string | null;
  business_type: string | null;
  email: string | null;
  phone_number: string | null;
  forwarding_active: boolean;
  call_features_enabled: boolean;
  twilio_phone_number: string | null; // Added
  twilio_number_sid: string | null; // Added
  settings: Record<string, any> | null;
}

export interface CalendarIntegrationRecord {
  id: string;
  integration_type: string;
  is_active: boolean;
  calendar_name: string | null;
}

export interface CalendarIntegrationView {
  id: string;
  label: string;
  description: string;
  icon: string;
  connected: boolean;
}

const calendarIntegrationMetadata: Record<string, { label: string; description: string; icon: string }> = {
  google: {
    label: 'Google Calendar',
    description: 'Sync jobs with Google Calendar',
    icon: 'calendar-outline',
  },
  outlook: {
    label: 'Outlook',
    description: 'Sync jobs with Outlook Calendar',
    icon: 'mail-outline',
  },
  apple: {
    label: 'Apple Calendar',
    description: 'Sync jobs with Apple Calendar',
    icon: 'phone-portrait-outline',
  },
};

export interface SettingsData {
  profile: {
    id: string;
    businessName: string;
    businessType: string;
    email: string;
    phone: string;
    forwardingActive: boolean;
    callFeaturesEnabled: boolean;
    twilioPhoneNumber: string | null; // Added
    twilioNumberSid: string | null; // Added
  } | null;
  pushEnabled: boolean;
  calendarIntegrations: CalendarIntegrationView[];
  notificationSettings: Record<string, any> | null;
}

export const fetchUserSettings = async (userId: string): Promise<SettingsData> => {
  const [profileRes, calendarRes, tokensRes] = await Promise.all([
    supabase
      .from('users')
      .select('id, business_name, business_type, email, phone_number, forwarding_active, call_features_enabled, settings, twilio_phone_number, twilio_number_sid') // Added Twilio fields
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('calendar_integrations')
      .select('id, integration_type, is_active, calendar_name')
      .eq('user_id', userId),
    supabase
      .from('notification_tokens')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
  ]);

  const profileRow = profileRes.data;
  const profile = profileRow
    ? {
        id: profileRow.id,
        businessName: profileRow.business_name ?? '',
        businessType: profileRow.business_type ?? '',
        email: profileRow.email ?? '',
        phone: profileRow.phone_number ?? '',
        forwardingActive: Boolean(profileRow.forwarding_active),
        callFeaturesEnabled: profileRow.call_features_enabled !== false,
        twilioPhoneNumber: profileRow.twilio_phone_number ?? null, // Mapped Twilio phone number
        twilioNumberSid: profileRow.twilio_number_sid ?? null, // Mapped Twilio number SID
      }
    : null;

  const calendarIntegrations: CalendarIntegrationView[] = (calendarRes.data ?? []).map((integration) => {
    const meta = calendarIntegrationMetadata[integration.integration_type] ?? {
      label: integration.integration_type,
      description: integration.calendar_name || 'Calendar integration',
      icon: 'calendar-outline',
    };
    return {
      id: integration.id,
      label: meta.label,
      description: meta.description,
      icon: meta.icon,
      connected: Boolean(integration.is_active),
    };
  });

  const pushEnabled = (tokensRes.count ?? 0) > 0;

  return {
    profile,
    pushEnabled,
    calendarIntegrations,
    notificationSettings: (profileRow?.settings as Record<string, any>) ?? null,
  };
};

export const updateUserProfile = async (
  userId: string,
  payload: Partial<{ businessName: string; businessType: string; phone: string; forwardingActive: boolean }>,
) => {
  const updates: Record<string, any> = {};
  if (payload.businessName !== undefined) updates.business_name = payload.businessName;
  if (payload.businessType !== undefined) updates.business_type = payload.businessType;
  if (payload.phone !== undefined) updates.phone_number = payload.phone;
  if (payload.forwardingActive !== undefined) updates.forwarding_active = payload.forwardingActive;
  updates.updated_at = new Date().toISOString();

  return supabase.from('users').update(updates).eq('id', userId);
};

export const updateNotificationSettings = async (
  userId: string,
  prefs: { push?: boolean; email?: boolean; sms?: boolean },
) => {
  const { data: profile } = await supabase
    .from('users')
    .select('settings')
    .eq('id', userId)
    .maybeSingle();

  const settings = (profile?.settings as Record<string, any>) ?? {};
  const existing = settings.notifications ?? {};
  const next = { ...existing, ...prefs };
  return supabase
    .from('users')
    .update({ settings: { ...settings, notifications: next }, updated_at: new Date().toISOString() })
    .eq('id', userId);
};

export const toggleCalendarIntegration = async (
  integrationId: string,
  nextState: boolean,
) => {
  return supabase
    .from('calendar_integrations')
    .update({ is_active: nextState, updated_at: new Date().toISOString() })
    .eq('id', integrationId);
};

export const resolveBusinessTypeLabel = (businessType: string) => {
  const entry = businessTypes.find((type) => type.id === businessType);
  return entry ? entry.label : 'Not specified';
};
