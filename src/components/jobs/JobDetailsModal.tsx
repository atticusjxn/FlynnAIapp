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
}) => {
  if (!job) return null;

  const handleCallClient = () => {
    const phoneUrl = `tel:${job.clientPhone}`;
    Linking.openURL(phoneUrl).catch(() => {
      Alert.alert('Error', 'Unable to make phone call');
    });
  };

  const handleDeleteJob = () => {
    Alert.alert(
      'Delete Job',
      'Are you sure you want to delete this job? This action cannot be undone.',
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
          <Text style={styles.modalTitle}>Job Details</Text>
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
              <View>
                <Text style={styles.clientName}>{job.clientName}</Text>
                <Text style={styles.serviceType}>{job.serviceType}</Text>
              </View>
              <View style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(job.status) + '20' }
              ]}>
                <Text style={[
                  styles.statusText,
                  { color: getStatusColor(job.status) }
                ]}>
                  {getStatusLabel(job.status)}
                </Text>
              </View>
            </View>
          </View>

          {/* Job Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service Details</Text>
            <Text style={styles.description}>{job.description}</Text>
          </View>

          {/* Date & Time */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Appointment</Text>
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>{formatDate(job.date)}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={20} color={colors.primary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Time</Text>
                <Text style={styles.detailValue}>{formatTime(job.time)}</Text>
              </View>
            </View>
            {job.estimatedDuration && (
              <View style={styles.detailRow}>
                <Ionicons name="timer-outline" size={20} color={colors.primary} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Duration</Text>
                  <Text style={styles.detailValue}>{job.estimatedDuration}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Contact & Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact & Location</Text>
            <View style={styles.detailRow}>
              <Ionicons name="call-outline" size={20} color={colors.primary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Phone</Text>
                <TouchableOpacity onPress={handleCallClient}>
                  <Text style={[styles.detailValue, styles.phoneLink]}>
                    {job.clientPhone}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            {job.clientEmail && (
              <View style={styles.detailRow}>
                <Ionicons name="mail-outline" size={20} color={colors.primary} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Email</Text>
                  <Text style={styles.detailValue}>{job.clientEmail}</Text>
                </View>
              </View>
            )}
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={20} color={colors.primary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Location</Text>
                <Text style={styles.detailValue}>{job.location}</Text>
              </View>
            </View>
          </View>

          {/* Notes */}
          {job.notes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <Text style={styles.notes}>{job.notes}</Text>
            </View>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {/* Primary Communication Actions */}
          <View style={styles.primaryActions}>
            <FlynnButton
              title="Send Text"
              onPress={() => onSendTextConfirmation(job)}
              variant="primary"
              size="medium"
              icon={<Ionicons name="chatbubble-outline" size={18} color={colors.white} />}
              style={styles.communicationButton}
            />
            
            <FlynnButton
              title="Send Email"
              onPress={() => onSendEmailConfirmation(job)}
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
              onPress={() => {
                onMarkComplete(job);
                onClose();
              }}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
              <Text style={[styles.secondaryActionText, { color: colors.success }]}>
                Mark Complete
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => {
                onReschedule(job);
                onClose();
              }}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              <Text style={[styles.secondaryActionText, { color: colors.primary }]}>
                Reschedule
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => {
                onEditDetails(job);
                onClose();
              }}
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
});