import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';
import { FlynnButton } from '../ui/FlynnButton';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { billingPlans, BillingPlanDefinition } from '../../data/billingPlans';
import { spacing, typography, borderRadius, shadows } from '../../theme';

interface BillingPaywallModalProps {
  visible: boolean;
  onClose: () => void;
  customerEmail?: string;
  organizationId?: string | null;
  onSubscriptionCreated?: () => void;
}

const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl || 'https://flynnai-telephony.fly.dev';

export const BillingPaywallModal: React.FC<BillingPaywallModalProps> = ({
  visible,
  onClose,
  customerEmail,
  organizationId,
  onSubscriptionCreated,
}) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [isProcessing, setIsProcessing] = useState(false);
  const styles = createStyles(colors);

  const handlePlanSelection = async (plan: BillingPlanDefinition) => {
    if (!plan.stripePriceId) {
      Alert.alert(
        'Checkout coming soon',
        'We are finalising this plan in Stripe. Please email support@flynn.ai so we can activate it manually for you.'
      );
      return;
    }

    if (!user?.id) {
      Alert.alert('Authentication required', 'Please log in to subscribe');
      return;
    }

    const email = customerEmail || user.email;
    if (!email) {
      Alert.alert('Email required', 'Please provide an email address');
      return;
    }

    setIsProcessing(true);

    try {
      console.log('[BillingPaywall] Creating subscription for plan:', plan.id);

      // Step 1: Create subscription on backend
      const response = await fetch(`${API_BASE_URL}/api/stripe/create-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.accessToken}`,
        },
        body: JSON.stringify({
          priceId: plan.stripePriceId,
          customerEmail: email,
          userId: user.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create subscription');
      }

      const { clientSecret, subscriptionId, trialEnd } = await response.json();

      if (!clientSecret) {
        throw new Error('No client secret returned from server');
      }

      console.log('[BillingPaywall] Subscription created:', subscriptionId);

      // Step 2: Initialize Payment Sheet
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'Flynn AI',
        returnURL: 'flynnai://stripe-redirect',
        defaultBillingDetails: {
          email,
        },
      });

      if (initError) {
        console.error('[BillingPaywall] Payment Sheet init error:', initError);
        throw new Error(initError.message || 'Failed to initialize payment');
      }

      // Step 3: Present Payment Sheet
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code === 'Canceled') {
          console.log('[BillingPaywall] User cancelled payment');
          Alert.alert('Payment cancelled', 'You can try again anytime');
        } else {
          console.error('[BillingPaywall] Payment error:', presentError);
          Alert.alert('Payment failed', presentError.message || 'Please try again');
        }
        return;
      }

      // Step 4: Success!
      console.log('[BillingPaywall] Payment successful!');

      const trialMessage = trialEnd
        ? `Your 14-day free trial starts now. You won't be charged until ${new Date(trialEnd * 1000).toLocaleDateString()}.`
        : 'Your subscription is now active!';

      Alert.alert(
        'Subscription active!',
        trialMessage,
        [
          {
            text: 'Continue',
            onPress: () => {
              onSubscriptionCreated?.();
              onClose();
            },
          },
        ]
      );

    } catch (error: any) {
      console.error('[BillingPaywall] Error:', error);
      Alert.alert(
        'Subscription failed',
        error.message || 'Unable to create subscription. Please try again or email support@flynn.ai.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.badge}>Flynn concierge</Text>
          <Text style={styles.title}>Start your 14-day free trial</Text>
          <Text style={styles.subtitle}>
            Enter your card details to start your free trial. You won't be charged for 14 days, and you can cancel anytime during the trial.
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.planRow}
          >
            {billingPlans.map((plan) => (
              <TouchableOpacity
                key={plan.id}
                style={[styles.planCard, plan.recommended && styles.planCardFeatured]}
                activeOpacity={0.92}
                onPress={() => handlePlanSelection(plan)}
                disabled={isProcessing}
              >
                {plan.recommended && <Text style={styles.planBadge}>Most popular</Text>}
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planHeadline}>{plan.headline}</Text>
                <Text style={styles.planPrice}>{plan.priceText}</Text>
                <Text style={styles.planAllowance}>{plan.callAllowanceLabel}</Text>
                <View style={styles.planDivider} />
                {plan.highlights.map((highlight) => (
                  <View key={highlight} style={styles.highlightRow}>
                    <Text style={styles.highlightBullet}>•</Text>
                    <Text style={styles.highlightText}>{highlight}</Text>
                  </View>
                ))}
                <FlynnButton
                  title={plan.recommended ? 'Start 14-day free trial' : `Try ${plan.name}`}
                  onPress={() => handlePlanSelection(plan)}
                  variant={plan.recommended ? 'primary' : 'secondary'}
                  fullWidth
                  style={styles.planCta}
                  loading={isProcessing}
                  disabled={isProcessing}
                />
                <Text style={styles.trialNote}>
                  Then {plan.priceText} after trial. Cancel anytime.
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {isProcessing && (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.processingText}>Processing subscription...</Text>
            </View>
          )}

          <FlynnButton
            title="Close"
            onPress={onClose}
            variant="ghost"
            fullWidth
            disabled={isProcessing}
          />
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    padding: spacing.xl,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    color: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.full,
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    ...typography.h3,
    color: colors.gray900,
    marginTop: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.gray600,
    marginTop: spacing.xs,
  },
  planRow: {
    marginTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  planCard: {
    width: 260,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.md,
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  planCardFeatured: {
    borderColor: colors.primary,
    ...shadows.md,
  },
  planBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    color: colors.white,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxxs,
    borderRadius: borderRadius.full,
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  planName: {
    ...typography.h4,
    color: colors.gray900,
  },
  planHeadline: {
    ...typography.bodySmall,
    color: colors.gray600,
    marginTop: spacing.xxxs,
    minHeight: 40,
  },
  planPrice: {
    ...typography.h3,
    color: colors.gray900,
    marginTop: spacing.md,
  },
  planAllowance: {
    ...typography.bodySmall,
    color: colors.gray500,
  },
  planDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  highlightBullet: {
    ...typography.body,
    color: colors.primary,
    marginRight: spacing.xs,
  },
  highlightText: {
    ...typography.body,
    color: colors.gray700,
    flex: 1,
  },
  planCta: {
    marginTop: spacing.md,
  },
  trialNote: {
    ...typography.bodySmall,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  processingText: {
    ...typography.body,
    color: colors.gray600,
  },
});
