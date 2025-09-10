import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { Job } from '../jobs/JobCard';

interface WeekViewProps {
  currentDate: Date;
  jobs: Job[];
  onJobPress: (job: Job) => void;
  onTimeSlotPress?: (date: Date, hour: number) => void;
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
}) => {
  const generateWeekDays = (): WeekDay[] => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    
    const today = new Date();
    const weekDays: WeekDay[] = [];
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      
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
    }
    
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
    const position = (totalMinutes / 60) * 60; // 60px per hour
    return Math.max(0, position);
  };

  const getJobHeight = (job: Job) => {
    if (!job.estimatedDuration) return 60; // Default 1 hour
    
    const duration = parseFloat(job.estimatedDuration.replace(/[^\d.]/g, ''));
    return Math.max(30, duration * 60); // Minimum 30px, 60px per hour
  };

  const renderJobBlock = (job: Job, dayIndex: number) => {
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
        <Text style={[styles.jobTime, { color: getStatusColor(job.status) }]}>
          {job.time}
        </Text>
        <Text style={styles.jobTitle} numberOfLines={1}>
          {job.clientName}
        </Text>
        <Text style={styles.jobService} numberOfLines={1}>
          {job.serviceType}
        </Text>
      </TouchableOpacity>
    );
  };

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

      {/* Scrollable Time Grid */}
      <ScrollView 
        style={styles.timeGrid} 
        showsVerticalScrollIndicator={false}
        contentOffset={{ x: 0, y: 480 }} // Start at 8 AM
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
                      {day.jobs.map((job) => renderJobBlock(job, dayIndex))}
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

const styles = StyleSheet.create({
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
    height: 60,
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
    height: 60 * 17, // Full day height
  },
  
  jobBlock: {
    position: 'absolute',
    left: 4,
    right: 4,
    borderLeftWidth: 4,
    borderRadius: borderRadius.sm,
    padding: spacing.xs,
    backgroundColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  
  jobTime: {
    ...typography.caption,
    fontWeight: '600',
    marginBottom: spacing.xxxs,
  },
  
  jobTitle: {
    ...typography.bodySmall,
    color: colors.gray800,
    fontWeight: '600',
    marginBottom: spacing.xxxs,
  },
  
  jobService: {
    ...typography.caption,
    color: colors.gray600,
  },
});