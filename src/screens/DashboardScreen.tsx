import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { FlynnIcon } from '../components/ui/FlynnIcon';
import { useAuth } from '../context/AuthContext';
import { typography, spacing, borderRadius, shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { fetchDashboardActivities, DashboardActivity, formatActivityTime } from '../services/dashboardService';
import { Job } from '../components/jobs/JobCard';
import { ActivityHistoryModal } from '../components/dashboard/ActivityHistoryModal';
import { ActivityDetailsModal } from '../components/dashboard/ActivityDetailsModal';
import { JobDetailsModal } from '../components/jobs/JobDetailsModal';
import { useJobs } from '../context/JobsContext';
import { FloatingActionButton } from '../components/common/FloatingActionButton';
import { VoicemailPreviewCard } from '../components/dashboard/VoicemailPreviewCard';
import { DashboardVoicemail, fetchRecentVoicemails } from '../services/voicemailService';

export const DashboardScreen = () => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const {
    jobs,
    updateJob,
    deleteJob,
    markJobComplete,
    refreshJobs,
    saveJobEdits,
    loading: jobsLoading,
  } = useJobs();
  const navigation = useNavigation<any>();
  const [showActivityHistory, setShowActivityHistory] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobModalVisible, setJobModalVisible] = useState(false);
  const [activities, setActivities] = useState<DashboardActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<DashboardActivity | null>(null);
  const [activityModalVisible, setActivityModalVisible] = useState(false);
  const [voicemails, setVoicemails] = useState<DashboardVoicemail[]>([]);
  const [voicemailsLoading, setVoicemailsLoading] = useState(false);
  const styles = createStyles(colors);
  const isRefreshing = jobsLoading || activitiesLoading || voicemailsLoading;

  // Get real data
  const getUpcomingJob = (): Job | null => {
    const now = new Date();
    const upcomingJobs = jobs
      .filter(job => {
        const jobDate = new Date(job.date + 'T' + job.time);
        return jobDate > now && (job.status === 'pending' || job.status === 'in-progress');
      })
      .sort((a, b) => {
        const dateA = new Date(a.date + 'T' + a.time);
        const dateB = new Date(b.date + 'T' + b.time);
        return dateA.getTime() - dateB.getTime();
      });
    
    return upcomingJobs.length > 0 ? upcomingJobs[0] : null;
  };

  const recentActivities = activities.slice(0, 5);
  const upcomingJob = getUpcomingJob();

  const onRefresh = async () => {
    try {
      await Promise.all([refreshJobs(), loadActivities(), loadVoicemails()]);
    } catch (error) {
      console.error('[Dashboard] Refresh failed:', error);
    }
  };

  const loadActivities = async () => {
    if (!user?.id) {
      setActivities([]);
      return;
    }

    setActivitiesLoading(true);
    try {
      const fetched = await fetchDashboardActivities(user.id);
      setActivities(fetched);
    } catch (error) {
      console.error('[Dashboard] Failed to load activities', error);
      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  };

  const loadVoicemails = async () => {
    if (!user?.id) {
      setVoicemails([]);
      return;
    }

    setVoicemailsLoading(true);
    try {
      const recent = await fetchRecentVoicemails(user.id, 5);
      setVoicemails(recent);
    } catch (error) {
      console.error('[Dashboard] Failed to load voicemails', error);
      setVoicemails([]);
    } finally {
      setVoicemailsLoading(false);
    }
  };

  useEffect(() => {
    void loadActivities();
    void loadVoicemails();
  }, [user?.id]);

  const handleCallClient = (phone: string) => {
    const phoneUrl = `tel:${phone}`;
    Linking.openURL(phoneUrl).catch(() => {
      Alert.alert('Error', 'Unable to make phone call');
    });
  };

  const handlePlayVoicemail = (recordingUrl: string) => {
    Linking.openURL(recordingUrl).catch(() => {
      Alert.alert('Playback unavailable', 'Could not open the voicemail audio. Try again later.');
    });
  };

  const handleViewJobDetails = (job: Job) => {
    setSelectedJob(job);
    setJobModalVisible(true);
  };

  const handleCloseJobModal = () => {
    setJobModalVisible(false);
    setSelectedJob(null);
  };

  const handleSendTextConfirmation = (job: Job) => {
    Alert.alert('Text Sent', `Confirmation text sent to ${job.clientName}`);
  };

  const handleSendEmailConfirmation = (job: Job) => {
    Alert.alert('Email Sent', `Confirmation email sent to ${job.clientName}`);
  };

  const handleMarkComplete = (job: Job) => {
    markJobComplete(job.id);
    handleCloseJobModal();
    Alert.alert('Job Complete', `${job.clientName}'s ${job.serviceType} marked as complete`);
  };

  const handleReschedule = (job: Job) => {
    Alert.alert('Reschedule', `Reschedule ${job.clientName}'s ${job.serviceType}`);
  };

  const handleEditDetails = (job: Job) => {
    Alert.alert('Edit Details', `Edit details for ${job.clientName}'s ${job.serviceType}`);
  };

  const handleUpdateJob = async (updatedJob: Job) => {
    try {
      await saveJobEdits(updatedJob);
    } catch (error) {
      Alert.alert('Error', 'Unable to save job changes right now.');
    }
  };

  const handleDeleteJob = (job: Job) => {
    deleteJob(job.id);
    handleCloseJobModal();
    Alert.alert('Job Deleted', `${job.clientName}'s ${job.serviceType} has been deleted`);
  };

  const handleActivityAction = (activity: DashboardActivity) => {
    setSelectedActivity(activity);
    setActivityModalVisible(true);
  };

  const handleCloseActivityModal = () => {
    setActivityModalVisible(false);
    setSelectedActivity(null);
  };

  const handleCallClientFromActivity = (phone: string) => {
    handleCallClient(phone);
    handleCloseActivityModal();
  };

  const handleNavigateToJobFromActivity = (jobId: string) => {
    // Find the job by ID and open the job details modal
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      setSelectedJob(job);
      setJobModalVisible(true);
    }
  };

  const handleOpenVoicemailJob = (jobId: string) => {
    handleNavigateToJobFromActivity(jobId);
  };

  const handleActivityHistoryPress = (activity: DashboardActivity) => {
    // Keep activity history modal open and let it handle the details internally
    // The ActivityHistoryModal now handles showing details within itself
  };

  const formatJobDateTime = (date: string, time: string) => {
    const jobDate = new Date(date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let dayText = '';
    if (jobDate.toDateString() === today.toDateString()) {
      dayText = 'Today';
    } else if (jobDate.toDateString() === tomorrow.toDateString()) {
      dayText = 'Tomorrow';
    } else {
      dayText = jobDate.toLocaleDateString('en-US', { 
        weekday: 'short',
        month: 'short', 
        day: 'numeric' 
      });
    }
    
    // Format time
    const [hours, minutes] = time.split(':');
    const timeObj = new Date();
    timeObj.setHours(parseInt(hours), parseInt(minutes));
    const timeText = timeObj.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    return `${dayText}, ${timeText}`;
  };

  const getUserName = () => {
    if (user?.email) {
      const name = user.email.split('@')[0];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    return 'there';
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      >
      {/* Welcome Section */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>Welcome back, {getUserName()} 👋</Text>
      </View>

      {/* Recent Voicemails */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FlynnIcon name="mic-outline" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Recent Voicemails</Text>
        </View>
        {voicemailsLoading && voicemails.length === 0 ? (
          <View style={styles.emptyActivityCard}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.emptyActivityDescription}>Loading voicemails…</Text>
          </View>
        ) : voicemails.length > 0 ? (
          <View style={styles.voicemailList}>
            {voicemails.map(voicemail => (
              <VoicemailPreviewCard
                key={voicemail.id}
                voicemail={voicemail}
                onPlayRecording={handlePlayVoicemail}
                onOpenJob={voicemail.jobId ? handleOpenVoicemailJob : undefined}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyActivityCard}>
            <FlynnIcon name="mic-outline" size={32} color={colors.gray400} />
            <Text style={styles.emptyActivityTitle}>No voicemails yet</Text>
            <Text style={styles.emptyActivityDescription}>New voicemails will appear here instantly.</Text>
          </View>
        )}
      </View>

      {/* Upcoming Event Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FlynnIcon name="calendar-outline" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Upcoming Event</Text>
        </View>
        {upcomingJob ? (
          <TouchableOpacity 
            style={styles.upcomingEventCard} 
            activeOpacity={0.7}
            onPress={() => handleViewJobDetails(upcomingJob)}
          >
            <Text style={styles.eventTime}>{formatJobDateTime(upcomingJob.date, upcomingJob.time)}</Text>
            <Text style={styles.eventTitle}>{upcomingJob.serviceType} - {upcomingJob.clientName}</Text>
            <View style={styles.locationRow}>
              <FlynnIcon name="location-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.eventLocation}>{upcomingJob.location}</Text>
            </View>
            {upcomingJob.estimatedDuration && (
              <View style={styles.durationRow}>
                <FlynnIcon name="timer-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.eventDuration}>{upcomingJob.estimatedDuration}</Text>
              </View>
            )}
            {(upcomingJob.voicemailTranscript || upcomingJob.voicemailRecordingUrl) && (
              <View style={styles.voicemailPreview}>
                <View style={styles.voicemailPreviewHeader}>
                  <FlynnIcon name="mic-outline" size={16} color={colors.primary} />
                  <Text style={styles.voicemailPreviewTitle}>Voicemail summary</Text>
                </View>
                {upcomingJob.voicemailTranscript ? (
                  <Text style={styles.voicemailPreviewText} numberOfLines={4}>
                    “{upcomingJob.voicemailTranscript.trim()}”
                  </Text>
                ) : (
                  <Text style={styles.voicemailPlaceholder}>Transcript not available yet.</Text>
                )}
                {upcomingJob.voicemailRecordingUrl && (
                  <TouchableOpacity
                    style={styles.voicemailButton}
                    activeOpacity={0.7}
                    onPress={(e) => {
                      e.stopPropagation();
                      handlePlayVoicemail(upcomingJob.voicemailRecordingUrl!);
                    }}
                  >
                    <FlynnIcon name="play-outline" size={16} color={colors.primary} />
                    <Text style={styles.voicemailButtonText}>Listen to voicemail</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            <TouchableOpacity
              style={styles.callClientButton}
              activeOpacity={0.7}
              onPress={(e) => {
                e.stopPropagation();
                handleCallClient(upcomingJob.clientPhone);
              }}
            >
              <FlynnIcon name="call-outline" size={16} color={colors.primary} />
              <Text style={styles.callClientText}>Call {upcomingJob.clientName.split(' ')[0]}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ) : (
          <View style={styles.emptyEventCard}>
            <FlynnIcon name="calendar-outline" size={32} color={colors.gray400} />
            <Text style={styles.emptyEventTitle}>No upcoming events</Text>
            <Text style={styles.emptyEventDescription}>Your next scheduled job will appear here</Text>
          </View>
        )}
      </View>

      {/* Recent Activity Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FlynnIcon name="time-outline" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity 
            style={styles.viewAllButton}
            onPress={() => setShowActivityHistory(true)}
          >
            <Text style={styles.viewAllText}>View All</Text>
            <FlynnIcon name="chevron-forward" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
        {activitiesLoading && recentActivities.length === 0 ? (
          <View style={styles.emptyActivityCard}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.emptyActivityDescription}>Loading recent activity…</Text>
          </View>
        ) : recentActivities.length > 0 ? (
          <View style={styles.activitiesContainer}>
            {recentActivities.map((activity, index) => (
              <TouchableOpacity 
                key={activity.id}
                style={[
                  styles.activityCard,
                  index === recentActivities.length - 1 && { marginBottom: 0 }
                ]} 
                activeOpacity={0.7}
                onPress={() => handleActivityAction(activity)}
              >
                <View style={styles.activityContent}>
                  <View style={[
                    styles.activityTypeIcon,
                    { backgroundColor: colors.primary + '20' }
                  ]}>
                    <FlynnIcon name={activity.icon} size={16} color={colors.primary} />
                  </View>
                  <View style={styles.activityDetails}>
                    <View style={styles.activityHeader}>
                      <Text style={styles.activityTitle}>{activity.title}</Text>
                      <Text style={styles.activityTime}>{formatActivityTime(activity.timestamp)}</Text>
                    </View>
                    <Text style={styles.activityDescription} numberOfLines={2}>
                      {activity.description}
                    </Text>
                  </View>
                  <FlynnIcon name="chevron-forward" size={20} color={colors.textTertiary} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyActivityCard}>
            <FlynnIcon name="time-outline" size={32} color={colors.gray400} />
            <Text style={styles.emptyActivityTitle}>No recent activity</Text>
            <Text style={styles.emptyActivityDescription}>Your business activity will appear here</Text>
          </View>
        )}
      </View>

      </ScrollView>
      
      {/* Floating Action Button */}
      <FloatingActionButton
        onQuickAddJob={() => navigation.navigate('JobFormDemo')}
      />

      {/* Activity History Modal */}
      <ActivityHistoryModal 
        visible={showActivityHistory}
        activities={activities}
        loading={activitiesLoading}
        onClose={() => setShowActivityHistory(false)}
        onRefresh={loadActivities}
        onActivityPress={handleActivityHistoryPress}
        onNavigateToJob={handleNavigateToJobFromActivity}
        onCallClient={handleCallClientFromActivity}
      />

      {/* Activity Details Modal */}
      <ActivityDetailsModal
        visible={activityModalVisible}
        activity={selectedActivity}
        onClose={handleCloseActivityModal}
        onNavigateToJob={handleNavigateToJobFromActivity}
        onCallClient={handleCallClientFromActivity}
      />

      {/* Job Details Modal */}
      <JobDetailsModal
        job={selectedJob}
        visible={jobModalVisible}
        onClose={handleCloseJobModal}
        onSendTextConfirmation={handleSendTextConfirmation}
        onSendEmailConfirmation={handleSendEmailConfirmation}
        onMarkComplete={handleMarkComplete}
        onReschedule={handleReschedule}
        onEditDetails={handleEditDetails}
        onDeleteJob={handleDeleteJob}
        onUpdateJob={handleUpdateJob}
      />
    </>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  welcomeSection: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    marginBottom: spacing.md,
  },
  welcomeText: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginLeft: spacing.xs,
  },
  upcomingEventCard: {
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  eventTime: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
    marginBottom: spacing.xxs,
  },
  eventTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  eventLocation: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginLeft: spacing.xxs,
  },
  callClientButton: {
    backgroundColor: colors.primaryLight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  callClientText: {
    ...typography.label,
    color: colors.primary,
    marginLeft: spacing.xxs,
  },
  activityCard: {
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  voicemailList: {
    gap: spacing.sm,
  },
  activitiesContainer: {
    gap: 0,
  },
  activityContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityDetails: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  activityDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  
  // View All button
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  viewAllText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginRight: spacing.xxs,
  },
  
  // Duration row
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  eventDuration: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginLeft: spacing.xxs,
  },
  
  // Empty states
  emptyEventCard: {
    backgroundColor: colors.card,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
    alignItems: 'center',
  },
  emptyEventTitle: {
    ...typography.h4,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyEventDescription: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  
  emptyActivityCard: {
    backgroundColor: colors.card,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
    alignItems: 'center',
  },
  emptyActivityTitle: {
    ...typography.h4,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyActivityDescription: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  voicemailPreview: {
    backgroundColor: colors.gray50,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  voicemailPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  voicemailPreviewTitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  voicemailPreviewText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  voicemailPlaceholder: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  voicemailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary + '12',
  },
  voicemailButtonText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.primary,
  },
  
  // Activity type row
  activityTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  activityTypeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityTime: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  activityTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
