/**
 * Quote Links System Types
 *
 * Defines TypeScript interfaces for the Quote Links feature including:
 * - Question configurations
 * - Form templates
 * - Quote submissions
 * - Price guides and rules
 * - Analytics events
 */

// ============================================================================
// Question Types
// ============================================================================

export type QuestionType =
  | 'yes_no'
  | 'single_choice'
  | 'multi_select'
  | 'short_text'
  | 'long_text'
  | 'number'
  | 'address'
  | 'date_time';

export interface QuestionOption {
  id: string;
  label: string;
  value: string;
  icon?: string; // Optional icon name (e.g., 'check', 'wrench')
}

export interface QuestionCondition {
  questionId: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
}

export interface QuestionConfig {
  id: string; // UUID
  type: QuestionType;
  question: string;
  description?: string; // Helper text shown below question
  required: boolean;
  order: number;

  // For choice types (single_choice, multi_select)
  options?: QuestionOption[];

  // For number type
  min?: number;
  max?: number;
  step?: number;
  unit?: string; // e.g., "sqm", "hours", "units"

  // For text types
  placeholder?: string;
  maxLength?: number;

  // Conditional logic (v1.1+)
  showIf?: QuestionCondition;
}

// ============================================================================
// Form Template Types
// ============================================================================

export interface QuoteFormTemplate {
  id: string;
  name: string;
  industry: string; // 'plumbing' | 'electrical' | 'cleaning' | etc.
  description: string | null;
  icon: string | null;
  questions: QuestionConfig[];
  price_guide_template: PriceRule[] | null;
  disclaimer_template: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateQuoteFormTemplateRequest {
  name: string;
  industry: string;
  description?: string;
  icon?: string;
  questions: QuestionConfig[];
  price_guide_template?: PriceRule[];
  disclaimer_template?: string;
  sort_order?: number;
}

// ============================================================================
// Business Quote Form Types
// ============================================================================

export interface BusinessQuoteForm {
  id: string;
  org_id: string;
  slug: string; // Unique URL slug (e.g., 'joes-plumbing-quote')
  template_id: string | null; // Reference to template if based on one

  // Form Configuration
  title: string;
  description: string | null;
  questions: QuestionConfig[];
  version: number;
  is_published: boolean;

  // Branding
  logo_url: string | null;
  primary_color: string;

  // Settings
  allow_media_upload: boolean;
  max_photos: number;
  max_videos: number;
  require_phone: boolean;
  require_email: boolean;

  // Legal
  disclaimer: string | null;
  terms_url: string | null;
  privacy_url: string | null;

  // Metadata
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface CreateBusinessQuoteFormRequest {
  org_id: string;
  title: string;
  description?: string;
  questions: QuestionConfig[];
  template_id?: string; // If based on template
  logo_url?: string;
  primary_color?: string;
  allow_media_upload?: boolean;
  max_photos?: number;
  max_videos?: number;
  require_phone?: boolean;
  require_email?: boolean;
  disclaimer?: string;
}

export interface UpdateBusinessQuoteFormRequest {
  title?: string;
  description?: string;
  questions?: QuestionConfig[];
  logo_url?: string;
  primary_color?: string;
  allow_media_upload?: boolean;
  max_photos?: number;
  max_videos?: number;
  require_phone?: boolean;
  require_email?: boolean;
  disclaimer?: string;
  is_published?: boolean;
}

// ============================================================================
// Quote Submission Types
// ============================================================================

export type QuoteSubmissionStatus = 'new' | 'reviewing' | 'quoted' | 'won' | 'lost' | 'archived';

export interface QuoteSubmission {
  id: string;
  form_id: string;
  org_id: string;

  // Customer Info
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_address: string | null;

  // Submission Data
  answers: Record<string, any>; // Map of question_id to answer value
  form_version: number;

  // Estimate (if price guide enabled)
  estimated_price_min: number | null;
  estimated_price_max: number | null;
  estimate_note: string | null;
  estimate_shown_to_customer: boolean;
  price_guide_rules_applied: AppliedRule[] | null;

  // Status
  status: QuoteSubmissionStatus;

  // Relationships
  job_id: string | null; // Auto-created job card
  quote_id: string | null; // Sent quote
  client_id: string | null; // Matched/created client

  // Source Tracking
  source: 'web' | 'sms' | 'call' | 'direct';
  call_sid: string | null;
  referrer: string | null;

  // Session Metadata
  ip_address: string | null;
  user_agent: string | null;

  // Timestamps
  submitted_at: string;
  reviewed_at: string | null;
  quoted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateQuoteSubmissionRequest {
  form_id: string;
  org_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  customer_address?: string;
  answers: Record<string, any>;
  form_version: number;
  source?: 'web' | 'sms' | 'call' | 'direct';
  call_sid?: string;
  referrer?: string;
  session_id?: string;
}

export interface UpdateQuoteSubmissionRequest {
  status?: QuoteSubmissionStatus;
  job_id?: string;
  quote_id?: string;
  client_id?: string;
  reviewed_at?: string;
  quoted_at?: string;
}

// ============================================================================
// Quote Submission Media Types
// ============================================================================

export type MediaType = 'photo' | 'video';
export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'failed';
export type ScanStatus = 'pending' | 'clean' | 'infected' | 'error' | 'skipped';

export interface QuoteSubmissionMedia {
  id: string;
  submission_id: string;
  media_type: MediaType;
  file_url: string; // Supabase Storage URL
  thumbnail_url: string | null; // For videos and photo previews

  // File Metadata
  original_filename: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null; // For videos

  // Upload Tracking
  upload_status: UploadStatus;
  upload_progress: number; // 0-100
  upload_error: string | null;

  // Security Scanning
  scan_status: ScanStatus;
  scanned_at: string | null;
  scan_result: any | null;

  // Display Order
  sort_order: number;

  created_at: string;
  updated_at: string;
}

export interface CreateMediaRequest {
  submission_id: string;
  media_type: MediaType;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
}

export interface UpdateMediaRequest {
  file_url?: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  duration_seconds?: number;
  upload_status?: UploadStatus;
  upload_progress?: number;
  upload_error?: string;
  scan_status?: ScanStatus;
  scanned_at?: string;
  scan_result?: any;
}

// ============================================================================
// Price Guide Types
// ============================================================================

export type EstimateMode = 'internal' | 'range' | 'starting_from' | 'disabled';
export type RuleActionType = 'add' | 'multiply' | 'set_band';

export interface PriceRuleCondition {
  questionId: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between';
  value: any; // Single value or array for 'between'
}

export interface PriceRuleAction {
  type: RuleActionType;
  value: number | { min: number; max: number };
  note?: string; // Explanation shown to customer
}

export interface PriceRule {
  id: string;
  name: string; // For business user reference
  enabled: boolean;
  condition: PriceRuleCondition;
  action: PriceRuleAction;
  order: number; // Execution order
}

export interface AppliedRule {
  ruleName: string;
  adjustment: number | { min: number; max: number };
  note?: string;
}

export interface PriceGuide {
  id: string;
  form_id: string;
  org_id: string;

  // Display Settings
  estimate_mode: EstimateMode;
  show_to_customer: boolean;

  // Base Pricing
  base_price: number | null;
  base_callout_fee: number | null;
  currency: string;

  // Rules
  rules: PriceRule[];

  // Constraints
  min_price: number | null;
  max_price: number | null;

  // Disclaimer & Notes
  disclaimer: string;
  internal_notes: string | null;

  // Versioning
  version: number;
  is_active: boolean;

  created_at: string;
  updated_at: string;
}

export interface CreatePriceGuideRequest {
  form_id: string;
  org_id: string;
  estimate_mode?: EstimateMode;
  show_to_customer?: boolean;
  base_price?: number;
  base_callout_fee?: number;
  currency?: string;
  rules?: PriceRule[];
  min_price?: number;
  max_price?: number;
  disclaimer?: string;
  internal_notes?: string;
}

export interface UpdatePriceGuideRequest {
  estimate_mode?: EstimateMode;
  show_to_customer?: boolean;
  base_price?: number;
  base_callout_fee?: number;
  rules?: PriceRule[];
  min_price?: number;
  max_price?: number;
  disclaimer?: string;
  internal_notes?: string;
}

export interface PriceEstimate {
  min: number;
  max: number;
  appliedRules: AppliedRule[];
  mode: EstimateMode;
  disclaimer: string;
  showToCustomer: boolean;
}

// ============================================================================
// Analytics Types
// ============================================================================

export type QuoteLinkEventType =
  | 'link_opened'
  | 'form_started'
  | 'question_answered'
  | 'media_upload_started'
  | 'media_uploaded'
  | 'form_submitted'
  | 'estimate_viewed';

export interface QuoteLinkEvent {
  id: string;
  form_id: string | null;
  submission_id: string | null;
  org_id: string;

  event_type: QuoteLinkEventType;
  event_data: any | null; // Additional context

  // Session Tracking
  session_id: string | null;

  // Context
  ip_address: string | null;
  user_agent: string | null;
  referrer: string | null;

  created_at: string;
}

export interface CreateQuoteLinkEventRequest {
  form_id?: string;
  submission_id?: string;
  org_id: string;
  event_type: QuoteLinkEventType;
  event_data?: any;
  session_id?: string;
  ip_address?: string;
  user_agent?: string;
  referrer?: string;
}

export interface QuoteLinkAnalytics {
  form_id: string;
  total_opens: number;
  total_started: number;
  total_submitted: number;
  conversion_rate: number; // (submitted / opened) * 100
  completion_rate: number; // (submitted / started) * 100
  average_time_to_submit: number; // seconds
  media_upload_rate: number; // % of submissions with media
  estimate_view_rate: number; // % of submissions that viewed estimate
  top_drop_off_question: string | null;
  submissions_by_status: Record<QuoteSubmissionStatus, number>;
  submissions_by_source: Record<string, number>;
}

// ============================================================================
// Helper Types
// ============================================================================

export interface QuoteFormWithTemplate extends BusinessQuoteForm {
  template?: QuoteFormTemplate;
}

export interface QuoteSubmissionWithMedia extends QuoteSubmission {
  media: QuoteSubmissionMedia[];
  form?: BusinessQuoteForm;
}

export interface QuoteSubmissionWithRelations extends QuoteSubmission {
  media: QuoteSubmissionMedia[];
  form: BusinessQuoteForm;
  job?: any; // Job type from existing types
  quote?: any; // Quote type from existing types
  client?: any; // Client type from existing types
}

// ============================================================================
// Validation Helpers
// ============================================================================

export const INDUSTRY_OPTIONS = [
  { value: 'plumbing', label: 'Plumbing', icon: 'wrench' },
  { value: 'electrical', label: 'Electrical', icon: 'zap' },
  { value: 'cleaning', label: 'Cleaning', icon: 'sparkles' },
  { value: 'lawn', label: 'Lawn & Garden', icon: 'leaf' },
  { value: 'handyman', label: 'Handyman', icon: 'hammer' },
  { value: 'painting', label: 'Painting', icon: 'paintbrush' },
  { value: 'removalist', label: 'Removalist', icon: 'truck' },
  { value: 'beauty', label: 'Beauty/Salon', icon: 'star' },
] as const;

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  yes_no: 'Yes/No',
  single_choice: 'Single Choice',
  multi_select: 'Multiple Choice',
  short_text: 'Short Text',
  long_text: 'Long Text',
  number: 'Number',
  address: 'Address',
  date_time: 'Date/Time',
};

export const ESTIMATE_MODE_LABELS: Record<EstimateMode, string> = {
  internal: 'Internal Only (not shown to customer)',
  range: 'Price Range (e.g., $150-$250)',
  starting_from: 'Starting From (e.g., From $150)',
  disabled: 'Disabled (no estimates)',
};

// ============================================================================
// Constants
// ============================================================================

export const MAX_FILE_SIZE_MB = {
  photo: 10,
  video: 50,
} as const;

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;

export const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
] as const;

export const DEFAULT_DISCLAIMER = 'This is an estimate only based on the information provided. Final price will be confirmed after inspection.';

export const QUOTE_SUBMISSION_STATUS_LABELS: Record<QuoteSubmissionStatus, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  quoted: 'Quote Sent',
  won: 'Won',
  lost: 'Lost',
  archived: 'Archived',
};

export const QUOTE_SUBMISSION_STATUS_COLORS: Record<QuoteSubmissionStatus, string> = {
  new: '#F59E0B', // Warning/Amber
  reviewing: '#2563EB', // Primary/Blue
  quoted: '#2563EB', // Primary/Blue
  won: '#10B981', // Success/Green
  lost: '#64748B', // Secondary/Gray
  archived: '#64748B', // Secondary/Gray
};
