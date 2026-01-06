import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { FlynnIcon } from '../ui/FlynnIcon';
import { spacing, typography, borderRadius, shadows } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { businessTypes } from '../../context/OnboardingContext';

export interface Job {
  id: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  serviceType: string;
  description: string;
  date: string;
  time: string;
  location: string;
  status: 'pending' | 'in-progress' | 'complete';
  businessType: string;
  notes?: string;
  estimatedDuration?: string;
  createdAt: string;
  source?: 'voicemail' | 'upload' | 'manual' | 'call';
  voicemailTranscript?: string;
  voicemailRecordingUrl?: string;
  followUpDraft?: string;
  capturedAt?: string;
  lastFollowUpAt?: string;
}

interface JobCardProps {
  job: Job;
  onPress?: (job: Job) => void;
  previewMode?: boolean; // When true, card is view-only for demonstration
}

const getStatusColor = (status: Job['status'], colors: any) => {
  switch (status) {
    case 'pending':
      return {
        background: colors.warningLight,
        text: colors.warning,
        border: colors.warning,
      };
    case 'in-progress':
      return {
        background: colors.primaryLight,
        text: colors.primary,
        border: colors.primary,
      };
    case 'complete':
      return {
        background: colors.successLight,
        text: colors.success,
        border: colors.success,
      };
    default:
      return {
        background: colors.gray100,
        text: colors.gray600,
        border: colors.gray300,
      };
  }
};

const getStatusLabel = (status: Job['status']) => {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'in-progress':
      return 'In Progress';
    case 'complete':
      return 'Complete';
    default:
      return status;
  }
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  }
};

const formatTime = (timeString: string) => {
  try {
    // Handle various time formats
    const time = new Date(`1970-01-01T${timeString}`);
    return time.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  } catch {
    return timeString;
  }
};

export const JobCard: React.FC<JobCardProps> = ({ job, onPress, previewMode = false }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const statusColors = getStatusColor(job.status, colors);
  const sourceMeta = React.useMemo(() => {
    switch (job.source) {
      case 'voicemail':
        return {
          label: 'Voicemail lead',
          icon: 'mic-outline' as const,
          background: '#fef3c7',
          text: '#92400e',
        };
      case 'upload':
        return {
          label: 'Screenshot import',
          icon: 'image-outline' as const,
          background: '#e0f2fe',
          text: '#0369a1',
        };
      case 'call':
        return {
          label: 'Live call',
          icon: 'call-outline' as const,
          background: '#ede9fe',
          text: '#5b21b6',
        };
      case 'manual':
        return {
          label: 'Manual entry',
          icon: 'create-outline' as const,
          background: '#f1f5f9',
          text: '#475569',
        };
      default:
        return null;
    }
  }, [job.source]);

  const businessMeta = React.useMemo(() => {
    const entry = businessTypes.find(type => type.id === job.businessType);
    if (!entry) {
      return null;
    }

    const palette: Record<string, { background: string; text: string }> = {
      home_property: { background: '#fef3c7', text: '#92400e' },
      personal_beauty: { background: '#fdf2f8', text: '#9d174d' },
      automotive: { background: '#eff6ff', text: '#1d4ed8' },
      business_professional: { background: '#ede9fe', text: '#5b21b6' },
      moving_delivery: { background: '#e0f2fe', text: '#0c4a6e' },
      other: { background: colors.gray100, text: colors.gray600 },
    };

    const paletteKey = job.businessType && palette[job.businessType] ? job.businessType : 'other';
    return {
      label: entry.label,
      background: palette[paletteKey].background,
      text: palette[paletteKey].text,
    };
  }, [job.businessType, colors.gray100, colors.gray600]);

  return (
    <TouchableOpacity
      style={[styles.card, previewMode && styles.previewCard]}
      onPress={previewMode ? undefined : () => onPress?.(job)}
      activeOpacity={previewMode ? 1 : 0.7}
      disabled={previewMode}
    >
      <View style={styles.header}>
        <View style={styles.clientInfo}>
          <Text style={styles.clientName}>{job.clientName}</Text>
          <View style={styles.serviceRow}>
            <Text style={styles.serviceType}>{job.serviceType}</Text>
            {businessMeta && (
              <View style={[styles.businessChip, { backgroundColor: businessMeta.background }]}
              >
                <Text style={[styles.businessChipText, { color: businessMeta.text }]}>
                  {businessMeta.label}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={[
          styles.statusBadge,
          { 
            backgroundColor: statusColors.background,
            borderColor: statusColors.border,
          }
        ]}>
          <Text style={[
            styles.statusText,
            { color: statusColors.text }
          ]}>
            {getStatusLabel(job.status)}
          </Text>
        </View>
      </View>

      {sourceMeta && (
        <View
          style={[
            styles.sourceBadge,
            {
              backgroundColor: sourceMeta.background,
            },
          ]}
        >
          <FlynnIcon name={sourceMeta.icon} size={14} color={sourceMeta.text} />
          <Text style={[styles.sourceBadgeText, { color: sourceMeta.text }]}>
            {sourceMeta.label}
          </Text>
        </View>
      )}

      <Text style={styles.description} numberOfLines={2}>
        {job.description}
      </Text>

      {job.voicemailTranscript && (
        <Text style={styles.transcriptSnippet} numberOfLines={3}>
          “{job.voicemailTranscript.trim()}”
        </Text>
      )}

      <View style={styles.detailsRow}>
        <View style={styles.dateTimeContainer}>
          <FlynnIcon name="calendar-outline" size={16} color={colors.gray500} />
          <Text style={styles.dateTime}>
            {formatDate(job.date)} at {formatTime(job.time)}
          </Text>
        </View>
        {job.estimatedDuration && (
          <View style={styles.durationContainer}>
            <FlynnIcon name="timer-outline" size={16} color={colors.gray500} />
            <Text style={styles.duration}>{job.estimatedDuration}</Text>
          </View>
        )}
      </View>

      <View style={styles.locationRow}>
        <FlynnIcon name="location-outline" size={16} color={colors.gray500} />
        <Text style={styles.location} numberOfLines={1}>
          {job.location}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },

  previewCard: {
    opacity: 0.9,
    borderWidth: 2,
    borderColor: '#F59E0B',
    borderStyle: 'dashed',
  },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },

  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxxs,
    borderRadius: borderRadius.full,
    marginBottom: spacing.xs,
    gap: spacing.xxxs,
  },

  sourceBadgeText: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 11,
  },
  
  clientInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  
  clientName: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.xxxs,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  serviceType: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  businessChip: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxxs,
    borderRadius: borderRadius.sm,
  },
  businessChipText: {
    ...typography.caption,
    fontWeight: '600',
  },
  
  statusBadge: {
    paddingVertical: spacing.xxxs,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  
  statusText: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 11,
  },
  
  description: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },

  transcriptSnippet: {
    fontStyle: 'italic',
    color: colors.gray600,
    marginBottom: spacing.sm,
    fontSize: 13,
  },
  
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  
  dateTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  
  dateTime: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500',
    marginLeft: spacing.xxs,
  },
  
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.md,
  },
  
  duration: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginLeft: spacing.xxs,
  },
  
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  location: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginLeft: spacing.xxs,
    flex: 1,
  },
});
