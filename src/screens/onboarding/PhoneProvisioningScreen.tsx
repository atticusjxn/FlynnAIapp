import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { FlynnIcon } from '../../components/ui/FlynnIcon';
import { FlynnButton } from '../../components/ui/FlynnButton';
import { FlynnInput } from '../../components/ui/FlynnInput';
import { OnboardingHeader } from '../../components/onboarding/OnboardingHeader';
import { BillingPaywallModal } from '../../components/billing/BillingPaywallModal';
import { useOnboarding } from '../../context/OnboardingContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { TwilioService } from '../../services/TwilioService';
import {
  detectCarrierFromNumber,
  CarrierDetectionConfidence,
} from '../../services/CarrierDetectionService';
import { normalizeNumberForDetection, sanitizeDigits } from '../../utils/phone';
import { callForwardingGuides, CallForwardingGuide } from '../../data/callForwardingGuides';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { isPaidPlan } from '../../data/billingPlans';

interface PhoneProvisioningScreenProps {
  onNext: () => void;
  onBack: () => void;
}

const replaceForwardingPlaceholder = (
  code: string,
  forwardingNumber: string | null
) => {
  if (!forwardingNumber) {
    return code.replace('{forwarding}', 'your Flynn number');
  }

  const digits = sanitizeDigits(forwardingNumber);
  return code.replace('{forwarding}', digits || forwardingNumber);
};

const getDialableCode = (code: string, forwardingNumber: string | null) => {
  if (!forwardingNumber) return null;
  const digits = sanitizeDigits(forwardingNumber);
  if (!digits) return null;

  const replaced = code.replace('{forwarding}', digits);
  // Encode # for tel URLs while keeping * characters intact
  return replaced.replace(/#/g, '%23');
};

export const PhoneProvisioningScreen: React.FC<PhoneProvisioningScreenProps> = ({
  onNext,
  onBack,
}) => {
  const { colors: themeColors } = useTheme();
  const { user } = useAuth();
  const { updateOnboardingData, onboardingData, refreshOnboarding, organizationId } = useOnboarding();
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionedNumber, setProvisionedNumber] = useState<string | null>(
    onboardingData.twilioPhoneNumber || null
  );
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
  const hasPaidPlan = isPaidPlan(onboardingData.billingPlan);

  const normalizedForDetection = useMemo(
    () => normalizeNumberForDetection(phoneNumber),
    [phoneNumber],
  );

  // Auto-detect carrier as user types
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
              ? "Automatic detection requires Twilio Lookup credentials. We'll provision a number anyway."
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

  // Check if already provisioned on mount
  useEffect(() => {
    const checkExisting = async () => {
      if (user?.id) {
        try {
          const status = await TwilioService.getUserTwilioStatus();
          if (status.twilioPhoneNumber) {
            setProvisionedNumber(status.twilioPhoneNumber);
            updateOnboardingData({ twilioPhoneNumber: status.twilioPhoneNumber });
          }
        } catch (error) {
          console.error('[PhoneProvisioning] Failed to check existing number:', error);
        }
      }
    };
    void checkExisting();
  }, [user?.id]);

  const detectedCarrier = useMemo<CallForwardingGuide | null>(() => {
    if (
      carrierDetectionState.status !== 'success' ||
      !carrierDetectionState.carrierId
    ) {
      return null;
    }

    return (
      callForwardingGuides.find(
        (guide) => guide.id === carrierDetectionState.carrierId
      ) || null
    );
  }, [carrierDetectionState.status, carrierDetectionState.carrierId]);

  const forwardingCode = useMemo(() => {
    if (!detectedCarrier || !provisionedNumber) {
      return null;
    }

    // Find the "noAnswer" (forward when unanswered) code
    const noAnswerCode = detectedCarrier.codes.find(c => c.type === 'noAnswer');
    return noAnswerCode || detectedCarrier.codes[0];
  }, [detectedCarrier, provisionedNumber]);

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
        countryCode: carrierDetectionState.status === 'success' && carrierDetectionState.carrierId
          ? undefined // Will be inferred from carrier
          : undefined,
      });
      if (result && result.phoneNumber) {
        setProvisionedNumber(result.phoneNumber);
        updateOnboardingData({
          twilioPhoneNumber: result.phoneNumber,
          phoneNumber: carrierDetectionState.status === 'success'
            ? carrierDetectionState.e164Number || phoneNumber
            : phoneNumber,
          phoneSetupComplete: true,
        });
      } else {
        setError('Failed to provision a Twilio number.');
      }
    } catch (err: any) {
      console.error('[PhoneProvisioning] Error provisioning number:', err);
      setError(err.message || 'An unexpected error occurred during provisioning. Please try again.');
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleDialCode = async () => {
    if (!forwardingCode || !provisionedNumber) {
      Alert.alert(
        'Forwarding code unavailable',
        'Please provision your Flynn number first.'
      );
      return;
    }

    const dialable = getDialableCode(forwardingCode.code, provisionedNumber);

    if (!dialable) {
      Alert.alert(
        'Invalid forwarding code',
        'Unable to generate dialable code. Please dial manually.'
      );
      return;
    }

    const url = Platform.select({
      ios: `tel://${dialable}`,
      default: `tel:${dialable}`,
    });

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        throw new Error('Device cannot open dialer');
      }

      await Linking.openURL(url);
    } catch (error) {
      const fallback = replaceForwardingPlaceholder(forwardingCode.code, provisionedNumber);
      Alert.alert(
        'Dial this code manually',
        `${fallback}\n\nOpen the phone app, enter the code, then press call.`,
        [{ text: 'Got it' }]
      );
    }
  };

  const handleRefreshPlanStatus = async () => {
    setIsRefreshingPlan(true);
    try {
      await refreshOnboarding();
    } catch (refreshError) {
      console.error('[PhoneProvisioning] Failed to refresh onboarding state', refreshError);
      Alert.alert('Refresh Failed', 'Please reopen Flynn after paying so we can unlock provisioning.');
    } finally {
      setIsRefreshingPlan(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with back button and progress bar */}
      <OnboardingHeader currentStep={7} totalSteps={7} onBack={onBack} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleContainer}>
          <View style={styles.iconContainer}>
            <FlynnIcon name="call" size={32} color={themeColors.primary} />
          </View>
          <Text style={styles.title}>Get Your Flynn Number</Text>
          <Text style={styles.subtitle}>
            Enter your business phone number. We'll provision a Flynn number and show you how to forward missed calls.
          </Text>
        </View>

        <View style={styles.card}>
          <FlynnInput
            label="Your business phone number"
            placeholder="e.g. +61 4xx xxx xxx or 04xx xxx xxx"
            keyboardType="phone-pad"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            autoComplete="tel"
            required
            helperText={
              carrierDetectionState.status === 'success'
                ? `Detected ${carrierDetectionState.rawCarrierName ?? carrierDetectionState.carrierId}.`
                : carrierDetectionState.status === 'loading'
                  ? 'Checking your carrier...'
                  : undefined
            }
            errorText={carrierDetectionState.status === 'error' ? carrierDetectionState.message : undefined}
          />
        </View>

        {!hasPaidPlan && (
          <View style={styles.paywallCard}>
            <Text style={styles.paywallTitle}>Subscribe to unlock provisioning</Text>
            <Text style={styles.paywallDescription}>
              Base Plan ($79/mo) includes a dedicated Flynn number and summaries for up to 100
              missed calls. Upgrade to Max for 500 events each month.
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
              style={styles.refreshButton}
            />
          </View>
        )}

        {isProvisioning ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColors.primary} />
            <Text style={styles.loadingText}>Provisioning your number...</Text>
          </View>
        ) : provisionedNumber ? (
          <View style={styles.successContainer}>
            <View style={styles.successHeader}>
              <FlynnIcon name="checkmark-circle" size={48} color={colors.success} />
              <Text style={styles.successTitle}>Number Provisioned!</Text>
              <Text style={styles.provisionedNumber}>{provisionedNumber}</Text>
            </View>

            {detectedCarrier && forwardingCode && (
              <View style={styles.forwardingContainer}>
                <View style={styles.forwardingHeader}>
                  <FlynnIcon name="keypad" size={20} color={themeColors.primary} />
                  <Text style={styles.forwardingTitle}>
                    Forward missed calls to Flynn
                  </Text>
                </View>
                <Text style={styles.forwardingSubtext}>
                  Dial this code on your {detectedCarrier.name} phone to forward unanswered calls:
                </Text>
                
                <View style={styles.codeContainer}>
                  <Text style={styles.codeValue}>
                    {replaceForwardingPlaceholder(forwardingCode.code, provisionedNumber)}
                  </Text>
                  {forwardingCode.description && (
                    <Text style={styles.codeDescription}>
                      {forwardingCode.description}
                    </Text>
                  )}
                </View>

                <FlynnButton
                  title="Dial Now"
                  onPress={handleDialCode}
                  variant="primary"
                  fullWidth
                  icon={<FlynnIcon name="call" size={18} color={colors.white} />}
                  iconPosition="left"
                  style={styles.dialButton}
                />

                <View style={styles.noteContainer}>
                  <FlynnIcon name="sparkles" size={16} color={themeColors.primary} />
                  <Text style={styles.noteText}>
                    Wait for the confirmation tone before ending the call to ensure forwarding is activated.
                  </Text>
                </View>
              </View>
            )}

            <FlynnButton
              title="Continue"
              onPress={onNext}
              variant="primary"
              fullWidth
              style={styles.continueButton}
            />
          </View>
        ) : (
          <View style={styles.buttonContainer}>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <FlynnButton
              title={hasPaidPlan ? 'Get My Flynn Number' : 'Subscribe to continue'}
              onPress={handleProvisionNumber}
              variant="primary"
              fullWidth
              disabled={carrierDetectionState.status === 'loading'}
            />
          </View>
        )}
      </ScrollView>

      <BillingPaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        customerEmail={user?.email ?? undefined}
        organizationId={organizationId}
        onSubscriptionCreated={async () => {
          console.log('[PhoneProvisioning] Subscription created, refreshing onboarding data');
          await refreshOnboarding();
          setPaywallVisible(false);
        }}
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
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.black,
    marginBottom: spacing.lg,
  },
  successHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  successTitle: {
    ...typography.h3,
    color: colors.success,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  provisionedNumber: {
    ...typography.h4,
    color: colors.gray900,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  forwardingContainer: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  forwardingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  forwardingTitle: {
    ...typography.h4,
    color: colors.gray900,
  },
  forwardingSubtext: {
    ...typography.bodyMedium,
    color: colors.gray700,
    marginBottom: spacing.md,
  },
  codeContainer: {
    backgroundColor: colors.gray50,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  codeValue: {
    ...typography.h4,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    color: colors.gray900,
    marginBottom: spacing.xs,
  },
  codeDescription: {
    ...typography.bodySmall,
    color: colors.gray600,
  },
  dialButton: {
    marginBottom: spacing.md,
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  noteText: {
    ...typography.bodySmall,
    color: colors.primary,
    flex: 1,
  },
  continueButton: {
    marginTop: spacing.md,
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
  refreshButton: {
    marginTop: spacing.sm,
  },
});

