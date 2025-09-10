import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { FlynnButton } from '../ui/FlynnButton';
import { Job } from './JobCard';

interface JobDetailsModalProps {
  job: Job | null;
  visible: boolean;
  onClose: () => void;
  onSendTextConfirmation: (job: Job) => void;
  onSendEmailConfirmation: (job: Job) => void;
  onMarkComplete: (job: Job) => void;
  onReschedule: (job: Job) => void;
  onEditDetails: (job: Job) => void;
  onDeleteJob: (job: Job) => void;
  onUpdateJob: (updatedJob: Job) => void;
}

const getStatusColor = (status: Job['status']) => {
  switch (status) {
    case 'pending':
      return colors.warning;
    case 'in-progress':
      return colors.primary;
    case 'complete':
      return colors.success;
    default:
      return colors.gray600;
  }
};

const getStatusLabel = (status: Job['status']) => {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'in-progress':
      return 'In Progress';
    case 'complete':
      return 'Complete';
    default:
      return status;
  }
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    weekday: 'long',
    year: 'numeric',
    month: 'long', 
    day: 'numeric'
  });
};

const formatTime = (timeString: string) => {
  try {
    const time = new Date(`1970-01-01T${timeString}`);
    return time.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  } catch {
    return timeString;
  }
};

const getModalTitle = (businessType: string) => {
  const personalCareTypes = ['personal care', 'beauty', 'wellness', 'health', 'fitness', 'spa', 'salon'];
  const isPersonalCare = personalCareTypes.some(type => 
    businessType.toLowerCase().includes(type)
  );
  return isPersonalCare ? 'Booking Details' : 'Job Details';
};

export const JobDetailsModal: React.FC<JobDetailsModalProps> = ({
  job,
  visible,
  onClose,
  onSendTextConfirmation,
  onSendEmailConfirmation,
  onMarkComplete,
  onReschedule,
  onEditDetails,
  onDeleteJob,
  onUpdateJob,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedJob, setEditedJob] = useState<Job | null>(null);

  // Initialize edited job when job changes or modal visibility changes
  React.useEffect(() => {
    if (job) {
      setEditedJob({ ...job });
      setIsEditing(false); // Reset editing state when job changes
    }
  }, [job, visible]);

  // Early return after hooks
  if (!job) return null;

  const handleStartEditing = () => {
    setEditedJob({ ...job });
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setEditedJob({ ...job });
    setIsEditing(false);
  };

  const handleConfirmEdits = () => {
    if (editedJob) {
      onUpdateJob(editedJob);
      setIsEditing(false);
      Alert.alert('Success', 'Job details updated successfully!');
    }
  };

  const updateEditedField = (field: keyof Job, value: string) => {
    if (editedJob) {
      setEditedJob({ ...editedJob, [field]: value });
    }
  };

  const currentJob = isEditing ? editedJob : job;
  if (!currentJob) return null;

  // Editable field component
  const EditableField: React.FC<{
    label: string;
    value: string;
    field: keyof Job;
    multiline?: boolean;
    icon?: any;
  }> = ({ label, value, field, multiline = false, icon }) => {
    if (isEditing) {
      return (
        <View style={styles.detailRow}>
          {icon && icon}
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>{label}</Text>
            <TextInput
              style={[
                styles.editInput,
                multiline && styles.editInputMultiline
              ]}
              value={value}
              onChangeText={(text) => updateEditedField(field, text)}
              multiline={multiline}
              placeholder={`Enter ${label.toLowerCase()}`}
            />
          </View>
        </View>
      );
    }

    return (
      <View style={styles.detailRow}>
        {icon && icon}
        <View style={styles.detailContent}>
          <Text style={styles.detailLabel}>{label}</Text>
          <Text style={styles.detailValue}>{value}</Text>
        </View>
      </View>
    );
  };

  const handleCallClient = () => {
    const phoneUrl = `tel:${job.clientPhone}`;
    Linking.openURL(phoneUrl).catch(() => {
      Alert.alert('Error', 'Unable to make phone call');
    });
  };

  const handleDeleteJob = () => {
    const deleteText = getModalTitle(job.businessType).includes('Booking') ? 'Delete Booking' : 'Delete Job';
    const confirmText = getModalTitle(job.businessType).includes('Booking') 
      ? 'Are you sure you want to delete this booking? This action cannot be undone.'
      : 'Are you sure you want to delete this job? This action cannot be undone.';
    
    Alert.alert(
      deleteText,
      confirmText,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            onDeleteJob(job);
            onClose();
          }
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.modalTitle}>{getModalTitle(job.businessType)}</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color={colors.gray600} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Client Information */}
          <View style={styles.section}>
            <View style={styles.clientHeader}>
              <View style={{ flex: 1 }}>
                {isEditing ? (
                  <>
                    <TextInput
                      style={[styles.editInput, { fontSize: 18, fontWeight: '600' }]}
                      value={currentJob.clientName}
                      onChangeText={(text) => updateEditedField('clientName', text)}
                      placeholder="Enter client name"
                    />
                    <TextInput
                      style={[styles.editInput, { marginTop: spacing.xs }]}
                      value={currentJob.serviceType}
                      onChangeText={(text) => updateEditedField('serviceType', text)}
                      placeholder="Enter service type"
                    />
                  </>
                ) : (
                  <>
                    <Text style={styles.clientName}>{currentJob.clientName}</Text>
                    <Text style={styles.serviceType}>{currentJob.serviceType}</Text>
                  </>
                )}
              </View>
              <View style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(currentJob.status) + '20' }
              ]}>
                <Text style={[
                  styles.statusText,
                  { color: getStatusColor(currentJob.status) }
                ]}>
                  {getStatusLabel(currentJob.status)}
                </Text>
              </View>
            </View>
          </View>

          {/* Job Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service Details</Text>
            {isEditing ? (
              <TextInput
                style={[styles.editInput, styles.editInputMultiline]}
                value={currentJob.description}
                onChangeText={(text) => updateEditedField('description', text)}
                multiline
                placeholder="Enter service description"
              />
            ) : (
              <Text style={styles.description}>{currentJob.description}</Text>
            )}
          </View>

          {/* Date & Time */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Appointment</Text>
            <EditableField
              label="Date"
              value={isEditing ? currentJob.date : formatDate(currentJob.date)}
              field="date"
              icon={<Ionicons name="calendar-outline" size={20} color={colors.primary} />}
            />
            <EditableField
              label="Time"
              value={isEditing ? currentJob.time : formatTime(currentJob.time)}
              field="time"
              icon={<Ionicons name="time-outline" size={20} color={colors.primary} />}
            />
            {(currentJob.estimatedDuration || isEditing) && (
              <EditableField
                label="Duration"
                value={currentJob.estimatedDuration || ''}
                field="estimatedDuration"
                icon={<Ionicons name="timer-outline" size={20} color={colors.primary} />}
              />
            )}
          </View>

          {/* Contact & Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact & Location</Text>
            <View style={styles.detailRow}>
              <Ionicons name="call-outline" size={20} color={colors.primary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Phone</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.editInput}
                    value={currentJob.clientPhone}
                    onChangeText={(text) => updateEditedField('clientPhone', text)}
                    placeholder="Enter phone number"
                    keyboardType="phone-pad"
                  />
                ) : (
                  <TouchableOpacity onPress={handleCallClient}>
                    <Text style={[styles.detailValue, styles.phoneLink]}>
                      {currentJob.clientPhone}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {(currentJob.clientEmail || isEditing) && (
              <EditableField
                label="Email"
                value={currentJob.clientEmail || ''}
                field="clientEmail"
                icon={<Ionicons name="mail-outline" size={20} color={colors.primary} />}
              />
            )}
            <EditableField
              label="Location"
              value={currentJob.location}
              field="location"
              icon={<Ionicons name="location-outline" size={20} color={colors.primary} />}
            />
          </View>

          {/* Notes */}
          {(currentJob.notes || isEditing) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes</Text>
              {isEditing ? (
                <TextInput
                  style={[styles.editInput, styles.editInputMultiline]}
                  value={currentJob.notes || ''}
                  onChangeText={(text) => updateEditedField('notes', text)}
                  multiline
                  placeholder="Enter additional notes"
                />
              ) : (
                <Text style={styles.notes}>{currentJob.notes}</Text>
              )}
            </View>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {isEditing ? (
            /* Edit Mode Actions */
            <View style={styles.editActions}>
              <FlynnButton
                title="Cancel"
                onPress={handleCancelEditing}
                variant="secondary"
                size="medium"
                icon={<Ionicons name="close-outline" size={18} color={colors.primary} />}
                style={styles.editButton}
              />
              
              <FlynnButton
                title="Confirm Edits"
                onPress={handleConfirmEdits}
                variant="primary"
                size="medium"
                icon={<Ionicons name="checkmark-outline" size={18} color={colors.white} />}
                style={styles.editButton}
              />
            </View>
          ) : (
            <>
              {/* Primary Communication Actions */}
              <View style={styles.primaryActions}>
                <FlynnButton
                  title="Send Text"
                  onPress={() => onSendTextConfirmation(currentJob)}
                  variant="primary"
                  size="medium"
                  icon={<Ionicons name="chatbubble-outline" size={18} color={colors.white} />}
                  style={styles.communicationButton}
                />
                
                <FlynnButton
                  title="Email"
                  onPress={() => onSendEmailConfirmation(currentJob)}
                  variant="secondary"
                  size="medium"
                  icon={<Ionicons name="mail-outline" size={18} color={colors.primary} />}
                  style={styles.communicationButton}
                />
                
                <FlynnButton
                  title="Call"
                  onPress={handleCallClient}
                  variant="success"
                  size="medium"
                  icon={<Ionicons name="call-outline" size={18} color={colors.white} />}
                  style={styles.communicationButton}
                />
              </View>

              {/* Secondary Actions */}
              <View style={styles.secondaryActions}>
                <TouchableOpacity
                  style={styles.secondaryAction}
                  onPress={handleStartEditing}
                >
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                  <Text style={[styles.secondaryActionText, { color: colors.primary }]}>
                    Edit Details
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryAction}
                  onPress={handleDeleteJob}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                  <Text style={[styles.secondaryActionText, { color: colors.error }]}>
                    Delete Job
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  
  modalTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  
  closeButton: {
    padding: spacing.xs,
  },
  
  content: {
    flex: 1,
    paddingVertical: spacing.md,
  },
  
  section: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  
  clientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  
  clientName: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xxxs,
  },
  
  serviceType: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
  },
  
  statusBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
  },
  
  statusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  
  sectionTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  
  description: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  
  detailContent: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  
  detailLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  detailValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginTop: spacing.xxxs,
  },
  
  phoneLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  
  notes: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  
  actionContainer: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  
  primaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  
  communicationButton: {
    flex: 1,
  },
  
  secondaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'center',
  },
  
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray50,
    minWidth: '45%',
  },
  
  secondaryActionText: {
    ...typography.bodyMedium,
    marginLeft: spacing.xs,
    fontWeight: '500',
  },
  
  // Edit Mode Styles
  editInput: {
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.white,
    marginTop: spacing.xxxs,
  },
  
  editInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  
  editActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  
  editButton: {
    flex: 1,
  },
});