import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { Activity, mockActivities, formatActivityTime } from '../../data/mockActivities';

interface ActivityHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  onActivityPress?: (activity: Activity) => void;
  onNavigateToJob?: (jobId: string) => void;
  onCallClient?: (phone: string) => void;
}

export const ActivityHistoryModal: React.FC<ActivityHistoryModalProps> = ({
  visible,
  onClose,
  onActivityPress,
  onNavigateToJob,
  onCallClient,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [refreshing, setRefreshing] = useState(false);
  const [activities] = useState<Activity[]>(mockActivities);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh - in real app, this would fetch from API
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const handleActivityPress = (activity: Activity) => {
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
      <TouchableOpacity 
        key={activity.id} 
        style={styles.activityItem}
        onPress={() => handleActivityPress(activity)}
        activeOpacity={0.7}
      >
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
        
        {/* Chevron indicator for clickable items */}
        <View style={styles.chevronContainer}>
          <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
        </View>
      </TouchableOpacity>
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

  const getActivityTypeColor = (type: Activity['type']) => {
    switch (type) {
      case 'screenshot_processed':
        return colors.primary;
      case 'call_recorded':
        return colors.success;
      case 'job_created':
        return colors.warning;
      case 'job_completed':
        return colors.success;
      case 'communication_sent':
        return colors.primary;
      case 'calendar_synced':
        return colors.primary;
      case 'invoice_sent':
        return colors.success;
      case 'status_changed':
        return colors.warning;
      default:
        return colors.gray500;
    }
  };

  const getActivityTypeBackground = (type: Activity['type']) => {
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
            <Ionicons name="call-outline" size={16} color={colors.success} />
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
            <Ionicons name="briefcase-outline" size={16} color={colors.primary} />
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

      if (metadata.platform) {
        items.push({ label: 'Platform', value: metadata.platform, icon: 'globe-outline' });
      }

      if (metadata.amount) {
        items.push({ 
          label: 'Amount', 
          value: `$${metadata.amount}`, 
          icon: 'cash-outline' 
        });
      }

      if (metadata.oldStatus && metadata.newStatus) {
        items.push({ 
          label: 'Status Change', 
          value: `${metadata.oldStatus} → ${metadata.newStatus}`, 
          icon: 'refresh-outline' 
        });
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
                  <Ionicons name={item.icon as any} size={16} color={colors.gray600} />
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
                  <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
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
            <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={[
            styles.detailsActivityIcon,
            { backgroundColor: getActivityTypeBackground(selectedActivity.type) }
          ]}>
            <Ionicons 
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
                {selectedActivity.type === 'screenshot_processed' && 
                  'Flynn AI automatically processed your screenshot and extracted the key information. You can review the details and create a job if needed.'
                }
                {selectedActivity.type === 'call_recorded' && 
                  'This call was automatically recorded and transcribed by Flynn AI. The key details have been captured for easy reference.'
                }
                {selectedActivity.type === 'job_created' && 
                  'A new job was created in your system. You can view and manage the job details from the Jobs tab.'
                }
                {selectedActivity.type === 'job_completed' && 
                  'This job has been marked as completed. You can now send invoices or follow-up communications to the client.'
                }
                {selectedActivity.type === 'communication_sent' && 
                  'Flynn AI automatically sent this communication to keep your client informed about their appointment.'
                }
                {selectedActivity.type === 'calendar_synced' && 
                  'This appointment has been synced with your connected calendar platform for better schedule management.'
                }
                {selectedActivity.type === 'invoice_sent' && 
                  'Invoice has been generated and sent through your connected accounting software.'
                }
                {selectedActivity.type === 'status_changed' && 
                  'Job status was updated to reflect the current progress of the work.'
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