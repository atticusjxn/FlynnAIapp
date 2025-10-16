import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { FlynnIcon } from '../../components/ui/FlynnIcon';
import { useOnboarding } from '../../context/OnboardingContext';
import { TwilioService } from '../../services/TwilioService';
import { useAuth } from '../../context/AuthContext';
import { typography, spacing } from '../../theme';
import { FlynnButton } from '../../components/ui/FlynnButton';
import { FlynnInput } from '../../components/ui/FlynnInput';
import { FlynnKeyboardAvoidingView } from '../../components/ui';
import {
  detectCarrierFromNumber,
  CarrierDetectionConfidence,
} from '../../services/CarrierDetectionService';
import { normalizeNumberForDetection, carrierIdToIsoCountry, inferIsoCountryFromNumber } from '../../utils/phone';

interface TwilioProvisioningScreenProps {
  onNext: () => void;
}

export const TwilioProvisioningScreen: React.FC<TwilioProvisioningScreenProps> = ({
  onNext,
}) => {
  const { user } = useAuth();
  const { updateOnboardingData, onboardingData } = useOnboarding();
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionedNumber, setProvisionedNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState(onboardingData.phoneNumber ?? '');
  const [carrierDetectionState, setCarrierDetectionState] = useState<{
    status: 'idle' | 'loading' | 'success' | 'none' | 'error';
    carrierId?: string;
    confidence?: CarrierDetectionConfidence;
    message?: string;
    rawCarrierName?: string | null;
    source?: 'lookup' | 'heuristic';
    e164Number?: string | null;
  }>({ status: 'idle' });
  const detectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPersistedDetection = useRef<string | null>(null);

  const normalizedForDetection = useMemo(
    () => normalizeNumberForDetection(phoneNumber),
    [phoneNumber],
  );

  const detectionSignature = useMemo(() => {
    if (carrierDetectionState.status !== 'success' || !carrierDetectionState.carrierId) {
      return null;
    }
    const base = carrierDetectionState.e164Number || normalizedForDetection || phoneNumber;
    return `${carrierDetectionState.carrierId}:${base}`;
  }, [carrierDetectionState, normalizedForDetection, phoneNumber]);

  const countryCodeHint = useMemo(() => {
    if (carrierDetectionState.status === 'success') {
      return (
        carrierIdToIsoCountry(carrierDetectionState.carrierId) ||
        inferIsoCountryFromNumber(carrierDetectionState.e164Number)
      );
    }

    return inferIsoCountryFromNumber(phoneNumber);
  }, [carrierDetectionState, phoneNumber]);

  const countryLabel = useMemo(() => {
    switch (countryCodeHint) {
      case 'AU':
        return 'Australian';
      case 'GB':
        return 'UK';
      case 'IE':
        return 'Irish';
      case 'NZ':
        return 'New Zealand';
      case 'US':
        return 'US';
      default:
        return countryCodeHint || 'US';
    }
  }, [countryCodeHint]);

  useEffect(() => {
    if (detectionTimeoutRef.current) {
      clearTimeout(detectionTimeoutRef.current);
    }

    if (!normalizedForDetection || normalizedForDetection.length < 8) {
      setCarrierDetectionState({ status: 'idle' });
      return;
    }

    setCarrierDetectionState((prev) =>
      prev.status === 'loading' && prev.carrierId ? prev : { status: 'loading' }
    );

    let cancelled = false;

    detectionTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await detectCarrierFromNumber(normalizedForDetection);

        if (cancelled) {
          return;
        }

        if (result) {
          setCarrierDetectionState({
            status: 'success',
            carrierId: result.carrierId,
            confidence: result.confidence,
            rawCarrierName: result.rawCarrierName,
            source: result.source,
            e164Number: result.e164Number,
          });
        } else {
          setCarrierDetectionState({ status: 'none' });
        }
      } catch (lookupError) {
        if (!cancelled) {
          const message =
            lookupError instanceof Error && lookupError.message === 'LOOKUP_DISABLED'
              ? 'Automatic detection requires Twilio Lookup credentials. Enter your carrier manually.'
              : 'We could not detect your carrier automatically.';

          setCarrierDetectionState({
            status: 'error',
            message,
          });
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      if (detectionTimeoutRef.current) {
        clearTimeout(detectionTimeoutRef.current);
      }
    };
  }, [normalizedForDetection]);

  useEffect(() => {
    if (carrierDetectionState.status !== 'success' || !carrierDetectionState.carrierId || !detectionSignature) {
      return;
    }

    if (detectionSignature === lastPersistedDetection.current) {
      return;
    }

    const normalized = normalizedForDetection || phoneNumber;

    TwilioService.persistCarrierDetection(normalized, {
      carrierId: carrierDetectionState.carrierId,
      confidence: carrierDetectionState.confidence || 'low',
      source: carrierDetectionState.source || 'heuristic',
      rawCarrierName: carrierDetectionState.rawCarrierName ?? undefined,
      e164Number: carrierDetectionState.e164Number ?? undefined,
    }).finally(() => {
      lastPersistedDetection.current = detectionSignature;
    });
  }, [carrierDetectionState, normalizedForDetection, phoneNumber, detectionSignature]);

  const handleProvisionNumber = async () => {
    if (!user?.id) {
      setError('User not authenticated.');
      return;
    }

    if (!phoneNumber.trim()) {
      setError('Enter the phone number you currently use for your business so we can match a local Flynn number.');
      return;
    }

    setIsProvisioning(true);
    setError(null);
    try {
      const result = await TwilioService.provisionPhoneNumber({
        carrierIdHint: carrierDetectionState.status === 'success' ? carrierDetectionState.carrierId : undefined,
        phoneNumberHint:
          carrierDetectionState.status === 'success'
            ? carrierDetectionState.e164Number || undefined
            : phoneNumber.startsWith('+')
              ? phoneNumber
              : undefined,
        countryCode: countryCodeHint || undefined,
      });
      if (result && result.phoneNumber) {
        setProvisionedNumber(result.phoneNumber);
        updateOnboardingData({
          twilioPhoneNumber: result.phoneNumber,
          phoneNumber: carrierDetectionState.status === 'success'
            ? carrierDetectionState.e164Number || phoneNumber
            : phoneNumber,
        });
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
    const checkAndProvision = async () => {
      const status = await TwilioService.getUserTwilioStatus();
      if (status.twilioPhoneNumber) {
        setProvisionedNumber(status.twilioPhoneNumber);
        updateOnboardingData({ twilioPhoneNumber: status.twilioPhoneNumber });
        onNext(); // Skip if already provisioned
      }
    };
    void checkAndProvision();
  }, [user?.id]);

  return (
    <SafeAreaView style={styles.container}>
      <FlynnKeyboardAvoidingView
        contentContainerStyle={styles.keyboardContent}
        dismissOnTapOutside
      >
        <View style={styles.content}>
          <FlynnIcon name="call-outline" size={64} color="#3B82F6" style={styles.icon} />
          <Text style={styles.title}>Your Flynn Business Number</Text>
          <Text style={styles.subtitle}>
            Let Flynn handle your voicemails and turn them into job cards. Tell us the mobile number you answer today and we'll provision a matching country code automatically.
          </Text>

          <FlynnInput
          label="Your existing business mobile"
          placeholder="e.g. +61 4xx xxx xxx"
          keyboardType="phone-pad"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          autoComplete="tel"
          required
          helperText={
            carrierDetectionState.status === 'success'
              ? `Detected ${carrierDetectionState.rawCarrierName ?? carrierDetectionState.carrierId} (${carrierDetectionState.confidence ?? 'low'} confidence). We'll match a ${countryLabel} number.`
              : carrierDetectionState.status === 'loading'
                ? 'Checking your carrier so we can match the right forwarding codes...'
                : undefined
          }
          errorText={carrierDetectionState.status === 'error' ? carrierDetectionState.message : undefined}
        />

          {isProvisioning ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.loadingText}>Provisioning your number...</Text>
            </View>
          ) : provisionedNumber ? (
            <View style={styles.successContainer}>
              <FlynnIcon name="checkmark-circle-outline" size={48} color="#10b981" />
              <Text style={styles.successText}>Number Provisioned!</Text>
              <Text style={styles.provisionedNumber}>{provisionedNumber}</Text>
              <FlynnButton title="Continue" onPress={onNext} variant="primary" style={styles.button} />
            </View>
          ) : (
            <View style={styles.errorContainer}>
              {error && <Text style={styles.errorText}>{error}</Text>}
              <FlynnButton
                title="Provision my Flynn number"
                onPress={handleProvisionNumber}
                variant="primary"
                style={styles.button}
                disabled={carrierDetectionState.status === 'loading'}
              />
              <FlynnButton title="Skip for now" onPress={onNext} variant="secondary" style={styles.button} />
            </View>
          )}

        </View>
      </FlynnKeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  keyboardContent: {
    flex: 1,
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
    width: '100%',
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
