import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { PinchGestureHandler, State } from 'react-native-gesture-handler';
import { spacing, typography, borderRadius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { Job } from '../jobs/JobCard';

interface MonthViewProps {
  currentDate: Date;
  jobs: Job[];
  onDatePress: (date: Date) => void;
  onJobPress: (job: Job) => void;
  onZoomToWeek?: (startDate: Date) => void;
  onZoomToDay?: (date: Date) => void;
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
  onZoomToWeek,
  onZoomToDay,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const handlePinchGesture = (event: any) => {
    const { scale, focalX, focalY, state } = event.nativeEvent;
    
    // Only handle when gesture ends
    if (state !== State.END) return;
    
    // Calculate which part of the calendar was pinched
    const calendarWidth = 350; // Approximate width of calendar
    const calendarHeight = 300; // Approximate height of calendar
    
    // Convert focal point to calendar grid coordinates
    const dayWidth = calendarWidth / 7;
    const weekHeight = calendarHeight / 6;
    
    const dayCol = Math.floor(focalX / dayWidth);
    const weekRow = Math.floor(focalY / weekHeight);
    
    // Calculate which date was pinched
    const calendarDays = generateCalendarDays();
    const dayIndex = weekRow * 7 + dayCol;
    const targetDay = calendarDays[dayIndex];
    
    if (!targetDay) return;
    
    // Determine zoom level based on scale
    if (scale > 1.5) {
      // Zoom to day view
      onZoomToDay?.(targetDay.date);
    } else if (scale > 1.2) {
      // Zoom to week view - find the start of the week containing this day
      const weekStart = new Date(targetDay.date);
      weekStart.setDate(targetDay.date.getDate() - targetDay.date.getDay());
      onZoomToWeek?.(weekStart);
    }
  };
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
    <PinchGestureHandler onGestureEvent={handlePinchGesture} onHandlerStateChange={handlePinchGesture}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Week Day Headers */}
        <View style={styles.weekHeader}>
          {weekDays.map((day, index) => (
            <View 
              key={day} 
              style={[
                styles.weekDayHeader,
                index === weekDays.length - 1 && { borderRightWidth: 0 } // Remove border from last item
              ]}
            >
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
                    dayIndex === 6 && { borderRightWidth: 0 } // Remove border from last item in row
                  ]}
                  onPress={() => onDatePress(day.date)}
                  activeOpacity={0.7}
                >
                  <View style={styles.dayHeader}>
                    <Text
                      style={[
                        styles.dayNumber,
                        day.isToday && styles.todayText,
                        !day.isCurrentMonth && styles.otherMonthText,
                      ]}
                    >
                      {day.date.getDate()}
                    </Text>
                    {day.jobs.length > 0 && renderJobDots(day.jobs)}
                  </View>
                  
                  {/* Job list for days with jobs */}
                  {day.jobs.length > 0 && (
                    <View style={styles.dayJobsList}>
                      {day.jobs.slice(0, 2).map((job) => (
                        <TouchableOpacity
                          key={job.id}
                          style={[
                            styles.jobBar,
                            {
                              backgroundColor: getStatusColor(job.status) + '15',
                              borderLeftColor: getStatusColor(job.status),
                            }
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
                            {job.time}
                          </Text>
                          <Text
                            style={[
                              styles.jobBarText,
                              { color: colors.gray700, fontSize: 9 }
                            ]}
                            numberOfLines={1}
                          >
                            {job.clientName.split(' ')[0]}
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
    </PinchGestureHandler>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  
  weekHeader: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  
  weekDayHeader: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.border,
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
    minHeight: 90,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    alignItems: 'center',
  },
  
  todayCell: {
    backgroundColor: colors.primaryLight,
  },
  
  otherMonthCell: {
    backgroundColor: colors.gray100,
  },
  
  dayNumber: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
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
  
  dayHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxxs,
  },
  
  jobDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
    paddingVertical: 3,
    paddingHorizontal: 5,
    borderRadius: 4,
    marginBottom: 2,
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
  },
  
  jobBarText: {
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 12,
  },
  
  moreJobsText: {
    fontSize: 9,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: 2,
  },
});