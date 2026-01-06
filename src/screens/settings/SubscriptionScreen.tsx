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
import Constants from 'expo-constants';
import { FlynnIcon } from '../../components/ui/FlynnIcon';
import { FlynnCard } from '../../components/ui/FlynnCard';
import { FlynnButton } from '../../components/ui/FlynnButton';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { useAuth } from '../../context/AuthContext';

const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl || 'https://flynnai-telephony.fly.dev';

interface SubscriptionData {
  subscriptionId: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';
  trialEnd: number | null;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  plan: {
    productName: string;
    amount: number;
    currency: string;
    interval: 'month' | 'year';
  };
  paymentMethod: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  } | null;
}

interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  created: number;
  paidAt: number | null;
  invoiceUrl: string | null;
  invoicePdf: string | null;
}

interface SubscriptionScreenProps {
  navigation: any;
}

export const SubscriptionScreen: React.FC<SubscriptionScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Fetch subscription details
      const subResponse = await fetch(`${API_BASE_URL}/api/stripe/subscription/${user.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user.accessToken}`,
        },
      });

      if (subResponse.ok) {
        const subData = await subResponse.json();
        if (subData.subscriptionId) {
          setSubscription(subData);
        }
      }

      // Fetch billing history
      const historyResponse = await fetch(`${API_BASE_URL}/api/stripe/billing-history/${user.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user.accessToken}`,
        },
      });

      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setInvoices(historyData.invoices || []);
      }
    } catch (error) {
      console.error('[SubscriptionScreen] Error loading data:', error);
      Alert.alert('Error', 'Failed to load subscription information');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = () => {
    if (!subscription) return;

    const cancelDate = new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString();
    const isTrialing = subscription.status === 'trialing';

    Alert.alert(
      'Cancel Subscription',
      isTrialing
        ? 'Your free trial will end immediately and you won\'t be charged. Are you sure you want to cancel?'
        : `Your subscription will remain active until ${cancelDate}. After that, you won't be charged again. Are you sure?`,
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: confirmCancelSubscription,
        },
      ]
    );
  };

  const confirmCancelSubscription = async () => {
    if (!user?.id) return;

    try {
      setCancelling(true);

      const response = await fetch(`${API_BASE_URL}/api/stripe/cancel-subscription/${user.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to cancel subscription');
      }

      const result = await response.json();

      Alert.alert(
        'Subscription Cancelled',
        result.message || 'Your subscription has been cancelled',
        [
          {
            text: 'OK',
            onPress: () => loadSubscriptionData(),
          },
        ]
      );
    } catch (error: any) {
      console.error('[SubscriptionScreen] Cancel error:', error);
      Alert.alert('Error', error.message || 'Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  const handleUpdatePaymentMethod = () => {
    Alert.alert(
      'Update Payment Method',
      'To update your payment method, please visit the billing portal.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Open Portal',
          onPress: () => {
            // TODO: Implement customer portal link
            Alert.alert('Coming Soon', 'Payment method updates will be available soon');
          },
        },
      ]
    );
  };

  const getStatusColor = (status: SubscriptionData['status']) => {
    switch (status) {
      case 'trialing':
        return colors.primaryLight;
      case 'active':
        return colors.successLight;
      case 'past_due':
        return colors.errorLight;
      case 'canceled':
        return colors.gray200;
      default:
        return colors.warningLight;
    }
  };

  const getStatusTextColor = (status: SubscriptionData['status']) => {
    switch (status) {
      case 'trialing':
        return colors.primary;
      case 'active':
        return colors.success;
      case 'past_due':
        return colors.error;
      case 'canceled':
        return colors.gray600;
      default:
        return colors.warning;
    }
  };

  const getStatusText = (status: SubscriptionData['status']) => {
    switch (status) {
      case 'trialing':
        return 'Free Trial';
      case 'active':
        return 'Active';
      case 'past_due':
        return 'Payment Failed';
      case 'canceled':
        return 'Cancelled';
      case 'incomplete':
        return 'Incomplete';
      default:
        return status;
    }
  };

  const renderCurrentSubscription = () => {
    if (!subscription) {
      return (
        <FlynnCard style={styles.card}>
          <Text style={styles.cardTitle}>No Active Subscription</Text>
          <Text style={styles.noSubText}>
            You don't have an active subscription yet. Start a 14-day free trial to access all features.
          </Text>
          <FlynnButton
            title="Start Free Trial"
            onPress={() => navigation.navigate('Billing')}
            variant="primary"
            style={styles.upgradeButton}
          />
        </FlynnCard>
      );
    }

    const isTrialing = subscription.status === 'trialing';
    const trialEndsIn = subscription.trialEnd
      ? Math.ceil((subscription.trialEnd * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
      : 0;

    return (
      <FlynnCard style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.cardTitle}>Current Subscription</Text>
            <Text style={styles.planName}>{subscription.plan.productName}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(subscription.status) }]}>
            <Text style={[styles.statusText, { color: getStatusTextColor(subscription.status) }]}>
              {getStatusText(subscription.status)}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.planDetails}>
          <View style={styles.planRow}>
            <Text style={styles.planLabel}>Price</Text>
            <Text style={styles.planValue}>
              ${subscription.plan.amount} {subscription.plan.currency.toUpperCase()}/{subscription.plan.interval}
            </Text>
          </View>

          {isTrialing && subscription.trialEnd && (
            <View style={styles.trialBanner}>
              <FlynnIcon name="time" size={20} color={colors.primary} />
              <Text style={styles.trialText}>
                Trial ends in {trialEndsIn} day{trialEndsIn !== 1 ? 's' : ''} • You won't be charged until{' '}
                {new Date(subscription.trialEnd * 1000).toLocaleDateString()}
              </Text>
            </View>
          )}

          {!isTrialing && (
            <View style={styles.planRow}>
              <Text style={styles.planLabel}>Next billing date</Text>
              <Text style={styles.planValue}>
                {new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString()}
              </Text>
            </View>
          )}

          {subscription.cancelAtPeriodEnd && (
            <View style={styles.cancelNoticeBanner}>
              <FlynnIcon name="information-circle" size={20} color={colors.warning} />
              <Text style={styles.cancelNoticeText}>
                Your subscription will cancel on{' '}
                {new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>
      </FlynnCard>
    );
  };

  const renderPaymentMethod = () => {
    if (!subscription?.paymentMethod) {
      return null;
    }

    const { brand, last4, expMonth, expYear } = subscription.paymentMethod;

    return (
      <FlynnCard style={styles.card}>
        <Text style={styles.cardTitle}>Payment Method</Text>

        <View style={styles.paymentMethodRow}>
          <View style={styles.paymentMethodInfo}>
            <View style={styles.cardIconContainer}>
              <FlynnIcon name="card" size={24} color={colors.primary} />
            </View>
            <View style={styles.cardDetails}>
              <Text style={styles.cardBrand}>{brand.toUpperCase()}</Text>
              <Text style={styles.cardNumber}>•••• {last4}</Text>
              <Text style={styles.cardExpiry}>
                Expires {expMonth.toString().padStart(2, '0')}/{expYear}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.updateButton}
            onPress={handleUpdatePaymentMethod}
            activeOpacity={0.7}
          >
            <Text style={styles.updateButtonText}>Update</Text>
          </TouchableOpacity>
        </View>
      </FlynnCard>
    );
  };

  const renderManageSubscription = () => {
    if (!subscription || subscription.cancelAtPeriodEnd) {
      return null;
    }

    return (
      <FlynnCard style={styles.card}>
        <Text style={styles.cardTitle}>Manage Subscription</Text>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancelSubscription}
          disabled={cancelling}
          activeOpacity={0.7}
        >
          {cancelling ? (
            <ActivityIndicator size="small" color={colors.error} />
          ) : (
            <>
              <FlynnIcon name="close-circle" size={20} color={colors.error} />
              <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.cancelPolicy}>
          {subscription.status === 'trialing'
            ? 'Your trial will end immediately and you won\'t be charged.'
            : 'You can cancel anytime. Your subscription will remain active until the end of your billing period.'}
        </Text>
      </FlynnCard>
    );
  };

  const renderBillingHistory = () => {
    if (invoices.length === 0) {
      return null;
    }

    return (
      <FlynnCard style={styles.card}>
        <Text style={styles.cardTitle}>Billing History</Text>

        {invoices.map((invoice) => (
          <View key={invoice.id} style={styles.invoiceRow}>
            <View style={styles.invoiceInfo}>
              <Text style={styles.invoiceDate}>
                {new Date(invoice.created * 1000).toLocaleDateString()}
              </Text>
              <Text style={styles.invoiceAmount}>
                ${invoice.amount} {invoice.currency.toUpperCase()}
              </Text>
            </View>

            <View style={styles.invoiceActions}>
              <View
                style={[
                  styles.invoiceStatus,
                  {
                    backgroundColor:
                      invoice.status === 'paid'
                        ? colors.successLight
                        : invoice.status === 'open'
                        ? colors.warningLight
                        : colors.gray200,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.invoiceStatusText,
                    {
                      color:
                        invoice.status === 'paid'
                          ? colors.success
                          : invoice.status === 'open'
                          ? colors.warning
                          : colors.gray600,
                    },
                  ]}
                >
                  {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                </Text>
              </View>

              {invoice.invoicePdf && (
                <TouchableOpacity
                  style={styles.downloadButton}
                  onPress={() => {
                    // TODO: Open PDF in browser or download
                    Alert.alert('Download', 'PDF download functionality coming soon');
                  }}
                  activeOpacity={0.7}
                >
                  <FlynnIcon name="download" size={20} color={colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </FlynnCard>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading subscription...</Text>
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
        <Text style={styles.headerTitle}>Subscription</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderCurrentSubscription()}
        {renderPaymentMethod()}
        {renderManageSubscription()}
        {renderBillingHistory()}

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
  card: {
    marginTop: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeaderLeft: {
    flex: 1,
  },
  cardTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  planName: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.full,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  planDetails: {
    gap: spacing.sm,
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  planLabel: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  planValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  trialText: {
    ...typography.bodySmall,
    color: colors.primary,
    flex: 1,
    fontWeight: '500',
  },
  cancelNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  cancelNoticeText: {
    ...typography.bodySmall,
    color: colors.warning,
    flex: 1,
    fontWeight: '500',
  },
  noSubText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  upgradeButton: {
    marginTop: spacing.sm,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentMethodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  cardDetails: {
    flex: 1,
  },
  cardBrand: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xxxs,
  },
  cardNumber: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.xxxs,
  },
  cardExpiry: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  updateButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
  },
  updateButtonText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.errorLight,
    gap: spacing.sm,
  },
  cancelButtonText: {
    ...typography.bodyMedium,
    color: colors.error,
    fontWeight: '600',
  },
  cancelPolicy: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceDate: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.xxxs,
  },
  invoiceAmount: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  invoiceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  invoiceStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.full,
  },
  invoiceStatusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  downloadButton: {
    padding: spacing.xs,
  },
  footerSpacer: {
    height: spacing.xxl,
  },
});
