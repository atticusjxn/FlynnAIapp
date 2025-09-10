import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, shadows } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

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
}

interface JobCardProps {
  job: Job;
  onPress: (job: Job) => void;
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

export const JobCard: React.FC<JobCardProps> = ({ job, onPress }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const statusColors = getStatusColor(job.status, colors);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(job)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.clientInfo}>
          <Text style={styles.clientName}>{job.clientName}</Text>
          <Text style={styles.serviceType}>{job.serviceType}</Text>
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

      <Text style={styles.description} numberOfLines={2}>
        {job.description}
      </Text>

      <View style={styles.detailsRow}>
        <View style={styles.dateTimeContainer}>
          <Ionicons name="calendar-outline" size={16} color={colors.gray500} />
          <Text style={styles.dateTime}>
            {formatDate(job.date)} at {formatTime(job.time)}
          </Text>
        </View>
        {job.estimatedDuration && (
          <View style={styles.durationContainer}>
            <Ionicons name="timer-outline" size={16} color={colors.gray500} />
            <Text style={styles.duration}>{job.estimatedDuration}</Text>
          </View>
        )}
      </View>

      <View style={styles.locationRow}>
        <Ionicons name="location-outline" size={16} color={colors.gray500} />
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
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
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
  
  serviceType: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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