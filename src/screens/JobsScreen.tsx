import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  SafeAreaView,
} from 'react-native';
import { spacing } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { JobCard, Job } from '../components/jobs/JobCard';
import { JobFilterBar, FilterType } from '../components/jobs/JobFilterBar';
import { JobDetailsModal } from '../components/jobs/JobDetailsModal';
import { CommunicationModal } from '../components/jobs/CommunicationModal';
import { EmptyState } from '../components/jobs/EmptyState';
import { mockJobs } from '../data/mockJobs';
import { useNavigation } from '@react-navigation/native';

export const JobsScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const styles = createStyles(colors);
  
  // State management
  const [jobs, setJobs] = useState<Job[]>(mockJobs);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [showCommunication, setShowCommunication] = useState(false);
  const [communicationType, setCommunicationType] = useState<'text' | 'email'>('text');
  const [refreshing, setRefreshing] = useState(false);

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

  const handleSendMessage = async (job: Job, message: string, type: 'text' | 'email') => {
    // Simulate API call
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) { // 90% success rate
          resolve();
        } else {
          reject(new Error('Failed to send message'));
        }
      }, 1500);
    });
  };

  const handleMarkComplete = (job: Job) => {
    setJobs(prevJobs =>
      prevJobs.map(j =>
        j.id === job.id ? { ...j, status: 'complete' as const } : j
      )
    );
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
    // Update the job in the jobs array
    setJobs(prevJobs => 
      prevJobs.map(job => 
        job.id === updatedJob.id ? updatedJob : job
      )
    );
    console.log('Updated job:', updatedJob);
  };

  const handleDeleteJob = (job: Job) => {
    setJobs(prevJobs => prevJobs.filter(j => j.id !== job.id));
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
  
  listContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
});