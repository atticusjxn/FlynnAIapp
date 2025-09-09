import { Job } from '../components/jobs/JobCard';

export const mockJobs: Job[] = [
  {
    id: '1',
    clientName: 'Sarah Johnson',
    clientPhone: '+1 (555) 123-4567',
    clientEmail: 'sarah.johnson@email.com',
    serviceType: 'Plumbing',
    description: 'Kitchen sink is leaking and needs immediate repair. Water is pooling under the cabinet.',
    date: new Date().toISOString().split('T')[0], // Today
    time: '14:30',
    location: '123 Oak Street, Springfield, IL 62701',
    status: 'pending',
    businessType: 'home_property',
    estimatedDuration: '2 hours',
    notes: 'Client mentioned the leak started yesterday evening. Bring extra pipe fittings.',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
  },
  {
    id: '2',
    clientName: 'Michael Chen',
    clientPhone: '+1 (555) 234-5678',
    clientEmail: 'mchen@techcorp.com',
    serviceType: 'Color & Cut',
    description: 'Full color treatment with highlights and a modern cut. Client wants to go from brown to blonde.',
    date: new Date().toISOString().split('T')[0], // Today
    time: '10:00',
    location: 'Flynn Beauty Studio, 456 Maple Ave, Springfield, IL 62702',
    status: 'in-progress',
    businessType: 'personal_beauty',
    estimatedDuration: '3 hours',
    notes: 'Regular client. Allergic to ammonia-based products. Use gentle formula.',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
  },
  {
    id: '3',
    clientName: 'David Martinez',
    clientPhone: '+1 (555) 345-6789',
    serviceType: 'Oil Change & Inspection',
    description: '2019 Honda Accord needs oil change and general inspection. 45,000 miles.',
    date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
    time: '09:00',
    location: 'Martinez Auto Shop, 789 Pine St, Springfield, IL 62703',
    status: 'pending',
    businessType: 'automotive',
    estimatedDuration: '1 hour',
    createdAt: new Date().toISOString(),
  },
  {
    id: '4',
    clientName: 'Emily Rodriguez',
    clientPhone: '+1 (555) 456-7890',
    clientEmail: 'emily.rodriguez@startup.com',
    serviceType: 'Marketing Consultation',
    description: 'Strategic marketing consultation for new product launch. Need help with digital marketing strategy.',
    date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Day after tomorrow
    time: '15:00',
    location: 'Virtual Meeting (Zoom)',
    status: 'pending',
    businessType: 'business_professional',
    estimatedDuration: '1.5 hours',
    notes: 'Client is launching a new mobile app. Focus on social media and influencer marketing.',
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
  },
  {
    id: '5',
    clientName: 'Robert Thompson',
    clientPhone: '+1 (555) 567-8901',
    clientEmail: 'rthompson@gmail.com',
    serviceType: 'Electrical Repair',
    description: 'Multiple outlets in living room not working. Possibly a circuit breaker issue.',
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Yesterday
    time: '11:30',
    location: '321 Elm Drive, Springfield, IL 62704',
    status: 'complete',
    businessType: 'home_property',
    estimatedDuration: '1.5 hours',
    notes: 'Job completed successfully. Replaced faulty GFCI outlet and reset circuit breaker.',
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago
  },
  {
    id: '6',
    clientName: 'Lisa Park',
    clientPhone: '+1 (555) 678-9012',
    clientEmail: 'lisa.park@design.co',
    serviceType: 'Manicure & Pedicure',
    description: 'Full spa manicure and pedicure with gel polish. Client prefers neutral colors.',
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days ago
    time: '13:00',
    location: 'Flynn Beauty Studio, 456 Maple Ave, Springfield, IL 62702',
    status: 'complete',
    businessType: 'personal_beauty',
    estimatedDuration: '1.5 hours',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
  },
  {
    id: '7',
    clientName: 'James Wilson',
    clientPhone: '+1 (555) 789-0123',
    serviceType: 'Brake Service',
    description: 'Brake pads making squealing noise. Needs inspection and possible replacement.',
    date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days from now
    time: '16:00',
    location: 'Wilson Auto Center, 654 Cedar Blvd, Springfield, IL 62705',
    status: 'pending',
    businessType: 'automotive',
    estimatedDuration: '2 hours',
    notes: '2018 Toyota Camry. Client heard squealing for past week.',
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
  },
  {
    id: '8',
    clientName: 'Amanda Foster',
    clientPhone: '+1 (555) 890-1234',
    clientEmail: 'amanda.foster@lawfirm.com',
    serviceType: 'Website Redesign',
    description: 'Complete website redesign for law firm. Modern, professional look with client portal integration.',
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Next week
    time: '10:30',
    location: 'Foster & Associates, 987 Business Plaza, Springfield, IL 62706',
    status: 'pending',
    businessType: 'business_professional',
    estimatedDuration: '4 hours',
    notes: 'Initial consultation meeting. Bring portfolio and pricing sheets.',
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
  },
];