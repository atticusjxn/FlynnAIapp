import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

export interface BusinessGoal {
  id: string;
  label: string;
  description: string;
}

export interface OnboardingData {
  businessType?: string;
  goals?: string[];
  phoneSetupComplete: boolean;
  calendarIntegrationComplete: boolean;
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
  calendarIntegrationComplete: false,
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
        .select('business_type, onboarding_complete, business_goals, phone_setup_complete, calendar_integration_complete, twilio_phone_number, phone_number')
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
        calendarIntegrationComplete: data.calendar_integration_complete || false,
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
          calendar_integration_complete: onboardingData.calendarIntegrationComplete,
          twilio_phone_number: onboardingData.twilioPhoneNumber,
          phone_number: onboardingData.phoneNumber,
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
