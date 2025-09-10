import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, shadows } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { Activity, mockActivities, formatActivityTime } from '../../data/mockActivities';

interface ActivityHistoryModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ActivityHistoryModal: React.FC<ActivityHistoryModalProps> = ({
  visible,
  onClose,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [refreshing, setRefreshing] = useState(false);
  const [activities, setActivities] = useState<Activity[]>(mockActivities);

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh - in real app, this would fetch from API
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const getActivityIcon = (activity: Activity) => {
    const iconColors = {
      screenshot_processed: colors.primary,
      call_recorded: colors.success,
      job_created: colors.warning,
      job_completed: colors.success,
      communication_sent: colors.primary,
      calendar_synced: colors.warning,
      invoice_sent: colors.success,
      status_changed: colors.primary,
    };

    return {
      name: activity.icon as any,
      color: iconColors[activity.type] || colors.gray500,
    };
  };

  const getActivityTypeLabel = (type: Activity['type']) => {
    const labels = {
      screenshot_processed: 'Screenshot',
      call_recorded: 'Call',
      job_created: 'Job Created',
      job_completed: 'Job Complete',
      communication_sent: 'Message',
      calendar_synced: 'Calendar',
      invoice_sent: 'Invoice',
      status_changed: 'Status Update',
    };
    return labels[type] || type;
  };

  const renderActivityItem = (activity: Activity) => {
    const iconConfig = getActivityIcon(activity);
    
    return (
      <View key={activity.id} style={styles.activityItem}>
        <View style={[styles.activityIconContainer, { backgroundColor: iconConfig.color + '20' }]}>
          <Ionicons name={iconConfig.name} size={20} color={iconConfig.color} />
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
                  <Ionicons name="person-outline" size={14} color={colors.textTertiary} />
                  <Text style={styles.metadataText}>{activity.metadata.clientName}</Text>
                </View>
              )}
              {activity.metadata.amount && (
                <View style={styles.metadataItem}>
                  <Ionicons name="card-outline" size={14} color={colors.textTertiary} />
                  <Text style={styles.metadataText}>${activity.metadata.amount}</Text>
                </View>
              )}
              {activity.metadata.platform && (
                <View style={styles.metadataItem}>
                  <Ionicons name="apps-outline" size={14} color={colors.textTertiary} />
                  <Text style={styles.metadataText}>{activity.metadata.platform}</Text>
                </View>
              )}
            </View>
          )}
          
          {/* Thumbnail for screenshots */}
          {activity.type === 'screenshot_processed' && activity.metadata?.thumbnailUrl && (
            <View style={styles.thumbnailContainer}>
              <View style={styles.thumbnailPlaceholder}>
                <Ionicons name="image" size={24} color={colors.gray400} />
                <Text style={styles.thumbnailText}>Screenshot Preview</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  const groupActivitiesByDate = (activities: Activity[]) => {
    const groups: { [key: string]: Activity[] } = {};
    
    activities.forEach(activity => {
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Activity History</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {Object.entries(activityGroups).map(([dateKey, dayActivities]) => (
            <View key={dateKey} style={styles.dateSection}>
              <Text style={styles.dateHeader}>{dateKey}</Text>
              {dayActivities.map(renderActivityItem)}
            </View>
          ))}
          
          {activities.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={48} color={colors.gray400} />
              <Text style={styles.emptyTitle}>No Activity Yet</Text>
              <Text style={styles.emptyDescription}>
                Your business activity will appear here as you process screenshots, record calls, and manage jobs.
              </Text>
            </View>
          )}
        </ScrollView>
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
  
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
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
});