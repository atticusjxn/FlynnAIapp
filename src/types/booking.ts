// Booking System Types
// Custom booking pages for Flynn AI

export interface BookingPage {
  id: string;
  org_id: string;

  // URL and branding
  slug: string; // e.g., "joes-plumbing" for flynnbooking.com/joes-plumbing
  business_name: string;
  business_logo_url?: string;
  primary_color: string;

  // Booking settings
  business_hours: BusinessHours;

  // Time slot configuration
  slot_duration_minutes: number; // Default 60 minutes
  buffer_time_minutes: number; // Buffer between appointments
  booking_notice_hours: number; // Minimum advance notice required
  max_days_advance: number; // How far ahead customers can book

  // Availability
  timezone: string;
  google_calendar_id?: string;

  // Booking form customization
  enabled_services?: string[];
  custom_questions?: CustomQuestion[];

  // Status
  is_active: boolean;

  // Metadata
  created_at: string;
  updated_at: string;
}

export interface BusinessHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface DaySchedule {
  enabled: boolean;
  start: string; // "09:00"
  end: string; // "17:00"
}

export interface CustomQuestion {
  label: string;
  type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox';
  required: boolean;
  options?: string[]; // For select, radio, checkbox
}

export interface Booking {
  id: string;
  booking_page_id: string;
  org_id: string;

  // Customer information
  customer_name: string;
  customer_phone: string;
  customer_email?: string;

  // Booking details
  service_type?: string;
  requested_datetime: string; // ISO timestamp
  duration_minutes: number;
  notes?: string;
  custom_responses?: Record<string, string>;

  // Status tracking
  status: BookingStatus;
  confirmation_sent_at?: string;
  reminder_sent_at?: string;

  // Links to Flynn entities
  client_id?: string;
  event_id?: string;
  job_id?: string;

  // Google Calendar integration
  google_event_id?: string;

  // Metadata
  created_at: string;
  updated_at: string;
  cancelled_at?: string;
  cancellation_reason?: string;
}

export type BookingStatus =
  | 'pending'    // New booking, awaiting confirmation
  | 'confirmed'  // Approved by business
  | 'cancelled'  // Cancelled by customer or business
  | 'completed'  // Service completed
  | 'no_show';   // Customer didn't show up

export interface BookingSlotCache {
  id: string;
  booking_page_id: string;

  // Slot details
  slot_datetime: string; // ISO timestamp
  duration_minutes: number;
  is_available: boolean;

  // Cache metadata
  cached_at: string;
  expires_at: string;
}

// Create Booking Request (from customer-facing form)
export interface CreateBookingRequest {
  booking_page_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  service_type?: string;
  requested_datetime: string;
  duration_minutes: number;
  notes?: string;
  custom_responses?: Record<string, string>;
}

// Create Booking Page Request
export interface CreateBookingPageRequest {
  org_id: string;
  slug: string;
  business_name: string;
  business_logo_url?: string;
  primary_color?: string;
  business_hours?: BusinessHours;
  slot_duration_minutes?: number;
  buffer_time_minutes?: number;
  booking_notice_hours?: number;
  max_days_advance?: number;
  timezone?: string;
  google_calendar_id?: string;
  enabled_services?: string[];
  custom_questions?: CustomQuestion[];
}

// Update Booking Page Request
export type UpdateBookingPageRequest = Partial<Omit<CreateBookingPageRequest, 'org_id'>>;

// Available Time Slot (for customer-facing booking calendar)
export interface AvailableTimeSlot {
  datetime: string; // ISO timestamp
  duration_minutes: number;
  is_available: boolean;
}

// Booking with related data (for admin views)
export interface BookingWithDetails extends Booking {
  booking_page?: BookingPage;
  client?: any; // Import from clients types if needed
  event?: any; // Import from calendar types if needed
}
