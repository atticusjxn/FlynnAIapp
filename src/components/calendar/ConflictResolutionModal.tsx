import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, shadows } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { Job } from '../jobs/JobCard';

interface ConflictResolutionModalProps {
  visible: boolean;
  conflictedJob: Job | null;
  overlappingJobs: Job[];
  onClose: () => void;
  onRescheduleJob: (job: Job, newTime: string) => void;
  onKeepBothJobs: () => void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  visible,
  conflictedJob,
  overlappingJobs,
  onClose,
  onRescheduleJob,
  onKeepBothJobs,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  if (!conflictedJob) return null;
  

  // Generate time suggestions (1 hour before/after each conflicted time)
  const generateTimeSuggestions = () => {
    if (!conflictedJob) return [];
    
    const suggestions: string[] = [];
    const conflictTimes = [conflictedJob, ...overlappingJobs].filter((job): job is Job => Boolean(job)); // Remove null/undefined
    
    conflictTimes.forEach(job => {
      if (!job || !job.time) return;
      
      const [hours, minutes] = job.time.split(':').map(Number);
      
      // 1 hour before
      const beforeHour = hours - 1;
      if (beforeHour >= 6) {
        suggestions.push(`${beforeHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
      }
      
      // 1 hour after
      const afterHour = hours + 1;
      if (afterHour <= 22) {
        suggestions.push(`${afterHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
      }
      
      // 2 hours after for more options
      const afterHour2 = hours + 2;
      if (afterHour2 <= 22) {
        suggestions.push(`${afterHour2.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
      }
    });
    
    // Remove duplicates and sort
    return [...new Set(suggestions)].sort();
  };

  const timeSuggestions = generateTimeSuggestions();
  
  // Add fallback suggestions if none generated
  const finalSuggestions = timeSuggestions.length > 0 ? timeSuggestions : [
    '09:00', '09:30', '13:00', '13:30', '14:00', '15:00'
  ];
  

  const formatTime12Hour = (time24: string) => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const handleReschedule = () => {
    if (selectedSuggestion && conflictedJob) {
      onRescheduleJob(conflictedJob, selectedSuggestion);
      onClose();
    }
  };

  // Generate available time slots for the selected date
  const generateAvailableSlots = () => {
    const slots = [];
    const dateStr = selectedDate.toISOString().split('T')[0];
    
    // Generate hourly slots from 6 AM to 10 PM
    for (let hour = 6; hour <= 22; hour++) {
      const timeStr = `${hour.toString().padStart(2, '0')}:00`;
      const halfTimeStr = `${hour.toString().padStart(2, '0')}:30`;
      
      // Check if time slot is occupied (simplified - you'd check against actual jobs)
      const isHourOccupied = checkTimeSlotOccupied(dateStr, timeStr);
      const isHalfOccupied = checkTimeSlotOccupied(dateStr, halfTimeStr);
      
      slots.push({
        time: timeStr,
        isAvailable: !isHourOccupied
      });
      
      if (hour < 22) { // Don't add 10:30 PM
        slots.push({
          time: halfTimeStr,
          isAvailable: !isHalfOccupied
        });
      }
    }
    
    return slots;
  };

  // Check if a specific time slot is occupied by existing jobs
  const checkTimeSlotOccupied = (dateStr: string, timeStr: string) => {
    // This would typically check against the jobs array passed as props
    // For now, simulate some occupied slots
    const occupiedTimes = ['10:00', '10:30', '11:00', '14:30', '15:00'];
    
    // If it's the current conflict date, mark conflicted times as occupied
    if (dateStr === conflictedJob?.date) {
      return occupiedTimes.includes(timeStr);
    }
    
    // For other dates, simulate some random occupied slots
    const randomOccupied = ['09:00', '13:00', '16:00', '17:30'];
    return randomOccupied.includes(timeStr);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="warning" size={24} color={colors.error} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>Scheduling Conflict</Text>
              <Text style={styles.subtitle}>
                This appointment overlaps with other bookings
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.gray600} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.content} 
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Conflicted Jobs */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Conflicting Appointments</Text>
              
              <View style={styles.jobCard}>
                <View style={styles.jobInfo}>
                  <Text style={styles.jobName}>{conflictedJob.clientName}</Text>
                  <Text style={styles.jobTime}>{formatTime12Hour(conflictedJob.time)}</Text>
                  <Text style={styles.jobService}>{conflictedJob.serviceType}</Text>
                </View>
              </View>

              {overlappingJobs.map(job => (
                <View key={job.id} style={styles.jobCard}>
                  <View style={styles.jobInfo}>
                    <Text style={styles.jobName}>{job.clientName}</Text>
                    <Text style={styles.jobTime}>{formatTime12Hour(job.time)}</Text>
                    <Text style={styles.jobService}>{job.serviceType}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Resolution Options */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>How would you like to resolve this?</Text>
              
              {/* Keep Both Option */}
              <TouchableOpacity 
                style={styles.optionCard}
                onPress={onKeepBothJobs}
              >
                <View style={styles.optionIcon}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={colors.warning} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Keep Both Appointments</Text>
                  <Text style={styles.optionDescription}>
                    Schedule them back-to-back and manage manually
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Reschedule Option */}
              <View style={styles.optionCard}>
                <View style={styles.optionIcon}>
                  <Ionicons name="time-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Reschedule "{conflictedJob.clientName}"</Text>
                  <Text style={styles.optionDescription}>
                    Move to a suggested available time slot
                  </Text>
                  
                  {/* Time Suggestions */}
                  <View style={styles.timeSuggestions}>
                    {finalSuggestions.map(time => (
                      <TouchableOpacity
                        key={time}
                        style={[
                          styles.timeSuggestion,
                          selectedSuggestion === time && styles.selectedSuggestion
                        ]}
                        onPress={() => setSelectedSuggestion(time)}
                      >
                        <Text style={[
                          styles.suggestionText,
                          selectedSuggestion === time && styles.selectedSuggestionText
                        ]}>
                          {formatTime12Hour(time)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  
                  {/* Custom Time Button */}
                  <TouchableOpacity 
                    style={styles.customTimeButton}
                    onPress={() => setShowCustomPicker(!showCustomPicker)}
                  >
                    <Ionicons 
                      name={showCustomPicker ? "chevron-up" : "calendar-outline"} 
                      size={16} 
                      color={colors.primary} 
                    />
                    <Text style={styles.customTimeText}>
                      {showCustomPicker ? "Hide Calendar" : "Choose Custom Time"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Custom Time Picker - Expandable */}
              {showCustomPicker && (
                <View style={styles.customPickerSection}>
                  <Text style={styles.sectionTitle}>Select Date & Time</Text>
                  
                  {/* Date Navigation */}
                  <View style={styles.dateNavigation}>
                    <TouchableOpacity 
                      style={styles.dateNavButton}
                      onPress={() => {
                        const newDate = new Date(selectedDate);
                        newDate.setDate(selectedDate.getDate() - 1);
                        setSelectedDate(newDate);
                      }}
                    >
                      <Ionicons name="chevron-back" size={20} color={colors.primary} />
                    </TouchableOpacity>
                    
                    <Text style={styles.selectedDateText}>
                      {selectedDate.toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </Text>
                    
                    <TouchableOpacity 
                      style={styles.dateNavButton}
                      onPress={() => {
                        const newDate = new Date(selectedDate);
                        newDate.setDate(selectedDate.getDate() + 1);
                        setSelectedDate(newDate);
                      }}
                    >
                      <Ionicons name="chevron-forward" size={20} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                  
                  {/* Available Time Slots */}
                  <View style={styles.availableSlots}>
                    {generateAvailableSlots().map(slot => (
                      <TouchableOpacity
                        key={slot.time}
                        style={[
                          styles.availableSlot,
                          slot.isAvailable ? styles.availableSlotEnabled : styles.availableSlotDisabled,
                          selectedSuggestion === slot.time && styles.selectedSuggestion
                        ]}
                        onPress={() => slot.isAvailable && setSelectedSuggestion(slot.time)}
                        disabled={!slot.isAvailable}
                      >
                        <Text style={[
                          styles.availableSlotText,
                          !slot.isAvailable && styles.disabledSlotText,
                          selectedSuggestion === slot.time && styles.selectedSuggestionText
                        ]}>
                          {formatTime12Hour(slot.time)}
                        </Text>
                        {!slot.isAvailable && (
                          <Text style={styles.occupiedText}>Occupied</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.rescheduleButton,
                !selectedSuggestion && styles.disabledButton
              ]}
              onPress={handleReschedule}
              disabled={!selectedSuggestion}
            >
              <Text style={[
                styles.rescheduleButtonText,
                !selectedSuggestion && styles.disabledButtonText
              ]}>
                Reschedule
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  
  modalContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: Dimensions.get('window').height * 0.9,
    paddingBottom: spacing.lg,
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  
  headerIcon: {
    marginRight: spacing.sm,
  },
  
  headerText: {
    flex: 1,
  },
  
  title: {
    ...typography.h3,
    color: colors.error,
    fontWeight: '700',
  },
  
  subtitle: {
    ...typography.bodySmall,
    color: colors.gray600,
    marginTop: spacing.xxxs,
  },
  
  closeButton: {
    padding: spacing.xs,
  },
  
  content: {
    paddingHorizontal: spacing.lg,
    maxHeight: 400, // Limit height to enable scrolling
  },
  
  section: {
    marginTop: spacing.lg,
  },
  
  sectionTitle: {
    ...typography.h4,
    color: colors.gray800,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  
  jobCard: {
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
  },
  
  jobInfo: {
    gap: spacing.xxxs,
  },
  
  jobName: {
    ...typography.bodyMedium,
    color: colors.gray800,
    fontWeight: '700',
  },
  
  jobTime: {
    ...typography.bodyMedium,
    color: colors.error,
    fontWeight: '600',
  },
  
  jobService: {
    ...typography.bodySmall,
    color: colors.gray600,
  },
  
  optionCard: {
    flexDirection: 'row',
    backgroundColor: colors.gray50,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  
  optionIcon: {
    marginRight: spacing.sm,
    marginTop: spacing.xxxs,
  },
  
  optionContent: {
    flex: 1,
  },
  
  optionTitle: {
    ...typography.bodyMedium,
    color: colors.gray800,
    fontWeight: '600',
    marginBottom: spacing.xxxs,
  },
  
  optionDescription: {
    ...typography.bodySmall,
    color: colors.gray600,
    marginBottom: spacing.sm,
  },
  
  timeSuggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  
  timeSuggestion: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  
  selectedSuggestion: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  
  suggestionText: {
    ...typography.caption,
    color: colors.gray700,
    fontWeight: '500',
  },
  
  selectedSuggestionText: {
    color: colors.white,
  },
  
  actions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  
  cancelButton: {
    flex: 1,
    backgroundColor: colors.gray200,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  
  cancelButtonText: {
    ...typography.bodyMedium,
    color: colors.gray700,
    fontWeight: '600',
  },
  
  rescheduleButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  
  rescheduleButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
  },
  
  disabledButton: {
    backgroundColor: colors.gray300,
  },
  
  disabledButtonText: {
    color: colors.gray500,
  },
  
  // Custom Time Picker Styles
  customTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  
  customTimeText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  
  customPickerSection: {
    backgroundColor: colors.gray50,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  
  dateNavButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primaryLight,
  },
  
  selectedDateText: {
    ...typography.bodyMedium,
    color: colors.gray800,
    fontWeight: '600',
  },
  
  availableSlots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  
  availableSlot: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  
  availableSlotEnabled: {
    backgroundColor: colors.white,
    borderColor: colors.border,
  },
  
  availableSlotDisabled: {
    backgroundColor: colors.gray100,
    borderColor: colors.gray300,
  },
  
  availableSlotText: {
    ...typography.caption,
    color: colors.gray700,
    fontWeight: '500',
  },
  
  disabledSlotText: {
    color: colors.gray400,
  },
  
  occupiedText: {
    fontSize: 9,
    color: colors.gray400,
    fontStyle: 'italic',
  },
});
