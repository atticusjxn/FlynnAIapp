/**
 * Quote Form Analytics Screen
 *
 * Shows conversion funnel, performance metrics, and insights for a quote form.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import QuoteAnalyticsService from '../../services/QuoteAnalyticsService';
import type { QuoteLinkAnalytics } from '../../types/quoteLinks';

type DateRangeOption = '7d' | '30d' | '90d' | 'all';

export default function QuoteFormAnalyticsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { formId } = route.params as { formId: string };

  const [analytics, setAnalytics] = useState<QuoteLinkAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');

  useEffect(() => {
    loadAnalytics();
  }, [formId, dateRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      const now = new Date();
      let startDate: Date;

      switch (dateRange) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'all':
          startDate = new Date(2024, 0, 1); // Start of 2024
          break;
      }

      const data = await QuoteAnalyticsService.getFormAnalytics(formId, {
        start: startDate,
        end: now,
      });

      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
      Alert.alert('Error', 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!analytics) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No analytics data available</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Date Range Selector */}
      <View style={styles.dateRangeSelector}>
        {(['7d', '30d', '90d', 'all'] as DateRangeOption[]).map((range) => (
          <TouchableOpacity
            key={range}
            style={[
              styles.dateRangeButton,
              dateRange === range && styles.dateRangeButtonActive,
            ]}
            onPress={() => setDateRange(range)}
          >
            <Text
              style={[
                styles.dateRangeText,
                dateRange === range && styles.dateRangeTextActive,
              ]}
            >
              {range === '7d'
                ? 'Last 7 days'
                : range === '30d'
                ? 'Last 30 days'
                : range === '90d'
                ? 'Last 90 days'
                : 'All time'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Key Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.metricsGrid}>
          <MetricCard
            title="Conversion Rate"
            value={`${analytics.conversion_rate.toFixed(1)}%`}
            subtitle={`${analytics.total_submitted} of ${analytics.total_opens} visitors`}
            color="#10B981"
          />
          <MetricCard
            title="Completion Rate"
            value={`${analytics.completion_rate.toFixed(1)}%`}
            subtitle={`${analytics.total_submitted} completed`}
            color="#2563EB"
          />
          <MetricCard
            title="Avg. Time"
            value={formatTime(analytics.average_time_to_submit)}
            subtitle="to complete form"
            color="#F59E0B"
          />
          <MetricCard
            title="Media Upload"
            value={`${analytics.media_upload_rate.toFixed(0)}%`}
            subtitle="added photos/videos"
            color="#8B5CF6"
          />
        </View>
      </View>

      {/* Conversion Funnel */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conversion Funnel</Text>
        <View style={styles.funnelContainer}>
          <FunnelStep
            label="Link Opened"
            count={analytics.total_opens}
            percentage={100}
            color="#2563EB"
          />
          <FunnelStep
            label="Form Started"
            count={analytics.total_started}
            percentage={
              analytics.total_opens > 0
                ? (analytics.total_started / analytics.total_opens) * 100
                : 0
            }
            color="#3B82F6"
          />
          <FunnelStep
            label="Form Submitted"
            count={analytics.total_submitted}
            percentage={
              analytics.total_opens > 0
                ? (analytics.total_submitted / analytics.total_opens) * 100
                : 0
            }
            color="#60A5FA"
          />
        </View>
      </View>

      {/* Submission Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Submission Status</Text>
        <View style={styles.statusGrid}>
          <StatusCard
            status="New"
            count={analytics.submissions_by_status.new}
            color="#F59E0B"
          />
          <StatusCard
            status="Reviewing"
            count={analytics.submissions_by_status.reviewing}
            color="#2563EB"
          />
          <StatusCard
            status="Quoted"
            count={analytics.submissions_by_status.quoted}
            color="#8B5CF6"
          />
          <StatusCard
            status="Won"
            count={analytics.submissions_by_status.won}
            color="#10B981"
          />
          <StatusCard
            status="Lost"
            count={analytics.submissions_by_status.lost}
            color="#64748B"
          />
        </View>
      </View>

      {/* Source Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Traffic Sources</Text>
        <View style={styles.sourceList}>
          {Object.entries(analytics.submissions_by_source).map(([source, count]) => {
            const total = analytics.total_submitted;
            const percentage = total > 0 ? (count / total) * 100 : 0;

            return (
              <View key={source} style={styles.sourceRow}>
                <View style={styles.sourceInfo}>
                  <Text style={styles.sourceName}>
                    {source === 'web'
                      ? '🌐 Website'
                      : source === 'sms'
                      ? '💬 SMS Link'
                      : source === 'call'
                      ? '📞 Phone Call'
                      : '📤 Direct Share'}
                  </Text>
                  <Text style={styles.sourceCount}>
                    {count} ({percentage.toFixed(0)}%)
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[styles.progressFill, { width: `${percentage}%` }]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Insights */}
      {analytics.top_drop_off_question && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Insights</Text>
          <View style={styles.insightCard}>
            <Text style={styles.insightIcon}>💡</Text>
            <View style={styles.insightContent}>
              <Text style={styles.insightTitle}>High Drop-off Detected</Text>
              <Text style={styles.insightText}>
                Question "{analytics.top_drop_off_question}" has the lowest completion rate.
                Consider simplifying or making it optional.
              </Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// Metric Card Component
function MetricCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  color: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricSubtitle}>{subtitle}</Text>
    </View>
  );
}

// Funnel Step Component
function FunnelStep({
  label,
  count,
  percentage,
  color,
}: {
  label: string;
  count: number;
  percentage: number;
  color: string;
}) {
  return (
    <View style={styles.funnelStep}>
      <View style={styles.funnelBar}>
        <View
          style={[
            styles.funnelBarFill,
            { width: `${percentage}%`, backgroundColor: color },
          ]}
        />
      </View>
      <View style={styles.funnelInfo}>
        <Text style={styles.funnelLabel}>{label}</Text>
        <Text style={styles.funnelCount}>
          {count} ({percentage.toFixed(0)}%)
        </Text>
      </View>
    </View>
  );
}

// Status Card Component
function StatusCard({
  status,
  count,
  color,
}: {
  status: string;
  count: number;
  color: string;
}) {
  return (
    <View style={styles.statusCard}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={styles.statusCount}>{count}</Text>
      <Text style={styles.statusLabel}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
  },
  dateRangeSelector: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  dateRangeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  dateRangeButtonActive: {
    backgroundColor: '#2563EB',
  },
  dateRangeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  dateRangeTextActive: {
    color: '#FFFFFF',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  metricTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  metricSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
  },
  funnelContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  funnelStep: {
    marginBottom: 16,
  },
  funnelBar: {
    height: 32,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  funnelBarFill: {
    height: '100%',
  },
  funnelInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  funnelLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  funnelCount: {
    fontSize: 14,
    color: '#64748B',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  statusCount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  statusLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  sourceList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  sourceRow: {
    marginBottom: 16,
  },
  sourceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sourceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  sourceCount: {
    fontSize: 14,
    color: '#64748B',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563EB',
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  insightIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
  },
  insightText: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
});
