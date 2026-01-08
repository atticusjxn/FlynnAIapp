import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { FlynnIcon } from '../../components/ui/FlynnIcon';
import { FlynnButton } from '../../components/ui/FlynnButton';
import { BillingPaywallModal } from '../../components/billing/BillingPaywallModal';
import { useOnboarding } from '../../context/OnboardingContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { billingPlans, BillingPlanDefinition } from '../../data/billingPlans';
import { colors, typography, spacing, borderRadius } from '../../theme';

interface FreeTrialSignupScreenProps {
  onNext: () => void;
  onBack: () => void;
}

export const FreeTrialSignupScreen: React.FC<FreeTrialSignupScreenProps> = ({
  onNext,
  onBack,
}) => {
  const { colors: themeColors } = useTheme();
  const { user } = useAuth();
  const { updateOnboardingData, onboardingData, organizationId, refreshOnboarding } = useOnboarding();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<BillingPlanDefinition | null>(null);
  const [isRefreshingPlan, setIsRefreshingPlan] = useState(false);

  // Filter to show Base Plan and Max Plan (not Enterprise in onboarding)
  const availablePlans = billingPlans.filter(plan => plan.id === 'starter' || plan.id === 'growth');

  const handlePlanSelect = (plan: BillingPlanDefinition) => {
    setSelectedPlan(plan);
    setPaywallVisible(true);
  };

  const handleSubscriptionCreated = async () => {
    console.log('[FreeTrialSignup] Subscription created, refreshing onboarding data');
    setIsRefreshingPlan(true);
    try {
      await refreshOnboarding();
      // Update onboarding data to track that trial was started
      updateOnboardingData({
        trialStarted: true,
        billingPlan: selectedPlan?.id || onboardingData.billingPlan,
      });
      setPaywallVisible(false);
      // Don't auto-advance - let user continue when ready
    } catch (error) {
      console.error('[FreeTrialSignup] Failed to refresh onboarding after subscription:', error);
    } finally {
      setIsRefreshingPlan(false);
    }
  };

  const handleRefreshPlanStatus = async () => {
    setIsRefreshingPlan(true);
    try {
      await refreshOnboarding();
      // Check if plan was updated
      if (onboardingData.billingPlan) {
        updateOnboardingData({ trialStarted: true });
      }
    } catch (error) {
      console.error('[FreeTrialSignup] Failed to refresh plan status:', error);
    } finally {
      setIsRefreshingPlan(false);
    }
  };

  const hasPaidPlan = !!onboardingData.billingPlan && (onboardingData.billingPlan === 'starter' || onboardingData.billingPlan === 'growth' || onboardingData.billingPlan === 'enterprise');

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with back button and progress bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <FlynnIcon name="arrow-back" size={24} color={themeColors.primary} />
        </TouchableOpacity>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={styles.progressBar} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleContainer}>
          <View style={styles.iconContainer}>
            <FlynnIcon name="sparkles" size={32} color={themeColors.primary} />
          </View>
          <Text style={styles.title}>Start Your Free Trial</Text>
          <Text style={styles.subtitle}>
            Choose a plan to unlock your Flynn number. You'll get 14 days free—no charges until your trial ends.
          </Text>
        </View>

        {hasPaidPlan ? (
          <View style={styles.successContainer}>
            <FlynnIcon name="checkmark-circle" size={48} color={colors.success} />
            <Text style={styles.successTitle}>Trial Activated!</Text>
            <Text style={styles.successText}>
              Your {onboardingData.billingPlan === 'starter' ? 'Base' : onboardingData.billingPlan === 'growth' ? 'Max' : 'Enterprise'} Plan trial is active.
            </Text>
            <Text style={styles.successSubtext}>
              You can change your plan or payment method anytime in Settings.
            </Text>
            <FlynnButton
              title="Continue to Phone Setup"
              onPress={onNext}
              variant="primary"
              fullWidth
              style={styles.continueButton}
            />
          </View>
        ) : (
          <>
            <View style={styles.plansContainer}>
              {availablePlans.map((plan) => (
                <TouchableOpacity
                  key={plan.id}
                  style={[
                    styles.planCard,
                    plan.recommended && styles.planCardRecommended,
                  ]}
                  onPress={() => handlePlanSelect(plan)}
                  activeOpacity={0.8}
                >
                  {plan.recommended && (
                    <View style={styles.recommendedBadge}>
                      <Text style={styles.recommendedText}>POPULAR</Text>
                    </View>
                  )}
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planHeadline}>{plan.headline}</Text>
                  <View style={styles.priceContainer}>
                    <Text style={styles.priceAmount}>{plan.priceText}</Text>
                    <Text style={styles.pricePeriod}>/month</Text>
                  </View>
                  <Text style={styles.planAllowance}>{plan.callAllowanceLabel}</Text>
                  <View style={styles.highlightsContainer}>
                    {plan.highlights.slice(0, 4).map((highlight, index) => (
                      <View key={index} style={styles.highlightRow}>
                        <FlynnIcon name="checkmark" size={16} color={themeColors.primary} />
                        <Text style={styles.highlightText}>{highlight}</Text>
                      </View>
                    ))}
                  </View>
                  <FlynnButton
                    title="Start Free Trial"
                    onPress={() => handlePlanSelect(plan)}
                    variant={plan.recommended ? 'primary' : 'secondary'}
                    fullWidth
                    style={styles.planButton}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.helpContainer}>
              <FlynnIcon name="information-circle" size={20} color={themeColors.primary} />
              <Text style={styles.helpText}>
                You won't be charged until your 14-day trial ends. Cancel anytime in Settings.
              </Text>
            </View>

            <FlynnButton
              title="I've already subscribed – refresh"
              onPress={handleRefreshPlanStatus}
              variant="ghost"
              fullWidth
              loading={isRefreshingPlan}
              style={styles.refreshButton}
            />
          </>
        )}

        <FlynnButton
          title="Skip for now"
          onPress={onNext}
          variant="secondary"
          fullWidth
          style={styles.skipButton}
        />
      </ScrollView>

      <BillingPaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        customerEmail={user?.email ?? undefined}
        organizationId={organizationId}
        onSubscriptionCreated={handleSubscriptionCreated}
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
    textAlign: 'center',
    lineHeight: 24,
  },
  plansContainer: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  planCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.black,
    position: 'relative',
  },
  planCardRecommended: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  recommendedBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.sm,
  },
  recommendedText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  planName: {
    ...typography.h3,
    color: colors.gray900,
    marginBottom: spacing.xs,
  },
  planHeadline: {
    ...typography.bodyMedium,
    color: colors.gray600,
    marginBottom: spacing.md,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  priceAmount: {
    ...typography.h2,
    color: colors.gray900,
    marginRight: spacing.xs,
  },
  pricePeriod: {
    ...typography.bodyMedium,
    color: colors.gray600,
  },
  planAllowance: {
    ...typography.bodySmall,
    color: colors.gray700,
    marginBottom: spacing.md,
    fontWeight: '600',
  },
  highlightsContainer: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  highlightText: {
    ...typography.bodySmall,
    color: colors.gray700,
    flex: 1,
  },
  planButton: {
    marginTop: spacing.sm,
  },
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  helpText: {
    ...typography.bodySmall,
    color: colors.primary,
    flex: 1,
  },
  refreshButton: {
    marginBottom: spacing.md,
  },
  skipButton: {
    marginTop: spacing.md,
  },
  successContainer: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.black,
    marginBottom: spacing.lg,
  },
  successTitle: {
    ...typography.h3,
    color: colors.success,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  successText: {
    ...typography.bodyLarge,
    color: colors.gray700,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  successSubtext: {
    ...typography.bodySmall,
    color: colors.gray600,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  continueButton: {
    marginTop: spacing.md,
  },
});

