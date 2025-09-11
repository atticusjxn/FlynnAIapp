import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Job } from '../components/jobs/JobCard';
import { mockJobs } from '../data/mockJobs';
import { Alert } from 'react-native';

interface JobsContextType {
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  updateJob: (updatedJob: Job) => void;
  deleteJob: (jobId: string) => void;
  markJobComplete: (jobId: string) => void;
  addJob: (job: Job) => void;
}

const JobsContext = createContext<JobsContextType | undefined>(undefined);

export const JobsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<Job[]>(mockJobs);

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