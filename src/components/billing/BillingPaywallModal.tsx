import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  ScrollView,
} from 'react-native';
import { FlynnButton } from '../ui/FlynnButton';
import { useTheme } from '../../context/ThemeContext';
import { billingPlans, BillingPlanDefinition } from '../../data/billingPlans';
import { spacing, typography, borderRadius, shadows } from '../../theme';

interface BillingPaywallModalProps {
  visible: boolean;
  onClose: () => void;
  customerEmail?: string;
  organizationId?: string | null;
}

const buildCheckoutUrl = (
  plan: BillingPlanDefinition,
  customerEmail?: string,
  organizationId?: string | null,
) => {
  if (!plan.paymentLink) {
    return null;
  }

  try {
    const url = new URL(plan.paymentLink);
    if (customerEmail) {
      url.searchParams.set('prefilled_email', customerEmail);
    }
    if (organizationId) {
      url.searchParams.set('client_reference_id', organizationId);
    }
    return url.toString();
  } catch (error) {
    console.warn('[BillingPaywallModal] Failed to build checkout URL', error);
    return plan.paymentLink;
  }
};

const openPlanLink = async (
  plan: BillingPlanDefinition,
  customerEmail?: string,
  organizationId?: string | null,
) => {
  const checkoutUrl = buildCheckoutUrl(plan, customerEmail, organizationId);

  if (!checkoutUrl) {
    Alert.alert(
      'Checkout link coming soon',
      'We are finalising this plan in Stripe. Please email support@flynn.ai so we can activate it manually for you.'
    );
    return;
  }

  try {
    await Linking.openURL(checkoutUrl);
  } catch (error) {
    console.warn('[BillingPaywallModal] Failed to open payment link', error);
    Alert.alert('Unable to open link', 'Please try again or email support@flynn.ai.');
  }
};

export const BillingPaywallModal: React.FC<BillingPaywallModalProps> = ({
  visible,
  onClose,
  customerEmail,
  organizationId,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.badge}>Flynn concierge</Text>
          <Text style={styles.title}>Subscribe to provision your Flynn number</Text>
          <Text style={styles.subtitle}>
            Your AI receptionist captures every event lead, routes summaries to your team, and keeps
            missed calls under control. Choose a plan to unlock provisioning.
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
                onPress={() => openPlanLink(plan, customerEmail, organizationId)}
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
                  title={plan.price === 49 ? 'Start for $49' : 'Upgrade for $99'}
                  onPress={() => openPlanLink(plan, customerEmail, organizationId)}
                  variant={plan.recommended ? 'primary' : 'secondary'}
                  fullWidth
                  style={styles.planCta}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>

          <FlynnButton title="Close" onPress={onClose} variant="ghost" fullWidth />
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
});
