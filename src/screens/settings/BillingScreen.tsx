import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlynnIcon } from '../../components/ui/FlynnIcon';
import { FlynnCard } from '../../components/ui/FlynnCard';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { BillingService } from '../../services/BillingService';
import { billingPlans } from '../../data/billingPlans';
import type { BillingPlanId } from '../../types/billing';

interface BillingScreenProps {
  navigation: any;
}

export const BillingScreen: React.FC<BillingScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentPlan, setCurrentPlan] = useState<BillingPlanId>('trial');
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('inactive');
  const [callsUsed, setCallsUsed] = useState(0);
  const [callsAllotted, setCallsAllotted] = useState(0);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get subscription status from backend API
      const apiStatus = await BillingService.getSubscriptionFromAPI();

      if (apiStatus) {
        setCurrentPlan(apiStatus.plan);
        setSubscriptionStatus(apiStatus.status);
        setCurrentPeriodEnd(apiStatus.currentPeriodEnd);
        setCancelAtPeriodEnd(apiStatus.cancelAtPeriodEnd);
        setHasActiveSubscription(apiStatus.hasActiveSubscription);
      }

      // Get call usage from local service
      const status = await BillingService.getSubscriptionStatus(user.id);
      setCallsUsed(status.callsUsed);
      setCallsAllotted(status.callsAllotted);
    } catch (error) {
      console.error('[BillingScreen] Error loading billing data:', error);
      Alert.alert('Error', 'Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId: BillingPlanId) => {
    if (planId === 'trial') return;

    const plan = billingPlans.find(p => p.id === planId);
    if (!plan?.stripePriceId) {
      Alert.alert('Error', 'Plan configuration error. Please contact support.');
      return;
    }

    try {
      await BillingService.createCheckoutSession(plan.stripePriceId);
      // After checkout completes, refresh billing data
      setTimeout(() => loadBillingData(), 2000);
    } catch (error) {
      console.error('[BillingScreen] Upgrade error:', error);
    }
  };

  const handleManageBilling = async () => {
    try {
      await BillingService.openCustomerPortal();
      // Refresh data after portal is closed
      setTimeout(() => loadBillingData(), 2000);
    } catch (error) {
      console.error('[BillingScreen] Portal error:', error);
    }
  };

  const renderUsageBar = () => {
    if (currentPlan === 'trial') return null;

    const usagePercent = callsAllotted > 0 ? (callsUsed / callsAllotted) * 100 : 0;
    const barColor = usagePercent >= 100 ? colors.error : usagePercent >= 80 ? colors.warning : colors.success;

    return (
      <FlynnCard style={styles.usageCard}>
        <Text style={styles.usageTitle}>Call Usage This Month</Text>
        <View style={styles.usageStats}>
          <Text style={styles.usageCount}>
            {callsUsed} / {callsAllotted} calls
          </Text>
          <Text style={styles.usageRemaining}>
            {Math.max(0, callsAllotted - callsUsed)} remaining
          </Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${Math.min(100, usagePercent)}%`, backgroundColor: barColor }]} />
        </View>
        {usagePercent >= 80 && (
          <Text style={[styles.usageWarning, usagePercent >= 100 && { color: colors.error }]}>
            {usagePercent >= 100
              ? 'Call limit reached. Additional calls will be charged.'
              : 'You\'re approaching your call limit'}
          </Text>
        )}
      </FlynnCard>
    );
  };

  const renderCurrentPlanCard = () => {
    const plan = billingPlans.find(p => p.id === currentPlan);
    const isActive = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';
    const isPastDue = subscriptionStatus === 'past_due';

    return (
      <FlynnCard style={styles.currentPlanCard}>
        <View style={styles.currentPlanHeader}>
          <View>
            <Text style={styles.currentPlanLabel}>Current Plan</Text>
            <Text style={styles.currentPlanName}>{plan?.name || 'Free Trial'}</Text>
          </View>
          {isActive && (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          )}
          {isPastDue && (
            <View style={[styles.activeBadge, { backgroundColor: colors.errorLight }]}>
              <Text style={[styles.activeBadgeText, { color: colors.error }]}>Payment Failed</Text>
            </View>
          )}
        </View>

        {currentPlan !== 'trial' && (
          <Text style={styles.currentPlanPrice}>{plan?.priceText}</Text>
        )}

        {cancelAtPeriodEnd && currentPeriodEnd && (
          <Text style={styles.cancelNotice}>
            Your subscription will cancel on {new Date(currentPeriodEnd).toLocaleDateString()}
          </Text>
        )}

        {hasActiveSubscription && (
          <TouchableOpacity
            style={styles.manageButton}
            onPress={handleManageBilling}
            activeOpacity={0.7}
          >
            <FlynnIcon name="card" size={20} color={colors.primary} />
            <Text style={styles.manageButtonText}>Manage Billing</Text>
            <FlynnIcon name="chevron-forward" size={20} color={colors.gray400} />
          </TouchableOpacity>
        )}

        {isPastDue && (
          <TouchableOpacity
            style={[styles.manageButton, styles.updatePaymentButton]}
            onPress={handleManageBilling}
            activeOpacity={0.7}
          >
            <Text style={styles.updatePaymentText}>Update Payment Method</Text>
          </TouchableOpacity>
        )}
      </FlynnCard>
    );
  };

  const renderPlanCard = (plan: typeof billingPlans[0]) => {
    const isCurrent = plan.id === currentPlan;
    const isUpgrade = billingPlans.findIndex(p => p.id === plan.id) > billingPlans.findIndex(p => p.id === currentPlan);

    return (
      <FlynnCard key={plan.id} style={[styles.planCard, plan.recommended && styles.recommendedPlan]}>
        {plan.recommended && (
          <View style={styles.recommendedBadge}>
            <Text style={styles.recommendedText}>Recommended</Text>
          </View>
        )}

        <Text style={styles.planName}>{plan.name}</Text>
        <Text style={styles.planHeadline}>{plan.headline}</Text>

        {!isCurrent && plan.id !== 'trial' && (
          <View style={styles.trialBanner}>
            <Text style={styles.trialBannerText}>🎉 14-day free trial included</Text>
          </View>
        )}

        <Text style={styles.planPrice}>{plan.priceText}</Text>
        {!isCurrent && plan.id !== 'trial' && (
          <Text style={styles.trialDetails}>
            Enter your card now. You'll be charged after your 14-day trial ends. Cancel anytime.
          </Text>
        )}
        <Text style={styles.planAllowance}>{plan.callAllowanceLabel}</Text>

        <View style={styles.highlightsContainer}>
          {plan.highlights.map((highlight, index) => (
            <View key={index} style={styles.highlightItem}>
              <FlynnIcon name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.highlightText}>{highlight}</Text>
            </View>
          ))}
        </View>

        {isCurrent ? (
          <View style={styles.currentBadge}>
            <Text style={styles.currentBadgeText}>Current Plan</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.upgradeButton, plan.recommended && styles.upgradeButtonPrimary]}
            onPress={() => handleUpgrade(plan.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.upgradeButtonText, plan.recommended && styles.upgradeButtonTextPrimary]}>
              {isUpgrade ? 'Upgrade' : 'Downgrade'}
            </Text>
          </TouchableOpacity>
        )}
      </FlynnCard>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading billing information...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <FlynnIcon name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Billing & Subscription</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderCurrentPlanCard()}
        {renderUsageBar()}

        <View style={styles.plansSection}>
          <Text style={styles.plansSectionTitle}>Available Plans</Text>
          <Text style={styles.plansSectionSubtitle}>
            Choose the plan that fits your business needs
          </Text>
          {billingPlans.map(renderPlanCard)}
        </View>

        <View style={styles.footerSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  currentPlanCard: {
    marginTop: spacing.lg,
  },
  currentPlanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  currentPlanLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xxs,
  },
  currentPlanName: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  currentPlanPrice: {
    ...typography.h3,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  activeBadge: {
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.full,
  },
  activeBadgeText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
  cancelNotice: {
    ...typography.bodySmall,
    color: colors.warning,
    marginBottom: spacing.md,
    fontStyle: 'italic',
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  manageButtonText: {
    ...typography.bodyMedium,
    color: colors.primary,
    flex: 1,
    marginLeft: spacing.sm,
    fontWeight: '600',
  },
  updatePaymentButton: {
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderTopWidth: 0,
    justifyContent: 'center',
  },
  updatePaymentText: {
    ...typography.bodyMedium,
    color: colors.error,
    fontWeight: '600',
    textAlign: 'center',
  },
  usageCard: {
    marginTop: spacing.md,
  },
  usageTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  usageStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  usageCount: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  usageRemaining: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: colors.gray200,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: borderRadius.md,
  },
  usageWarning: {
    ...typography.bodySmall,
    color: colors.warning,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  plansSection: {
    marginTop: spacing.xl,
  },
  plansSectionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  plansSectionSubtitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  planCard: {
    marginBottom: spacing.lg,
    position: 'relative',
  },
  recommendedPlan: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  recommendedBadge: {
    position: 'absolute',
    top: -12,
    right: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.full,
  },
  recommendedText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '700',
  },
  planName: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  planHeadline: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  trialBanner: {
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  trialBannerText: {
    ...typography.bodySmall,
    color: colors.success,
    fontWeight: '600',
  },
  planPrice: {
    ...typography.h2,
    color: colors.primary,
    marginBottom: spacing.xxs,
  },
  trialDetails: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontStyle: 'italic',
  },
  planAllowance: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  highlightsContainer: {
    marginBottom: spacing.lg,
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  highlightText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  currentBadge: {
    backgroundColor: colors.gray200,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  currentBadgeText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  upgradeButton: {
    backgroundColor: colors.gray100,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  upgradeButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  upgradeButtonText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  upgradeButtonTextPrimary: {
    color: colors.white,
  },
  footerSpacer: {
    height: spacing.xxl,
  },
});
