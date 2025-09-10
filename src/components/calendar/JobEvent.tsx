import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { Job } from '../jobs/JobCard';

interface JobEventProps {
  job: Job;
  onPress: (job: Job) => void;
  variant?: 'compact' | 'medium' | 'full';
  style?: any;
}

export const JobEvent: React.FC<JobEventProps> = ({
  job,
  onPress,
  variant = 'medium',
  style,
}) => {
  const getStatusColor = (status: Job['status']) => {
    switch (status) {
      case 'pending':
        return colors.warning;
      case 'in-progress':
        return colors.primary;
      case 'complete':
        return colors.success;
      default:
        return colors.gray400;
    }
  };

  const getStatusIcon = (status: Job['status']) => {
    switch (status) {
      case 'pending':
        return 'time-outline';
      case 'in-progress':
        return 'play-circle-outline';
      case 'complete':
        return 'checkmark-circle-outline';
      default:
        return 'ellipse-outline';
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

  const renderCompactView = () => (
    <TouchableOpacity
      style={[styles.compactContainer, style]}
      onPress={() => onPress(job)}
      activeOpacity={0.7}
    >
      <View style={[
        styles.compactBar,
        { backgroundColor: getStatusColor(job.status) + '20' }
      ]}>
        <View style={[
          styles.compactStatusLine,
          { backgroundColor: getStatusColor(job.status) }
        ]} />
        <Text
          style={[styles.compactText, { color: getStatusColor(job.status) }]}
          numberOfLines={1}
        >
          {job.time} {job.clientName}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderMediumView = () => (
    <TouchableOpacity
      style={[
        styles.mediumContainer,
        { 
          backgroundColor: getStatusColor(job.status) + '15',
          borderLeftColor: getStatusColor(job.status),
        },
        style
      ]}
      onPress={() => onPress(job)}
      activeOpacity={0.7}
    >
      <View style={styles.mediumHeader}>
        <Text style={[styles.mediumTime, { color: getStatusColor(job.status) }]}>
          {job.time}
        </Text>
        <View style={[
          styles.mediumStatusDot,
          { backgroundColor: getStatusColor(job.status) }
        ]} />
      </View>
      
      <Text style={styles.mediumClient} numberOfLines={1}>
        {job.clientName}
      </Text>
      
      <Text style={styles.mediumService} numberOfLines={1}>
        {job.serviceType}
      </Text>
    </TouchableOpacity>
  );

  const renderFullView = () => (
    <TouchableOpacity
      style={[styles.fullContainer, style]}
      onPress={() => onPress(job)}
      activeOpacity={0.7}
    >
      <View style={styles.fullHeader}>
        <View style={styles.fullTimeContainer}>
          <Ionicons name="time-outline" size={16} color={colors.primary} />
          <Text style={styles.fullTime}>{job.time}</Text>
        </View>
        
        <View style={styles.fullStatusContainer}>
          <Ionicons 
            name={getStatusIcon(job.status) as any} 
            size={16} 
            color={getStatusColor(job.status)} 
          />
          <Text style={[styles.fullStatus, { color: getStatusColor(job.status) }]}>
            {getStatusLabel(job.status)}
          </Text>
        </View>
      </View>

      <Text style={styles.fullClient}>{job.clientName}</Text>
      <Text style={styles.fullService}>{job.serviceType}</Text>
      
      <View style={styles.fullDetails}>
        <View style={styles.fullDetailRow}>
          <Ionicons name="location-outline" size={14} color={colors.gray500} />
          <Text style={styles.fullDetailText} numberOfLines={1}>
            {job.location}
          </Text>
        </View>
        
        {job.estimatedDuration && (
          <View style={styles.fullDetailRow}>
            <Ionicons name="timer-outline" size={14} color={colors.gray500} />
            <Text style={styles.fullDetailText}>
              {job.estimatedDuration}
            </Text>
          </View>
        )}
      </View>

      {job.description && (
        <Text style={styles.fullDescription} numberOfLines={2}>
          {job.description}
        </Text>
      )}
    </TouchableOpacity>
  );

  switch (variant) {
    case 'compact':
      return renderCompactView();
    case 'full':
      return renderFullView();
    default:
      return renderMediumView();
  }
};

const styles = StyleSheet.create({
  // Compact View Styles
  compactContainer: {
    marginBottom: 2,
  },
  
  compactBar: {
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 3,
    position: 'relative',
  },
  
  compactStatusLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
  },
  
  compactText: {
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 6,
  },

  // Medium View Styles
  mediumContainer: {
    borderLeftWidth: 4,
    borderRadius: borderRadius.sm,
    padding: spacing.xs,
    marginBottom: spacing.xs,
    ...shadows.sm,
  },
  
  mediumHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxxs,
  },
  
  mediumTime: {
    ...typography.caption,
    fontWeight: '700',
  },
  
  mediumStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  
  mediumClient: {
    ...typography.bodySmall,
    color: colors.gray800,
    fontWeight: '600',
    marginBottom: spacing.xxxs,
  },
  
  mediumService: {
    ...typography.caption,
    color: colors.gray600,
  },

  // Full View Styles
  fullContainer: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  
  fullHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  
  fullTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxxs,
  },
  
  fullTime: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '700',
  },
  
  fullStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxxs,
  },
  
  fullStatus: {
    ...typography.caption,
    fontWeight: '600',
  },
  
  fullClient: {
    ...typography.h4,
    color: colors.gray800,
    marginBottom: spacing.xxxs,
  },
  
  fullService: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  
  fullDetails: {
    gap: spacing.xxxs,
    marginBottom: spacing.sm,
  },
  
  fullDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxxs,
  },
  
  fullDetailText: {
    ...typography.bodySmall,
    color: colors.gray600,
    flex: 1,
  },
  
  fullDescription: {
    ...typography.bodySmall,
    color: colors.gray600,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});