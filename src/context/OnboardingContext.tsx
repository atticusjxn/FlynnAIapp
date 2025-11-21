import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';
import { BusinessProfile } from '../services/BusinessProfileService';

export interface BusinessGoal {
  id: string;
  label: string;
  description: string;
}

export interface OnboardingData {
  businessType?: string;
  goals?: string[];
  phoneSetupComplete: boolean;
  receptionistConfigured: boolean;
  receptionistVoice?: string | null;
  receptionistGreeting?: string | null;
  receptionistQuestions?: string[];
  receptionistVoiceProfileId?: string | null;
  receptionistBusinessProfile?: BusinessProfile | null;
  twilioPhoneNumber?: string | null;
  phoneNumber?: string | null;
}

interface OnboardingContextType {
  isOnboardingComplete: boolean;
  onboardingData: OnboardingData;
  updateOnboardingData: (data: Partial<OnboardingData>) => void;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => void;
  loading: boolean;
}

const defaultOnboardingData: OnboardingData = {
  businessType: '',
  goals: [],
  phoneSetupComplete: false,
  receptionistConfigured: false,
  receptionistVoice: null,
  receptionistGreeting: null,
  receptionistQuestions: [],
  receptionistVoiceProfileId: null,
  receptionistBusinessProfile: null,
  twilioPhoneNumber: null,
  phoneNumber: null,
};

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const businessTypes = [
  { id: 'home_property', label: 'Home & Property Services', emoji: '🏠' },
  { id: 'personal_beauty', label: 'Personal & Beauty Services', emoji: '👤' },
  { id: 'automotive', label: 'Automotive Services', emoji: '🚗' },
  { id: 'business_professional', label: 'Business & Professional Services', emoji: '💼' },
  { id: 'other', label: 'Other', emoji: '📋' },
];

export const businessGoals: BusinessGoal[] = [
  {
    id: 'track_progress',
    label: 'Track Job Progress',
    description: 'Monitor jobs from start to completion'
  },
  {
    id: 'book_meetings',
    label: 'Book Client Meetings',
    description: 'Schedule consultations and site visits'
  },
  {
    id: 'schedule_appointments',
    label: 'Schedule Appointments',
    description: 'Manage recurring service appointments'
  },
  {
    id: 'manage_clients',
    label: 'Manage Clients',
    description: 'Keep track of client information and history'
  },
  {
    id: 'automate_confirmations',
    label: 'Automate Confirmations',
    description: 'Send automatic appointment confirmations'
  },
  {
    id: 'capture_leads',
    label: 'Capture Leads',
    description: 'Convert phone calls into bookings'
  },
];

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>(defaultOnboardingData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkOnboardingStatus();
  }, [user]);

  const checkOnboardingStatus = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('business_type, onboarding_complete, business_goals, phone_setup_complete, receptionist_configured, twilio_phone_number, phone_number, receptionist_voice, receptionist_greeting, receptionist_questions, receptionist_voice_profile_id, receptionist_business_profile')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        if ((error as { code?: string }).code !== 'PGRST116') {
          console.error('Error checking onboarding status:', error);
        }
        setIsOnboardingComplete(false);
        setOnboardingData(defaultOnboardingData);
        return;
      }

      if (!data) {
        setIsOnboardingComplete(false);
        setOnboardingData(defaultOnboardingData);
        return;
      }

      setIsOnboardingComplete(data.onboarding_complete || false);
      setOnboardingData({
        businessType: data.business_type || '',
        goals: data.business_goals || [],
        phoneSetupComplete: data.phone_setup_complete || false,
        receptionistConfigured: data.receptionist_configured || false,
        receptionistVoice: data.receptionist_voice || null,
        receptionistGreeting: data.receptionist_greeting || null,
        receptionistQuestions: data.receptionist_questions ? (Array.isArray(data.receptionist_questions) ? data.receptionist_questions : []) : [],
        receptionistVoiceProfileId: data.receptionist_voice_profile_id || null,
        receptionistBusinessProfile: data.receptionist_business_profile || null,
        twilioPhoneNumber: data.twilio_phone_number || null,
        phoneNumber: data.phone_number || null,
      });
    } catch (error) {
      console.error('Error in checkOnboardingStatus:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOnboardingData = (newData: Partial<OnboardingData>) => {
    setOnboardingData(prev => ({ ...prev, ...newData }));
  };

  const completeOnboarding = async () => {
    if (!user) return;

    try {
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
          receptionist_business_profile: onboardingData.receptionistBusinessProfile ?? null,
          onboarding_complete: true,
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error completing onboarding:', error);
        throw error;
      }

      setIsOnboardingComplete(true);
    } catch (error) {
      console.error('Error in completeOnboarding:', error);
      throw error;
    }
  };

  const resetOnboarding = () => {
    setIsOnboardingComplete(false);
    setOnboardingData(defaultOnboardingData);
  };

  return (
    <OnboardingContext.Provider
      value={{
        isOnboardingComplete,
        onboardingData,
        updateOnboardingData,
        completeOnboarding,
        resetOnboarding,
        loading,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};
