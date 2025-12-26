// Quote Types
// Quote builder with Stripe Payment Links

export interface Quote {
  id: string;
  org_id: string;

  // References
  job_id?: string;
  client_id?: string;
  event_id?: string;

  // Quote identification
  quote_number: string; // e.g., "QT-2025-001"
  title?: string; // e.g., "Bathroom Renovation Quote"

  // Line items
  line_items: LineItem[];

  // Pricing
  subtotal: number; // decimal(12, 2)
  tax_rate: number; // decimal(5, 2) - e.g., 10.00 for 10%
  tax_amount: number; // decimal(12, 2)
  total: number; // decimal(12, 2)

  // Quote details
  notes?: string; // Internal notes
  terms?: string; // Terms and conditions shown to customer
  valid_until?: string; // ISO date string

  // Customer message
  message?: string; // Custom message to include in SMS/email

  // Status
  status: QuoteStatus;

  // Stripe integration
  stripe_payment_link_id?: string;
  stripe_payment_link_url?: string;

  // PDF generation
  pdf_url?: string; // Supabase Storage URL

  // Tracking
  sent_at?: string; // ISO timestamp
  sent_to?: string; // Phone or email
  viewed_at?: string;
  accepted_at?: string;
  declined_at?: string;

  // Metadata
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export type QuoteStatus =
  | 'draft'     // Not yet sent
  | 'sent'      // Sent to customer
  | 'viewed'    // Customer viewed the quote
  | 'accepted'  // Customer accepted
  | 'declined'  // Customer declined
  | 'expired';  // Past valid_until date

export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number; // decimal(12, 2)
  total: number; // quantity * unit_price
}

// Create Quote Request
export interface CreateQuoteRequest {
  org_id: string;
  job_id?: string;
  client_id?: string;
  event_id?: string;
  title?: string;
  line_items: LineItem[];
  tax_rate?: number; // Defaults to 10.00 (Australian GST)
  notes?: string;
  terms?: string;
  valid_until?: string; // ISO date string
  message?: string;
}

// Update Quote Request
export type UpdateQuoteRequest = Partial<Omit<CreateQuoteRequest, 'org_id'>>;

// Send Quote Request
export interface SendQuoteRequest {
  quote_id: string;
  send_to: string; // Phone number or email
  send_via: 'sms' | 'email';
  generate_payment_link?: boolean; // Default true
  generate_pdf?: boolean; // Default true
}

// Accept/Decline Quote Request
export interface QuoteResponseRequest {
  quote_id: string;
  action: 'accept' | 'decline';
  customer_notes?: string;
}

// Quote with related data (for admin views)
export interface QuoteWithDetails extends Quote {
  job?: any; // Import from jobs types if needed
  client?: any; // Import from clients types if needed
  event?: any; // Import from calendar types if needed
}

// Calculate quote totals helper
export interface QuoteCalculation {
  subtotal: number;
  tax_amount: number;
  total: number;
}
