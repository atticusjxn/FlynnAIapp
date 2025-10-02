import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOnboarding } from '../../context/OnboardingContext';
import { TwilioService } from '../../services/TwilioService';
import { useAuth } from '../../context/AuthContext';
import { typography, spacing } from '../../theme';
import { FlynnButton } from '../../components/ui/FlynnButton';

interface TwilioProvisioningScreenProps {
  onNext: () => void;
}

export const TwilioProvisioningScreen: React.FC<TwilioProvisioningScreenProps> = ({
  onNext,
}) => {
  const { user } = useAuth();
  const { updateOnboardingData } = useOnboarding();
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionedNumber, setProvisionedNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleProvisionNumber = async () => {
    if (!user?.id) {
      setError('User not authenticated.');
      return;
    }
    setIsProvisioning(true);
    setError(null);
    try {
      const result = await TwilioService.provisionPhoneNumber();
      if (result && result.phoneNumber) {
        setProvisionedNumber(result.phoneNumber);
        updateOnboardingData({ twilioNumberProvisioned: true, twilioPhoneNumber: result.phoneNumber });
        Alert.alert(
          'Number Provisioned!',
          `Your new Flynn business number is: ${result.phoneNumber}. You can manage this from Settings.`, [
            { text: 'Continue', onPress: onNext }
          ]
        );
      } else {
        setError('Failed to provision a Twilio number.');
      }
    } catch (err: any) {
      console.error('[TwilioProvisioningScreen] Error provisioning number:', err);
      setError(err.message || 'An unexpected error occurred during provisioning. Please try again.');
    } finally {
      setIsProvisioning(false);
    }
  };

  useEffect(() => {
    // Auto-provision if we don't have a number yet
    const checkAndProvision = async () => {
      const status = await TwilioService.getUserTwilioStatus();
      if (status.twilioPhoneNumber) {
        setProvisionedNumber(status.twilioPhoneNumber);
        updateOnboardingData({ twilioNumberProvisioned: true, twilioPhoneNumber: status.twilioPhoneNumber });
        onNext(); // Skip if already provisioned
      } else if (user?.id) {
        // Only attempt to provision if user is authenticated
        handleProvisionNumber();
      }
    };
    void checkAndProvision();
  }, [user?.id]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="call-outline" size={64} color="#3B82F6" style={styles.icon} />
        <Text style={styles.title}>Your Flynn Business Number</Text>
        <Text style={styles.subtitle}>
          Let Flynn handle your voicemails and turn them into job cards. We'll provision a dedicated number for your business.
        </Text>

        {isProvisioning ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Provisioning your number...</Text>
          </View>
        ) : provisionedNumber ? (
          <View style={styles.successContainer}>
            <Ionicons name="checkmark-circle-outline" size={48} color="#10b981" />
            <Text style={styles.successText}>Number Provisioned!</Text>
            <Text style={styles.provisionedNumber}>{provisionedNumber}</Text>
            <FlynnButton title="Continue" onPress={onNext} variant="primary" style={styles.button} />
          </View>
        ) : (
          <View style={styles.errorContainer}>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <FlynnButton title="Try Again" onPress={handleProvisionNumber} variant="primary" style={styles.button} />
            <FlynnButton title="Skip for now" onPress={onNext} variant="secondary" style={styles.button} />
          </View>
        )}

      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: '#0f172a',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodyLarge,
    color: '#475569',
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  loadingText: {
    ...typography.bodyMedium,
    marginTop: spacing.md,
    color: '#475569',
  },
  successContainer: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  successText: {
    ...typography.h3,
    color: '#10b981',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  provisionedNumber: {
    ...typography.h4,
    color: '#0f172a',
    marginBottom: spacing.xl,
  },
  errorContainer: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  errorText: {
    ...typography.bodyMedium,
    color: '#dc2626',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.md,
    width: 200,
  },
});
