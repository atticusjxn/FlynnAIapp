import React, { useState } from 'react';
import { GettingStartedScreen } from './GettingStartedScreen';
import { BusinessTypeScreen } from './BusinessTypeScreen';
import { BusinessProfileSetupScreen } from './BusinessProfileSetupScreen';
import { BusinessGoalsScreen } from './BusinessGoalsScreen';
import { ReceptionistSetupScreen } from './ReceptionistSetupScreen';
import { useOnboarding } from '../../context/OnboardingContext';

// Removed from onboarding flow - moved to post-signup dashboard experience:
// - AIReceptionistTestScreen (moved to FirstTimeExperienceModal)
// - FreeTrialSignupScreen (moved to dashboard after demo)
// - PhoneProvisioningScreen (moved to CompleteSetupScreen after payment)

// Deprecated screens - kept for reference but no longer in flow
// import { TwilioProvisioningScreen } from './TwilioProvisioningScreen';
// import { CarrierSetupScreen } from './CarrierSetupScreen';

export const OnboardingNavigator: React.FC = () => {
  const { completeOnboarding, currentOnboardingStep, setCurrentOnboardingStep } = useOnboarding();

  const handleStartOnboarding = () => {
    setCurrentOnboardingStep(1);
  };

  const handleNext = () => {
    setCurrentOnboardingStep(currentOnboardingStep + 1);
  };

  const handleBack = () => {
    setCurrentOnboardingStep(currentOnboardingStep - 1);
  };

  const handleCompleteOnboarding = async () => {
    try {
      await completeOnboarding();
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  const renderStep = () => {
    switch (currentOnboardingStep) {
      case 0:
        // Step 0: Getting Started
        return <GettingStartedScreen onStartOnboarding={handleStartOnboarding} />;
      case 1:
        // Step 1: Business Type Selection
        return <BusinessTypeScreen onNext={handleNext} onBack={handleBack} />;
      case 2:
        // Step 2: Business Profile Setup
        return <BusinessProfileSetupScreen onNext={handleNext} onBack={handleBack} />;
      case 3:
        // Step 3: Business Goals
        return <BusinessGoalsScreen onNext={handleNext} onBack={handleBack} />;
      case 4:
        // Step 4: Basic AI Receptionist Setup (simplified)
        // This is the last step - completes onboarding and navigates to dashboard
        return <ReceptionistSetupScreen onComplete={handleCompleteOnboarding} onBack={handleBack} />;
      default:
        return <GettingStartedScreen onStartOnboarding={handleStartOnboarding} />;
    }
  };

  return renderStep();
};
