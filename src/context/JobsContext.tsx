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
import { jobsService } from '../services/jobsService';
import { useAuth } from './AuthContext';

interface JobsContextType {
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  updateJob: (updatedJob: Job) => void;
  deleteJob: (jobId: string) => Promise<void>;
  markJobComplete: (jobId: string) => Promise<void>;
  addJob: (job: Job) => void;
  refreshJobs: () => Promise<void>;
  loading: boolean;
  saveJobEdits: (job: Job) => Promise<void>;
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
      const hydratedJobs = await jobsService.listJobs(user.id);

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

  const deleteJob = async (jobId: string) => {
    const prevJobs = jobs;
    setJobs(prevJobs => prevJobs.filter(job => job.id !== jobId));
    try {
      await jobsService.deleteJob(jobId);
    } catch (error) {
      console.error('[JobsContext] Failed to delete job', error);
      setJobs(prevJobs);
      throw error;
    }
  };

  const markJobComplete = async (jobId: string) => {
    const prevJobs = jobs;
    setJobs(prevJobs =>
      prevJobs.map(job =>
        job.id === jobId ? { ...job, status: 'complete' as const } : job
      )
    );
    try {
      await jobsService.updateStatus(jobId, 'complete');
    } catch (error) {
      console.error('[JobsContext] Failed to mark job complete', error);
      setJobs(prevJobs);
      throw error;
    }
  };

  const addJob = (job: Job) => {
    setJobs(prevJobs => [...prevJobs, job]);
  };

  const saveJobEdits = async (updatedJob: Job) => {
    const prevJobs = jobs;
    setJobs(prev => prev.map(job => (job.id === updatedJob.id ? updatedJob : job)));

    const original = prevJobs.find(job => job.id === updatedJob.id);
    const payload: Record<string, string | undefined> = {};

    if (!original || original.serviceType !== updatedJob.serviceType) {
      payload.serviceType = updatedJob.serviceType;
    }
    if (!original || original.description !== updatedJob.description) {
      payload.description = updatedJob.description;
    }
    if (!original || original.date !== updatedJob.date) {
      payload.scheduledDate = updatedJob.date;
    }
    if (!original || original.time !== updatedJob.time) {
      payload.scheduledTime = updatedJob.time;
    }
    if (!original || original.location !== updatedJob.location) {
      payload.location = updatedJob.location;
    }
    if (!original || original.notes !== updatedJob.notes) {
      payload.notes = updatedJob.notes;
    }

    try {
      await jobsService.updateJob(updatedJob.id, payload);
    } catch (error) {
      console.error('[JobsContext] Failed to save job edits', error);
      setJobs(prevJobs);
      throw error;
    }
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
      saveJobEdits,
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
