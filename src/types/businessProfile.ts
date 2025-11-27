/**
 * Business Profile Types
 *
 * Business context that the AI receptionist uses to provide
 * personalized, business-specific responses during calls.
 */

export interface BusinessHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

export interface DayHours {
  open: string | null; // "09:00" format
  close: string | null; // "17:00" format
  closed: boolean;
}

export interface BusinessService {
  name: string;
  description?: string;
  price_range?: string; // e.g., "$50-$100"
  duration?: string; // e.g., "1-2 hours"
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface BusinessProfile {
  id: string;
  org_id: string;

  // Basic info
  business_name?: string;
  business_type?: string;
  website_url?: string;
  phone?: string;
  email?: string;

  // Location
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  service_area?: string;

  // Hours
  business_hours: BusinessHours;

  // Services (JSONB array)
  services: BusinessService[];

  // Pricing
  pricing_notes?: string;
  payment_methods?: string[];

  // Policies
  cancellation_policy?: string;
  payment_terms?: string;
  booking_notice?: string;

  // FAQs (JSONB array)
  faqs: FAQ[];

  // AI Instructions
  ai_instructions?: string;
  greeting_template?: string;

  // Website scraping
  website_scraped_at?: string;
  website_scrape_data?: Record<string, unknown>;
  auto_update_from_website: boolean;

  // Metadata
  created_at: string;
  updated_at: string;
}

export interface BusinessServiceDetailed {
  id: string;
  profile_id: string;

  name: string;
  description?: string;
  category?: string;

  // Pricing
  price_type: 'fixed' | 'hourly' | 'range' | 'quote';
  price_min?: number;
  price_max?: number;
  price_unit?: string;

  // Availability
  available: boolean;
  typical_duration_minutes?: number;

  // Keywords
  keywords?: string[];

  created_at: string;
  updated_at: string;
}

export interface BusinessHoursException {
  id: string;
  profile_id: string;

  date: string; // ISO date
  reason?: string;
  closed: boolean;

  open_time?: string;
  close_time?: string;

  created_at: string;
}

// Helper types for form inputs
export interface BusinessProfileInput {
  business_name?: string;
  business_type?: string;
  website_url?: string;
  phone?: string;
  email?: string;

  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  service_area?: string;

  business_hours?: BusinessHours;
  services?: BusinessService[];

  pricing_notes?: string;
  payment_methods?: string[];

  cancellation_policy?: string;
  payment_terms?: string;
  booking_notice?: string;

  faqs?: FAQ[];

  ai_instructions?: string;
  greeting_template?: string;

  auto_update_from_website?: boolean;
}

export interface WebsiteScrapeResult {
  success: boolean;
  url: string;
  scraped_at: string;
  data: {
    services?: BusinessService[];
    business_hours?: BusinessHours;
    pricing_notes?: string;
    contact_info?: {
      phone?: string;
      email?: string;
      address?: string;
    };
    about?: string;
    policies?: {
      cancellation?: string;
      payment?: string;
    };
  };
  error?: string;
}

// AI Context format - what gets passed to OpenAI
export interface AIBusinessContext {
  business_name: string;
  business_type: string;
  services: string[]; // Simple list of service names
  pricing_summary: string;
  hours_summary: string;
  policies_summary: string;
  custom_instructions?: string;
}
