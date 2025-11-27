import { supabase } from './supabase';
import { OnboardingData, defaultOnboardingData } from '../types/onboarding';
import type { BillingPlanId } from '../types/billing';

type Nullable<T> = T | null | undefined;

interface UserProfileRow {
  id: string;
  default_org_id?: string | null;
  business_type?: string | null;
  business_goals?: string[] | null;
  phone_setup_complete?: boolean | null;
  receptionist_configured?: boolean | null;
  twilio_phone_number?: string | null;
  phone_number?: string | null;
  receptionist_voice?: string | null;
  receptionist_greeting?: string | null;
  receptionist_questions?: unknown;
  receptionist_voice_profile_id?: string | null;
  receptionist_mode?: OnboardingData['receptionistMode'] | null;
  receptionist_ack_library?: unknown;
  onboarding_complete?: boolean | null;
}

interface BusinessProfileRow {
  id: string;
  org_id: string;
  public_name?: string | null;
  website_url?: string | null;
  services?: unknown;
  locations?: unknown;
  hours?: unknown;
  brand_voice?: unknown;
  intake_questions?: unknown;
  metadata?: Record<string, unknown> | null;
}

interface ReceptionistConfigRow {
  org_id: string;
  voice_profile_id?: string | null;
  greeting_script?: string | null;
  intake_questions?: unknown;
  summary_delivery?: string | null;
  fallback_email?: string | null;
  fallback_sms_number?: string | null;
  timezone?: string | null;
  auto_collect_website?: boolean | null;
  handoff_number?: string | null;
}

interface PhoneNumberRow {
  id: string;
  org_id: string;
  e164_number?: string | null;
  connected_number?: string | null;
  status?: string | null;
  verification_state?: string | null;
  forwarding_type?: string | null;
  is_primary?: boolean | null;
}

interface OrgSnapshot {
  userProfile: UserProfileRow | null;
  organizationId: string | null;
  organizationMetadata: Record<string, unknown> | null;
  organizationTimezone: string | null;
  organizationStatus: string | null;
  organizationPlan: BillingPlanId | null;
  businessProfile: BusinessProfileRow | null;
  receptionistConfig: ReceptionistConfigRow | null;
  phoneNumbers: PhoneNumberRow[];
  primaryNumber: PhoneNumberRow | null;
}

const normalizeArray = <T>(value: Nullable<T | T[]>): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const normalizeSingle = <T>(value: Nullable<T | T[]>): T | null => {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value.length > 0 ? value[0] as T : null;
  }
  return value as T;
};

const safeArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : null))
    .filter((entry): entry is string => Boolean(entry));
};

const loadSnapshot = async (): Promise<OrgSnapshot> => {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    throw authError;
  }

  const user = authData?.user;
  if (!user) {
    throw new Error('Not authenticated.');
  }

  const { data: userProfile, error: profileError } = await supabase
    .from('users')
    .select(`
      id,
      default_org_id,
      business_type,
      business_goals,
      phone_setup_complete,
      receptionist_configured,
      twilio_phone_number,
      phone_number,
      receptionist_voice,
      receptionist_greeting,
      receptionist_questions,
      receptionist_voice_profile_id,
      receptionist_mode,
      receptionist_ack_library,
      onboarding_complete
    `)
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  const organizationId = userProfile?.default_org_id ?? null;

  if (!organizationId) {
    return {
      userProfile: userProfile ?? null,
      organizationId: null,
      organizationMetadata: null,
      organizationTimezone: null,
      organizationStatus: null,
      organizationPlan: null,
      businessProfile: null,
      receptionistConfig: null,
      phoneNumbers: [],
      primaryNumber: null,
    };
  }

  const { data: orgRow, error: orgError } = await supabase
    .from('organizations')
    .select(`
      id,
      metadata,
      timezone,
      status,
      plan,
      business_profiles (*),
      receptionist_configs (*),
      phone_numbers (*)
    `)
    .eq('id', organizationId)
    .maybeSingle();

  if (orgError && orgError.code !== 'PGRST116') {
    throw orgError;
  }

  const businessProfile = normalizeSingle<BusinessProfileRow>(orgRow?.business_profiles);
  const receptionistConfig = normalizeSingle<ReceptionistConfigRow>(orgRow?.receptionist_configs);
  const phoneNumbers = normalizeArray<PhoneNumberRow>(orgRow?.phone_numbers);
  const primaryNumber = phoneNumbers.find((phone) => phone.is_primary) || phoneNumbers[0] || null;

  const organizationPlan = (orgRow?.plan as BillingPlanId | null) ?? null;

  return {
    userProfile: userProfile ?? null,
    organizationId,
    organizationMetadata: (orgRow?.metadata as Record<string, unknown> | null) ?? null,
    organizationTimezone: (orgRow?.timezone as string | null) ?? null,
    organizationStatus: (orgRow?.status as string | null) ?? null,
    organizationPlan,
    businessProfile,
    receptionistConfig,
    phoneNumbers,
    primaryNumber,
  };
};

const deriveOnboardingData = (snapshot: OrgSnapshot): OnboardingData => {
  const data: OnboardingData = { ...defaultOnboardingData };
  const metadataSources = [
    snapshot.organizationMetadata,
    snapshot.businessProfile?.metadata,
    snapshot.userProfile?.business_type
      ? { businessType: snapshot.userProfile.business_type }
      : null,
    snapshot.userProfile?.business_goals
      ? { goals: snapshot.userProfile.business_goals }
      : null,
  ].filter(Boolean) as Record<string, unknown>[];

  const mergedMetadata = metadataSources.reduce<Record<string, unknown>>((acc, current) => ({
    ...acc,
    ...current,
  }), {});

  const receptionistQuestions = snapshot.receptionistConfig?.intake_questions ?? snapshot.userProfile?.receptionist_questions;
  const ackLibrary = snapshot.userProfile?.receptionist_ack_library;

  const primaryNumber = snapshot.primaryNumber;

  return {
    businessType: (mergedMetadata.businessType as string) || defaultOnboardingData.businessType,
    goals: (mergedMetadata.goals as string[]) || snapshot.userProfile?.business_goals || defaultOnboardingData.goals,
    phoneSetupComplete: Boolean(
      snapshot.userProfile?.phone_setup_complete || (primaryNumber?.verification_state === 'verified')
    ),
    receptionistConfigured: Boolean(
      snapshot.userProfile?.receptionist_configured || snapshot.receptionistConfig?.greeting_script
    ),
    receptionistVoice: snapshot.userProfile?.receptionist_voice || null,
    receptionistGreeting: snapshot.receptionistConfig?.greeting_script || snapshot.userProfile?.receptionist_greeting || null,
    receptionistQuestions: Array.isArray(receptionistQuestions) ? receptionistQuestions : defaultOnboardingData.receptionistQuestions,
    receptionistVoiceProfileId: snapshot.receptionistConfig?.voice_profile_id || snapshot.userProfile?.receptionist_voice_profile_id || null,
    receptionistMode: snapshot.userProfile?.receptionist_mode || defaultOnboardingData.receptionistMode,
    receptionistAckLibrary: safeArray(ackLibrary),
    twilioPhoneNumber: snapshot.userProfile?.twilio_phone_number || primaryNumber?.e164_number || null,
    phoneNumber: snapshot.userProfile?.phone_number || primaryNumber?.connected_number || null,
    billingPlan: snapshot.organizationPlan || 'trial',
  };
};

const persistLegacyUserState = async (userId: string, onboardingData: OnboardingData) => {
  const { error } = await supabase
    .from('users')
    .update({
      business_type: onboardingData.businessType,
      business_goals: onboardingData.goals,
      phone_setup_complete: onboardingData.phoneSetupComplete,
      receptionist_configured: onboardingData.receptionistConfigured,
      twilio_phone_number: onboardingData.twilioPhoneNumber,
      phone_number: onboardingData.phoneNumber,
      receptionist_voice: onboardingData.receptionistVoice,
      receptionist_greeting: onboardingData.receptionistGreeting,
      receptionist_questions: onboardingData.receptionistQuestions ?? [],
      receptionist_voice_profile_id: onboardingData.receptionistVoiceProfileId ?? null,
      receptionist_mode: onboardingData.receptionistMode ?? 'ai_only',
      receptionist_ack_library: onboardingData.receptionistAckLibrary ?? [],
      onboarding_complete: true,
    })
    .eq('id', userId);

  if (error) {
    throw error;
  }
};

const upsertBusinessProfile = async (
  orgId: string,
  snapshot: OrgSnapshot,
  onboardingData: OnboardingData,
) => {
  const metadata = {
    ...(snapshot.businessProfile?.metadata ?? {}),
    businessType: onboardingData.businessType ?? null,
    goals: onboardingData.goals ?? [],
  };

  const { error } = await supabase
    .from('business_profiles')
    .upsert({
      org_id: orgId,
      public_name: snapshot.businessProfile?.public_name ?? null,
      website_url: snapshot.businessProfile?.website_url ?? null,
      services: snapshot.businessProfile?.services ?? [],
      locations: snapshot.businessProfile?.locations ?? [],
      hours: snapshot.businessProfile?.hours ?? {},
      brand_voice: snapshot.businessProfile?.brand_voice ?? {},
      intake_questions: Array.isArray(onboardingData.receptionistQuestions)
        ? onboardingData.receptionistQuestions
        : snapshot.businessProfile?.intake_questions ?? [],
      metadata,
    }, { onConflict: 'org_id' });

  if (error) {
    throw error;
  }
};

const upsertReceptionistConfig = async (
  orgId: string,
  snapshot: OrgSnapshot,
  onboardingData: OnboardingData,
) => {
  const { error } = await supabase
    .from('receptionist_configs')
    .upsert({
      org_id: orgId,
      voice_profile_id: onboardingData.receptionistVoiceProfileId ?? snapshot.receptionistConfig?.voice_profile_id ?? null,
      greeting_script: onboardingData.receptionistGreeting ?? snapshot.receptionistConfig?.greeting_script ?? null,
      intake_questions: onboardingData.receptionistQuestions ?? [],
      summary_delivery: snapshot.receptionistConfig?.summary_delivery ?? 'push',
      fallback_email: snapshot.receptionistConfig?.fallback_email ?? null,
      fallback_sms_number: snapshot.receptionistConfig?.fallback_sms_number ?? null,
      timezone: snapshot.receptionistConfig?.timezone ?? snapshot.organizationTimezone ?? 'UTC',
      auto_collect_website: snapshot.receptionistConfig?.auto_collect_website ?? true,
      handoff_number: onboardingData.phoneNumber ?? snapshot.receptionistConfig?.handoff_number ?? null,
    }, { onConflict: 'org_id' });

  if (error) {
    throw error;
  }
};

const upsertPrimaryNumber = async (
  orgId: string,
  snapshot: OrgSnapshot,
  onboardingData: OnboardingData,
) => {
  const primaryNumber = snapshot.primaryNumber;
  const desiredStatus = onboardingData.phoneSetupComplete ? 'active' : (primaryNumber?.status ?? 'pending');
  const desiredVerification = onboardingData.phoneSetupComplete ? 'verified' : (primaryNumber?.verification_state ?? 'unverified');
  const forwardingType = onboardingData.phoneNumber ? 'call_forwarding' : (primaryNumber?.forwarding_type ?? 'flynn_number');

  if (primaryNumber) {
    const { error } = await supabase
      .from('phone_numbers')
      .update({
        e164_number: onboardingData.twilioPhoneNumber ?? primaryNumber.e164_number ?? null,
        connected_number: onboardingData.phoneNumber ?? primaryNumber.connected_number ?? null,
        status: desiredStatus,
        verification_state: desiredVerification,
        forwarding_type: forwardingType,
        is_primary: true,
      })
      .eq('id', primaryNumber.id);

    if (error) {
      throw error;
    }
    return;
  }

  if (!onboardingData.twilioPhoneNumber) {
    return;
  }

  const { error } = await supabase
    .from('phone_numbers')
    .insert({
      org_id: orgId,
      e164_number: onboardingData.twilioPhoneNumber,
      connected_number: onboardingData.phoneNumber ?? null,
      status: desiredStatus,
      verification_state: desiredVerification,
      forwarding_type: forwardingType,
      is_primary: true,
      capabilities: {},
    });

  if (error) {
    throw error;
  }
};

const updateOrganizationMetadata = async (
  orgId: string,
  snapshot: OrgSnapshot,
  onboardingData: OnboardingData,
) => {
  const metadata = {
    ...(snapshot.organizationMetadata ?? {}),
    businessType: onboardingData.businessType ?? null,
    goals: onboardingData.goals ?? [],
  };

  const payload: Record<string, unknown> = {
    metadata,
    status: onboardingData.receptionistConfigured ? 'active' : (snapshot.organizationStatus ?? 'onboarding'),
  };

  if (onboardingData.receptionistConfigured && snapshot.organizationStatus !== 'active') {
    payload.onboarded_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('organizations')
    .update(payload)
    .eq('id', orgId);

  if (error) {
    throw error;
  }
};

export const OrganizationService = {
  async fetchOnboardingData(): Promise<{ data: OnboardingData; isComplete: boolean; orgId: string | null; snapshot: OrgSnapshot; }> {
    const snapshot = await loadSnapshot();
    const data = deriveOnboardingData(snapshot);
    const isComplete = Boolean(snapshot.userProfile?.onboarding_complete);
    return { data, isComplete, orgId: snapshot.organizationId, snapshot };
  },

  async saveOnboardingData(onboardingData: OnboardingData): Promise<void> {
    const snapshot = await loadSnapshot();

    if (!snapshot.userProfile?.id) {
      throw new Error('Unable to determine current user.');
    }

    if (!snapshot.organizationId) {
      throw new Error('No organization is associated with this account yet.');
    }

    await persistLegacyUserState(snapshot.userProfile.id, onboardingData);
    await Promise.all([
      upsertBusinessProfile(snapshot.organizationId, snapshot, onboardingData),
      upsertReceptionistConfig(snapshot.organizationId, snapshot, onboardingData),
      upsertPrimaryNumber(snapshot.organizationId, snapshot, onboardingData),
      updateOrganizationMetadata(snapshot.organizationId, snapshot, onboardingData),
    ]);
  },
};
