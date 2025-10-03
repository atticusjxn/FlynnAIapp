import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOnboarding } from '../../context/OnboardingContext';
import {
  callForwardingGuides,
  CallForwardingGuide,
  CarrierForwardingCode,
} from '../../data/callForwardingGuides';
import { TwilioService } from '../../services/TwilioService';
import {
  detectCarrierFromNumber,
  CarrierDetectionConfidence,
} from '../../services/CarrierDetectionService';
import { sanitizeDigits, normalizeNumberForDetection } from '../../utils/phone';

interface CarrierSetupScreenProps {
  onNext: () => void;
  onBack: () => void;
}

const DEFAULT_CARRIER_COUNT = 3;

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

export const CarrierSetupScreen: React.FC<CarrierSetupScreenProps> = ({
  onNext,
  onBack,
}) => {
  const { updateOnboardingData, onboardingData } = useOnboarding();
  const [phoneNumber, setPhoneNumber] = useState(onboardingData.phoneNumber || '');
  const [selectedCarrierId, setSelectedCarrierId] = useState(
    callForwardingGuides[0]?.id || ''
  );
  const [isVerifying, setIsVerifying] = useState(false);
  const [showAllCarriers, setShowAllCarriers] = useState(false);
  const [carrierDetectionState, setCarrierDetectionState] = useState<{
    status: 'idle' | 'loading' | 'success' | 'none' | 'error';
    carrierId?: string;
    confidence?: CarrierDetectionConfidence;
    message?: string;
    rawCarrierName?: string | null;
    source?: 'lookup' | 'heuristic';
    e164Number?: string | null;
  }>({ status: 'idle' });
  const [hasManualCarrierOverride, setHasManualCarrierOverride] = useState(false);
  const detectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPersistedDetection = useRef<string | null>(null);

  useEffect(() => {
    if (!phoneNumber && onboardingData.phoneNumber) {
      setPhoneNumber(onboardingData.phoneNumber);
    }
  }, [onboardingData.phoneNumber]);

  useEffect(() => {
    if (detectionTimeoutRef.current) {
      clearTimeout(detectionTimeoutRef.current);
    }

    const normalized = normalizeNumberForDetection(phoneNumber);

    if (!normalized || normalized.length < 8) {
      setCarrierDetectionState({ status: 'idle' });
      return;
    }

    setCarrierDetectionState((prev) =>
      prev.status === 'loading' && prev.carrierId ? prev : { status: 'loading' }
    );

    let cancelled = false;

    detectionTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await detectCarrierFromNumber(normalized);

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
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error && error.message === 'LOOKUP_DISABLED'
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
  }, [phoneNumber]);

  const selectedCarrier = useMemo<CallForwardingGuide | undefined>(
    () => callForwardingGuides.find((carrier) => carrier.id === selectedCarrierId),
    [selectedCarrierId]
  );

  useEffect(() => {
    if (
      carrierDetectionState.status !== 'success' ||
      !carrierDetectionState.carrierId ||
      carrierDetectionState.source !== 'lookup'
    ) {
      return;
    }

    if (!hasManualCarrierOverride) {
      if (selectedCarrierId !== carrierDetectionState.carrierId) {
        setSelectedCarrierId(carrierDetectionState.carrierId);
      }

      if (!showAllCarriers) {
        const detectedIndex = callForwardingGuides.findIndex(
          (guide) => guide.id === carrierDetectionState.carrierId
        );

        if (detectedIndex >= DEFAULT_CARRIER_COUNT) {
          setShowAllCarriers(true);
        }
      }
    }
  }, [
    carrierDetectionState.status,
    carrierDetectionState.carrierId,
    hasManualCarrierOverride,
    selectedCarrierId,
    showAllCarriers,
  ]);

  useEffect(() => {
    if (
      carrierDetectionState.status === 'success' &&
      carrierDetectionState.carrierId &&
      carrierDetectionState.source === 'lookup' &&
      hasManualCarrierOverride &&
      carrierDetectionState.carrierId === selectedCarrierId
    ) {
      setHasManualCarrierOverride(false);
    }
  }, [
    carrierDetectionState.status,
    carrierDetectionState.carrierId,
    hasManualCarrierOverride,
    selectedCarrierId,
  ]);

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

  const handleDialCode = async (code: CarrierForwardingCode) => {
    const dialable = getDialableCode(code.code, onboardingData.twilioPhoneNumber ?? null);

    if (!onboardingData.twilioPhoneNumber || !dialable) {
      Alert.alert(
        'Flynn number unavailable',
        'Please provision your Flynn business number first.'
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
      const fallback = replaceForwardingPlaceholder(code.code, onboardingData.twilioPhoneNumber ?? null);
      Alert.alert(
        'Dial this code manually',
        `${fallback}\n\nOpen the phone app, enter the code, then press call.`,
        [{ text: 'Got it' }]
      );
    }
  };

  const handlePhoneNumberChange = (value: string) => {
    setPhoneNumber(value);
  };

  const handleCarrierSelect = (carrierId: string) => {
    setSelectedCarrierId(carrierId);

    if (
      carrierDetectionState.status === 'success' &&
      carrierDetectionState.carrierId === carrierId
    ) {
      setHasManualCarrierOverride(false);
    } else {
      setHasManualCarrierOverride(true);
    }
  };

  const handleUseDetectedCarrier = () => {
    if (
      carrierDetectionState.status === 'success' &&
      carrierDetectionState.carrierId
    ) {
      setHasManualCarrierOverride(false);
      setSelectedCarrierId(carrierDetectionState.carrierId);
      if (!showAllCarriers) {
        const detectedIndex = callForwardingGuides.findIndex(
          (guide) => guide.id === carrierDetectionState.carrierId
        );
        if (detectedIndex >= DEFAULT_CARRIER_COUNT) {
          setShowAllCarriers(true);
        }
      }
    }
  };

  useEffect(() => {
    if (
      carrierDetectionState.status !== 'success' ||
      !carrierDetectionState.carrierId ||
      carrierDetectionState.source !== 'lookup'
    ) {
      return;
    }

    const normalized = normalizeNumberForDetection(phoneNumber) || phoneNumber;
    const signature = `${carrierDetectionState.carrierId}:${carrierDetectionState.source || 'unknown'}:${carrierDetectionState.rawCarrierName || ''}:${normalized}`;

    if (lastPersistedDetection.current === signature) {
      return;
    }

    TwilioService.persistCarrierDetection(normalized, {
      carrierId: carrierDetectionState.carrierId,
      confidence: carrierDetectionState.confidence || 'low',
      source: carrierDetectionState.source || 'heuristic',
      rawCarrierName: carrierDetectionState.rawCarrierName ?? undefined,
      e164Number: carrierDetectionState.e164Number ?? undefined,
    }).finally(() => {
      lastPersistedDetection.current = signature;
    });
  }, [carrierDetectionState, phoneNumber]);

  const handleMarkVerified = () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Add your number', 'Enter the business number you forward.');
      return;
    }

    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      updateOnboardingData({ phoneSetupComplete: true, phoneNumber: phoneNumber });
      Alert.alert(
        'Forwarding verified',
        'Great! Flynn will intake your voicemails and convert them to job cards. You can update this any time from Settings.',
        [{ text: 'Continue', onPress: onNext }]
      );
    }, 1000);
  };

  const handleSkip = () => {
    updateOnboardingData({ phoneSetupComplete: false });
    onNext();
  };

  const carriersToShow = useMemo(() => {
    if (showAllCarriers) {
      return callForwardingGuides;
    }
    return callForwardingGuides.slice(0, DEFAULT_CARRIER_COUNT);
  }, [showAllCarriers]);

  const formattedForwardingNumber = useMemo(() => {
    if (!onboardingData.twilioPhoneNumber) {
      return 'Provision a Flynn number to unlock forwarding instructions.';
    }

    return onboardingData.twilioPhoneNumber;
  }, [onboardingData.twilioPhoneNumber]);


  const steps = [
    {
      title: 'Forward missed calls',
      description:
        selectedCarrier
          ? `Dial the ${selectedCarrier.name} code below to forward no-answer calls to Flynn.`
          : 'Choose your carrier to view the correct forwarding code.',
      icon: 'call-outline' as const,
    },
    {
      title: 'Leave a quick voicemail',
      description:
        'Call your business number and let it go to voicemail. Flynn will transcribe and build a job card.',
      icon: 'mic-outline' as const,
    },
    {
      title: 'Review and confirm',
      description:
        'Approve the drafted follow-up message and schedule items from the new job card.',
      icon: 'checkmark-done-outline' as const,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#3B82F6" />
        </TouchableOpacity>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={styles.progressBar} />
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleContainer}>
          <View style={styles.iconContainer}>
            <Ionicons name="call" size={32} color="#3B82F6" />
          </View>
          <Text style={styles.title}>Forward missed calls to Flynn</Text>
          <Text style={styles.subtitle}>
            Route unanswered calls to your Flynn voicemail box so every lead becomes a job card with AI summaries and suggested follow-ups.
          </Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoCardHeader}>
            <View style={styles.infoCardIcon}>
              <Ionicons name="shield-checkmark" size={20} color="#2563eb" />
            </View>
            <Text style={styles.infoCardTitle}>Your Flynn voicemail number</Text>
          </View>
          <View style={styles.infoCardBody}>
            <Text
              style={[
                styles.forwardingNumber,
                !onboardingData.twilioPhoneNumber && styles.forwardingNumberPlaceholder,
              ]}
            >
              {formattedForwardingNumber}
            </Text>
            <Text style={styles.infoCardHint}>
              Use this value when dialing your carrier code. Flynn captures voicemails from this number, transcribes them, and creates job cards automatically.
            </Text>
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.sectionLabel}>Your business phone number</Text>
          <TextInput
            style={styles.input}
            placeholder="04 1234 5678"
            value={phoneNumber}
            onChangeText={handlePhoneNumberChange}
            keyboardType="phone-pad"
            autoCorrect={false}
            placeholderTextColor="#9ca3af"
          />
          <Text style={styles.inputHelper}>
            Flynn uses this to recommend the right forwarding instructions.
          </Text>
        </View>

        <View style={styles.carrierContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Choose your carrier</Text>
            <Text style={styles.sectionSubtext}>
              Flynn provides step-by-step instructions for popular networks. Pick the one that matches your business phone.
            </Text>
          </View>

          {carrierDetectionState.status === 'loading' && (
            <View style={[styles.detectionBanner, styles.detectionBannerNeutral]}>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={styles.detectionText}>Checking who provides this line…</Text>
            </View>
          )}

        {carrierDetectionState.status === 'success' && detectedCarrier && (
          <View style={[styles.detectionBanner, styles.detectionBannerSuccess]}>
            <Ionicons name="sparkles" size={18} color="#166534" />
            <View style={styles.detectionTextWrapper}>
              <Text style={styles.detectionText}>
                {carrierDetectionState.source === 'lookup'
                  ? `We confirmed via network lookup that this number runs on ${detectedCarrier.name}.`
                  : `We couldn't confirm automatically, but this number range typically uses ${detectedCarrier.name}. Please double-check before dialing.`}
              </Text>
              {carrierDetectionState.source === 'lookup' &&
                carrierDetectionState.rawCarrierName && (
                  <Text style={styles.detectionFootnote}>
                    Carrier record: {carrierDetectionState.rawCarrierName}
                  </Text>
                )}
              {hasManualCarrierOverride &&
                selectedCarrierId !== detectedCarrier.id && (
                  <TouchableOpacity
                    onPress={handleUseDetectedCarrier}
                    style={styles.detectionAction}
                  >
                    <Ionicons name="flash" size={14} color="#166534" />
                    <Text style={styles.detectionActionText}>Use suggestion</Text>
                  </TouchableOpacity>
                )}
            </View>
          </View>
        )}

          {carrierDetectionState.status === 'none' && (
            <View style={[styles.detectionBanner, styles.detectionBannerNeutral]}>
              <Ionicons name="information-circle" size={18} color="#1d4ed8" />
              <Text style={styles.detectionText}>
                We couldn't match the carrier automatically. Choose it from the list below.
              </Text>
            </View>
          )}

          {carrierDetectionState.status === 'error' && (
            <View style={[styles.detectionBanner, styles.detectionBannerError]}>
              <Ionicons name="alert-circle" size={18} color="#991b1b" />
              <Text style={styles.detectionText}>
                {carrierDetectionState.message ||
                  'Carrier lookup failed. Pick your provider below.'}
              </Text>
            </View>
          )}

          <View style={styles.carrierList}>
            {carriersToShow.map((carrier) => (
              <TouchableOpacity
                key={carrier.id}
                style={[
                  styles.carrierChip,
                  carrier.id === selectedCarrierId && styles.carrierChipSelected,
                ]}
                onPress={() => handleCarrierSelect(carrier.id)}
              >
                <Text style={styles.carrierName}>{carrier.name}</Text>
                <Text style={styles.carrierRegion}>{carrier.region}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {!showAllCarriers && callForwardingGuides.length > DEFAULT_CARRIER_COUNT && (
            <TouchableOpacity
              style={styles.showMoreButton}
              onPress={() => setShowAllCarriers(true)}
            >
              <Ionicons name="add-circle-outline" size={18} color="#2563eb" />
              <Text style={styles.showMoreText}>Show more carriers</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.stepsCard}>
          <View style={styles.stepsHeader}>
            <Ionicons name="trail-sign-outline" size={20} color="#2563eb" />
            <Text style={styles.sectionLabel}>Forwarding checklist</Text>
          </View>

          {steps.map((step, index) => (
            <View key={step.title} style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{index + 1}</Text>
              </View>
              <View style={styles.stepContent}>
                <View style={styles.stepTitleRow}>
                  <Ionicons name={step.icon} size={18} color="#2563eb" />
                  <Text style={styles.stepTitle}>{step.title}</Text>
                </View>
                <Text style={styles.stepDescription}>{step.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {selectedCarrier && (
          <View style={styles.codesCard}>
            <View style={styles.codesHeader}>
              <Ionicons name="keypad-outline" size={20} color="#2563eb" />
              <Text style={styles.sectionLabel}>
                Dial codes for {selectedCarrier.name}
              </Text>
            </View>
            <Text style={styles.sectionSubtext}>
              Enter these in your phone app, then press call. Replace {`'{forwarding}'`} with your Flynn number digits.
            </Text>

            {selectedCarrier.codes.map((carrierCode) => {
              const displayCode = replaceForwardingPlaceholder(
                carrierCode.code,
                onboardingData.twilioPhoneNumber ?? null
              );

              return (
                <View key={carrierCode.label} style={styles.codeRow}>
                  <View style={styles.codeInfo}>
                    <Text style={styles.codeLabel}>{carrierCode.label}</Text>
                    <Text style={styles.codeValue}>{displayCode}</Text>
                    {carrierCode.description && (
                      <Text style={styles.codeDescription}>
                        {carrierCode.description}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.codeAction,
                      (!onboardingData.twilioPhoneNumber || carrierCode.type === 'all') &&
                        styles.codeActionDisabled,
                    ]}
                    disabled={!onboardingData.twilioPhoneNumber || carrierCode.type === 'all'}
                    onPress={() => handleDialCode(carrierCode)}
                  >
                    <Ionicons name="call" size={18} color="white" />
                    <Text style={styles.codeActionText}>Dial</Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {selectedCarrier.notes && (
              <View style={styles.notesContainer}>
                <Ionicons name="sparkles-outline" size={16} color="#2563eb" />
                <Text style={styles.notesText}>{selectedCarrier.notes}</Text>
              </View>
            )}

            {selectedCarrier.supportUrl && (
              <TouchableOpacity
                style={styles.supportLink}
                onPress={() => Linking.openURL(selectedCarrier.supportUrl!)}
              >
                <Text style={styles.supportLinkText}>View official carrier help</Text>
                <Ionicons name="open-outline" size={16} color="#2563eb" />
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.primaryButton, isVerifying && styles.disabledButton]}
            onPress={handleMarkVerified}
            disabled={isVerifying}
          >
            {isVerifying ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Mark forwarding verified</Text>
                <Ionicons name="checkmark-circle" size={20} color="white" />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleSkip}>
            <Text style={styles.secondaryButtonText}>Set this up later</Text>
          </TouchableOpacity>

          <Text style={styles.footerText}>
            You can reopen these instructions under Settings → Calls & Voicemail.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  backButton: {
    marginRight: 16,
  },
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
  },
  progressActive: {
    backgroundColor: '#3B82F6',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingBottom: 160,
  },
  titleContainer: {
    paddingBottom: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 22,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  infoCardBody: {
    gap: 8,
  },
  forwardingNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  forwardingNumberPlaceholder: {
    color: '#6b7280',
    fontWeight: '500',
  },
  infoCardHint: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  inputContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  sectionSubtext: {
    marginTop: 6,
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#1f2937',
    marginTop: 12,
    marginBottom: 8,
  },
  inputHelper: {
    fontSize: 14,
    color: '#6b7280',
  },
  carrierContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  detectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  detectionBannerNeutral: {
    backgroundColor: '#dbeafe',
  },
  detectionBannerSuccess: {
    backgroundColor: '#dcfce7',
  },
  detectionBannerError: {
    backgroundColor: '#fee2e2',
  },
  detectionTextWrapper: {
    flex: 1,
    gap: 6,
  },
  detectionText: {
    color: '#1f2937',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  detectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detectionActionText: {
    color: '#166534',
    fontWeight: '600',
    fontSize: 13,
  },
  detectionFootnote: {
    fontSize: 12,
    color: '#166534',
  },
  carrierList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  carrierChip: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: '45%',
  },
  carrierChipSelected: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  carrierName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  carrierRegion: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 6,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2563eb',
  },
  stepsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  stepsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stepBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepBadgeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563eb',
  },
  stepContent: {
    flex: 1,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  stepDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  codesCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  codesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  codeInfo: {
    flex: 1,
    paddingRight: 12,
  },
  codeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  codeValue: {
    fontSize: 16,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    color: '#111827',
    marginBottom: 4,
  },
  codeDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  codeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  codeActionDisabled: {
    backgroundColor: '#cbd5f5',
  },
  codeActionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  notesText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    flex: 1,
  },
  supportLink: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  supportLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  buttonContainer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    marginTop: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  secondaryButtonText: {
    color: '#6b7280',
    fontSize: 16,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
  },
});
