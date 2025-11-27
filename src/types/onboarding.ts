import type { BillingPlanId } from './billing';

export interface BusinessGoal {
  id: string;
  label: string;
  description: string;
}

export type ReceptionistMode = 'voicemail_only' | 'ai_only' | 'hybrid_choice';

export interface OnboardingData {
  businessType?: string;
  goals?: string[];
  phoneSetupComplete: boolean;
  receptionistConfigured: boolean;
  receptionistVoice?: string | null;
  receptionistGreeting?: string | null;
  receptionistQuestions?: string[];
  receptionistVoiceProfileId?: string | null;
  receptionistMode?: ReceptionistMode;
  receptionistAckLibrary?: string[];
  twilioPhoneNumber?: string | null;
  phoneNumber?: string | null;
  billingPlan?: BillingPlanId;
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
  receptionistMode: 'ai_only',
  receptionistAckLibrary: [],
  twilioPhoneNumber: null,
  phoneNumber: null,
  billingPlan: 'trial',
};
