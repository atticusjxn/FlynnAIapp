import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { spacing, typography, borderRadius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { Job } from '../jobs/JobCard';

interface WeekViewProps {
  currentDate: Date;
  jobs: Job[];
  onJobPress: (job: Job) => void;
  onTimeSlotPress?: (date: Date, hour: number) => void;
  dayCount?: number; // New prop to support 3-day or 7-day view
  allDates?: Date[]; // All dates for continuous scrolling
  isContinuous?: boolean; // Whether this is a continuous timeline
  containerWidth?: number; // Width of the scroll container
}

interface WeekDay {
  date: Date;
  jobs: Job[];
  isToday: boolean;
}

export const WeekView: React.FC<WeekViewProps> = ({
  currentDate,
  jobs,
  onJobPress,
  onTimeSlotPress,
  dayCount = 7, // Default to 7 days for backward compatibility
  allDates,
  isContinuous = false,
  containerWidth = 350,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  
  const generateWeekDays = (): WeekDay[] => {
    const today = new Date();
    const weekDays: WeekDay[] = [];
    
    // Use allDates for continuous mode, or generate normally
    const datesToProcess = allDates || (() => {
      const dates = [];
      // For 3-day view, start from current date. For 7-day view, start from beginning of week
      const startDate = dayCount === 3 
        ? new Date(currentDate) 
        : (() => {
            const startOfWeek = new Date(currentDate);
            startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
            return startOfWeek;
          })();
      
      for (let i = 0; i < dayCount; i++) {
        const day = new Date(startDate);
        day.setDate(startDate.getDate() + i);
        dates.push(day);
      }
      return dates;
    })();
    
    datesToProcess.forEach(day => {
      const dateString = day.toISOString().split('T')[0];
      const dayJobs = jobs.filter(job => job.date === dateString);
      
      weekDays.push({
        date: day,
        jobs: dayJobs,
        isToday:
          day.getDate() === today.getDate() &&
          day.getMonth() === today.getMonth() &&
          day.getFullYear() === today.getFullYear(),
      });
    });
    
    return weekDays;
  };

  const weekDays = generateWeekDays();
  const hours = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM - 10 PM

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
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  const getJobPosition = (job: Job) => {
    const [hours, minutes] = job.time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes - 6 * 60; // Offset from 6 AM
    const position = (totalMinutes / 60) * 60; // 60px per hour (updated to match new height)
    return Math.max(0, position);
  };

  const getJobHeight = (job: Job) => {
    if (!job.estimatedDuration) return 60; // Default 1 hour
    
    const duration = parseFloat(job.estimatedDuration.replace(/[^\d.]/g, ''));
    return Math.max(50, duration * 60); // Minimum 50px, 60px per hour for better text visibility
  };

  const getJobsWithOverlapInfo = (dayJobs: Job[]) => {
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
      maxColumns: number;
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
      const maxColumns = 2; // Limit to 2 columns for better readability
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
      
      jobsWithLayout.push({
        job,
        top,
        height,
        column,
        maxColumns: maxColumnsForThisGroup,
      });
    });

    return jobsWithLayout;
  };

  const renderJobBlock = (jobLayout: any, dayIndex: number) => {
    const { job, top, height, column, maxColumns } = jobLayout;
    const columnWidth = 100 / Math.max(maxColumns, 1);
    
    return (
      <TouchableOpacity
        key={job.id}
        style={[
          styles.jobBlock,
          {
            top,
            height,
            left: `${column * columnWidth}%`,
            width: `${columnWidth - 2}%`, // -2% for better spacing
            backgroundColor: getStatusColor(job.status) + '20',
            borderLeftColor: getStatusColor(job.status),
          },
        ]}
        onPress={() => onJobPress(job)}
        activeOpacity={0.7}
      >
        <Text style={[styles.jobTime, { color: getStatusColor(job.status) }]}>
          {job.time}
        </Text>
        <Text style={styles.jobTitle} numberOfLines={1}>
          {job.clientName.split(' ')[0]}
        </Text>
        {height > 50 && maxColumns === 1 && (
          <Text style={styles.jobService} numberOfLines={1}>
            {job.serviceType}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  if (isContinuous) {
    // For continuous mode, create a wide timeline
    const dayWidth = containerWidth / 3; // Each visible frame shows 3 days
    const totalWidth = weekDays.length * dayWidth;
    
    return (
      <View style={[styles.container, { width: totalWidth, flex: 1 }]}>
        {/* Continuous Week Header */}
        <View style={[styles.weekHeader, { width: totalWidth }]}>
          <View style={styles.timeColumnHeader} />
          {weekDays.map((day, index) => (
            <View key={index} style={[styles.dayHeader, { width: dayWidth }]}>
              <Text style={styles.dayName}>
                {day.date.toLocaleDateString('en-US', { weekday: 'short' })}
              </Text>
              <Text
                style={[
                  styles.dayNumber,
                  day.isToday && styles.todayNumber,
                ]}
              >
                {day.date.getDate()}
              </Text>
            </View>
          ))}
        </View>

        {/* Continuous Scrollable Time Grid */}
        <ScrollView 
          style={[styles.timeGrid, { flex: 1 }]} 
          showsVerticalScrollIndicator={false}
          contentOffset={{ x: 0, y: 360 }} // Start at 8 AM
        >
          <View style={[styles.gridContent, { width: totalWidth }]}>
            {hours.map((hour) => (
              <View key={hour} style={[styles.hourRow, { width: totalWidth }]}>
                <View style={styles.timeColumn}>
                  <Text style={styles.timeLabel}>{formatTime(hour)}</Text>
                </View>
                
                {weekDays.map((day, dayIndex) => (
                  <TouchableOpacity
                    key={dayIndex}
                    style={[
                      styles.timeSlot,
                      { width: dayWidth },
                      day.isToday && styles.todayTimeSlot,
                    ]}
                    onPress={() => onTimeSlotPress?.(day.date, hour)}
                    activeOpacity={0.5}
                  >
                    {hour === 6 && day.jobs.length > 0 && (
                      <View style={[styles.dayJobsContainer, { width: dayWidth }]}>
                        {getJobsWithOverlapInfo(day.jobs).map((jobLayout) => 
                          renderJobBlock(jobLayout, dayIndex)
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  // Regular mode (non-continuous)
  return (
    <View style={styles.container}>
      {/* Week Header */}
      <View style={styles.weekHeader}>
        <View style={styles.timeColumnHeader} />
        {weekDays.map((day, index) => (
          <View key={index} style={styles.dayHeader}>
            <Text style={styles.dayName}>
              {day.date.toLocaleDateString('en-US', { weekday: 'short' })}
            </Text>
            <Text
              style={[
                styles.dayNumber,
                day.isToday && styles.todayNumber,
              ]}
            >
              {day.date.getDate()}
            </Text>
          </View>
        ))}
      </View>

      {/* Scrollable Time Grid - Back to original simple structure */}
      <ScrollView 
        style={styles.timeGrid} 
        showsVerticalScrollIndicator={false}
        contentOffset={{ x: 0, y: 360 }} // Start at 8 AM with updated height (6 * 60px)
      >
        <View style={styles.gridContent}>
          {hours.map((hour) => (
            <View key={hour} style={styles.hourRow}>
              <View style={styles.timeColumn}>
                <Text style={styles.timeLabel}>{formatTime(hour)}</Text>
              </View>
              
              {weekDays.map((day, dayIndex) => (
                <TouchableOpacity
                  key={dayIndex}
                  style={[
                    styles.timeSlot,
                    day.isToday && styles.todayTimeSlot,
                  ]}
                  onPress={() => onTimeSlotPress?.(day.date, hour)}
                  activeOpacity={0.5}
                >
                  {hour === 6 && day.jobs.length > 0 && (
                    <View style={styles.dayJobsContainer}>
                      {getJobsWithOverlapInfo(day.jobs).map((jobLayout) => 
                        renderJobBlock(jobLayout, dayIndex)
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  
  weekHeader: {
    flexDirection: 'row',
    backgroundColor: colors.gray50,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    paddingVertical: spacing.sm,
  },
  
  timeColumnHeader: {
    width: 60,
  },
  
  dayHeader: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  
  dayName: {
    ...typography.caption,
    color: colors.gray600,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xxxs,
  },
  
  dayNumber: {
    ...typography.h4,
    color: colors.gray800,
    fontWeight: '600',
  },
  
  todayNumber: {
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    width: 32,
    height: 32,
    lineHeight: 32,
    textAlign: 'center',
  },
  
  timeGrid: {
    flex: 1,
  },
  
  gridContent: {
    position: 'relative',
  },
  
  hourRow: {
    flexDirection: 'row',
    height: 60, // Increased height for better text visibility
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  
  timeColumn: {
    width: 60,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: spacing.xxxs,
    backgroundColor: colors.gray50,
    borderRightWidth: 1,
    borderRightColor: colors.gray200,
  },
  
  timeLabel: {
    ...typography.caption,
    color: colors.gray600,
    fontWeight: '500',
  },
  
  timeSlot: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: colors.gray100,
    position: 'relative',
    minHeight: 60,
  },
  
  todayTimeSlot: {
    backgroundColor: colors.primaryLight + '40',
  },
  
  dayJobsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60 * 17, // Full day height - updated to match new height
  },
  
  jobBlock: {
    position: 'absolute',
    borderLeftWidth: 3,
    borderRadius: borderRadius.sm,
    padding: 6, // Slightly larger padding for better readability
    backgroundColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    overflow: 'hidden',
    marginHorizontal: 1,
    zIndex: 20, // Ensure jobs appear above grid lines
    borderWidth: 1,
    borderColor: colors.white, // Solid border to cover grid lines
  },
  
  jobTime: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  
  jobTitle: {
    fontSize: 12,
    color: colors.gray800,
    fontWeight: '600',
    marginBottom: 2,
    lineHeight: 14,
  },
  
  jobService: {
    fontSize: 11,
    color: colors.gray600,
    fontWeight: '500',
    lineHeight: 13,
  },
});