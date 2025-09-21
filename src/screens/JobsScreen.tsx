import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  SafeAreaView,
  Text,
  TouchableOpacity,
} from 'react-native';
import { spacing, typography, borderRadius, shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useJobs } from '../context/JobsContext';
import { JobCard, Job } from '../components/jobs/JobCard';
import { JobFilterBar, FilterType } from '../components/jobs/JobFilterBar';
import { JobDetailsModal } from '../components/jobs/JobDetailsModal';
import { CommunicationModal } from '../components/jobs/CommunicationModal';
import { EmptyState } from '../components/jobs/EmptyState';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const formatRelativeTime = (timestamp?: string) => {
  if (!timestamp) return 'just now';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'just now';
  }

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));

  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

export const JobsScreen = () => {
  const { colors } = useTheme();
  const { jobs, updateJob, deleteJob, markJobComplete } = useJobs();
  const navigation = useNavigation<any>();
  const styles = createStyles(colors);
  
  // State management
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [showCommunication, setShowCommunication] = useState(false);
  const [communicationType, setCommunicationType] = useState<'text' | 'email'>('text');
  const [refreshing, setRefreshing] = useState(false);

  const pendingFollowUps = useMemo(() =>
    jobs.filter(
      (job) =>
        job.source === 'voicemail' &&
        job.status === 'pending' &&
        !!job.followUpDraft
    ),
    [jobs]
  );

  // Filter jobs based on active filter
  const filteredJobs = useMemo(() => {
    const today = new Date().toDateString();
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    switch (activeFilter) {
      case 'today':
        return jobs.filter(job => new Date(job.date).toDateString() === today);
      case 'this-week':
        return jobs.filter(job => {
          const jobDate = new Date(job.date);
          return jobDate >= startOfWeek && jobDate <= endOfWeek;
        });
      case 'pending':
        return jobs.filter(job => job.status === 'pending');
      case 'complete':
        return jobs.filter(job => job.status === 'complete');
      case 'all':
      default:
        return jobs;
    }
  }, [jobs, activeFilter]);

  // Sort jobs by date and time
  const sortedJobs = useMemo(() => {
    return [...filteredJobs].sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateA.getTime() - dateB.getTime();
    });
  }, [filteredJobs]);

  // Handlers
  const handleJobPress = (job: Job) => {
    setSelectedJob(job);
    setShowJobDetails(true);
  };

  const handleSendTextConfirmation = (job: Job) => {
    setSelectedJob(job);
    setCommunicationType('text');
    setShowCommunication(true);
  };

  const handleSendEmailConfirmation = (job: Job) => {
    if (!job.clientEmail) {
      Alert.alert('No Email', 'This client does not have an email address on file.');
      return;
    }
    setSelectedJob(job);
    setCommunicationType('email');
    setShowCommunication(true);
  };

  const handleReviewFollowUp = (job: Job) => {
    setSelectedJob(job);
    setCommunicationType('text');
    setShowCommunication(true);
  };

  const handleSendFollowUpDraft = async (job: Job) => {
    if (!job.followUpDraft) {
      handleReviewFollowUp(job);
      return;
    }

    try {
      await handleSendMessage(job, job.followUpDraft, 'text');
      Alert.alert('Sent', `Follow-up text sent to ${job.clientName}.`);
    } catch (error) {
      Alert.alert('Error', 'Failed to send the follow-up. Please try again.');
    }
  };

  const handleSendMessage = async (job: Job, message: string, type: 'text' | 'email') => {
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) {
          if (type === 'text') {
            updateJob({
              ...job,
              followUpDraft: message,
              lastFollowUpAt: new Date().toISOString(),
            });
          }
          resolve();
        } else {
          reject(new Error('Failed to send message'));
        }
      }, 1200);
    });
  };

  const handleMarkComplete = (job: Job) => {
    markJobComplete(job.id);
    Alert.alert('Success', `Job for ${job.clientName} marked as complete!`);
  };

  const handleReschedule = (job: Job) => {
    Alert.alert('Reschedule', 'Rescheduling feature coming soon!');
  };

  const handleEditDetails = (job: Job) => {
    console.log('Edit details for job:', job.id);
    // This is now handled inline in the modal
  };

  const handleUpdateJob = (updatedJob: Job) => {
    updateJob(updatedJob);
    console.log('Updated job:', updatedJob);
  };

  const handleDeleteJob = (job: Job) => {
    deleteJob(job.id);
    Alert.alert('Success', `Job for ${job.clientName} has been deleted.`);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate API refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const handleAddJob = () => {
    navigation.navigate('UploadFlow');
  };

  const renderJobCard = ({ item }: { item: Job }) => (
    <JobCard job={item} onPress={handleJobPress} />
  );

  return (
    <SafeAreaView style={styles.container}>
      <JobFilterBar
        jobs={jobs}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      {pendingFollowUps.length > 0 && (
        <View style={styles.followUpShelf}>
          <Text style={styles.followUpTitle}>Voicemail follow-ups awaiting approval</Text>
          {pendingFollowUps.map((job) => (
            <View key={job.id} style={styles.followUpCard}>
              <View style={styles.followUpHeader}>
                <View>
                  <Text style={styles.followUpClient}>{job.clientName}</Text>
                  <Text style={styles.followUpMeta}>
                    {formatRelativeTime(job.capturedAt || job.createdAt)} • {job.clientPhone}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedJob(job);
                    setShowJobDetails(true);
                  }}
                >
                  <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.followUpPreview} numberOfLines={3}>
                {job.followUpDraft}
              </Text>
              <View style={styles.followUpActions}>
                <TouchableOpacity
                  style={[styles.followUpActionButton, styles.followUpApprove]}
                  onPress={() => handleSendFollowUpDraft(job)}
                >
                  <Ionicons name="paper-plane-outline" size={16} color={colors.white} />
                  <Text style={styles.followUpApproveText}>Approve & Send</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.followUpActionButton}
                  onPress={() => handleReviewFollowUp(job)}
                >
                  <Ionicons name="create-outline" size={16} color={colors.primary} />
                  <Text style={styles.followUpReviewText}>Review</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {sortedJobs.length > 0 ? (
        <FlatList
          data={sortedJobs}
          renderItem={renderJobCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      ) : (
        <EmptyState 
          filter={activeFilter} 
          onAddJob={handleAddJob}
        />
      )}

      {/* Job Details Modal */}
      <JobDetailsModal
        job={selectedJob}
        visible={showJobDetails}
        onClose={() => {
          setShowJobDetails(false);
          setSelectedJob(null);
        }}
        onSendTextConfirmation={handleSendTextConfirmation}
        onSendEmailConfirmation={handleSendEmailConfirmation}
        onMarkComplete={handleMarkComplete}
        onReschedule={handleReschedule}
        onEditDetails={handleEditDetails}
        onDeleteJob={handleDeleteJob}
        onUpdateJob={handleUpdateJob}
      />

      {/* Communication Modal */}
      <CommunicationModal
        job={selectedJob}
        visible={showCommunication}
        type={communicationType}
        onClose={() => {
          setShowCommunication(false);
          setSelectedJob(null);
        }}
        onSend={handleSendMessage}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  followUpShelf: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },

  followUpTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },

  followUpCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.xs,
  },

  followUpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },

  followUpClient: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '600',
  },

  followUpMeta: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xxxs,
  },

  followUpPreview: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },

  followUpActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },

  followUpActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxxs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },

  followUpApprove: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  followUpApproveText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.white,
  },

  followUpReviewText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primary,
  },

  listContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
});
