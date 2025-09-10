import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { Job } from '../jobs/JobCard';

interface DayViewProps {
  currentDate: Date;
  jobs: Job[];
  onJobPress: (job: Job) => void;
  onTimeSlotPress?: (date: Date, hour: number) => void;
}

export const DayView: React.FC<DayViewProps> = ({
  currentDate,
  jobs,
  onJobPress,
  onTimeSlotPress,
}) => {
  const hours = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM - 10 PM
  const dateString = currentDate.toISOString().split('T')[0];
  const dayJobs = jobs.filter(job => job.date === dateString);
  
  const isToday = 
    currentDate.getDate() === new Date().getDate() &&
    currentDate.getMonth() === new Date().getMonth() &&
    currentDate.getFullYear() === new Date().getFullYear();

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

  const formatTime = (hour: number) => {
    if (hour === 0) return '12:00 AM';
    if (hour === 12) return '12:00 PM';
    if (hour < 12) return `${hour}:00 AM`;
    return `${hour - 12}:00 PM`;
  };

  const getJobPosition = (job: Job) => {
    const [hours, minutes] = job.time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes - 6 * 60; // Offset from 6 AM
    const position = (totalMinutes / 60) * 80; // 80px per hour for day view
    return Math.max(0, position);
  };

  const getJobHeight = (job: Job) => {
    if (!job.estimatedDuration) return 80; // Default 1 hour
    
    const duration = parseFloat(job.estimatedDuration.replace(/[^\d.]/g, ''));
    return Math.max(40, duration * 80); // Minimum 40px, 80px per hour
  };

  const getCurrentTimePosition = () => {
    const now = new Date();
    if (!isToday) return -1;
    
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    
    if (currentHour < 6 || currentHour > 22) return -1;
    
    const totalMinutes = currentHour * 60 + currentMinutes - 6 * 60;
    return (totalMinutes / 60) * 80;
  };

  const currentTimePosition = getCurrentTimePosition();

  const renderJobBlock = (job: Job) => {
    const top = getJobPosition(job);
    const height = getJobHeight(job);
    
    return (
      <TouchableOpacity
        key={job.id}
        style={[
          styles.jobBlock,
          {
            top,
            height,
            backgroundColor: getStatusColor(job.status) + '20',
            borderLeftColor: getStatusColor(job.status),
          },
        ]}
        onPress={() => onJobPress(job)}
        activeOpacity={0.7}
      >
        <View style={styles.jobHeader}>
          <Text style={[styles.jobTime, { color: getStatusColor(job.status) }]}>
            {job.time}
          </Text>
          <View style={styles.jobStatusBadge}>
            <View style={[
              styles.statusDot,
              { backgroundColor: getStatusColor(job.status) }
            ]} />
          </View>
        </View>
        
        <Text style={styles.jobTitle} numberOfLines={2}>
          {job.clientName}
        </Text>
        
        <Text style={styles.jobService} numberOfLines={2}>
          {job.serviceType}
        </Text>
        
        <View style={styles.jobFooter}>
          <View style={styles.jobLocation}>
            <Ionicons name="location-outline" size={12} color={colors.gray500} />
            <Text style={styles.jobLocationText} numberOfLines={1}>
              {job.location}
            </Text>
          </View>
          
          {job.estimatedDuration && (
            <View style={styles.jobDuration}>
              <Ionicons name="timer-outline" size={12} color={colors.gray500} />
              <Text style={styles.jobDurationText}>
                {job.estimatedDuration}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyTimeSlot = (hour: number) => {
    return (
      <TouchableOpacity
        style={styles.emptyTimeSlot}
        onPress={() => onTimeSlotPress?.(currentDate, hour)}
        activeOpacity={0.6}
      >
        <Text style={styles.emptySlotText}>
          Tap to schedule
        </Text>
      </TouchableOpacity>
    );
  };

  const hasJobAtHour = (hour: number) => {
    return dayJobs.some(job => {
      const jobHour = parseInt(job.time.split(':')[0]);
      return jobHour === hour;
    });
  };

  return (
    <View style={styles.container}>
      {/* Scrollable Time Grid */}
      <ScrollView 
        style={styles.timeGrid} 
        showsVerticalScrollIndicator={false}
        contentOffset={{ x: 0, y: 160 }} // Start at 8 AM
      >
        <View style={styles.gridContent}>
          {/* Current Time Indicator */}
          {currentTimePosition >= 0 && (
            <View 
              style={[
                styles.currentTimeLine,
                { top: currentTimePosition }
              ]}
            >
              <View style={styles.currentTimeIndicator} />
              <View style={styles.currentTimeDot} />
            </View>
          )}
          
          {/* Jobs Container */}
          <View style={styles.jobsContainer}>
            {dayJobs.map(renderJobBlock)}
          </View>
          
          {/* Time Grid */}
          {hours.map((hour) => (
            <View key={hour} style={styles.hourRow}>
              <View style={styles.timeColumn}>
                <Text style={styles.timeLabel}>{formatTime(hour)}</Text>
              </View>
              
              <View style={styles.mainTimeSlot}>
                {!hasJobAtHour(hour) && renderEmptyTimeSlot(hour)}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  
  
  timeGrid: {
    flex: 1,
  },
  
  gridContent: {
    position: 'relative',
    minHeight: 80 * 17, // 17 hours * 80px each
  },
  
  hourRow: {
    flexDirection: 'row',
    height: 80,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  
  timeColumn: {
    width: 80,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: spacing.xs,
    backgroundColor: colors.gray50,
    borderRightWidth: 1,
    borderRightColor: colors.gray200,
  },
  
  timeLabel: {
    ...typography.bodySmall,
    color: colors.gray600,
    fontWeight: '500',
  },
  
  mainTimeSlot: {
    flex: 1,
    position: 'relative',
  },
  
  emptyTimeSlot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.gray200,
    margin: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.gray50 + '80',
    minHeight: 40,
  },
  
  emptySlotText: {
    ...typography.caption,
    color: colors.gray400,
    fontStyle: 'italic',
  },
  
  jobsContainer: {
    position: 'absolute',
    top: 0,
    left: 80,
    right: 0,
    height: '100%',
  },
  
  jobBlock: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    borderLeftWidth: 4,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    backgroundColor: colors.white,
    ...shadows.md,
  },
  
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  
  jobTime: {
    ...typography.bodyMedium,
    fontWeight: '700',
  },
  
  jobStatusBadge: {
    alignItems: 'center',
  },
  
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  
  jobTitle: {
    ...typography.h4,
    color: colors.gray800,
    marginBottom: spacing.xs,
  },
  
  jobService: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  
  jobFooter: {
    gap: spacing.xs,
  },
  
  jobLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxxs,
  },
  
  jobLocationText: {
    ...typography.bodySmall,
    color: colors.gray600,
    flex: 1,
  },
  
  jobDuration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxxs,
  },
  
  jobDurationText: {
    ...typography.bodySmall,
    color: colors.gray600,
  },
  
  currentTimeLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    zIndex: 10,
  },
  
  currentTimeIndicator: {
    position: 'absolute',
    left: 80,
    right: 0,
    height: 2,
    backgroundColor: colors.error,
  },
  
  currentTimeDot: {
    position: 'absolute',
    left: 74,
    top: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.error,
  },
});