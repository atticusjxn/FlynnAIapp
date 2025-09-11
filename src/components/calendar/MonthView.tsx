import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
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
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Get screen dimensions for calculating cell size
  const screenWidth = Dimensions.get('window').width;
  const cellWidth = (screenWidth - spacing.lg * 2) / 3; // 3 columns with padding
  const cellHeight = 120; // Fixed height for better content visibility

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
  
  // Calculate initial scroll position to show current week
  useEffect(() => {
    // Find which week contains today
    const today = new Date();
    const dayIndex = calendarDays.findIndex(day => 
      day.date.getDate() === today.getDate() &&
      day.date.getMonth() === today.getMonth() &&
      day.date.getFullYear() === today.getFullYear()
    );
    
    if (dayIndex !== -1 && scrollViewRef.current) {
      const weekRow = Math.floor(dayIndex / 7);
      const scrollRow = Math.max(0, weekRow - 1); // Center the current week
      const scrollY = scrollRow * cellHeight;
      
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: scrollY, animated: false });
      }, 100);
    }
  }, [currentDate]);

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
    <View style={styles.container}>
      {/* Fixed Week Day Headers for visible columns */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={styles.weekHeaderContainer}
      >
        <View style={styles.weekHeader}>
          {weekDays.map((day, index) => (
            <View 
              key={day} 
              style={[
                styles.weekDayHeader,
                { width: cellWidth }
              ]}
            >
              <Text style={styles.weekDayText}>{day.slice(0, 3)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Scrollable Calendar Grid */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.calendarScrollView}
        showsVerticalScrollIndicator={true}
        showsHorizontalScrollIndicator={true}
        horizontal={false}
        nestedScrollEnabled={true}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
          nestedScrollEnabled={true}
        >
          <View style={styles.calendarGrid}>
            {Array.from({ length: 6 }, (_, weekIndex) => (
              <View key={weekIndex} style={[styles.weekRow, { height: cellHeight }]}>
                {calendarDays.slice(weekIndex * 7, (weekIndex + 1) * 7).map((day, dayIndex) => (
                  <TouchableOpacity
                    key={dayIndex}
                    style={[
                      styles.dayCell,
                      { width: cellWidth, height: cellHeight },
                      day.isToday && styles.todayCell,
                      !day.isCurrentMonth && styles.otherMonthCell,
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
                      {day.jobs.length > 0 && (
                        <View style={styles.jobIndicator}>
                          <Text style={styles.jobCount}>{day.jobs.length}</Text>
                        </View>
                      )}
                    </View>
                    
                    {/* Job list for days with jobs */}
                    {day.jobs.length > 0 && (
                      <ScrollView 
                        style={styles.dayJobsList}
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled={true}
                      >
                        {day.jobs.map((job) => (
                          <TouchableOpacity
                            key={job.id}
                            style={[
                              styles.jobBar,
                              {
                                backgroundColor: getStatusColor(job.status) + '20',
                                borderLeftColor: getStatusColor(job.status),
                              }
                            ]}
                            onPress={() => onJobPress(job)}
                          >
                            <Text
                              style={[
                                styles.jobTime,
                                { color: getStatusColor(job.status) }
                              ]}
                              numberOfLines={1}
                            >
                              {job.time}
                            </Text>
                            <Text
                              style={styles.jobClient}
                              numberOfLines={1}
                            >
                              {job.clientName.split(' ')[0]}
                            </Text>
                            <Text
                              style={styles.jobService}
                              numberOfLines={1}
                            >
                              {job.serviceType}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>
      
      {/* Scroll Indicator Overlay */}
      <View style={styles.scrollIndicator} pointerEvents="none">
        <Text style={styles.scrollIndicatorText}>Swipe to navigate month</Text>
      </View>
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  
  weekHeaderContainer: {
    maxHeight: 40,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  
  weekHeader: {
    flexDirection: 'row',
  },
  
  weekDayHeader: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
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
  
  calendarScrollView: {
    flex: 1,
  },
  
  calendarGrid: {
    backgroundColor: colors.surface,
  },
  
  weekRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  
  dayCell: {
    padding: spacing.xs,
    borderRightWidth: 1,
    borderRightColor: colors.border,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  
  jobIndicator: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  
  jobCount: {
    fontSize: 10,
    color: colors.white,
    fontWeight: '600',
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
    flex: 1,
    marginTop: spacing.xxxs,
  },
  
  jobBar: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.xs,
    marginBottom: spacing.xxs,
    borderLeftWidth: 3,
  },
  
  jobTime: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 1,
  },
  
  jobClient: {
    fontSize: 10,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: 1,
  },
  
  jobService: {
    fontSize: 9,
    color: colors.textSecondary,
  },
  
  moreJobsText: {
    fontSize: 9,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: 2,
  },
  
  scrollIndicator: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: colors.gray800 + 'CC',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  
  scrollIndicatorText: {
    fontSize: 10,
    color: colors.white,
    fontWeight: '600',
  },
});