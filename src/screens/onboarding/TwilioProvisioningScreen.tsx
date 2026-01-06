import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { FlynnIcon } from '../../components/ui/FlynnIcon';
import { useOnboarding } from '../../context/OnboardingContext';
import { TwilioService } from '../../services/TwilioService';
import { useAuth } from '../../context/AuthContext';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { FlynnButton } from '../../components/ui/FlynnButton';
import { FlynnInput } from '../../components/ui/FlynnInput';
import { BillingPaywallModal } from '../../components/billing/BillingPaywallModal';
import { isPaidPlan } from '../../data/billingPlans';
import {
  detectCarrierFromNumber,
  CarrierDetectionConfidence,
} from '../../services/CarrierDetectionService';
import { normalizeNumberForDetection, carrierIdToIsoCountry, inferIsoCountryFromNumber } from '../../utils/phone';

interface TwilioProvisioningScreenProps {
  onNext: () => void;
  onBack: () => void;
}

export const TwilioProvisioningScreen: React.FC<TwilioProvisioningScreenProps> = ({
  onNext,
  onBack,
}) => {
  const { user } = useAuth();
  const { updateOnboardingData, onboardingData, refreshOnboarding, organizationId } = useOnboarding();
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionedNumber, setProvisionedNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [isRefreshingPlan, setIsRefreshingPlan] = useState(false);
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
  const hasPaidPlan = isPaidPlan(onboardingData.billingPlan);

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

  // NOTE: Disabled automatic persistence of carrier detection to avoid triggering
  // auth state refresh (USER_UPDATED) which causes the screen to remount and lose input.
  // Carrier info is already passed to provisionPhoneNumber() when the user clicks Provision.
  // useEffect(() => {
  //   if (carrierDetectionState.status !== 'success' || !carrierDetectionState.carrierId || !detectionSignature) {
  //     return;
  //   }
  //   if (detectionSignature === lastPersistedDetection.current) {
  //     return;
  //   }
  //   const normalized = normalizedForDetection || phoneNumber;
  //   TwilioService.persistCarrierDetection(normalized, {
  //     carrierId: carrierDetectionState.carrierId,
  //     confidence: carrierDetectionState.confidence || 'low',
  //     source: carrierDetectionState.source || 'heuristic',
  //     rawCarrierName: carrierDetectionState.rawCarrierName ?? undefined,
  //     e164Number: carrierDetectionState.e164Number ?? undefined,
  //   }).finally(() => {
  //     lastPersistedDetection.current = detectionSignature;
  //   });
  // }, [carrierDetectionState, normalizedForDetection, phoneNumber, detectionSignature]);

  const handleProvisionNumber = async () => {
    if (!hasPaidPlan) {
      setPaywallVisible(true);
      return;
    }

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
        // Success state is shown inline in the UI (lines 338-344)
        // User can tap "Continue" button to proceed to next screen
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

  const handleRefreshPlanStatus = async () => {
    setIsRefreshingPlan(true);
    try {
      await refreshOnboarding();
    } catch (refreshError) {
      console.error('[TwilioProvisioningScreen] Failed to refresh onboarding state', refreshError);
      Alert.alert('Refresh Failed', 'Please reopen Flynn after paying so we can unlock provisioning.');
    } finally {
      setIsRefreshingPlan(false);
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
      {/* Header with back button and progress bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <FlynnIcon name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={styles.progressBar} />
          <View style={styles.progressBar} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleContainer}>
          <View style={styles.iconContainer}>
            <FlynnIcon name="call" size={32} color={colors.primary} />
          </View>
          <Text style={styles.title}>Your Flynn Business Number</Text>
          <Text style={styles.subtitle}>
            Let Flynn handle your voicemails and turn them into job cards. Tell us the mobile number you answer today and we'll provision a matching country code automatically.
          </Text>
        </View>

        <View style={styles.card}>
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
        </View>

        {!hasPaidPlan && (
          <View style={styles.paywallCard}>
            <Text style={styles.paywallTitle}>Subscribe to unlock provisioning</Text>
            <Text style={styles.paywallDescription}>
              Concierge Basic ($49/mo) includes a dedicated Flynn number and summaries for up to 100
              missed calls. Upgrade to Growth for 500 events each month.
            </Text>
            <FlynnButton
              title="View concierge plans"
              onPress={() => setPaywallVisible(true)}
              variant="secondary"
              fullWidth
            />
            <FlynnButton
              title="I've subscribed – refresh access"
              onPress={handleRefreshPlanStatus}
              variant="ghost"
              fullWidth
              loading={isRefreshingPlan}
            />
          </View>
        )}

        {isProvisioning ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Provisioning your number...</Text>
          </View>
        ) : provisionedNumber ? (
          <View style={styles.successContainer}>
            <FlynnIcon name="checkmark-circle-outline" size={48} color={colors.success} />
            <Text style={styles.successText}>Number Provisioned!</Text>
            <Text style={styles.provisionedNumber}>{provisionedNumber}</Text>
            <FlynnButton title="Continue" onPress={onNext} variant="primary" style={styles.button} />
          </View>
        ) : (
          <View style={styles.buttonContainer}>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <FlynnButton
              title={hasPaidPlan ? 'Provision my Flynn number' : 'Subscribe to continue'}
              onPress={handleProvisionNumber}
              variant="primary"
              fullWidth
              disabled={carrierDetectionState.status === 'loading'}
            />
            <FlynnButton
              title="Skip for now"
              onPress={onNext}
              variant="secondary"
              fullWidth
              style={styles.skipButton}
            />
          </View>
        )}
      </ScrollView>

      <BillingPaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        customerEmail={user?.email ?? undefined}
        organizationId={organizationId}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  backButton: {
    marginRight: spacing.md,
  },
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.gray200,
    borderRadius: borderRadius.xs,
  },
  progressActive: {
    backgroundColor: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.black,
  },
  title: {
    ...typography.h2,
    color: colors.gray900,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.gray600,
    marginBottom: spacing.md,
    textAlign: 'center',
    lineHeight: 24,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.black,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.bodyMedium,
    marginTop: spacing.md,
    color: colors.gray600,
  },
  successContainer: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.black,
  },
  successText: {
    ...typography.h3,
    color: colors.success,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  provisionedNumber: {
    ...typography.h4,
    color: colors.gray900,
    marginBottom: spacing.xl,
  },
  buttonContainer: {
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.bodyMedium,
    color: colors.error,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.md,
  },
  skipButton: {
    marginTop: spacing.sm,
  },
  paywallCard: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  paywallTitle: {
    ...typography.h4,
    color: colors.primary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  paywallDescription: {
    ...typography.bodyMedium,
    color: colors.gray700,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});
