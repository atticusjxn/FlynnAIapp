import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types matching the quote links system
export interface BusinessQuoteForm {
  id: string;
  org_id: string;
  slug: string;
  template_id: string | null;

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
}

export interface QuestionConfig {
  id: string;
  type: QuestionType;
  question: string;
  description?: string;
  required: boolean;
  order: number;
  options?: QuestionOption[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  placeholder?: string;
  maxLength?: number;
  showIf?: QuestionCondition;
}

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
  icon?: string;
}

export interface QuestionCondition {
  questionId: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
}

export interface PriceGuide {
  id: string;
  form_id: string;
  org_id: string;
  estimate_mode: 'internal' | 'range' | 'starting_from' | 'disabled';
  show_to_customer: boolean;
  base_price: number | null;
  base_callout_fee: number | null;
  currency: string;
  rules: PriceRule[];
  min_price: number | null;
  max_price: number | null;
  disclaimer: string;
  internal_notes: string | null;
  version: number;
  is_active: boolean;
}

export interface PriceRule {
  id: string;
  name: string;
  enabled: boolean;
  condition: {
    questionId: string;
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between';
    value: any;
  };
  action: {
    type: 'add' | 'multiply' | 'set_band';
    value: number | { min: number; max: number };
    note?: string;
  };
  order: number;
}

export interface PriceEstimate {
  min: number;
  max: number;
  appliedRules: Array<{
    ruleName: string;
    adjustment: number | { min: number; max: number };
    note?: string;
  }>;
  mode: 'internal' | 'range' | 'starting_from' | 'disabled';
  disclaimer: string;
  showToCustomer: boolean;
}

export interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  type: 'photo' | 'video';
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  error?: string;
}
