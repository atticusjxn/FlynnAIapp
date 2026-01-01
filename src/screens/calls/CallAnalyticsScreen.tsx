import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { FlynnIcon } from '../../components/ui/FlynnIcon';
import { FlynnCard } from '../../components/ui/FlynnCard';
import { spacing, typography, borderRadius, colors, shadows } from '../../theme';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';

interface CallAnalytics {
  totalCalls: number;
  callsByMode: {
    sms_links: number;
    ai_receptionist: number;
    voicemail_only: number;
  };
  dtmfSelections: {
    booking: number;
    quote: number;
    voicemail: number;
  };
  smsDelivery: {
    sent: number;
    delivered: number;
    failed: number;
  };
  conversions: {
    bookingClicks: number;
    quoteSubmissions: number;
  };
}

interface CallAnalyticsScreenProps {
  navigation: any;
}

export const CallAnalyticsScreen: React.FC<CallAnalyticsScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<CallAnalytics | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get user's org_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('default_org_id')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;
      if (!userData?.default_org_id) {
        console.warn('[CallAnalytics] No org_id found for user');
        setAnalytics({
          totalCalls: 0,
          callsByMode: { sms_links: 0, ai_receptionist: 0, voicemail_only: 0 },
          dtmfSelections: { booking: 0, quote: 0, voicemail: 0 },
          smsDelivery: { sent: 0, delivered: 0, failed: 0 },
          conversions: { bookingClicks: 0, quoteSubmissions: 0 },
        });
        return;
      }

      // Calculate date range
      const now = new Date();
      const daysAgo = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

      // Fetch call events using org_id
      const { data: events, error } = await supabase
        .from('call_events')
        .select('*')
        .eq('org_id', userData.default_org_id)
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      // Process analytics from payload structure
      const callsByMode = {
        sms_links: 0,
        ai_receptionist: 0,
        voicemail_only: 0,
      };

      const dtmfSelections = {
        booking: 0,
        quote: 0,
        voicemail: 0,
      };

      const smsDelivery = {
        sent: 0,
        delivered: 0,
        failed: 0,
      };

      const conversions = {
        bookingClicks: 0,
        quoteSubmissions: 0,
      };

      // Track unique calls
      const uniqueCalls = new Set<string>();

      events?.forEach((event: any) => {
        // Count unique calls
        if (event.call_sid) {
          uniqueCalls.add(event.call_sid);
        }

        const payload = event.payload || {};

        // Count calls by mode based on event_type
        if (event.event_type === 'call_inbound_received') {
          // Determine mode from payload
          const mode = payload.receptionistMode || payload.call_handling_mode;
          if (mode === 'ai_only' || mode === 'ai_receptionist') {
            callsByMode.ai_receptionist++;
          } else if (mode === 'sms_links') {
            callsByMode.sms_links++;
          } else if (mode === 'voicemail_only') {
            callsByMode.voicemail_only++;
          }
        }

        // Count AI receptionist engagements
        if (event.event_type === 'ai_receptionist_engaged') {
          // Already counted in call_inbound_received
        }

        // Count DTMF selections (from IVR events)
        if (event.event_type === 'dtmf_pressed' || payload.dtmf_pressed) {
          const action = payload.dtmf_action || payload.action;
          if (action === 'booking_link' || action === 'booking') {
            dtmfSelections.booking++;
          } else if (action === 'quote_link' || action === 'quote') {
            dtmfSelections.quote++;
          } else if (action === 'voicemail') {
            dtmfSelections.voicemail++;
          }
        }

        // Count SMS events
        if (event.event_type === 'sms_sent' || event.event_type === 'booking_link_sent' || event.event_type === 'quote_link_sent') {
          smsDelivery.sent++;
          const status = payload.status || payload.sms_status;
          if (status === 'delivered') {
            smsDelivery.delivered++;
          } else if (status === 'failed' || status === 'undelivered') {
            smsDelivery.failed++;
          }
        }

        // Count conversions
        if (event.event_type === 'booking_completed' || payload.outcome === 'booking_completed') {
          conversions.bookingClicks++;
        } else if (event.event_type === 'quote_submitted' || payload.outcome === 'quote_submitted') {
          conversions.quoteSubmissions++;
        }
      });

      setAnalytics({
        totalCalls: uniqueCalls.size,
        callsByMode,
        dtmfSelections,
        smsDelivery,
        conversions,
      });
    } catch (error) {
      console.error('[CallAnalytics] Failed to load analytics:', error);
      Alert.alert('Error', 'Failed to load call analytics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderTimeRangeSelector = () => (
    <View style={styles.timeRangeContainer}>
      {['7d', '30d', '90d'].map((range) => (
        <TouchableOpacity
          key={range}
          style={[
            styles.timeRangeButton,
            timeRange === range && styles.timeRangeButtonActive,
          ]}
          onPress={() => setTimeRange(range as '7d' | '30d' | '90d')}
        >
          <Text
            style={[
              styles.timeRangeText,
              timeRange === range && styles.timeRangeTextActive,
            ]}
          >
            {range === '7d' ? 'Last 7 Days' : range === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderMetricCard = (title: string, value: number, icon: string, color: string) => (
    <View style={styles.metricCard}>
      <View style={[styles.metricIconContainer, { backgroundColor: color + '20' }]}>
        <FlynnIcon name={icon as any} size={24} color={color} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricTitle}>{title}</Text>
    </View>
  );

  const renderBreakdownCard = (title: string, items: Array<{ label: string; value: number; color: string }>) => (
    <FlynnCard style={styles.breakdownCard}>
      <Text style={styles.breakdownTitle}>{title}</Text>
      <View style={styles.breakdownList}>
        {items.map((item, index) => (
          <View key={index} style={styles.breakdownItem}>
            <View style={styles.breakdownItemLeft}>
              <View style={[styles.breakdownDot, { backgroundColor: item.color }]} />
              <Text style={styles.breakdownLabel}>{item.label}</Text>
            </View>
            <Text style={styles.breakdownValue}>{item.value}</Text>
          </View>
        ))}
      </View>
    </FlynnCard>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <FlynnIcon name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Call Analytics</Text>
        <View style={styles.headerSpacer} />
      </View>

      {renderTimeRangeSelector()}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Overview Metrics */}
        <View style={styles.metricsGrid}>
          {renderMetricCard('Total Calls', analytics?.totalCalls || 0, 'call', colors.primary)}
          {renderMetricCard('SMS Sent', analytics?.smsDelivery.sent || 0, 'chatbox', colors.success)}
          {renderMetricCard('Booking Requests', analytics?.dtmfSelections.booking || 0, 'calendar', colors.warning)}
          {renderMetricCard('Quote Requests', analytics?.dtmfSelections.quote || 0, 'document-text', colors.primary)}
        </View>

        {/* Calls by Mode */}
        {renderBreakdownCard('Calls by Mode', [
          { label: 'SMS Link Follow-Up', value: analytics?.callsByMode.sms_links || 0, color: colors.primary },
          { label: 'AI Receptionist', value: analytics?.callsByMode.ai_receptionist || 0, color: colors.warning },
          { label: 'Voicemail Only', value: analytics?.callsByMode.voicemail_only || 0, color: colors.gray500 },
        ])}

        {/* DTMF Selections */}
        {renderBreakdownCard('Caller Actions', [
          { label: 'Requested Booking Link', value: analytics?.dtmfSelections.booking || 0, color: colors.success },
          { label: 'Requested Quote Link', value: analytics?.dtmfSelections.quote || 0, color: colors.primary },
          { label: 'Left Voicemail', value: analytics?.dtmfSelections.voicemail || 0, color: colors.gray500 },
        ])}

        {/* SMS Delivery */}
        {renderBreakdownCard('SMS Delivery Status', [
          { label: 'Successfully Sent', value: analytics?.smsDelivery.sent || 0, color: colors.primary },
          { label: 'Delivered', value: analytics?.smsDelivery.delivered || 0, color: colors.success },
          { label: 'Failed', value: analytics?.smsDelivery.failed || 0, color: colors.error },
        ])}

        {/* Conversions */}
        <FlynnCard style={styles.conversionsCard}>
          <Text style={styles.conversionsTitle}>Conversions</Text>
          <Text style={styles.conversionsHint}>
            Estimated conversions based on link clicks and form submissions.
          </Text>
          <View style={styles.conversionsGrid}>
            <View style={styles.conversionItem}>
              <Text style={styles.conversionValue}>{analytics?.conversions.bookingClicks || 0}</Text>
              <Text style={styles.conversionLabel}>Booking Clicks</Text>
            </View>
            <View style={styles.conversionItem}>
              <Text style={styles.conversionValue}>{analytics?.conversions.quoteSubmissions || 0}</Text>
              <Text style={styles.conversionLabel}>Quote Submissions</Text>
            </View>
          </View>
        </FlynnCard>

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
  timeRangeContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray100,
    alignItems: 'center',
  },
  timeRangeButtonActive: {
    backgroundColor: colors.primaryLight,
  },
  timeRangeText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  timeRangeTextActive: {
    color: colors.primary,
  },
  content: {
    flex: 1,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.md,
  },
  metricIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  metricValue: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  metricTitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  breakdownCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  breakdownTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  breakdownList: {
    gap: spacing.sm,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  breakdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  breakdownDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  breakdownLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  breakdownValue: {
    ...typography.h4,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  conversionsCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  conversionsTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  conversionsHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  conversionsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  conversionItem: {
    flex: 1,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  conversionValue: {
    ...typography.h2,
    color: colors.primary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  conversionLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footerSpacer: {
    height: spacing.xxl,
  },
});
