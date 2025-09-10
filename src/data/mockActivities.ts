export interface Activity {
  id: string;
  type: 'screenshot_processed' | 'call_recorded' | 'job_created' | 'job_completed' | 'communication_sent' | 'calendar_synced' | 'invoice_sent' | 'status_changed';
  title: string;
  description: string;
  timestamp: string;
  icon: string;
  metadata?: {
    clientName?: string;
    clientPhone?: string;
    jobId?: string;
    amount?: number;
    platform?: string;
    thumbnailUrl?: string;
    oldStatus?: string;
    newStatus?: string;
  };
}

export const mockActivities: Activity[] = [
  {
    id: 'act_1',
    type: 'screenshot_processed',
    title: 'Screenshot processed',
    description: 'WhatsApp conversation with Mike about kitchen repair',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 minutes ago
    icon: 'image-outline',
    metadata: {
      clientName: 'Mike',
      platform: 'WhatsApp',
      thumbnailUrl: 'whatsapp_screenshot_1',
    },
  },
  {
    id: 'act_2',
    type: 'call_recorded',
    title: 'Call recorded and transcribed',
    description: 'Sarah called about kitchen repair quote - "Can you come Friday at 9 AM?"',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    icon: 'call-outline',
    metadata: {
      clientName: 'Sarah Johnson',
      clientPhone: '+1 (555) 123-4567',
    },
  },
  {
    id: 'act_3',
    type: 'job_completed',
    title: 'Job completed',
    description: 'Bathroom renovation for Johnson family - marked as complete',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    icon: 'checkmark-circle-outline',
    metadata: {
      clientName: 'Johnson family',
      jobId: '5',
    },
  },
  {
    id: 'act_4',
    type: 'invoice_sent',
    title: 'Invoice sent via QuickBooks',
    description: '$450 plumbing repair invoice sent to Robert Thompson',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
    icon: 'receipt-outline',
    metadata: {
      clientName: 'Robert Thompson',
      amount: 450,
      platform: 'QuickBooks',
      jobId: '5',
    },
  },
  {
    id: 'act_5',
    type: 'calendar_synced',
    title: 'Calendar event synced',
    description: "Tomorrow's appointment with David Martinez added to Google Calendar",
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago
    icon: 'calendar-outline',
    metadata: {
      clientName: 'David Martinez',
      platform: 'Google Calendar',
      jobId: '3',
    },
  },
  {
    id: 'act_6',
    type: 'communication_sent',
    title: 'Confirmation text sent',
    description: 'Appointment reminder sent to Emily Rodriguez',
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
    icon: 'chatbubble-outline',
    metadata: {
      clientName: 'Emily Rodriguez',
      platform: 'SMS',
      jobId: '4',
    },
  },
  {
    id: 'act_7',
    type: 'job_created',
    title: 'New job created',
    description: 'Marketing consultation for Emily Rodriguez scheduled',
    timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(), // 18 hours ago
    icon: 'add-circle-outline',
    metadata: {
      clientName: 'Emily Rodriguez',
      jobId: '4',
    },
  },
  {
    id: 'act_8',
    type: 'screenshot_processed',
    title: 'Screenshot processed',
    description: 'Text message from Amanda about website redesign pricing',
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    icon: 'image-outline',
    metadata: {
      clientName: 'Amanda Foster',
      platform: 'SMS',
      thumbnailUrl: 'sms_screenshot_1',
    },
  },
  {
    id: 'act_9',
    type: 'status_changed',
    title: 'Job status updated',
    description: 'Michael Chen color & cut changed from pending to in-progress',
    timestamp: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000).toISOString(), // 1.5 days ago
    icon: 'refresh-outline',
    metadata: {
      clientName: 'Michael Chen',
      jobId: '2',
      oldStatus: 'pending',
      newStatus: 'in-progress',
    },
  },
  {
    id: 'act_10',
    type: 'call_recorded',
    title: 'Call recorded and transcribed',
    description: 'James Wilson called about brake service - scheduled for next week',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    icon: 'call-outline',
    metadata: {
      clientName: 'James Wilson',
      clientPhone: '+1 (555) 789-0123',
      jobId: '7',
    },
  },
  {
    id: 'act_11',
    type: 'job_created',
    title: 'Job created from screenshot',
    description: 'Brake service for James Wilson auto-created from WhatsApp screenshot',
    timestamp: new Date(Date.now() - 2.2 * 24 * 60 * 60 * 1000).toISOString(), // 2.2 days ago
    icon: 'camera-outline',
    metadata: {
      clientName: 'James Wilson',
      jobId: '7',
      platform: 'WhatsApp',
    },
  },
  {
    id: 'act_12',
    type: 'job_completed',
    title: 'Job completed',
    description: 'Manicure & pedicure for Lisa Park completed successfully',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    icon: 'checkmark-circle-outline',
    metadata: {
      clientName: 'Lisa Park',
      jobId: '6',
    },
  },
  {
    id: 'act_13',
    type: 'invoice_sent',
    title: 'Invoice sent via MYOB',
    description: '$85 manicure & pedicure invoice sent to Lisa Park',
    timestamp: new Date(Date.now() - 3.5 * 24 * 60 * 60 * 1000).toISOString(), // 3.5 days ago
    icon: 'receipt-outline',
    metadata: {
      clientName: 'Lisa Park',
      amount: 85,
      platform: 'MYOB',
      jobId: '6',
    },
  },
  {
    id: 'act_14',
    type: 'communication_sent',
    title: 'Follow-up email sent',
    description: 'Thank you email sent to Lisa Park after service completion',
    timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago
    icon: 'mail-outline',
    metadata: {
      clientName: 'Lisa Park',
      platform: 'Email',
      jobId: '6',
    },
  },
  {
    id: 'act_15',
    type: 'calendar_synced',
    title: 'Calendar updated',
    description: 'Website redesign consultation with Amanda Foster added to Outlook',
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    icon: 'calendar-outline',
    metadata: {
      clientName: 'Amanda Foster',
      platform: 'Outlook',
      jobId: '8',
    },
  },
];

// Helper functions for activity data
export const getRecentActivity = (): Activity | null => {
  if (mockActivities.length === 0) return null;
  return mockActivities[0]; // Most recent activity
};

export const getActivitiesByType = (type: Activity['type']): Activity[] => {
  return mockActivities.filter(activity => activity.type === type);
};

export const getActivitiesInDateRange = (startDate: Date, endDate: Date): Activity[] => {
  return mockActivities.filter(activity => {
    const activityDate = new Date(activity.timestamp);
    return activityDate >= startDate && activityDate <= endDate;
  });
};

export const formatActivityTime = (timestamp: string): string => {
  const now = new Date();
  const activityDate = new Date(timestamp);
  const diffMs = now.getTime() - activityDate.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return activityDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  }
};