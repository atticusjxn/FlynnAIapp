import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';

export const DashboardScreen = () => {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  // Mock data for the planned layout
  const upcomingEvent = {
    time: 'Today, 3:30 PM',
    title: 'Site Visit - Johnson Plumbing',
    location: '123 Oak Street',
  };

  const recentActivity = {
    caller: 'Sarah',
    time: '1:45 PM',
    message: '"Can you come Friday at 9 AM?"',
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getUserName = () => {
    if (user?.email) {
      const name = user.email.split('@')[0];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    return 'there';
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Welcome Section */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>Welcome back, {getUserName()} 👋</Text>
      </View>

      {/* Upcoming Event Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="calendar-outline" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Upcoming Event</Text>
        </View>
        <View style={styles.upcomingEventCard}>
          <Text style={styles.eventTime}>{upcomingEvent.time}</Text>
          <Text style={styles.eventTitle}>{upcomingEvent.title}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.eventLocation}>{upcomingEvent.location}</Text>
          </View>
          <TouchableOpacity style={styles.callClientButton} activeOpacity={0.7}>
            <Ionicons name="call-outline" size={16} color={colors.primary} />
            <Text style={styles.callClientText}>Call client</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Most Recent Activity Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="call-outline" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Most Recent Activity</Text>
        </View>
        <TouchableOpacity style={styles.activityCard} activeOpacity={0.7}>
          <Text style={styles.activityHeader}>Call from {recentActivity.caller} - {recentActivity.time}</Text>
          <Text style={styles.activityMessage}>{recentActivity.message}</Text>
          <View style={styles.activityFooter}>
            <Text style={styles.reviewButton}>Review & Add to Calendar</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Quick Actions Section */}
      <View style={styles.section}>
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity style={styles.quickActionButton} activeOpacity={0.7}>
            <MaterialIcons name="file-upload" size={24} color={colors.primary} />
            <Text style={styles.quickActionText}>Upload Screenshot</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionButton} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
            <Text style={styles.quickActionText}>Quick Add Event</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  welcomeSection: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    marginBottom: spacing.md,
  },
  welcomeText: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginLeft: spacing.xs,
  },
  upcomingEventCard: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  eventTime: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
    marginBottom: spacing.xxs,
  },
  eventTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  eventLocation: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginLeft: spacing.xxs,
  },
  callClientButton: {
    backgroundColor: colors.primaryLight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  callClientText: {
    ...typography.label,
    color: colors.primary,
    marginLeft: spacing.xxs,
  },
  activityCard: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  activityHeader: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  activityMessage: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    fontStyle: 'italic',
  },
  activityFooter: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewButton: {
    ...typography.label,
    color: colors.primary,
    fontWeight: '600',
  },
  quickActionsContainer: {
    gap: spacing.md,
  },
  quickActionButton: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  quickActionText: {
    ...typography.button,
    color: colors.primary,
    marginLeft: spacing.xs,
  },
});