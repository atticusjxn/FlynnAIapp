import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, shadows } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { Job } from '../jobs/JobCard';
import { ConflictResolutionModal } from './ConflictResolutionModal';

interface DayViewProps {
  currentDate: Date;
  jobs: Job[];
  onJobPress: (job: Job) => void;
  onTimeSlotPress?: (date: Date, hour: number) => void;
  onUpdateJob?: (updatedJob: Job) => void;
}

export const DayView: React.FC<DayViewProps> = ({
  currentDate,
  jobs,
  onJobPress,
  onTimeSlotPress,
  onUpdateJob,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [conflictModalVisible, setConflictModalVisible] = useState(false);
  const [selectedConflictJob, setSelectedConflictJob] = useState<Job | null>(null);
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
    const baseDuration = job.estimatedDuration 
      ? parseFloat(job.estimatedDuration.replace(/[^\d.]/g, ''))
      : 1; // Default 1 hour
    
    const durationBasedHeight = baseDuration * 80; // 80px per hour
    
    // Calculate minimum height to show all content
    // Header (time + duration + status): ~20px
    // Title (client name): ~16px  
    // Service type: ~14px
    // Location: ~13px
    // Footer margins: ~4px
    // Padding (top/bottom): ~24px
    const minContentHeight = 95; // Increased to ensure location is visible
    
    return Math.max(minContentHeight, durationBasedHeight);
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

  // Detect overlapping jobs
  const getJobTimeRange = (job: Job) => {
    const [hours, minutes] = job.time.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const duration = job.estimatedDuration 
      ? parseFloat(job.estimatedDuration.replace(/[^\d.]/g, '')) * 60 
      : 60; // Default 1 hour in minutes
    
    return {
      start: startMinutes,
      end: startMinutes + duration,
    };
  };

  const getOverlappingJobs = (targetJob: Job) => {
    const targetRange = getJobTimeRange(targetJob);
    return dayJobs.filter(job => {
      if (job.id === targetJob.id) return false;
      const jobRange = getJobTimeRange(job);
      return targetRange.start < jobRange.end && targetRange.end > jobRange.start;
    });
  };

  const hasConflict = (job: Job) => {
    return getOverlappingJobs(job).length > 0;
  };

  // Determine which job should show the conflict warning (the later/overlapping one)
  const shouldShowConflictWarning = (job: Job) => {
    const overlappingJobs = getOverlappingJobs(job);
    if (overlappingJobs.length === 0) return false;
    
    // Show warning on the job that starts later
    const jobStartMinutes = getJobTimeRange(job).start;
    const hasEarlierJob = overlappingJobs.some(overlappingJob => {
      const overlappingStartMinutes = getJobTimeRange(overlappingJob).start;
      return overlappingStartMinutes < jobStartMinutes;
    });
    
    return hasEarlierJob; // Show warning if there's an earlier overlapping job
  };

  // Add column layout system for overlapping jobs
  const getJobsWithLayout = () => {
    const sortedJobs = [...dayJobs].sort((a, b) => {
      const aPos = getJobPosition(a);
      const bPos = getJobPosition(b);
      return aPos - bPos;
    });

    const jobsWithLayout: Array<{
      job: Job;
      top: number;
      height: number;
      column: number;
      width: number;
      left: number;
    }> = [];

    sortedJobs.forEach((job, index) => {
      const top = getJobPosition(job);
      const height = getJobHeight(job);
      
      // Find overlapping jobs that have already been processed
      const overlappingJobs = [];
      for (let i = 0; i < index; i++) {
        const prevJob = sortedJobs[i];
        const prevTop = getJobPosition(prevJob);
        const prevHeight = getJobHeight(prevJob);
        
        // Check if jobs overlap in time
        if (top < prevTop + prevHeight && top + height > prevTop) {
          overlappingJobs.push(i);
        }
      }
      
      // Find the first available column
      let column = 0;
      const maxColumns = 2; // Limit to 2 columns for readability
      const usedColumns = new Set<number>();
      
      // Check which columns are already used by overlapping jobs
      overlappingJobs.forEach(prevIndex => {
        const prevLayout = jobsWithLayout[prevIndex];
        if (prevLayout) {
          usedColumns.add(prevLayout.column);
        }
      });
      
      // Find first available column
      while (usedColumns.has(column) && column < maxColumns) {
        column++;
      }
      
      // If no column available, force into last column
      if (column >= maxColumns) {
        column = maxColumns - 1;
      }
      
      const totalOverlappingJobs = overlappingJobs.length + 1;
      const maxColumnsForThisGroup = Math.min(totalOverlappingJobs, maxColumns);
      const columnWidth = 100 / Math.max(maxColumnsForThisGroup, 1);
      const leftPosition = (column * columnWidth);
      
      jobsWithLayout.push({
        job,
        top,
        height,
        column,
        width: columnWidth - 2, // -2% for spacing
        left: leftPosition,
      });
    });

    return jobsWithLayout;
  };

  const renderJobBlock = (jobLayout: any) => {
    const { job, top, height, left, width } = jobLayout;
    const isConflicted = hasConflict(job);
    const showConflictWarning = shouldShowConflictWarning(job);
    
    return (
      <TouchableOpacity
        key={job.id}
        style={[
          styles.jobBlock,
          {
            top,
            height,
            left: `${left}%`,
            width: `${width}%`,
            backgroundColor: isConflicted 
              ? colors.errorLight 
              : getStatusColor(job.status) + '20',
            borderLeftColor: isConflicted 
              ? colors.error 
              : getStatusColor(job.status),
            borderWidth: isConflicted ? 2 : 1,
          },
          isConflicted && styles.conflictedJob,
        ]}
        onPress={() => {
          if (isConflicted) {
            setSelectedConflictJob(job);
            setConflictModalVisible(true);
          } else {
            onJobPress(job);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.jobHeader}>
          <Text style={[styles.jobTime, { color: isConflicted ? colors.error : getStatusColor(job.status) }]}>
            {job.time}
            {job.estimatedDuration && (
              <Text style={styles.jobDurationInline}> • {job.estimatedDuration}</Text>
            )}
          </Text>
          <View style={styles.jobStatusBadge}>
            {isConflicted ? (
              <Ionicons name="warning" size={16} color={colors.error} />
            ) : (
              <View style={[
                styles.statusDot,
                { backgroundColor: getStatusColor(job.status) }
              ]} />
            )}
          </View>
        </View>
        
        <Text style={styles.jobTitle} numberOfLines={2}>
          {job.clientName}
        </Text>
        
        <Text style={styles.jobService} numberOfLines={2}>
          {job.serviceType}
        </Text>
        
        <View style={styles.jobFooter}>
          {showConflictWarning && (
            <TouchableOpacity 
              style={styles.conflictWarning}
              onPress={() => {
                setSelectedConflictJob(job);
                setConflictModalVisible(true);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="warning-outline" size={12} color={colors.white} />
              <Text style={styles.conflictText}>
                Scheduling conflict - tap to resolve
              </Text>
            </TouchableOpacity>
          )}
          <View style={styles.jobLocation}>
            <Ionicons name="location-outline" size={12} color={colors.gray500} />
            <Text style={styles.jobLocationText} numberOfLines={1}>
              {job.location}
            </Text>
          </View>
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
      const jobMinutes = parseInt(job.time.split(':')[1]);
      const jobStartTime = jobHour * 60 + jobMinutes;
      const hourStartTime = hour * 60;
      const hourEndTime = (hour + 1) * 60;
      
      // Get job duration in minutes
      const duration = job.estimatedDuration 
        ? parseFloat(job.estimatedDuration.replace(/[^\d.]/g, '')) * 60 
        : 60; // Default 1 hour
      const jobEndTime = jobStartTime + duration;
      
      // Check if job overlaps with this hour slot
      return jobStartTime < hourEndTime && jobEndTime > hourStartTime;
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
            {getJobsWithLayout().map((jobLayout) => renderJobBlock(jobLayout))}
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

      {/* Conflict Resolution Modal */}
      <ConflictResolutionModal
        visible={conflictModalVisible}
        conflictedJob={selectedConflictJob}
        overlappingJobs={selectedConflictJob ? getOverlappingJobs(selectedConflictJob) : []}
        onClose={() => {
          setConflictModalVisible(false);
          setSelectedConflictJob(null);
        }}
        onRescheduleJob={(job, newTime) => {
          if (onUpdateJob) {
            onUpdateJob({ ...job, time: newTime });
          }
          setConflictModalVisible(false);
          setSelectedConflictJob(null);
        }}
        onKeepBothJobs={() => {
          // User decided to keep both - just close modal
          setConflictModalVisible(false);
          setSelectedConflictJob(null);
        }}
      />
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
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
    zIndex: 10, // Ensure jobs appear above grid lines
  },
  
  jobBlock: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    borderLeftWidth: 4,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    backgroundColor: colors.white,
    ...shadows.sm,
    overflow: 'hidden',
    zIndex: 15, // Ensure job cards appear above everything
    borderWidth: 1,
    borderColor: colors.white, // Ensure solid border to cover grid lines
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
    flex: 1,
  },
  
  jobDurationInline: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.8,
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
    ...typography.bodyMedium,
    color: colors.gray800,
    fontWeight: '700',
    marginBottom: spacing.xxxs,
    fontSize: 14,
    lineHeight: 16,
  },
  
  jobService: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: spacing.xs,
    fontSize: 12,
    lineHeight: 14,
  },
  
  jobFooter: {
    gap: spacing.xxxs,
    marginTop: spacing.xxxs,
  },
  
  jobLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxxs,
  },
  
  jobLocationText: {
    fontSize: 11,
    color: colors.gray600,
    flex: 1,
    lineHeight: 13,
  },
  
  conflictedJob: {
    shadowColor: colors.error,
    shadowOpacity: 0.3,
    elevation: 6,
  },
  
  conflictWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxxs,
    backgroundColor: colors.error,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    marginBottom: spacing.xs,
    minHeight: 32, // Larger touch target
  },
  
  conflictText: {
    fontSize: 11,
    color: colors.white,
    fontWeight: '700',
    flex: 1,
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