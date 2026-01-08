import type { BillingPlanId } from './billing';

export interface BusinessGoal {
  id: string;
  label: string;
  description: string;
}

// Legacy receptionist mode type (deprecated, use CallHandlingMode)
export type ReceptionistMode = 'voicemail_only' | 'ai_only' | 'hybrid_choice';

// New call handling mode type
export type CallHandlingMode = 'sms_links' | 'ai_receptionist' | 'voicemail_only';

export interface OnboardingData {
  businessType?: string;
  goals?: string[];
  // Business profile fields
  websiteUrl?: string;
  businessName?: string;
  phone?: string; // Note: distinct from phoneNumber (which is for call forwarding)
  email?: string;
  // Phone setup fields
  phoneSetupComplete: boolean;
  phoneNumber?: string | null; // Business phone number for call forwarding
  twilioPhoneNumber?: string | null; // Provisioned Flynn number
  // Receptionist configuration fields
  receptionistConfigured: boolean;
  receptionistVoice?: string | null;
  receptionistGreeting?: string | null;
  receptionistQuestions?: string[];
  receptionistVoiceProfileId?: string | null;
  receptionistMode?: ReceptionistMode; // Legacy field
  callHandlingMode?: CallHandlingMode; // New field
  receptionistAckLibrary?: string[];
  // Billing fields
  billingPlan?: BillingPlanId;
  trialStarted?: boolean; // Tracks if free trial signup was completed during onboarding
  // AI Test fields
  aiTestCompleted?: boolean;
  testJobExtracted?: {
    caller_name?: string;
    phone_number?: string;
    service_type?: string;
    preferred_date?: string;
    preferred_time?: string;
    location?: string;
    urgency?: 'urgent' | 'normal' | 'flexible';
    notes?: string;
  };
}

export const defaultOnboardingData: OnboardingData = {
  businessType: '',
  goals: [],
  phoneSetupComplete: false,
  receptionistConfigured: false,
  receptionistVoice: null,
  receptionistGreeting: null,
  receptionistQuestions: [],
  receptionistVoiceProfileId: null,
  receptionistMode: 'ai_only', // Legacy default
  callHandlingMode: 'sms_links', // New default
  receptionistAckLibrary: [],
  twilioPhoneNumber: null,
  phoneNumber: null,
  billingPlan: 'trial',
};
