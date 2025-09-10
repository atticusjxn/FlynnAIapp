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

interface MonthViewProps {
  currentDate: Date;
  jobs: Job[];
  onDatePress: (date: Date) => void;
  onJobPress: (job: Job) => void;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  jobs: Job[];
}

export const MonthView: React.FC<MonthViewProps> = ({
  currentDate,
  jobs,
  onDatePress,
  onJobPress,
}) => {
  const generateCalendarDays = (): CalendarDay[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const today = new Date();
    
    // Get first day of month and calculate starting date
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay());
    
    const days: CalendarDay[] = [];
    const currentCalendarDate = new Date(startDate);
    
    // Generate 42 days (6 weeks)
    for (let i = 0; i < 42; i++) {
      const dateString = currentCalendarDate.toISOString().split('T')[0];
      const dayJobs = jobs.filter(job => job.date === dateString);
      
      days.push({
        date: new Date(currentCalendarDate),
        isCurrentMonth: currentCalendarDate.getMonth() === month,
        isToday: 
          currentCalendarDate.getDate() === today.getDate() &&
          currentCalendarDate.getMonth() === today.getMonth() &&
          currentCalendarDate.getFullYear() === today.getFullYear(),
        jobs: dayJobs,
      });
      
      currentCalendarDate.setDate(currentCalendarDate.getDate() + 1);
    }
    
    return days;
  };

  const calendarDays = generateCalendarDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

  const renderJobDots = (jobs: Job[]) => {
    if (jobs.length === 0) return null;
    
    if (jobs.length <= 3) {
      return (
        <View style={styles.jobDotsContainer}>
          {jobs.map((job, index) => (
            <View
              key={job.id}
              style={[
                styles.jobDot,
                { backgroundColor: getStatusColor(job.status) }
              ]}
            />
          ))}
        </View>
      );
    }
    
    // Show first 2 dots and a count indicator
    return (
      <View style={styles.jobDotsContainer}>
        {jobs.slice(0, 2).map((job, index) => (
          <View
            key={job.id}
            style={[
              styles.jobDot,
              { backgroundColor: getStatusColor(job.status) }
            ]}
          />
        ))}
        <View style={styles.jobCountBadge}>
          <Text style={styles.jobCountText}>+{jobs.length - 2}</Text>
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Week Day Headers */}
      <View style={styles.weekHeader}>
        {weekDays.map((day) => (
          <View key={day} style={styles.weekDayHeader}>
            <Text style={styles.weekDayText}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarGrid}>
        {Array.from({ length: 6 }, (_, weekIndex) => (
          <View key={weekIndex} style={styles.weekRow}>
            {calendarDays.slice(weekIndex * 7, (weekIndex + 1) * 7).map((day, dayIndex) => (
              <TouchableOpacity
                key={dayIndex}
                style={[
                  styles.dayCell,
                  day.isToday && styles.todayCell,
                  !day.isCurrentMonth && styles.otherMonthCell,
                ]}
                onPress={() => onDatePress(day.date)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    day.isToday && styles.todayText,
                    !day.isCurrentMonth && styles.otherMonthText,
                  ]}
                >
                  {day.date.getDate()}
                </Text>
                
                {renderJobDots(day.jobs)}
                
                {/* Job list for days with jobs */}
                {day.jobs.length > 0 && (
                  <View style={styles.dayJobsList}>
                    {day.jobs.slice(0, 2).map((job) => (
                      <TouchableOpacity
                        key={job.id}
                        style={[
                          styles.jobBar,
                          { backgroundColor: getStatusColor(job.status) + '20' }
                        ]}
                        onPress={() => onJobPress(job)}
                      >
                        <Text
                          style={[
                            styles.jobBarText,
                            { color: getStatusColor(job.status) }
                          ]}
                          numberOfLines={1}
                        >
                          {job.time} {job.clientName}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {day.jobs.length > 2 && (
                      <Text style={styles.moreJobsText}>
                        +{day.jobs.length - 2} more
                      </Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
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
  },
  
  weekDayHeader: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  
  weekDayText: {
    ...typography.caption,
    color: colors.gray600,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  calendarGrid: {
    flex: 1,
  },
  
  weekRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  
  dayCell: {
    flex: 1,
    minHeight: 80,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xxxs,
    borderRightWidth: 1,
    borderRightColor: colors.gray100,
    alignItems: 'center',
  },
  
  todayCell: {
    backgroundColor: colors.primaryLight,
  },
  
  otherMonthCell: {
    backgroundColor: colors.gray50,
  },
  
  dayNumber: {
    ...typography.bodyMedium,
    color: colors.gray800,
    fontWeight: '500',
    marginBottom: spacing.xxxs,
  },
  
  todayText: {
    color: colors.primary,
    fontWeight: '700',
  },
  
  otherMonthText: {
    color: colors.gray400,
  },
  
  jobDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.xxxs,
    minHeight: 8,
  },
  
  jobDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 1,
  },
  
  jobCountBadge: {
    backgroundColor: colors.gray600,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 2,
  },
  
  jobCountText: {
    fontSize: 8,
    color: colors.white,
    fontWeight: '600',
  },
  
  dayJobsList: {
    width: '100%',
    marginTop: spacing.xxxs,
  },
  
  jobBar: {
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 3,
    marginBottom: 2,
  },
  
  jobBarText: {
    fontSize: 10,
    fontWeight: '500',
  },
  
  moreJobsText: {
    fontSize: 9,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: 2,
  },
});