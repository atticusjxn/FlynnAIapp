import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { spacing, typography, borderRadius, shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { Job } from '../components/jobs/JobCard';
import { JobDetailsModal } from '../components/jobs/JobDetailsModal';
import { MonthView } from '../components/calendar/MonthView';
import { WeekView } from '../components/calendar/WeekView';
import { DayView } from '../components/calendar/DayView';
import { JobEvent } from '../components/calendar/JobEvent';

type CalendarView = 'month' | 'week' | 'day';

// Mock calendar data - will be replaced with real data
const mockCalendarJobs: Job[] = [
  {
    id: '1',
    clientName: 'Sarah Johnson',
    clientPhone: '+1 (555) 123-4567',
    clientEmail: 'sarah.j@email.com',
    serviceType: 'Kitchen Repair',
    description: 'Fix leaking faucet and replace cabinet hinges',
    date: '2025-01-15',
    time: '09:00',
    location: '123 Oak Street, Downtown',
    status: 'pending',
    businessType: 'home services',
    estimatedDuration: '2 hours',
    createdAt: '2025-01-10T09:00:00Z',
  },
  {
    id: '2',
    clientName: 'Michael Chen',
    clientPhone: '+1 (555) 234-5678',
    clientEmail: 'mchen@gmail.com',
    serviceType: 'Electrical Work',
    description: 'Install new ceiling fan in bedroom',
    date: '2025-01-15',
    time: '14:00',
    location: '456 Pine Ave, Westside',
    status: 'in-progress',
    businessType: 'home services',
    estimatedDuration: '1.5 hours',
    createdAt: '2025-01-12T10:00:00Z',
  },
  {
    id: '3',
    clientName: 'Emma Davis',
    clientPhone: '+1 (555) 345-6789',
    clientEmail: 'emma.davis@outlook.com',
    serviceType: 'Manicure & Pedicure',
    description: 'Full spa manicure and pedicure with gel polish',
    date: '2025-01-16',
    time: '10:30',
    location: 'Flynn Beauty Salon',
    status: 'pending',
    businessType: 'beauty',
    estimatedDuration: '1.5 hours',
    createdAt: '2025-01-13T11:00:00Z',
  },
  {
    id: '4',
    clientName: 'Robert Wilson',
    clientPhone: '+1 (555) 456-7890',
    serviceType: 'Plumbing Service',
    description: 'Unclog main bathroom drain',
    date: '2025-01-16',
    time: '16:00',
    location: '789 Maple Dr, Eastside',
    status: 'complete',
    businessType: 'home services',
    estimatedDuration: '1 hour',
    createdAt: '2025-01-14T12:00:00Z',
  },
  {
    id: '5',
    clientName: 'Lisa Park',
    clientPhone: '+1 (555) 567-8901',
    clientEmail: 'lisa.park@design.co',
    serviceType: 'Hair Styling',
    description: 'Cut and color for special event',
    date: '2025-01-17',
    time: '13:00',
    location: 'Flynn Beauty Salon',
    status: 'pending',
    businessType: 'beauty',
    estimatedDuration: '2.5 hours',
    createdAt: '2025-01-15T09:30:00Z',
  },
];

export const CalendarScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const styles = createStyles(colors);
  const [currentView, setCurrentView] = useState<CalendarView>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Animation for view toggle indicator
  const animatedValue = useRef(new Animated.Value(0)).current;
  const { width } = Dimensions.get('window');
  const toggleButtonWidth = (width - (spacing.lg * 2) - (spacing.xxxs * 2)) / 3;

  // Animate indicator when view changes
  useEffect(() => {
    const viewIndex = currentView === 'month' ? 0 : currentView === 'week' ? 1 : 2;
    Animated.spring(animatedValue, {
      toValue: viewIndex,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start();
  }, [currentView]);

  const handleViewChange = (view: CalendarView) => {
    setCurrentView(view);
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

  const handleMarkComplete = useCallback((job: Job) => {
    console.log('Mark complete for job:', job.id);
  }, []);

  const handleReschedule = useCallback((job: Job) => {
    console.log('Reschedule job:', job.id);
  }, []);

  const handleEditDetails = useCallback((job: Job) => {
    console.log('Edit details for job:', job.id);
    // This is now handled inline in the modal
  }, []);

  const handleUpdateJob = useCallback((updatedJob: Job) => {
    // Update the job in the mock data array
    // In a real app, this would update the backend and refresh the data
    console.log('Updated job:', updatedJob);
    
    // For now, just log the update since we're using mock data
    // In a real implementation, you would:
    // 1. Make API call to update the job
    // 2. Update local state/context
    // 3. Refresh the calendar data
  }, []);

  const handleDeleteJob = useCallback((job: Job) => {
    console.log('Delete job:', job.id);
  }, []);

  const navigateToToday = () => {
    setCurrentDate(new Date());
  };

  const navigatePrevious = () => {
    const newDate = new Date(currentDate);
    if (currentView === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (currentView === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    if (currentView === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (currentView === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const formatDateDisplay = () => {
    if (currentView === 'month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (currentView === 'week') {
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      
      return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    } else {
      return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
  };

  const getTodaysJobs = () => {
    const today = new Date().toISOString().split('T')[0];
    return mockCalendarJobs.filter(job => job.date === today);
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
    navigation.navigate('JobFormDemo' as never, {
      prefilledData: {
        date: formattedDate,
        time: formattedTime
      }
    } as never);
  }, [navigation]);

  const handleCreateJob = useCallback(() => {
    navigation.navigate('JobFormDemo' as never);
  }, [navigation]);

  const renderCalendarView = () => {
    switch (currentView) {
      case 'month':
        return (
          <MonthView
            currentDate={currentDate}
            jobs={mockCalendarJobs}
            onDatePress={handleDatePress}
            onJobPress={handleJobPress}
          />
        );
      case 'week':
        return (
          <WeekView
            currentDate={currentDate}
            jobs={mockCalendarJobs}
            onJobPress={handleJobPress}
            onTimeSlotPress={handleTimeSlotPress}
          />
        );
      case 'day':
        return (
          <DayView
            currentDate={currentDate}
            jobs={mockCalendarJobs}
            onJobPress={handleJobPress}
            onTimeSlotPress={handleTimeSlotPress}
          />
        );
      default:
        return null;
    }
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
                      inputRange: [0, 1, 2],
                      outputRange: [0, toggleButtonWidth, toggleButtonWidth * 2],
                    }),
                  },
                ],
              },
            ]}
          />
          
          {/* View Buttons */}
          {(['month', 'week', 'day'] as CalendarView[]).map((view) => (
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
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          
          <Text style={styles.dateDisplay}>{formatDateDisplay()}</Text>
          
          <TouchableOpacity onPress={navigateNext} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={navigateToToday} style={styles.todayButton}>
          <Text style={styles.todayButtonText}>Today</Text>
        </TouchableOpacity>
      </View>

      {/* Calendar View */}
      <View style={styles.calendarContainer}>
        {renderCalendarView()}
      </View>

      {/* Today's Jobs Summary */}
      <View style={styles.todaysJobs}>
        <Text style={styles.todaysJobsTitle}>Today's Schedule</Text>
        {getTodaysJobs().length === 0 ? (
          <Text style={styles.noJobsText}>No jobs scheduled for today</Text>
        ) : (
          getTodaysJobs().map((job) => (
            <JobEvent
              key={job.id}
              job={job}
              onPress={handleJobPress}
              variant="compact"
              style={styles.todayJobItem}
            />
          ))
        )}
      </View>

      {/* Floating Add Button */}
      <TouchableOpacity 
        style={styles.floatingButton}
        onPress={handleCreateJob}
      >
        <Ionicons name="add" size={24} color={colors.white} />
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
    width: `${100/3}%`,
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
  
  todayButton: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
  },
  
  todayButtonText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
  },
  
  calendarContainer: {
    flex: 1,
  },
  
  
  todaysJobs: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  
  todaysJobsTitle: {
    ...typography.h4,
    color: colors.gray800,
    marginBottom: spacing.sm,
  },
  
  noJobsText: {
    ...typography.bodyMedium,
    color: colors.gray500,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  
  todayJobItem: {
    marginBottom: spacing.xs,
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