import React, { useState } from 'react';
import { GettingStartedScreen } from './GettingStartedScreen';
import { BusinessTypeScreen } from './BusinessTypeScreen';
import { BusinessProfileSetupScreen } from './BusinessProfileSetupScreen';
import { BusinessGoalsScreen } from './BusinessGoalsScreen';
import { ReceptionistSetupScreen } from './ReceptionistSetupScreen';
import AIReceptionistTestScreen from './AIReceptionistTestScreen';
import { FreeTrialSignupScreen } from './FreeTrialSignupScreen';
import { PhoneProvisioningScreen } from './PhoneProvisioningScreen';
import { useOnboarding } from '../../context/OnboardingContext';

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
        return <GettingStartedScreen onStartOnboarding={handleStartOnboarding} />;
      case 1:
        return <BusinessTypeScreen onNext={handleNext} onBack={handleBack} />;
      case 2:
        return <BusinessProfileSetupScreen onNext={handleNext} onBack={handleBack} />;
      case 3:
        return <BusinessGoalsScreen onNext={handleNext} onBack={handleBack} />;
      case 4:
        // Step 4: Tune AI Receptionist
        return <ReceptionistSetupScreen onComplete={handleNext} onBack={handleBack} />;
      case 5:
        // Step 5: Test AI Receptionist (moved earlier, before trial signup)
        return <AIReceptionistTestScreen onNext={handleNext} onBack={handleBack} navigation={{ navigate: handleNext }} />;
      case 6:
        // Step 6: Sign Up for Free Trial (new)
        return <FreeTrialSignupScreen onNext={handleNext} onBack={handleBack} />;
      case 7:
        // Step 7: Provision Phone Number (unified, replaces TwilioProvisioningScreen and CarrierSetupScreen)
        return <PhoneProvisioningScreen onNext={handleCompleteOnboarding} onBack={handleBack} />;
      default:
        return <GettingStartedScreen onStartOnboarding={handleStartOnboarding} />;
    }
  };

  return renderStep();
};
