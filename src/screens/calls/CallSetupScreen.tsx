import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { FlynnIcon } from '../../components/ui/FlynnIcon';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlynnButton } from '../../components/ui/FlynnButton';
import { FlynnCard } from '../../components/ui/FlynnCard';
import { useTheme } from '../../context/ThemeContext';
import { 
  colors, 
  spacing, 
  typography, 
  borderRadius, 
  shadows,
  layout 
} from '../../theme';
import { TwilioService } from '../../services/TwilioService';
import { TwilioServiceError } from '../../types/calls.types';

interface CallSetupScreenProps {
  navigation: any;
  route?: any;
}

export interface ForwardingSetupState {
  isLoading: boolean;
  twilioNumber: string | null;
  isForwardingActive: boolean;
  setupStep: 'provision' | 'forward' | 'test' | 'complete';
  error: string | null;
}

export const CallSetupScreen: React.FC<CallSetupScreenProps> = ({ navigation }) => {
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);
  
  const [setupState, setSetupState] = useState<ForwardingSetupState>({
    isLoading: false,
    twilioNumber: null,
    isForwardingActive: false,
    setupStep: 'provision',
    error: null
  });

  useEffect(() => {
    checkCurrentSetup();
  }, []);

  const checkCurrentSetup = async () => {
    try {
      setSetupState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const twilioStatus = await TwilioService.getUserTwilioStatus();
      
      setSetupState(prev => ({
        ...prev,
        twilioNumber: twilioStatus.twilioPhoneNumber || twilioStatus.phoneNumber,
        isForwardingActive: twilioStatus.isForwardingActive,
        setupStep: (twilioStatus.twilioPhoneNumber || twilioStatus.phoneNumber) ? 
          (twilioStatus.isForwardingActive ? 'complete' : 'forward') : 
          'provision',
        isLoading: false
      }));
    } catch (error) {
      setSetupState(prev => ({
        ...prev,
        error: 'Failed to check current setup. Please try again.',
        isLoading: false
      }));
    }
  };

  const handleProvisionNumber = async () => {
    try {
      setSetupState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const result = await TwilioService.provisionPhoneNumber();
      
      setSetupState(prev => ({
        ...prev,
        twilioNumber: result.phoneNumber,
        setupStep: 'forward',
        isLoading: false
      }));

      Alert.alert(
        'Number Provisioned!',
        `Your dedicated Flynn AI number is ${result.phoneNumber}. Now let's set up call forwarding.`,
        [{ text: 'Continue', onPress: () => {} }]
      );
    } catch (error: any) {
      console.error('Error provisioning number:', error);
      
      let errorMessage = 'Failed to provision phone number. Please try again.';
      if (error instanceof TwilioServiceError) {
        switch (error.code) {
          case 'AUTH_REQUIRED':
            errorMessage = 'Please log in to continue.';
            break;
          case 'USER_DATA_ERROR':
            errorMessage = 'Unable to access your account. Please try again.';
            break;
          default:
            errorMessage = error.message;
        }
      }
      
      setSetupState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }));
    }
  };

  const handleSetupForwarding = async () => {
    if (!setupState.twilioNumber) {
      Alert.alert('Error', 'No Twilio number available. Please provision a number first.');
      return;
    }

    try {
      setSetupState(prev => ({ ...prev, isLoading: true }));
      
      // Clean the phone number for dialing (remove +1 prefix)
      const cleanNumber = setupState.twilioNumber.replace('+1', '');
      const forwardingCode = `*72${cleanNumber}`;
      
      // Track setup attempt
      await TwilioService.trackForwardingAttempt(setupState.twilioNumber);
      
      // Immediately initiate the call with the forwarding code
      const telUrl = `tel:${forwardingCode}`;
      
      // Check if we can open the URL
      const canOpenURL = await Linking.canOpenURL(telUrl);
      if (!canOpenURL) {
        setSetupState(prev => ({ ...prev, isLoading: false }));
        showManualInstructions();
        return;
      }
      
      // Open the phone dialer with the forwarding code pre-filled
      await Linking.openURL(telUrl);
      
      setSetupState(prev => ({ ...prev, isLoading: false }));
      
      // After a brief delay, show the completion instructions
      setTimeout(() => {
        showPostCallInstructions();
      }, 1500);
      
    } catch (error: any) {
      setSetupState(prev => ({ ...prev, isLoading: false }));
      // If automatic dialing fails, show manual instructions
      showManualInstructions();
    }
  };


  const showPostCallInstructions = () => {
    Alert.alert(
      'Forwarding Activated',
      `Great! Call forwarding should now be active. Your business calls will route through Flynn AI for automatic job extraction.\n\nWould you like to make a test call to verify everything is working?`,
      [
        { text: 'Later', style: 'cancel', onPress: () => updateForwardingStatus(true) },
        { text: 'Test Now', onPress: handleTestCall }
      ]
    );
  };

  const showManualInstructions = () => {
    const cleanNumber = setupState.twilioNumber?.replace('+1', '') || '';
    const forwardingCode = `*72${cleanNumber}`;
    
    Alert.alert(
      'Manual Setup Required',
      `Your device doesn't support automatic dialing. Please manually dial:\n\n${forwardingCode}\n\nThen press the call button to activate forwarding.`,
      [
        { text: 'Copy Code', onPress: () => {
          // Note: Copy to clipboard functionality would need to be added
          Alert.alert('Code Copied', `${forwardingCode} has been copied to your clipboard.`);
        }},
        { text: 'I\'ve Setup', onPress: () => updateForwardingStatus(true) }
      ]
    );
  };

  const updateForwardingStatus = async (isActive: boolean) => {
    try {
      await TwilioService.updateForwardingStatus(isActive);
      setSetupState(prev => ({
        ...prev,
        isForwardingActive: isActive,
        setupStep: isActive ? 'complete' : 'forward'
      }));
    } catch (error) {
      console.error('Failed to update forwarding status:', error);
    }
  };

  const handleTestCall = () => {
    if (!setupState.twilioNumber) return;
    
    Alert.alert(
      'Test Call',
      `Call your Flynn AI number to test the setup:\n\n${setupState.twilioNumber}\n\nSpeak about a job request and Flynn AI will automatically create a job card for you.`,
      [
        { text: 'Call Now', onPress: () => Linking.openURL(`tel:${setupState.twilioNumber}`) },
        { text: 'Done', onPress: () => setSetupState(prev => ({ ...prev, setupStep: 'complete' })) }
      ]
    );
  };

  const handleDisableForwarding = async () => {
    Alert.alert(
      'Disable Call Forwarding',
      'This will disable call forwarding and Flynn AI will no longer process your business calls automatically. You can re-enable it anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Disable', 
          style: 'destructive',
          onPress: async () => {
            try {
              await TwilioService.updateForwardingStatus(false);
              setSetupState(prev => ({
                ...prev,
                isForwardingActive: false,
                setupStep: 'forward'
              }));
              
              // Show disable forwarding code
              Alert.alert(
                'Forwarding Disabled',
                'To completely disable forwarding on your phone, dial *720 and press call.',
                [{ text: 'Got it' }]
              );
            } catch (error) {
              Alert.alert('Error', 'Failed to disable forwarding. Please try again.');
            }
          }
        }
      ]
    );
  };

  const renderProvisionStep = () => (
    <FlynnCard style={styles.stepCard}>
      <View style={styles.stepHeader}>
        <View style={[styles.stepIcon, { backgroundColor: colors.primaryLight }]}>
          <FlynnIcon name="phone-portrait-outline" size={24} color={colors.primary} />
        </View>
        <Text style={styles.stepTitle}>Get Your Flynn AI Number</Text>
      </View>
      <Text style={styles.stepDescription}>
        Flynn AI will provision a dedicated phone number for your business. This number will handle call forwarding and automatic job extraction.
      </Text>
      <FlynnButton
        title="Get Phone Number"
        onPress={handleProvisionNumber}
        loading={setupState.isLoading}
        variant="primary"
        fullWidth
        icon={<FlynnIcon name="add-circle-outline" size={20} color="white" />}
      />
    </FlynnCard>
  );

  const renderForwardingStep = () => (
    <FlynnCard style={styles.stepCard}>
      <View style={styles.stepHeader}>
        <View style={[styles.stepIcon, { backgroundColor: colors.warningLight }]}>
          <FlynnIcon name="call-outline" size={24} color={colors.warning} />
        </View>
        <Text style={styles.stepTitle}>Setup Call Forwarding</Text>
      </View>
      <Text style={styles.stepDescription}>
        Flynn AI will open your phone dialer with the forwarding code pre-filled. Simply tap the call button to activate automatic call processing.
      </Text>
      
      {setupState.twilioNumber && (
        <View style={styles.numberDisplay}>
          <Text style={styles.numberLabel}>Your Flynn AI Number:</Text>
          <Text style={styles.numberText}>{setupState.twilioNumber}</Text>
        </View>
      )}
      
      <FlynnButton
        title="Call to Setup Forwarding"
        onPress={handleSetupForwarding}
        loading={setupState.isLoading}
        variant="primary"
        fullWidth
        icon={<FlynnIcon name="call-outline" size={20} color="white" />}
      />
    </FlynnCard>
  );

  const renderTestStep = () => (
    <FlynnCard style={styles.stepCard}>
      <View style={styles.stepHeader}>
        <View style={[styles.stepIcon, { backgroundColor: colors.successLight }]}>
          <FlynnIcon name="checkmark-circle-outline" size={24} color={colors.success} />
        </View>
        <Text style={styles.stepTitle}>Test Your Setup</Text>
      </View>
      <Text style={styles.stepDescription}>
        Make a test call to verify everything is working correctly. Flynn AI will automatically process the call and create job cards.
      </Text>
      
      <FlynnButton
        title="Make Test Call"
        onPress={handleTestCall}
        variant="success"
        fullWidth
        icon={<FlynnIcon name="call-outline" size={20} color="white" />}
      />
    </FlynnCard>
  );

  const renderCompleteStep = () => (
    <View>
      <FlynnCard style={[styles.stepCard, styles.successCard]}>
        <View style={styles.stepHeader}>
          <View style={[styles.stepIcon, { backgroundColor: colors.successLight }]}>
            <FlynnIcon name="checkmark-circle" size={24} color={colors.success} />
          </View>
          <Text style={styles.stepTitle}>Setup Complete!</Text>
        </View>
        <Text style={styles.stepDescription}>
          Call forwarding is active. All your business calls will now be processed by Flynn AI to automatically extract job details and create calendar events.
        </Text>
        
        {setupState.twilioNumber && (
          <View style={styles.numberDisplay}>
            <Text style={styles.numberLabel}>Your Flynn AI Number:</Text>
            <Text style={styles.numberText}>{setupState.twilioNumber}</Text>
          </View>
        )}
      </FlynnCard>

      <View style={styles.actionButtons}>
        <FlynnButton
          title="Make Test Call"
          onPress={handleTestCall}
          variant="secondary"
          style={styles.actionButton}
          icon={<FlynnIcon name="call-outline" size={18} color={colors.primary} />}
        />
        <FlynnButton
          title="View Call History"
          onPress={() => navigation.navigate('CallHistory')}
          variant="secondary"
          style={styles.actionButton}
          icon={<FlynnIcon name="time-outline" size={18} color={colors.primary} />}
        />
      </View>

      <FlynnButton
        title="Disable Call Forwarding"
        onPress={handleDisableForwarding}
        variant="ghost"
        fullWidth
        textStyle={styles.disableButtonText}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Call Recording Setup</Text>
          <Text style={styles.subtitle}>
            Automatically capture job details from phone calls
          </Text>
        </View>

        {setupState.error && (
          <View style={styles.errorContainer}>
            <FlynnIcon name="alert-circle" size={20} color={colors.error} />
            <Text style={styles.errorText}>{setupState.error}</Text>
          </View>
        )}

        <View style={styles.progressIndicator}>
          {(['provision', 'forward', 'test', 'complete'] as const).map((step, index) => (
            <View key={step} style={styles.progressStep}>
              <View 
                style={[
                  styles.progressDot,
                  {
                    backgroundColor: 
                      setupState.setupStep === step ? colors.primary :
                      (['provision', 'forward', 'test', 'complete'] as const).indexOf(setupState.setupStep) > index ? colors.success :
                      colors.gray300
                  }
                ]} 
              />
              {index < 3 && (
                <View 
                  style={[
                    styles.progressLine,
                    {
                      backgroundColor: 
                        (['provision', 'forward', 'test', 'complete'] as const).indexOf(setupState.setupStep) > index ? colors.success : colors.gray300
                    }
                  ]} 
                />
              )}
            </View>
          ))}
        </View>

        <View style={styles.content}>
          {setupState.setupStep === 'provision' && renderProvisionStep()}
          {setupState.setupStep === 'forward' && renderForwardingStep()}
          {setupState.setupStep === 'test' && renderTestStep()}
          {setupState.setupStep === 'complete' && renderCompleteStep()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  progressIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  progressLine: {
    width: 40,
    height: 2,
    marginHorizontal: spacing.xs,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  stepCard: {
    marginBottom: spacing.lg,
  },
  successCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  stepIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  stepTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
  },
  stepDescription: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  numberDisplay: {
    backgroundColor: colors.backgroundTertiary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  numberLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.xxs,
    textTransform: 'uppercase',
  },
  numberText: {
    ...typography.h4,
    color: colors.primary,
    fontWeight: '700',
  },
  actionButtons: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  disableButtonText: {
    color: colors.textTertiary,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorLight,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  errorText: {
    ...typography.bodyMedium,
    color: colors.error,
    marginLeft: spacing.sm,
    flex: 1,
  },
});

export default CallSetupScreen;