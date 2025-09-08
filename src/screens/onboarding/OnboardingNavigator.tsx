import React, { useState } from 'react';
import { GettingStartedScreen } from './GettingStartedScreen';
import { BusinessTypeScreen } from './BusinessTypeScreen';
import { BusinessGoalsScreen } from './BusinessGoalsScreen';
import { PhoneSetupScreen } from './PhoneSetupScreen';
import { CalendarIntegrationScreen } from './CalendarIntegrationScreen';
import { useOnboarding } from '../../context/OnboardingContext';

export const OnboardingNavigator: React.FC = () => {
  const { completeOnboarding } = useOnboarding();
  const [currentStep, setCurrentStep] = useState(0);

  const handleStartOnboarding = () => {
    setCurrentStep(1);
  };

  const handleNext = () => {
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleCompleteOnboarding = async () => {
    try {
      await completeOnboarding();
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <GettingStartedScreen onStartOnboarding={handleStartOnboarding} />;
      case 1:
        return <BusinessTypeScreen onNext={handleNext} onBack={handleBack} />;
      case 2:
        return <BusinessGoalsScreen onNext={handleNext} onBack={handleBack} />;
      case 3:
        return <PhoneSetupScreen onNext={handleNext} onBack={handleBack} />;
      case 4:
        return <CalendarIntegrationScreen onComplete={handleCompleteOnboarding} onBack={handleBack} />;
      default:
        return <GettingStartedScreen onStartOnboarding={handleStartOnboarding} />;
    }
  };

  return renderStep();
};