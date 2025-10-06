import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Linking,
  Alert,
} from 'react-native';
import { FlynnIcon } from '../ui/FlynnIcon';
import { spacing, typography, borderRadius, shadows } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { DashboardActivity, formatActivityTime } from '../../services/dashboardService';

interface ActivityDetailsModalProps {
  visible: boolean;
  activity: DashboardActivity | null;
  onClose: () => void;
  onNavigateToJob?: (jobId: string) => void;
  onCallClient?: (phone: string) => void;
}

export const ActivityDetailsModal: React.FC<ActivityDetailsModalProps> = ({
  visible,
  activity,
  onClose,
  onNavigateToJob,
  onCallClient,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  if (!activity) return null;

  const getActivityTypeColor = (type: DashboardActivity['type']) => {
    switch (type) {
      case 'call_recorded':
        return colors.success;
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
      default:
        return colors.gray500;
    }
  };

  const getActivityTypeBackground = (type: DashboardActivity['type']) => {
    return getActivityTypeColor(type) + '15';
  };

  const handleCallClient = () => {
    if (activity.metadata?.clientPhone) {
      onCallClient?.(activity.metadata.clientPhone);
    }
  };

  const handleViewJob = () => {
    if (activity.metadata?.jobId) {
      onNavigateToJob?.(activity.metadata.jobId);
      onClose();
    }
  };

  const renderActionButtons = () => {
    const buttons = [];

    // Call client button
    if (activity.metadata?.clientPhone) {
      buttons.push(
        <TouchableOpacity
          key="call"
          style={[styles.actionButton, { backgroundColor: colors.success + '15' }]}
          onPress={handleCallClient}
        >
          <FlynnIcon name="call-outline" size={16} color={colors.success} />
          <Text style={[styles.actionButtonText, { color: colors.success }]}>
            Call {activity.metadata.clientName?.split(' ')[0]}
          </Text>
        </TouchableOpacity>
      );
    }

    // View job button
    if (activity.metadata?.jobId) {
      buttons.push(
        <TouchableOpacity
          key="job"
          style={[styles.actionButton, { backgroundColor: colors.primary + '15' }]}
          onPress={handleViewJob}
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
    if (!activity.metadata) return null;

    const metadata = activity.metadata;
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
      items.push({
        label: 'Channel',
        value: metadata.platform || metadata.channel || '',
        icon: 'globe-outline',
      });
    }

    if (metadata.status) {
      items.push({
        label: 'Status',
        value: metadata.status,
        icon: 'information-outline',
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
              onPress={item.actionable && item.label === 'Phone' ? handleCallClient : undefined}
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

  const renderVoicemailPreview = () => {
    const transcript = activity.metadata?.voicemailTranscript;
    const recordingUrl = activity.metadata?.voicemailRecordingUrl;

    if (!transcript && !recordingUrl) {
      return null;
    }

    const handlePlay = () => {
      if (!recordingUrl) return;
      Linking.openURL(recordingUrl).catch(() => {
        Alert.alert('Playback unavailable', 'Could not open the voicemail audio. Try again later.');
      });
    };

    return (
      <View style={styles.voicemailSection}>
        <Text style={styles.sectionTitle}>Voicemail</Text>
        {transcript ? (
          <Text style={styles.voicemailTranscript}>
            “{transcript.trim()}”
          </Text>
        ) : (
          <Text style={styles.voicemailPlaceholder}>
            Transcript not available yet. We’ll surface it as soon as processing finishes.
          </Text>
        )}
        {recordingUrl && (
          <TouchableOpacity
            style={[styles.voicemailButton, { backgroundColor: colors.primary + '12' }]}
            onPress={handlePlay}
            activeOpacity={0.7}
          >
            <FlynnIcon name="play-outline" size={16} color={colors.primary} />
            <Text style={[styles.voicemailButtonText, { color: colors.primary }]}>Listen to recording</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[
              styles.activityTypeIcon,
              { backgroundColor: getActivityTypeBackground(activity.type) }
            ]}>
              <FlynnIcon 
                name={activity.icon as any} 
                size={24} 
                color={getActivityTypeColor(activity.type)} 
              />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>{activity.title}</Text>
              <Text style={styles.timestamp}>
                {formatActivityTime(activity.timestamp)}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <FlynnIcon name="close" size={24} color={colors.gray600} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.content} 
            showsVerticalScrollIndicator={false}
          >
            {/* Description */}
            <View style={styles.descriptionSection}>
              <Text style={styles.description}>{activity.description}</Text>
            </View>

            {/* Metadata */}
            {renderActivityMetadata()}

            {/* Voicemail preview */}
            {renderVoicemailPreview()}

            {/* Action Buttons */}
            {renderActionButtons()}

            {/* Context Information */}
            <View style={styles.contextSection}>
              <Text style={styles.sectionTitle}>Activity Context</Text>
              <View style={styles.contextCard}>
                <Text style={styles.contextText}>
                  {activity.type === 'call_recorded' && 
                    'This call was automatically recorded and transcribed by Flynn AI. The key details have been captured for easy reference.'
                  }
                  {activity.type === 'job_created' && 
                    'A new event was created in your system. You can view and manage the event details from the Events tab.'
                  }
                  {activity.type === 'job_completed' && 
                    'This event has been marked as completed. You can now send invoices or follow-up communications to the client.'
                  }
                  {activity.type === 'job_updated' && 
                    'Details for this event were updated. Review the latest status to keep your workflow on track.'
                  }
                  {activity.type === 'communication_sent' && 
                    'Flynn AI automatically sent this communication to keep your client informed about their appointment.'
                  }
                  {activity.type === 'calendar_synced' && 
                    'This appointment summary is ready inside Flynn so you can stay on top of every booking.'
                  }
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  
  modalContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: Dimensions.get('window').height * 0.85,
    paddingBottom: spacing.lg,
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  
  activityTypeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  
  headerText: {
    flex: 1,
  },
  
  title: {
    ...typography.h4,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.xxxs,
  },
  
  timestamp: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  
  closeButton: {
    padding: spacing.xs,
  },
  
  content: {
    paddingHorizontal: spacing.lg,
    maxHeight: 500,
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

  voicemailSection: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },

  voicemailTranscript: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 22,
  },

  voicemailPlaceholder: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },

  voicemailButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },

  voicemailButtonText: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
});
