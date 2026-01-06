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
  phoneSetupComplete: boolean;
  receptionistConfigured: boolean;
  receptionistVoice?: string | null;
  receptionistGreeting?: string | null;
  receptionistQuestions?: string[];
  receptionistVoiceProfileId?: string | null;
  receptionistMode?: ReceptionistMode; // Legacy field
  callHandlingMode?: CallHandlingMode; // New field
  receptionistAckLibrary?: string[];
  twilioPhoneNumber?: string | null;
  phoneNumber?: string | null;
  billingPlan?: BillingPlanId;
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
