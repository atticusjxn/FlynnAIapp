import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { FlynnIcon } from '../ui/FlynnIcon';
import { spacing, typography, borderRadius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { DashboardActivity, DashboardActivityType, formatActivityTime } from '../../services/dashboardService';

interface ActivityHistoryModalProps {
  visible: boolean;
  activities: DashboardActivity[];
  loading?: boolean;
  onClose: () => void;
  onRefresh?: () => Promise<void> | void;
  onActivityPress?: (activity: DashboardActivity) => void;
  onNavigateToJob?: (jobId: string) => void;
  onCallClient?: (phone: string) => void;
}

export const ActivityHistoryModal: React.FC<ActivityHistoryModalProps> = ({
  visible,
  activities,
  loading = false,
  onClose,
  onRefresh,
  onActivityPress,
  onNavigateToJob,
  onCallClient,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<DashboardActivity | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    try {
      setRefreshing(true);
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleActivityPress = (activity: DashboardActivity) => {
    setSelectedActivity(activity);
    setShowDetails(true);
    onActivityPress?.(activity);
  };

  const handleBackToList = () => {
    setShowDetails(false);
    setSelectedActivity(null);
  };

  const handleCallClient = (phone: string) => {
    onCallClient?.(phone);
  };

  const handleViewJob = (jobId: string) => {
    setShowDetails(false);
    setSelectedActivity(null);
    onNavigateToJob?.(jobId);
    onClose();
  };

  const iconColors: Record<DashboardActivityType, string> = {
    job_created: colors.warning,
    job_completed: colors.success,
    job_updated: colors.primary,
    communication_sent: colors.primary,
    calendar_synced: colors.primary,
    call_recorded: colors.success,
  };

  const typeLabels: Record<DashboardActivityType, string> = {
    job_created: 'Job Created',
    job_completed: 'Job Completed',
    job_updated: 'Job Updated',
    communication_sent: 'Communication',
    calendar_synced: 'Calendar',
    call_recorded: 'Call Recorded',
  };

  const getActivityIcon = (activity: DashboardActivity) => ({
    name: activity.icon,
    color: iconColors[activity.type] ?? colors.gray500,
  });

  const getActivityTypeLabel = (type: DashboardActivity['type']) => typeLabels[type] ?? type;

  const renderActivityItem = (activity: DashboardActivity) => {
    const iconConfig = getActivityIcon(activity);
    
    return (
      <TouchableOpacity 
        key={activity.id} 
        style={styles.activityItem}
        onPress={() => handleActivityPress(activity)}
        activeOpacity={0.7}
      >
        <View style={[styles.activityIconContainer, { backgroundColor: iconConfig.color + '20' }]}>
          <FlynnIcon name={iconConfig.name} size={20} color={iconConfig.color} />
        </View>
        
        <View style={styles.activityContent}>
          <View style={styles.activityHeader}>
            <View style={styles.activityTitleRow}>
              <Text style={styles.activityType}>{getActivityTypeLabel(activity.type)}</Text>
              <Text style={styles.activityTime}>{formatActivityTime(activity.timestamp)}</Text>
            </View>
            <Text style={styles.activityTitle}>{activity.title}</Text>
          </View>
          
          <Text style={styles.activityDescription}>{activity.description}</Text>
          
          {/* Metadata display */}
          {activity.metadata && (
            <View style={styles.activityMetadata}>
              {activity.metadata.clientName && (
                <View style={styles.metadataItem}>
                  <FlynnIcon name="person-outline" size={14} color={colors.textTertiary} />
                  <Text style={styles.metadataText}>{activity.metadata.clientName}</Text>
                </View>
              )}
              {(activity.metadata.platform || activity.metadata.channel) && (
                <View style={styles.metadataItem}>
                  <FlynnIcon name="apps-outline" size={14} color={colors.textTertiary} />
                  <Text style={styles.metadataText}>{activity.metadata.platform || activity.metadata.channel}</Text>
                </View>
              )}
            </View>
          )}
        </View>
        
        {/* Chevron indicator for clickable items */}
        <View style={styles.chevronContainer}>
          <FlynnIcon name="chevron-forward" size={16} color={colors.gray400} />
        </View>
      </TouchableOpacity>
    );
  };

  const groupActivitiesByDate = (activityEntries: DashboardActivity[]) => {
    const groups: { [key: string]: DashboardActivity[] } = {};

    activityEntries.forEach(activity => {
      const date = new Date(activity.timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let dateKey: string;
      if (date.toDateString() === today.toDateString()) {
        dateKey = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        dateKey = 'Yesterday';
      } else {
        dateKey = date.toLocaleDateString('en-US', { 
          weekday: 'long',
          month: 'short', 
          day: 'numeric' 
        });
      }
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(activity);
    });
    
    return groups;
  };

  const activityGroups = groupActivitiesByDate(activities);

  const getActivityTypeColor = (type: DashboardActivity['type']) => {
    switch (type) {
      case 'job_created':
        return colors.warning;
      case 'job_completed':
        return colors.success;
      case 'job_updated':
        return colors.primary;
      case 'communication_sent':
        return colors.primary;
      case 'calendar_synced':
        return colors.primary;
      case 'call_recorded':
        return colors.success;
      default:
        return colors.gray500;
    }
  };

  const getActivityTypeBackground = (type: DashboardActivity['type']) => {
    return getActivityTypeColor(type) + '15';
  };

  const renderActivityDetails = () => {
    if (!selectedActivity) return null;

    const renderActionButtons = () => {
      const buttons = [];

      // Call client button
      if (selectedActivity.metadata?.clientPhone) {
        buttons.push(
          <TouchableOpacity
            key="call"
            style={[styles.actionButton, { backgroundColor: colors.success + '15' }]}
            onPress={() => handleCallClient(selectedActivity.metadata!.clientPhone!)}
          >
            <FlynnIcon name="call-outline" size={16} color={colors.success} />
            <Text style={[styles.actionButtonText, { color: colors.success }]}>
              Call {selectedActivity.metadata.clientName?.split(' ')[0]}
            </Text>
          </TouchableOpacity>
        );
      }

      // View job button
      if (selectedActivity.metadata?.jobId) {
        buttons.push(
          <TouchableOpacity
            key="job"
            style={[styles.actionButton, { backgroundColor: colors.primary + '15' }]}
            onPress={() => handleViewJob(selectedActivity.metadata!.jobId!)}
          >
            <FlynnIcon name="briefcase-outline" size={16} color={colors.primary} />
            <Text style={[styles.actionButtonText, { color: colors.primary }]}>
              View Job Details
            </Text>
          </TouchableOpacity>
        );
      }

      return buttons.length > 0 ? (
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionButtons}>
            {buttons}
          </View>
        </View>
      ) : null;
    };

    const renderActivityMetadata = () => {
      if (!selectedActivity.metadata) return null;

      const metadata = selectedActivity.metadata;
      const items = [];

      if (metadata.clientName) {
        items.push({ label: 'Client', value: metadata.clientName, icon: 'person-outline' });
      }

      if (metadata.clientPhone) {
        items.push({ 
          label: 'Phone', 
          value: metadata.clientPhone, 
          icon: 'call-outline',
          actionable: true 
        });
      }

      if (metadata.platform || metadata.channel) {
        items.push({ label: 'Channel', value: metadata.platform || metadata.channel || '', icon: 'globe-outline' });
      }

      if (metadata.status) {
        items.push({ label: 'Status', value: metadata.status, icon: 'information-outline' });
      }

      if (items.length === 0) return null;

      return (
        <View style={styles.metadataSection}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.metadataItems}>
            {items.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.metadataItem}
                onPress={item.actionable && item.label === 'Phone' ? () => handleCallClient(selectedActivity.metadata!.clientPhone!) : undefined}
                activeOpacity={item.actionable ? 0.7 : 1}
              >
                <View style={styles.metadataIcon}>
                  <FlynnIcon name={item.icon as any} size={16} color={colors.gray600} />
                </View>
                <View style={styles.metadataContent}>
                  <Text style={styles.metadataLabel}>{item.label}</Text>
                  <Text style={[
                    styles.metadataValue,
                    item.actionable && { color: colors.primary }
                  ]}>
                    {item.value}
                  </Text>
                </View>
                {item.actionable && (
                  <FlynnIcon name="chevron-forward" size={16} color={colors.gray400} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    };

    return (
      <View style={styles.detailsContainer}>
        {/* Header */}
        <View style={styles.detailsHeader}>
          <TouchableOpacity onPress={handleBackToList} style={styles.backButton}>
            <FlynnIcon name="chevron-back" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={[
            styles.detailsActivityIcon,
            { backgroundColor: getActivityTypeBackground(selectedActivity.type) }
          ]}>
            <FlynnIcon 
              name={selectedActivity.icon as any} 
              size={24} 
              color={getActivityTypeColor(selectedActivity.type)} 
            />
          </View>
          <View style={styles.detailsHeaderText}>
            <Text style={styles.detailsTitle}>{selectedActivity.title}</Text>
            <Text style={styles.detailsTimestamp}>
              {formatActivityTime(selectedActivity.timestamp)}
            </Text>
          </View>
        </View>

        <ScrollView 
          style={styles.detailsContent} 
          showsVerticalScrollIndicator={false}
        >
          {/* Description */}
          <View style={styles.descriptionSection}>
            <Text style={styles.description}>{selectedActivity.description}</Text>
          </View>

          {/* Metadata */}
          {renderActivityMetadata()}

          {/* Action Buttons */}
          {renderActionButtons()}

          {/* Context Information */}
          <View style={styles.contextSection}>
            <Text style={styles.sectionTitle}>Activity Context</Text>
            <View style={styles.contextCard}>
              <Text style={styles.contextText}>
                {selectedActivity.type === 'call_recorded' && 
                  'This call was automatically recorded and transcribed by Flynn AI. Key details are captured for easy reference.'
                }
                {selectedActivity.type === 'job_created' && 
                  'A new event was captured for your business. Review and assign it from the Events tab.'
                }
                {selectedActivity.type === 'job_completed' && 
                  'This event has been marked as completed. Send any follow-up communications or invoices as needed.'
                }
                {selectedActivity.type === 'job_updated' && 
                  'Event details were updated. Double-check the latest status to keep work on track.'
                }
                {selectedActivity.type === 'communication_sent' && 
                  'Flynn AI sent this communication to keep your client informed.'
                }
                {selectedActivity.type === 'calendar_synced' && 
                  'This event summary is ready in Flynn so your team never misses an appointment.'
                }
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="pageSheet"
      onRequestClose={showDetails ? handleBackToList : onClose}
    >
      <View style={styles.container}>
        {showDetails ? (
          renderActivityDetails()
        ) : (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Activity History</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <FlynnIcon name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.content}
              showsVerticalScrollIndicator={false}
              refreshControl={
                onRefresh
                  ? (
                    <RefreshControl
                      refreshing={refreshing || loading}
                      onRefresh={handleRefresh}
                    />
                  )
                  : undefined
              }
            >
              {loading && activities.length === 0 ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.emptyDescription}>Loading recent activity…</Text>
                </View>
              ) : activities.length === 0 ? (
                <View style={styles.emptyState}>
                  <FlynnIcon name="time-outline" size={48} color={colors.gray400} />
                  <Text style={styles.emptyTitle}>No Activity Yet</Text>
                  <Text style={styles.emptyDescription}>
                    Recent activity will appear here as you process calls, create jobs, and send communications.
                  </Text>
                </View>
              ) : (
                Object.entries(activityGroups).map(([dateKey, dayActivities]) => (
                  <View key={dateKey} style={styles.dateSection}>
                    <Text style={styles.dateHeader}>{dateKey}</Text>
                    {dayActivities.map(renderActivityItem)}
                  </View>
                ))
              )}
            </ScrollView>
          </>
        )}
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  
  closeButton: {
    padding: spacing.xs,
  },
  
  content: {
    flex: 1,
    paddingVertical: spacing.md,
  },
  
  dateSection: {
    marginBottom: spacing.lg,
  },
  
  dateHeader: {
    ...typography.h4,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.gray50,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  
  activityItem: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  
  activityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  
  activityContent: {
    flex: 1,
  },
  
  chevronContainer: {
    justifyContent: 'center',
    paddingLeft: spacing.sm,
  },
  
  activityHeader: {
    marginBottom: spacing.xs,
  },
  
  activityTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxxs,
  },
  
  activityType: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  activityTime: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  
  activityTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  
  activityDescription: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  
  activityMetadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  
  metadataText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  
  thumbnailContainer: {
    marginTop: spacing.sm,
  },
  
  thumbnailPlaceholder: {
    backgroundColor: colors.gray100,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  
  thumbnailText: {
    ...typography.caption,
    color: colors.gray400,
    marginTop: spacing.xs,
  },
  
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.lg,
  },
  
  emptyTitle: {
    ...typography.h3,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  
  emptyDescription: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Details view styles
  detailsContainer: {
    flex: 1,
  },
  
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  
  backButton: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  
  detailsActivityIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  
  detailsHeaderText: {
    flex: 1,
  },
  
  detailsTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.xxxs,
  },
  
  detailsTimestamp: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  
  detailsContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  
  descriptionSection: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  
  description: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  
  sectionTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  
  metadataSection: {
    marginBottom: spacing.lg,
  },
  
  metadataItems: {
    backgroundColor: colors.gray50,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  
  metadataIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  
  metadataContent: {
    flex: 1,
  },
  
  metadataLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.xxxs,
  },
  
  metadataValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  
  actionsSection: {
    marginBottom: spacing.lg,
  },
  
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  
  actionButtonText: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  
  contextSection: {
    marginBottom: spacing.lg,
  },
  
  contextCard: {
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  
  contextText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    lineHeight: 22,
  },
});
