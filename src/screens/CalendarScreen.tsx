import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { FlynnIcon } from '../components/ui/FlynnIcon';
import { useNavigation, NavigationProp, ParamListBase } from '@react-navigation/native';
import { spacing, typography, borderRadius, shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useJobs } from '../context/JobsContext';
import { Job } from '../components/jobs/JobCard';
import { JobDetailsModal } from '../components/jobs/JobDetailsModal';
import { MonthView } from '../components/calendar/MonthView';
import { WeekView } from '../components/calendar/WeekView';
import { DayView } from '../components/calendar/DayView';
import { JobEvent } from '../components/calendar/JobEvent';

type CalendarView = 'month' | 'day';


export const CalendarScreen: React.FC = () => {
  const { colors } = useTheme();
  const { jobs, updateJob, deleteJob, markJobComplete, saveJobEdits } = useJobs();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const styles = createStyles(colors);
  const [currentView, setCurrentView] = useState<CalendarView>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const today = new Date(); // Always have today as reference
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [scrollViewWidth, setScrollViewWidth] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Animation for view toggle indicator
  const animatedValue = useRef(new Animated.Value(0)).current;
  
  // Generate dates for day view scrolling only
  const scrollDates = useMemo(() => {
    const dates = [];
    const totalPages = 21; // 21 days total (10 before, current, 10 after)
    const startOffset = Math.floor(totalPages / 2);
    
    for (let i = -startOffset; i <= startOffset; i++) {
      const date = new Date(currentDate);
      date.setDate(currentDate.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, [currentDate, currentView]);

  const currentDateIndex = Math.floor(scrollDates.length / 2);
  const { width } = Dimensions.get('window');
const toggleButtonWidth = (width - spacing.lg * 2 - spacing.xxxs) / 2; // Only 2 buttons now

  // Animate indicator when view changes
  useEffect(() => {
    const viewIndex = currentView === 'month' ? 0 : 1;
    Animated.spring(animatedValue, {
      toValue: viewIndex,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start();
  }, [currentView]);

  const handleViewChange = (view: CalendarView) => {
    setCurrentView(view);
    // Reset to today when switching views for consistency
    setCurrentDate(new Date());
  };

  const handleJobPress = useCallback((job: Job) => {
    setSelectedJob(job);
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setSelectedJob(null);
  }, []);

  const handleSendTextConfirmation = useCallback((job: Job) => {
    console.log('Send text confirmation for job:', job.id);
  }, []);

  const handleSendEmailConfirmation = useCallback((job: Job) => {
    console.log('Send email confirmation for job:', job.id);
  }, []);

  const handleMarkComplete = useCallback(async (job: Job) => {
    try {
      await markJobComplete(job.id);
      handleCloseModal();
    } catch (error) {
      Alert.alert('Error', 'Unable to mark this job complete right now.');
    }
  }, [markJobComplete, handleCloseModal]);

  const handleReschedule = useCallback((job: Job) => {
    console.log('Reschedule job:', job.id);
  }, []);

  const handleEditDetails = useCallback((job: Job) => {
    console.log('Edit details for job:', job.id);
    // This is now handled inline in the modal
  }, []);

  const handleUpdateJob = useCallback(async (updatedJob: Job) => {
    try {
      await saveJobEdits(updatedJob);
    } catch (error) {
      Alert.alert('Error', 'Unable to save job changes right now.');
    }
  }, [saveJobEdits]);

  const handleDeleteJob = useCallback(async (job: Job) => {
    try {
      await deleteJob(job.id);
      handleCloseModal();
    } catch (error) {
      Alert.alert('Error', 'Unable to delete this job right now.');
    }
  }, [deleteJob, handleCloseModal]);

  const navigateToToday = () => {
    setCurrentDate(new Date());
  };

  const navigatePrevious = () => {
    if (currentView === 'month') {
      const newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() - 1);
      setCurrentDate(newDate);
    } else {
      // For day view, move back 1 day
      const newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() - 1);
      setCurrentDate(newDate);
    }
  };

  const navigateNext = () => {
    if (currentView === 'month') {
      const newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() + 1);
      setCurrentDate(newDate);
    } else {
      // For day view, move forward 1 day
      const newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() + 1);
      setCurrentDate(newDate);
    }
  };

  const formatDateDisplay = () => {
    if (currentView === 'month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    return currentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getTodaysJobs = () => {
    const today = new Date().toISOString().split('T')[0];
    return jobs.filter(job => job.date === today);
  };

  const handleDatePress = useCallback((date: Date) => {
    setCurrentDate(date);
    if (currentView !== 'day') {
      setCurrentView('day');
    }
  }, [currentView]);

  const handleTimeSlotPress = useCallback((date: Date, hour: number) => {
    // Format the date and time for the job form
    const formattedDate = date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    
    const formattedTime = hour === 0 ? '12:00 AM' 
      : hour === 12 ? '12:00 PM'
      : hour < 12 ? `${hour}:00 AM`
      : `${hour - 12}:00 PM`;
    
    
    // Navigate to job form with pre-filled date/time
    navigation.navigate('JobFormDemo', {
      prefilledData: {
        date: formattedDate,
        time: formattedTime
      }
    });
  }, [navigation]);

  const handleCreateJob = useCallback(() => {
    navigation.navigate('JobFormDemo');
  }, [navigation]);

  const handleScroll = (event: any) => {
    if (currentView !== 'day' || !scrollViewWidth) {
      return;
    }

    const scrollX = event.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(scrollX / scrollViewWidth);

    if (pageIndex >= 0 && pageIndex < scrollDates.length) {
      const newDate = scrollDates[pageIndex];
      if (newDate && newDate.toDateString() !== currentDate.toDateString()) {
        setCurrentDate(new Date(newDate));
      }
    }
  };

  // Handle scroll end for reliable page detection
  const handleMomentumScrollEnd = (event: any) => {
    if (currentView !== 'day' || !scrollViewWidth) {
      return;
    }

    const scrollX = event.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(scrollX / scrollViewWidth);

    if (pageIndex >= 0 && pageIndex < scrollDates.length) {
      const newDate = scrollDates[pageIndex];
      if (newDate && newDate.toDateString() !== currentDate.toDateString()) {
        setCurrentDate(new Date(newDate));
      }
    }
  };

  const renderCalendarView = () => {
    if (currentView === 'month') {
      return (
        <MonthView
          currentDate={currentDate}
          jobs={jobs}
          onDatePress={handleDatePress}
          onJobPress={handleJobPress}
          onZoomToWeek={(startDate) => {
            setCurrentDate(startDate);
            setCurrentView('day');
          }}
          onZoomToDay={(date) => {
            setCurrentDate(date);
            setCurrentView('day');
          }}
        />
      );
    }

    // For day and 3-day views, use horizontal scrolling
    return (
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled={currentView === 'day'}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScroll={handleScroll}
        scrollEventThrottle={1}
        bounces={false}
        decelerationRate="normal"
        onLayout={(event) => {
          const { width } = event.nativeEvent.layout;
          setScrollViewWidth(width);
          // Set scroll position to the center for day view
          if (currentView === 'day') {
            setTimeout(() => {
              const centerIndex = Math.floor(scrollDates.length / 2);
              scrollViewRef.current?.scrollTo({
                x: centerIndex * width,
                animated: false,
              });
            }, 100);
          }
        }}
        style={styles.scrollContainer}
      >
        {scrollDates.map((date, index) => (
          <View key={index} style={[styles.scrollPage, { width: scrollViewWidth || width }]}>
            <DayView
              currentDate={date}
              jobs={jobs}
              onJobPress={handleJobPress}
              onTimeSlotPress={handleTimeSlotPress}
              onUpdateJob={handleUpdateJob}
            />
          </View>
        ))}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with View Controls */}
      <View style={styles.header}>
        <View style={styles.viewToggle}>
          {/* Animated Indicator */}
          <Animated.View
            style={[
              styles.viewIndicator,
              {
                transform: [
                  {
                    translateX: animatedValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, toggleButtonWidth],
                    }),
                  },
                ],
              },
            ]}
          />
          
          {/* View Buttons */}
          {(['month', 'day'] as CalendarView[]).map((view) => (
            <TouchableOpacity
              key={view}
              style={styles.viewButton}
              onPress={() => handleViewChange(view)}
            >
              <Text
                style={[
                  styles.viewButtonText,
                  currentView === view && styles.viewButtonTextActive,
                ]}
              >
                {view.charAt(0).toUpperCase() + view.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.dateNavigation}>
          <TouchableOpacity onPress={navigatePrevious} style={styles.navButton}>
            <FlynnIcon name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          
          <Text style={styles.dateDisplay}>{formatDateDisplay()}</Text>
          
          <TouchableOpacity onPress={navigateNext} style={styles.navButton}>
            <FlynnIcon name="chevron-forward" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

      </View>

      {/* Calendar View */}
      <View style={styles.calendarContainer}>
        {renderCalendarView()}
      </View>


      {/* Floating Add Button */}
      <TouchableOpacity 
        style={styles.floatingButton}
        onPress={handleCreateJob}
      >
        <FlynnIcon name="add" size={24} color={colors.white} />
      </TouchableOpacity>

      {/* Job Details Modal */}
      <JobDetailsModal
        job={selectedJob}
        visible={modalVisible}
        onClose={handleCloseModal}
        onSendTextConfirmation={handleSendTextConfirmation}
        onSendEmailConfirmation={handleSendEmailConfirmation}
        onMarkComplete={handleMarkComplete}
        onReschedule={handleReschedule}
        onEditDetails={handleEditDetails}
        onDeleteJob={handleDeleteJob}
        onUpdateJob={handleUpdateJob}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.gray100,
    borderRadius: borderRadius.md,
    padding: spacing.xxxs,
    marginBottom: spacing.md,
    position: 'relative',
  },
  
  viewIndicator: {
    position: 'absolute',
    top: spacing.xxxs,
    left: spacing.xxxs,
    bottom: spacing.xxxs,
    width: `${100/2}%`,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    zIndex: 1,
  },
  
  viewButton: {
    flex: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    zIndex: 2,
  },
  
  viewButtonText: {
    ...typography.bodyMedium,
    color: colors.gray600,
    fontWeight: '500',
  },
  
  viewButtonTextActive: {
    color: colors.white,
  },
  
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  
  navButton: {
    padding: spacing.xs,
  },
  
  dateDisplay: {
    ...typography.h3,
    color: colors.gray800,
    fontWeight: '600',
  },
  
  
  calendarContainer: {
    flex: 1,
  },
  
  scrollContainer: {
    flex: 1,
    width: '100%',
  },
  
  scrollPage: {
    flex: 1,
  },
  
  continuousTimeline: {
    flex: 1,
    minWidth: '100%',
  },
  
  floatingButton: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
});
