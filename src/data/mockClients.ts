export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address: string;
  businessType: string;
  totalJobs: number;
  lastJobDate: string;
  lastJobType: string;
  jobHistory: ClientJob[];
  communicationLog: CommunicationEntry[];
  notes?: string;
  preferredContactMethod: 'phone' | 'text' | 'email';
  createdAt: string;
}

export interface ClientJob {
  id: string;
  date: string;
  serviceType: string;
  description: string;
  status: 'completed' | 'cancelled';
  amount?: number;
}

export interface CommunicationEntry {
  id: string;
  type: 'call' | 'text' | 'email';
  date: string;
  direction: 'outgoing' | 'incoming';
  content?: string;
  success: boolean;
}

export const mockClients: Client[] = [
  {
    id: '1',
    name: 'Sarah Johnson',
    phone: '+1 (555) 234-5678',
    email: 'sarah.johnson@email.com',
    address: '123 Oak Street, Springfield, IL',
    businessType: 'home_property',
    totalJobs: 8,
    lastJobDate: '2025-01-05',
    lastJobType: 'Plumbing Repair',
    preferredContactMethod: 'text',
    createdAt: '2024-03-15',
    notes: 'Prefers afternoon appointments. Has 2 dogs - friendly but excitable.',
    jobHistory: [
      {
        id: 'j1',
        date: '2025-01-05',
        serviceType: 'Plumbing Repair',
        description: 'Fixed kitchen sink leak',
        status: 'completed',
        amount: 180
      },
      {
        id: 'j2',
        date: '2024-12-10',
        serviceType: 'HVAC Maintenance',
        description: 'Annual furnace tune-up',
        status: 'completed',
        amount: 150
      },
      {
        id: 'j3',
        date: '2024-11-02',
        serviceType: 'Electrical',
        description: 'Installed new outlet in garage',
        status: 'completed',
        amount: 220
      }
    ],
    communicationLog: [
      {
        id: 'c1',
        type: 'text',
        date: '2025-01-05T14:30:00',
        direction: 'outgoing',
        content: 'Hi Sarah! Just finished the plumbing repair. Everything is working perfectly now.',
        success: true
      },
      {
        id: 'c2',
        type: 'call',
        date: '2025-01-05T08:15:00',
        direction: 'outgoing',
        content: 'Confirmed appointment time',
        success: true
      }
    ]
  },
  {
    id: '2',
    name: 'Michael Chen',
    phone: '+1 (555) 345-6789',
    email: 'mchen@techcorp.com',
    address: '456 Pine Avenue, Downtown, CA',
    businessType: 'personal_beauty',
    totalJobs: 12,
    lastJobDate: '2024-12-28',
    lastJobType: 'Color & Cut',
    preferredContactMethod: 'email',
    createdAt: '2024-01-20',
    notes: 'Regular client - books monthly appointments. Allergic to certain hair products.',
    jobHistory: [
      {
        id: 'j4',
        date: '2024-12-28',
        serviceType: 'Color & Cut',
        description: 'Full color treatment with highlights and modern cut',
        status: 'completed',
        amount: 180
      },
      {
        id: 'j5',
        date: '2024-11-30',
        serviceType: 'Cut & Style',
        description: 'Trim and style for corporate event',
        status: 'completed',
        amount: 85
      }
    ],
    communicationLog: [
      {
        id: 'c3',
        type: 'email',
        date: '2024-12-27T16:00:00',
        direction: 'outgoing',
        content: 'Appointment reminder for tomorrow at 10:00 AM',
        success: true
      }
    ]
  },
  {
    id: '3',
    name: 'Jennifer Rodriguez',
    phone: '+1 (555) 456-7890',
    email: 'jen.rodriguez@gmail.com',
    address: '789 Maple Drive, Suburban Heights, TX',
    businessType: 'home_property',
    totalJobs: 3,
    lastJobDate: '2024-12-15',
    lastJobType: 'House Cleaning',
    preferredContactMethod: 'phone',
    createdAt: '2024-09-10',
    notes: 'New client. Very particular about eco-friendly cleaning products.',
    jobHistory: [
      {
        id: 'j6',
        date: '2024-12-15',
        serviceType: 'House Cleaning',
        description: 'Deep clean before holiday party',
        status: 'completed',
        amount: 280
      },
      {
        id: 'j7',
        date: '2024-11-01',
        serviceType: 'House Cleaning',
        description: 'Regular monthly cleaning',
        status: 'completed',
        amount: 180
      }
    ],
    communicationLog: [
      {
        id: 'c4',
        type: 'call',
        date: '2024-12-14T10:30:00',
        direction: 'incoming',
        content: 'Client called to confirm appointment',
        success: true
      }
    ]
  },
  {
    id: '4',
    name: 'David Thompson',
    phone: '+1 (555) 567-8901',
    email: 'dthompson@autorepair.com',
    address: '321 Industrial Blvd, Manufacturing District, OH',
    businessType: 'automotive',
    totalJobs: 15,
    lastJobDate: '2025-01-08',
    lastJobType: 'Engine Diagnostics',
    preferredContactMethod: 'text',
    createdAt: '2023-08-05',
    notes: 'Fleet manager - handles multiple vehicles. Prefers bulk scheduling.',
    jobHistory: [
      {
        id: 'j8',
        date: '2025-01-08',
        serviceType: 'Engine Diagnostics',
        description: 'Diagnostic scan on company van',
        status: 'completed',
        amount: 120
      },
      {
        id: 'j9',
        date: '2024-12-20',
        serviceType: 'Oil Change',
        description: 'Oil change for 3 vehicles',
        status: 'completed',
        amount: 150
      }
    ],
    communicationLog: [
      {
        id: 'c5',
        type: 'text',
        date: '2025-01-08T15:45:00',
        direction: 'outgoing',
        content: 'Diagnostics complete. Found minor issue with air filter. Replaced and ready for pickup.',
        success: true
      }
    ]
  },
  {
    id: '5',
    name: 'Lisa Park',
    phone: '+1 (555) 678-9012',
    email: 'lisa@creativeagency.com',
    address: '654 Creative Lane, Arts District, NY',
    businessType: 'business_professional',
    totalJobs: 6,
    lastJobDate: '2024-12-22',
    lastJobType: 'Brand Consultation',
    preferredContactMethod: 'email',
    createdAt: '2024-05-12',
    notes: 'Creative director. Often needs quick turnaround projects.',
    jobHistory: [
      {
        id: 'j10',
        date: '2024-12-22',
        serviceType: 'Brand Consultation',
        description: 'Brand strategy session for new product launch',
        status: 'completed',
        amount: 450
      },
      {
        id: 'j11',
        date: '2024-10-15',
        serviceType: 'Design Workshop',
        description: 'Team design thinking workshop',
        status: 'completed',
        amount: 600
      }
    ],
    communicationLog: [
      {
        id: 'c6',
        type: 'email',
        date: '2024-12-22T17:30:00',
        direction: 'outgoing',
        content: 'Thank you for the productive session! Sending strategy document within 24 hours.',
        success: true
      }
    ]
  },
  {
    id: '6',
    name: 'Robert Williams',
    phone: '+1 (555) 789-0123',
    address: '987 Elm Street, Riverside, FL',
    businessType: 'moving_delivery',
    totalJobs: 2,
    lastJobDate: '2024-11-30',
    lastJobType: 'Residential Move',
    preferredContactMethod: 'phone',
    createdAt: '2024-11-15',
    notes: 'Recent move to area. Mentioned needing help with unpacking services.',
    jobHistory: [
      {
        id: 'j12',
        date: '2024-11-30',
        serviceType: 'Residential Move',
        description: 'Full house move from apartment to new home',
        status: 'completed',
        amount: 850
      }
    ],
    communicationLog: [
      {
        id: 'c7',
        type: 'call',
        date: '2024-11-29T19:00:00',
        direction: 'outgoing',
        content: 'Confirmed move details and timing',
        success: true
      }
    ]
  },
  {
    id: '7',
    name: 'Amanda Foster',
    phone: '+1 (555) 890-1234',
    email: 'amanda.foster@wellness.com',
    address: '147 Wellness Way, Health District, CO',
    businessType: 'personal_beauty',
    totalJobs: 9,
    lastJobDate: '2025-01-03',
    lastJobType: 'Massage Therapy',
    preferredContactMethod: 'text',
    createdAt: '2024-02-28',
    notes: 'Wellness coach. Books regular sessions for stress relief. Prefers early morning appointments.',
    jobHistory: [
      {
        id: 'j13',
        date: '2025-01-03',
        serviceType: 'Massage Therapy',
        description: 'Deep tissue massage for tension relief',
        status: 'completed',
        amount: 120
      },
      {
        id: 'j14',
        date: '2024-12-06',
        serviceType: 'Facial Treatment',
        description: 'Hydrating facial with LED therapy',
        status: 'completed',
        amount: 95
      }
    ],
    communicationLog: [
      {
        id: 'c8',
        type: 'text',
        date: '2025-01-02T20:00:00',
        direction: 'outgoing',
        content: 'Reminder: Your massage appointment is tomorrow at 7:00 AM. See you then!',
        success: true
      }
    ]
  },
  {
    id: '8',
    name: 'Carlos Martinez',
    phone: '+1 (555) 901-2345',
    email: 'carlos@restaurant.com',
    address: '258 Culinary Street, Food District, AZ',
    businessType: 'home_property',
    totalJobs: 11,
    lastJobDate: '2024-12-18',
    lastJobType: 'Commercial HVAC',
    preferredContactMethod: 'phone',
    createdAt: '2023-11-08',
    notes: 'Restaurant owner. Emergency repairs needed quickly. Available 24/7.',
    jobHistory: [
      {
        id: 'j15',
        date: '2024-12-18',
        serviceType: 'Commercial HVAC',
        description: 'Emergency repair of restaurant AC unit',
        status: 'completed',
        amount: 380
      },
      {
        id: 'j16',
        date: '2024-11-25',
        serviceType: 'Plumbing',
        description: 'Fixed dishwasher drain issue',
        status: 'completed',
        amount: 200
      }
    ],
    communicationLog: [
      {
        id: 'c9',
        type: 'call',
        date: '2024-12-18T21:30:00',
        direction: 'incoming',
        content: 'Emergency call - AC unit down during dinner rush',
        success: true
      }
    ]
  },
  {
    id: '9',
    name: 'Nicole Davis',
    phone: '+1 (555) 012-3456',
    email: 'nicole.davis@startup.com',
    address: '369 Innovation Drive, Tech Park, WA',
    businessType: 'business_professional',
    totalJobs: 4,
    lastJobDate: '2024-12-12',
    lastJobType: 'IT Consulting',
    preferredContactMethod: 'email',
    createdAt: '2024-07-22',
    notes: 'Startup founder. Needs flexible scheduling around investor meetings.',
    jobHistory: [
      {
        id: 'j17',
        date: '2024-12-12',
        serviceType: 'IT Consulting',
        description: 'Network security assessment',
        status: 'completed',
        amount: 550
      },
      {
        id: 'j18',
        date: '2024-09-30',
        serviceType: 'System Setup',
        description: 'Office network installation',
        status: 'completed',
        amount: 750
      }
    ],
    communicationLog: [
      {
        id: 'c10',
        type: 'email',
        date: '2024-12-12T16:45:00',
        direction: 'outgoing',
        content: 'Security assessment complete. Sending detailed report with recommendations.',
        success: true
      }
    ]
  },
  {
    id: '10',
    name: 'James Wilson',
    phone: '+1 (555) 123-4567',
    email: 'jwilson@construction.com',
    address: '741 Builder Road, Construction Zone, NV',
    businessType: 'home_property',
    totalJobs: 1,
    lastJobDate: '2024-12-05',
    lastJobType: 'Electrical Inspection',
    preferredContactMethod: 'text',
    createdAt: '2024-12-01',
    notes: 'New client referral from Sarah Johnson. Contractor building custom homes.',
    jobHistory: [
      {
        id: 'j19',
        date: '2024-12-05',
        serviceType: 'Electrical Inspection',
        description: 'Pre-construction electrical assessment',
        status: 'completed',
        amount: 300
      }
    ],
    communicationLog: [
      {
        id: 'c11',
        type: 'text',
        date: '2024-12-05T11:15:00',
        direction: 'outgoing',
        content: 'Inspection complete. All electrical plans meet code requirements. Report sent via email.',
        success: true
      }
    ]
  }
];