import { supabase } from './supabase';
import { businessTypes } from '../context/OnboardingContext';
import { SmartRoutingMode as CallsSmartRoutingMode } from '../types/calls.types';

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

export type SmartRoutingMode = CallsSmartRoutingMode;
export type AfterHoursMode = 'intake' | 'voicemail';

export interface SmartRoutingScheduleWindow {
  days: string[];
  start: string;
  end: string;
}

export interface SmartRoutingScheduleConfig {
  timezone: string;
  windows: SmartRoutingScheduleWindow[];
}

export interface SmartRoutingSettings {
  mode: SmartRoutingMode;
  afterHoursMode: AfterHoursMode;
  featureEnabled: boolean;
  schedule: SmartRoutingScheduleConfig | null;
  updatedAt?: string | null;
}

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
  notificationSettings: Record<string, any> | null;
  smartRouting: SmartRoutingSettings;
}

const parseSchedule = (value: any): SmartRoutingScheduleConfig | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const timezone = typeof parsed.timezone === 'string' ? parsed.timezone : undefined;
    const windows = Array.isArray(parsed.windows)
      ? parsed.windows.map((window: any) => ({
          days: Array.isArray(window.days)
            ? window.days.map((day: any) => String(day || '').toLowerCase())
            : typeof window.day === 'string'
              ? [window.day.toLowerCase()]
              : [],
          start: String(window.start || window.startTime || ''),
          end: String(window.end || window.endTime || ''),
        }))
      : [];

    if (!timezone || windows.length === 0) {
      return null;
    }

    return { timezone, windows };
  } catch (error) {
    console.warn('[SettingsService] Failed to parse routing schedule', error);
    return null;
  }
};

export const fetchUserSettings = async (userId: string): Promise<SettingsData> => {
  const [profileRes, tokensRes, routingRes] = await Promise.all([
    supabase
      .from('users')
      .select('id, business_name, business_type, email, phone_number, forwarding_active, call_features_enabled, settings, twilio_phone_number, twilio_number_sid') // Added Twilio fields
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('notification_tokens')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('call_routing_settings')
      .select('mode, after_hours_mode, feature_enabled, schedule, schedule_timezone, updated_at')
      .eq('user_id', userId)
      .maybeSingle(),
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

  const pushEnabled = (tokensRes.count ?? 0) > 0;

  const routingRow = routingRes.data;
  const smartRouting: SmartRoutingSettings = {
    mode: (routingRow?.mode as SmartRoutingMode) ?? 'smart_auto',
    afterHoursMode: (routingRow?.after_hours_mode as AfterHoursMode) ?? 'voicemail',
    featureEnabled: routingRow?.feature_enabled !== false,
    schedule: parseSchedule(routingRow?.schedule) || (routingRow?.schedule_timezone
      ? {
          timezone: routingRow.schedule_timezone,
          windows: [],
        }
      : null),
    updatedAt: routingRow?.updated_at ?? null,
  };

  return {
    profile,
    pushEnabled,
    notificationSettings: (profileRow?.settings as Record<string, any>) ?? null,
    smartRouting,
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

export const updateSmartRoutingSettings = async (
  userId: string,
  settings: Partial<SmartRoutingSettings>,
) => {
  const payload: Record<string, any> = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  };

  if (settings.mode) {
    payload.mode = settings.mode;
  }

  if (settings.afterHoursMode) {
    payload.after_hours_mode = settings.afterHoursMode;
  }

  if (settings.featureEnabled !== undefined) {
    payload.feature_enabled = settings.featureEnabled;
  }

  if (settings.schedule) {
    payload.schedule = JSON.stringify(settings.schedule);
    payload.schedule_timezone = settings.schedule.timezone;
  } else if (settings.schedule === null) {
    payload.schedule = null;
    payload.schedule_timezone = null;
  }

  return supabase.from('call_routing_settings').upsert(payload, { onConflict: 'user_id' });
};

export const resolveBusinessTypeLabel = (businessType: string) => {
  const entry = businessTypes.find((type) => type.id === businessType);
  return entry ? entry.label : 'Not specified';
};
