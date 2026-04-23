import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { FlynnButton } from '../../components/ui/FlynnButton';
import { useAuth } from '../../context/AuthContext';
import { useOnboarding } from '../../context/OnboardingContext';
import { supabase } from '../../services/supabase';

const TOTAL_STEPS = 7;
const CURRENT_STEP = 6;

const FORWARDING_STEPS = [
  {
    num: '1',
    title: 'Open your Phone app',
    body: 'Go to your default dialler.',
  },
  {
    num: '2',
    title: 'Dial the forwarding code',
    body: 'Type *004*[your Flynn number]# and press call. Your carrier will confirm.',
  },
  {
    num: '3',
    title: 'Test it',
    body: 'Ask someone to call your mobile number. Flynn should answer within 2 rings.',
  },
];

interface Props {
  onNext: () => void;
  onBack: () => void;
}

export const PhoneNumberScreen: React.FC<Props> = ({ onNext, onBack }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { completeOnboarding } = useOnboarding();
  const [hasPhone, setHasPhone] = useState<boolean | null>(null);
  const [flynnNumber, setFlynnNumber] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    const checkPhone = async () => {
      // Quick check from user metadata first
      const metaHasPhone = user?.user_metadata?.has_provisioned_phone;
      if (metaHasPhone) {
        setHasPhone(true);
        setFlynnNumber(user?.user_metadata?.phone_number ?? null);
        return;
      }
      // Fallback: query DB
      try {
        const { data } = await supabase
          .from('users')
          .select('phone_number, has_provisioned_phone')
          .eq('id', user?.id)
          .single();
        if (data?.has_provisioned_phone) {
          setHasPhone(true);
          setFlynnNumber(data.phone_number ?? null);
        } else {
          setHasPhone(false);
        }
      } catch {
        setHasPhone(false);
      }
    };
    checkPhone();
  }, [user, supabase]);

  const handleGoLive = async () => {
    setCompleting(true);
    try {
      await completeOnboarding();
    } catch (e) {
      console.error('Error completing onboarding:', e);
    } finally {
      setCompleting(false);
      onNext();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress */}
        <View style={styles.progressRow}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={[styles.progressCapsule, i < CURRENT_STEP && styles.progressCapsuleFilled]}
            />
          ))}
        </View>

        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.heading}>Forward your calls to Flynn</Text>
        <Text style={styles.subtitle}>
          Set up call forwarding so Flynn answers when you're busy.
        </Text>

        {/* Phone status */}
        {hasPhone === null && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Checking your account…</Text>
          </View>
        )}

        {hasPhone === true && (
          <View style={styles.connectedCard}>
            <Text style={styles.connectedIcon}>✅</Text>
            <View style={styles.connectedText}>
              <Text style={styles.connectedTitle}>Already connected</Text>
              <Text style={styles.connectedBody}>
                Your Flynn number is active
                {flynnNumber ? `: ${flynnNumber}` : ''}.
              </Text>
            </View>
          </View>
        )}

        {hasPhone === false && (
          <View style={styles.instructionsCard}>
            <Text style={styles.instructionsTitle}>Set up call forwarding</Text>
            {FORWARDING_STEPS.map((step) => (
              <View key={step.num} style={styles.step}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{step.num}</Text>
                </View>
                <View style={styles.stepBody}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepText}>{step.body}</Text>
                </View>
              </View>
            ))}
            <View style={styles.codeBox}>
              <Text style={styles.codeBoxLabel}>Forwarding code (most carriers)</Text>
              <Text style={styles.codeBoxValue}>*004*[Flynn number]#</Text>
            </View>
            <Text style={styles.carrierNote}>
              Exact codes vary by carrier. Check Settings → Calls for carrier-specific instructions.
            </Text>
          </View>
        )}

        {/* CTA */}
        <View style={[styles.ctaGroup, { marginTop: spacing.xl }]}>
          <FlynnButton
            title={completing ? 'Setting up…' : "I'm ready — go live"}
            onPress={handleGoLive}
            variant="primary"
            size="large"
            fullWidth
            disabled={completing}
          />
          {completing && (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.sm }} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  progressRow: { flexDirection: 'row', gap: spacing.xxs, marginBottom: spacing.lg },
  progressCapsule: {
    flex: 1,
    height: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray200,
  },
  progressCapsuleFilled: { backgroundColor: colors.primary },
  backBtn: { minHeight: 44, justifyContent: 'center', marginBottom: spacing.md },
  backText: { ...typography.bodyMedium, color: colors.textSecondary },
  heading: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  loadingText: { ...typography.bodyMedium, color: colors.textSecondary },
  connectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  connectedIcon: { fontSize: 28 },
  connectedText: { flex: 1 },
  connectedTitle: { ...typography.h4, color: colors.success, marginBottom: 2 },
  connectedBody: { ...typography.bodyMedium, color: colors.textSecondary },
  instructionsCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  instructionsTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.md },
  step: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'flex-start',
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepBadgeText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  stepBody: { flex: 1 },
  stepTitle: { ...typography.label, color: colors.textPrimary, marginBottom: 2 },
  stepText: { ...typography.bodySmall, color: colors.textSecondary },
  codeBox: {
    backgroundColor: colors.gray100,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  codeBoxLabel: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: 4 },
  codeBoxValue: {
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  carrierNote: { ...typography.bodySmall, color: colors.textTertiary, textAlign: 'center' },
  ctaGroup: { gap: spacing.sm },
});
