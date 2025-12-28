import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types
export interface BookingPage {
  id: string;
  org_id: string;
  slug: string;
  business_name: string;
  business_logo_url?: string;
  primary_color: string;
  business_hours: BusinessHours;
  slot_duration_minutes: number;
  buffer_time_minutes: number;
  booking_notice_hours: number;
  max_days_advance: number;
  timezone: string;
  custom_fields?: CustomField[];
  is_active: boolean;
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
  start: string;
  end: string;
}

export interface CustomField {
  label: string;
  type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox';
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface BookingSlot {
  start_time: string;
  end_time: string;
  is_available: boolean;
}
