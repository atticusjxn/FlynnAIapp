import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { FlynnButton } from '../../components/ui/FlynnButton';
import {
  bootstrap as bootstrapPlay,
  attachListeners as attachPlayListeners,
  purchase as purchasePlay,
  type PlayProductId,
} from '../../services/PlayBillingService';

const TOTAL_STEPS = 7;
const CURRENT_STEP = 5;

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$29/mo',
    detail: '60 min AI / month',
    description: 'Perfect for solo operators handling a handful of calls per day.',
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '$79/mo',
    detail: '250 min AI / month + voice clone',
    description: 'Ideal for growing businesses fielding more regular call volume.',
    highlighted: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$179/mo',
    detail: '700 min AI / month + voice clone, priority support',
    description: 'Best for high-volume businesses who need maximum coverage.',
  },
] as const;

interface Props {
  onNext: () => void;
  onBack: () => void;
}

const PRODUCT_ID_BY_PLAN: Record<string, PlayProductId> = {
  starter: 'com.flynnai.starter.monthly',
  growth: 'com.flynnai.growth.monthly',
  pro: 'com.flynnai.pro.monthly',
};

export const PaywallOnboardingScreen: React.FC<Props> = ({ onNext, onBack }) => {
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState<string>('growth');
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    bootstrapPlay().catch((err) =>
      console.warn('[Paywall] Play Billing bootstrap failed:', err.message)
    );
    const detach = attachPlayListeners({
      onSuccess: () => {
        setPurchasing(false);
        onNext();
      },
      onError: (err) => {
        setPurchasing(false);
        Alert.alert('Subscription failed', err.message);
      },
    });
    return detach;
  }, [onNext]);

  const handleStartTrial = async () => {
    if (Platform.OS === 'android') {
      const productId = PRODUCT_ID_BY_PLAN[selectedPlan];
      if (!productId) return;
      try {
        setPurchasing(true);
        await purchasePlay(productId);
      } catch (err) {
        setPurchasing(false);
        Alert.alert('Subscription failed', (err as Error).message);
      }
      return;
    }
    // iOS path is owned by native Swift PaywallStepView (rendered separately).
    // For the React Native paywall on iOS (web/dev fallback) just advance.
    onNext();
  };

  const selected = PLANS.find(p => p.id === selectedPlan);

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

        <Text style={styles.heading}>Your agent is ready — unlock it</Text>
        <Text style={styles.subtitle}>
          14-day free trial. Cancel any time. No charge today.
        </Text>

        {/* Plan cards */}
        <View style={styles.plansContainer}>
          {PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            return (
              <TouchableOpacity
                key={plan.id}
                style={[
                  styles.planCard,
                  isSelected && styles.planCardSelected,
                  plan.highlighted && !isSelected && styles.planCardHighlighted,
                ]}
                onPress={() => setSelectedPlan(plan.id)}
                activeOpacity={0.8}
              >
                {plan.highlighted && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>Most popular</Text>
                  </View>
                )}
                <View style={styles.planHeader}>
                  <Text style={[styles.planName, isSelected && styles.planNameSelected]}>
                    {plan.name}
                  </Text>
                  <View style={styles.planPricing}>
                    <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>
                      {plan.price}
                    </Text>
                    <Text style={[styles.planDetail, isSelected && styles.planDetailSelected]}>
                      {plan.detail}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.planDescription, isSelected && styles.planDescriptionSelected]}>
                  {plan.description}
                </Text>
                {isSelected && (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* CTA */}
        <View style={[styles.ctaGroup, { paddingBottom: insets.bottom }]}>
          <FlynnButton
            title={purchasing ? 'Opening Play Store…' : `Start free trial — ${selected?.price ?? ''}`}
            onPress={handleStartTrial}
            variant="primary"
            size="large"
            fullWidth
            disabled={purchasing}
          />
          <TouchableOpacity onPress={onNext} style={styles.skipBtn}>
            <Text style={styles.skipText}>
              Skip for now — use SMS links (free)
            </Text>
          </TouchableOpacity>
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
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  plansContainer: { gap: spacing.md, marginBottom: spacing.lg },
  planCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.gray200,
    position: 'relative',
    ...shadows.sm,
  },
  planCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  planCardHighlighted: {
    borderColor: colors.gray400,
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  popularBadgeText: { ...typography.caption, color: colors.white, fontWeight: '700' },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  planName: { ...typography.h3, color: colors.textPrimary },
  planNameSelected: { color: colors.primary },
  planPricing: { alignItems: 'flex-end' },
  planPrice: { ...typography.h4, color: colors.textPrimary },
  planPriceSelected: { color: colors.primary },
  planDetail: { ...typography.bodySmall, color: colors.textSecondary },
  planDetailSelected: { color: colors.primary },
  planDescription: { ...typography.bodySmall, color: colors.textSecondary },
  planDescriptionSelected: { color: colors.textPrimary },
  checkmark: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  ctaGroup: { gap: spacing.sm },
  skipBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  skipText: { ...typography.bodyMedium, color: colors.textSecondary },
});
