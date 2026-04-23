import React from 'react';
import { GettingStartedScreen } from './GettingStartedScreen';
import { WebsiteScrapeScreen } from './WebsiteScrapeScreen';
import { BusinessTypeScreen } from './BusinessTypeScreen';
import { BusinessProfileCompletionScreen } from './BusinessProfileCompletionScreen';
import { LiveVoiceDemoScreen } from './LiveVoiceDemoScreen';
import { PaywallOnboardingScreen } from './PaywallOnboardingScreen';
import { PhoneNumberScreen } from './PhoneNumberScreen';
import { useOnboarding } from '../../context/OnboardingContext';

// Removed from onboarding flow - moved to post-signup dashboard experience:
// - AIReceptionistTestScreen (moved to FirstTimeExperienceModal)
// - FreeTrialSignupScreen (moved to dashboard after demo)
// - PhoneProvisioningScreen (moved to CompleteSetupScreen after payment)
// - BusinessGoalsScreen (removed from active flow)
// - ReceptionistSetupScreen (removed from active flow)

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
        // Step 0: Welcome / Getting Started
        return <GettingStartedScreen onStartOnboarding={handleStartOnboarding} />;
      case 1:
        // Step 1: Website scraping — pull business profile automatically
        return <WebsiteScrapeScreen onNext={handleNext} onBack={handleBack} />;
      case 2:
        // Step 2: Business type selection
        return <BusinessTypeScreen onNext={handleNext} onBack={handleBack} />;
      case 3:
        // Step 3: Fill in any details the scraper missed
        return <BusinessProfileCompletionScreen onNext={handleNext} onBack={handleBack} />;
      case 4:
        // Step 4: Live voice demo — user hears their AI receptionist
        return <LiveVoiceDemoScreen onNext={handleNext} onBack={handleBack} />;
      case 5:
        // Step 5: Plan selection / paywall (Android billing coming soon)
        return <PaywallOnboardingScreen onNext={handleNext} onBack={handleBack} />;
      case 6:
        // Step 6: Call forwarding setup — final step, completes onboarding
        return <PhoneNumberScreen onNext={handleCompleteOnboarding} onBack={handleBack} />;
      default:
        return <GettingStartedScreen onStartOnboarding={handleStartOnboarding} />;
    }
  };

  return renderStep();
};
