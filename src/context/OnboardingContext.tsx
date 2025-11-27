import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { OrganizationService } from '../services/organizationService';
import { BusinessGoal, OnboardingData, defaultOnboardingData } from '../types/onboarding';

interface OnboardingContextType {
  isOnboardingComplete: boolean;
  onboardingData: OnboardingData;
  updateOnboardingData: (data: Partial<OnboardingData>) => void;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => void;
  loading: boolean;
  organizationId: string | null;
  refreshOnboarding: () => Promise<void>;
}

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
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const checkOnboardingStatus = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!user) {
      setIsOnboardingComplete(false);
      setOnboardingData(defaultOnboardingData);
      setOrganizationId(null);
      setLoading(false);
      return;
    }

    if (!options.silent) {
      setLoading(true);
    }

    try {
      const snapshot = await OrganizationService.fetchOnboardingData();
      setIsOnboardingComplete(snapshot.isComplete);
      setOnboardingData(snapshot.data);
      setOrganizationId(snapshot.orgId);
    } catch (error) {
      console.error('Error in checkOnboardingStatus:', error);
      setIsOnboardingComplete(false);
      setOnboardingData(defaultOnboardingData);
      setOrganizationId(null);
    } finally {
      if (!options.silent) {
        setLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    void checkOnboardingStatus();
  }, [checkOnboardingStatus]);

  const refreshOnboarding = useCallback(async () => {
    await checkOnboardingStatus({ silent: false });
  }, [checkOnboardingStatus]);

  const updateOnboardingData = (newData: Partial<OnboardingData>) => {
    setOnboardingData(prev => ({ ...prev, ...newData }));
  };

  const completeOnboarding = async () => {
    if (!user) return;

    try {
      await OrganizationService.saveOnboardingData(onboardingData);
      setIsOnboardingComplete(true);
    } catch (error) {
      console.error('Error in completeOnboarding:', error);
      throw error;
    }
  };

  const resetOnboarding = () => {
    setIsOnboardingComplete(false);
    setOnboardingData(defaultOnboardingData);
    setOrganizationId(null);
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
        organizationId,
        refreshOnboarding,
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
