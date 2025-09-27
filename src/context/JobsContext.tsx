import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { Alert } from 'react-native';
import { Job } from '../components/jobs/JobCard';
import { apiClient } from '../services/apiClient';
import { useAuth } from './AuthContext';

interface JobsContextType {
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  updateJob: (updatedJob: Job) => void;
  deleteJob: (jobId: string) => void;
  markJobComplete: (jobId: string) => void;
  addJob: (job: Job) => void;
  refreshJobs: () => Promise<void>;
  loading: boolean;
}

const JobsContext = createContext<JobsContextType | undefined>(undefined);

export const JobsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  interface JobsApiRecord {
    id: string;
    call_sid?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    summary?: string | null;
    service_type?: string | null;
    status?: 'new' | 'in_progress' | 'completed';
    created_at?: string | null;
  }

  const mapStatus = (status?: JobsApiRecord['status']): Job['status'] => {
    switch (status) {
      case 'completed':
        return 'complete';
      case 'in_progress':
        return 'in-progress';
      default:
        return 'pending';
    }
  };

  const mapJobRecordToJob = (record: JobsApiRecord): Job => {
    const createdAt = record.created_at ? new Date(record.created_at) : new Date();
    const isoString = createdAt.toISOString();
    const [datePart, timePart = '00:00:00'] = isoString.split('T');
    const timeValue = timePart.slice(0, 5);

    return {
      id: record.id,
      clientName: record.customer_name || 'Client',
      clientPhone: record.customer_phone || '',
      serviceType: record.service_type || 'General Service',
      description: record.summary || 'Job details unavailable',
      date: datePart,
      time: timeValue,
      location: 'To be determined',
      status: mapStatus(record.status),
      businessType: 'general',
      notes: undefined,
      estimatedDuration: undefined,
      createdAt: createdAt.toISOString(),
      source: record.call_sid ? 'voicemail' : 'manual',
      voicemailTranscript: undefined,
      voicemailRecordingUrl: undefined,
      followUpDraft: undefined,
      capturedAt: createdAt.toISOString(),
      lastFollowUpAt: undefined,
    };
  };

  const refreshJobs = useCallback(async () => {
    if (!user?.id) {
      if (isMountedRef.current) {
        setJobs([]);
      }
      return;
    }

    if (isMountedRef.current) {
      setLoading(true);
    }

    try {
      const response = await apiClient.get<{ jobs: JobsApiRecord[] }>('/jobs');
      const hydratedJobs = Array.isArray(response?.jobs)
        ? response.jobs.map(mapJobRecordToJob)
        : [];

      if (isMountedRef.current) {
        setJobs(hydratedJobs);
      }
    } catch (error) {
      console.error('[JobsContext] Failed to load jobs:', error);
      if (isMountedRef.current) {
        Alert.alert(
          'Unable to load jobs',
          'We could not refresh your jobs from the server. Please try again.'
        );
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    void refreshJobs();
  }, [refreshJobs]);

  const updateJob = (updatedJob: Job) => {
    setJobs(prevJobs =>
      prevJobs.map(job =>
        job.id === updatedJob.id ? updatedJob : job
      )
    );
  };

  const deleteJob = (jobId: string) => {
    setJobs(prevJobs => prevJobs.filter(job => job.id !== jobId));
  };

  const markJobComplete = (jobId: string) => {
    setJobs(prevJobs =>
      prevJobs.map(job =>
        job.id === jobId ? { ...job, status: 'complete' as const } : job
      )
    );
  };

  const addJob = (job: Job) => {
    setJobs(prevJobs => [...prevJobs, job]);
  };

  return (
    <JobsContext.Provider value={{
      jobs,
      setJobs,
      updateJob,
      deleteJob,
      markJobComplete,
      addJob,
      refreshJobs,
      loading,
    }}>
      {children}
    </JobsContext.Provider>
  );
};

export const useJobs = () => {
  const context = useContext(JobsContext);
  if (!context) {
    throw new Error('useJobs must be used within a JobsProvider');
  }
  return context;
};
